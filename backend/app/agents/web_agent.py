"""Web search agent — searches the live internet for fish species, local market prices, harbour info, and general marine queries."""
from __future__ import annotations

from typing import Dict, List, Optional
from ..schemas import AgentResult, Location
from ..services.web_search import search_web
from .base import timed


@timed
def run(query: str, location_name: str = "") -> AgentResult:
    """Execute web search for a user query and return structured results."""
    try:
        results = search_web(query, location_name=location_name, max_results=5)
        return AgentResult(
            agent="web",
            ok=True if results else False,
            data={
                "query": query,
                "location_name": location_name,
                "results": results,
                "count": len(results),
            },
            source="WEB_SEARCH",
            confidence=0.85 if results else 0.0,
            mode="LIVE" if results else "UNAVAILABLE",
        )
    except Exception as exc:
        print(f"Web agent error: {exc}")
        return AgentResult(
            agent="web",
            ok=False,
            data={"query": query, "location_name": location_name, "results": [], "count": 0},
            source="WEB_SEARCH",
            confidence=0.0,
            mode="UNAVAILABLE",
        )
