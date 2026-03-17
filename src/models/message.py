"""Message model for chat conversations."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class MessageNode(BaseModel):
    """A single message in a conversation tree."""
    
    id: str = Field(default_factory=lambda: str(uuid4()))
    role: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    parent_id: Optional[str] = None
    children_ids: list[str] = Field(default_factory=list)
    
    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate that role is one of the allowed values."""
        allowed_roles = {"system", "user", "assistant"}
        if v not in allowed_roles:
            raise ValueError(f"Role must be one of {allowed_roles}, got '{v}'")
        return v
    
    def to_api_dict(self) -> dict[str, str]:
        """Convert to the format expected by the OpenRouter API."""
        return {
            "role": self.role,
            "content": self.content
        }