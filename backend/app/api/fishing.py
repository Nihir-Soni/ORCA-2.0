"""The fisherman's endpoint.

One call answers everything a fisher needs on opening the app at their own
location: is it safe, where are the fish likely to be within 100 km, when
should I go, how long should I stay, what must I avoid, and what do the next
two days look like — with all of it also written in plain language.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Query

from ..agents import (cyclone_agent, gis_agent, ocean_agent, risk_agent,
                      route_agent, weather_agent)
from ..data import demo_store
from ..data.demo_store import IST, now_ist
from ..data.geo import (RESTRICTED_ZONES, distance_from_shore_km, haversine_km,
                        nearest_port, point_in_polygon, zone_window_text, zones_near)
from ..schemas import Location
from ..services import fishing, plain_language

router = APIRouter(prefix="/api", tags=["fishing"])

MAX_RADIUS_KM = 100.0


def _blocking_zone(lat: float, lon: float) -> Optional[Dict]:
    for zone in RESTRICTED_ZONES:
        if point_in_polygon((lat, lon), zone["polygon"]):
            return zone
    return None


def _safe_window_hours(loc: Location, start: datetime, gis_data: dict) -> float:
    """How many consecutive hours from `start` stay at or below MODERATE risk."""
    hours = 0.0
    for h in range(0, 14):
        dt = start + timedelta(hours=h)
        weather = weather_agent.run(loc, dt)
        ocean = ocean_agent.run(loc, dt)
        cyclone = cyclone_agent.run(loc, dt)
        
        assessment = risk_agent.run(loc, dt, weather=weather.data, ocean=ocean.data,
                                    cyclone=cyclone.data, gis=gis_data, sources=[],
                                    mode=weather.mode)
        if assessment.data.get("category") in ("HIGH", "EXTREME"):
            break
        hours += 1
    return hours


def _zone_payload(loc: Location, zones: List[Dict], ambient_sst: Optional[float],
                  hour: int) -> List[Dict]:
    """Score, filter and rank candidate grounds."""
    scored: List[Dict] = []
    for z in zones:
        blocker = _blocking_zone(z["latitude"], z["longitude"])
        if blocker:
            continue  # never recommend a ground inside a restricted area
        result = fishing.probability(
            chlorophyll=z.get("chlorophyll_mg_m3"), sst=z.get("sst_c"),
            ambient_sst=ambient_sst, wave_m=z.get("wave_height_m"), hour=hour,
        )
        z = dict(z)
        z["probability"] = result["probability"]
        z["rating"] = fishing.rating(result["probability"])
        z["factors"] = result["factors"]
        z["likely_species"] = fishing.likely_species(
            z.get("sst_c"), z.get("chlorophyll_mg_m3"), z["distance_km"])
        z["confidence"] = round(result["probability"] / 100.0, 2)
        z["value_score"] = fishing.value_score(result["probability"], z["distance_km"])
        z["rationale"] = (
            f"Chlorophyll {z.get('chlorophyll_mg_m3')} mg/m3 at {z.get('sst_c')} deg C, "
            f"{round(z['distance_km'])} km {z['bearing']}."
        )
        scored.append(z)

    # Numbering follows the chance of fish, so "area 1" always means "best
    # chance" to the person reading it. Ranking them by trip value instead
    # produced a list where area 1 showed a lower percentage than area 3, which
    # simply reads as broken.
    scored.sort(key=lambda z: (z["probability"], -z["distance_km"]), reverse=True)
    for rank, z in enumerate(scored, start=1):
        z["rank"] = rank

    # Separately, the ground we actually send him to balances the odds against
    # the run out. That one carries the badge and drives the route and timing.
    if scored:
        pick = max(scored, key=lambda z: z["value_score"])
        for z in scored:
            z["recommended"] = z is pick
    return scored


@router.get("/fishing")
def fishing_outlook(
    lat: float = Query(..., description="Fisher's latitude"),
    lon: float = Query(..., description="Fisher's longitude"),
    radius_km: float = Query(MAX_RADIUS_KM, ge=5, le=MAX_RADIUS_KM),
    days: int = Query(3, ge=1, le=3, description="Today plus the next N-1 days"),
    lang: str = Query("en", pattern="^(en|hi|kn)$"),
) -> dict:
    now = now_ist()
    port = nearest_port(lat, lon)
    loc = Location(name=port["name"], latitude=lat, longitude=lon, state=port["state"])

    # ---- current safety picture -----------------------------------------
    with ThreadPoolExecutor(max_workers=4) as pool:
        weather_fut = pool.submit(weather_agent.run, loc, now)
        ocean_fut = pool.submit(ocean_agent.run, loc, now)
        cyclone_fut = pool.submit(cyclone_agent.run, loc, now)
        gis_fut = pool.submit(gis_agent.run, loc, now)
        
        weather = weather_fut.result()
        ocean = ocean_fut.result()
        cyclone = cyclone_fut.result()
        gis = gis_fut.result()

    risk_res = risk_agent.run(loc, now, weather=weather.data, ocean=ocean.data,
                              cyclone=cyclone.data, gis=gis.data,
                              sources=[weather.source, ocean.source], mode=weather.mode)
    risk = risk_res.data
    ambient_sst = ocean.data.get("sst_c")

    # ---- grounds within the radius, today -------------------------------
    candidates = demo_store.pfz_zones(lat, lon, loc.name, now, radius_km=radius_km)
    zones = _zone_payload(loc, candidates, ambient_sst, now.hour)

    # ---- best hours to be on the water ----------------------------------
    wave_by_hour: Dict[int, float] = {}
    for h in range(24):
        dt = now.replace(hour=h, minute=0, second=0, microsecond=0)
        wave_by_hour[h] = demo_store.conditions(loc.name, dt)["wave"]

    daylight = [h for h in range(5, 20)]
    top_zone = zones[0] if zones else None
    ranked_hours = fishing.best_hours(
        chlorophyll=(top_zone or {}).get("chlorophyll_mg_m3"),
        sst=(top_zone or {}).get("sst_c"), ambient_sst=ambient_sst,
        wave_by_hour=wave_by_hour, allowed_hours=daylight,
    )
    good_hours = sorted(h for h, p in ranked_hours[:6])
    best_window = fishing.contiguous_window(good_hours)

    # ---- route + how long to stay ---------------------------------------
    duration = None
    economics = None
    routes: List[Dict] = []
    top_zone = next((z for z in zones if z.get("recommended")), top_zone)
    if top_zone:
        route_res = route_agent.run(
            loc, now, destination=(top_zone["latitude"], top_zone["longitude"]),
            destination_name=f"Area {top_zone['rank']}", ocean=ocean.data,
            weather=weather.data, risk=risk,
        )
        if route_res.ok:
            routes = route_res.data.get("options", [])
            recommended = route_res.data.get("recommended") or {}
            duration = fishing.recommend_duration(
                probability_pct=top_zone["probability"],
                distance_km=top_zone["distance_km"],
                travel_minutes=int(recommended.get("eta_minutes", 90)),
                safe_window_hours=_safe_window_hours(loc, now, gis.data),
            )
            # "Return before HH:MM, because..." — the end of the safe window
            # as a clock time a fisher can hold in his head, with the reason.
            back_by = now + timedelta(hours=duration["safe_window_hours"])
            duration["return_by"] = back_by.strftime("%H:%M")
            after = demo_store.conditions(loc.name, back_by + timedelta(hours=1))
            duration["return_reason_wave_m"] = round(after["wave"], 1)
            economics = fishing.trip_economics(
                probability_pct=top_zone["probability"],
                distance_km=top_zone["distance_km"],
            )

    # ---- two-day outlook -------------------------------------------------
    forecast: List[Dict] = []
    base_wave = ocean.data.get("wave_height_m") or 0.0
    for offset in range(days):
        # Score each day at its own best fishing hour rather than a fixed clock
        # time — "tomorrow" means tomorrow's best opportunity, not tomorrow 6 AM.
        day_start = (now + timedelta(days=offset)).replace(minute=0, second=0, microsecond=0)
        search_hours = [h for h in range(5, 20) if offset > 0 or h >= now.hour] or [6]
        day_waves = {
            h: demo_store.conditions(loc.name, day_start.replace(hour=h))["wave"]
            for h in search_hours
        }
        probe = demo_store.conditions(loc.name, day_start.replace(hour=search_hours[0]))
        peak_hour = max(
            search_hours,
            key=lambda h: fishing.probability(
                chlorophyll=probe["chl"], sst=probe["sst"], ambient_sst=probe["sst"] - 0.6,
                wave_m=day_waves[h], hour=h,
            )["probability"],
        )
        dt = day_start.replace(hour=peak_hour)
        cond = demo_store.conditions(loc.name, dt)
        day_candidates = demo_store.pfz_zones(lat, lon, loc.name, dt, radius_km=radius_km)
        day_zones = _zone_payload(loc, day_candidates, cond["sst"], peak_hour)
        best = day_zones[0] if day_zones else None
        prob = best["probability"] if best else 0
        day_alerts = demo_store.alerts(loc.name, dt)
        forecast.append({
            "day_offset": offset,
            "date": fishing.date_for(offset, now),
            "label": fishing.day_label(offset),
            "best_hour": peak_hour,
            "probability": prob,
            "rating": fishing.rating(prob),
            "wave_height_m": round(cond["wave"], 2),
            "wind_speed_kmh": round(cond["wind"], 1),
            "sea_state": cond["sea_state"],
            "calmer": cond["wave"] < base_wave if offset else True,
            "official_warning": any(a.get("official") for a in day_alerts),
            "best_area_rank": best["rank"] if best else None,
            "best_area_distance_km": best["distance_km"] if best else None,
        })

    # ---- what to avoid, and when ----------------------------------------
    nearby_zones = zones_near(lat, lon, radius_km=radius_km, hour=now.hour)
    closed = [
        {"name": z["name"], "zone_type": z["zone_type"], "distance_km": z["distance_km"],
         "window": z.get("window"), "active_now": z.get("active_now"),
         "severity": z["severity"]}
        for z in nearby_zones
    ]

    # ---- plain language --------------------------------------------------
    advice = plain_language.build(
        lang=lang,
        risk_category=risk.get("category", "MODERATE"),
        official_warning=bool(risk.get("official_warning")),
        wave_m=ocean.data.get("wave_height_m"),
        wind_kmh=weather.data.get("wind_speed_kmh"),
        improve_hour=int(risk["window"].split(":")[0]) if risk.get("window") else None,
        zones=zones,
        closed_zones=closed,
        duration=duration,
        best_window=best_window,
        forecast=forecast,
    )

    return {
        "location": {
            "latitude": lat, "longitude": lon,
            "name": loc.name, "state": loc.state,
            "nearest_landing_centre": port["name"],
            "distance_from_shore_km": round(distance_from_shore_km(lat, lon), 1),
        },
        "generated_at": now.isoformat(timespec="seconds"),
        "radius_km": radius_km,
        "safety": {
            "score": risk.get("score"),
            "category": risk.get("category"),
            "official_warning": risk.get("official_warning"),
            "improves_after": risk.get("window"),
            "wave_height_m": ocean.data.get("wave_height_m"),
            "wind_speed_kmh": weather.data.get("wind_speed_kmh"),
            "sea_state": ocean.data.get("sea_state"),
        },
        "areas": zones,
        "best_window": {"from_hour": best_window[0], "to_hour": best_window[1]} if best_window else None,
        "hourly_ranking": [{"hour": h, "probability": p} for h, p in sorted(ranked_hours)],
        "duration": duration,
        "economics": economics,
        "routes": routes,
        "avoid": closed,
        "forecast": forecast,
        "advice": advice,
        "mode": weather.mode,
        "method": ("Likelihood from chlorophyll, sea-surface temperature, thermal front "
                   "strength, sea state and time of day. A likelihood, never a guarantee."),
    }
