"""
PulTikma AI — реальные данные из открытых API.
1) Курс USD/UZS — официальный JSON API Центрального банка (cbu.uz), без ключа.
2) Генераторы трафика — OpenStreetMap через Overpass API, без ключа (лицензия ODbL,
   в интерфейсе указать "© OpenStreetMap contributors").

Запуск:  pip install httpx
         python backend/scripts/live_data.py   -> пишет backend/data/traffic_generators_osm.csv и печатает курс
"""
import csv
from pathlib import Path

import httpx

OUT_FILE = Path(__file__).resolve().parent.parent / "data" / "traffic_generators_osm.csv"

CBU_URL = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Две демо-зоны: (south, west, north, east)
ZONES = {
    "Mirzo-Ulugbek": (41.318, 69.318, 41.352, 69.356),  # вокруг Inha
    "Chilonzor": (41.265, 69.190, 41.298, 69.230),       # метро Чиланзар / Новза / Мирзо Улугбек
}

# Оценка потока людей в день по типу объекта (estimated, объясняем менторам как допущение)
DAILY_PEOPLE = {
    "university": 4000, "school": 1500, "metro": 25000, "bus_stop": 3000,
    "market": 8000, "mall": 6000, "office_center": 2500, "hospital": 2000,
}


def get_usd_rate() -> float:
    """Официальный курс ЦБ на сегодня. Кэшируйте результат на день в своей БД."""
    r = httpx.get(CBU_URL, timeout=15)
    r.raise_for_status()
    data = r.json()  # список; поле "Rate" — строка вида "11974.02"
    return float(data[0]["Rate"])


def overpass_query(s, w, n, e) -> str:
    bbox = f"{s},{w},{n},{e}"
    return f"""
[out:json][timeout:60];
(
  nwr["amenity"="university"]({bbox});
  nwr["amenity"="college"]({bbox});
  nwr["amenity"="school"]({bbox});
  nwr["station"="subway"]({bbox});
  nwr["railway"="station"]["subway"="yes"]({bbox});
  node["highway"="bus_stop"]({bbox});
  nwr["amenity"="marketplace"]({bbox});
  nwr["shop"="mall"]({bbox});
  nwr["office"]({bbox});
  nwr["amenity"="hospital"]({bbox});
  nwr["amenity"="clinic"]({bbox});
);
out center tags;
"""


def classify(tags: dict) -> str | None:
    a = tags.get("amenity")
    if a in ("university", "college"):
        return "university"
    if a == "school":
        return "school"
    if tags.get("station") == "subway" or tags.get("subway") == "yes":
        return "metro"
    if tags.get("highway") == "bus_stop":
        return "bus_stop"
    if a == "marketplace":
        return "market"
    if tags.get("shop") == "mall":
        return "mall"
    if "office" in tags:
        return "office_center"
    if a in ("hospital", "clinic"):
        return "hospital"
    return None


def fetch_traffic_generators() -> list[dict]:
    rows, i = [], 1
    with httpx.Client(timeout=90) as client:
        for district, bbox in ZONES.items():
            r = client.post(OVERPASS_URL, data={"data": overpass_query(*bbox)})
            r.raise_for_status()
            for el in r.json()["elements"]:
                tags = el.get("tags", {})
                t = classify(tags)
                if not t:
                    continue
                lat = el.get("lat") or el.get("center", {}).get("lat")
                lng = el.get("lon") or el.get("center", {}).get("lon")
                if lat is None:
                    continue
                name = tags.get("name:uz") or tags.get("name") or tags.get("name:ru") or t
                rows.append({
                    "id": f"OSM{i:04d}", "name": name, "type": t, "district": district,
                    "lat": round(lat, 6), "lng": round(lng, 6),
                    "est_daily_people": DAILY_PEOPLE[t],
                    "source": "real",  # координаты и тип — реальные (OSM); поток — оценка
                    "source_url": f"https://www.openstreetmap.org/{el['type']}/{el['id']}",
                })
                i += 1
    return rows


if __name__ == "__main__":
    print("USD/UZS (cbu.uz):", get_usd_rate())
    tg = fetch_traffic_generators()
    with open(OUT_FILE, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(tg[0].keys()))
        w.writeheader()
        w.writerows(tg)
    print(f"{OUT_FILE}: {len(tg)} objects")
