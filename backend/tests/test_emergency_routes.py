import pytest
from app.services.route_optimizer import plan_emergency_route
from app.data.geo import PORTS, haversine_km

def test_emergency_route_coastal_logic():
    # A point far offshore, off Ratnagiri (16.99, 73.31)
    # Origin: (17.0, 71.5)
    origin = (17.0, 71.5)
    route = plan_emergency_route(origin)
    
    assert route is not None
    assert route["destination"]["name"].startswith("Coast near")
    
    # Ratnagiri is approx (16.99, 73.31)
    # The coast point should be close to Ratnagiri, but might not be exactly it.
    # The distance should be roughly around 150-180 km
    assert 100 < route["distance_km"] < 200
    assert route["risk_score"] >= 40
    
    # Path should start at origin and end at destination
    assert route["waypoints"][0]["latitude"] == origin[0]
    assert route["waypoints"][0]["longitude"] == origin[1]
    
    dest_lat = route["destination"]["latitude"]
    dest_lon = route["destination"]["longitude"]
    assert route["waypoints"][-1]["latitude"] == pytest.approx(dest_lat, abs=0.1)
    assert route["waypoints"][-1]["longitude"] == pytest.approx(dest_lon, abs=0.1)

def test_emergency_route_on_land():
    # Somewhere deep in Maharashtra
    origin = (19.0, 75.0)
    route = plan_emergency_route(origin)
    assert route is None

def test_emergency_route_near_coast():
    # Very close to coast
    origin = (18.9, 72.8) # Just off Mumbai
    route = plan_emergency_route(origin)
    assert route is not None
    assert route["distance_km"] < 30.0
    assert "Mumbai" in route["destination"]["name"]

