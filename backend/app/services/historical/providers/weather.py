import httpx
from datetime import datetime
from typing import Dict, Any, Optional

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

def _http() -> httpx.Client:
    return httpx.Client(timeout=8.0)

def fetch_historical_marine(lat: float, lon: float, start_date: str, end_date: str) -> Optional[Dict[str, Any]]:
    """
    Fetch historical SST and currents from Open-Meteo Marine.
    Start and end date should be YYYY-MM-DD.
    """
    try:
        r = _http().get(
            MARINE_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "sea_surface_temperature,ocean_current_velocity,ocean_current_direction",
                "start_date": start_date,
                "end_date": end_date,
                "timezone": "UTC"
            }
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[ORCA][HISTORICAL][OPEN-METEO MARINE] Failed: {e}")
        return None

def fetch_historical_weather(lat: float, lon: float, start_date: str, end_date: str) -> Optional[Dict[str, Any]]:
    """
    Fetch historical weather from Open-Meteo Archive API.
    Start and end date should be YYYY-MM-DD.
    """
    try:
        r = _http().get(
            ARCHIVE_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "temperature_2m,wind_speed_10m,precipitation",
                "start_date": start_date,
                "end_date": end_date,
                "timezone": "UTC",
                "wind_speed_unit": "kmh"
            }
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[ORCA][HISTORICAL][OPEN-METEO ARCHIVE] Failed: {e}")
        return None
