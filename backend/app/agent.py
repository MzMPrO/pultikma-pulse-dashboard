"""Dialog agent. The LLM (if configured) only drives the conversation and explains results;
all numbers come from the deterministic `scoring.analyze` tool. Without an LLM (or when it
fails) a scripted flow runs: category -> format -> location -> analysis."""
from __future__ import annotations

import json
import logging
import re
import threading
from dataclasses import dataclass, field

from . import chat_store, geo, llm, scoring, texts

log = logging.getLogger("pulse.agent")

# --------------------------------------------------------------------------- parsing

_CAT_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("fastfood", ("фастфуд", "фаст-фуд", "фаст фуд", "fastfood", "fast food", "fast-food", "fastfud", "fast fud",
                  "бургер", "шаурм", "лаваш", "хот-дог", "хот дог", "хотдог", "донер", "burger", "shawarma",
                  "lavash", "hot dog", "hot-dog", "hotdog", "doner", "tezkor ovqat", "tez ovqat")),
    ("coffee", ("кофе", "coffee", "qahva", "kofe", "kofeyn", "coffe")),
    ("pharmacy", ("аптек", "apteka", "dorixona", "dorihona", "дорихон", "pharmacy", "дорихана", "фармаци", "pharma")),
    ("cafe", ("кафе", "cafe", "kafe", "ресторан", "restoran", "restaurant", "чайхан", "choyxona", "choyhona", "oshxona", "oshhona", "столовая", "bistro", "бистро")),
]
_TAKEAWAY = ("с собой", "собой", "навынос", "на вынос", "takeaway", "take away", "take-away", "olib ket", "olib keti")
_DINE_IN = ("посадк", "в зале", "dine", "zalda", "o'tirib", "o‘tirib", "otirib", "с местами", "за столиком")
_UZ_STEMS = (
    "qahva", "dorixona", "apteka", "olib", "zalda", "kerak", "ochmoq", "salom", "rahmat", "muqobil", "boshqa",
    "kategoriya", "formatni", "nuqta", "xarita", "kafe", "fastfud", "qanday", "biznes", "ochish", "menga", "uchun",
    "yaxshi", "o'zgar", "ko'rsat",
)


def parse_category(text: str) -> str | None:
    t = text.lower().replace("ё", "е")
    for cat, kws in _CAT_KEYWORDS:
        if any(k in t for k in kws):
            return cat
    return None


def parse_format(text: str) -> str | None:
    t = text.lower().replace("ё", "е")
    if any(k in t for k in _TAKEAWAY):
        return "takeaway"
    if any(k in t for k in _DINE_IN):
        return "dine_in"
    return None


def detect_lang(text: str, current: str = "ru") -> str:
    if re.search(r"[а-яА-ЯёЁ]", text):
        return "ru"
    tokens = set(re.findall(r"[a-z'‘’ʻ]+", text.lower().replace("’", "'")))
    if any(tok.startswith(_UZ_STEMS) for tok in tokens):
        return "uz"
    return current


def _has(text: str, *needles: str) -> bool:
    t = text.lower()
    return any(n in t for n in needles)


# --------------------------------------------------------------------------- sessions


@dataclass
class Session:
    category: str | None = None
    format: str | None = None
    avg_check: float | None = None
    audience: str | None = None
    budget: float | None = None
    lat: float | None = None
    lng: float | None = None
    lang: str = "ru"
    format_asked: bool = False
    awaiting_category: bool = False
    unsupported_count: int = 0
    last_unsupported: str = ""
    last_key: tuple | None = None
    last_analysis: dict | None = None
    history: list[dict] = field(default_factory=list)
    # identity (not part of the persisted state blob)
    session_id: str = ""
    user_id: str | None = None


# Slots that are persisted as the session "state" (everything except history / last_analysis / identity).
_STATE_FIELDS = (
    "category", "format", "avg_check", "audience", "budget", "lat", "lng", "lang", "format_asked",
    "awaiting_category", "unsupported_count", "last_unsupported",
)

_sessions: dict[tuple[str, str], Session] = {}
_lock = threading.Lock()
MAX_SESSIONS = 2000


def session_to_state(s: Session) -> dict:
    state = {k: getattr(s, k) for k in _STATE_FIELDS}
    state["last_key"] = list(s.last_key) if s.last_key else None
    return state


