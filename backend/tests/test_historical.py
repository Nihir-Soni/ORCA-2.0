import pytest
import os
import sys
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas import Location, Intent
from app.agents.intent_agent import _extract_date_range
from app.services.historical.trends import calculate_statistics, pearson_correlation
from app.services.historical.service import analyze_historical_data
from app.agents import planner

def test_extract_last_7_days():
    base = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
    start, end = _extract_date_range("How was the weather last 7 days?", base)
    assert start == "2026-09-12"
    assert end == "2026-09-19"

def test_extract_last_30_days():
    base = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
    start, end = _extract_date_range("chlorophyll last month", base)
    assert start == "2026-08-20"
    assert end == "2026-09-19"

def test_extract_last_3_months():
    base = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
    start, end = _extract_date_range("currents last 3 months", base)
    assert start == "2026-06-21"
    assert end == "2026-09-19"

def test_statistics_chl():
    values = [0.1, 0.2, 0.3, 0.4, 0.5]
    stats = calculate_statistics(values)
    assert stats["first"] == 0.1
    assert stats["last"] == 0.5
    assert stats["min"] == 0.1
    assert stats["max"] == 0.5
    assert stats["mean"] == 0.3
    assert stats["change"] == 0.4
    assert stats["change_percent"] == 400.0

def test_statistics_increasing_trend():
    values = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0]
    stats = calculate_statistics(values)
    assert stats["trend"] == "increasing"

def test_statistics_increasing_current_series():
    # A real world example where endpoints are 0.71 and 0.88
    # Earlier logic incorrectly labelled this as decreasing due to mid-series noise
    values = [0.71, 0.95, 0.94, 0.93, 0.95, 0.92, 0.9, 0.84, 0.84, 0.83, 0.85, 0.86, 0.88]
    stats = calculate_statistics(values)
    assert stats["first"] == 0.71
    assert stats["last"] == 0.88
    assert stats["trend"] == "increasing"

def test_statistics_decreasing_trend():
    values = [2.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0]
    stats = calculate_statistics(values)
    assert stats["trend"] == "decreasing"

def test_statistics_stable_trend():
    values = [1.0, 1.01, 0.99, 1.02, 1.0, 1.01, 0.99, 1.0]
    stats = calculate_statistics(values)
    assert stats["trend"] == "stable"

def test_insufficient_trend_data():
    values = [1.0, 2.0]
    stats = calculate_statistics(values)
    assert stats["trend"] == "insufficient_data"

def test_pearson_correlation():
    x = [1, 2, 3, 4, 5]
    y = [2, 4, 6, 8, 10]
    corr = pearson_correlation(x, y)
    assert corr == 1.0

def test_pearson_correlation_inverse():
    x = [1, 2, 3, 4, 5]
    y = [10, 8, 6, 4, 2]
    corr = pearson_correlation(x, y)
    assert corr == -1.0

def test_insufficient_correlation_data():
    x = [1, 2]
    y = [2, 4]
    corr = pearson_correlation(x, y)
    assert corr is None

@patch("app.services.historical.service.fetch_historical_chl")
@patch("app.services.historical.service.fetch_historical_chl_metadata")
@patch("app.services.historical.service.fetch_historical_marine")
@patch("app.services.historical.service.fetch_historical_weather")
def test_strict_out_of_coverage(mock_weather, mock_marine, mock_chl_meta, mock_chl_data):
    # Setup mock data for CHL that is older than the requested range
    mock_chl_meta.return_value = {
        "dataset": "cmems_obs_my",
        "coverage_start": "2025-01-01",
        "coverage_end": "2025-12-31"
    }
    # Requesting dates in 2026
    start_date = "2026-08-01"
    end_date = "2026-08-30"
    
    mock_marine.return_value = {
        "hourly": {
            "time": ["2026-08-01T00:00", "2026-08-02T00:00"],
            "sea_surface_temperature": [28.0, 28.5],
            "ocean_current_velocity": [0.5, 0.6]
        }
    }
    
    mock_weather.return_value = {
        "hourly": {
            "time": ["2026-08-01T00:00", "2026-08-02T00:00"],
            "temperature_2m": [30.0, 31.0],
            "wind_speed_10m": [10.0, 15.0],
            "precipitation": [0.0, 2.0]
        }
    }
    
    loc = Location(latitude=12.0, longitude=74.0, name="Test")
    evidence = analyze_historical_data(loc, start_date, end_date)
    
    assert evidence["overall_status"] == "PARTIAL_LIVE"
    assert evidence["availability"]["chlorophyll"]["status"] == "UNAVAILABLE"
    assert evidence["availability"]["sst"]["status"] == "AVAILABLE"
    assert evidence["availability"]["weather"]["status"] == "AVAILABLE"
    
