"""POST /api/chat: the chat agent."""
from __future__ import annotations

from fastapi import APIRouter

from ..core.models import ChatRequest, ChatResponse
from ..services import agent

router = APIRouter()


@router.post("/api/chat", response_model=ChatResponse, response_model_exclude_unset=True)
def chat(req: ChatRequest) -> dict:
    user_id = (req.user_id or "").strip() or None
    return agent.handle_chat(req.session_id, req.message, req.lat, req.lng, user_id)
