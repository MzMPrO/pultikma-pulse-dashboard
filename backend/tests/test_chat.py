def chat(client, sid, msg, **kw):
    r = client.post("/api/chat", json={"session_id": sid, "message": msg, **kw})
    assert r.status_code == 200, r.text
    return r.json()


def test_no_category_asks_clarification(client):
    j = chat(client, "s1", "Привет, хочу открыть бизнес")
    assert "?" in j["reply"]
    assert j["quick_replies"] == ["Кофейня", "Фастфуд", "Кафе", "Аптека"]
    assert j["need_location"] is False
    assert "analysis" not in j or j["analysis"] is None


def test_no_category_even_with_location(client):
    j = chat(client, "s1b", "оцени эту точку", lat=41.3378, lng=69.3338)
    assert j["quick_replies"] and j["need_location"] is False
    assert not j.get("analysis")


def test_full_scripted_flow(client):
    j = chat(client, "s2", "Хочу кофейню")
    assert j["quick_replies"] == ["С собой", "С посадкой"]
    j = chat(client, "s2", "С собой")
    assert j["need_location"] is True and not j.get("analysis")
    j = chat(client, "s2", "Вот точка", lat=41.3378, lng=69.3338)
    assert j["analysis"]["score"] == 84
    assert "84" in j["reply"]
    assert "Показать альтернативы" in j["quick_replies"]
    j = chat(client, "s2", "Показать альтернативы", lat=41.3378, lng=69.3338)
    assert "индекс" in j["reply"]


def test_pharmacy_skips_format(client):
    j = chat(client, "s3", "Аптека", lat=41.2912, lng=69.2210)
    assert j["analysis"]["score"] == 79


def test_uzbek_keywords_and_reply(client):
    j = chat(client, "s4", "Men qahvaxona ochmoqchiman")
    assert "format" in j["reply"].lower()
    assert j["quick_replies"] == ["Olib ketish", "Zalda o'tirib"]
    j = chat(client, "s4", "Olib ketish")
    assert j["need_location"] is True
    j = chat(client, "s5", "dorixona kerak")
    assert j["need_location"] is True


def test_session_isolation_and_category_switch(client):
    chat(client, "a", "кофейня")
    j = chat(client, "b", "привет")
    assert j["quick_replies"][0] == "Кофейня"
    j = chat(client, "a", "Другая категория")
    assert j["quick_replies"][0] == "Кофейня"


def test_rate_and_health(client):
    r = client.get("/api/rate/usd").json()
    assert r["rate"] == 12800 and r["cached"] is False
    h = client.get("/api/health").json()
    assert h["repository"] == "memory" and h["status"] == "ok"
    assert client.options("/api/analyze", headers={"Origin": "http://x", "Access-Control-Request-Method": "POST"}).headers["access-control-allow-origin"] == "*"


def test_llm_tool_flow_and_fallback(client, monkeypatch):
    """Mocked OpenAI-compatible provider: tool call -> analysis -> final text; errors fall back to the script."""
    from app.services import llm

    monkeypatch.setenv("LLM_BASE_URL", "http://llm.invalid/v1")
    monkeypatch.setenv("LLM_API_KEY", "test")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    calls = {"n": 0}

    def fake_complete(messages, tools=None, timeout=25.0):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"content": None, "tool_calls": [{"id": "1", "type": "function", "function": {
                "name": "analyze_location", "arguments": '{"category": "coffee", "format": "takeaway"}'}}]}
        tool_msg = [m for m in messages if m["role"] == "tool"][-1]
        assert '"score": 84' in tool_msg["content"]
        return {"content": "Итог: индекс 84, запускать."}

    monkeypatch.setattr(llm, "complete", fake_complete)
    j = chat(client, "llm1", "кофейня с собой", lat=41.3378, lng=69.3338)
    assert j["reply"].startswith("Итог") and j["analysis"]["score"] == 84

    def boom(*a, **k):
        raise RuntimeError("provider down")

    monkeypatch.setattr(llm, "complete", boom)
    j = chat(client, "llm2", "кофейня")
    assert j["quick_replies"] == ["С собой", "С посадкой"]
    # category gate: the LLM is never consulted when the category is unknown
    j = chat(client, "llm3", "привет")
    assert j["quick_replies"][0] == "Кофейня"


CHIPS = ["Кофейня", "Фастфуд", "Кафе", "Аптека"]


def test_unsupported_business_is_honest_and_not_repeated(client):
    j = chat(client, "u1", "Хочу открыть бизнес")
    assert j["reply"] == "Какой бизнес вы планируете открыть?"
    j1 = chat(client, "u1", "частная школа")
    assert "«частная школа»" in j1["reply"] and "нет данных" in j1["reply"]
    assert j1["quick_replies"] == CHIPS and not j1.get("analysis") and j1["need_location"] is False
    j2 = chat(client, "u1", "частная школа")
    assert j2["reply"] != j1["reply"] and len(j2["reply"]) < len(j1["reply"])
    assert j2["quick_replies"] == CHIPS
    j3 = chat(client, "u1", "частная школа")
    assert j3["reply"] != j2["reply"]
    j4 = chat(client, "u1", "частная школа")
    assert j4["reply"] != j3["reply"]
    j5 = chat(client, "u1", "Школа")
    assert "«Школа»" in j5["reply"]


def test_unsupported_uzbek(client):
    chat(client, "u2", "salom")
    j = chat(client, "u2", "maktab")
    assert "ma'lumot" in j["reply"] and "«maktab»" in j["reply"]
    assert j["quick_replies"] == ["Qahvaxona", "Fastfud", "Kafe", "Dorixona"]


def test_unsupported_keeps_point_then_chip_runs_analysis(client):
    chat(client, "u3", "привет")
    j = chat(client, "u3", "школа", lat=41.3378, lng=69.3338)
    assert j["quick_replies"] == CHIPS  # point message alone doesn't count as an answer
    j = chat(client, "u3", "лицей")
    assert "«лицей»" in j["reply"]
    j = chat(client, "u3", "Аптека")
    assert j["need_location"] is False and j["analysis"]["score"] == 84 or j["analysis"]["kpi"] is not None


def test_point_kept_after_unsupported(client):
    chat(client, "u4", "привет")
    chat(client, "u4", "Анализируй точку", lat=41.2912, lng=69.2210)
    j = chat(client, "u4", "частная школа")
    assert "нет данных" in j["reply"]
    j = chat(client, "u4", "Аптека")
    assert j["analysis"]["score"] == 79 and j["need_location"] is False


def test_synonyms(client):
    from app.services.agent import parse_category as p
    assert p("шаурма") == "fastfood" and p("хот-дог") == "fastfood" and p("lavash") == "fastfood"
    assert p("coffee shop") == "coffee" and p("kofe") == "coffee" and p("qahvaxona") == "coffee"
    assert p("ресторан") == "cafe" and p("oshxona") == "cafe" and p("choyxona") == "cafe"
    assert p("dorixona") == "pharmacy" and p("pharmacy") == "pharmacy" and p("школа") is None


def test_llm_not_called_for_unsupported(client, monkeypatch):
    from app.services import llm
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.invalid/v1")
    monkeypatch.setenv("LLM_API_KEY", "test")
    monkeypatch.setenv("LLM_MODEL", "test-model")

    def boom(*a, **k):
        raise AssertionError("LLM must not be called without a supported category")

    monkeypatch.setattr(llm, "complete", boom)
    chat(client, "u5", "привет")
    j = chat(client, "u5", "школа")
    assert "нет данных" in j["reply"] and j["quick_replies"] == CHIPS
