"""PostGIS repository. Radius queries use ST_DWithin(geom::geography, point, r).

The full tables are also pulled once into numpy (cached for a few minutes) so the
alternatives grid search stays well under a second.
"""
from __future__ import annotations

import time

from ..geo import haversine_m
from .base import Dataset, Nearby, Repository, Table, category_variants, is_open, rows_from_records

_POINT = "ST_SetSRID(ST_MakePoint(%(lng)s, %(lat)s), 4326)::geography"
_DW = f"ST_DWithin(geom::geography, {_POINT}, %(r)s)"



def _strip(rows: list[dict]) -> list[dict]:
    """Drop the geometry column (not JSON friendly) and coerce types like the CSV loader."""
    return rows_from_records([{k: v for k, v in r.items() if k != "geom"} for r in rows])


class PostgisRepository(Repository):
    name = "postgis"
    CACHE_TTL_S = 300

    def __init__(self, url: str):
        import psycopg
        from psycopg.rows import dict_row

        self._psycopg = psycopg
        self._dict_row = dict_row
        self.url = url
        self._ds: Dataset | None = None
        self._ds_at = 0.0
        self.probe()

    def _connect(self):
        return self._psycopg.connect(self.url, row_factory=self._dict_row, connect_timeout=3)

    def probe(self) -> None:
        """Raise if the DB is unreachable or not loaded yet."""
        with self._connect() as conn:
            conn.execute("SELECT 1 FROM competitors LIMIT 1")
            conn.execute("SELECT PostGIS_Version()")

    def _query(self, sql: str, params: dict | None = None) -> list[dict]:
        with self._connect() as conn:
            return list(conn.execute(sql, params or {}).fetchall())

    def dataset(self) -> Dataset:
        if self._ds is None or time.time() - self._ds_at > self.CACHE_TTL_S:

            def q(table: str) -> list[dict]:
                return _strip(self._query(f"SELECT * FROM {table}"))

            self._ds = Dataset(
                competitors=Table([r for r in q("competitors") if is_open(r)]),
                closures=Table(q("closures")),
                generators=Table(q("traffic_generators")),
                rent=Table(q("rent")),
                districts=q("districts"),
            )
            self._ds_at = time.time()
        return self._ds

    def _within(self, table: str, lat: float, lng: float, r: float, category: str | None = None) -> list[dict]:
        sql = f"SELECT * FROM {table} WHERE {_DW}"
        params: dict = {"lat": lat, "lng": lng, "r": r}
        if category is not None:
            sql += " AND category = ANY(%(cats)s)"  # DB stores 'fast_food', the API says 'fastfood'
            params["cats"] = category_variants(category)
        rows = _strip(self._query(sql, params))
        if table == "competitors":
            rows = [r for r in rows if is_open(r)]  # closed_permanently rows are not competitors
        for row in rows:
            row["dist_m"] = float(haversine_m(lat, lng, row["lat"], row["lng"]))
        return rows

    def nearby(self, lat: float, lng: float, category: str, radius_m: float) -> Nearby:
        return Nearby(
            competitors=self._within("competitors", lat, lng, radius_m, category),
            closures=self._within("closures", lat, lng, radius_m, category),
            generators=self._within("traffic_generators", lat, lng, radius_m),
            rents=self._within("rent", lat, lng, radius_m),
            district=self.dataset().nearest_district(lat, lng),
        )
