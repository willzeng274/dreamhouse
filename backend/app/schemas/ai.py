from pydantic import BaseModel
from typing import Optional


class ChatMessage(BaseModel):
    role: str
    content: str


class LLMRequest(BaseModel):
    prompt: Optional[str] = None
    messages: Optional[list[ChatMessage]] = None
    image_url: Optional[str] = None