def session_from_stored(session_id: str, user_id: str, row: dict) -> Session:
    st = row.get("state") or {}
    s = Session(session_id=session_id, user_id=user_id)
    for k in _STATE_FIELDS:
        if k in st:
            setattr(s, k, st[k])
    s.last_key = tuple(st["last_key"]) if st.get("last_key") else None
    s.last_analysis = row.get("last_analysis")
    s.history = list(row.get("history") or [])
    return s


def get_session(session_id: str, user_id: str | None = None) -> Session:
    """In-memory cache first; with a user_id a cache miss is loaded from the chat store (survives restarts)."""
    key = (user_id or "", session_id)
    with _lock:
        cached = _sessions.get(key)
        if cached is not None:
            return cached
    s: Session | None = None
    store = chat_store.get_store() if user_id else None
    if store is not None:
        try:
            row = store.load_session(user_id, session_id)
            if row is not None:
                s = session_from_stored(session_id, user_id, row)
        except Exception as exc:  # a broken DB must never break the chat
            log.warning("could not load session %s (%s)", session_id, exc.__class__.__name__)
    if s is None:
        s = Session(session_id=session_id, user_id=user_id)
    with _lock:
        if len(_sessions) >= MAX_SESSIONS:
            _sessions.pop(next(iter(_sessions)))
        return _sessions.setdefault(key, s)


def forget_session(session_id: str, user_id: str | None = None) -> None:
    with _lock:
        _sessions.pop((user_id or "", session_id), None)


def reset_sessions() -> None:
    with _lock:
        _sessions.clear()


# --------------------------------------------------------------------------- LLM tools

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "ask_clarification",
            "description": "Ask the user ONE clarifying question (e.g. business category, format, audience, budget).",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "options": {"type": "array", "items": {"type": "string"}, "description": "Short answer buttons"},
                },
                "required": ["question", "options"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_location",
            "description": "Run the deterministic location analysis. Returns score, factors, KPI and alternatives. "
                           "Call only when the category is known and a location is available.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "category": {"type": "string", "enum": ["coffee", "fastfood", "cafe", "pharmacy"]},
                    "format": {"type": "string", "description": "takeaway or dine_in"},
                    "avg_check": {"type": "number"},
                    "audience": {"type": "string"},
                    "budget": {"type": "number"},
                },
                "required": ["category"],
            },
        },
    },
]

SYSTEM_PROMPT = """Ты — ИИ-консультант PulTikma AI, помогаешь выбрать место для малого бизнеса в Ташкенте
(кофейня, фастфуд, кафе, аптека).
Правила:
1. Отвечай по-русски. Если пользователь пишет по-узбекски — отвечай по-узбекски. Коротко и по делу.
2. НИКОГДА не придумывай числа, адреса, названия заведений и причины закрытий. Все цифры бери ТОЛЬКО из результата
   инструмента analyze_location. Если данных нет — так и скажи.
3. Если категория бизнеса не названа — вызови ask_clarification с вариантами: Кофейня, Фастфуд, Кафе, Аптека.
4. Для кофейни, фастфуда и кафе, если формат неизвестен, спроси через ask_clarification: «С собой» / «С посадкой».
5. Когда категория известна и есть координаты точки — вызови analyze_location. Координаты точки уже известны системе;
   не выдумывай их. Если координат нет — скажи, что нужно поставить точку на карте.
6. После анализа кратко объясни результат: индекс, вердикт, 2–3 ключевых фактора, лучшую альтернативу.
   Вердикт: >70 «Запускать», 50–70 «Изменить», <50 «Не открывать».
7. Если ниже дан блок «Прошлые анализы пользователя» — это память о его предыдущих чатах. Можешь на неё ссылаться
   («в прошлый раз вы смотрели кофейню у Inha — 84») и сравнивать с новой точкой. Числа для прошлых точек бери ТОЛЬКО
   из этого блока, для новой — только из analyze_location. Не упоминай прошлые анализы, если они не к месту.
"""


def _state_block(s: Session) -> str:
    return (
        "\nТекущее состояние диалога (из системы): "
        f"category={s.category}, format={s.format}, avg_check={s.avg_check}, audience={s.audience}, "
        f"budget={s.budget}, location={'есть' if s.lat is not None else 'нет'}"
        + (f" ({s.lat:.5f}, {s.lng:.5f})" if s.lat is not None else "")
    )


