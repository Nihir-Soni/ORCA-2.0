import os
import json
import httpx
from typing import Dict, Any, Optional

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip('/')
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")


def _http() -> httpx.Client:
    return httpx.Client(timeout=6.0)


def _upstash_get(key: str) -> Optional[str]:
    """Fetch a single Upstash key value; returns raw JSON string or None."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return None
    headers = {"Authorization": f"Bearer {UPSTASH_TOKEN}"}
    try:
        r = _http().get(f"{UPSTASH_URL}/get/{key}", headers=headers)
        r.raise_for_status()
        return r.json().get("result") or None
    except Exception as e:
        print(f"[ORCA][HISTORICAL][COPERNICUS] Upstash GET {key} failed: {e}")
        return None


def _upstash_mget(keys: list[str]) -> list[Optional[str]]:
    """Fetch multiple Upstash keys in one request (MGET pipeline)."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return [None] * len(keys)
    headers = {
        "Authorization": f"Bearer {UPSTASH_TOKEN}",
        "Content-Type": "application/json",
    }
    try:
        r = _http().post(
            f"{UPSTASH_URL}/pipeline",
            headers=headers,
            json=[["GET", k] for k in keys],
        )
        r.raise_for_status()
        return [item.get("result") or None for item in r.json()]
    except Exception as e:
        print(f"[ORCA][HISTORICAL][COPERNICUS] Upstash MGET failed: {e}")
        return [None] * len(keys)


def _neighbour_keys(r_lat: float, r_lon: float, max_steps: int = 3) -> list[str]:
    """
    Generate candidate Upstash keys in expanding rings around (r_lat, r_lon).

    The Copernicus 4km product skips pure-land or permanent-cloud cells, so
    the exact 0.1° grid point for a coastal harbour may be missing.  We search
    outward up to ``max_steps`` × 0.1° to find the nearest ocean cell.

    Returns keys ordered by increasing Chebyshev distance (closest first).
    """
    ordered: list[tuple[int, str]] = []
    step = 0.1
    for dist in range(0, max_steps + 1):
        if dist == 0:
            ordered.append((0, f"historical_chl:{r_lat:.1f},{r_lon:.1f}"))
            continue
        # Walk the perimeter of the square at this Chebyshev distance
        for dlat in range(-dist, dist + 1):
            for dlon in range(-dist, dist + 1):
                if max(abs(dlat), abs(dlon)) != dist:
                    continue  # inner cells already covered
                lat_k = round(r_lat + dlat * step, 1)
                lon_k = round(r_lon + dlon * step, 1)
                ordered.append((dist, f"historical_chl:{lat_k:.1f},{lon_k:.1f}"))
    return [k for _, k in ordered]


def fetch_historical_chl(lat: float, lon: float) -> Optional[list]:
    """
    Fetch the pre-cached historical Chlorophyll time-series from Upstash.

    Returns a list of ``{"time": "YYYY-MM-DD", "value": float}`` dicts,
    or None if no data is available within 0.3° of the requested position.

    Strategy
    --------
    1. Round to 0.1° grid (matches sync_historical.py key format).
    2. Try the exact cell first.
    3. If missing (land / permanent cloud gap in the Copernicus product),
       search outward ring-by-ring up to 3 cells (≈ 33 km) and use the
       first hit — nearest ocean point with real observations.
    """
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return None

    r_lat = round(lat, 1)
    r_lon = round(lon, 1)

    candidate_keys = _neighbour_keys(r_lat, r_lon, max_steps=3)

    # Batch-fetch all candidates in one pipeline request to minimise latency
    results = _upstash_mget(candidate_keys)

    for key, raw in zip(candidate_keys, results):
        if raw:
            try:
                data = json.loads(raw)
                if data:
                    if key != candidate_keys[0]:
                        print(
                            f"[ORCA][HISTORICAL][COPERNICUS] "
                            f"Exact cell {candidate_keys[0]} missing; "
                            f"using nearest ocean cell {key}"
                        )
                    return data
            except (json.JSONDecodeError, ValueError):
                continue

    print(
        f"[ORCA][HISTORICAL][COPERNICUS] No CHL data within 0.3° of "
        f"({r_lat:.1f}, {r_lon:.1f})"
    )
    return None


def fetch_historical_chl_metadata() -> Optional[Dict[str, Any]]:
    """Fetch the sync metadata (coverage dates, dataset name) from Upstash."""
    raw = _upstash_get("historical_chl_metadata")
    if raw:
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            pass
    return None
