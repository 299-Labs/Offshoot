"""Tests for the OpenRouter service."""

import pytest
from unittest.mock import Mock, patch, MagicMock
from src.services.openrouter import OpenRouterService, OpenRouterError

class TestOpenRouterService:
    """Test suite for OpenRouterService functionality."""

    @pytest.fixture
    def sample_models_response(self):
        """Sample response from OpenRouter /models endpoint."""
        return {
            "data": [
                {"id": "anthropic/claude-3-sonnet", "name": "Claude 3 Sonnet"},
                {"id": "openai/gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
                {"id": "openai/gpt-4", "name": "GPT-4"},
                {"id": "google/gemini-pro", "name": "Gemini Pro"}
            ]
        }

    def test_fetch_models_success(self, sample_models_response):
        """Verify models are fetched and parsed correctly."""
        service = OpenRouterService("test-key")
        
        with patch('httpx.get') as mock_get:
            mock_response = MagicMock()
            mock_response.json.return_value = sample_models_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            result = service.fetch_models()
            
            assert len(result) == 4
            # Results should be sorted by name: Claude, Gemini, GPT-3.5, GPT-4
            assert result[0]["name"] == "Claude 3 Sonnet"
            assert result[1]["name"] == "Gemini Pro"

    def test_fetch_models_bad_key_raises(self):
        """Verify that a failed response raises OpenRouterError."""
        service = OpenRouterService("invalid-key")
        
        with patch('httpx.get') as mock_get:
            mock_response = MagicMock()
            # Simulate httpx raise_for_status throwing an error
            mock_response.raise_for_status.side_effect = Exception("401 Unauthorized")
            mock_get.return_value = mock_response
            
            with pytest.raises(OpenRouterError, match="Failed to fetch models"):
                service.fetch_models()

    def test_stream_chat_completion_yields_deltas(self):
        """Verify stream yields content chunks."""
        service = OpenRouterService("test-key")
        
        # Sample chunks matching OpenAI/OpenRouter structure
        sample_chunks = [
            Mock(choices=[Mock(delta=Mock(content="Hello"))]),
            Mock(choices=[Mock(delta=Mock(content=" world"))])
        ]
        
        with patch.object(service.client.chat.completions, 'create') as mock_create:
            mock_create.return_value = sample_chunks
            
            result = list(service.stream_chat_completion("gpt-3.5-turbo", [{"role": "user", "content": "Hi"}]))
            assert result == ["Hello", " world"]

    def test_validate_api_key_invalid(self):
        """Ensure validate_api_key returns False on failure."""
        service = OpenRouterService("invalid-key")
        
        with patch('httpx.get') as mock_get:
            mock_response = MagicMock()
            mock_response.raise_for_status.side_effect = Exception("401")
            mock_get.return_value = mock_response
            
            assert service.validate_api_key() is False

    def test_fetch_models_sorts_by_name(self, sample_models_response):
        """Given unsorted input, output is sorted."""
        service = OpenRouterService("test-key")
        
        with patch('httpx.get') as mock_get:
            mock_response = MagicMock()
            mock_response.json.return_value = sample_models_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            result = service.fetch_models()
            
            # Check that the result is sorted by name
            names = [model["name"] for model in result]
            # Expected order: Claude 3 Sonnet, Gemini Pro, GPT-3.5 Turbo, GPT-4
            expected_names = ["Claude 3 Sonnet", "Gemini Pro", "GPT-3.5 Turbo", "GPT-4"]
            assert names == expected_names

    def test_fetch_models_network_error(self):
        """Mock connection error → raises descriptive exception."""
        service = OpenRouterService("test-key")
        
        with patch('httpx.get') as mock_get:
            mock_get.side_effect = Exception("Connection failed")
            
            with pytest.raises(OpenRouterError, match="Failed to fetch models"):
                service.fetch_models()

    def test_stream_chat_completion_empty_response(self):
        """Model returns empty → generator yields nothing (no crash)."""
        service = OpenRouterService("test-key")
        
        with patch.object(service.client.chat.completions, 'create') as mock_create:
            mock_create.return_value = []
            
            result = list(service.stream_chat_completion("gpt-3.5-turbo", [{"role": "user", "content": "Hello"}]))
            
            assert result == []

    def test_stream_chat_completion_bad_model_raises(self):
        """Mock 404/400 → raises descriptive error."""
        service = OpenRouterService("test-key")
        
        with patch.object(service.client.chat.completions, 'create') as mock_create:
            mock_create.side_effect = Exception("400 Bad Request")
            
            with pytest.raises(OpenRouterError, match="Failed to stream chat completion"):
                list(service.stream_chat_completion("invalid-model", [{"role": "user", "content": "Hello"}]))

    def test_stream_chat_completion_passes_correct_headers(self):
        """Verify the HTTP-Referer and X-Title headers are set (OpenRouter requires/recommends these)."""
        service = OpenRouterService("test-key")
        
        with patch.object(service.client.chat.completions, 'create') as mock_create:
            mock_create.return_value = []
            
            list(service.stream_chat_completion("gpt-3.5-turbo", [{"role": "user", "content": "Hello"}]))
            
            # Verify the client was initialized with correct headers
            assert service.client.default_headers["HTTP-Referer"] == "https://github.com/299-Labs/Offshoot"
            assert service.client.default_headers["X-Title"] == "Offshoot Chat"

    def test_validate_api_key_valid(self, sample_models_response):
        """Mock successful models fetch → returns True."""
        service = OpenRouterService("valid-key")
        
        with patch('httpx.get') as mock_get:
            mock_response = MagicMock()
            mock_response.json.return_value = sample_models_response
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            result = service.validate_api_key()
            
            assert result is True

    def test_service_initialization(self):
        """Service initializes with correct base URL and headers."""
        service = OpenRouterService("test-key")
        
        assert service.api_key == "test-key"
        # The base_url property returns a URL object, so we need to convert to string for comparison
        assert str(service.client.base_url) == "https://openrouter.ai/api/v1/chat/completions/"
        assert service.client.default_headers["HTTP-Referer"] == "https://github.com/299-Labs/Offshoot"
        assert service.client.default_headers["X-Title"] == "Offshoot Chat"

    def test_stream_chat_completion_with_multiple_choices(self):
        """Handle stream chunks with multiple choices."""
        service = OpenRouterService("test-key")
        
        # Mock chunks with multiple choices, only first should be used
        chunks = [
            Mock(choices=[Mock(delta=Mock(content="First")), Mock(delta=Mock(content="Second"))]),
            Mock(choices=[Mock(delta=Mock(content=" chunk"))])
        ]
        
        with patch.object(service.client.chat.completions, 'create') as mock_create:
            mock_create.return_value = chunks
            
            result = list(service.stream_chat_completion("gpt-3.5-turbo", [{"role": "user", "content": "Hello"}]))
            
            assert result == ["First", " chunk"]

    def test_stream_chat_completion_with_no_content(self):
        """Handle stream chunks with no content."""
        service = OpenRouterService("test-key")
        
        chunks = [
            Mock(choices=[Mock(delta=Mock(content=None))]),
            Mock(choices=[Mock(delta=Mock(content="Hello"))]),
            Mock(choices=[Mock(delta=Mock(content=None))])
        ]
        
        with patch.object(service.client.chat.completions, 'create') as mock_create:
            mock_create.return_value = chunks
            
            result = list(service.stream_chat_completion("gpt-3.5-turbo", [{"role": "user", "content": "Hello"}]))
            
            assert result == ["Hello"]

    def test_fetch_models_with_missing_name_field(self):
        """Handle models without name field."""
        service = OpenRouterService("test-key")
        
        response_data = {
            "data": [
                {"id": "model-1", "name": "Named Model"},
                {"id": "model-2"}  # No name field
            ]
        }
        
        with patch('httpx.get') as mock_get:
            mock_response = MagicMock()
            mock_response.json.return_value = response_data
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response
            
            result = service.fetch_models()
            
            assert len(result) == 2
            # The sorting should put model-2 first because "model-2" comes before "Named Model" alphabetically
            assert result[0]["id"] == "model-2"
            assert result[0]["name"] == "model-2"  # Should use id as fallback
            assert result[1]["id"] == "model-1"
            assert result[1]["name"] == "Named Model"
