"""Tests for the MessageNode model."""

import pytest
from datetime import datetime
from uuid import UUID

from src.models.message import MessageNode


class TestMessageNode:
    """Test suite for MessageNode functionality."""

    def test_create_message_defaults(self):
        """Creating a MessageNode with just role and content auto-generates id, created_at, empty children_ids."""
        message = MessageNode(role="user", content="Hello")
        
        assert isinstance(message.id, str)
        assert UUID(message.id)  # Should be valid UUID
        assert message.role == "user"
        assert message.content == "Hello"
        assert isinstance(message.created_at, datetime)
        assert message.parent_id is None
        assert message.children_ids == []

    def test_create_message_with_parent(self):
        """parent_id is stored correctly."""
        parent_id = "parent-123"
        message = MessageNode(role="assistant", content="Hi", parent_id=parent_id)
        
        assert message.parent_id == parent_id

    def test_message_id_uniqueness(self):
        """Two messages created in sequence have different id values."""
        message1 = MessageNode(role="user", content="First")
        message2 = MessageNode(role="user", content="Second")
        
        assert message1.id != message2.id

    def test_message_role_validation(self):
        """Passing role="invalid" raises a validation error."""
        with pytest.raises(ValueError, match="Role must be one of"):
            MessageNode(role="invalid", content="test")

    def test_message_content_can_be_empty_string(self):
        """Empty string content is allowed (for streaming placeholder)."""
        message = MessageNode(role="assistant", content="")
        
        assert message.content == ""

    def test_message_serialization_roundtrip(self):
        """model_dump() → MessageNode(**data) produces identical object."""
        original = MessageNode(
            role="user", 
            content="Test message",
            parent_id="parent-123"
        )
        
        data = original.model_dump()
        reconstructed = MessageNode(**data)
        
        assert original.id == reconstructed.id
        assert original.role == reconstructed.role
        assert original.content == reconstructed.content
        assert original.parent_id == reconstructed.parent_id
        assert original.children_ids == reconstructed.children_ids
        # created_at might have slight differences due to precision, so we check they're close
        assert abs((original.created_at - reconstructed.created_at).total_seconds()) < 1

    def test_message_to_api_format(self):
        """A method to_api_dict() returns {"role": "...", "content": "..."} (only what the API needs, no internal fields)."""
        message = MessageNode(
            role="assistant",
            content="Hello, world!",
            parent_id="parent-123"
        )
        
        api_dict = message.to_api_dict()
        
        assert api_dict == {
            "role": "assistant",
            "content": "Hello, world!"
        }
        # Ensure internal fields are not included
        assert "id" not in api_dict
        assert "created_at" not in api_dict
        assert "parent_id" not in api_dict
        assert "children_ids" not in api_dict

    def test_valid_roles_accepted(self):
        """All valid roles are accepted."""
        for role in ["system", "user", "assistant"]:
            message = MessageNode(role=role, content="test")
            assert message.role == role

    def test_message_with_children_ids(self):
        """children_ids can be set and retrieved."""
        children = ["child-1", "child-2"]
        message = MessageNode(role="system", content="System prompt", children_ids=children)
        
        assert message.children_ids == children

    def test_message_created_at_is_utc(self):
        """created_at is set to current UTC time."""
        before = datetime.utcnow()
        message = MessageNode(role="user", content="test")
        after = datetime.utcnow()
        
        assert before <= message.created_at <= after