# --------------------------------------------------------------------------- cross-chat memory

MEMORY_LIMIT = 5


def _place_label(analysis: dict) -> str | None:
    """Short human label for an analysed spot: 'у <nearest traffic generator>' (names come from the dataset)."""
    loc = analysis.get("location") or {}
    best: tuple[float, str] | None = None
    for g in analysis.get("traffic_generators") or []:
        if not g.get("name") or loc.get("lat") is None:
            continue
        d = float(geo.haversine_m(loc["lat"], loc["lng"], g["lat"], g["lng"]))
        if d <= 600 and (best is None or d < best[0]):
            best = (d, g["name"])
    return f"у {best[1]}" if best else None


def _past_analyses(s: Session) -> list[dict]:
    """Last analyses from the user's OTHER chats (empty without user_id or store)."""
    store = chat_store.get_store() if s.user_id else None
    if store is None:
        return []
    try:
        return store.recent_analyses(s.user_id, exclude_session=s.session_id, limit=MEMORY_LIMIT)
    except Exception as exc:
        log.warning("could not read past analyses (%s)", exc.__class__.__name__)
        return []


def _past_line(a: dict, lang: str = "ru") -> str:
    cats = texts.CATEGORY_UZ if lang == "uz" else texts.CATEGORY_RU
    verdicts = texts.VERDICT_LABEL_UZ if lang == "uz" else texts.VERDICT_LABEL
    place = f" {a['place']}" if a.get("place") else ""
    return (f"{cats.get(a['category'], a['category'])}{place} ({a['lat']:.4f}, {a['lng']:.4f}) — "
            f"{a['score']} ({verdicts.get(a['verdict'], a['verdict'])})")


def _memory_block(s: Session) -> str:
    past = _past_analyses(s)
    if not past:
        return ""
    lines = [f"{i}. {a['created_at'][:10]} — {_past_line(a)}" for i, a in enumerate(past, 1)]
    return "\n\nПрошлые анализы пользователя (из других чатов, новые сверху):\n" + "\n".join(lines)


def _compact(analysis: dict) -> dict:
    return {
        "score": analysis["score"],
        "verdict": analysis["verdict"],
        "verdict_text": analysis["verdict_text"],
        "factors": analysis["factors"],
        "kpi": analysis["kpi"],
        "closure_reasons": [
            {"name": c["name"], "reason": c.get("reason"), "year": c.get("closed_year")} for c in analysis["closed"][:3]
        ],
        "top_traffic_generators": [
            {"name": g["name"], "type": g.get("type"), "daily_flow": g.get("daily_flow")}
            for g in sorted(analysis["traffic_generators"], key=lambda g: -(g.get("daily_flow") or 0))[:3]
        ],
        "alternatives": [
            {"rank": a["rank"], "score": a["score"], "distance_m": a["distance_m"]} for a in analysis["alternatives"]
        ],
        "explanation": analysis["explanation"],
    }


# --------------------------------------------------------------------------- analysis helper


def _run_analysis(s: Session) -> dict:
    a = scoring.analyze(s.lat, s.lng, s.category, s.format, s.avg_check, s.audience, s.budget)
    s.last_analysis = a
    s.last_key = (s.category, s.format, round(s.lat, 5), round(s.lng, 5))
    return a


def _cat_quick(lang: str) -> list[str]:
    return [texts.CATEGORY_UZ[c] if lang == "uz" else texts.CATEGORY_RU[c] for c in ("coffee", "fastfood", "cafe", "pharmacy")]


# --------------------------------------------------------------------------- scripted flow


def _alts_text(s: Session, t: dict) -> str:
    alts = (s.last_analysis or {}).get("alternatives") or []
    if not alts:
        return t["no_alts"]
    lines = [t["alts_head"]] + [
        t["alt_line"].format(rank=a["rank"], score=a["score"], dist=a["distance_m"]) + f" ({a['lat']:.5f}, {a['lng']:.5f})"
        for a in alts
    ]
    return "\n".join(lines)


