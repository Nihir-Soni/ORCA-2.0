"""Cyclone / marine-alert agent.

Highest-priority agent in the system. If it reports an official severe warning,
the risk engine's deterministic floor forces EXTREME regardless of what every
other agent — or the language model — thinks.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Any

from ..data import demo_store
from ..data.providers.imd import imd_provider
from ..schemas import AgentResult, Location
from .base import live_enabled, timed

SEVERITY_RANK = {"low": 0, "moderate": 1, "high": 2, "severe": 3}


@timed
def run(location: Location, when: datetime) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    alerts: List[Dict[str, Any]] = []
    mode = "DEMO"
    source = "DEMO"
    unavailable = []

    if live_enabled():
        imd_res = imd_provider.fetch_alerts(
            location.latitude,
            location.longitude,
            when,
            location_name=location.name,
            state=location.state,
        )
        if imd_res:
            alerts = imd_res.data.get("alerts", [])
            mode = "LIVE"
            source = imd_res.metadata.source
            stamp = imd_res.metadata.valid_time
        else:
            unavailable.append("IMD Cyclone alerts unavailable")
            mode = "UNAVAILABLE"

    if not live_enabled():
        alerts = demo_store.alerts(location.name, when)

    alerts.sort(key=lambda a: SEVERITY_RANK.get(str(a.get("severity")).lower(), 0), reverse=True)

    worst = alerts[0] if alerts else None
    official = any(a.get("official") for a in alerts)

    return AgentResult(
        agent="cyclone",
        ok=True if (not live_enabled() or alerts or mode == "LIVE") else False,
        location=location,
        data={
            "alerts": alerts,
            "count": len(alerts),
            "official_warning_active": official,
            "highest_severity": (worst or {}).get("severity"),
            "headline": (worst or {}).get("headline"),
        },
        source=source,
        timestamp=stamp,
        confidence=0.95 if alerts else 0.8,
        mode=mode, # type: ignore[arg-type]
        unavailable=unavailable,
        error="IMD alerts unavailable" if (live_enabled() and mode == "UNAVAILABLE") else None
    )
