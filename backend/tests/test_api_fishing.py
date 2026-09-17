from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest

from app.api import fishing
from app.config import get_data_mode, set_data_mode
from app.schemas import Location, AgentResult, ProviderResponse, ProviderMetadata

@pytest.fixture(autouse=True)
def restore_data_mode():
    previous = get_data_mode()
    yield
    set_data_mode(previous)

def test_live_mode_successful_incois():
    set_data_mode("LIVE")
    
    mock_incois_response = ProviderResponse(
        data={"zones": [
            {"latitude": 19.1, "longitude": 72.1, "distance_km": 10.0, "bearing": "NW", "confidence": 1.0, "rationale": "MH (UID: PFZ_1)", "source": "INCOIS_WFS"}
        ]},
        metadata=ProviderMetadata(source="INCOIS_WFS", mode="LIVE", valid_time="2026-09-17T00:00:00Z"),
        timestamp="2026-09-17T00:00:00Z"
    )
    
    with patch("app.agents.pfz_agent.incois_provider.fetch_pfz_zones", return_value=mock_incois_response):
        with patch("app.agents.weather_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="weather")):
            with patch("app.agents.ocean_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="ocean")):
                with patch("app.agents.cyclone_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="cyclone")):
                    with patch("app.agents.gis_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="gis")):
                        with patch("app.agents.risk_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="risk")):
                            response = fishing.fishing_outlook(lat=19.0, lon=72.0, radius_km=100.0, days=3, lang="en")
    
    areas = response.get("areas", [])
    assert len(areas) == 1
    assert areas[0]["source"] == "INCOIS_WFS"
    assert "MH (UID: PFZ_1)" in areas[0]["rationale"]

def test_live_mode_incois_unavailable():
    set_data_mode("LIVE")
    
    with patch("app.agents.pfz_agent.incois_provider.fetch_pfz_zones", return_value=None):
        with patch("app.agents.weather_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="weather")):
            with patch("app.agents.ocean_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="ocean")):
                with patch("app.agents.cyclone_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="cyclone")):
                    with patch("app.agents.gis_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="gis")):
                        with patch("app.agents.risk_agent.run", return_value=AgentResult(ok=True, data={}, mode="LIVE", agent="risk")):
                            response = fishing.fishing_outlook(lat=19.0, lon=72.0, radius_km=100.0, days=3, lang="en")
    
    areas = response.get("areas", [])
    assert len(areas) == 0

def test_demo_mode_returns_demo():
    set_data_mode("DEMO")
    
    mock_demo_zones = [
        {"latitude": 19.1, "longitude": 72.1, "distance_km": 10.0, "bearing": "NW", "source": "DEMO"}
    ]
    
    with patch("app.data.demo_store.pfz_zones", return_value=mock_demo_zones):
        with patch("app.agents.weather_agent.run", return_value=AgentResult(ok=True, data={}, mode="DEMO", agent="weather")):
            with patch("app.agents.ocean_agent.run", return_value=AgentResult(ok=True, data={}, mode="DEMO", agent="ocean")):
                with patch("app.agents.cyclone_agent.run", return_value=AgentResult(ok=True, data={}, mode="DEMO", agent="cyclone")):
                    with patch("app.agents.gis_agent.run", return_value=AgentResult(ok=True, data={}, mode="DEMO", agent="gis")):
                        with patch("app.agents.risk_agent.run", return_value=AgentResult(ok=True, data={}, mode="DEMO", agent="risk")):
                            response = fishing.fishing_outlook(lat=19.0, lon=72.0, radius_km=100.0, days=3, lang="en")
    
    areas = response.get("areas", [])
    assert len(areas) == 1
    assert areas[0]["source"] == "DEMO"
