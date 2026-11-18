"""Template texts (Russian primary, Uzbek for the scripted chat). No numbers are invented here:
every figure comes from the deterministic analysis."""
from __future__ import annotations

CATEGORY_RU = {"coffee": "Кофейня", "fastfood": "Фастфуд", "cafe": "Кафе", "pharmacy": "Аптека"}
CATEGORY_UZ = {"coffee": "Qahvaxona", "fastfood": "Fastfud", "cafe": "Kafe", "pharmacy": "Dorixona"}
CATEGORY_RU_GEN = {"coffee": "кофейни", "fastfood": "фастфуда", "cafe": "кафе", "pharmacy": "аптеки"}

VERDICT_LABEL = {"go": "Запускать", "change": "Изменить", "no": "Не открывать"}
VERDICT_LABEL_UZ = {"go": "Ochish kerak", "change": "O'zgartirish kerak", "no": "Ochmaslik kerak"}

_VERDICT_TEXT = {
    "go": "Запускать: у точки сильные показатели, риск ниже среднего.",
    "change": "Изменить: точка рабочая, но есть слабые места — скорректируйте формат или рассмотрите альтернативы.",
    "no": "Не открывать: высокая конкуренция и слабые показатели, лучше выбрать другую точку.",
}


def verdict_text(verdict: str) -> str:
    return _VERDICT_TEXT[verdict]


def _fmt(n: float | int) -> str:
    return f"{int(round(n)):,}".replace(",", " ")


def explanation(ctx: dict) -> str:
    """Factual, template-based explanation built only from computed values."""
    kpi = ctx["kpi"]
    cat = CATEGORY_RU_GEN.get(ctx["category"], ctx["category"])
    parts = [
        f"Индекс точки для {cat}: {ctx['score']}/100 ({VERDICT_LABEL[ctx['verdict']]}).",
        f"В радиусе 500 м: конкурентов — {kpi['competitors']}, закрывшихся заведений этой категории — {kpi['closures']}, "
        f"суммарная проходимость около {_fmt(kpi['traffic_per_day'])} чел./день.",
    ]
    rent = f"Средняя аренда ~{_fmt(kpi['rent_per_m2_uzs'])} сум/м²"
    if kpi.get("rent_per_m2_usd") is not None:
        rent += f" (~${kpi['rent_per_m2_usd']:.2f} при курсе {_fmt(kpi['usd_rate'])})"
    if not ctx.get("has_rent_objects"):
        rent += " — оценка по району, объектов аренды рядом нет"
    parts.append(rent + ". " + ("Ближайший объект на первой линии — хорошая видимость." if ctx["first_line"] else "Ближайший объект не на первой линии — видимость ограничена."))
    closed = ctx.get("closures") or []
    if closed:
        c = closed[0]
        why = c.get("reason") or "причина не указана"
        year = f" ({c['closed_year']})" if c.get("closed_year") else ""
        parts.append(f"Пример закрытия: «{c['name']}»{year} — {why}.")
    alts = ctx.get("alternatives") or []
    if alts:
        a = alts[0]
        parts.append(
            f"Лучшая альтернатива: индекс {a['score']}/100 в {a['distance_m']} м от выбранной точки "
            f"({a['lat']:.5f}, {a['lng']:.5f})."
        )
    return " ".join(parts)


# ----- scripted chat -------------------------------------------------------

CHAT = {
    "ru": {
        "ask_category": "Какой бизнес вы планируете открыть?",
        "ask_format": "Какой формат: с собой или с посадкой?",
        "need_location": "Отметьте на карте точку, которую хотите проверить, и я проведу анализ.",
        "format_opts": ["С собой", "С посадкой"],
        "after": ["Показать альтернативы", "Изменить формат", "Другая категория"],
        "analysis_intro": "Готово: {cat}, индекс {score}/100 — {verdict}.",
        "alts_head": "Лучшие альтернативы рядом:",
        "alt_line": "{rank}) индекс {score}/100, {dist} м от точки",
        "no_alts": "Альтернатив в радиусе 2,5 км не найдено.",
        "followup": "Чем ещё помочь? Можно показать альтернативы, сменить формат или категорию.",
        "verdict": VERDICT_LABEL,
        "cats": CATEGORY_RU,
    },
    "uz": {
        "ask_category": "Qanday biznes ochmoqchisiz?",
        "ask_format": "Qaysi format: olib ketish yoki zalda o'tirib?",
        "need_location": "Xaritada tekshirmoqchi bo'lgan nuqtani belgilang, men tahlil qilaman.",
        "format_opts": ["Olib ketish", "Zalda o'tirib"],
        "after": ["Muqobillarni ko'rsatish", "Formatni o'zgartirish", "Boshqa kategoriya"],
        "analysis_intro": "Tayyor: {cat}, indeks {score}/100 — {verdict}.",
        "alts_head": "Yaqin atrofdagi eng yaxshi muqobillar:",
        "alt_line": "{rank}) indeks {score}/100, nuqtadan {dist} m",
        "no_alts": "2,5 km radiusda muqobil topilmadi.",
        "followup": "Yana nima yordam bera olaman? Muqobillarni ko'rsatish, format yoki kategoriyani o'zgartirish mumkin.",
        "verdict": VERDICT_LABEL_UZ,
        "cats": CATEGORY_UZ,
    },
}