def _summary(s: Session, analysis: dict, t: dict) -> str:
    cat = t["cats"][s.category]
    head = t["analysis_intro"].format(cat=cat, score=analysis["score"], verdict=t["verdict"][analysis["verdict"]])
    if s.lang == "uz":
        k = analysis["kpi"]
        return (f"{head} Raqobatchilar: {k['competitors']}, yopilganlar: {k['closures']}, "
                f"kunlik oqim: {k['traffic_per_day']} kishi, ijara: {k['rent_per_m2_uzs']} so'm/m².")
    return f"{head}\n{analysis['explanation']}"


_GENERIC = ("привет", "здравств", "салом", "салам", "salom", "assalom", "hello", "hi", "hey", "помощ", "help", "yordam",
            "не знаю", "bilmayman", "да", "ha", "нет", "yo'q", "ok", "ок", "хорошо", "бизнес", "biznes", "точк", "nuqta",
            "анализ", "tahlil", "оцени", "хочу открыть", "открыть")


def _business_word(message: str) -> str | None:
    """Short, quote-safe echo of what the user named, or None when it is generic chatter (greeting, question)."""
    w = re.sub(r"[\s\"'«»“”]+", " ", message).strip(" .,!?:;-–—")
    low = w.lower()
    if not w or "?" in message or len(w) > 40 or len(w.split()) > 4:
        return None
    if any(low == g or (len(g) > 3 and low.startswith(g)) for g in _GENERIC) and len(w.split()) <= 3:
        return None
    return w


def _unsupported_reply(s: Session, t: dict, word: str) -> dict:
    key = word.lower()
    if key == s.last_unsupported:
        s.unsupported_count += 1
    else:
        s.unsupported_count = 0
    s.last_unsupported = key
    variants = t["unsupported"]
    n = s.unsupported_count
    text = variants[0 if n == 0 else 1 + (n - 1) % (len(variants) - 1)]
    return {"reply": text.format(word=word), "quick_replies": _cat_quick(s.lang), "need_location": False}


def _scripted_turn(s: Session, message: str, has_point: bool = False) -> dict:
    t = texts.CHAT[s.lang]
    low = message.lower()

    # reset intents (quick-reply buttons)
    if _has(low, "другая категория", "boshqa kategoriya"):
        s.category = s.format = None
        s.format_asked = False
        s.last_key = None
    if _has(low, "изменить формат", "formatni o"):
        s.format = None
        s.format_asked = False
        s.last_key = None

    cat = parse_category(message)
    if cat:
        s.category = cat
    fmt = parse_format(message)
    if fmt:
        s.format = fmt

    if not s.category:
        # An answer to "which business?" that isn't one of the 4 supported categories: say so honestly
        # (location stays in the session, so picking a chip proceeds straight to the analysis).
        reset = _has(low, "другая категория", "boshqa kategoriya")
        word = _business_word(message) if (s.awaiting_category and not has_point and not reset) else None
        s.awaiting_category = True
        if word:
            return _unsupported_reply(s, t, word)
        return {"reply": t["ask_category"], "quick_replies": _cat_quick(s.lang), "need_location": False}
    s.awaiting_category = False
    s.unsupported_count = 0
    s.last_unsupported = ""

    if s.category != "pharmacy" and not s.format:
        if not s.format_asked:
            s.format_asked = True
            return {"reply": t["ask_format"], "quick_replies": t["format_opts"], "need_location": False}
        s.format = "unspecified"  # asked once; continue without it

    if s.lat is None or s.lng is None:
        return {"reply": t["need_location"], "quick_replies": [], "need_location": True}

    key = (s.category, s.format, round(s.lat, 5), round(s.lng, 5))
    if key != s.last_key:
        past = _past_analyses(s)  # other chats only, so it never contains this analysis
        a = _run_analysis(s)
        reply = _summary(s, a, t)
        if past:
            head = "Avval ko'rgansiz" if s.lang == "uz" else "Раньше вы смотрели"
            reply += f"\n{head}: {_past_line(past[0], s.lang)}."
        return {"reply": reply, "quick_replies": t["after"], "need_location": False, "analysis": a}

    if _has(low, "альтернатив", "muqobil", "alternativ"):
        return {"reply": _alts_text(s, t), "quick_replies": t["after"], "need_location": False}
    return {"reply": t["followup"], "quick_replies": t["after"], "need_location": False}


# --------------------------------------------------------------------------- LLM flow


def _valid_category(v) -> str | None:
    return v if v in {"coffee", "fastfood", "cafe", "pharmacy"} else None


