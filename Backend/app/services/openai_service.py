"""Thin wrapper around the OpenAI API. Only this module talks to OpenAI."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import lru_cache

import openai
from openai import AsyncOpenAI

from app.config import get_settings
from app.prompts import SYSTEM_PROMPT, TITLE_PROMPT


class AIServiceError(Exception):
    """Error from OpenAI, translated into a message and HTTP status the client can show."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class StreamChunk:
    delta: str = ""
    total_tokens: int | None = None


def translate_error(exc: Exception) -> AIServiceError:
    if isinstance(exc, openai.AuthenticationError):
        return AIServiceError("The OpenAI API key on the server is invalid.", 502)
    if isinstance(exc, openai.RateLimitError):
        return AIServiceError("OpenAI rate limit or quota reached. Please try again in a moment.", 429)
    if isinstance(exc, (openai.APIConnectionError, openai.APITimeoutError)):
        return AIServiceError("Cannot reach OpenAI right now. Check the connection and retry.", 503)
    if isinstance(exc, openai.BadRequestError):
        return AIServiceError("OpenAI rejected the request (the conversation may be too long).", 400)
    return AIServiceError("Unexpected error from the AI service.", 502)


class OpenAIService:
    def __init__(self, client: AsyncOpenAI | None = None):
        settings = get_settings()
        self.settings = settings
        self.client = client or AsyncOpenAI(api_key=settings.openai_api_key or "missing", timeout=60)

    def build_messages(self, history: list[dict[str, str]]) -> list[dict[str, str]]:
        """System prompt + the last N messages of the conversation (sliding window)."""
        window = history[-self.settings.context_max_messages :]
        return [{"role": "system", "content": SYSTEM_PROMPT}, *window]

    async def stream_reply(self, history: list[dict[str, str]]) -> AsyncIterator[StreamChunk]:
        if not self.settings.openai_api_key:
            # 503: a configuration problem, not a bug; the detail stays readable for the developer
            raise AIServiceError("The assistant is not configured: the server has no OpenAI API key (Backend/.env).", 503)
        try:
            stream = await self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=self.build_messages(history),
                temperature=self.settings.openai_temperature,
                max_completion_tokens=self.settings.openai_max_output_tokens,
                stream=True,
                stream_options={"include_usage": True},
            )
            async for event in stream:
                if event.choices and event.choices[0].delta.content:
                    yield StreamChunk(delta=event.choices[0].delta.content)
                if event.usage:
                    yield StreamChunk(total_tokens=event.usage.total_tokens)
        except AIServiceError:
            raise
        except Exception as exc:  # noqa: BLE001 - every SDK error is translated
            raise translate_error(exc) from exc

    async def reply(self, history: list[dict[str, str]]) -> tuple[str, int | None]:
        """Non-streaming answer: collects the stream."""
        parts: list[str] = []
        tokens = None
        async for chunk in self.stream_reply(history):
            parts.append(chunk.delta)
            tokens = chunk.total_tokens or tokens
        return "".join(parts), tokens

    async def make_title(self, user: str, assistant: str) -> str | None:
        """Short title for the sidebar. Failure here must never break the chat."""
        try:
            res = await self.client.chat.completions.create(
                model=self.settings.openai_model,
                messages=[{"role": "user", "content": TITLE_PROMPT.format(user=user[:1000], assistant=assistant[:1000])}],
                temperature=0.3,
                max_completion_tokens=20,
            )
            title = (res.choices[0].message.content or "").strip().strip('"\'«»').rstrip(".")
            return title[:120] or None
        except Exception:  # noqa: BLE001
            return None


@lru_cache
def get_ai_service() -> OpenAIService:
    """FastAPI dependency: one shared client (connection reuse). Overridden with a fake in tests."""
    return OpenAIService()
