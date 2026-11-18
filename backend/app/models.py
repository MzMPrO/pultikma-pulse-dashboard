"""Request/response models (the frontend relies on this exact contract)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["coffee", "fastfood", "cafe", "pharmacy"]
Source = str  # real | estimated | synthetic


class AnalyzeRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    category: Category
    format: str | None = None
    avg_check: float | None = None
    audience: str | None = None
    budget: float | None = None


class Factors(BaseModel):
    traffic: float
    competition: float
    closures: float
    rent: float
    visibility: float


class Kpi(BaseModel):
    competitors: int
    closures: int
    traffic_per_day: int
    rent_per_m2_uzs: int
    rent_per_m2_usd: float | None = None
    usd_rate: float | None = None


class Location(BaseModel):
    lat: float
    lng: float
    radius_m: int = 500


class Competitor(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    category: str
    source: str | None = None


class Closed(Competitor):
    reason: str | None = None
    closed_year: int | None = None


class Generator(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    type: str | None = None
    daily_flow: int | None = None
    source: str | None = None


class Alternative(BaseModel):
    rank: int
    lat: float
    lng: float
    score: int
    factors: Factors
    distance_m: int


class AnalyzeResponse(BaseModel):
    score: int
    verdict: Literal["go", "change", "no"]
    verdict_text: str
    factors: Factors
    kpi: Kpi
    location: Location
    competitors: list[Competitor]
    closed: list[Closed]
    traffic_generators: list[Generator]
    alternatives: list[Alternative]
    explanation: str


class ChatRequest(BaseModel):
    session_id: str
    message: str = ""
    lat: float | None = None
    lng: float | None = None
    user_id: str | None = Field(default=None, max_length=128)  # anonymous persistent id; absent = no memory


class ChatResponse(BaseModel):
    reply: str
    quick_replies: list[str] = []
    need_location: bool = False
    analysis: AnalyzeResponse | None = None


class ChatSummary(BaseModel):
    session_id: str
    title: str
    updated_at: str
    last_score: int | None = None
    category: str | None = None


class StoredMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatDetail(BaseModel):
    session_id: str
    title: str
    updated_at: str
    category: str | None = None
    messages: list[StoredMessage]
    analysis: AnalyzeResponse | None = None
    location: Location | None = None
