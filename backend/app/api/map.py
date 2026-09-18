"""Map layers — GeoJSON for the Leaflet frontend."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from ..agents import pfz_agent
from ..data.demo_store import now_ist
from ..data.geo import PORTS, RESTRICTED_ZONES, nearest_port
from ..data.providers.copernicus import copernicus_provider
from ..data.providers.open_meteo import open_meteo_provider
from ..data.providers.imd import imd_provider
from ..config import get_data_mode
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

@router.get("/chlorophyll-grid")
def chlorophyll_grid() -> dict:
    grid = copernicus_provider.fetch_chlorophyll_grid()
    if grid is None:
        return {"data": []}
    return {"data": grid}


def _intersects_coverage(hazard: dict) -> bool:
    """Retain only geometry that intersects 5–25N / 65–95E."""
    if hazard.get("geometry_type") == "grid_cell":
        (south, west), (north, east) = hazard["bounds"]
        return north >= 5 and south <= 25 and east >= 65 and west <= 95
    if hazard.get("geometry_type") == "polygon":
        lats, lons = zip(*hazard["polygon"])
        return max(lats) >= 5 and min(lats) <= 25 and max(lons) >= 65 and min(lons) <= 95
    if hazard.get("geometry_type") == "circle":
        # Conservative latitude extent; CAP's original radius is preserved for
        # rendering, never replaced with this filtering calculation.
        radius_degrees = float(hazard.get("radius_km", 0)) / 111.0
        return (hazard.get("latitude", -999) + radius_degrees >= 5 and
                hazard.get("latitude", -999) - radius_degrees <= 25 and
                hazard.get("longitude", -999) + radius_degrees >= 65 and
                hazard.get("longitude", -999) - radius_degrees <= 95)
    return 5 <= hazard.get("latitude", -999) <= 25 and 65 <= hazard.get("longitude", -999) <= 95


@router.get("/weather-hazards")
def weather_hazards() -> dict:
    """Live Open-Meteo cells plus active NDMA cyclone CAP geometries only."""
    if get_data_mode() != "LIVE":
        return {"status": "UNAVAILABLE", "hazards": [], "reason": "Live weather hazards require LIVE mode"}
    weather = open_meteo_provider.fetch_hazard_grid()
    cap = imd_provider.fetch_hazard_alerts()
    if weather is None and cap is None:
        return {"status": "UNAVAILABLE", "hazards": [], "reason": "Live weather hazard sources unavailable"}
    hazards = [h for source in (weather, cap) if source for h in source.get("hazards", []) if _intersects_coverage(h)]
    fetched = [source.get("fetched_at") for source in (weather, cap) if source and source.get("fetched_at")]
    return {"status": "LIVE", "hazards": hazards, "fetched_at": max(fetched) if fetched else None,
            "coverage": {"south": 5, "north": 25, "west": 65, "east": 95}}
