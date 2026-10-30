"""Database operations on conversations and messages."""

from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Conversation, Message, Role, UsageLog

DEFAULT_TITLE = "New conversation"


def create_conversation(db: Session) -> Conversation:
    now = datetime.now()  # same clock as updated_at and the age checks, whatever the database
    conv = Conversation(model=get_settings().openai_model, title=DEFAULT_TITLE, created_at=now, updated_at=now)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def list_conversations(db: Session, limit: int = 100) -> list[Conversation]:
    stmt = (
        select(Conversation)
        .order_by(
            Conversation.pinned.desc(),
            Conversation.pin_order.asc(),  # pinned: the order chosen by drag and drop
            Conversation.updated_at.desc(),  # recents: latest activity first
            Conversation.created_at.desc(),
        )
        .limit(limit)
    )
    return list(db.scalars(stmt))


def get_conversation(db: Session, conversation_id: str) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conv


def update_conversation(
    db: Session, conversation_id: str, title: str | None = None, pinned: bool | None = None
) -> Conversation:
    conv = get_conversation(db, conversation_id)
    if title is not None:
        conv.title = title
    if pinned is not None and pinned != conv.pinned:
        conv.pinned = pinned
        # a newly pinned conversation goes to the end of the pinned list
        conv.pin_order = (db.scalar(select(func.max(Conversation.pin_order))) or 0) + 1 if pinned else None
    db.commit()
    db.refresh(conv)
    return conv


def reorder_pinned(db: Session, ids: list[str]) -> list[Conversation]:
    """Give the pinned conversations the order of `ids` (pinned ones not listed keep their place after)."""
    convs = {c.id: c for c in db.scalars(select(Conversation).where(Conversation.id.in_(ids)))}
    missing = [i for i in ids if i not in convs]
    if missing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    if any(not convs[i].pinned for i in ids):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only pinned conversations can be reordered")
    for position, conversation_id in enumerate(ids):
        convs[conversation_id].pin_order = position
    others = db.scalars(
        select(Conversation)
        .where(Conversation.pinned.is_(True), Conversation.id.not_in(ids))
        .order_by(Conversation.pin_order.asc())
    )
    for offset, conv in enumerate(others, start=len(ids)):
        conv.pin_order = offset
    db.commit()
    return list_conversations(db)


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
        # millisecond precision (NOW() is per second) so the latest chat is always first
        conv.updated_at = datetime.now()
    db.commit()
    db.refresh(msg)
    return msg


def delete_message(db: Session, message_id: int) -> None:
    """Remove a message (e.g. a user message that got no answer) and restore the activity date."""
    msg = db.get(Message, message_id)
    if msg is None:
        return
    conv = db.get(Conversation, msg.conversation_id)
    db.delete(msg)
    db.flush()
    if conv is not None:
        last = db.scalar(select(func.max(Message.created_at)).where(Message.conversation_id == conv.id))
        conv.updated_at = last or conv.created_at
    db.commit()


def history_for_model(db: Session, conversation_id: str, before_id: int | None = None) -> list[dict[str, str]]:
    """The last N messages (sliding window), oldest first, in the format the OpenAI API expects."""
    stmt = select(Message).where(Message.conversation_id == conversation_id)
    if before_id is not None:
        stmt = stmt.where(Message.id < before_id)
    settings = get_settings()
    stmt = stmt.order_by(Message.id.desc()).limit(settings.context_max_messages)
    window: list[Message] = []
    total = 0
    for m in db.scalars(stmt):  # newest first: keep the most recent messages that fit
        total += len(m.content)
        if window and total > settings.context_max_chars:
            break
        window.append(m)
    return [{"role": m.role.value, "content": m.content} for m in reversed(window)]


def prepare_regenerate(db: Session, conversation_id: str) -> tuple[str, int | None, list[dict[str, str]]]:
    """For "Regenerate": the last user message, the answer to replace (if any) and the history to send.

    Raises 404 for an unknown conversation and 409 when there is nothing to regenerate.
    """
    get_conversation(db, conversation_id)
    last_two = list(
        db.scalars(select(Message).where(Message.conversation_id == conversation_id).order_by(Message.id.desc()).limit(2))
    )
    replaced: Message | None = None
    if last_two and last_two[0].role == Role.assistant:
        replaced = last_two[0]
        last_two = last_two[1:]
    if not last_two or last_two[0].role != Role.user:
        raise HTTPException(status.HTTP_409_CONFLICT, "Nothing to regenerate in this conversation")
    history = history_for_model(db, conversation_id, before_id=replaced.id if replaced else None)
    return last_two[0].content, (replaced.id if replaced else None), history


def save_answer(
    db: Session,
    conversation_id: str,
    text: str,
    tokens: int | None,
    replaced_id: int | None = None,
    interrupted: bool = False,
) -> Message:
    """Store an assistant answer; for a regeneration the previous answer is removed first."""
    if replaced_id is not None:
        old = db.get(Message, replaced_id)
        if old is not None:
            db.delete(old)
            db.flush()
    msg = add_message(db, conversation_id, Role.assistant, text, tokens)
    if interrupted:
        msg.interrupted = True
        db.commit()
    return msg


def set_title(db: Session, conversation_id: str, title: str) -> None:
    conv = db.get(Conversation, conversation_id)
    if conv is not None:
        conv.title = title
        db.commit()


def delete_if_empty(db: Session, conversation_id: str) -> None:
    """Remove a conversation created for a message that got no answer (e.g. tab closed before
    the first word). An empty conversation created earlier on purpose (API, Postman) is kept."""
    conv = db.get(Conversation, conversation_id)
    has_message = db.scalar(select(Message.id).where(Message.conversation_id == conversation_id).limit(1))
    just_created = conv is not None and conv.created_at >= datetime.now() - timedelta(seconds=30)
    if conv is not None and has_message is None and conv.title == DEFAULT_TITLE and just_created:
        db.delete(conv)
        db.commit()


def set_title_if_default(db: Session, conversation_id: str, title: str) -> None:
    conv = db.get(Conversation, conversation_id)
    if conv is not None and conv.title == DEFAULT_TITLE and title:
        conv.title = title
        db.commit()


def fallback_title(user_text: str) -> str:
    """Title used when the AI title is unavailable (stopped answer, title error): the first words."""
    words = " ".join(user_text.split())
    return (words[:57].rsplit(" ", 1)[0] + "…") if len(words) > 60 else (words or DEFAULT_TITLE)


def estimate_tokens(*texts: str) -> int:
    """About 4 characters per token: used when OpenAI did not report usage (stopped answer, title)."""
    return max(1, sum(len(t) for t in texts) // 4)


def log_usage(db: Session, kind: str, tokens: int) -> None:
    db.add(UsageLog(kind=kind, tokens=tokens))
    db.commit()


def tokens_last_24h(db: Session) -> int:
    """Tokens spent in the last 24 hours, from the usage log (not from messages, which can be deleted)."""
    since = datetime.now() - timedelta(hours=24)
    return int(db.scalar(select(func.coalesce(func.sum(UsageLog.tokens), 0)).where(UsageLog.created_at >= since)) or 0)
