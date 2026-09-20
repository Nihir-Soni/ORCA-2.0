import asyncio
import httpx
from datetime import datetime
from shapely.geometry import shape, Point
from shapely.ops import nearest_points
import math
import time

def calculate_distance_km(p1: Point, p2: Point) -> float:
    R = 6371.0
    lat1, lon1 = math.radians(p1.y), math.radians(p1.x)
    lat2, lon2 = math.radians(p2.y), math.radians(p2.x)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def test_position(lat, lon, name):
    print(f"\n--- Testing Position {name} ---")
    print(f"Coordinates: lat={lat}, lon={lon}")
    
    params = {
        "service": "WFS",
        "version": "1.1.0",
        "request": "GetFeature",
        "typeName": "PFZ_Automation:pfzlines",
        "outputFormat": "application/json",
        "maxFeatures": 10000
    }
    
    for _ in range(3):
        try:
            resp = httpx.get("https://www.incois.gov.in/geoserver/PFZ_Automation/ows", params=params, timeout=30.0)
            resp.raise_for_status()
            geojson = resp.json()
            break
        except Exception as e:
            print(f"Failed to fetch WFS: {e}. Retrying...")
            time.sleep(2)
    else:
        print("Failed after 3 retries.")
        return

    features = geojson.get("features", [])
    print(f"Number of raw INCOIS features retrieved: {len(features)}")
    
    boat_pt = Point(lon, lat)
    zones = []
    
    for idx, feature in enumerate(features):
        geom = feature.get("geometry")
        if not geom or geom["type"] != "MultiLineString":
            continue
            
        s_geom = shape(geom)
        p_boat, p_nearest = nearest_points(boat_pt, s_geom)
        dist_km = calculate_distance_km(boat_pt, p_nearest)
        zones.append({
            "idx": idx,
            "dist_km": dist_km
        })
    
    zones.sort(key=lambda x: x["dist_km"])
    
    if zones:
        nearest_dist = zones[0]['dist_km']
        print(f"Nearest PFZ distance: {nearest_dist:.2f} km")
        print(f"Is nearest PFZ outside 100km radius? {'Yes' if nearest_dist > 100 else 'No'}")
        
        filtered = [z for z in zones if z['dist_km'] <= 100.0]
        print(f"Number remaining after geographic filtering (<=100km): {len(filtered)}")
        
        # pfz_agent.py count logic
        kept = filtered[:10]
        print(f"Returned PFZ count (max 10 in pfz_agent for fishing.py): {len(kept)}")
        
    else:
        print("No valid MultiLineString geometries found.")
        
test_position(15.49, 73.82, "A (Near Coast - Goa)")
test_position(15.0, 70.0, "B (Far Offshore - Arabian Sea)")
test_position(12.0, 85.0, "C (Far Offshore - Bay of Bengal)")
