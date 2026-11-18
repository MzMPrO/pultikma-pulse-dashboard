"""Environment-driven configuration. No secrets or provider names are hardcoded."""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader; real environment variables win."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv(BACKEND_DIR / ".env")
DATA_DIR = Path(os.environ.get("DATA_DIR") or (BACKEND_DIR / "data"))

RADIUS_M = 500
ALT_RADIUS_M = 2500
ALT_STEP_M = 250
ALT_MIN_FROM_ORIGIN_M = 400
ALT_MIN_BETWEEN_M = 400
DEFAULT_USD_UZS = 12800.0


def database_url() -> str | None:
    return (os.environ.get("DATABASE_URL") or "").strip() or None


def llm_settings() -> tuple[str, str, str] | None:
    base = (os.environ.get("LLM_BASE_URL") or "").strip().rstrip("/")
    key = (os.environ.get("LLM_API_KEY") or "").strip()
    model = (os.environ.get("LLM_MODEL") or "").strip()
    if base and key and model:
        return base, key, model
    return None


def chat_db_path() -> Path:
    """SQLite file with persistent chats (directory is created on first use)."""
    raw = (os.environ.get("CHAT_DB_PATH") or "").strip()
    return Path(raw) if raw else BACKEND_DIR / "var" / "chat.db"


def fx_offline() -> bool:
    return (os.environ.get("FX_OFFLINE") or "").strip().lower() in {"1", "true", "yes"}
