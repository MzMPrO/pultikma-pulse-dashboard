"""FastAPI app: /api/analyze, /api/chat, /api/chats, /api/rate/usd, /api/health."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import agent, chat_store, config, fx, llm, scoring
from .models import AnalyzeRequest, AnalyzeResponse, ChatDetail, ChatRequest, ChatResponse, ChatSummary
from .repo import get_repo

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(_: FastAPI):
    get_repo()  # pick PostGIS or CSV once at startup
    chat_store.get_store()  # create/open the chat memory file (logs and degrades to memory-only on failure)
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
    user_id = (req.user_id or "").strip() or None
    return agent.handle_chat(req.session_id, req.message, req.lat, req.lng, user_id)


UserId = Query(min_length=1, max_length=128)


def _uid(user_id: str) -> str:
    uid = user_id.strip()
    if not uid:
        raise HTTPException(422, "user_id is empty")
    return uid


def _store() -> chat_store.ChatStore:
    store = chat_store.get_store()
    if store is None:
        raise HTTPException(503, "chat storage is unavailable")
    return store


@app.get("/api/chats", response_model=list[ChatSummary])
def list_chats(user_id: str = UserId) -> list[dict]:
    return _store().list_chats(_uid(user_id))


@app.get("/api/chats/{session_id}", response_model=ChatDetail)
def get_chat(session_id: str, user_id: str = UserId) -> dict:
    row = _store().load_session(_uid(user_id), session_id)
    if row is None:
        raise HTTPException(404, "chat not found")
    analysis = row["last_analysis"]
    return {
        "session_id": row["session_id"],
        "title": row["title"],
        "updated_at": row["updated_at"],
        "category": row["category"],
        "messages": [m for m in row["history"] if m.get("role") in ("user", "assistant")],
        "analysis": analysis,
        "location": analysis["location"] if analysis else None,
    }


@app.delete("/api/chats/{session_id}")
def delete_chat(session_id: str, user_id: str = UserId) -> dict:
    uid = _uid(user_id)
    if not _store().delete_chat(uid, session_id):
        raise HTTPException(404, "chat not found")
    agent.forget_session(session_id, uid)
    return {"ok": True}


@app.get("/api/rate/usd")
def rate_usd() -> dict:
    return fx.get_rate_info()
