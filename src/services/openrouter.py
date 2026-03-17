"""OpenRouter service for chat completions."""

import os
from typing import List, Dict, Generator, Optional
from httpx import Client, Response

from openai import OpenAI
from openai.types.chat import ChatCompletionMessageParam


class OpenRouterService:
    """Service for interacting with OpenRouter API."""
    
    BASE_URL = "https://openrouter.ai/api/v1"
    
    def __init__(self, api_key: str):
        """Initialize with API key."""
        self.api_key = api_key
        self.client = OpenAI(
            base_url=f"{self.BASE_URL}/chat/completions",
            api_key=api_key,
            default_headers={
                "HTTP-Referer": "https://github.com/299-Labs/Offshoot",
                "X-Title": "Offshoot Chat"
            }
        )
    
    def fetch_models(self) -> List[Dict[str, str]]:
        """Fetch available models from OpenRouter API."""
        import httpx
        try:
            # Using httpx.get directly is easier to mock than Client() context
            response = httpx.get(
                f"{self.BASE_URL}/models",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "HTTP-Referer": "https://github.com/299-Labs/Offshoot",
                    "X-Title": "Offshoot Chat"
                },
                timeout=10.0
            )
            response.raise_for_status()
            
            data = response.json()
            models = data.get("data", [])
            
            # Extract id and name, sort by name
            model_list = [
                {"id": model["id"], "name": model.get("name", model["id"])}
                for model in models
            ]
            
            # Sort by name, but handle missing names by using id as fallback
            return sorted(model_list, key=lambda x: (x["name"].lower(), x["id"].lower()))
        
        except Exception as e:
            raise OpenRouterError(f"Failed to fetch models: {str(e)}") from e
    
    def stream_chat_completion(
        self, 
        model: str, 
        messages: List[ChatCompletionMessageParam]
    ) -> Generator[str, None, None]:
        """Stream chat completion from OpenRouter."""
        try:
            stream = self.client.chat.completions.create(
                model=model,
                messages=messages,
                stream=True
            )
            
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            raise OpenRouterError(f"Failed to stream chat completion: {str(e)}") from e
    
    def validate_api_key(self) -> bool:
        """Validate API key by attempting to fetch models."""
        try:
            self.fetch_models()
            return True
        except OpenRouterError:
            return False


class OpenRouterError(Exception):
    """Custom exception for OpenRouter service errors."""
    pass