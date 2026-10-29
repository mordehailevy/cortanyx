"""Test fixtures: in-memory SQLite database and a fake OpenAI service (no network, no cost)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import database, rate_limit
from app.main import app
from app.services.openai_service import AIServiceError, StreamChunk, get_ai_service


class FakeAI:
    """Echoes the conversation so tests can check the context really is sent."""

    def __init__(self):
        self.calls: list[list[dict]] = []
        self.fail: AIServiceError | None = None

    async def stream_reply(self, history):
        self.calls.append(history)
        if self.fail:
            raise self.fail
        answer = f"Answer #{len([m for m in history if m['role'] == 'user'])}"
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
        return "Test title"


@pytest.fixture
def fake_ai():
    return FakeAI()


@pytest.fixture
def client(fake_ai, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
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
