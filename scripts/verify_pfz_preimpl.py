"""
Pre-implementation verification: 7 questions about probability() call sites,
ambient_sst origin, _front_factor behavior, factor defaults, concurrency,
freshness, and terminology.
"""
import sys, ast, textwrap
from pathlib import Path

ROOT = Path("backend/app")

# ============================================================
# Q1: All current callers of fishing.probability()
# ============================================================
print("=" * 60)
print("Q1: ALL CALLERS OF fishing.probability()")
print("=" * 60)

callers = {
    "fishing.py (API) — _zone_payload() L63": {
        "file": "backend/app/api/fishing.py",
        "line": 63,
        "inputs": "chlorophyll=z.get('chlorophyll_mg_m3'), sst=z.get('sst_c'), ambient_sst=ambient_sst, wave_m=z.get('wave_height_m'), hour=hour",
        "data_source": "pfz_agent zones (INCOIS live or demo_store)",
        "ambient_sst_source": "ocean_agent.run().data.get('sst_c') at USER position",
        "note": "THIS IS THE BROKEN CALL — INCOIS zones have no env data"
    },
    "fishing.py (API) — forecast loop L211": {
        "file": "backend/app/api/fishing.py",
        "line": 211,
        "inputs": "chlorophyll=probe['chl'], sst=probe['sst'], ambient_sst=probe['sst']-0.6, wave_m=day_waves[h], hour=h",
        "data_source": "demo_store.conditions() — ALWAYS demo data",
        "ambient_sst_source": "probe['sst'] - 0.6  (synthetic offset)",
        "note": "Always has real demo values; never None. NOT broken."
    },
    "fishing.py (service) — best_hours() L181": {
        "file": "backend/app/services/fishing.py",
        "line": 181,
        "inputs": "chlorophyll=..., sst=..., ambient_sst=..., wave_m=wave_by_hour.get(h), hour=h",
        "data_source": "Passed in from fishing_outlook() caller using top_zone env data",
        "ambient_sst_source": "ambient_sst from ocean_agent at user position",
        "note": "Called inside fishing.best_hours() — inherits whatever caller passes"
    }
}

for name, c in callers.items():
    print(f"\n  CALLER: {name}")
    print(f"    File:    {c['file']} L{c['line']}")
    print(f"    Inputs:  {c['inputs']}")
    print(f"    Source:  {c['data_source']}")
    print(f"    Ambient: {c['ambient_sst_source']}")
    print(f"    NOTE:    {c['note']}")


# ============================================================
# Q2: Exact meaning and source of ambient_sst
# ============================================================
print()
print("=" * 60)
print("Q2: ambient_sst — EXACT MEANING AND SOURCE")
print("=" * 60)
print("""
  MEANING:
    ambient_sst = SST at the FISHER'S LOCATION (not at the PFZ zone).
    It represents the "background water temperature" surrounding the boat.
    It is used ONLY inside _front_factor() to compute thermal contrast:
      delta = abs(zone_sst - ambient_sst)
      front_factor = min(1.0, 0.10 + delta * 0.80)
    A bigger delta = stronger thermal front = higher score.
    ambient_sst alone does NOT affect the SST factor; that uses zone_sst.

  SOURCE (LIVE mode):
    fishing.py L131: ambient_sst = ocean.data.get("sst_c")
    ocean.data["sst_c"] comes from open_meteo_provider.fetch_marine()
    at (location.latitude, location.longitude) — the FISHER'S coordinates.
    This is SST from Open-Meteo Marine API at the user's position.

  SOURCE (DEMO mode):
    demo_store.conditions(location.name, when)["sst"] — synthetic value.

  IMPORTANT:
    ambient_sst can be None in LIVE mode if Open-Meteo Marine fails.
    If ambient_sst is None -> _front_factor() returns 0.35 default.
    This means the FRONT factor also silently includes a phantom default
    even when the user's SST is unavailable.
""")


# ============================================================
# Q3: _front_factor() when SST is unavailable
# ============================================================
print("=" * 60)
print("Q3: _front_factor() BEHAVIOR WHEN SST IS UNAVAILABLE")
print("=" * 60)

# Reproduce the function exactly as in the source
def _front_factor(zone_sst, ambient_sst):
    if zone_sst is None or ambient_sst is None:
        return 0.35
    delta = abs(zone_sst - ambient_sst)
    return min(1.0, 0.10 + delta * 0.80)

cases = [
    (None,  None,  "zone=None,  ambient=None"),
    (28.5,  None,  "zone=28.5,  ambient=None"),
    (None,  28.0,  "zone=None,  ambient=28.0"),
    (28.5,  28.0,  "zone=28.5,  ambient=28.0  (delta=0.5)"),
    (30.0,  28.0,  "zone=30.0,  ambient=28.0  (delta=2.0)"),
]

print("  _front_factor results:")
for z, a, label in cases:
    result = _front_factor(z, a)
    phantom = " *** PHANTOM DEFAULT ***" if z is None or a is None else ""
    print(f"    {label:42s} -> {result:.3f}{phantom}")

