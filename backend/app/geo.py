"""Small geodesy helpers (spherical earth, good to ~0.3% vs. the WGS84 spheroid)."""
from __future__ import annotations

import math

import numpy as np

EARTH_R = 6371008.8


def haversine_m(lat1: float, lng1: float, lat2, lng2):
    """Distance in metres from one point to scalar or numpy-array points."""
    p1 = math.radians(lat1)
    p2 = np.radians(lat2)
    dphi = p2 - p1
    dl = np.radians(lng2) - math.radians(lng1)
    a = np.sin(dphi / 2) ** 2 + math.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * EARTH_R * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def offset(lat: float, lng: float, dx_m: float, dy_m: float) -> tuple[float, float]:
    """Move a point by dx_m east and dy_m north."""
    dlat = math.degrees(dy_m / EARTH_R)
    dlng = math.degrees(dx_m / (EARTH_R * math.cos(math.radians(lat))))
    return lat + dlat, lng + dlng


def haversine_matrix(lat_a, lng_a, lat_b, lng_b):
    """Distances (m) between every point in A (n) and every point in B (m) -> (n, m)."""
    la = np.radians(np.asarray(lat_a, dtype=float))[:, None]
    lb = np.radians(np.asarray(lat_b, dtype=float))[None, :]
    dphi = lb - la
    dl = np.radians(np.asarray(lng_b, dtype=float))[None, :] - np.radians(np.asarray(lng_a, dtype=float))[:, None]
    a = np.sin(dphi / 2) ** 2 + np.cos(la) * np.cos(lb) * np.sin(dl / 2) ** 2
    return 2 * EARTH_R * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
