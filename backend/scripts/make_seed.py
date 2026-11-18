"""Generate the SYNTHETIC seed dataset in backend/data/*.csv.

Everything here is invented (source = 'synthetic'); only the place names of landmarks
(universities, metro stations, bazaars) are real. The hand-placed objects around the three
demo anchors are tuned so the scoring formula gives EXACTLY:

    Inha coffee        (41.3378, 69.3338) -> 84
    Chilanzar fastfood (41.2738, 69.2052) -> 39
    Novza pharmacy     (41.2912, 69.2210) -> 79

When the real (Gemini/OSM) CSVs replace these files, re-check backend/tests/test_scoring.py.

Run:  python backend/scripts/make_seed.py
"""
from __future__ import annotations

import csv
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.geo import haversine_m, offset  # noqa: E402

DATA = ROOT / "data"
rng = random.Random(20261118)

INHA = (41.3378, 69.3338)
CHIL = (41.2738, 69.2052)
NOVZ = (41.2912, 69.2210)
ANCHORS = {"inha": (INHA, "coffee"), "chil": (CHIL, "fastfood"), "novz": (NOVZ, "pharmacy")}
SRC = "synthetic"

NAMES = {
    "coffee": ["Coffee Point", "Brew Lab", "Aroma Beans", "Latte House", "Бодрое утро", "Зерно", "Espresso Corner",
               "Кофе-стоп", "Mokka Bar", "Barista Hub", "Cup & Go", "Утренний глоток"],
    "fastfood": ["Burger Spot", "Шаурма Хаус", "Lavash Express", "Fry & Go", "Doner Point", "Хот-дог Стрит",
                 "Pizza Slice", "Crispy Chicken", "Samsa Fast", "Wrap Time", "Гриль-на-ходу", "Чикен Бокс"],
    "cafe": ["Кафе «Уют»", "Дом чая", "Лагман Хаус", "Cafe Central", "Пекарня №1", "Sweet Corner", "Кафе «Весна»",
             "Плов-центр", "Тандыр Хаус", "Cafe Garden", "Домашняя кухня", "Чайхона у дома"],
    "pharmacy": ["Аптека «Здоровье»", "Аптека 24", "Dori Plus", "Аптека «Шифо»", "Фармамед", "Аптека у дома",
                 "MedLine", "Аптека «Сабр»", "Доктор Вита", "Аптека-экспресс", "Аптека «Рашид»", "ФармаСити"],
}
REASONS = {
    "coffee": ["Высокая аренда при слабом вечернем потоке", "Не окупила вложения за 14 месяцев",
               "Конкуренция с сетевой кофейней рядом", "Сезонный спад спроса, нехватка оборотных средств",
               "Расторжение договора аренды"],
    "fastfood": ["Высокая аренда, низкий средний чек", "Закрыта из-за конкуренции с сетью по соседству",
                 "Слабая проходимость во второй половине дня", "Проблемы с поставщиками и ростом цен на мясо",
                 "Конфликт с арендодателем", "Закрыта после ремонта дороги: пропал поток покупателей"],
    "cafe": ["Высокая арендная ставка", "Недостаточная посещаемость в будни", "Смена концепции, заведение закрыто",
             "Нехватка оборотных средств", "Расторжение договора аренды"],
    "pharmacy": ["Конкуренция с сетевой аптекой напротив", "Не получена лицензия на продление",
                 "Низкая выручка на второй линии", "Расторжение договора аренды"],
}
DISTRICTS = [
    ("Мирзо-Улугбекский", 41.3380, 69.3350, 265_000),
    ("Чиланзарский", 41.2750, 69.2040, 255_000),
    ("Юнусабадский", 41.3650, 69.2850, 340_000),
    ("Мирабадский", 41.2900, 69.2800, 420_000),
    ("Яккасарайский", 41.2850, 69.2600, 400_000),
    ("Шайхантахурский", 41.3250, 69.2300, 300_000),
    ("Алмазарский", 41.3350, 69.2100, 240_000),
    ("Сергелийский", 41.2250, 69.2200, 185_000),
    ("Учтепинский", 41.3000, 69.1700, 205_000),
    ("Яшнабадский", 41.3000, 69.3300, 235_000),
    ("Бектемирский", 41.2350, 69.3350, 170_000),
]

# generator types -> (names, flow range)
GEN_TYPES = {
    "metro": (["Станция метро"], (12_000, 26_000)),
    "bazaar": (["Рынок", "Продуктовый базар"], (10_000, 28_000)),
    "mall": (["Торговый центр", "Торговый комплекс"], (8_000, 20_000)),
    "bus_stop": (["Автобусная остановка", "Остановка маршруток"], (2_000, 8_000)),
    "school": (["Школа", "Лицей"], (2_000, 5_000)),
    "hospital": (["Поликлиника", "Больница"], (3_000, 8_000)),
    "office": (["Бизнес-центр", "Офисный центр"], (3_000, 9_000)),
    "university": (["Колледж", "Институт"], (5_000, 15_000)),
}

