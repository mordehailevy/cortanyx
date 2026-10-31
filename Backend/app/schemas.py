"""Pydantic request / response models (the public API contract)."""

import unicodedata
from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, StrictBool, StringConstraints, field_validator, model_validator

from app.config import get_settings
from app.models import Role


def _to_utc(dt: datetime) -> str:
    """Dates are stored in the server's local time; the API always answers in UTC ("...Z")."""
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


UtcDatetime = Annotated[datetime, PlainSerializer(_to_utc, return_type=str)]


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Role
    content: str
    interrupted: bool = False
    created_at: UtcDatetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    model: str
    pinned: bool
    pin_order: int | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class ConversationUpdate(BaseModel):
    """Rename and/or pin a conversation. Send at least one field."""

    title: str | None = Field(default=None, min_length=1, max_length=120, examples=["Learning React"])
    pinned: StrictBool | None = Field(default=None, examples=[True])

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str | None) -> str | None:
        if v is None:
            return v
        # remove control / invisible formatting characters (NUL, bidi overrides...)
        v = "".join(ch for ch in v if unicodedata.category(ch) not in ("Cc", "Cf")).strip()
        if not v:
            raise ValueError("Title cannot be empty")
        return v

    @model_validator(mode="after")
    def at_least_one(self) -> "ConversationUpdate":
        if self.title is None and self.pinned is None:
            raise ValueError("Send a title and/or pinned")
        return self


class PinnedOrder(BaseModel):
    """New order of the pinned conversations, first to last."""

    ids: list[Annotated[str, StringConstraints(max_length=36)]] = Field(min_length=1, max_length=500)

    @field_validator("ids")
    @classmethod
    def unique(cls, v: list[str]) -> list[str]:
        if len(set(v)) != len(v):
            raise ValueError("Each conversation can appear only once")
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
