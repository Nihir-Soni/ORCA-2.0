#!/usr/bin/env python3
"""Quick test: verify nearest-neighbour CHL fallback resolves all major harbours."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

from app.services.historical.providers.copernicus import (
    fetch_historical_chl,
    fetch_historical_chl_metadata,
)

meta = fetch_historical_chl_metadata()
print(f"Metadata: {meta}\n")

TEST_COORDS = [
    ("Mangalore",        12.8698, 74.8427),
    ("Mumbai",           18.9220, 72.8347),
    ("Kochi",             9.9312, 76.2673),
    ("Chennai",          13.0827, 80.2707),
    ("Visakhapatnam",    17.6868, 83.2185),
    ("Balasore/Paradip", 20.3181, 86.6094),
    ("Goa Panaji",       15.4909, 73.8278),
    ("Tuticorin",         8.7642, 78.1348),
    ("Port Blair",       11.6234, 92.7265),
    ("Karwar",           14.8136, 74.1278),
    ("Ratnagiri",        16.9902, 73.3120),
]

ok = 0
miss = 0
for name, lat, lon in TEST_COORDS:
    data = fetch_historical_chl(lat, lon)
    if data:
        print(f"  OK   {name}: {len(data)} obs  [{data[0]['time']} -> {data[-1]['time']}]")
        ok += 1
    else:
        print(f"  MISS {name}: no data within 0.3 deg of ({round(lat,1)}, {round(lon,1)})")
        miss += 1

print(f"\n{ok}/{ok+miss} harbours resolved.")
