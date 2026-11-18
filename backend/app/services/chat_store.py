"""Persistent chat memory: sessions and analysis history per (user_id, session_id) in a small SQLite file.

No ORM; one short-lived connection per operation (so it is safe from FastAPI's thread pool) and a process-wide
lock around writes. The store knows nothing about the agent: sessions are opaque JSON blobs."""
from __future__ import annotations

import json
import logging
import sqlite3
import threading
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from ..core import config

log = logging.getLogger("pulse.chat_store")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    user_id       TEXT NOT NULL,
    session_id    TEXT NOT NULL,
    title         TEXT NOT NULL DEFAULT '',
    category      TEXT,
    state         TEXT NOT NULL DEFAULT '{}',
    history       TEXT NOT NULL DEFAULT '[]',
    last_analysis TEXT,
    last_score    INTEGER,
    last_verdict  TEXT,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    PRIMARY KEY (user_id, session_id)
);
CREATE INDEX IF NOT EXISTS sessions_user_updated ON sessions (user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS analyses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    session_id TEXT NOT NULL,
    category   TEXT NOT NULL,
    place      TEXT,
    lat        REAL NOT NULL,
    lng        REAL NOT NULL,
    score      INTEGER NOT NULL,
    verdict    TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analyses_user ON analyses (user_id, id DESC);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


class ChatStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with closing(self._connect()) as con:
            con.executescript(_SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.path, timeout=10)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA journal_mode=WAL")
        return con

    def _write(self, sql: str, params: tuple | list = ()) -> int:
        """One write statement in its own transaction; returns the affected row count."""
        with self._lock, closing(self._connect()) as con, con:
            return con.execute(sql, params).rowcount

    def _read(self, sql: str, params: tuple | list = ()) -> list[sqlite3.Row]:
        with closing(self._connect()) as con:
            return con.execute(sql, params).fetchall()

    # ------------------------------------------------------------------ sessions

    def save_session(
        self,
        user_id: str,
        session_id: str,
        *,
        title: str,
        category: str | None,
        state: dict,
        history: list[dict],
        last_analysis: dict | None,
    ) -> None:
        now = now_iso()
        self._write(
            """INSERT INTO sessions (user_id, session_id, title, category, state, history, last_analysis,
                                     last_score, last_verdict, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT (user_id, session_id) DO UPDATE SET
                 title=excluded.title, category=excluded.category, state=excluded.state,
                 history=excluded.history, last_analysis=excluded.last_analysis,
                 last_score=excluded.last_score, last_verdict=excluded.last_verdict,
                 updated_at=excluded.updated_at""",
            (
                user_id, session_id, title, category,
                json.dumps(state, ensure_ascii=False), json.dumps(history, ensure_ascii=False),
                json.dumps(last_analysis, ensure_ascii=False) if last_analysis else None,
                last_analysis["score"] if last_analysis else None,
                last_analysis["verdict"] if last_analysis else None,
                now, now,
            ),
        )

    def load_session(self, user_id: str, session_id: str) -> dict | None:
        rows = self._read("SELECT * FROM sessions WHERE user_id=? AND session_id=?", (user_id, session_id))
        if not rows:
            return None
        row = rows[0]
        return {
            "session_id": row["session_id"],
            "title": row["title"],
            "category": row["category"],
            "state": json.loads(row["state"]),
            "history": json.loads(row["history"]),
            "last_analysis": json.loads(row["last_analysis"]) if row["last_analysis"] else None,
            "last_score": row["last_score"],
            "last_verdict": row["last_verdict"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def list_chats(self, user_id: str, limit: int = 100) -> list[dict]:
        rows = self._read(
            """SELECT session_id, title, updated_at, last_score, category FROM sessions
               WHERE user_id=? ORDER BY updated_at DESC, rowid DESC LIMIT ?""",
            (user_id, limit),
        )
        return [dict(r) for r in rows]

    def delete_chat(self, user_id: str, session_id: str) -> bool:
        n = self._write("DELETE FROM sessions WHERE user_id=? AND session_id=?", (user_id, session_id))
        self._write("DELETE FROM analyses WHERE user_id=? AND session_id=?", (user_id, session_id))
        return n > 0

    # ------------------------------------------------------------------ analyses

    def add_analysis(
        self, user_id: str, session_id: str, *, category: str, place: str | None, lat: float, lng: float,
        score: int, verdict: str,
    ) -> None:
        self._write(
            """INSERT INTO analyses (user_id, session_id, category, place, lat, lng, score, verdict, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (user_id, session_id, category, place, lat, lng, score, verdict, now_iso()),
        )

    def recent_analyses(self, user_id: str, exclude_session: str | None = None, limit: int = 5) -> list[dict]:
        """Newest first, from the user's OTHER sessions; the same spot+category is reported once."""
        rows = self._read(
            "SELECT * FROM analyses WHERE user_id=? AND session_id<>? ORDER BY id DESC LIMIT 200",
            (user_id, exclude_session or ""),
        )
        out: list[dict] = []
        seen: set[tuple] = set()
        for r in rows:
            key = (r["category"], round(r["lat"], 4), round(r["lng"], 4))
            if key in seen:
                continue
            seen.add(key)
            out.append(dict(r))
            if len(out) >= limit:
                break
        return out


# --------------------------------------------------------------------------- singleton

_store: ChatStore | None = None
_store_path: Path | None = None
_failed_path: Path | None = None
_singleton_lock = threading.Lock()


def get_store() -> ChatStore | None:
    """Store for the configured CHAT_DB_PATH, or None (chats stay in memory only) if the file is unusable."""
    global _store, _store_path, _failed_path
    path = config.chat_db_path()
    with _singleton_lock:
        if _store is not None and _store_path == path:
            return _store
        if _failed_path == path:
            return None
        try:
            _store, _store_path = ChatStore(path), path
            return _store
        except (OSError, sqlite3.Error) as exc:
            log.warning("chat store unavailable at %s (%s); chats are kept in memory only", path, exc)
            _store, _failed_path = None, path
            return None


def reset_store() -> None:
    global _store, _store_path, _failed_path
    with _singleton_lock:
        _store = _store_path = _failed_path = None
