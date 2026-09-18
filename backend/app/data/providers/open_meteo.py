import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import httpx

from ...config import LIVE_TIMEOUT_SECONDS, WEATHER_HAZARD_GRID_TIMEOUT_SECONDS
from ...schemas import ProviderMetadata, ProviderResponse
from . import BaseProvider

class OpenMeteoProvider(BaseProvider):
    """Weather and marine data from Open-Meteo APIs."""

    MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
    FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
    CACHE_TTL_OK = 600.0
    CACHE_TTL_FAIL = 60.0
    CACHE_MAX_ENTRIES = 256
    # WMO weather interpretation codes returned by Open-Meteo.  These codes,
    # rather than an ORCA-invented precipitation cutoff, define intensity.
    LIGHT_RAIN_CODES = {51, 53, 55, 56, 57, 61, 63, 66, 80, 81}
    HEAVY_RAIN_CODES = {65, 67, 82}
    THUNDERSTORM_CODES = {95, 96, 99}

    def __init__(self):
        self._cache: Dict[Tuple[str, float, float], Tuple[float, Optional[Dict]]] = {}
        self._lock = threading.Lock()
        self._client: Optional[httpx.Client] = None
        self._hazard_client: Optional[httpx.Client] = None

    def _http(self) -> httpx.Client:
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = httpx.Client(timeout=LIVE_TIMEOUT_SECONDS)
        return self._client

    def _hazard_http(self) -> httpx.Client:
        """Dedicated client for the one bounded multi-location grid request."""
        if self._hazard_client is None:
            with self._lock:
                if self._hazard_client is None:
                    self._hazard_client = httpx.Client(timeout=WEATHER_HAZARD_GRID_TIMEOUT_SECONDS)
        return self._hazard_client

    def _series(self, kind: str, url: str, hourly_fields: str, lat: float, lon: float,
                extra: Optional[Dict] = None) -> Optional[Dict]:
        key = (kind, round(lat, 2), round(lon, 2))
        now = time.monotonic()
        with self._lock:
            hit = self._cache.get(key)
            if hit and hit[0] > now:
                return hit[1]

        data: Optional[Dict] = None
        try:
            r = self._http().get(
                url,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": hourly_fields,
                    "forecast_days": 3,
                    "timezone": "Asia/Kolkata",
                    **(extra or {}),
                },
            )
            r.raise_for_status()
            hourly = r.json().get("hourly") or {}
            if hourly.get("time"):
                data = hourly
        except httpx.TimeoutException:
            print(f"[ORCA][LIVE][{kind.upper()}] Open-Meteo TIMEOUT")
            data = None
        except httpx.HTTPStatusError as e:
            print(f"[ORCA][LIVE][{kind.upper()}] Open-Meteo HTTP {e.response.status_code}")
            data = None
        except Exception as e:
            print(f"[ORCA][LIVE][{kind.upper()}] Open-Meteo ERROR: {e}")
            data = None

        with self._lock:
            if len(self._cache) >= self.CACHE_MAX_ENTRIES:
                expired = [k for k, (exp, _) in self._cache.items() if exp <= now]
                for k in expired or [next(iter(self._cache))]:
                    self._cache.pop(k, None)
            self._cache[key] = (now + (self.CACHE_TTL_OK if data else self.CACHE_TTL_FAIL), data)
        return data

    def _pick_hour_index(self, times: list, target: datetime) -> int:
        stamp = target.strftime("%Y-%m-%dT%H:00")
        if stamp in times:
            return times.index(stamp)
        hour_suffix = target.strftime("T%H:00")
        for i, t in enumerate(times):
            if t.endswith(hour_suffix):
                return i
        return 0

    def fetch_marine(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        h = self._series("marine", self.MARINE_URL,
                         "wave_height,wave_period,sea_surface_temperature", lat, lon)
        if not h:
            return None
        times = h.get("time") or []
        i = self._pick_hour_index(times, when)

        def at(key: str):
            series = h.get(key) or []
            return series[i] if i < len(series) else None

        valid_time = times[i] if times else when.isoformat()
        return ProviderResponse(
            data={
                "wave_height_m": at("wave_height"),
                "wave_period_s": at("wave_period"),
                "sst_c": at("sea_surface_temperature"),
            },
            metadata=ProviderMetadata(
                source="Open-Meteo Marine",
                valid_time=valid_time,
                mode="LIVE"
            ),
            timestamp=datetime.now().isoformat()
        )

    def fetch_weather(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        h = self._series("forecast", self.FORECAST_URL,
                         ("temperature_2m,wind_speed_10m,wind_direction_10m,"
                          "precipitation_probability,visibility"),
                         lat, lon, extra={"wind_speed_unit": "kmh"})
        if not h:
            return None
        times = h.get("time") or []
        i = self._pick_hour_index(times, when)

        def at(key: str):
            series = h.get(key) or []
            return series[i] if i < len(series) else None

        visibility_m = at("visibility")
        valid_time = times[i] if times else when.isoformat()
        return ProviderResponse(
            data={
                "temperature_c": at("temperature_2m"),
                "wind_speed_kmh": at("wind_speed_10m"),
                "wind_direction_deg": at("wind_direction_10m"),
                "rain_probability_pct": at("precipitation_probability"),
                "visibility_km": round(visibility_m / 1000.0, 1) if visibility_m is not None else None,
            },
            metadata=ProviderMetadata(
                source="Open-Meteo",
                valid_time=valid_time,
                mode="LIVE"
            ),
            timestamp=datetime.now().isoformat()
        )

    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        return self.fetch_weather(lat, lon, when)

    @classmethod
    def hazard_type_for_code(cls, weather_code: object) -> Optional[str]:
        """Map the source's WMO code to a hazard without guessing from wind."""
        try:
            code = int(weather_code)
        except (TypeError, ValueError):
            return None
        if code in cls.THUNDERSTORM_CODES:
            return "THUNDERSTORM"
        if code in cls.HEAVY_RAIN_CODES:
            return "HEAVY_RAIN"
        if code in cls.LIGHT_RAIN_CODES:
            return "LIGHT_RAIN"
        return None

    def fetch_hazard_grid(self) -> Optional[Dict]:
        """Fetch one live, bounded weather grid for the chart layer.

        Open-Meteo accepts comma-separated coordinates and returns one hourly
        response per coordinate.  A 1-degree grid gives each hazard a real
        source grid-cell footprint while keeping this to one upstream request.
        """
        key = ("hazard_grid", 0.0, 0.0)
        now = time.monotonic()
        with self._lock:
            hit = self._cache.get(key)
            if hit and hit[0] > now:
                return hit[1]
        # Open-Meteo's multi-coordinate endpoint has a URL-size limit.  A
        # 4-degree operational grid spans the same coverage in 40 cells and
        # remains a single request; every displayed rectangle is that actual
        # queried grid cell, not a point marker with an invented radius.
        lat_cells = [(5.0, 9.0), (9.0, 13.0), (13.0, 17.0), (17.0, 21.0), (21.0, 25.0)]
        lon_cells = [(65.0, 69.0), (69.0, 73.0), (73.0, 77.0), (77.0, 81.0),
                     (81.0, 85.0), (85.0, 89.0), (89.0, 93.0), (93.0, 95.0)]
        points = [((south + north) / 2, (west + east) / 2, south, west, north, east)
                  for south, north in lat_cells for west, east in lon_cells]
        data: Optional[Dict] = None
        try:
            response = self._hazard_http().get(self.FORECAST_URL, params={
                "latitude": ",".join(str(lat) for lat, *_ in points),
                "longitude": ",".join(str(lon) for _, lon, *_ in points),
                "hourly": "weather_code,precipitation",
                "forecast_days": 1,
                "timezone": "UTC",
            })
            response.raise_for_status()
            payload = response.json()
            rows = payload if isinstance(payload, list) else [payload]
            hazards: List[Dict] = []
            valid_times: List[str] = []
            for (lat, lon, south, west, north, east), row in zip(points, rows):
                hourly = row.get("hourly") or {}
                times, codes = hourly.get("time") or [], hourly.get("weather_code") or []
                if not times or not codes:
                    continue
                # API returns UTC; the first time at/after the current UTC hour
                # is its current/latest valid grid cell.
                target = datetime.utcnow().strftime("%Y-%m-%dT%H:00")
                index = next((i for i, stamp in enumerate(times) if stamp >= target), 0)
                kind = self.hazard_type_for_code(codes[index] if index < len(codes) else None)
                if not kind:
                    continue
                valid = times[index]
                valid_times.append(valid)
                hazards.append({
                    "type": kind, "geometry_type": "grid_cell",
                    "bounds": [[south, west], [north, east]],
                    "latitude": lat, "longitude": lon,
                    "precipitation_mm": (hourly.get("precipitation") or [None])[index],
                    "source": "OPEN_METEO", "valid_time": valid,
                })
            data = {"hazards": hazards, "valid_time": min(valid_times) if valid_times else None,
                    "fetched_at": datetime.utcnow().isoformat() + "Z"}
        except Exception as e:
            print(f"[ORCA][LIVE][WEATHER_GRID] Open-Meteo ERROR: {e}")
        with self._lock:
            self._cache[key] = (now + (self.CACHE_TTL_OK if data else self.CACHE_TTL_FAIL), data)
        return data

open_meteo_provider = OpenMeteoProvider()
