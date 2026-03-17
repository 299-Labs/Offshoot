"""Tests for the AppState model."""

import pytest

from src.models.app_state import AppState
from src.models.conversation import Conversation


class TestAppState:
    """Test suite for AppState functionality."""

    def test_init_populates_defaults(self):
        """After AppState(store={}), store contains keys for api_key, model, conversations, active_conversation_id, active_leaf_id with sensible defaults."""
        store = {}
        state = AppState(store)
        
        assert state.store["api_key"] == ""
        assert state.store["model"] == "gpt-3.5-turbo"
        assert state.store["conversations"] == {}
        assert state.store["active_conversation_id"] is None
        assert state.store["active_leaf_id"] is None

    def test_init_does_not_overwrite_existing(self):
        """If store already has api_key="sk-xxx", init preserves it."""
        store = {"api_key": "sk-xxx", "model": "custom-model"}
        state = AppState(store)
        
        assert state.store["api_key"] == "sk-xxx"
        assert state.store["model"] == "custom-model"
        assert state.store["conversations"] == {}
        assert state.store["active_conversation_id"] is None
        assert state.store["active_leaf_id"] is None

    def test_set_get_api_key(self):
        """Roundtrips correctly."""
        store = {}
        state = AppState(store)
        
        state.set_api_key("test-key")
        assert state.get_api_key() == "test-key"

    def test_set_get_model(self):
        """Roundtrips correctly."""
        store = {}
        state = AppState(store)
        
        state.set_selected_model("gpt-4")
        assert state.get_selected_model() == "gpt-4"

    def test_create_new_conversation(self):
        """Returns a Conversation, it appears in get_conversations(), it becomes the active conversation, its root exists."""
        store = {}
        state = AppState(store)
        
        conversation = state.create_new_conversation("Test system prompt")
        
        assert isinstance(conversation, Conversation)
        assert conversation.id in state.get_conversations()
        assert state.get_conversations()[conversation.id] == conversation
        assert state.get_active_conversation() == conversation
        assert conversation.root_id is not None
        assert conversation.nodes[conversation.root_id].content == "Test system prompt"

    def test_create_multiple_conversations(self):
        """Three creates → three entries in get_conversations()."""
        store = {}
        state = AppState(store)
        
        conv1 = state.create_new_conversation("Prompt 1")
        conv2 = state.create_new_conversation("Prompt 2")
        conv3 = state.create_new_conversation("Prompt 3")
        
        conversations = state.get_conversations()
        assert len(conversations) == 3
        assert conv1.id in conversations
        assert conv2.id in conversations
        assert conv3.id in conversations

    def test_set_active_conversation_invalid_id_raises(self):
        """Raises KeyError."""
        store = {}
        state = AppState(store)
        state.create_new_conversation("Test prompt")
        
        with pytest.raises(KeyError, match="Conversation with id 'invalid' not found"):
            state.set_active_conversation("invalid")

    def test_get_active_conversation_when_none(self):
        """Returns None before any conversation is created."""
        store = {}
        state = AppState(store)
        
        assert state.get_active_conversation() is None

    def test_active_leaf_tracks_correctly(self):
        """After creating a conversation and adding messages, get_active_leaf_id returns the last added message id."""
        store = {}
        state = AppState(store)
        
        conversation = state.create_new_conversation("Test prompt")
        root = conversation.nodes[conversation.root_id]
        user_message = conversation.add_message("user", "Hello", root.id)
        assistant_message = conversation.add_message("assistant", "Hi", user_message.id)
        
        state.set_active_leaf_id(assistant_message.id)
        
        assert state.get_active_leaf_id() == assistant_message.id

    def test_conversations_persist_across_instances(self):
        """Mutate the store dict, create a new AppState instance with the same store → all data is still there."""
        store = {}
        state1 = AppState(store)
        
        # Create conversations
        conv1 = state1.create_new_conversation("Prompt 1")
        conv2 = state1.create_new_conversation("Prompt 2")
        
        # Create new AppState instance with same store
        state2 = AppState(store)
        
        conversations = state2.get_conversations()
        assert len(conversations) == 2
        assert conv1.id in conversations
        assert conv2.id in conversations
        assert state2.get_active_conversation() == conv2  # Last created is active

    def test_set_active_conversation_switches_correctly(self):
        """Can switch between existing conversations."""
        store = {}
        state = AppState(store)
        
        conv1 = state.create_new_conversation("Prompt 1")
        conv2 = state.create_new_conversation("Prompt 2")
        
        # Switch to first conversation
        state.set_active_conversation(conv1.id)
        assert state.get_active_conversation() == conv1
        
        # Switch to second conversation
        state.set_active_conversation(conv2.id)
        assert state.get_active_conversation() == conv2

    def test_active_conversation_id_persists(self):
        """Active conversation ID is preserved when creating new AppState."""
        store = {}
        state1 = AppState(store)
        
        conv = state1.create_new_conversation("Test prompt")
        state1.set_active_conversation(conv.id)
        
        # Create new instance
        state2 = AppState(store)
        
        assert state2.get_active_conversation() == conv
        assert state2.store["active_conversation_id"] == conv.id

    def test_active_leaf_id_persists(self):
        """Active leaf ID is preserved when creating new AppState."""
        store = {}
        state1 = AppState(store)
        
        conv = state1.create_new_conversation("Test prompt")
        root = conv.nodes[conv.root_id]
        user_msg = conv.add_message("user", "Hello", root.id)
        
        state1.set_active_leaf_id(user_msg.id)
        
        # Create new instance
        state2 = AppState(store)
        
        assert state2.get_active_leaf_id() == user_msg.id
        assert state2.store["active_leaf_id"] == user_msg.id

    def test_create_conversation_with_custom_system_prompt(self):
        """Can create conversation with custom system prompt."""
        store = {}
        state = AppState(store)
        
        conversation = state.create_new_conversation("Custom system prompt")
        
        root = conversation.nodes[conversation.root_id]
        assert root.content == "Custom system prompt"
        assert root.role == "system"