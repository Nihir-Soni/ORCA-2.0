from datetime import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import ProviderResponse, ProviderMetadata

client = TestClient(app)

def mock_incois_response(distances_km):
    zones = []
    for i, d in enumerate(distances_km):
        zones.append({
            "rank": i + 1,
            "latitude": 15.0 + (d / 111.0),
            "longitude": 70.0,
            "distance_km": d,
            "bearing": "N",
            "confidence": 1.0,
            "rationale": "Mock",
            "source": "INCOIS_WFS",
            "timestamp": "2023-01-01T00:00:00Z"
        })
    return ProviderResponse(
        data={"zones": zones},
        metadata=ProviderMetadata(
            source="INCOIS_WFS",
            valid_time="2023-01-01T00:00:00Z",
            mode="LIVE",
            confidence=1.0,
            note="Mock"
        ),
        timestamp="2023-01-01T00:00:00Z"
    )

@patch("app.agents.pfz_agent.live_enabled", return_value=True)
@patch("app.data.providers.incois.incois_provider.fetch_pfz_zones")
def test_fishing_api_no_nearby_pfz(mock_fetch, mock_live):
    # Mock INCOIS returning features but all > 100km away
    mock_fetch.return_value = mock_incois_response([150.0, 200.0])
    
    res = client.get("/api/fishing?lat=15.0&lon=70.0&radius_km=100")
    assert res.status_code == 200
    data = res.json()
    
    assert data["pfz_status"] == "NO_NEARBY_PFZ"
    assert data["total_available"] == 2
    assert data["nearest_distance_km"] == 150.0
    assert len(data["areas"]) == 0

@patch("app.agents.pfz_agent.live_enabled", return_value=True)
@patch("app.data.providers.incois.incois_provider.fetch_pfz_zones")
def test_fishing_api_available_pfz(mock_fetch, mock_live):
    # Mock INCOIS returning at least one feature < 100km away
    mock_fetch.return_value = mock_incois_response([50.0, 150.0])
    
    res = client.get("/api/fishing?lat=15.0&lon=70.0&radius_km=100")
    assert res.status_code == 200
    data = res.json()
    
    assert data["pfz_status"] == "AVAILABLE"
    assert data["total_available"] == 2
    assert data["nearest_distance_km"] == 50.0
    assert len(data["areas"]) == 1
    assert abs(data["areas"][0]["distance_km"] - 50.0) < 0.2

@patch("app.agents.pfz_agent.live_enabled", return_value=True)
@patch("app.data.providers.incois.incois_provider.fetch_pfz_zones")
def test_fishing_api_unavailable_pfz(mock_fetch, mock_live):
    # Mock INCOIS failure (returns None)
    mock_fetch.return_value = None
    
    res = client.get("/api/fishing?lat=15.0&lon=70.0&radius_km=100")
    assert res.status_code == 200
    data = res.json()
    
    assert data["pfz_status"] == "UNAVAILABLE"
    assert data["total_available"] == 0
    assert data["nearest_distance_km"] is None
    assert len(data["areas"]) == 0

@patch("app.agents.pfz_agent.live_enabled", return_value=False)
def test_fishing_api_demo_mode(mock_live):
    # In DEMO mode, pfz_agent uses demo_store which yields results
    res = client.get("/api/fishing?lat=15.0&lon=70.0&radius_km=100")
    assert res.status_code == 200
    data = res.json()
    
    # Depending on lat/lon, demo store might have areas. Let's just verify it's handled.
    assert data["pfz_status"] in ("AVAILABLE", "UNAVAILABLE", "NO_NEARBY_PFZ")
