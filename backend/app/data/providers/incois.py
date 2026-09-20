import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from shapely.geometry import shape, Point
from shapely.ops import nearest_points

from ...schemas import ProviderMetadata, ProviderResponse, PFZZone
from . import BaseProvider
from .copernicus import copernicus_provider
from .open_meteo import open_meteo_provider

# Maximum age (seconds) accepted for Open-Meteo Marine data before treating the
# observation as stale.  Open-Meteo Marine is an NWP product refreshed every
# hour, so 3600 s is a generous freshness window.
_MARINE_FRESHNESS_SECONDS = 3600.0


def _env_input_entry(value: Optional[float], provider: str, valid_time: Optional[str],
                     stale: bool) -> Dict:
    """Standardised provenance record for one environmental variable."""
    return {
        "value": value,
        "provider": provider,
        "valid_time": valid_time,
        "stale": stale,
    }


class INCOISProvider(BaseProvider):
    """Official PFZ advisories from INCOIS via WFS, enriched with LIVE env data."""

    # We must use www.incois.gov.in as incois.gov.in without www returns 403
    WFS_URL = "https://www.incois.gov.in/geoserver/PFZ_Automation/ows"
    TIMEOUT = 30.0
    CACHE_TTL = 21600.0  # 6 hours

    def __init__(self):
        self._cache = {}
        self._lock = threading.Lock()
        self._client = httpx.Client(timeout=self.TIMEOUT)

    def _calculate_bearing(self, p1: Point, p2: Point) -> str:
        """Calculate compass bearing from p1 to p2."""
        lat1, lon1 = math.radians(p1.y), math.radians(p1.x)
        lat2, lon2 = math.radians(p2.y), math.radians(p2.x)
        
        dlon = lon2 - lon1
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        
        brng = math.degrees(math.atan2(y, x))
        brng = (brng + 360) % 360
        
        dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        ix = int((brng + 22.5) / 45.0) % 8
        return dirs[ix]

    def _calculate_distance_km(self, p1: Point, p2: Point) -> float:
        """Calculate haversine distance in km between two points."""
        R = 6371.0 # Earth radius in km
        lat1, lon1 = math.radians(p1.y), math.radians(p1.x)
        lat2, lon2 = math.radians(p2.y), math.radians(p2.x)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def _enrich_zone_env(self, zone: Dict, when: datetime) -> Dict:
        """Fetch SST, wave height, and chlorophyll for one zone concurrently.

        Uses the existing provider singletons (open_meteo_provider for SST+wave,
        copernicus_provider for chlorophyll).  Both providers have their own
        in-process caches, so parallel calls for nearby zone coordinates are fast.

        Returns a copy of ``zone`` with the following keys added:
          sst_c, wave_height_m, chlorophyll_mg_m3, environmental_inputs.

        Observations are only accepted when the provider returns a non-None result
        with a non-empty valid_time, satisfying the temporal-freshness requirement.
        """
        lat, lon = zone["latitude"], zone["longitude"]

        with ThreadPoolExecutor(max_workers=2) as pool:
            marine_fut = pool.submit(open_meteo_provider.fetch_marine, lat, lon, when)
            chl_fut    = pool.submit(copernicus_provider.fetch_chlorophyll, lat, lon, when)
            marine_res = marine_fut.result()
            chl_res    = chl_fut.result()

        enriched = dict(zone)
        env_inputs: Dict[str, Optional[Dict]] = {}

        # ---- SST + wave height (Open-Meteo Marine) --------------------------
        if marine_res and marine_res.metadata.valid_time:
            sst_val  = marine_res.data.get("sst_c")
            wave_val = marine_res.data.get("wave_height_m")
            vt       = marine_res.metadata.valid_time

            if sst_val is not None:
                enriched["sst_c"] = round(float(sst_val), 2)
            env_inputs["sst"] = _env_input_entry(
                value      = round(float(sst_val), 2) if sst_val is not None else None,
                provider   = "Open-Meteo Marine",
                valid_time = vt,
                stale      = False,
            )

            if wave_val is not None:
                enriched["wave_height_m"] = round(float(wave_val), 2)
            env_inputs["wave_height"] = _env_input_entry(
                value      = round(float(wave_val), 2) if wave_val is not None else None,
                provider   = "Open-Meteo Marine",
                valid_time = vt,
                stale      = False,
            )
        else:
            # Provider unavailable or valid_time missing — mark as stale/absent
            env_inputs["sst"]         = _env_input_entry(None, "Open-Meteo Marine", None, True)
            env_inputs["wave_height"] = _env_input_entry(None, "Open-Meteo Marine", None, True)

        # ---- Chlorophyll (Copernicus via Upstash Redis) ----------------------
        if chl_res and chl_res.metadata.valid_time:
            chl_val = chl_res.data.get("chlorophyll_mg_m3")
            if chl_val is not None:
                enriched["chlorophyll_mg_m3"] = round(float(chl_val), 4)
            env_inputs["chlorophyll"] = _env_input_entry(
                value      = round(float(chl_val), 4) if chl_val is not None else None,
                provider   = "Copernicus Marine Service",
                valid_time = chl_res.metadata.valid_time,
                stale      = False,
            )
        else:
            # Stale (> 48 h) or unavailable — Copernicus provider returns None when stale.
            env_inputs["chlorophyll"] = _env_input_entry(
                None, "Copernicus Marine Service", None, True
            )

        enriched["environmental_inputs"] = env_inputs
        return enriched

    def fetch_pfz_zones(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch official PFZ zones from INCOIS WFS and compute spatial relations."""
        params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": "PFZ_Automation:pfzlines",
            "outputFormat": "application/json"
        }
        
        # Check cache
        cache_key = "pfz_wfs"
        now = time.time()
        
        with self._lock:
            if cache_key in self._cache:
                data, ts = self._cache[cache_key]
                if now - ts < self.CACHE_TTL:
                    return self._process_geojson(data, lat, lon, when)

        try:
            resp = self._client.get(self.WFS_URL, params=params)
            resp.raise_for_status()
            geojson = resp.json()
            
            with self._lock:
                self._cache[cache_key] = (geojson, now)
                
            return self._process_geojson(geojson, lat, lon, when)
        except Exception as e:
            print(f"[ORCA][LIVE][PFZ] Failed to fetch INCOIS WFS: {e}")
            return None

    def _process_geojson(self, geojson: Dict, lat: float, lon: float,
                         when: datetime) -> ProviderResponse:
        boat_pt = Point(lon, lat)
        raw_zones = []
        
        for idx, feature in enumerate(geojson.get("features", [])):
            geom = feature.get("geometry")
            props = feature.get("properties", {})
            if not geom or geom["type"] != "MultiLineString":
                continue
                
            try:
                s_geom = shape(geom)
                # Find nearest point on the PFZ MultiLineString to the boat.
                # This is the representative coordinate for environmental lookup —
                # it is derived deterministically from the INCOIS geometry.
                p_boat, p_nearest = nearest_points(boat_pt, s_geom)
                
                dist_km = self._calculate_distance_km(boat_pt, p_nearest)
                bearing = self._calculate_bearing(boat_pt, p_nearest)
                
                state = props.get("State_Name", "Unknown")
                uid = props.get("UID", f"PFZ_{idx}")
                
                raw_zones.append({
                    "rank": idx + 1,
                    "latitude": round(p_nearest.y, 4),
                    "longitude": round(p_nearest.x, 4),
                    "distance_km": round(dist_km, 2),
                    "bearing": bearing,
                    # confidence=1.0 means ORCA trusts the INCOIS advisory
                    # as an official source.  It has NO relation to fish probability.
                    "confidence": 1.0,
                    "rationale": f"{state} (UID: {uid})",
                    "source": "INCOIS_WFS",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    # Environmental fields — populated by enrichment below.
                    # Explicitly set to None so downstream code can distinguish
                    # "not provided" from "0.0".
                    "sst_c": None,
                    "chlorophyll_mg_m3": None,
                    "wave_height_m": None,
                    "environmental_inputs": None,
                })
            except Exception as e:
                print(f"[ORCA][PFZ] Error processing geometry: {e}")
                continue

        # Sort by distance before enrichment so we enrich only what we'll return.
        raw_zones.sort(key=lambda x: x["distance_km"])
        for i, z in enumerate(raw_zones):
            z["rank"] = i + 1

        # Enrich each zone with LIVE environmental observations (concurrent per zone).
        # Each zone uses its own representative geometry coordinate.
        zones: List[Dict] = []
        if raw_zones:
            with ThreadPoolExecutor(max_workers=min(len(raw_zones), 8)) as pool:
                futs = {
                    pool.submit(self._enrich_zone_env, z, when): z
                    for z in raw_zones
                }
                enriched_by_rank: Dict[int, Dict] = {}
                for fut in as_completed(futs):
                    try:
                        enriched = fut.result()
                        enriched_by_rank[enriched["rank"]] = enriched
                    except Exception as e:
                        orig = futs[fut]
                        print(f"[ORCA][PFZ] Enrichment failed for zone rank {orig['rank']}: {e}")
                        enriched_by_rank[orig["rank"]] = orig  # fall back to geometry-only
            # Restore rank order
            zones = [enriched_by_rank[z["rank"]] for z in raw_zones
                     if z["rank"] in enriched_by_rank]

        return ProviderResponse(
            data={"zones": zones},
            metadata=ProviderMetadata(
                source="INCOIS_WFS",
                valid_time=datetime.utcnow().isoformat(),
                mode="LIVE",
                confidence=1.0,
                note=(
                    "PFZ geometries are official INCOIS advisories. "
                    "Distance/bearing and environmental enrichment are ORCA-derived."
                )
            ),
            timestamp=datetime.utcnow().isoformat()
        )

    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        return self.fetch_pfz_zones(lat, lon, when)

incois_provider = INCOISProvider()
