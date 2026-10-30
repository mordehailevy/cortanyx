import json

from app.config import get_settings
from app.services.openai_service import AIServiceError


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        events.append((lines["event"], json.loads(lines["data"])))
    return events


def new_conversation(client) -> str:
    res = client.post("/api/conversations")
    assert res.status_code == 201
    return res.json()["id"]


def test_health(client):
    body = client.get("/api/health").json()
    assert body["database"] == "ok"


def test_create_and_list(client):
    cid = new_conversation(client)
    assert len(cid) == 36
    items = client.get("/api/conversations").json()
    assert [c["id"] for c in items] == [cid]
    assert items[0]["title"] == "New conversation"


def test_conversation_keeps_context(client, fake_ai):
    cid = new_conversation(client)
    r1 = client.post(f"/api/conversations/{cid}/messages", json={"content": "My name is Dana"})
    assert r1.status_code == 200
    assert r1.json()["title"] == "Test title"
    client.post(f"/api/conversations/{cid}/messages", json={"content": "What is my name?"})

    # second call to the model received the whole conversation, in order
    sent = fake_ai.calls[-1]
    assert [m["role"] for m in sent] == ["user", "assistant", "user"]
    assert sent[0]["content"] == "My name is Dana"

    detail = client.get(f"/api/conversations/{cid}").json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]


def test_conversations_are_isolated(client, fake_ai):
    a, b = new_conversation(client), new_conversation(client)
    client.post(f"/api/conversations/{a}/messages", json={"content": "secret A"})
    client.post(f"/api/conversations/{b}/messages", json={"content": "hello B"})
    assert all("secret A" not in m["content"] for m in fake_ai.calls[-1])


def test_stream(client):
    cid = new_conversation(client)
    res = client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "Hi"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    events = parse_sse(res.text)
    names = [e for e, _ in events]
    assert names[0] == "user_message"
    assert "delta" in names
    assert names[-2:] == ["done", "title"]
    text = "".join(d["text"] for e, d in events if e == "delta")
    assert dict(events)["done"]["content"] == text


def test_ai_error_rolls_back_user_message(client, fake_ai):
    cid = new_conversation(client)
    fake_ai.fail = AIServiceError("quota", 429)
    res = client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"})
    assert res.status_code == 429
    assert res.json()["detail"] == "quota"
    assert client.get(f"/api/conversations/{cid}").json()["messages"] == []

    events = parse_sse(client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "Hi"}).text)
    assert events[-1][0] == "error"
    assert client.get(f"/api/conversations/{cid}").json()["messages"] == []


def test_validation(client):
    cid = new_conversation(client)
    assert client.post(f"/api/conversations/{cid}/messages", json={"content": "   "}).status_code == 422
    too_long = "x" * (get_settings().max_message_chars + 1)
    assert client.post(f"/api/conversations/{cid}/messages", json={"content": too_long}).status_code == 422


def test_unknown_conversation(client):
    assert client.get("/api/conversations/nope").status_code == 404
    assert client.post("/api/conversations/nope/messages/stream", json={"content": "Hi"}).status_code == 404


def test_rename_and_delete(client):
    cid = new_conversation(client)
    assert client.patch(f"/api/conversations/{cid}", json={"title": "  Trip plan "}).json()["title"] == "Trip plan"
    assert client.delete(f"/api/conversations/{cid}").status_code == 204
    assert client.get(f"/api/conversations/{cid}").status_code == 404


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_per_minute", 2)
    cid = new_conversation(client)
    codes = [client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_pin_lists_first_and_keeps_activity_order(client):
    old = new_conversation(client)
    client.post(f"/api/conversations/{old}/messages", json={"content": "first"})
    recent = new_conversation(client)
    client.post(f"/api/conversations/{recent}/messages", json={"content": "second"})
    before = client.get(f"/api/conversations/{old}").json()["updated_at"]

    res = client.patch(f"/api/conversations/{old}", json={"pinned": True})
    assert res.status_code == 200 and res.json()["pinned"] is True
    assert [c["id"] for c in client.get("/api/conversations").json()][0] == old
    # pinning or renaming is not "activity": the timestamp does not move
    client.patch(f"/api/conversations/{old}", json={"title": "Renamed"})
    assert client.get(f"/api/conversations/{old}").json()["updated_at"] == before

    client.patch(f"/api/conversations/{old}", json={"pinned": False})
    assert [c["id"] for c in client.get("/api/conversations").json()] == [recent, old]


def test_update_needs_a_field(client):
    cid = new_conversation(client)
    assert client.patch(f"/api/conversations/{cid}", json={}).status_code == 422
    assert client.patch(f"/api/conversations/{cid}", json={"title": "   "}).status_code == 422


# ---------------------------------------------------------------- streaming contract
import asyncio

import pytest

from app.models import Message, Role
from app.routers import conversations as conv_router
from app.services import conversation_service as svc
from app.services.openai_service import StreamChunk, translate_error


class SlowAI:
    """Sends `words` then waits forever, so the test can "press Stop" at a precise moment."""

    def __init__(self, words):
        self.words = words

    async def stream_reply(self, history):
        for w in self.words:
            yield StreamChunk(delta=w)
        await asyncio.sleep(30)


def _cancel_after(cid, ai, events_before_cancel):
    async def run():
        gen = conv_router._answer_stream(cid, ai, "Tell me a long story").body_iterator
        for _ in range(events_before_cancel):
            await gen.__anext__()
        task = asyncio.ensure_future(gen.__anext__())
        await asyncio.sleep(0.05)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())


