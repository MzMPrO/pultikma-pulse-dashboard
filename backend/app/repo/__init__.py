"""Repository selection: PostGIS when DATABASE_URL is reachable, else in-memory CSV."""
from __future__ import annotations

import logging
import threading
import time

from .. import config
from .base import Repository
from .memory import MemoryRepository

log = logging.getLogger("pulse.repo")

_lock = threading.Lock()
_repo: Repository | None = None
_last_probe = 0.0
REPROBE_S = 30.0


def _build() -> Repository:
    url = config.database_url()
    if url:
        try:
            from .postgis import PostgisRepository

            repo = PostgisRepository(url)
            log.info("repository: postgis")
            return repo
        except Exception as exc:  # unreachable DB, tables missing, psycopg absent...
            log.warning("PostGIS unavailable (%s); using in-memory CSV repository", exc.__class__.__name__)
    return MemoryRepository(config.DATA_DIR)


def get_repo() -> Repository:
    """Return the active repo. While on the memory fallback with DATABASE_URL set,
    re-probe the database every 30 s so a later `load_data.py` is picked up."""
    global _repo, _last_probe
    with _lock:
        now = time.time()
        if _repo is None or (_repo.name == "memory" and config.database_url() and now - _last_probe > REPROBE_S):
            _repo = _build()
            _last_probe = now
        return _repo


def reset_repo(repo: Repository | None = None) -> None:
    """Testing hook."""
    global _repo, _last_probe
    _repo = repo
    _last_probe = time.time()
