"""Chat memory: persistence across restarts, cross-chat context, /api/chats endpoints, user isolation."""
from app.services import agent, chat_store, llm

INHA = {"lat": 41.3378, "lng": 69.3338}
CHILANZAR = {"lat": 41.2738, "lng": 69.2052}


def chat(client, uid, sid, msg, **kw):
    body = {"session_id": sid, "message": msg, **kw}
    if uid is not None:
        body["user_id"] = uid
    r = client.post("/api/chat", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def analyse_inha(client, uid="u1", sid="c1"):
    chat(client, uid, sid, "Хочу кофейню с собой")
    return chat(client, uid, sid, "Вот точка", **INHA)


def restart():
    """Simulate a server restart: the in-memory cache and store singleton are gone, the DB file stays."""
    agent.reset_sessions()
    chat_store.reset_store()


def test_session_survives_restart(client):
    j = analyse_inha(client)
    assert j["analysis"]["score"] == 84
    restart()
    # slots are restored: no need to repeat category / format / point
    j = chat(client, "u1", "c1", "Показать альтернативы")
    assert "индекс" in j["reply"] and not j.get("need_location")
    s = agent.get_session("c1", "u1")
    assert s.category == "coffee" and s.format == "takeaway" and s.lat == INHA["lat"]
    assert s.last_analysis["score"] == 84 and s.last_key == ("coffee", "takeaway", 41.3378, 69.3338)
    assert [m["role"] for m in s.history][:2] == ["user", "assistant"] and len(s.history) == 6


def test_store_instance_roundtrip(chat_dir):
    path = chat_dir / "x" / "chat.db"
    st = chat_store.ChatStore(path)
    st.save_session("u", "s", title="T", category="coffee", state={"a": 1}, history=[{"role": "user", "content": "hi"}],
                    last_analysis={"score": 70, "verdict": "change", "location": {"lat": 1, "lng": 2}})
    again = chat_store.ChatStore(path)  # new instance, same file
    row = again.load_session("u", "s")
    assert row["state"] == {"a": 1} and row["last_score"] == 70 and row["history"][0]["content"] == "hi"
    assert again.load_session("other", "s") is None


def test_default_db_path_is_under_var(monkeypatch):
    from app.core import config

    monkeypatch.setenv("CHAT_DB_PATH", "")
    assert config.chat_db_path().parts[-2:] == ("var", "chat.db")


def test_no_user_id_keeps_old_contract(client):
    j = chat(client, None, "anon", "Аптека", **{"lat": 41.2912, "lng": 69.2210})
    assert j["analysis"]["score"] == 79
    assert chat_store.get_store().list_chats("") == []
    r = client.get("/api/chats", params={"user_id": "anon"})
    assert r.status_code == 200 and r.json() == []


def test_cross_chat_context_in_llm_prompt(client, monkeypatch):
    analyse_inha(client, "u1", "old")
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.invalid/v1")
    monkeypatch.setenv("LLM_API_KEY", "test")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    seen: list[str] = []

    def fake_complete(messages, tools=None, timeout=25.0):
        seen.append(messages[0]["content"])
        return {"content": "Ок"}

    monkeypatch.setattr(llm, "complete", fake_complete)
    chat(client, "u1", "new", "Хочу фастфуд")
    prompt = seen[-1]
    assert "новые сверху" in prompt
    assert "Кофейня" in prompt and "41.3378" in prompt and "84" in prompt and "Запускать" in prompt
    assert "ТОЛЬКО" in prompt  # numbers only from stored results / analyze_location
    # the current chat's own analyses are not echoed as "past"
    seen.clear()
    chat(client, "u1", "old", "Расскажи подробнее")
    assert "новые сверху" not in seen[-1]
    # another user never sees them
    seen.clear()
    chat(client, "u2", "new", "Хочу фастфуд")
    assert "новые сверху" not in seen[-1]


def test_memory_block_limit_and_dedupe(client):
    for i in range(7):
        chat(client, "u1", f"c{i}", "Аптека", lat=41.2912 + i * 0.01, lng=69.221)
    chat(client, "u1", "dup", "Аптека", lat=41.2912, lng=69.221)  # same spot as c0 -> reported once
    s = agent.get_session("now", "u1")
    block = agent._memory_block(s)
    lines = [ln for ln in block.splitlines() if ln[:1].isdigit()]
    assert len(lines) == 5
    assert lines[0].count("41.2912") == 1 and "Аптека" in lines[0]  # newest first = the duplicate of c0
    assert sum("41.2912" in ln for ln in lines) == 1


def test_scripted_fallback_mentions_previous_analysis(client):
    analyse_inha(client, "u1", "old")
    chat(client, "u1", "new", "Фастфуд")
    chat(client, "u1", "new", "С собой")
    j = chat(client, "u1", "new", "Вот точка", **CHILANZAR)
    assert j["analysis"]["score"] == 39
    assert "Раньше вы смотрели" in j["reply"] and "84" in j["reply"] and "Кофейня" in j["reply"]


def test_chats_list_get_delete(client):
    analyse_inha(client, "u1", "c1")
    chat(client, "u1", "c2", "привет, хочу открыть бизнес")
    r = client.get("/api/chats", params={"user_id": "u1"})
    assert r.status_code == 200
    items = r.json()
    assert [i["session_id"] for i in items] == ["c2", "c1"]  # newest first
    c1 = items[1]
    assert c1["title"] == "Кофейня · 41.338, 69.334" and c1["last_score"] == 84 and c1["category"] == "coffee"
    assert c1["updated_at"].endswith("Z")
    assert items[0]["title"].startswith("привет") and items[0]["last_score"] is None

    d = client.get("/api/chats/c1", params={"user_id": "u1"})
    assert d.status_code == 200
    j = d.json()
    assert j["analysis"]["score"] == 84 and j["location"]["lat"] == INHA["lat"]
    assert j["messages"][0] == {"role": "user", "content": "Хочу кофейню с собой"}
    assert j["messages"][-1]["role"] == "assistant"
    assert client.get("/api/chats/c2", params={"user_id": "u1"}).json()["analysis"] is None

    assert client.delete("/api/chats/c1", params={"user_id": "u1"}).json() == {"ok": True}
    assert client.get("/api/chats/c1", params={"user_id": "u1"}).status_code == 404
    assert client.delete("/api/chats/c1", params={"user_id": "u1"}).status_code == 404
    assert [i["session_id"] for i in client.get("/api/chats", params={"user_id": "u1"}).json()] == ["c2"]
    # deleting a chat also forgets its analyses and in-memory state
    s = agent.get_session("zzz", "u1")
    assert agent._past_analyses(s) == []
    assert agent.get_session("c1", "u1").last_analysis is None


def test_user_isolation(client):
    analyse_inha(client, "alice", "shared-id")
    chat(client, "bob", "shared-id", "привет")
    assert [i["session_id"] for i in client.get("/api/chats", params={"user_id": "bob"}).json()] == ["shared-id"]
    assert client.get("/api/chats/shared-id", params={"user_id": "bob"}).json()["analysis"] is None
    assert client.get("/api/chats/shared-id", params={"user_id": "alice"}).json()["analysis"]["score"] == 84
    assert client.get("/api/chats/shared-id", params={"user_id": "eve"}).status_code == 404
    assert client.delete("/api/chats/shared-id", params={"user_id": "eve"}).status_code == 404
    assert client.get("/api/chats/shared-id", params={"user_id": "alice"}).status_code == 200
    # bob deleting his chat does not touch alice's
    assert client.delete("/api/chats/shared-id", params={"user_id": "bob"}).status_code == 200
    assert client.get("/api/chats/shared-id", params={"user_id": "alice"}).json()["analysis"]["score"] == 84
    assert client.get("/api/chats").status_code == 422  # user_id is required


def test_place_label_from_nearest_generator(client):
    analyse_inha(client)
    row = chat_store.get_store().recent_analyses("u1", exclude_session="x")[0]
    assert row["place"] is None or row["place"].startswith("у ")


def test_title_falls_back_to_first_user_message(client):
    chat(client, "u1", "t", "Подскажи, где открыть что-нибудь очень интересное и совсем необычное в городе")
    t = client.get("/api/chats", params={"user_id": "u1"}).json()[0]["title"]
    assert t.startswith("Подскажи") and t.endswith("…") and len(t) <= 46


def test_storage_failure_does_not_break_chat(client, monkeypatch):
    monkeypatch.setenv("CHAT_DB_PATH", str(__file__))  # a file where a directory is expected
    chat_store.reset_store()
    j = chat(client, "u1", "x", "Аптека", lat=41.2912, lng=69.2210)
    assert j["analysis"]["score"] == 79
    assert client.get("/api/chats", params={"user_id": "u1"}).status_code == 503
