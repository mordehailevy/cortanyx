"""Tiny in-memory sliding-window rate limiter (per client IP).

Protects the OpenAI budget from loops or abuse. In-memory is enough for a
single server process; several workers would need Redis.
"""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.config import get_settings

_hits: dict[str, deque[float]] = defaultdict(deque)
WINDOW_SECONDS = 60


def chat_rate_limit(request: Request) -> None:
    limit = get_settings().rate_limit_per_minute
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
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


def reset() -> None:
    _hits.clear()
