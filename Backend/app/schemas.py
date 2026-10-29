"""Pydantic request / response models (the public API contract)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import get_settings
from app.models import Role


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Role
    content: str
    created_at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    model: str
    created_at: datetime
    updated_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=120)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v


class MessageIn(BaseModel):
    content: str = Field(min_length=1, examples=["Explain recursion with a simple example"])

    @field_validator("content")
    @classmethod
    def check_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        limit = get_settings().max_message_chars
        if len(v) > limit:
            raise ValueError(f"Message is too long (max {limit} characters)")
        return v


class ChatReply(BaseModel):
    """Answer of the non-streaming endpoint."""

    conversation_id: str
    title: str
    user_message: MessageOut
    assistant_message: MessageOut


class Health(BaseModel):
    status: str
    database: str
    model: str
    openai_key_configured: bool