def test_planner_historical_routing():
    with patch("app.agents.planner.analyze_historical_data") as mock_analyze:
        mock_analyze.return_value = {
            "overall_status": "LIVE",
            "variables": {},
            "correlations": [],
            "provenance": [],
            "availability": {}
        }
        
        # Make intent a historical one
        from app.schemas import ChatRequest
        from app.data.geo import DEFAULT_PORT
        
        req = ChatRequest(session_id="test", message="chlorophyll last 30 days", language="en")
        
        with patch("app.agents.intent_agent.run") as mock_intent:
            mock_intent.return_value = MagicMock(
                ok=True,
                data={
                    "intent": "historical_analysis",
                    "activity": "fishing",
                    "location_text": "Mangalore",
                    "date": "2026-09-19",
                    "start_date": "2026-08-20",
                    "end_date": "2026-09-19",
                    "time": "12:00",
                    "language": "en",
                    "raw_query": "chlorophyll last 30 days",
                    "needs": ["historical"],
                    "missing": [],
                    "intent_source": "GROQ_LLM"
                },
                location=Location(latitude=12.0, longitude=74.0, name="Test"),
                mode="STATIC",
                source="GROQ"
            )
            
            with patch("app.agents.explanation_agent.run") as mock_expl:
                mock_expl.return_value = MagicMock(
                    ok=True,
                    data={"answer": "Historical answer", "evidence": []},
                    source="ORCA",
                    mode="LIVE",
                    timestamp="2026-09-19"
                )
                
                resp = planner.handle(req)
                assert mock_analyze.called
                assert resp.historical is not None


# ---- Endpoint tests for GET /api/historical --------------------------------

MOCK_HISTORICAL_RESULT = {
    "analysis_type": "historical_marine_analysis",
    "location": {"lat": 12.9, "lon": 74.8},
    "period": {"start": "2026-08-20", "end": "2026-09-19"},
    "variables": {
        "chlorophyll": {
            "statistics": {
                "first": 4.63, "last": 11.65, "mean": 8.40,
                "min": 1.04, "max": 15.60, "change": 7.02,
                "change_percent": 151.62, "trend": "increasing", "observation_count": 23
            },
            "timeseries": {
                "dates": ["2026-08-20", "2026-08-21"],
                "values": [4.63, 5.10]
            }
        }
    },
    "correlations": [],
    "provenance": [{"provider": "Copernicus Marine", "variable": "CHL"}],
    "availability": {"chlorophyll": {"status": "AVAILABLE"}},
    "overall_status": "LIVE"
}


@patch("app.api.historical.analyze_historical_data", return_value=MOCK_HISTORICAL_RESULT)
def test_historical_endpoint_returns_timeseries(mock_analyze):
    """GET /api/historical must return full timeseries (not stripped)."""
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/api/historical?lat=12.9&lon=74.8&days=30")
    assert resp.status_code == 200
    body = resp.json()
    # Timeseries must be present — this is the key difference from the LLM path
    assert "variables" in body
    assert "period" in body
    assert "location" in body
    assert body["period"]["days_requested"] == 30
    assert body["location"]["latitude"] == 12.9


@patch("app.api.historical.analyze_historical_data", return_value=MOCK_HISTORICAL_RESULT)
def test_historical_endpoint_invalid_days(_mock):
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/api/historical?lat=12.9&lon=74.8&days=14")
    # 14 is not a valid choice — FastAPI Literal validation returns 422
    assert resp.status_code == 422


@patch("app.api.historical.analyze_historical_data", return_value=MOCK_HISTORICAL_RESULT)
def test_historical_endpoint_7_days(_mock):
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/api/historical?lat=12.9&lon=74.8&days=7")
    assert resp.status_code == 200
    body = resp.json()
    assert body["period"]["days_requested"] == 7


@patch("app.api.historical.analyze_historical_data", return_value=MOCK_HISTORICAL_RESULT)
def test_historical_endpoint_90_days(_mock):
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    resp = client.get("/api/historical?lat=12.9&lon=74.8&days=90")
    assert resp.status_code == 200
    body = resp.json()
    assert body["period"]["days_requested"] == 90

