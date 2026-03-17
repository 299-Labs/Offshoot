"""Application state management for Streamlit session state."""

from typing import Any, Dict, Optional, Union

from .conversation import Conversation


class AppState:
    """Manages application state using Streamlit session state with dependency injection."""
    
    def __init__(self, store: Union[Dict[str, Any], Any]):
        """Initialize AppState with a store (st.session_state in production, dict in tests)."""
        self.store = store
        self._ensure_defaults()
    
    def _ensure_defaults(self) -> None:
        """Initialize session state keys if absent."""
        defaults = {
            "api_key": "",
            "model": "gpt-3.5-turbo",
            "conversations": {},
            "active_conversation_id": None,
            "active_leaf_id": None
        }
        
        for key, default_value in defaults.items():
            if key not in self.store:
                self.store[key] = default_value
    
    def get_api_key(self) -> str:
        """Get the API key."""
        return self.store["api_key"]
    
    def set_api_key(self, api_key: str) -> None:
        """Set the API key."""
        self.store["api_key"] = api_key
    
    def get_selected_model(self) -> str:
        """Get the selected model."""
        return self.store["model"]
    
    def set_selected_model(self, model: str) -> None:
        """Set the selected model."""
        self.store["model"] = model
    
    def get_conversations(self) -> Dict[str, Conversation]:
        """Get all conversations."""
        return self.store["conversations"]
    
    def get_active_conversation(self) -> Optional[Conversation]:
        """Get the active conversation."""
        active_id = self.store["active_conversation_id"]
        if active_id is None:
            return None
        return self.store["conversations"].get(active_id)
    
    def set_active_conversation(self, conversation_id: str) -> None:
        """Set the active conversation."""
        conversations = self.store["conversations"]
        if conversation_id not in conversations:
            raise KeyError(f"Conversation with id '{conversation_id}' not found")
        self.store["active_conversation_id"] = conversation_id
    
    def create_new_conversation(self, system_prompt: str = "You are a helpful assistant.") -> Conversation:
        """Create a new conversation and set it as active."""
        conversation = Conversation()
        conversation.create_root(system_prompt)
        
        self.store["conversations"][conversation.id] = conversation
        self.store["active_conversation_id"] = conversation.id
        
        return conversation
    
    def get_active_leaf_id(self) -> Optional[str]:
        """Get the active leaf message ID."""
        return self.store["active_leaf_id"]
    
    def set_active_leaf_id(self, leaf_id: Optional[str]) -> None:
        """Set the active leaf message ID."""
        self.store["active_leaf_id"] = leaf_id