def _messages(session_factory, cid):
    with session_factory() as s:
        return [(m.role, m.content) for m in s.query(Message).filter_by(conversation_id=cid).order_by(Message.id)]


def test_stop_before_first_word_leaves_no_unanswered_message(client, session_factory):
    cid = new_conversation(client)
    _cancel_after(cid, SlowAI([]), events_before_cancel=1)  # only user_message was sent
    assert _messages(session_factory, cid) == []


def test_stop_mid_answer_keeps_partial_answer_and_titles_it(client, session_factory):
    cid = new_conversation(client)
    _cancel_after(cid, SlowAI(["Once ", "upon "]), events_before_cancel=3)  # user_message + 2 deltas
    assert _messages(session_factory, cid) == [(Role.user, "Tell me a long story"), (Role.assistant, "Once upon ")]
    assert client.get(f"/api/conversations/{cid}").json()["title"] == "Tell me a long story"


def test_title_error_after_done_is_not_sent_as_error(client, fake_ai):
    fake_ai.title_error = RuntimeError("db down")
    cid = new_conversation(client)
    names = [e for e, _ in parse_sse(client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "Hi"}).text)]
    assert names[-1] == "done" and "error" not in names
    assert len(client.get(f"/api/conversations/{cid}").json()["messages"]) == 2


def test_title_generated_only_once(client, fake_ai):
    cid = new_conversation(client)
    for text in ("one", "two"):
        client.post(f"/api/conversations/{cid}/messages/stream", json={"content": text})
    assert fake_ai.title_calls == 1


# ---------------------------------------------------------------- regenerate
def test_regenerate_replaces_last_answer(client):
    cid = new_conversation(client)
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"})
    old = client.get(f"/api/conversations/{cid}").json()["messages"][-1]
    events = parse_sse(client.post(f"/api/conversations/{cid}/regenerate").text)
    assert [e for e, _ in events][-1] == "done"
    msgs = client.get(f"/api/conversations/{cid}").json()["messages"]
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[-1]["content"] != old["content"]  # (SQLite may reuse the id; MySQL never does)


def test_regenerate_needs_a_user_message(client):
    cid = new_conversation(client)
    assert client.post(f"/api/conversations/{cid}/regenerate").status_code == 409
    assert client.post("/api/conversations/nope/regenerate").status_code == 404


def test_regenerate_failure_keeps_previous_answer(client, fake_ai):
    cid = new_conversation(client)
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"})
    fake_ai.fail = AIServiceError("quota", 429)
    events = parse_sse(client.post(f"/api/conversations/{cid}/regenerate").text)
    assert events[-1][0] == "error"
    assert len(client.get(f"/api/conversations/{cid}").json()["messages"]) == 2


# ---------------------------------------------------------------- data rules
def test_failed_send_does_not_move_conversation_up(client, fake_ai):
    cid = new_conversation(client)
    before = client.get(f"/api/conversations/{cid}").json()["updated_at"]
    fake_ai.fail = AIServiceError("quota", 429)
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"})
    assert client.get(f"/api/conversations/{cid}").json()["updated_at"] == before


def test_delete_cascades_messages(client, session_factory):
    cid = new_conversation(client)
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"})
    client.delete(f"/api/conversations/{cid}")
    assert _messages(session_factory, cid) == []


def test_context_window_is_capped(client, fake_ai, monkeypatch):
    monkeypatch.setattr(get_settings(), "context_max_messages", 4)
    cid = new_conversation(client)
    for i in range(4):
        client.post(f"/api/conversations/{cid}/messages", json={"content": f"m{i}"})
    sent = fake_ai.calls[-1]
    assert len(sent) == 4 and sent[-1]["content"] == "m3"


