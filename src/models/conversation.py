"""Conversation model for managing chat conversations."""

from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from pydantic import BaseModel, Field

from .message import MessageNode


class Conversation(BaseModel):
    """A conversation containing a tree of messages."""
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str = "New Chat"
    nodes: dict[str, MessageNode] = Field(default_factory=dict)
    root_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    def create_root(self, system_prompt: str) -> MessageNode:
        """Create a system message as the root of the conversation."""
        if self.root_id is not None:
            raise ValueError("Conversation already has a root message")
        
        root = MessageNode(role="system", content=system_prompt)
        self.nodes[root.id] = root
        self.root_id = root.id
        self._update_timestamp()
        return root
    
    def add_message(self, role: str, content: str, parent_id: Optional[str]) -> MessageNode:
        """Add a new message to the conversation as a child of the parent_id."""
        if parent_id is not None and parent_id not in self.nodes:
            raise KeyError(f"Parent message with id '{parent_id}' not found")
        
        message = MessageNode(role=role, content=content, parent_id=parent_id)
        self.nodes[message.id] = message
        
        # Update parent's children_ids
        if parent_id is not None:
            parent = self.nodes[parent_id]
            parent.children_ids.append(message.id)
        
        self._update_timestamp()
        return message
    
    def get_path_to(self, node_id: str) -> List[MessageNode]:
        """Get the path from root to the specified node (root-first order)."""
        if node_id not in self.nodes:
            raise KeyError(f"Message with id '{node_id}' not found")
        
        path = []
        current_id = node_id
        
        # Walk up the tree from node to root
        while current_id is not None:
            node = self.nodes[current_id]
            path.append(node)
            current_id = node.parent_id
        
        # Reverse to get root-first order
        path.reverse()
        return path
    
    def get_leaf_ids(self) -> List[str]:
        """Get all message IDs that have no children (leaf nodes)."""
        return [node_id for node_id, node in self.nodes.items() if not node.children_ids]
    
    def get_api_messages(self, leaf_id: str) -> List[dict[str, str]]:
        """Get the conversation path as API-ready messages."""
        path = self.get_path_to(leaf_id)
        return [node.to_api_dict() for node in path]
    
    def _update_timestamp(self) -> None:
        """Update the updated_at timestamp."""
        self.updated_at = datetime.utcnow()