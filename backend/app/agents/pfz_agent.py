"""Potential Fishing Zone agent.

WHAT PFZ MEANS (we say this on stage, because it is the single most likely
"gotcha" question): a PFZ is not a fish detector. INCOIS derives PFZ advisories
from sea-surface-temperature fronts and chlorophyll concentration — the physical
signature of nutrient upwelling where forage species, and therefore catch,
concentrate. ORCA reproduces that reasoning and ranks candidate zones. It never
claims to see fish.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Dict, Any

from ..data import demo_store
from ..data.geo import RESTRICTED_ZONES, point_in_polygon, haversine_km, bearing_deg, compass
from ..data.providers.incois import incois_provider
from ..schemas import AgentResult, Location, PFZZone
from .base import live_enabled, timed


def _score(zone: dict) -> float:
    """Rank by front strength (chlorophyll) discounted by distance and sea state."""
    chl = zone.get("chlorophyll_mg_m3") or 0.0
    distance = zone.get("distance_km") or 1.0
    wave = zone.get("wave_height_m") or 1.0
    return (chl * 1.6) - (distance / 45.0) - (wave * 0.25)


def _blocking_zone(lat: float, lon: float):
    """The restricted area containing this point, if any."""
    for zone in RESTRICTED_ZONES:
        if point_in_polygon((lat, lon), zone["polygon"]):
            return zone
    return None


@timed
def run(location: Location, when: datetime, count: int = 6, radius_km: float = 100.0) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    raw: List[Dict[str, Any]] = []
    mode = "DEMO"
    source = "DEMO"
    unavailable = []
    total_available = 0
    nearest_distance_km = None
    provider_ok = True

    if live_enabled():
        pfz_res = incois_provider.fetch_pfz_zones(location.latitude, location.longitude, when)
        if pfz_res:
            incois_zones = pfz_res.data.get("zones", [])
            mode = "LIVE"
            source = pfz_res.metadata.source
            stamp = pfz_res.metadata.valid_time
            total_available = len(incois_zones)
            if total_available > 0:
                nearest_distance_km = incois_zones[0].get("distance_km")
            # Calculate distance and bearing for INCOIS zones relative to boat
            for z in incois_zones:
                pt1 = (location.latitude, location.longitude)
                pt2 = (z["latitude"], z["longitude"])
                dist = round(haversine_km(pt1, pt2), 2)
                if dist <= radius_km:
                    z["distance_km"] = dist
                    z["bearing"] = compass(bearing_deg(pt1, pt2))
                    z["source"] = source
                    raw.append(z)
        else:
            unavailable.append("INCOIS PFZ advisory unavailable")
            mode = "UNAVAILABLE"
            provider_ok = False
    if not live_enabled():
        raw = demo_store.pfz_zones(location.latitude, location.longitude, location.name, when, count=count, radius_km=radius_km)
        for z in raw:
            pt1 = (location.latitude, location.longitude)
            pt2 = (z["latitude"], z["longitude"])
            z["distance_km"] = round(haversine_km(pt1, pt2), 2)
            z["bearing"] = compass(bearing_deg(pt1, pt2))
            z["source"] = "DEMO"
            z["chlorophyll_mg_m3"] = z.get("chlorophyll_mg_m3", 0.0)
            z["wave_height_m"] = z.get("wave_height_m", 1.0)


    # SAFETY FILTER: never recommend a fishing zone that sits inside a marine
    # protected area, defence zone or port limit. A good catch prediction that
    # gets a fisher arrested or fined is not a good recommendation.
    kept, excluded = [], []
    for z in raw:
        blocker = _blocking_zone(z["latitude"], z["longitude"])
        if blocker:
            excluded.append({"latitude": z["latitude"], "longitude": z["longitude"],
                             "reason": blocker["name"], "zone_type": blocker["zone_type"]})
        else:
            kept.append(z)

    kept.sort(key=_score, reverse=True)
    kept = kept[:count]

    zones: List[PFZZone] = []
    for rank, z in enumerate(kept, start=1):
        z["rank"] = rank
        z["timestamp"] = stamp
        if "source" not in z:
            z["source"] = source
        zones.append(PFZZone(**{k: v for k, v in z.items() if k in PFZZone.model_fields}))

    return AgentResult(
        agent="pfz",
        ok=provider_ok,
        location=location,
        data={"zones": [z.model_dump() for z in zones],
              "total_available": total_available,
              "nearest_distance_km": nearest_distance_km,
              "excluded_zones": excluded,
              "excluded_count": len(excluded),
              "method": "Official INCOIS advisory" if mode == "LIVE" else "SST front + chlorophyll concentration ranking (INCOIS methodology)",
              "safety_filter": "Candidate zones inside restricted maritime areas are removed.",
              "caveat": "Potential zone — indicates likelihood of fish aggregation, not a guarantee."},
        source=source,
        timestamp=stamp,
        confidence=zones[0].confidence if zones else 0.0,
        mode=mode, # type: ignore[arg-type]
        unavailable=unavailable,
        error="INCOIS PFZ data unavailable" if not provider_ok else None
    )
