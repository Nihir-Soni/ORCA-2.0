import math
import os
import threading
import time
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

import httpx

try:
    import copernicusmarine as cm
    import xarray as xr
    import numpy as np
    COPERNICUS_AVAILABLE = True
except ImportError:
    COPERNICUS_AVAILABLE = False

from ...schemas import ProviderMetadata, ProviderResponse
from . import BaseProvider

class CopernicusProvider(BaseProvider):
    """Ocean currents and chlorophyll from Copernicus Marine Service."""

    CURRENT_PRODUCT = "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m"
    CHLOROPHYLL_PRODUCT = "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D"

    CACHE_TTL_CURRENT = 1800.0      # 30 minutes
    CACHE_TTL_CHLOROPHYLL = 86400.0  # 24 hours

    def __init__(self):
        self.username = os.getenv("COPERNICUS_USERNAME")
        self.password = os.getenv("COPERNICUS_PASSWORD")
        self._lock = threading.Lock()
        self._value_cache_lock = threading.Lock()
        self._current_cache: Dict[Tuple[float, float], Tuple[float, Tuple[float, float]]] = {}
        self._chlorophyll_cache: Dict[Tuple[float, float], Tuple[float, float]] = {}
        
        self._ds_current = None
        self._ds_chlorophyll = None
        self._current_failed = False
        self._chlorophyll_failed = False

    def _get_dataset_with_timeout(self, dataset_id: str):
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                cm.open_dataset,
                dataset_id=dataset_id,
                username=self.username,
                password=self.password
            )
            return future.result(timeout=10.0)

    def _get_current_dataset(self):
        if not COPERNICUS_AVAILABLE or not self.username or not self.password or self._current_failed:
            return None
            
        with self._lock:
            if self._ds_current is None and not self._current_failed:
                try:
                    self._ds_current = self._get_dataset_with_timeout(self.CURRENT_PRODUCT)
                except Exception as e:
                    self._current_failed = True
                    print(f"[ORCA][LIVE][COPERNICUS] Failed to open currents dataset: {e}")
            return self._ds_current

    def _get_chlorophyll_dataset(self):
        if not COPERNICUS_AVAILABLE or not self.username or not self.password or self._chlorophyll_failed:
            return None
            
        with self._lock:
            if self._ds_chlorophyll is None and not self._chlorophyll_failed:
                try:
                    self._ds_chlorophyll = self._get_dataset_with_timeout(self.CHLOROPHYLL_PRODUCT)
                except Exception as e:
                    self._chlorophyll_failed = True
                    print(f"[ORCA][LIVE][COPERNICUS] Failed to open chlorophyll dataset: {e}")
            return self._ds_chlorophyll

    def fetch_current(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch surface current (U/V components) from NRT analysis."""
        ds = self._get_current_dataset()
        if ds is None:
            return None

        key = (round(lat, 2), round(lon, 2))
        try:
            with self._value_cache_lock:
                now = time.monotonic()
                cached = self._current_cache.get(key)
                if cached and cached[0] > now:
                    u, v = cached[1]
                else:
                    # Extract nearest point from the latest available time slice.
                    subset = ds.sel(latitude=lat, longitude=lon, method="nearest")
                    if 'time' in subset.dims:
                        subset = subset.isel(depth=0, time=-1) # Assuming surface is depth=0
                    elif 'depth' in subset.dims:
                        subset = subset.isel(depth=0)

                    u = float(subset["uo"].values)
                    v = float(subset["vo"].values)

                    if math.isnan(u) or math.isnan(v):
                        return None
                    self._current_cache[key] = (now + self.CACHE_TTL_CURRENT, (u, v))

            speed, direction = self._convert_uv_to_speed_direction(u, v)
            
            return ProviderResponse(
                data={
                    "speed_m_s": round(speed, 3),
                    "direction_deg": round(direction, 1),
                    "u": round(u, 3),
                    "v": round(v, 3)
                },
                metadata=ProviderMetadata(
                    source="Copernicus Marine Service",
                    valid_time=datetime.utcnow().isoformat(),
                    mode="LIVE",
                    confidence=1.0,
                    note=f"Dataset: {self.CURRENT_PRODUCT}"
                ),
                timestamp=datetime.utcnow().isoformat()
            )
        except Exception as e:
            print(f"[ORCA][LIVE][COPERNICUS] Error reading current data: {e}")
            return None

    def fetch_chlorophyll(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch chlorophyll-a concentration from satellite L4 product."""
        ds = self._get_chlorophyll_dataset()
        if ds is None:
            return None
            
        key = (round(lat, 2), round(lon, 2))
        try:
            with self._value_cache_lock:
                now = time.monotonic()
                cached = self._chlorophyll_cache.get(key)
                if cached and cached[0] > now:
                    chl = cached[1]
                else:
                    subset = ds.sel(latitude=lat, longitude=lon, method="nearest")

                    if 'time' in subset.dims:
                        subset = subset.isel(time=-1)

                    chl = float(subset["CHL"].values)

                    if math.isnan(chl):
                        return None
                    self._chlorophyll_cache[key] = (now + self.CACHE_TTL_CHLOROPHYLL, chl)

            return ProviderResponse(
                data={"chlorophyll_mg_m3": round(chl, 4)},
                metadata=ProviderMetadata(
                    source="Copernicus Marine Service",
                    valid_time=datetime.utcnow().isoformat(),
                    mode="LIVE",
                    confidence=1.0,
                    note=f"Dataset: {self.CHLOROPHYLL_PRODUCT} (Gap-Free L4)"
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
