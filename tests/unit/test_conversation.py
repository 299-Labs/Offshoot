"""Tests for the Conversation model."""

import pytest
from datetime import datetime

from src.models.conversation import Conversation
from src.models.message import MessageNode


class TestConversation:
    """Test suite for Conversation functionality."""

    def test_new_conversation_is_empty(self):
        """Fresh conversation has no nodes, root_id is None."""
        conversation = Conversation()
        
        assert conversation.nodes == {}
        assert conversation.root_id is None
        assert conversation.title == "New Chat"

    def test_create_root(self):
        """After create_root("You are helpful"), root_id is set, node exists in nodes, role is "system"."""
        conversation = Conversation()
        root = conversation.create_root("You are helpful")
        
        assert conversation.root_id == root.id
        assert root.id in conversation.nodes
        assert conversation.nodes[root.id] == root
        assert root.role == "system"
        assert root.content == "You are helpful"

    def test_create_root_twice_raises(self):
        """Calling create_root again raises an error (one root per conversation)."""
        conversation = Conversation()
        conversation.create_root("First system prompt")
        
        with pytest.raises(ValueError, match="Conversation already has a root message"):
            conversation.create_root("Second system prompt")

    def test_add_message_to_root(self):
        """Adding a user message with parent_id=root_id creates the node, and root's children_ids contains the new message id."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        user_message = conversation.add_message("user", "Hello", root.id)
        
        assert user_message.id in conversation.nodes
        assert conversation.nodes[user_message.id] == user_message
        assert user_message.parent_id == root.id
        assert user_message.id in root.children_ids

    def test_add_message_invalid_parent_raises(self):
        """Passing a nonexistent parent_id raises KeyError."""
        conversation = Conversation()
        conversation.create_root("System prompt")
        
        with pytest.raises(KeyError, match="Parent message with id 'nonexistent' not found"):
            conversation.add_message("user", "Hello", "nonexistent")

    def test_linear_chain(self):
        """Create root → user → assistant → user → assistant. Verify each node's parent/child links are correct."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        
        user1 = conversation.add_message("user", "Hello", root.id)
        assistant1 = conversation.add_message("assistant", "Hi there", user1.id)
        user2 = conversation.add_message("user", "How are you?", assistant1.id)
        assistant2 = conversation.add_message("assistant", "I'm doing well, thanks!", user2.id)
        
        # Check parent-child relationships
        assert user1.parent_id == root.id
        assert assistant1.parent_id == user1.id
        assert user2.parent_id == assistant1.id
        assert assistant2.parent_id == user2.id
        
        # Check children relationships
        assert root.children_ids == [user1.id]
        assert user1.children_ids == [assistant1.id]
        assert assistant1.children_ids == [user2.id]
        assert user2.children_ids == [assistant2.id]
        assert assistant2.children_ids == []

    def test_get_path_to_root(self):
        """get_path_to(root_id) returns a list of length 1 containing the root."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        
        path = conversation.get_path_to(root.id)
        
        assert len(path) == 1
        assert path[0] == root

    def test_get_path_to_leaf(self):
        """After a 5-message chain, get_path_to(last_id) returns all 5 in root-first order."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        user1 = conversation.add_message("user", "Hello", root.id)
        assistant1 = conversation.add_message("assistant", "Hi", user1.id)
        user2 = conversation.add_message("user", "How are you?", assistant1.id)
        assistant2 = conversation.add_message("assistant", "Good!", user2.id)
        
        path = conversation.get_path_to(assistant2.id)
        
        assert len(path) == 5
        assert path[0] == root
        assert path[1] == user1
        assert path[2] == assistant1
        assert path[3] == user2
        assert path[4] == assistant2

    def test_get_path_to_invalid_id_raises(self):
        """Nonexistent id raises error."""
        conversation = Conversation()
        conversation.create_root("System prompt")
        
        with pytest.raises(KeyError, match="Message with id 'nonexistent' not found"):
            conversation.get_path_to("nonexistent")

    def test_get_leaf_ids_single_leaf(self):
        """Linear chain → one leaf."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        user1 = conversation.add_message("user", "Hello", root.id)
        assistant1 = conversation.add_message("assistant", "Hi", user1.id)
        
        leaf_ids = conversation.get_leaf_ids()
        
        assert leaf_ids == [assistant1.id]

    def test_get_leaf_ids_empty_conversation(self):
        """Returns empty list."""
        conversation = Conversation()
        
        leaf_ids = conversation.get_leaf_ids()
        
        assert leaf_ids == []

    def test_get_api_messages_format(self):
        """Returns list of {"role": ..., "content": ...} dicts in correct order."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        user1 = conversation.add_message("user", "Hello", root.id)
        assistant1 = conversation.add_message("assistant", "Hi there", user1.id)
        
        api_messages = conversation.get_api_messages(assistant1.id)
        
        assert len(api_messages) == 3
        assert api_messages[0] == {"role": "system", "content": "System prompt"}
        assert api_messages[1] == {"role": "user", "content": "Hello"}
        assert api_messages[2] == {"role": "assistant", "content": "Hi there"}

    def test_get_api_messages_excludes_internal_fields(self):
        """No id, parent_id, children_ids, created_at in output dicts."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        user1 = conversation.add_message("user", "Hello", root.id)
        
        api_messages = conversation.get_api_messages(user1.id)
        
        for msg in api_messages:
            assert "id" not in msg
            assert "parent_id" not in msg
            assert "children_ids" not in msg
            assert "created_at" not in msg

    def test_updated_at_changes_on_add(self):
        """updated_at is newer after add_message than after construction."""
        conversation = Conversation()
        initial_updated_at = conversation.updated_at
        
        # Small delay to ensure different timestamps
        import time
        time.sleep(0.01)
        
        conversation.create_root("System prompt")
        
        assert conversation.updated_at > initial_updated_at

    def test_conversation_serialization_roundtrip(self):
        """Serialize to dict → reconstruct → all nodes and links intact."""
        # Create a conversation with a message chain
        original = Conversation()
        root = original.create_root("System prompt")
        user1 = original.add_message("user", "Hello", root.id)
        assistant1 = original.add_message("assistant", "Hi", user1.id)
        
        # Serialize and reconstruct
        data = original.model_dump()
        reconstructed = Conversation(**data)
        
        # Verify all nodes exist
        assert len(reconstructed.nodes) == 3
        assert reconstructed.root_id == root.id
        
        # Verify node contents
        assert reconstructed.nodes[root.id].role == "system"
        assert reconstructed.nodes[user1.id].role == "user"
        assert reconstructed.nodes[assistant1.id].role == "assistant"
        
        # Verify parent-child relationships
        assert reconstructed.nodes[user1.id].parent_id == root.id
        assert reconstructed.nodes[assistant1.id].parent_id == user1.id
        assert reconstructed.nodes[root.id].children_ids == [user1.id]
        assert reconstructed.nodes[user1.id].children_ids == [assistant1.id]
        assert reconstructed.nodes[assistant1.id].children_ids == []

    def test_multiple_conversations_isolated(self):
        """Creating multiple conversations keeps them separate."""
        conv1 = Conversation()
        conv2 = Conversation()
        
        root1 = conv1.create_root("System 1")
        root2 = conv2.create_root("System 2")
        
        assert conv1.root_id != conv2.root_id
        assert root1.id not in conv2.nodes
        assert root2.id not in conv1.nodes

    def test_add_message_without_parent(self):
        """Can add a message without a parent (orphan message)."""
        conversation = Conversation()
        root = conversation.create_root("System prompt")
        
        orphan = conversation.add_message("user", "Orphan message", None)
        
        assert orphan.parent_id is None
        assert orphan.id in conversation.nodes
        assert orphan.id not in conversation.nodes[root.id].children_ids
