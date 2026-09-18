"""Map layers — GeoJSON for the Leaflet frontend."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from ..agents import pfz_agent
from ..data.demo_store import now_ist
from ..data.geo import PORTS, RESTRICTED_ZONES, nearest_port
from ..data.providers.copernicus import copernicus_provider
from ..schemas import Location

router = APIRouter(prefix="/api/map", tags=["map"])


@router.get("/zones")
def zones() -> dict:
    """Restricted areas as a GeoJSON FeatureCollection."""
    features = []
    for z in RESTRICTED_ZONES:
        ring = [[lon, lat] for lat, lon in z["polygon"]]
        ring.append(ring[0])
        features.append({
            "type": "Feature",
            "properties": {"id": z["id"], "name": z["name"], "zone_type": z["zone_type"],
                           "severity": z["severity"], "note": z["note"]},
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        })
    return {"type": "FeatureCollection", "features": features,
            "note": "Illustrative demo geofences — not official maritime boundaries."}


@router.get("/ports")
def ports() -> dict:
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature",
             "properties": {"name": p["name"], "state": p["state"]},
             "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]}}
            for p in PORTS
        ],
    }


@router.get("/pfz")
def pfz(lat: float = Query(...), lon: float = Query(...),
        count: int = Query(3, ge=1, le=6)) -> dict:
    port = nearest_port(lat, lon)
    loc = Location(name=port["name"], latitude=lat, longitude=lon, state=port["state"])
    result = pfz_agent.run(loc, now_ist(), count=count)
    zones = result.data.get("zones", [])
    return {
        "type": "FeatureCollection",
        "method": result.data.get("method"),
        "caveat": result.data.get("caveat"),
        "features": [
            {"type": "Feature",
             "properties": {k: v for k, v in z.items() if k not in ("latitude", "longitude")},
             "geometry": {"type": "Point", "coordinates": [z["longitude"], z["latitude"]]}}
            for z in zones
        ],
    }

@router.get("/sst-grid")
def sst_grid() -> dict:
    grid = copernicus_provider.fetch_sst_grid()
    if grid is None:
        return {"data": []}
    return {"data": grid}