# (dx_m, dy_m from anchor [multiples of the 250 m grid], daily_flow, n_competitors, n_closures, rent, first_line)
POCKETS = {
    "inha": [(1250, -750, 21_000, 2, 0, 220_000, True), (-1500, 500, 18_000, 1, 1, 240_000, False),
             (500, 1750, 15_000, 2, 0, 200_000, True)],
    "chil": [(1000, 750, 30_000, 1, 0, 230_000, True), (-1500, -500, 26_000, 2, 1, 210_000, True),
             (250, -1750, 20_000, 2, 0, 190_000, False)],
    "novz": [(1000, -250, 22_000, 2, 0, 250_000, True), (-1250, 750, 17_000, 1, 1, 230_000, False),
             (-250, 1750, 26_000, 3, 0, 220_000, True)],
}

rows: dict[str, list[dict]] = {k: [] for k in
                               ["competitors", "closures", "traffic_generators", "rent", "business_for_sale"]}
counters: dict[str, int] = {}


def nid(prefix: str) -> str:
    counters[prefix] = counters.get(prefix, 0) + 1
    return f"{prefix}-{counters[prefix]:03d}"


def pt(origin, dx, dy):
    lat, lng = offset(origin[0], origin[1], dx, dy)
    return round(lat, 6), round(lng, 6)


def nearest_district_rent(p) -> int:
    return min(DISTRICTS, key=lambda d: haversine_m(p[0], p[1], d[1], d[2]))[3]


def add_comp(cat, p, name=None):
    rows["competitors"].append({"id": nid("cmp"), "name": name or rng.choice(NAMES[cat]), "lat": p[0], "lng": p[1],
                                "category": cat, "source": SRC})


def add_clo(cat, p, reason=None, year=None, name=None):
    rows["closures"].append({"id": nid("clo"), "name": name or rng.choice(NAMES[cat]), "lat": p[0], "lng": p[1],
                             "category": cat, "reason": reason or rng.choice(REASONS[cat]),
                             "closed_year": year or rng.randint(2021, 2025), "source": SRC})


def add_gen(typ, p, flow, name=None):
    base = name or rng.choice(GEN_TYPES[typ][0])
    rows["traffic_generators"].append({"id": nid("tg"), "name": base, "lat": p[0], "lng": p[1], "type": typ,
                                       "daily_flow": int(flow), "source": SRC})


def add_rent(p, rent, first_line, label=None):
    rows["rent"].append({"id": nid("rent"), "name": label or f"Помещение {rng.choice([35, 45, 60, 80, 120])} м²",
                         "lat": p[0], "lng": p[1], "rent_per_m2_uzs": int(rent), "first_line": str(first_line).lower(),
                         "district": min(DISTRICTS, key=lambda d: haversine_m(p[0], p[1], d[1], d[2]))[0],
                         "area_m2": rng.choice([35, 45, 60, 80, 120]), "source": SRC})


def add_bfs(cat, p):
    price = rng.choice([8_000, 12_000, 15_000, 22_000, 30_000, 45_000])
    rows["business_for_sale"].append({"id": nid("bfs"), "name": f"Готовый бизнес: {rng.choice(NAMES[cat])}",
                                      "lat": p[0], "lng": p[1], "category": cat, "price_usd": price,
                                      "area_m2": rng.choice([30, 50, 70, 90, 140]), "source": SRC})


