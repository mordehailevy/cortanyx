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
