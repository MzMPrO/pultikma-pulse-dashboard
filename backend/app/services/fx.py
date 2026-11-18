"""USD/UZS from the Central Bank of Uzbekistan, cached for 24 h with a safe fallback."""
from __future__ import annotations

import threading
import time

import httpx

from ..core import config

CBU_URL = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/"
TTL_S = 24 * 3600
RETRY_AFTER_FAIL_S = 300  # do not hammer a dead endpoint on every request

_lock = threading.Lock()
_state: dict = {"rate": None, "date": None, "fetched_at": 0.0, "failed_at": 0.0}


def _fetch() -> tuple[float, str | None]:
    r = httpx.get(CBU_URL, timeout=2.0, headers={"Accept": "application/json"})
    r.raise_for_status()
    data = r.json()
    return float(data[0]["Rate"]), data[0].get("Date")


def get_rate_info() -> dict:
    """{rate, date, cached}. cached=True when not freshly fetched from CBU on this call."""
    with _lock:
        now = time.time()
        if _state["rate"] is not None and now - _state["fetched_at"] < TTL_S:
            return {"rate": _state["rate"], "date": _state["date"], "cached": True}
        skip = config.fx_offline() or now - _state["failed_at"] < RETRY_AFTER_FAIL_S
        if not skip:
            try:
                rate, date = _fetch()
                _state.update(rate=rate, date=date, fetched_at=now)
                return {"rate": rate, "date": date, "cached": False}
            except Exception:
                _state["failed_at"] = now
        if _state["rate"] is not None:  # stale but real
            return {"rate": _state["rate"], "date": _state["date"], "cached": True}
        return {"rate": config.DEFAULT_USD_UZS, "date": None, "cached": False}


def get_usd_rate() -> float:
    return float(get_rate_info()["rate"])


def reset() -> None:
    """Testing hook."""
    _state.update(rate=None, date=None, fetched_at=0.0, failed_at=0.0)
