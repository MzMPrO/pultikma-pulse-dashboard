"""POST /api/analyze: PulTikma Score for a point."""
from __future__ import annotations

from fastapi import APIRouter

from ..core.models import AnalyzeRequest, AnalyzeResponse
from ..services import scoring

router = APIRouter()


@router.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> dict:
    return scoring.analyze(req.lat, req.lng, req.category, req.format, req.avg_check, req.audience, req.budget)