def test_title_control_characters_are_removed(client):
    cid = new_conversation(client)
    res = client.patch(f"/api/conversations/{cid}", json={"title": "a\u0000b‮c‏"})
    assert res.json()["title"] == "abc"


def test_fallback_title():
    assert svc.fallback_title("  Hello   world ") == "Hello world"
    assert len(svc.fallback_title("word " * 40)) <= 60


# ---------------------------------------------------------------- errors, limits, hardening
@pytest.mark.parametrize(
    "exc_name, status",
    [("AuthenticationError", 502), ("RateLimitError", 429), ("APIConnectionError", 503), ("BadRequestError", 400)],
)
def test_openai_errors_are_translated(exc_name, status):
    import httpx
    import openai

    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    cls = getattr(openai, exc_name)
    if exc_name == "APIConnectionError":
        exc = cls(request=request)
    else:
        exc = cls("boom", response=httpx.Response(status, request=request), body=None)
    assert translate_error(exc).status_code == status


def test_missing_key_is_a_clear_503(monkeypatch):
    from app.services.openai_service import OpenAIService

    monkeypatch.setattr(get_settings(), "openai_api_key", "")

    async def run():
        async for _ in OpenAIService(client=object()).stream_reply([]):
            pass

    with pytest.raises(AIServiceError) as err:
        asyncio.run(run())
    assert err.value.status_code == 503


def test_rate_limit_sends_retry_after(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "rate_limit_per_minute", 1)
    cid = new_conversation(client)
    client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"})
    res = client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"})
    assert res.status_code == 429 and res.headers["Retry-After"].isdigit()


def test_daily_token_budget(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "daily_token_budget", 40)  # one fake answer = 42 tokens
    cid = new_conversation(client)
    assert client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"}).status_code == 200
    assert client.post(f"/api/conversations/{cid}/messages", json={"content": "Hi"}).status_code == 429


def test_hardening(client):
    assert client.get("/api/health").headers["X-Content-Type-Options"] == "nosniff"
    assert client.get("/api/health", headers={"Host": "evil.example"}).status_code == 400
    big = client.post("/api/conversations/x/messages", content=b"x" * 70_000, headers={"Content-Type": "application/json"})
    assert big.status_code == 413
    cid = new_conversation(client)
    res = client.post(f"/api/conversations/{cid}/messages", json={"content": ""})
    assert res.status_code == 422 and "input" not in res.text


def test_chunked_body_is_limited_too(client):
    cid = new_conversation(client)
    chunks = iter([b'{"content": "' + b"x" * 40_000, b"x" * 40_000 + b'"}'])  # no Content-Length: chunked
    res = client.post(f"/api/conversations/{cid}/messages", content=chunks, headers={"Content-Type": "application/json"})
    assert res.status_code == 413


def test_answer_save_failure_sends_error_and_keeps_db_clean(client, session_factory, monkeypatch):
    cid = new_conversation(client)

    def broken_save(*args, **kwargs):
        raise RuntimeError("database down")

    monkeypatch.setattr(svc, "save_answer", broken_save)
    events = parse_sse(client.post(f"/api/conversations/{cid}/messages/stream", json={"content": "Hi"}).text)
    assert events[-1][0] == "error" and "done" not in [e for e, _ in events]
    assert _messages(session_factory, cid) == []


def test_dates_are_utc_iso(client):
    body = client.post("/api/conversations").json()
    assert body["created_at"].endswith("Z") and body["updated_at"].endswith("Z")


def test_stopped_answer_is_marked_interrupted(client):
    cid = new_conversation(client)
    _cancel_after(cid, SlowAI(["Once "]), events_before_cancel=2)
    last = client.get(f"/api/conversations/{cid}").json()["messages"][-1]
    assert last["role"] == "assistant" and last["interrupted"] is True
    client.post(f"/api/conversations/{cid}/regenerate")  # a complete new answer is not interrupted
    assert client.get(f"/api/conversations/{cid}").json()["messages"][-1]["interrupted"] is False


def test_context_is_capped_in_characters(client, fake_ai, monkeypatch):
    monkeypatch.setattr(get_settings(), "context_max_chars", 30)
    cid = new_conversation(client)
    client.post(f"/api/conversations/{cid}/messages", json={"content": "x" * 25})
    client.post(f"/api/conversations/{cid}/messages", json={"content": "last"})
    sent = fake_ai.calls[-1]
    assert sent[-1]["content"] == "last" and all(m["content"] != "x" * 25 for m in sent)
