"""Test fixtures: in-memory SQLite database and a fake OpenAI service (no network, no cost)."""

import os

# The tests use their own configuration, whatever the developer's Backend/.env contains
# (environment variables take priority over the .env file). Set before importing the app.
os.environ.update(
    {
        "OPENAI_API_KEY": "test-key-not-used",
        "DATABASE_URL": "sqlite://",
        "ALLOWED_HOSTS": "testserver,localhost",
        "CORS_ORIGINS": "http://localhost:5173",
        "CONTEXT_MAX_MESSAGES": "40",
        "CONTEXT_MAX_CHARS": "48000",
        "RATE_LIMIT_PER_MINUTE": "20",
        "MAX_MESSAGE_CHARS": "8000",
        "DAILY_TOKEN_BUDGET": "500000",
        "ENABLE_DOCS": "true",
    }
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import database, rate_limit  # noqa: E402
from app.main import app  # noqa: E402
from app.services.openai_service import AIServiceError, StreamChunk, get_ai_service  # noqa: E402


class FakeAI:
    """Echoes the conversation so tests can check the context really is sent."""

    def __init__(self):
        self.calls: list[list[dict]] = []
        self.fail: AIServiceError | None = None
        self.title_calls = 0
        self.title_error: Exception | None = None

    async def stream_reply(self, history):
        self.calls.append(history)
        if self.fail:
            raise self.fail
        answer = f"Answer #{len([m for m in history if m['role'] == 'user'])} call {len(self.calls)}"
        for word in answer.split(" "):
            yield StreamChunk(delta=word + " ")
        yield StreamChunk(total_tokens=42)

    async def reply(self, history):
        parts, tokens = [], None
        async for c in self.stream_reply(history):
            parts.append(c.delta)
            tokens = c.total_tokens or tokens
        return "".join(parts), tokens

    async def make_title(self, user, assistant):
        self.title_calls += 1
        if self.title_error:
            raise self.title_error
        return "Test title"


@pytest.fixture
def fake_ai():
    return FakeAI()


@pytest.fixture
def client(fake_ai, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    # SQLite ignores foreign keys unless asked: enable them so ON DELETE CASCADE is tested
    event.listen(engine, "connect", lambda conn, _: conn.execute("PRAGMA foreign_keys=ON"))
    database.Base.metadata.create_all(engine)
    TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    monkeypatch.setattr(database, "SessionLocal", TestSession)

    def override_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_db
    app.dependency_overrides[get_ai_service] = lambda: fake_ai
    rate_limit.reset()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def session_factory(client):
    """The test session factory (same in-memory database as the client)."""
    return database.SessionLocal
