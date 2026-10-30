"""REST endpoints: /api/conversations"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import database
from app.database import get_db
from app.models import Role
from app.rate_limit import chat_rate_limit, daily_token_budget
from app.schemas import (
    ChatReply,
    ConversationDetail,
    ConversationOut,
    ConversationUpdate,
    MessageIn,
    MessageOut,
    PinnedOrder,
)
from app.services import conversation_service as svc
from app.prompts import TITLE_PROMPT
from app.services.openai_service import AIServiceError, OpenAIService, get_ai_service

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED, summary="Start a new conversation")
def create_conversation(db: Session = Depends(get_db)):
    return svc.create_conversation(db)


@router.get("", response_model=list[ConversationOut], summary="List conversations (most recent first)")
def list_conversations(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return svc.list_conversations(db, limit)


@router.put(
    "/pinned-order",
    response_model=list[ConversationOut],
    summary="Reorder the pinned conversations (sidebar drag and drop)",
)
def reorder_pinned(body: PinnedOrder, db: Session = Depends(get_db)):
    return svc.reorder_pinned(db, body.ids)


@router.get("/{conversation_id}", response_model=ConversationDetail, summary="Get a conversation with all its messages")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    return svc.get_conversation(db, conversation_id)


@router.patch("/{conversation_id}", response_model=ConversationOut, summary="Rename and/or pin a conversation")
def update_conversation(conversation_id: str, body: ConversationUpdate, db: Session = Depends(get_db)):
    return svc.update_conversation(db, conversation_id, title=body.title, pinned=body.pinned)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a conversation")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    svc.delete_conversation(db, conversation_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _maybe_title(ai: OpenAIService, db: Session, conversation_id: str, user: str, assistant: str) -> str | None:
    """Generate a title after the first exchange only. Never fails the chat: errors are only logged."""
    try:
        conv = await run_in_threadpool(svc.get_conversation, db, conversation_id)
        if conv.title != svc.DEFAULT_TITLE:
            return None
        title = await ai.make_title(user, assistant) or svc.fallback_title(user)
        await run_in_threadpool(svc.log_usage, db, "title", svc.estimate_tokens(user[:1000], assistant[:1000], TITLE_PROMPT))
        await run_in_threadpool(svc.set_title, db, conversation_id, title)
        return title
    except Exception:
        log.exception("Title generation failed")
        return None


@router.post(
    "/{conversation_id}/messages",
    response_model=ChatReply,
    dependencies=[Depends(chat_rate_limit), Depends(daily_token_budget)],
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
    await run_in_threadpool(
        _safe_log, db, "answer", tokens or svc.estimate_tokens(text, *(m["content"] for m in history))
    )
    await _maybe_title(ai, db, conversation_id, body.content, text)
    conv = await run_in_threadpool(svc.get_conversation, db, conversation_id)
    return ChatReply(
        conversation_id=conversation_id,
        title=conv.title,
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
    )


def _safe_log(db: Session, kind: str, tokens: int) -> None:
    """Count tokens in the usage log; a failure here must never break the chat contract."""
    try:
        svc.log_usage(db, kind, tokens)
    except Exception:
        db.rollback()
        log.exception("Usage log failed")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _answer_stream(conversation_id: str, ai: OpenAIService, content: str | None) -> StreamingResponse:
    """SSE answer for a new user message (content) or a regeneration (content=None).

    Contract: the stream ends with exactly one `done` or one `error`, and the
    database always matches what the user saw:
    - stopped before the first word -> the user message is removed (nothing unanswered);
    - stopped mid-answer -> the partial answer is kept (exact context for the next turn);
    - regenerate -> the old answer is replaced only once a new one exists.
    """

    async def events():
        # The generator outlives the request dependencies, so it owns its own session.
        session = database.SessionLocal()
        parts: list[str] = []
        tokens: int | None = None
        saved = False
        inserting = False
        user_msg = None
        replaced_id: int | None = None
        user_text = content or ""
        history: list[dict[str, str]] = []
        try:
            if content is not None:
                user_msg = await run_in_threadpool(svc.add_message, session, conversation_id, Role.user, content)
                yield _sse("user_message", MessageOut.model_validate(user_msg).model_dump(mode="json"))
                history = await run_in_threadpool(svc.history_for_model, session, conversation_id)
            else:
                user_text, replaced_id, history = await run_in_threadpool(
                    svc.prepare_regenerate, session, conversation_id
                )
            try:
                async for chunk in ai.stream_reply(history):
                    if chunk.delta:
                        parts.append(chunk.delta)
                        yield _sse("delta", {"text": chunk.delta})
                    if chunk.total_tokens:
                        tokens = chunk.total_tokens
            except AIServiceError as exc:
                if parts:
                    # OpenAI failed mid-answer: the words already generated were billed
                    await run_in_threadpool(
                        _safe_log, session, "error", svc.estimate_tokens("".join(parts), *(m["content"] for m in history))
                    )
                if user_msg is not None:
                    await run_in_threadpool(svc.delete_message, session, user_msg.id)
                yield _sse("error", {"detail": exc.message, "status": exc.status_code})
                return

            inserting = True  # from here a cancellation must not save the answer a second time
            try:
                assistant_msg = await run_in_threadpool(
                    svc.save_answer, session, conversation_id, "".join(parts), tokens, replaced_id
                )
            except Exception:
                inserting = False
                session.rollback()
                raise
            saved = True
            await run_in_threadpool(
                _safe_log,
                session,
                "answer" if content is not None else "regenerate",
                tokens or svc.estimate_tokens("".join(parts), *(m["content"] for m in history)),
            )
            yield _sse("done", MessageOut.model_validate(assistant_msg).model_dump(mode="json"))
            title = await _maybe_title(ai, session, conversation_id, user_text, "".join(parts))
            if title:
                yield _sse("title", {"title": title})
        except asyncio.CancelledError:
            # "Stop" pressed or page closed (client disconnected).
            # Nothing to do while the answer is being inserted by another thread (the
            # session is not shared between threads); otherwise save first, count after.
            if not saved and not inserting:
                if parts:
                    svc.save_answer(session, conversation_id, "".join(parts), tokens, replaced_id, interrupted=True)
                    svc.set_title_if_default(session, conversation_id, svc.fallback_title(user_text))
                elif user_msg is not None:
                    svc.delete_message(session, user_msg.id)
                    # a new conversation left before any answer must not stay empty in the list
                    svc.delete_if_empty(session, conversation_id)
                if history:
                    # the prompt was sent (and maybe some words generated): count it in the budget
                    _safe_log(session, "interrupted", svc.estimate_tokens("".join(parts), *(m["content"] for m in history)))
            raise
        except Exception:
            log.exception("Streaming failed")
            if not saved:
                if user_msg is not None:
                    svc.delete_message(session, user_msg.id)
                yield _sse("error", {"detail": "Internal server error", "status": 500})
        finally:
            session.close()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post(
    "/{conversation_id}/messages/stream",
    dependencies=[Depends(chat_rate_limit), Depends(daily_token_budget)],
    summary="Send a message and stream the answer word by word (Server-Sent Events)",
    response_description="text/event-stream with events: user_message, delta, done, title, error",
)
async def stream_message(conversation_id: str, body: MessageIn, db: Session = Depends(get_db),
                         ai: OpenAIService = Depends(get_ai_service)):
    # Validate before opening the stream so a bad id is a normal 404.
    await run_in_threadpool(svc.get_conversation, db, conversation_id)
    return _answer_stream(conversation_id, ai, body.content)


@router.post(
    "/{conversation_id}/regenerate",
    dependencies=[Depends(chat_rate_limit), Depends(daily_token_budget)],
    summary="Regenerate the last answer (Server-Sent Events)",
    response_description="text/event-stream with events: delta, done, title, error",
)
async def regenerate(conversation_id: str, db: Session = Depends(get_db), ai: OpenAIService = Depends(get_ai_service)):
    # 404 / 409 before opening the stream
    await run_in_threadpool(svc.prepare_regenerate, db, conversation_id)
    return _answer_stream(conversation_id, ai, None)
