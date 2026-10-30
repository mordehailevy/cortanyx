"""Tiny in-memory sliding-window rate limiter (per client IP).

Protects the OpenAI budget from loops or abuse. In-memory is enough for a
single server process; several workers would need Redis.
"""

import time
from collections import defaultdict, deque

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.services.conversation_service import tokens_last_24h

_hits: dict[str, deque[float]] = defaultdict(deque)
WINDOW_SECONDS = 60
MAX_TRACKED_CLIENTS = 10_000


def chat_rate_limit(request: Request) -> None:
    limit = get_settings().rate_limit_per_minute
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    if len(_hits) > MAX_TRACKED_CLIENTS:
        # forget clients idle for a full window so memory cannot grow without limit
        for k in [k for k, v in _hits.items() if not v or now - v[-1] > WINDOW_SECONDS]:
            del _hits[k]
    hits = _hits[key]
    while hits and now - hits[0] > WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= limit:
        retry = int(WINDOW_SECONDS - (now - hits[0])) + 1
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many messages. Please wait {retry} seconds.",
            headers={"Retry-After": str(retry)},
        )
    hits.append(now)


def daily_token_budget(db: Session = Depends(get_db)) -> None:
    """Refuse new answers when the last 24 hours already used the daily token budget."""
    budget = get_settings().daily_token_budget
    if budget and tokens_last_24h(db) >= budget:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Daily usage limit reached. Please try again tomorrow.",
        )


def reset() -> None:
    _hits.clear()