# ---- hand-placed anchor neighbourhoods (all within 460 m; decoys >= 600 m) ---------------------------------
def build_anchors():
    # INHA coffee -> traffic 31500 (cap), 1 competitor, 1 closure, rent avg 245000, nearest rent first line => 84
    add_gen("university", pt(INHA, 120, -180), 18_000, "Университет Инха")
    add_gen("bus_stop", pt(INHA, -200, -100), 6_500, "Остановка у университета")
    add_gen("office", pt(INHA, 350, -300), 7_000, "Бизнес-центр Мирзо-Улугбек")
    add_gen("mall", pt(INHA, 620, 380), 25_000, "Торговый центр (за пределами 500 м)")
    add_comp("coffee", pt(INHA, 300, 150), "Бодрое утро")
    add_comp("coffee", pt(INHA, -650, 300), "Coffee Point (за пределами 500 м)")
    add_comp("fastfood", pt(INHA, -180, 260), "Burger Spot")
    add_comp("cafe", pt(INHA, 200, -250), "Cafe Central")
    add_clo("coffee", pt(INHA, -250, 200), "Высокая аренда при слабом вечернем потоке", 2024, "Latte House")
    add_clo("coffee", pt(INHA, 700, -200), None, 2023, "Mokka Bar (за пределами 500 м)")
    add_clo("fastfood", pt(INHA, 150, 300), "Закрыта из-за конкуренции с сетью по соседству", 2023, "Fry & Go")
    add_rent(pt(INHA, 60, 40), 230_000, True, "Помещение у входа в университет, 1-я линия")
    add_rent(pt(INHA, -300, -200), 260_000, False, "Помещение во дворе, 2-я линия")
    add_rent(pt(INHA, 640, 640), 400_000, True, "Помещение (за пределами 500 м)")

    # CHILANZAR fastfood -> traffic 65000 (cap), 3 competitors, 4 closures, rent avg 270000, 2nd line => 39
    add_gen("bazaar", pt(CHIL, -150, 200), 32_000, "Чиланзарский рынок")
    add_gen("metro", pt(CHIL, 250, -150), 25_000, "Станция метро Чиланзар")
    add_gen("bus_stop", pt(CHIL, 100, 280), 8_000, "Остановка Чиланзар")
    add_comp("fastfood", pt(CHIL, 200, 250), "Burger Spot")
    add_comp("fastfood", pt(CHIL, -300, 100), "Шаурма Хаус")
    add_comp("fastfood", pt(CHIL, 100, -350), "Lavash Express")
    add_comp("fastfood", pt(CHIL, 650, 250), "Doner Point (за пределами 500 м)")
    add_comp("coffee", pt(CHIL, -200, -150), "Кофе-стоп")
    add_comp("coffee", pt(CHIL, 330, 120), "Cup & Go")
    add_clo("fastfood", pt(CHIL, -100, -250), "Высокая аренда, низкий средний чек", 2022, "Fry & Go")
    add_clo("fastfood", pt(CHIL, 280, 40), "Закрыта из-за конкуренции с сетью по соседству", 2023, "Чикен Бокс")
    add_clo("fastfood", pt(CHIL, -350, 230), "Слабая проходимость во второй половине дня", 2024, "Wrap Time")
    add_clo("fastfood", pt(CHIL, 60, 180), "Конфликт с арендодателем", 2025, "Pizza Slice")
    add_clo("coffee", pt(CHIL, 150, -200), "Не окупила вложения за 14 месяцев", 2023, "Brew Lab")
    add_rent(pt(CHIL, -40, 60), 250_000, False, "Помещение во дворе рынка, 2-я линия")
    add_rent(pt(CHIL, 300, 200), 270_000, True, "Помещение на магистрали, 1-я линия")
    add_rent(pt(CHIL, -250, -300), 290_000, False, "Помещение в жилом доме, 2-я линия")

    # NOVZA pharmacy -> traffic 24000, 2 competitors, 0 closures, rent avg 270000, nearest first line => 79
    add_gen("metro", pt(NOVZ, 180, 120), 14_000, "Станция метро Новза")
    add_gen("bus_stop", pt(NOVZ, -250, 150), 4_000, "Остановка Новза")
    add_gen("hospital", pt(NOVZ, 300, -250), 6_000, "Поликлиника")
    add_gen("bazaar", pt(NOVZ, -640, -200), 22_000, "Рынок (за пределами 500 м)")
    add_comp("pharmacy", pt(NOVZ, -150, -230), "Аптека «Здоровье»")
    add_comp("pharmacy", pt(NOVZ, 350, 200), "Аптека 24")
    add_comp("pharmacy", pt(NOVZ, 600, -420), "Dori Plus (за пределами 500 м)")
    add_comp("cafe", pt(NOVZ, 100, 250), "Кафе «Уют»")
    add_clo("pharmacy", pt(NOVZ, 700, 150), "Конкуренция с сетевой аптекой напротив", 2022, "Аптека у дома (вне радиуса)")
    add_clo("coffee", pt(NOVZ, -120, 300), "Расторжение договора аренды", 2024, "Mokka Bar")
    add_rent(pt(NOVZ, 50, -60), 250_000, True, "Помещение у метро, 1-я линия")
    add_rent(pt(NOVZ, -320, 120), 270_000, False, "Помещение в жилом доме, 2-я линия")
    add_rent(pt(NOVZ, 280, 300), 290_000, False, "Помещение во дворе, 2-я линия")


def build_pockets():
    """Deliberate 'good/medium/mediocre' pockets 1-2 km away so alternatives are meaningful."""
    centres = []
    for key, plist in POCKETS.items():
        origin, cat = ANCHORS[key]
        for dx, dy, flow, n_comp, n_clo, rent, first in plist:
            c = pt(origin, dx, dy)
            centres.append(c)
            main = int(flow * 0.6)
            add_gen(rng.choice(["metro", "bazaar", "mall"]), pt(c, 60, 70), main)
            add_gen("bus_stop", pt(c, -90, -60), flow - main)
            for k in range(n_comp):
                a = 2 * math.pi * k / max(n_comp, 1) + 0.7
                add_comp(cat, pt(c, 260 * math.cos(a), 260 * math.sin(a)))
            for k in range(n_clo):
                add_clo(cat, pt(c, -280, 190))
            add_rent(pt(c, 30, 20), rent - 5_000, first, "Помещение в локации, " + ("1-я линия" if first else "2-я линия"))
            add_rent(pt(c, -100, -90), rent + 5_000, not first, "Помещение рядом, " + ("2-я линия" if first else "1-я линия"))
    return centres


