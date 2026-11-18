"""Data model shared by every repository implementation."""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from ..geo import haversine_m

CATEGORIES = ("coffee", "fastfood", "cafe", "pharmacy")

_INT_COLS = {"daily_flow", "closed_year", "price_usd", "year"}
_FLOAT_COLS = {"lat", "lng", "rent_per_m2_uzs", "avg_rent_per_m2_uzs", "area_m2", "price_uzs"}
_BOOL_COLS = {"first_line"}


def _parse_bool(v: str) -> bool:
    return str(v).strip().lower() in {"1", "true", "t", "yes", "y", "да"}


def _coerce(col: str, v: Any):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        if v == "":
            return None
    if col in _BOOL_COLS:
        return v if isinstance(v, bool) else _parse_bool(v)
    if col in _INT_COLS:
        return int(float(v))
    if col in _FLOAT_COLS:
        return float(v)
    return v


class Table:
    """List of dict rows with cached numpy coordinate arrays."""

    def __init__(self, rows: list[dict]):
        # rows without coordinates (e.g. districts that only carry an average rent) cannot be located
        rows = [r for r in rows if r.get("lat") is not None and r.get("lng") is not None]
        self.rows = rows
        self.lat = np.array([r["lat"] for r in rows], dtype=float)
        self.lng = np.array([r["lng"] for r in rows], dtype=float)
        self._cat_cache: dict[str, "Table"] = {}

    def __len__(self) -> int:
        return len(self.rows)

    def col(self, name: str, default: float = 0.0) -> np.ndarray:
        return np.array([(r.get(name) if r.get(name) is not None else default) for r in self.rows], dtype=float)

    def by_category(self, category: str) -> "Table":
        if category not in self._cat_cache:
            self._cat_cache[category] = Table([r for r in self.rows if r.get("category") == category])
        return self._cat_cache[category]

    def within(self, lat: float, lng: float, radius_m: float) -> list[dict]:
        if not len(self.rows):
            return []
        d = haversine_m(lat, lng, self.lat, self.lng)
        return [dict(self.rows[i], dist_m=float(d[i])) for i in np.nonzero(d <= radius_m)[0]]


@dataclass
class Dataset:
    competitors: Table
    closures: Table
    generators: Table
    rent: Table
    districts: Table
    business_for_sale: list[dict] = field(default_factory=list)
    benchmarks: list[dict] = field(default_factory=list)

    def nearest_district(self, lat: float, lng: float) -> dict | None:
        if not len(self.districts):
            return None
        d = haversine_m(lat, lng, self.districts.lat, self.districts.lng)
        return self.districts.rows[int(np.argmin(d))]

    def fallback_rent(self) -> float:
        vals = [r["avg_rent_per_m2_uzs"] for r in self.districts.rows if r.get("avg_rent_per_m2_uzs")]
        return float(np.mean(vals)) if vals else 350_000.0


@dataclass
class Nearby:
    """Everything within the scoring radius of one point (category-filtered where relevant)."""

    competitors: list[dict]
    closures: list[dict]
    generators: list[dict]
    rents: list[dict]
    district: dict | None


class Repository:
    name = "base"

    def dataset(self) -> Dataset:  # pragma: no cover - interface
        raise NotImplementedError

    def nearby(self, lat: float, lng: float, category: str, radius_m: float) -> Nearby:  # pragma: no cover
        raise NotImplementedError

    def counts(self) -> dict[str, int]:
        ds = self.dataset()
        return {
            "competitors": len(ds.competitors),
            "closures": len(ds.closures),
            "traffic_generators": len(ds.generators),
            "rent": len(ds.rent),
            "districts": len(ds.districts),
        }


# Column aliases so the Gemini/OSM CSV variants load without edits (target column -> accepted source columns).
_ALIASES = {
    "daily_flow": ("est_daily_people",),
    "reason": ("closure_reason",),
    "rent_per_m2_uzs": ("price_per_m2_uzs",),
    "name": ("title", "street"),
}
_CATEGORY_ALIASES = {"fast_food": "fastfood", "fast-food": "fastfood", "coffee_shop": "coffee", "cafe_restaurant": "cafe"}


def _normalize(row: dict) -> dict:
    for target, sources in _ALIASES.items():
        if row.get(target) in (None, ""):
            for s in sources:
                if row.get(s) not in (None, ""):
                    row[target] = row[s]
                    break
    if isinstance(row.get("category"), str):
        c = row["category"].strip().lower()
        row["category"] = _CATEGORY_ALIASES.get(c, c)
    return row


def read_csv_rows(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = [_normalize({k.strip(): v for k, v in row.items() if k}) for row in csv.DictReader(f)]
    return [{k: _coerce(k, v) for k, v in row.items()} for row in rows]


def rows_from_records(records: list[dict]) -> list[dict]:
    return [{k: _coerce(k, v) for k, v in rec.items()} for rec in records]


def load_dataset_from_csv(data_dir: Path) -> Dataset:
    def rd(name: str) -> list[dict]:
        p = data_dir / name
        return read_csv_rows(p) if p.exists() else []

    osm = data_dir / "traffic_generators_osm.csv"
    gens = read_csv_rows(osm) if osm.exists() else rd("traffic_generators.csv")
    return Dataset(
        competitors=Table(rd("competitors.csv")),
        closures=Table(rd("closures.csv")),
        generators=Table(gens),
        rent=Table(rd("rent.csv")),
        districts=Table(rd("districts.csv")),
        business_for_sale=rd("business_for_sale.csv"),
        benchmarks=rd("benchmarks.csv"),
    )
