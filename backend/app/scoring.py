"""Deterministic location scoring (no LLM involved).

score = round(100 * (0.25*traffic + 0.25*competition + 0.25*closures + 0.10*rent + 0.15*visibility))
"""
from __future__ import annotations

import math

import numpy as np

from . import config, fx, texts
from .geo import haversine_m, haversine_matrix, offset
from .repo import get_repo
from .repo.base import Dataset, Nearby, Repository

TRAFFIC_CAP = 30_000.0
COMPETITOR_CAP = 5.0
CLOSURE_CAP = 4.0
RENT_HIGH = 350_000.0
RENT_SPAN = 200_000.0
WEIGHTS = {"traffic": 0.25, "competition": 0.25, "closures": 0.25, "rent": 0.10, "visibility": 0.15}


def factor_values(traffic_500, n_competitors, n_closures, avg_rent, visible) -> dict:
    """Works for scalars and numpy arrays alike. Each factor is in [0, 1]."""
    traffic_500 = np.asarray(traffic_500, dtype=float)
    return {
        "traffic": np.minimum(traffic_500 / TRAFFIC_CAP, 1.0),
        "competition": np.maximum(0.0, 1.0 - np.asarray(n_competitors, dtype=float) / COMPETITOR_CAP),
        "closures": np.maximum(0.0, 1.0 - np.asarray(n_closures, dtype=float) / CLOSURE_CAP),
        "rent": np.clip((RENT_HIGH - np.asarray(avg_rent, dtype=float)) / RENT_SPAN, 0.0, 1.0),
        "visibility": np.asarray(visible, dtype=float),
    }


def raw_score(f: dict):
    return sum(WEIGHTS[k] * f[k] for k in WEIGHTS)


def to_int_score(raw) -> np.ndarray | int:
    out = np.floor(100.0 * np.asarray(raw, dtype=float) + 0.5 + 1e-9).astype(int)
    return int(out) if out.ndim == 0 else out


def verdict_for(score: int) -> str:
    if score > 70:
        return "go"
    if score >= 50:
        return "change"
    return "no"


def _round_factors(f: dict, idx: int | None = None) -> dict:
    return {k: round(float(v if idx is None else v[idx]), 3) for k, v in f.items()}


def _avg_rent_nearby(nb: Nearby, repo: Repository) -> float:
    if nb.rents:
        return float(np.mean([r["rent_per_m2_uzs"] for r in nb.rents]))
    if nb.district and nb.district.get("avg_rent_per_m2_uzs"):
        return float(nb.district["avg_rent_per_m2_uzs"])
    return repo.dataset().fallback_rent()


def score_point(repo: Repository, lat: float, lng: float, category: str) -> tuple[int, dict, Nearby, float]:
    """Score one point using the repository's radius query. Returns (score, factors, nearby, avg_rent)."""
    nb = repo.nearby(lat, lng, category, config.RADIUS_M)
    traffic = sum(g.get("daily_flow") or 0 for g in nb.generators)
    avg_rent = _avg_rent_nearby(nb, repo)
    nearest = min(nb.rents, key=lambda r: r["dist_m"]) if nb.rents else None
    visible = 1.0 if nearest and nearest.get("first_line") else 0.0
    f = factor_values(traffic, len(nb.competitors), len(nb.closures), avg_rent, visible)
    return to_int_score(raw_score(f)), f, nb, avg_rent


# ---------------------------------------------------------------- alternatives


