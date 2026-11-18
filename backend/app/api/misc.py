"""Service endpoints: /api/health and /api/rate/usd."""
from __future__ import annotations

from fastapi import APIRouter

from ..core import config
from ..repo import get_repo
from ..services import fx, llm

router = APIRouter()


@router.get("/api/health")
def health() -> dict:
    repo = get_repo()
    return {
        "status": "ok",
        "repository": repo.name,  # "postgis" | "memory"
        "database_url_set": config.database_url() is not None,
        "llm_configured": llm.is_configured(),
        "counts": repo.counts(),
    }


@router.get("/api/rate/usd")
def rate_usd() -> dict:
    return fx.get_rate_info()