print("""
  CONCLUSION:
    _front_factor() has a phantom default of 0.35 whenever EITHER input is None.
    - If zone_sst is None: returns 0.35  (even if ambient_sst is known)
    - If ambient_sst is None: returns 0.35  (even if zone_sst is known)
    
    IMPLICATION FOR THE FIX:
      The front factor requires BOTH zone_sst AND ambient_sst to be non-None.
      If zone_sst is None (INCOIS case), front factor must be EXCLUDED from scoring
      (not defaulted to 0.35) per the fix requirement.
      Similarly, if ambient_sst is None, front factor is also excluded.
""")


# ============================================================
# Q4: Default factor behavior — which ones include phantoms?
# ============================================================
print("=" * 60)
print("Q4: DEFAULT PHANTOM VALUES PER FACTOR")
print("=" * 60)

def _curve(value, points, default=0.3):
    if value is None: return default
    if value <= points[0][0]: return points[0][1]
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if value <= x1:
            return y0 + (y1 - y0) * (value - x0) / ((x1 - x0) or 1e-9)
    return points[-1][1]

def _sst_factor(sst):
    if sst is None: return 0.4
    lo, hi = 26.5, 29.0
    if lo <= sst <= hi: return 1.0
    drift = (lo - sst) if sst < lo else (sst - hi)
    return max(0.15, 1.0 - (drift / 3.0) * 0.85)

def _sea_state_factor(wave_m):
    if wave_m is None: return 0.5
    if wave_m <= 1.2: return 1.0
    if wave_m >= 3.0: return 0.12
    span = 3.0 - 1.2
    return max(0.12, 1.0 - 0.88 * (wave_m - 1.2) / span)

TIME_OF_DAY = {
    0: 0.55, 1: 0.50, 2: 0.50, 3: 0.60, 4: 0.78, 5: 0.95,
    6: 1.00, 7: 0.96, 8: 0.86, 9: 0.74, 10: 0.66, 11: 0.60,
    12: 0.56, 13: 0.56, 14: 0.60, 15: 0.68, 16: 0.80, 17: 0.93,
    18: 0.98, 19: 0.90, 20: 0.78, 21: 0.68, 22: 0.62, 23: 0.58,
}
CHL_CURVE = [(0.0, 0.03), (0.3, 0.14), (0.6, 0.30), (1.0, 0.48),
             (1.5, 0.68), (2.0, 0.84), (3.0, 1.0)]
WEIGHTS = {"chlorophyll": 0.34, "sst": 0.20, "front": 0.16,
           "sea_state": 0.18, "time_of_day": 0.12}

factors_info = [
    ("chlorophyll", "chlorophyll_mg_m3", "INCOIS does NOT provide",
     _curve(None, CHL_CURVE), True),
    ("sst",         "sst_c",             "INCOIS does NOT provide",
     _sst_factor(None), True),
    ("front",       "zone_sst+ambient_sst", "INCOIS does NOT provide zone_sst",
     _front_factor(None, None), True),
    ("sea_state",   "wave_height_m",     "INCOIS does NOT provide",
     _sea_state_factor(None), True),
    ("time_of_day", "hour",              "Always available (wall clock, no observation needed)",
     TIME_OF_DAY[7], False),
]

print(f"  {'Factor':<12} {'Obs needed':<22} {'Default if None':<18} {'Phantom?'}")
print(f"  {'-'*12} {'-'*22} {'-'*18} {'-'*8}")
for name, obs, note, default, is_phantom in factors_info:
    tag = "YES — MUST EXCLUDE" if is_phantom else "N/A — always known"
    print(f"  {name:<12} {obs:<22} {default:<18.3f} {tag}")

print(f"""
  time_of_day:
    This factor has NO underlying observation. It is computed directly from the
    wall clock (hour). It is ALWAYS available.
    DECISION: time_of_day should always be INCLUDED in the score, even when
    all environmental inputs (chl/sst/wave) are None.
    Rationale: crepuscular patterns are real and don't require satellite data.
    However, if ALL env inputs are None, the score is dominated by time_of_day
    alone, which is misleading. Recommended rule:
      If at least ONE env observation (chl OR sst OR wave) is available:
          include time_of_day + all available env factors, renormalize.
      If ALL env observations are None:
          suitability = None (unavailable).
""")


