import os
import json
import time
import httpx
from typing import Dict, Any, Optional

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip('/')
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

def _http() -> httpx.Client:
    return httpx.Client(timeout=4.0)

def fetch_historical_chl(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """
    Fetches the pre-cached historical Chlorophyll time series from Upstash.
    Returns {"dates": [...], "values": [...]} or None.
    """
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return None
        
    r_lat = round(lat, 1)
    r_lon = round(lon, 1)
    
    try:
        headers = {"Authorization": f"Bearer {UPSTASH_TOKEN}"}
        r = _http().get(f"{UPSTASH_URL}/get/historical_chl:{r_lat:.1f},{r_lon:.1f}", headers=headers)
        r.raise_for_status()
        res = r.json()
        if res.get("result"):
            return json.loads(res["result"])
    except Exception as e:
        print(f"[ORCA][HISTORICAL][COPERNICUS] Failed to fetch CHL from Upstash: {e}")
        
    return None

def fetch_historical_chl_metadata() -> Optional[Dict[str, Any]]:
    """Fetches the metadata (coverage dates, dataset name) from Upstash."""
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        return None
        
    try:
        headers = {"Authorization": f"Bearer {UPSTASH_TOKEN}"}
        r = _http().get(f"{UPSTASH_URL}/get/historical_chl_metadata", headers=headers)
        r.raise_for_status()
        res = r.json()
        if res.get("result"):
            return json.loads(res["result"])
    except Exception as e:
        print(f"[ORCA][HISTORICAL][COPERNICUS] Failed to fetch CHL metadata from Upstash: {e}")
        
    return None
