"""FastAPI app: /api/analyze, /api/chat, /api/rate/usd, /api/health."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import agent, config, fx, llm, scoring
from .models import AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse
from .repo import get_repo

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(_: FastAPI):
    get_repo()  # pick PostGIS or CSV once at startup
    threading.Thread(target=fx.get_rate_info, daemon=True).start()  # warm the USD/UZS cache
    yield


app = FastAPI(title="PulTikma AI backend", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health() -> dict:
    repo = get_repo()
    return {
        "status": "ok",
        "repository": repo.name,  # "postgis" | "memory"
        "database_url_set": config.database_url() is not None,
        "llm_configured": llm.is_configured(),
        "counts": repo.counts(),
    }


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> dict:
    return scoring.analyze(req.lat, req.lng, req.category, req.format, req.avg_check, req.audience, req.budget)


@app.post("/api/chat", response_model=ChatResponse, response_model_exclude_unset=True)
def chat(req: ChatRequest) -> dict:
    return agent.handle_chat(req.session_id, req.message, req.lat, req.lng)


@app.get("/api/rate/usd")
def rate_usd() -> dict:
    return fx.get_rate_info()
