import math
import os
import threading
import time
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Tuple

import httpx

from ...schemas import ProviderMetadata, ProviderResponse
from . import BaseProvider

class CopernicusProvider(BaseProvider):
    """Ocean currents and chlorophyll from Copernicus Marine Service, via Upstash Redis."""

    CURRENT_PRODUCT = "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m"
    CHLOROPHYLL_PRODUCT = "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D"

    CACHE_TTL_CURRENT = 1800.0      # 30 minutes
    CACHE_TTL_CHLOROPHYLL = 86400.0  # 24 hours

    def __init__(self):
        self.upstash_url = os.getenv("UPSTASH_REDIS_REST_URL", "").rstrip('/')
        self.upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
        self._value_cache_lock = threading.Lock()
        self._current_cache: Dict[Tuple[float, float], Tuple[float, Tuple[float, float]]] = {}
        self._chlorophyll_cache: Dict[Tuple[float, float], Tuple[float, float]] = {}
        
        # We also cache the fetched_at timestamp globally to avoid fetching it on every request
        self._metadata_lock = threading.Lock()
        self._fetched_at: Optional[datetime] = None
        self._valid_time_current: Optional[str] = None
        self._valid_time_chlorophyll: Optional[str] = None
        self._metadata_check_time: float = 0
        self._metadata_ttl = 300.0 # 5 mins before rechecking Upstash metadata

        self._client: Optional[httpx.Client] = None

    def _http(self) -> httpx.Client:
        if self._client is None:
            self._client = httpx.Client(timeout=4.0)
        return self._client

    def _is_stale(self) -> bool:
        """Check if the Redis data is too old (> 48 hours)."""
        if not self.upstash_url or not self.upstash_token:
            return True
            
        now = time.monotonic()
        with self._metadata_lock:
            if self._fetched_at is not None and (now - self._metadata_check_time) < self._metadata_ttl:
                stale_threshold = datetime.now(timezone.utc) - timedelta(hours=48)
                return self._fetched_at < stale_threshold

        try:
            headers = {"Authorization": f"Bearer {self.upstash_token}"}
            r = self._http().get(f"{self.upstash_url}/get/copernicus_metadata", headers=headers)
            r.raise_for_status()
            res = r.json()
            if res.get("result"):
                meta = json.loads(res["result"])
                # parse iso format correctly
                fetched_at_str = meta.get("fetched_at", "")
                if fetched_at_str.endswith("Z"):
                    fetched_at_str = fetched_at_str[:-1] + "+00:00"
                fetched_at = datetime.fromisoformat(fetched_at_str)
                # ensure timezone aware
                if fetched_at.tzinfo is None:
                    fetched_at = fetched_at.replace(tzinfo=timezone.utc)
                    
                with self._metadata_lock:
                    self._fetched_at = fetched_at
                    
                    valid_time_payload = meta.get("valid_time")
                    if isinstance(valid_time_payload, dict):
                        self._valid_time_current = valid_time_payload.get("current")
                        self._valid_time_chlorophyll = valid_time_payload.get("chlorophyll")
                    elif isinstance(valid_time_payload, str):
                        self._valid_time_current = valid_time_payload
                        self._valid_time_chlorophyll = valid_time_payload
                    
                    self._metadata_check_time = time.monotonic()
                    
                stale_threshold = datetime.now(timezone.utc) - timedelta(hours=48)
                return fetched_at < stale_threshold
        except Exception as e:
            print(f"[ORCA][LIVE][COPERNICUS] Failed to check metadata: {e}")
            return True
            
        return True

    def _fetch_from_redis(self, lat: float, lon: float) -> Optional[Dict]:
        """Fetch a single point from the pre-computed Upstash grid."""
        if self._is_stale():
            return None
            
        r_lat = round(lat, 1)
        r_lon = round(lon, 1)
        
        try:
            headers = {"Authorization": f"Bearer {self.upstash_token}"}
            r = self._http().get(f"{self.upstash_url}/hget/copernicus_data/{r_lat:.1f},{r_lon:.1f}", headers=headers)
            r.raise_for_status()
            res = r.json()
            if res.get("result"):
                return json.loads(res["result"])
        except Exception as e:
            print(f"[ORCA][LIVE][COPERNICUS] Failed to fetch from Upstash: {e}")
            
        return None

    def fetch_current(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch surface current (U/V components) from pre-cached NRT analysis."""
        key = (round(lat, 2), round(lon, 2))
        try:
            with self._value_cache_lock:
                now = time.monotonic()
                cached = self._current_cache.get(key)
                if cached and cached[0] > now:
                    u, v = cached[1]
                else:
                    data = self._fetch_from_redis(lat, lon)
                    if not data or "u" not in data or "v" not in data:
                        return None
                        
                    u = float(data["u"])
                    v = float(data["v"])

                    if math.isnan(u) or math.isnan(v):
                        return None
                    self._current_cache[key] = (now + self.CACHE_TTL_CURRENT, (u, v))

            speed, direction = self._convert_uv_to_speed_direction(u, v)
            valid_time = self._valid_time_current
            if not valid_time:
                return None
            
            return ProviderResponse(
                data={
                    "speed_m_s": round(speed, 3),
                    "direction_deg": round(direction, 1),
                    "u": round(u, 3),
                    "v": round(v, 3)
                },
                metadata=ProviderMetadata(
                    source="Copernicus Marine Service",
                    valid_time=valid_time,
                    mode="LIVE",
                    confidence=1.0,
                    note=f"Dataset: {self.CURRENT_PRODUCT} (Pre-cached)"
                ),
                timestamp=datetime.utcnow().isoformat()
            )
        except Exception as e:
            print(f"[ORCA][LIVE][COPERNICUS] Error reading current data: {e}")
            return None

    def fetch_chlorophyll(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch chlorophyll-a concentration from pre-cached L4 product."""
        key = (round(lat, 2), round(lon, 2))
        try:
            with self._value_cache_lock:
                now = time.monotonic()
                cached = self._chlorophyll_cache.get(key)
                if cached and cached[0] > now:
                    chl = cached[1]
                else:
                    data = self._fetch_from_redis(lat, lon)
                    if not data or "chl" not in data:
                        return None

                    chl = float(data["chl"])

                    if math.isnan(chl):
                        return None
                    self._chlorophyll_cache[key] = (now + self.CACHE_TTL_CHLOROPHYLL, chl)

            valid_time = self._valid_time_chlorophyll
            if not valid_time:
                return None

            return ProviderResponse(
                data={"chlorophyll_mg_m3": round(chl, 4)},
                metadata=ProviderMetadata(
                    source="Copernicus Marine Service",
                    valid_time=valid_time,
                    mode="LIVE",
                    confidence=1.0,
                    note=f"Dataset: {self.CHLOROPHYLL_PRODUCT} (Gap-Free L4 Pre-cached)"
                ),
                timestamp=datetime.utcnow().isoformat()
            )
        except Exception as e:
            print(f"[ORCA][LIVE][COPERNICUS] Error reading chlorophyll data: {e}")
            return None

    def _convert_uv_to_speed_direction(self, u: float, v: float) -> Tuple[float, float]:
        """Convert U/V current components to speed (m/s) and direction (deg)."""
        speed = math.sqrt(u**2 + v**2)
        direction = (270 - math.degrees(math.atan2(v, u))) % 360
        return speed, direction

    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        return self.fetch_current(lat, lon, when)

copernicus_provider = CopernicusProvider()
