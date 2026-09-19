"""Planner / Orchestrator — the central agent.

It owns the graph, not the marine maths: it decides WHICH specialists a question
needs, runs the independent ones concurrently, waits for the dependent ones, and
assembles the state that the Risk and Explanation agents consume.

    intent -> {weather, ocean, pfz, cyclone, gis}  (parallel)
           -> risk        (needs all four data agents)
           -> route       (needs pfz + risk)
           -> explanation (needs everything)

This is a hand-written state machine with the same execution semantics as a
LangGraph graph. It is written out explicitly so the whole orchestration is
readable in one screen during a code walkthrough, and so the demo has zero
heavyweight dependencies. `ORCA_USE_LANGGRAPH=1` is the documented upgrade path;
the node functions below are already shaped as LangGraph nodes (state in,
state out).
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from ..config import get_data_mode
from ..data.demo_store import IST, now_ist
from ..schemas import (AgentTrace, ChatRequest, ChatResponse, Evidence,
                       GeofenceAlert, Intent, Location, PFZZone, RiskAssessment,
                       RouteOption)
from ..services.i18n import t
from ..services.groq_intent import GroqIntentError
from . import (cyclone_agent, explanation_agent, gis_agent, intent_agent,
               ocean_agent, pfz_agent, risk_agent, route_agent, weather_agent)
from ..services.historical import analyze_historical_data

# session_id -> last intent (gives follow-ups their context)
_SESSIONS: Dict[str, Intent] = {}

AGENT_SUMMARY = {
    "weather": lambda d: f"wind {d.get('wind_speed_kmh')} km/h, rain {d.get('rain_probability_pct')}%",
    "ocean": lambda d: f"wave {d.get('wave_height_m')} m, {d.get('sea_state')}",
    "pfz": lambda d: f"{len(d.get('zones', []))} zones ranked",
    "cyclone": lambda d: (d.get("headline") or "no active warning"),
    "gis": lambda d: f"{d.get('distance_from_shore_km')} km offshore, "
                     f"{len(d.get('zones_nearby', []))} zones nearby",
    "risk": lambda d: f"{d.get('score')}/100 {d.get('category')}",
    "route": lambda d: (f"{d.get('recommended', {}).get('distance_km')} km recommended"
                        if d.get("recommended") else "no route"),
    "explanation": lambda d: "answer composed",
    "intent": lambda d: f"{d.get('intent')} @ {d.get('location_text') or 'unknown'} {d.get('time')}",
}


def _target_datetime(intent: Intent) -> datetime:
    """Combine the parsed date + time into an IST timestamp."""
    base = now_ist()
    try:
        y, m, d = (int(x) for x in (intent.date or base.date().isoformat()).split("-"))
        hh, mm = (int(x) for x in (intent.time or "06:00").split(":"))
        return datetime(y, m, d, hh, mm, tzinfo=IST)
    except Exception:
        return base


def _trace(result, name: str) -> AgentTrace:
    status = "ok" if result.ok else "failed"
    if result.ok and result.unavailable:
        status = "degraded"
    try:
        summary = AGENT_SUMMARY.get(name, lambda d: "")(result.data or {})
    except Exception:
        summary = ""
    return AgentTrace(agent=name, status=status,  # type: ignore[arg-type]
                      latency_ms=result.latency_ms or 0, summary=summary or "",
                      source=result.source, mode=result.mode)


def handle(req: ChatRequest) -> ChatResponse:
    """Run the full ORCA graph for one user message."""
    started = time.perf_counter()

    # ---- node 1: intent --------------------------------------------------
    previous = _SESSIONS.get(req.session_id)
    intent_res = intent_agent.run(
        req.message, language=req.language, latitude=req.latitude,
        longitude=req.longitude, location_name=req.location_name, previous=previous,
        mode=req.mode,
    )
    if not intent_res.ok and req.mode == "AI":
        raise GroqIntentError("AI mode is unavailable")
    intent = Intent(**intent_res.data)
    if intent.location is None:
        from ..data.geo import DEFAULT_PORT
        intent.location = Location(name=DEFAULT_PORT["name"], latitude=DEFAULT_PORT["lat"],
                                   longitude=DEFAULT_PORT["lon"], state=DEFAULT_PORT["state"])
        intent.location_text = DEFAULT_PORT["name"]
    _SESSIONS[req.session_id] = intent

    location = intent.location
    when = _target_datetime(intent)
    needs = set(intent.needs)

    trace: List[AgentTrace] = [_trace(intent_res, "intent")]
    agents: Dict[str, object] = {}

    # ---- node 2: specialists, concurrently -------------------------------
    jobs = {}
    historical_data: Optional[Dict[str, Any]] = None
    
    if intent.intent == "historical_analysis":
        # Extract dates or default to last 30 days
        now_date = now_ist().date()
        st_date = intent.start_date or (now_date - timedelta(days=30)).isoformat()
        ed_date = intent.end_date or now_date.isoformat()
        historical_data = analyze_historical_data(location, st_date, ed_date)

        # Strip timeseries before passing to LLM — saves context window tokens.
        # The /api/historical dashboard endpoint calls analyze_historical_data
        # directly and intentionally keeps timeseries for chart rendering.
        for _var in historical_data.get("variables", {}).values():
            _var.pop("timeseries", None)

        # Add to trace
        trace.append(AgentTrace(agent="historical", status="ok", latency_ms=0, summary="Historical data fetched", source="UPSTASH", mode="HISTORICAL"))
    
    with ThreadPoolExecutor(max_workers=5) as pool:
        if "weather" in needs:
            jobs["weather"] = pool.submit(weather_agent.run, location, when)
        if "ocean" in needs:
            jobs["ocean"] = pool.submit(ocean_agent.run, location, when)
        if "pfz" in needs:
            jobs["pfz"] = pool.submit(pfz_agent.run, location, when)
        if "cyclone" in needs:
            jobs["cyclone"] = pool.submit(cyclone_agent.run, location, when)
        if "gis" in needs:
            jobs["gis"] = pool.submit(gis_agent.run, location, when)
        results = {name: fut.result() for name, fut in jobs.items()}

    for name, res in results.items():
        agents[name] = res
        trace.append(_trace(res, name))

    weather_d = results["weather"].data if "weather" in results else {}
    ocean_d = results["ocean"].data if "ocean" in results else {}
    cyclone_d = results["cyclone"].data if "cyclone" in results else {}
    gis_d = results["gis"].data if "gis" in results else {}

    # Gather sources and compute mode
    source_map = {}
    all_live = True
    any_unavailable = False
    config_mode = get_data_mode()

    for name, res in results.items():
        if name in ("gis", "intent", "route"):
            source_map[name] = "STATIC"
            continue
            
        source_map[name] = res.mode
        if res.mode != "LIVE" and res.mode != "CACHE":
            all_live = False
        if res.mode == "UNAVAILABLE" or res.unavailable:
            any_unavailable = True

    if config_mode == "DEMO":
        mode = "DEMO"
    elif historical_data and historical_data.get("overall_status") == "PARTIAL_LIVE":
        mode = "PARTIAL_LIVE"
    elif all_live:
        mode = "LIVE"
    elif any_unavailable:
        mode = "PARTIAL_LIVE"
    else:
        mode = "DEMO"

    sources = [r.source for r in results.values() if r.ok]

    # ---- node 3: risk ----------------------------------------------------
    risk: Optional[RiskAssessment] = None
    if "risk" in needs:
        risk_res = risk_agent.run(location, when, weather=weather_d, ocean=ocean_d,
                                  cyclone=cyclone_d, gis=gis_d, sources=sources, mode=mode)
        agents["risk"] = risk_res
        trace.append(_trace(risk_res, "risk"))
        if risk_res.ok:
            risk = RiskAssessment(**risk_res.data)

    # ---- node 4: pfz list / route ---------------------------------------
    pfz_zones: List[PFZZone] = []
    if "pfz" in results and results["pfz"].ok:
        pfz_zones = [PFZZone(**z) for z in results["pfz"].data.get("zones", [])]

    routes: List[RouteOption] = []
    if "route" in needs and pfz_zones:
        target = pfz_zones[0]
        route_res = route_agent.run(location, when,
                                    destination=(target.latitude, target.longitude),
                                    destination_name=f"PFZ #{target.rank}",
                                    ocean=ocean_d, weather=weather_d,
                                    risk=(risk.model_dump() if risk else {}))
        agents["route"] = route_res
        trace.append(_trace(route_res, "route"))
        if route_res.ok:
            routes = [RouteOption(**o) for o in route_res.data.get("options", [])]

    geofence = [GeofenceAlert(**a) for a in gis_d.get("geofence_alerts", [])]

    # ---- node 5: explanation --------------------------------------------
    expl_res = explanation_agent.run(
        intent=intent, risk=risk, pfz=pfz_zones, routes=routes, geofence=geofence,
        weather=weather_d, ocean=ocean_d, cyclone=cyclone_d, gis=gis_d,
        agents=agents, mode=mode, when=when, chat_mode=req.mode,  # type: ignore[arg-type]
        historical=historical_data
    )
    trace.append(_trace(expl_res, "explanation"))

    evidence = [Evidence(**e) for e in expl_res.data.get("evidence", [])]

    return ChatResponse(
        session_id=req.session_id,
        language=intent.language,
        answer=expl_res.data.get("answer", ""),
        intent=intent,
        risk=risk,
        pfz=pfz_zones,
        routes=routes,
        geofence=geofence,
        alerts=cyclone_d.get("alerts", []),
        evidence=evidence,
        historical=historical_data,
        trace=trace,
        suggestions=expl_res.data.get("suggestions", []),
        mode=mode,  # type: ignore[arg-type]
        sources=source_map,
        disclaimer=expl_res.data.get("disclaimer", ""),
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )


def reset_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)
