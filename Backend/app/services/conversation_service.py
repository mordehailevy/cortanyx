"""Database operations on conversations and messages."""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Conversation, Message, Role

DEFAULT_TITLE = "New conversation"


def create_conversation(db: Session) -> Conversation:
    conv = Conversation(model=get_settings().openai_model, title=DEFAULT_TITLE)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def list_conversations(db: Session, limit: int = 50) -> list[Conversation]:
    stmt = select(Conversation).order_by(Conversation.updated_at.desc()).limit(limit)
    return list(db.scalars(stmt))


def get_conversation(db: Session, conversation_id: str) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conv


def rename_conversation(db: Session, conversation_id: str, title: str) -> Conversation:
    conv = get_conversation(db, conversation_id)
    conv.title = title
    db.commit()
    db.refresh(conv)
    return conv


def delete_conversation(db: Session, conversation_id: str) -> None:
    conv = get_conversation(db, conversation_id)
    db.delete(conv)
    db.commit()


def add_message(db: Session, conversation_id: str, role: Role, content: str, tokens: int | None = None) -> Message:
    msg = Message(conversation_id=conversation_id, role=role, content=content, tokens=tokens)
    db.add(msg)
    # touch the conversation so it moves to the top of the history
    conv = db.get(Conversation, conversation_id)
    if conv is not None:
        conv.updated_at = func.now()
    db.commit()
    db.refresh(msg)
    return msg


def delete_message(db: Session, message_id: int) -> None:
    msg = db.get(Message, message_id)
    if msg is not None:
        db.delete(msg)
        db.commit()


def history_for_model(db: Session, conversation_id: str) -> list[dict[str, str]]:
    """The whole conversation, oldest first, in the format the OpenAI API expects."""
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.id)
    return [{"role": m.role.value, "content": m.content} for m in db.scalars(stmt)]


def set_title(db: Session, conversation_id: str, title: str) -> None:
    conv = db.get(Conversation, conversation_id)
    if conv is not None:
        conv.title = title
        db.commit()