# ============================================================
# Q5: PFZ environmental lookups — concurrency
# ============================================================
print("=" * 60)
print("Q5: PFZ ENVIRONMENTAL LOOKUPS — CONCURRENCY PLAN")
print("=" * 60)
print("""
  Current fishing_outlook() already uses ThreadPoolExecutor for:
    weather_agent, ocean_agent, cyclone_agent, gis_agent, pfz_agent
  All 5 run concurrently (max_workers=5).

  NEW enrichment plan:
    After pfz_agent returns zone geometries, enrich each zone concurrently:

    with ThreadPoolExecutor(max_workers=min(len(zones), 8)) as pool:
        marine_futures = {
            z["id"]: pool.submit(
                open_meteo_provider.fetch_marine, z["latitude"], z["longitude"], now
            )
            for z in zones
        }
        chl_futures = {
            z["id"]: pool.submit(
                copernicus_provider.fetch_chlorophyll, z["latitude"], z["longitude"], now
            )
            for z in zones
        }
        # collect results...

  Open-Meteo: 1 HTTP call per unique (lat, lon) rounded to 0.01°.
    Cache TTL: 600s. Zones within 0.01° share the same cache entry.
    For 5 zones at different locations: ≤5 HTTP calls in parallel.

  Copernicus/Redis: 1 HTTP call to Upstash per unique (lat, lon) rounded to 0.1°.
    In-process cache TTL: 24h. Very fast if Redis is warm.

  Total added latency estimate: ~200-400ms (Open-Meteo, in parallel)
    vs current 0ms (but producing wrong scores).

  IMPORTANT: The enrichment happens in incois.py _process_geojson(),
  NOT inside the ThreadPoolExecutor that wraps pfz_agent.run().
  The per-zone lookups run INSIDE _process_geojson() as a second-level pool.
""")


# ============================================================
# Q6: valid_time / freshness before scoring
# ============================================================
print("=" * 60)
print("Q6: VALID_TIME / FRESHNESS BEFORE SCORING")
print("=" * 60)
print("""
  Open-Meteo Marine (SST + wave):
    - Returns hourly series; _pick_hour_index() selects the entry matching `when`.
    - valid_time = times[i] from the series (a real forecast timestamp).
    - Cache TTL: 600s. If cache hit, valid_time comes from when it was fetched.
    - Staleness: No explicit stale guard beyond the 600s TTL.
    - PLAN: Expose valid_time in environmental_inputs; label stale=False for fresh
      fetches (< 600s). Open-Meteo Marine data is NWP forecast — always "current."

  Copernicus Chlorophyll (Upstash Redis):
    - _is_stale() checks fetched_at from Redis metadata.
    - Stale threshold: 48 hours.
    - If stale: fetch_chlorophyll() returns None -> chlorophyll treated as unavailable.
    - valid_time: _valid_time_chlorophyll from Redis metadata (L4 product date).
    - PLAN: Include valid_time in environmental_inputs; set stale=True if
      _is_stale() was True at time of fetch (fetch_chlorophyll returns None,
      so stale chl = missing chl = excluded from score).

  VERIFICATION RULE (per the spec):
    Before using an observation in scoring:
      1. Provider must return non-None result.
      2. Copernicus: _is_stale() must have returned False at fetch time.
      3. Open-Meteo: result.metadata.valid_time must be present (non-empty).
    If any check fails -> that input is treated as unavailable (None).
    The existing _is_stale() and provider return-None conventions already
    implement this — we do not need additional freshness logic.
""")


# ============================================================
# Q7: Frontend terminology
# ============================================================
print("=" * 60)
print("Q7: FRONTEND TERMINOLOGY — COMPLETE INVENTORY")
print("=" * 60)
print("""
  CURRENT OCCURRENCES OF WRONG TERMINOLOGY (exact file:line):

  FishingPanel.tsx L240:
    "{words[a.rating]} · {t.chance}"
    t.chance = "chance" (en) / "मछली की उम्मीद" (hi) / "ಸಾಧ್ಯತೆ" (kn)
    -> CHANGE TO: t.suitability = "ORCA Environmental Suitability"

  FishingPanel.tsx L265-L273 (Probability block):
    {a.probability}%
    Progress bar: width={a.probability}%
    -> CHANGE TO:
       if (a.environmental_data_available): "{a.environmental_suitability} / 100"
       else: "—" + "Environmental data unavailable"

  FishingPanel.tsx L494:
    {f.probability}<span>%</span>   (3-day forecast)
    -> This is FORECAST probability from demo_store — DIFFERENT from zone suitability.
    -> KEEP as-is (it uses real demo data, has full inputs, is correct).
    -> But label it differently: "ORCA score" not "chance."

  MarineMap.tsx L609:
    `${a.probability}%`  (buoy marker sub-label)
    -> CHANGE TO: a.environmental_data_available ? `${a.environmental_suitability}/100` : "—"

  MarineMap.tsx L615:
    `${a.probability}% chance of fish`  (popup text)
    -> CHANGE TO: "ORCA Environmental Suitability: X / 100"
       + "Not a probability of catching fish."

  CONFIRMED CORRECT FINAL TERMINOLOGY:
    Panel heading label:   "ORCA Environmental Suitability"
    Score display:         "81 / 100"
    When unavailable:      "Environmental data unavailable"
    Tooltip/footnote:      "ORCA's deterministic score based on available marine
                            conditions and the official INCOIS PFZ advisory.
                            It is not a probability of catching fish."
    NEVER say:             "% chance of finding fish"
    NEVER say:             "probability of finding fish"
    NEVER say:             "81% chance"
""")

print()
print("=" * 60)
print("ALL 7 VERIFICATION QUESTIONS ANSWERED.")
print("=" * 60)
