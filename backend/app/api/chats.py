"""Chat history: /api/chats (list), /api/chats/{id} (get, delete)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..core.models import ChatDetail, ChatSummary
from ..services import agent, chat_store

router = APIRouter()

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


@router.get("/api/chats", response_model=list[ChatSummary])
def list_chats(user_id: str = UserId) -> list[dict]:
    return _store().list_chats(_uid(user_id))


@router.get("/api/chats/{session_id}", response_model=ChatDetail)
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


@router.delete("/api/chats/{session_id}")
def delete_chat(session_id: str, user_id: str = UserId) -> dict:
    uid = _uid(user_id)
    if not _store().delete_chat(uid, session_id):
        raise HTTPException(404, "chat not found")
    agent.forget_session(session_id, uid)
    return {"ok": True}
