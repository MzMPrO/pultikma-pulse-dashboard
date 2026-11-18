"""Data model shared by every repository implementation."""
from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from ..services.geo import haversine_m, haversine_matrix

CATEGORIES = ("coffee", "fastfood", "cafe", "pharmacy")

CITY_NAMES = ("tashkent", "toshkent", "ташкент")
_OPEN_STATUSES = {"open", "active", "operating"}

_INT_COLS = {"daily_flow", "closed_year", "price_usd", "year"}
_FLOAT_COLS = {"lat", "lng", "rent_per_m2_uzs", "avg_rent_per_m2_uzs", "area_m2", "price_uzs"}
_BOOL_COLS = {"first_line"}


def _norm_name(v) -> str:
    return str(v or "").strip().lower().replace("-", "").replace(" ", "").replace("'", "")


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
    competitors: Table  # OPEN businesses only (closed ones live in `closures`)
    closures: Table
    generators: Table
    rent: Table
    districts: list[dict]  # per-district statistics; the Gemini dataset carries no coordinates
    business_for_sale: list[dict] = field(default_factory=list)
    benchmarks: list[dict] = field(default_factory=list)
    _locator: tuple | None = field(default=None, repr=False, compare=False)

    def _district_rent_by_name(self) -> dict[str, float]:
        return {
            _norm_name(r.get("district")): float(r["avg_rent_per_m2_uzs"])
            for r in self.districts
            if r.get("district") and r.get("avg_rent_per_m2_uzs")
        }

    def fallback_rent(self) -> float:
        """City-wide fallback: the city row (e.g. "Tashkent") if present, else the mean of the district rows."""
        by_name = self._district_rent_by_name()
        for key in CITY_NAMES:
            if key in by_name:
                return by_name[key]
        return float(np.mean(list(by_name.values()))) if by_name else 350_000.0

    def _locate(self) -> tuple[np.ndarray, np.ndarray, list[str]]:
        """Coordinates + district name of every located object (rent, competitors, closures, generators).
        districts.csv has no coordinates, so a point's district is the district of the NEAREST object."""
        if self._locator is None:
            lat, lng, names = [], [], []
            for t in (self.rent, self.competitors, self.closures, self.generators):
                for r in t.rows:
                    if r.get("district"):
                        lat.append(r["lat"])
                        lng.append(r["lng"])
                        names.append(_norm_name(r["district"]))
            self._locator = (np.array(lat, dtype=float), np.array(lng, dtype=float), names)
        return self._locator

    def nearest_district_name(self, lat: float, lng: float) -> str | None:
        la, ln, names = self._locate()
        if not len(names):
            return None
        return names[int(np.argmin(haversine_m(lat, lng, la, ln)))]

    def nearest_district(self, lat: float, lng: float) -> dict | None:
        """District statistics row for the district of the nearest located object, else None."""
        name = self.nearest_district_name(lat, lng)
        return next((r for r in self.districts if _norm_name(r.get("district")) == name), None) if name else None

    def district_rent_many(self, glat: np.ndarray, glng: np.ndarray) -> np.ndarray:
        """Vectorised district-average rent (UZS/m2) for many points, with the same rules as nearest_district."""
        fb = self.fallback_rent()
        la, ln, names = self._locate()
        by_name = self._district_rent_by_name()
        if not len(names) or not by_name:
            return np.full(len(glat), fb)
        per_obj = np.array([by_name.get(n, fb) for n in names])
        return per_obj[haversine_matrix(glat, glng, la, ln).argmin(axis=1)]


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


def category_variants(category: str) -> list[str]:
    """Every spelling of a canonical category found in data/DB (API 'fastfood' <-> dataset 'fast_food')."""
    return [category] + [k for k, v in _CATEGORY_ALIASES.items() if v == category]


def is_open(row: dict) -> bool:
    """competitors.csv also lists permanently closed places (status=closed_permanently); they are NOT competitors
    (they are counted through closures.csv instead). Rows without a status are treated as open."""
    st = row.get("status")
    return st is None or str(st).strip().lower() in _OPEN_STATUSES


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
    """Rows coming from the database: same aliasing/coercion as the CSV reader."""
    return [{k: _coerce(k, v) for k, v in _normalize(dict(rec)).items()} for rec in records]


def load_dataset_from_csv(data_dir: Path) -> Dataset:
    def rd(name: str) -> list[dict]:
        p = data_dir / name
        return read_csv_rows(p) if p.exists() else []

    osm = data_dir / "traffic_generators_osm.csv"
    gens = read_csv_rows(osm) if osm.exists() else rd("traffic_generators.csv")
    return Dataset(
        competitors=Table([r for r in rd("competitors.csv") if is_open(r)]),
        closures=Table(rd("closures.csv")),
        generators=Table(gens),
        rent=Table(rd("rent.csv")),
        districts=rd("districts.csv"),
        business_for_sale=rd("business_for_sale.csv"),
        benchmarks=rd("benchmarks.csv"),
    )
