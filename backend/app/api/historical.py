"""Historical marine analysis endpoint.

Returns the full deterministic historical analysis for a location and time period.
Unlike the /api/chat path (which strips timeseries to save LLM context), this
endpoint preserves the complete daily timeseries for use in frontend charts.

No LLM call is made here. The response is purely deterministic.
"""
from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from ..data.geo import nearest_port
from ..schemas import Location
from ..services.historical import analyze_historical_data

router = APIRouter(prefix="/api", tags=["historical"])

ALLOWED_DAYS = {7, 30, 90}


def _resolve_location(lat: float, lon: float) -> Location:
    port = nearest_port(lat, lon)
    return Location(
        name=port["name"],
        latitude=lat,
        longitude=lon,
        state=port.get("state"),
    )


@router.get("/historical")
def historical_analysis(
    lat: float = Query(..., description="Latitude of the vessel / location"),
    lon: float = Query(..., description="Longitude of the vessel / location"),
    days: int = Query(30, description="Historical window: 7, 30, or 90 days"),
) -> dict:
    """Return deterministic historical marine analysis with full timeseries.

    This endpoint is for the Historical Marine Intelligence dashboard.
    It returns every variable's daily timeseries so the frontend can render
    genuine time-series charts from real Copernicus / Open-Meteo data.

    Unlike the /api/chat historical path, no LLM is invoked and timeseries
    values are NOT stripped from the response.
    """
    if days not in ALLOWED_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"days must be one of {sorted(ALLOWED_DAYS)}, got {days}",
        )

    location = _resolve_location(lat, lon)

    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    start_str = start_date.isoformat()
    end_str = end_date.isoformat()

    # analyze_historical_data returns variables with timeseries intact.
    # The LLM path in planner.py strips timeseries *after* this call — we do NOT
    # strip them here so the dashboard can render the full daily chart.
    result = analyze_historical_data(location, start_str, end_str)

    # Re-attach period and location so callers don't have to infer them
    result["period"] = {"start": start_str, "end": end_str, "days_requested": days}
    result["location"] = {
        "name": location.name,
        "latitude": lat,
        "longitude": lon,
        "state": location.state,
    }

    return result
