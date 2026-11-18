"""In-memory repository: reads the CSVs and answers with haversine."""
from __future__ import annotations

from pathlib import Path

from .base import Dataset, Nearby, Repository, load_dataset_from_csv


class MemoryRepository(Repository):
    name = "memory"

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self._ds: Dataset = load_dataset_from_csv(data_dir)

    def dataset(self) -> Dataset:
        return self._ds

    def nearby(self, lat: float, lng: float, category: str, radius_m: float) -> Nearby:
        ds = self._ds
        return Nearby(
            competitors=ds.competitors.by_category(category).within(lat, lng, radius_m),
            closures=ds.closures.by_category(category).within(lat, lng, radius_m),
            generators=ds.generators.within(lat, lng, radius_m),
            rents=ds.rent.within(lat, lng, radius_m),
            district=ds.nearest_district(lat, lng),
        )
