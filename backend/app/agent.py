"""Dialog agent. The LLM (if configured) only drives the conversation and explains results;
all numbers come from the deterministic `scoring.analyze` tool. Without an LLM (or when it
fails) a scripted flow runs: category -> format -> location -> analysis."""
from __future__ import annotations

import json
import logging
import re
import threading
from dataclasses import dataclass, field

from . import llm, scoring, texts

log = logging.getLogger("pulse.agent")

# --------------------------------------------------------------------------- parsing

_CAT_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("fastfood", ("фастфуд", "фаст-фуд", "фаст фуд", "fastfood", "fast food", "fast-food", "fastfud", "fast fud",
                  "бургер", "шаурм", "burger", "shawarma", "tezkor ovqat")),
    ("coffee", ("кофе", "coffee", "qahva", "kofe", "kofeyn")),
    ("pharmacy", ("аптек", "apteka", "dorixona", "dorihona", "дорихон", "pharmacy", "дорихана")),
    ("cafe", ("кафе", "cafe", "kafe", "ресторан", "restoran", "restaurant", "чайхан", "choyxona", "oshxona")),
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
    last_key: tuple | None = None
    last_analysis: dict | None = None
    history: list[dict] = field(default_factory=list)


_sessions: dict[str, Session] = {}
_lock = threading.Lock()
MAX_SESSIONS = 2000


def get_session(session_id: str) -> Session:
    with _lock:
        if session_id not in _sessions:
            if len(_sessions) >= MAX_SESSIONS:
                _sessions.pop(next(iter(_sessions)))
            _sessions[session_id] = Session()
        return _sessions[session_id]


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
"""


def _state_block(s: Session) -> str:
    return (
        "\nТекущее состояние диалога (из системы): "
        f"category={s.category}, format={s.format}, avg_check={s.avg_check}, audience={s.audience}, "
        f"budget={s.budget}, location={'есть' if s.lat is not None else 'нет'}"
        + (f" ({s.lat:.5f}, {s.lng:.5f})" if s.lat is not None else "")
    )


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


def _scripted_turn(s: Session, message: str) -> dict:
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
        return {"reply": t["ask_category"], "quick_replies": _cat_quick(s.lang), "need_location": False}

    if s.category != "pharmacy" and not s.format:
        if not s.format_asked:
            s.format_asked = True
            return {"reply": t["ask_format"], "quick_replies": t["format_opts"], "need_location": False}
        s.format = "unspecified"  # asked once; continue without it

    if s.lat is None or s.lng is None:
        return {"reply": t["need_location"], "quick_replies": [], "need_location": True}

    key = (s.category, s.format, round(s.lat, 5), round(s.lng, 5))
    if key != s.last_key:
        a = _run_analysis(s)
        return {"reply": _summary(s, a, t), "quick_replies": t["after"], "need_location": False, "analysis": a}

    if _has(low, "альтернатив", "muqobil", "alternativ"):
        return {"reply": _alts_text(s, t), "quick_replies": t["after"], "need_location": False}
    return {"reply": t["followup"], "quick_replies": t["after"], "need_location": False}


# --------------------------------------------------------------------------- LLM flow


def _valid_category(v) -> str | None:
    return v if v in {"coffee", "fastfood", "cafe", "pharmacy"} else None


def _llm_turn(s: Session) -> dict:
    t = texts.CHAT[s.lang]
    msgs: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT + _state_block(s)}] + s.history[-16:]
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


def handle_chat(session_id: str, message: str, lat: float | None = None, lng: float | None = None) -> dict:
    s = get_session(session_id)
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
        result = _scripted_turn(s, message)
        s.history.append({"role": "user", "content": message})
    s.history.append({"role": "assistant", "content": result["reply"]})
    del s.history[:-40]
    return result
