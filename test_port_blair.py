import sys
import os
sys.path.insert(0, os.path.abspath("backend"))

from app.data.providers.incois import incois_provider
from datetime import datetime

points = [
  (11.62, 92.73),
  (11.50, 92.70),
  (11.40, 92.80),
  (11.30, 92.90)
]

resp = incois_provider.fetch_pfz_zones(0, 0, datetime.now())
for lat, lon in points:
    pt_resp = incois_provider._process_geojson(incois_provider._cache["pfz_wfs"][0], lat, lon)
    if pt_resp.data["zones"]:
        nearest = pt_resp.data["zones"][0]
        print(f"{lat},{lon} -> {nearest['distance_km']}km, {nearest['rationale']}")
    else:
        print(f"{lat},{lon} -> No zones")
