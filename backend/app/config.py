"""Environment-driven configuration. No secrets or provider names are hardcoded."""
from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
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


def fx_offline() -> bool:
    return (os.environ.get("FX_OFFLINE") or "").strip().lower() in {"1", "true", "yes"}