def _llm_turn(s: Session) -> dict:
    t = texts.CHAT[s.lang]
    msgs: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT + _state_block(s) + _memory_block(s)}
    ] + s.history[-16:]
    analysis: dict | None = None
    for _ in range(4):
        m = llm.complete(msgs, TOOLS)
        calls = m.get("tool_calls") or []
        if not calls:
            reply = (m.get("content") or "").strip()
            if not reply:
                raise RuntimeError("empty LLM reply")
            return {
                "reply": reply,
                "quick_replies": t["after"] if analysis else [],
                "need_location": False,
                **({"analysis": analysis} if analysis else {}),
            }
        msgs.append({"role": "assistant", "content": m.get("content") or "", "tool_calls": calls})
        for tc in calls:
            fn = tc["function"]["name"]
            try:
                args = json.loads(tc["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            if fn == "ask_clarification":
                q = str(args.get("question") or t["ask_category"])
                opts = [str(o) for o in (args.get("options") or [])][:6]
                return {"reply": q, "quick_replies": opts, "need_location": False}
            if fn == "analyze_location":
                s.category = _valid_category(args.get("category")) or s.category
                if args.get("format"):
                    s.format = str(args["format"])
                for k in ("avg_check", "budget"):
                    if isinstance(args.get(k), (int, float)):
                        setattr(s, k, float(args[k]))
                if args.get("audience"):
                    s.audience = str(args["audience"])
                if s.lat is None or s.lng is None:
                    return {"reply": t["need_location"], "quick_replies": [], "need_location": True}
                analysis = _run_analysis(s)
                content = json.dumps(_compact(analysis), ensure_ascii=False)
            else:
                content = json.dumps({"error": f"unknown tool {fn}"})
            msgs.append({"role": "tool", "tool_call_id": tc.get("id", fn), "content": content})
    raise RuntimeError("LLM tool loop did not converge")


# --------------------------------------------------------------------------- entry point


def _title(s: Session) -> str:
    a = s.last_analysis
    if a and s.category:
        loc = a["location"]
        return f"{texts.CATEGORY_RU[s.category]} · {loc['lat']:.3f}, {loc['lng']:.3f}"
    first = next((m["content"] for m in s.history if m["role"] == "user" and m["content"].strip()), "")
    first = " ".join(first.split())
    return (first[:45] + "…" if len(first) > 46 else first) or "Новый чат"


def _persist(s: Session, result: dict) -> None:
    store = chat_store.get_store() if s.user_id else None
    if store is None:
        return
    try:
        a = result.get("analysis")
        if a:
            store.add_analysis(
                s.user_id, s.session_id, category=s.category or "", place=_place_label(a),
                lat=a["location"]["lat"], lng=a["location"]["lng"], score=a["score"], verdict=a["verdict"],
            )
        store.save_session(
            s.user_id, s.session_id, title=_title(s), category=s.category, state=session_to_state(s),
            history=s.history, last_analysis=s.last_analysis,
        )
    except Exception as exc:  # persistence is best-effort: the reply is already computed
        log.warning("could not persist session %s (%s)", s.session_id, exc.__class__.__name__)


def handle_chat(
    session_id: str, message: str, lat: float | None = None, lng: float | None = None, user_id: str | None = None
) -> dict:
    s = get_session(session_id, user_id)
    if lat is not None and lng is not None:
        s.lat, s.lng = lat, lng
    s.lang = detect_lang(message, s.lang)

    # keyword parse runs first so the state (and the category gate) is deterministic
    cat = parse_category(message)
    if cat:
        s.category = cat
    fmt = parse_format(message)
    if fmt:
        s.format = fmt

    result: dict | None = None
    if llm.is_configured() and s.category and not _has(message, "другая категория", "изменить формат", "boshqa kategoriya"):
        s.history.append({"role": "user", "content": message})
        try:
            result = _llm_turn(s)
        except Exception as exc:  # network, bad JSON, provider error -> scripted fallback
            log.warning("LLM turn failed (%s); using scripted fallback", exc.__class__.__name__)
            s.history.pop()
            result = None
    if result is None:
        result = _scripted_turn(s, message, has_point=lat is not None and lng is not None)
        s.history.append({"role": "user", "content": message})
    s.history.append({"role": "assistant", "content": result["reply"]})
    del s.history[:-40]
    _persist(s, result)
    return result
