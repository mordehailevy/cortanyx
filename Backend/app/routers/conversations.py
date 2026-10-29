"""REST endpoints: /api/conversations"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import database
from app.database import get_db
from app.models import Role
from app.rate_limit import chat_rate_limit
from app.schemas import ChatReply, ConversationDetail, ConversationOut, ConversationRename, MessageIn, MessageOut
from app.services import conversation_service as svc
from app.services.openai_service import AIServiceError, OpenAIService, get_ai_service

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED, summary="Start a new conversation")
def create_conversation(db: Session = Depends(get_db)):
    return svc.create_conversation(db)


@router.get("", response_model=list[ConversationOut], summary="List conversations (most recent first)")
def list_conversations(db: Session = Depends(get_db)):
    return svc.list_conversations(db)


@router.get("/{conversation_id}", response_model=ConversationDetail, summary="Get a conversation with all its messages")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    return svc.get_conversation(db, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationOut, summary="Rename a conversation")
def rename_conversation(conversation_id: str, body: ConversationRename, db: Session = Depends(get_db)):
    return svc.rename_conversation(db, conversation_id, body.title)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a conversation")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    svc.delete_conversation(db, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _maybe_title(ai: OpenAIService, db: Session, conversation_id: str, user: str, assistant: str) -> str | None:
    """Generate a title after the first exchange only."""
    conv = await run_in_threadpool(svc.get_conversation, db, conversation_id)
    if conv.title != svc.DEFAULT_TITLE:
        return None
    title = await ai.make_title(user, assistant)
    if title:
        await run_in_threadpool(svc.set_title, db, conversation_id, title)
    return title


@router.post(
    "/{conversation_id}/messages",
    response_model=ChatReply,
    dependencies=[Depends(chat_rate_limit)],
    summary="Send a message and get the full answer (JSON)",
)
async def send_message(
    conversation_id: str,
    body: MessageIn,
    db: Session = Depends(get_db),
    ai: OpenAIService = Depends(get_ai_service),
):
    await run_in_threadpool(svc.get_conversation, db, conversation_id)
    user_msg = await run_in_threadpool(svc.add_message, db, conversation_id, Role.user, body.content)
    history = await run_in_threadpool(svc.history_for_model, db, conversation_id)
    try:
        text, tokens = await ai.reply(history)
    except AIServiceError:
        # keep the DB consistent: no unanswered message, the client can simply retry
        await run_in_threadpool(svc.delete_message, db, user_msg.id)
        raise
    assistant_msg = await run_in_threadpool(svc.add_message, db, conversation_id, Role.assistant, text, tokens)
    await _maybe_title(ai, db, conversation_id, body.content, text)
    conv = await run_in_threadpool(svc.get_conversation, db, conversation_id)
    return ChatReply(
        conversation_id=conversation_id,
        title=conv.title,
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@router.post(
    "/{conversation_id}/messages/stream",
    dependencies=[Depends(chat_rate_limit)],
    summary="Send a message and stream the answer word by word (Server-Sent Events)",
    response_description="text/event-stream with events: user_message, delta, done, title, error",
)
async def stream_message(
    conversation_id: str,
    body: MessageIn,
    db: Session = Depends(get_db),
    ai: OpenAIService = Depends(get_ai_service),
):
    # Validate before opening the stream so a bad id is a normal 404.
    await run_in_threadpool(svc.get_conversation, db, conversation_id)

    async def events():
        # The generator outlives the request dependencies, so it owns its own session.
        session = database.SessionLocal()
        parts: list[str] = []
        tokens: int | None = None
        saved = False
        try:
            user_msg = await run_in_threadpool(svc.add_message, session, conversation_id, Role.user, body.content)
            yield _sse("user_message", MessageOut.model_validate(user_msg).model_dump(mode="json"))
            history = await run_in_threadpool(svc.history_for_model, session, conversation_id)
            try:
                async for chunk in ai.stream_reply(history):
                    if chunk.delta:
                        parts.append(chunk.delta)
                        yield _sse("delta", {"text": chunk.delta})
                    if chunk.total_tokens:
                        tokens = chunk.total_tokens
            except AIServiceError as exc:
                await run_in_threadpool(svc.delete_message, session, user_msg.id)
                yield _sse("error", {"detail": exc.message, "status": exc.status_code})
                return

            text = "".join(parts)
            assistant_msg = await run_in_threadpool(
                svc.add_message, session, conversation_id, Role.assistant, text, tokens
            )
            saved = True
            yield _sse("done", MessageOut.model_validate(assistant_msg).model_dump(mode="json"))
            title = await _maybe_title(ai, session, conversation_id, body.content, text)
            if title:
                yield _sse("title", {"title": title})
        except asyncio.CancelledError:
            # The user pressed "Stop" (client disconnected): keep what was generated
            # so the next turn still has the exact context the user saw.
            if parts and not saved:
                svc.add_message(session, conversation_id, Role.assistant, "".join(parts), tokens)
            raise
        except Exception:
            log.exception("Streaming failed")
            yield _sse("error", {"detail": "Internal server error", "status": 500})
        finally:
            session.close()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