def far_enough(p, pocket_centres) -> bool:
    for origin, _ in ANCHORS.values():
        if haversine_m(p[0], p[1], origin[0], origin[1]) < 620:
            return False
    return all(haversine_m(p[0], p[1], c[0], c[1]) >= 680 for c in pocket_centres)


def sprinkle_point(origin, pocket_centres):
    while True:
        r = math.sqrt(rng.uniform(0.62**2, 2.5**2)) * 1000
        a = rng.uniform(0, 2 * math.pi)
        p = pt(origin, r * math.cos(a), r * math.sin(a))
        if far_enough(p, pocket_centres):
            return p


def build_sprinkles(pocket_centres):
    for origin, _ in ANCHORS.values():
        for _ in range(30):
            typ = rng.choices(list(GEN_TYPES), weights=[2, 3, 3, 8, 4, 2, 5, 2])[0]
            lo, hi = GEN_TYPES[typ][1]
            add_gen(typ, sprinkle_point(origin, pocket_centres), round(rng.randint(lo, hi), -2))
        for cat in NAMES:
            for _ in range(26):
                add_comp(cat, sprinkle_point(origin, pocket_centres))
            for _ in range(11):
                add_clo(cat, sprinkle_point(origin, pocket_centres))
            for _ in range(2):
                add_bfs(cat, sprinkle_point(origin, pocket_centres))
        for _ in range(26):
            p = sprinkle_point(origin, pocket_centres)
            base = nearest_district_rent(p)
            add_rent(p, round(base * rng.uniform(0.8, 1.3), -4), rng.random() < 0.35)


def write_csv(name, fields, data):
    with open(DATA / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(data)


def main():
    DATA.mkdir(exist_ok=True)
    build_anchors()
    centres = build_pockets()
    build_sprinkles(centres)

    write_csv("competitors.csv", ["id", "name", "lat", "lng", "category", "source"], rows["competitors"])
    write_csv("closures.csv", ["id", "name", "lat", "lng", "category", "reason", "closed_year", "source"],
              rows["closures"])
    write_csv("traffic_generators.csv", ["id", "name", "lat", "lng", "type", "daily_flow", "source"],
              rows["traffic_generators"])
    write_csv("rent.csv", ["id", "name", "lat", "lng", "rent_per_m2_uzs", "first_line", "district", "area_m2", "source"],
              rows["rent"])
    write_csv("business_for_sale.csv", ["id", "name", "lat", "lng", "category", "price_usd", "area_m2", "source"],
              rows["business_for_sale"])
    write_csv("districts.csv", ["id", "name", "lat", "lng", "avg_rent_per_m2_uzs", "source"],
              [{"id": f"dist-{i:02d}", "name": n, "lat": la, "lng": ln, "avg_rent_per_m2_uzs": r, "source": SRC}
               for i, (n, la, ln, r) in enumerate(DISTRICTS, 1)])
    bench = [
        ("coffee", 38_000, 40, 28_000, 14, 22),
        ("fastfood", 45_000, 60, 35_000, 16, 18),
        ("cafe", 85_000, 120, 60_000, 22, 15),
        ("pharmacy", 70_000, 55, 45_000, 18, 20),
    ]
    write_csv("benchmarks.csv",
              ["category", "avg_check_uzs", "typical_area_m2", "startup_cost_usd", "payback_months", "margin_pct",
               "source"],
              [dict(zip(["category", "avg_check_uzs", "typical_area_m2", "startup_cost_usd", "payback_months",
                         "margin_pct"], b), source=SRC) for b in bench])
    for k, v in rows.items():
        print(f"{k}: {len(v)}")

    # self-check against the scoring engine
    from app.repo.memory import MemoryRepository
    from app.scoring import find_alternatives, score_point

    repo = MemoryRepository(DATA)
    expected = {"inha": 84, "chil": 39, "novz": 79}
    for key, (origin, cat) in ANCHORS.items():
        score, *_ = score_point(repo, origin[0], origin[1], cat)
        alts = find_alternatives(repo, origin[0], origin[1], cat)
        print(key, cat, score, "alts:", [(a["score"], a["distance_m"]) for a in alts])
        assert score == expected[key], f"{key}: expected {expected[key]}, got {score}"


if __name__ == "__main__":
    main()
