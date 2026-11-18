"""The real Gemini dataset in backend/data: column mapping, status handling, district rent fallback."""
import csv

import numpy as np

from app import config
from app.repo import get_repo
from app.repo.base import category_variants, is_open, load_dataset_from_csv, rows_from_records


def test_dataset_loaded_and_normalised():
    repo = get_repo()
    assert repo.name == "memory"
    ds = repo.dataset()
    assert repo.counts() == {"competitors": 43, "closures": 25, "traffic_generators": 52, "rent": 32, "districts": 3}
    # dataset spells it fast_food, the API/frontend say fastfood
    assert {r["category"] for r in ds.competitors.rows} == {"coffee", "fastfood", "cafe", "pharmacy"}
    assert {r["category"] for r in ds.closures.rows} == {"coffee", "fastfood", "cafe", "pharmacy"}
    # est_daily_people / price_per_m2_uzs / closure_reason are mapped
    assert all(isinstance(g["daily_flow"], int) for g in ds.generators.rows)
    assert all(isinstance(r["rent_per_m2_uzs"], float) and isinstance(r["first_line"], bool) for r in ds.rent.rows)
    assert all(r["reason"] for r in ds.closures.rows)
    assert all(r["source"] for t in (ds.competitors, ds.closures, ds.generators, ds.rent) for r in t.rows)


def test_closed_permanently_competitors_are_not_competitors():
    with open(config.DATA_DIR / "competitors.csv", encoding="utf-8") as f:
        raw = list(csv.DictReader(f))
    n_open = sum(1 for r in raw if r["status"] == "open")
    assert n_open < len(raw)
    assert len(get_repo().dataset().competitors) == n_open
    assert is_open({"status": "open"}) and is_open({}) and not is_open({"status": "closed_permanently"})


def test_district_rent_fallback_by_district_name():
    ds = get_repo().dataset()
    assert ds.fallback_rent() == 235_000  # the city-wide "Tashkent" row, not the mean of the two districts
    assert ds.nearest_district(41.3378, 69.3338)["district"] == "Mirzo-Ulugbek"
    assert ds.nearest_district(41.2738, 69.2052)["district"] == "Chilonzor"
    # vectorised and per-point lookups agree
    lat = np.array([41.3378, 41.2738, 41.30])
    lng = np.array([69.3338, 69.2052, 69.25])
    many = ds.district_rent_many(lat, lng)
    for i in range(3):
        assert many[i] == ds.nearest_district(lat[i], lng[i])["avg_rent_per_m2_uzs"]
    assert many[0] == 205_000 and many[1] == 245_000


def test_rent_falls_back_to_district_average_without_rent_objects(client):
    # far from every rent object (>500 m) but nearest object is in Mirzo-Ulugbek -> its district average
    body = client.post("/api/analyze", json={"lat": 41.3040, "lng": 69.3260, "category": "coffee"}).json()
    assert body["kpi"]["rent_per_m2_uzs"] in (205_000, 245_000)
    assert body["factors"]["rent"] > 0


def test_database_rows_use_same_mapping_as_csv():
    """PostGIS rows come with dataset column/category names; they must be normalised like the CSV rows."""
    rows = rows_from_records([{"id": "TG1", "est_daily_people": 100, "category": "fast_food", "closure_reason": "x",
                               "price_per_m2_uzs": 123000, "first_line": True, "lat": "41.3", "lng": "69.2"}])
    r = rows[0]
    assert r["daily_flow"] == 100 and r["category"] == "fastfood" and r["reason"] == "x"
    assert r["rent_per_m2_uzs"] == 123000.0 and r["lat"] == 41.3
    assert set(category_variants("fastfood")) == {"fastfood", "fast_food", "fast-food"}


def test_load_dataset_from_csv_matches_repo():
    ds = load_dataset_from_csv(config.DATA_DIR)
    assert len(ds.competitors) == 43 and len(ds.districts) == 3 and len(ds.benchmarks) > 10
