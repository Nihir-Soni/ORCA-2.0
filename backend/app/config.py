"""ORCA configuration — data mode, risk weights, thresholds.

Everything a judge might question ("why these weights?", "is this data real?")
is centralised here so it can be shown on screen and defended in Q&A.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict


# --------------------------------------------------------------------------
# Data mode
# --------------------------------------------------------------------------
# LIVE : call public marine/weather APIs, fall back to cache/demo on failure.
# DEMO : serve only cached, clearly-labelled scenario data. Stage-safe.
#
# Default is DEMO so a laptop with no internet still runs the full pipeline.
DATA_MODE = os.getenv("ORCA_DATA_MODE", "DEMO").upper()

# Runtime-switchable copy so the mode can be flipped from the UI mid-demo
# ("watch — I'll switch it to live government-adjacent data now") without a
# restart. Always read through get_data_mode(); never trust the constant above.
_RUNTIME = {"data_mode": DATA_MODE}


def get_data_mode() -> str:
    return _RUNTIME["data_mode"]


def set_data_mode(mode: str) -> str:
    mode = (mode or "").strip().upper()
    if mode not in ("LIVE", "DEMO"):
        raise ValueError("mode must be LIVE or DEMO")
    _RUNTIME["data_mode"] = mode
    return mode

# Seconds before a live API call is abandoned in favour of cache/demo data.
LIVE_TIMEOUT_SECONDS = float(os.getenv("ORCA_LIVE_TIMEOUT", "4.0"))
# The multi-location weather-hazard grid is one bounded upstream request.  It
# receives a small independent allowance without changing point forecasts.
WEATHER_HAZARD_GRID_TIMEOUT_SECONDS = float(os.getenv("ORCA_WEATHER_HAZARD_GRID_TIMEOUT", "8.0"))

# Optional AI intent layer. The key is read only by the backend and is never
# included in a response or sent by the frontend.
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("ORCA_GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_TIMEOUT_SECONDS = float(os.getenv("ORCA_GROQ_TIMEOUT", "8.0"))
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL") or "openai/gpt-oss-20b"
NVIDIA_BASE_URL = (os.getenv("NVIDIA_BASE_URL") or os.getenv("NVIDIA_API_BASE_URL")
                   or "https://integrate.api.nvidia.com/v1")
NVIDIA_TIMEOUT_SECONDS = float(os.getenv("NVIDIA_TIMEOUT_SECONDS") or "8")


# --------------------------------------------------------------------------
# Risk engine
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class RiskConfig:
    """Weighted-factor risk model.

    IMPORTANT (and we say this out loud in the pitch): these weights are an
    engineering starting point informed by small-boat safety guidance, NOT a
    peer-reviewed maritime standard. They are configurable and every factor's
    contribution is shown to the user. Deterministic overrides below cannot be
    out-voted by the weighted score.
    """

    weights: Dict[str, float] = field(
        default_factory=lambda: {
            "wave": 0.25,     # dominant capsize driver for small craft
            "cyclone": 0.25,  # official alerts / storm proximity
            "wind": 0.20,
            "weather": 0.10,  # rain, lightning, visibility
            "ocean": 0.10,    # sea state, currents
            "gis": 0.10,      # distance offshore, restricted-zone proximity
        }
    )

    # Category thresholds (upper bound of each band, 0-100).
    #
    # NOTE: we reserve EXTREME (80+) for conditions where an official severe
    # warning is active or the sea state is life-threatening, so that "EXTREME"
    # always means "do not launch, no judgement call". HIGH therefore extends
    # to 79.
    thresholds: Dict[str, int] = field(
        default_factory=lambda: {"LOW": 25, "MODERATE": 50, "HIGH": 79, "EXTREME": 100}
    )

    # --- deterministic safety floors -------------------------------------
    # Applied AFTER the weighted score. A floor can only raise a score, never
    # lower it, so official warnings always dominate the model output.
    severe_warning_floor: int = 92     # cyclone / tsunami / severe marine warning
    fishermen_warning_floor: int = 70  # "fishermen advised not to venture"
    wave_danger_m: float = 4.0
    wave_danger_floor: int = 85
    wind_danger_kmh: float = 62.0      # ~34 kt, gale force
    wind_danger_floor: int = 85
    restricted_zone_floor: int = 60

    def categorise(self, score: float) -> str:
        s = round(score)
        if s <= self.thresholds["LOW"]:
            return "LOW"
        if s <= self.thresholds["MODERATE"]:
            return "MODERATE"
        if s <= self.thresholds["HIGH"]:
            return "HIGH"
        return "EXTREME"


RISK = RiskConfig()


# --------------------------------------------------------------------------
# Geofencing
# --------------------------------------------------------------------------
GEOFENCE_WARN_KM = 5.0     # warn when this close to a restricted zone
GEOFENCE_ALERT_KM = 2.5    # urgent alert threshold


# --------------------------------------------------------------------------
# Provenance labels
# --------------------------------------------------------------------------
SOURCE_LABELS = {
    "INCOIS": "INCOIS (Indian National Centre for Ocean Information Services)",
    "IMD": "IMD (India Meteorological Department)",
    "MOSDAC": "ISRO MOSDAC",
    "OPEN_METEO": "Open-Meteo Marine (open fallback source)",
    "DEMO": "ORCA demo dataset — SIMULATED, not official data",
    "ORCA_GIS": "ORCA geospatial layer (OpenStreetMap derived)",
}

# Text appended to every synthetic value so simulated data can never be
# mistaken for a live government feed.
DEMO_DISCLAIMER = "Demo / simulated data — not a live government feed"
