import pytest
from datetime import datetime
import os
from unittest.mock import patch, MagicMock
from shapely.geometry import Point

from app.data.providers.incois import INCOISProvider
from app.data.providers.imd import IMDProvider
from app.agents import pfz_agent, cyclone_agent, planner
from app.config import set_data_mode

# Mock INCOIS GeoJSON Response
MOCK_INCOIS_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "MultiLineString",
                "coordinates": [
                    [[72.88, 15.64], [72.9, 15.65]]
                ]
            },
            "properties": {
                "State_Name": "GOA",
                "UID": "12345"
            }
        }
    ]
}

# Mock IMD CAP XML Response
MOCK_IMD_CAP = """<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>test-alert</identifier>
  <sender>IMD</sender>
  <info>
    <event>Cyclone Warning</event>
    <severity>Severe</severity>
    <headline>Test Headline</headline>
    <description>Test Description</description>
    <area>
      <polygon>15.0,72.0 16.0,72.0 16.0,73.0 15.0,73.0 15.0,72.0</polygon>
    </area>
  </info>
</alert>
"""

MOCK_IMD_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <category>Met</category>
      <link>http://example.com/cap.xml</link>
    </item>
  </channel>
</rss>
"""

def test_incois_geojson_parsing_and_shapely():
    provider = INCOISProvider()
    
    # Process mock geojson
    lat, lon = 15.64, 72.88
    from datetime import datetime, timezone
    res = provider._process_geojson(MOCK_INCOIS_GEOJSON, lat, lon, when=datetime.now(timezone.utc))
    
    assert res is not None
    assert "zones" in res.data
    assert len(res.data["zones"]) == 1
    
    zone = res.data["zones"][0]
    assert zone["rationale"] == "GOA (UID: 12345)"
    assert zone["distance_km"] < 1.0 # Should be very close to the point
    assert "bearing" in zone
    assert zone["source"] == "INCOIS_WFS"

def test_imd_cap_geometry_parsing():
    provider = IMDProvider()
    
    # Boat inside the polygon (15.5, 72.5)
    lat_in, lon_in = 15.5, 72.5
    res_in = provider._process_alerts([MOCK_IMD_CAP], lat_in, lon_in)
    assert res_in is not None
    assert len(res_in.data["alerts"]) == 1
    assert res_in.data["alerts"][0]["inside_geometry"] == True

    # Boat outside the polygon (10.0, 70.0)
    lat_out, lon_out = 10.0, 70.0
    res_out = provider._process_alerts([MOCK_IMD_CAP], lat_out, lon_out)
    assert res_out is not None
    assert len(res_out.data["alerts"]) == 0 # Doesn't include because it's outside

@patch('app.agents.pfz_agent.live_enabled', return_value=True)
@patch('app.data.providers.incois.incois_provider.fetch_pfz_zones', return_value=None)
def test_live_mode_pfz_failure_never_reads_demo(mock_fetch, mock_live):
    from app.schemas import Location
    loc = Location(latitude=15.0, longitude=72.0, name="Test")
    res = pfz_agent.run(loc, datetime.now())
    
    assert res.mode == "UNAVAILABLE"
    assert len(res.data.get("zones", [])) == 0 # Empty, no fallback to demo

@patch('app.agents.cyclone_agent.live_enabled', return_value=True)
@patch('app.data.providers.imd.imd_provider.fetch_alerts', return_value=None)
def test_live_mode_cyclone_failure_never_reads_demo(mock_fetch, mock_live):
    from app.schemas import Location
    loc = Location(latitude=15.0, longitude=72.0, name="Test")
    res = cyclone_agent.run(loc, datetime.now())
    
    assert res.mode == "UNAVAILABLE"
    assert len(res.data.get("alerts", [])) == 0

@patch('app.agents.planner.get_data_mode', return_value="LIVE")
@patch('app.agents.pfz_agent.run')
@patch('app.agents.weather_agent.run')
@patch('app.agents.ocean_agent.run')
@patch('app.agents.cyclone_agent.run')
@patch('app.agents.gis_agent.run')
@patch('app.agents.intent_agent.run')
@patch('app.agents.risk_agent.run')
@patch('app.agents.route_agent.run')
@patch('app.agents.explanation_agent.run')
def test_planner_produces_partial_live_on_provider_failure(
    mock_expl, mock_route, mock_risk, mock_intent, mock_gis,
    mock_cyclone, mock_ocean, mock_weather, mock_pfz, mock_config
):
    from app.schemas import ChatRequest, Intent, AgentResult, Location
    
    mock_intent.return_value = AgentResult(agent="intent", data=Intent(needs=["weather", "ocean", "pfz", "cyclone", "gis", "risk", "route", "explanation"]).model_dump())
    
    loc = Location(latitude=15, longitude=72, name="Test")
    # PFZ returns UNAVAILABLE
    mock_pfz.return_value = AgentResult(agent="pfz", mode="UNAVAILABLE", location=loc)
    # Others return LIVE
    mock_weather.return_value = AgentResult(agent="weather", mode="LIVE", location=loc)
    mock_ocean.return_value = AgentResult(agent="ocean", mode="LIVE", location=loc)
    mock_cyclone.return_value = AgentResult(agent="cyclone", mode="LIVE", location=loc)
    mock_gis.return_value = AgentResult(agent="gis", mode="DEMO", location=loc)
    
    mock_risk.return_value = AgentResult(agent="risk", location=loc, ok=False)
    mock_route.return_value = AgentResult(agent="route", location=loc)
    mock_expl.return_value = AgentResult(agent="explanation", location=loc)
    
    req = ChatRequest(message="test", session_id="test")
    resp = planner.handle(req)
    
    assert resp.mode == "PARTIAL_LIVE"