def _grid(lat: float, lng: float) -> tuple[np.ndarray, np.ndarray]:
    step, rad = config.ALT_STEP_M, config.ALT_RADIUS_M
    n = int(rad // step)
    pts = []
    for i in range(-n, n + 1):
        for j in range(-n, n + 1):
            if math.hypot(i * step, j * step) <= rad:
                pts.append(offset(lat, lng, i * step, j * step))
    arr = np.array(pts)
    return arr[:, 0], arr[:, 1]


def _score_many(ds: Dataset, category: str, glat: np.ndarray, glng: np.ndarray) -> tuple[dict, np.ndarray]:
    """Vectorised version of score_point over many points (same maths)."""
    r = config.RADIUS_M
    n = len(glat)
    comp = ds.competitors.by_category(category)
    clos = ds.closures.by_category(category)
    gens, rent, dist = ds.generators, ds.rent, ds.districts

    traffic = np.zeros(n)
    if len(gens):
        traffic = (haversine_matrix(glat, glng, gens.lat, gens.lng) <= r) @ gens.col("daily_flow")
    n_comp = (haversine_matrix(glat, glng, comp.lat, comp.lng) <= r).sum(axis=1) if len(comp) else np.zeros(n)
    n_clos = (haversine_matrix(glat, glng, clos.lat, clos.lng) <= r).sum(axis=1) if len(clos) else np.zeros(n)

    district_rent = np.full(n, ds.fallback_rent())
    if len(dist):
        nearest_d = haversine_matrix(glat, glng, dist.lat, dist.lng).argmin(axis=1)
        district_rent = dist.col("avg_rent_per_m2_uzs", ds.fallback_rent())[nearest_d]

    avg_rent = district_rent
    visible = np.zeros(n)
    if len(rent):
        d = haversine_matrix(glat, glng, rent.lat, rent.lng)
        inside = d <= r
        cnt = inside.sum(axis=1)
        sums = inside @ rent.col("rent_per_m2_uzs")
        avg_rent = np.where(cnt > 0, sums / np.maximum(cnt, 1), district_rent)
        nearest = d.argmin(axis=1)
        first = np.array([bool(x.get("first_line")) for x in rent.rows])
        visible = ((d[np.arange(n), nearest] <= r) & first[nearest]).astype(float)

    f = factor_values(traffic, n_comp, n_clos, avg_rent, visible)
    return f, raw_score(f)


def find_alternatives(repo: Repository, lat: float, lng: float, category: str, k: int = 3) -> list[dict]:
    ds = repo.dataset()
    glat, glng = _grid(lat, lng)
    f, raw = _score_many(ds, category, glat, glng)
    d_origin = haversine_m(lat, lng, glat, glng)
    scores = to_int_score(raw)
    order = sorted(
        (i for i in range(len(glat)) if d_origin[i] >= config.ALT_MIN_FROM_ORIGIN_M),
        key=lambda i: (-float(raw[i]), float(d_origin[i])),
    )
    chosen: list[int] = []
    for i in order:
        if all(float(haversine_m(glat[i], glng[i], glat[j], glng[j])) >= config.ALT_MIN_BETWEEN_M for j in chosen):
            chosen.append(i)
            if len(chosen) == k:
                break
    return [
        {
            "rank": rank,
            "lat": round(float(glat[i]), 6),
            "lng": round(float(glng[i]), 6),
            "score": int(scores[i]),
            "factors": _round_factors(f, i),
            "distance_m": int(round(float(d_origin[i]))),
        }
        for rank, i in enumerate(chosen, start=1)
    ]


# ---------------------------------------------------------------- full analysis


def _clean(row: dict, keys: tuple[str, ...]) -> dict:
    return {k: row.get(k) for k in keys}


def analyze(
    lat: float,
    lng: float,
    category: str,
    format: str | None = None,
    avg_check: float | None = None,
    audience: str | None = None,
    budget: float | None = None,
) -> dict:
    repo = get_repo()
    score, f, nb, avg_rent = score_point(repo, lat, lng, category)
    verdict = verdict_for(score)
    traffic = int(sum(g.get("daily_flow") or 0 for g in nb.generators))
    usd_rate = fx.get_usd_rate()
    rent_uzs = int(round(avg_rent))
    kpi = {
        "competitors": len(nb.competitors),
        "closures": len(nb.closures),
        "traffic_per_day": traffic,
        "rent_per_m2_uzs": rent_uzs,
        "rent_per_m2_usd": round(rent_uzs / usd_rate, 2) if usd_rate else None,
        "usd_rate": round(usd_rate, 2) if usd_rate else None,
    }
    alternatives = find_alternatives(repo, lat, lng, category)
    nearest = min(nb.rents, key=lambda r: r["dist_m"]) if nb.rents else None
    ctx = {
        "category": category,
        "score": score,
        "verdict": verdict,
        "kpi": kpi,
        "first_line": bool(nearest and nearest.get("first_line")),
        "has_rent_objects": bool(nb.rents),
        "closures": nb.closures,
        "alternatives": alternatives,
        "format": format,
    }
    return {
        "score": score,
        "verdict": verdict,
        "verdict_text": texts.verdict_text(verdict),
        "factors": _round_factors(f),
        "kpi": kpi,
        "location": {"lat": lat, "lng": lng, "radius_m": config.RADIUS_M},
        "competitors": [_clean(r, ("id", "name", "lat", "lng", "category", "source")) for r in nb.competitors],
        "closed": [
            _clean(r, ("id", "name", "lat", "lng", "category", "reason", "closed_year", "source")) for r in nb.closures
        ],
        "traffic_generators": [
            _clean(r, ("id", "name", "lat", "lng", "type", "daily_flow", "source")) for r in nb.generators
        ],
        "alternatives": alternatives,
        "explanation": texts.explanation(ctx),
    }
