"""Seed-dependent expectations. When the real CSVs replace the synthetic seed, re-check the three anchors
(see docs/DECISIONS.md, section Backend)."""
import pytest

from app import config, scoring
from app.geo import haversine_m
from app.repo import get_repo

ANCHORS = [
    ("Inha coffee", 41.3378, 69.3338, "coffee", 84, "go"),
    ("Chilanzar fastfood", 41.2738, 69.2052, "fastfood", 39, "no"),
    ("Novza pharmacy", 41.2912, 69.2210, "pharmacy", 79, "go"),
]


@pytest.mark.parametrize("name,lat,lng,cat,score,verdict", ANCHORS)
def test_anchor_scores_via_api(client, name, lat, lng, cat, score, verdict):
    r = client.post("/api/analyze", json={"lat": lat, "lng": lng, "category": cat})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["score"] == score, name
    assert body["verdict"] == verdict
    assert body["location"] == {"lat": lat, "lng": lng, "radius_m": 500}
    assert set(body["factors"]) == {"traffic", "competition", "closures", "rent", "visibility"}
    assert set(body["kpi"]) == {"competitors", "closures", "traffic_per_day", "rent_per_m2_uzs", "rent_per_m2_usd", "usd_rate"}
    assert body["kpi"]["competitors"] == len(body["competitors"])
    assert body["kpi"]["closures"] == len(body["closed"])
    assert body["kpi"]["traffic_per_day"] == sum(g["daily_flow"] for g in body["traffic_generators"])
    assert len(body["alternatives"]) == 3
    assert body["explanation"] and body["verdict_text"]


def test_chilanzar_details(client):
    body = client.post("/api/analyze", json={"lat": 41.2738, "lng": 69.2052, "category": "fastfood"}).json()
    assert body["kpi"]["closures"] == 4 and body["kpi"]["competitors"] == 3
    assert body["kpi"]["traffic_per_day"] > 30_000
    assert body["factors"]["visibility"] == 0 and body["factors"]["closures"] == 0
    assert all(c["reason"] for c in body["closed"])


def test_vectorised_grid_matches_point_scoring():
    """The numpy grid scorer and the per-point (radius query) scorer must agree."""
    repo = get_repo()
    ds = repo.dataset()
    for lat, lng, cat in [(41.3378, 69.3338, "coffee"), (41.2738, 69.2052, "fastfood"), (41.30, 69.25, "cafe")]:
        glat, glng = scoring._grid(lat, lng)
        _, raw = scoring._score_many(ds, cat, glat, glng)
        scores = scoring.to_int_score(raw)
        for i in range(0, len(glat), 23):
            s, *_ = scoring.score_point(repo, float(glat[i]), float(glng[i]), cat)
            assert s == int(scores[i])


def test_alternatives_spacing_and_origin_exclusion():
    repo = get_repo()
    for lat, lng, cat in [(41.3378, 69.3338, "coffee"), (41.2738, 69.2052, "fastfood"), (41.2912, 69.2210, "pharmacy")]:
        alts = scoring.find_alternatives(repo, lat, lng, cat)
        assert [a["rank"] for a in alts] == [1, 2, 3]
        for a in alts:
            assert haversine_m(lat, lng, a["lat"], a["lng"]) >= config.ALT_MIN_FROM_ORIGIN_M - 1
            assert a["distance_m"] <= config.ALT_RADIUS_M + 50
        for i in range(3):
            for j in range(i + 1, 3):
                d = haversine_m(alts[i]["lat"], alts[i]["lng"], alts[j]["lat"], alts[j]["lng"])
                assert d >= config.ALT_MIN_BETWEEN_M - 1
        assert alts == sorted(alts, key=lambda a: -a["score"])


def test_alternatives_fast(client):
    import time

    t = time.perf_counter()
    r = client.post("/api/analyze", json={"lat": 41.3, "lng": 69.27, "category": "cafe"})
    assert r.status_code == 200
    assert time.perf_counter() - t < 2.0


def test_no_data_area_still_works(client):
    r = client.post("/api/analyze", json={"lat": 41.5, "lng": 69.9, "category": "coffee"})
    assert r.status_code == 200
    body = r.json()
    assert body["kpi"]["competitors"] == 0 and body["kpi"]["rent_per_m2_uzs"] > 0


def test_validation(client):
    assert client.post("/api/analyze", json={"lat": 41.3, "lng": 69.2, "category": "bank"}).status_code == 422
