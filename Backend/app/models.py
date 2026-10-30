"""ORM models - mirror Database/schema.sql."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Same column types as Database/schema.sql on MySQL, portable types elsewhere (tests use SQLite)
Timestamp = DateTime().with_variant(mysql.DATETIME(fsp=3), "mysql")
MessageId = BigInteger().with_variant(mysql.BIGINT(unsigned=True), "mysql").with_variant(Integer(), "sqlite")


class Role(str, enum.Enum):
    user = "user"            # written by the human
    assistant = "assistant"  # written by the chat


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(120), default="New conversation", server_default="New conversation")
    model: Mapped[str] = mapped_column(String(64))
    pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("0"))
    # position among pinned conversations (drag and drop in the sidebar); NULL when not pinned
    pin_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now())
    # last activity: only moved forward when a message is added (not on rename / pin)
    updated_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now())

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        order_by="Message.id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(MessageId, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[Role] = mapped_column(Enum(Role, name="role", native_enum=True))
    content: Mapped[str] = mapped_column(Text().with_variant(Text(length=16_777_215), "mysql"))
    tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # True for an answer stopped before its end (Stop button, page closed)
    interrupted: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now(), index=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class UsageLog(Base):
    """One row per OpenAI call (answer, regeneration, title, stopped answer).

    Never deleted with conversations: the daily token budget is computed from it,
    so deleting or regenerating cannot reset the spending counter.
    """

    __tablename__ = "usage_log"

    id: Mapped[int] = mapped_column(MessageId, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(16))
    tokens: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(Timestamp, server_default=func.now(), index=True)
