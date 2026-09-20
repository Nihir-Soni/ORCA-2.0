"""Typed contracts shared by every ORCA agent.

Rule: agents never return prose. They return these structures, each carrying
provenance (value + unit + source + timestamp + confidence). The Explanation
agent is the only component allowed to turn them into sentences.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

Language = Literal["en", "hi", "kn"]
IntentMode = Literal["OFFLINE", "AI"]
DataMode = Literal["LIVE", "DEMO", "CACHE", "UNAVAILABLE", "PARTIAL_LIVE", "STATIC", "HISTORICAL"]
IntentCategory = Literal["fishing_safety", "find_pfz", "fishing_outlook", "route", "emergency", "weather", "marine_conditions", "alerts", "restricted", "general_query", "historical_analysis"]
RiskCategory = Literal["LOW", "MODERATE", "HIGH", "EXTREME"]


class Provenance(BaseModel):
    """Attached to every factual number ORCA shows a user."""

    source: str
    timestamp: str
    mode: DataMode = "DEMO"
    confidence: Optional[float] = None
    note: Optional[str] = None


class Measurement(BaseModel):
    """A single traceable value."""

    value: Optional[float] = None
    unit: str = ""
    label: str = ""
    provenance: Provenance

    @property
    def known(self) -> bool:
        return self.value is not None


class Location(BaseModel):
    name: str = ""
    latitude: float
    longitude: float
    state: Optional[str] = None


class Intent(BaseModel):
    intent: str = "fishing_safety"
    activity: str = "fishing"
    location: Optional[Location] = None
    location_text: str = ""
    date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    time: Optional[str] = None
    language: Language = "en"
    raw_query: str = ""
    needs: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)
    intent_source: Literal["KEYWORD_OFFLINE", "GROQ_LLM", "NVIDIA_FALLBACK"] = "KEYWORD_OFFLINE"


class AgentResult(BaseModel):
    """Uniform envelope returned by every specialist agent."""

    agent: str
    ok: bool = True
    location: Optional[Location] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    historical_data: Dict[str, Any] = Field(default_factory=dict)
    measurements: Dict[str, Measurement] = Field(default_factory=dict)
    risk: Optional[float] = None          # 0..1 sub-risk for the risk engine
    unavailable: List[str] = Field(default_factory=list)
    source: str = "DEMO"
    timestamp: str = ""
    confidence: Optional[float] = None
    mode: DataMode = "DEMO"
    latency_ms: Optional[int] = None
    error: Optional[str] = None


class ProviderMetadata(BaseModel):
    source: str
    valid_time: str
    mode: DataMode
    confidence: Optional[float] = None
    note: Optional[str] = None


class ProviderResponse(BaseModel):
    data: Dict[str, Any]
    metadata: ProviderMetadata
    timestamp: str


class RiskFactor(BaseModel):
    key: str
    label: str
    factor: float          # 0..1 normalised severity
    weight: float          # configured weight
    contribution: float    # points added to the 0-100 score
    detail: str = ""


class RiskAssessment(BaseModel):
    score: int
    category: RiskCategory
    factors: List[RiskFactor]
    overrides: List[str] = Field(default_factory=list)
    official_warning: bool = False
    go: bool = False
    headline: str = ""
    advice: str = ""
    window: Optional[str] = None          # e.g. "conditions improve after 11:00"
    sources: List[str] = Field(default_factory=list)
    generated_at: str = ""
    mode: DataMode = "DEMO"


class PFZZone(BaseModel):
    rank: int
    latitude: float
    longitude: float
    distance_km: float
    bearing: str = ""
    sst_c: Optional[float] = None
    chlorophyll_mg_m3: Optional[float] = None
    wave_height_m: Optional[float] = None
    confidence: float = 0.0
    rationale: str = ""
    source: str = "DEMO"
    timestamp: str = ""
    # Per-variable provenance from LIVE environmental enrichment.
    # Keys: "sst", "chlorophyll", "wave_height".
    # Value: {value, provider, valid_time, stale} or None if unavailable.
    environmental_inputs: Optional[Dict[str, Any]] = None


class RouteLeg(BaseModel):
    latitude: float
    longitude: float


class RouteOption(BaseModel):
    name: str
    kind: Literal["safest", "shortest", "alternate"]
    legs: List[RouteLeg]
    distance_km: float
    eta_minutes: int
    risk_score: int
    risk_category: RiskCategory
    penalties: Dict[str, float] = Field(default_factory=dict)
    recommended: bool = False
    notes: str = ""


class EmergencyRouteRequest(BaseModel):
    latitude: float
    longitude: float


class EmergencyRouteResponse(BaseModel):
    available: bool
    destination: Optional[Dict[str, Any]] = None
    distance_km: Optional[float] = None
    eta_minutes: Optional[int] = None
    risk_score: Optional[int] = None
    risk_category: Optional[RiskCategory] = None
    waypoints: List[RouteLeg] = Field(default_factory=list)
    notes: str = ""


class GeofenceAlert(BaseModel):
    zone_name: str
    zone_type: str
    distance_km: float
    inside: bool
    severity: Literal["info", "warning", "critical"]
    message: str


class Evidence(BaseModel):
    """One row of the 'why did you say that' table."""

    label: str
    value: str
    source: str
    timestamp: str
    confidence: Optional[float] = None
    mode: DataMode = "DEMO"


class ChatRequest(BaseModel):
    message: str
    mode: IntentMode = "OFFLINE"
    language: Optional[Language] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_name: Optional[str] = None
    session_id: str = "default"


class AgentTrace(BaseModel):
    """What ran, in what order, how long it took — drives the demo animation."""

    agent: str
    status: Literal["ok", "skipped", "failed", "degraded"]
    latency_ms: int
    summary: str = ""
    source: str = ""
    mode: DataMode = "DEMO"


class ChatResponse(BaseModel):
    session_id: str
    language: Language
    answer: str
    intent: Intent
    risk: Optional[RiskAssessment] = None
    pfz: List[PFZZone] = Field(default_factory=list)
    routes: List[RouteOption] = Field(default_factory=list)
    geofence: List[GeofenceAlert] = Field(default_factory=list)
    alerts: List[Dict[str, Any]] = Field(default_factory=list)
    evidence: List[Evidence] = Field(default_factory=list)
    historical: Optional[Dict[str, Any]] = None
    trace: List[AgentTrace] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    mode: DataMode = "DEMO"
    sources: Dict[str, str] = Field(default_factory=dict)
    disclaimer: str = ""
    elapsed_ms: int = 0
