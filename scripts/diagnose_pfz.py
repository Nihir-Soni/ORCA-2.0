"""
Diagnose: why does every PFZ show 44% probability?
"""
import sys
sys.path.insert(0, '.')

from backend.app.services.fishing import (
    probability, _curve, CHL_CURVE, _sst_factor, _sea_state_factor,
    _front_factor, time_of_day_factor, WEIGHTS
)

print("=" * 60)
print("1. DEFAULT FALLBACK VALUES (all inputs = None)")
print("=" * 60)
defaults = {
    "chlorophyll": _curve(None, CHL_CURVE),
    "sst":         _sst_factor(None),
    "front":       _front_factor(None, None),
    "sea_state":   _sea_state_factor(None),
    "time_of_day": time_of_day_factor(7),
}
for k, v in defaults.items():
    print(f"  {k}: {v}  (weight={WEIGHTS[k]})")

score = sum(WEIGHTS[k] * v for k, v in defaults.items())
prob = round(min(100.0, max(0.0, score * 100)))
print(f"\n  Raw weighted sum = {score:.4f}")
print(f"  Probability = {prob}%")

print()
print("=" * 60)
print("2. PROBABILITY AT DIFFERENT HOURS (all inputs None)")
print("=" * 60)
for h in [0, 5, 6, 7, 8, 9, 12, 13, 18, 19, 23]:
    r = probability(chlorophyll=None, sst=None, ambient_sst=None, wave_m=None, hour=h)
    print(f"  hour={h:2d} -> {r['probability']}%  (time_factor={r['factors']['time_of_day']})")

print()
print("=" * 60)
print("3. WHAT INCOIS LIVE PATH PROVIDES (geometry only, no env data)")
print("=" * 60)
print("  From incois.py _process_geojson():")
print("  - latitude, longitude: from WFS geometry (nearest point on MultiLineString)")
print("  - distance_km, bearing: computed by ORCA")
print("  - confidence: HARDCODED to 1.0")
print("  - sst_c: NOT SET (missing key - will be None)")
print("  - chlorophyll_mg_m3: NOT SET (missing key - will be None)")
print("  - wave_height_m: NOT SET (missing key - will be None)")
print()
print("  Then in _zone_payload (fishing.py API):")
print("  - z.get('chlorophyll_mg_m3') -> None")
print("  - z.get('sst_c') -> None")
print("  - z.get('wave_height_m') -> None")
print("  - ambient_sst -> ocean_agent.run().data.get('sst_c') -> varies by location")
print()
print("  => fishing.probability(chlorophyll=None, sst=None, ambient_sst=X, wave_m=None, hour=H)")

print()
print("=" * 60)
print("4. PROBABILITY WITH NONE CHL/SST, ambient_sst present")
print("=" * 60)
print("  Note: front_factor needs BOTH zone_sst AND ambient_sst non-None.")
print("  If zone_sst=None, _front_factor returns default=0.35 regardless of ambient_sst.")
for h in [7, 12, 18]:
    r = probability(chlorophyll=None, sst=None, ambient_sst=28.0, wave_m=None, hour=h)
    print(f"  hour={h}, ambient_sst=28.0 -> {r['probability']}%  factors={r['factors']}")

print()
print("=" * 60)
print("5. DEMO PATH: What values ARE provided per zone")
print("=" * 60)
from backend.app.data.demo_store import conditions, _CANDIDATE_LAYOUT, scenario_for

for loc in ["Mumbai", "Kochi", "Paradip"]:
    cond = conditions(loc)
    print(f"\n  Location: {loc} (scenario={scenario_for(loc)})")
    print(f"  Base cond: chl={cond['chl']}, sst={cond['sst']}, wave={cond['wave']}")
    for i, spec in enumerate(_CANDIDATE_LAYOUT[:3]):
        chl = round(cond["chl"] * spec["chl_mult"], 2)
        sst = round(cond["sst"] + spec["sst_delta"], 1)
        wave = round(max(0.3, cond["wave"] - 0.25 - 0.03 * (i+1)), 2)
        r = probability(chlorophyll=chl, sst=sst, ambient_sst=cond["sst"], wave_m=wave, hour=7)
        print(f"  Zone {i+1}: chl={chl}, sst={sst}, wave={wave} -> {r['probability']}%")
