from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.api.map import _intersects_coverage
from app.data.providers.open_meteo import OpenMeteoProvider
from app.config import LIVE_TIMEOUT_SECONDS, WEATHER_HAZARD_GRID_TIMEOUT_SECONDS
from app.data.providers.imd import imd_provider
from app.main import app


def test_wmo_weather_hazard_classes():
    assert OpenMeteoProvider.hazard_type_for_code(61) == "LIGHT_RAIN"
    assert OpenMeteoProvider.hazard_type_for_code(65) == "HEAVY_RAIN"
    assert OpenMeteoProvider.hazard_type_for_code(95) == "THUNDERSTORM"
    assert OpenMeteoProvider.hazard_type_for_code(3) is None


def test_hazard_grid_uses_its_dedicated_eight_second_client(monkeypatch):
    created_timeouts = []
    class Client:
        def __init__(self, timeout): created_timeouts.append(timeout)
    monkeypatch.setattr("app.data.providers.open_meteo.httpx.Client", Client)
    provider = OpenMeteoProvider()
    provider._hazard_http()
    assert created_timeouts == [WEATHER_HAZARD_GRID_TIMEOUT_SECONDS]
    assert WEATHER_HAZARD_GRID_TIMEOUT_SECONDS == 8.0
    assert LIVE_TIMEOUT_SECONDS == 4.0


def test_geometry_coverage_and_radius_are_preserved():
    circle = {"geometry_type": "circle", "latitude": 26, "longitude": 80, "radius_km": 150}
    polygon = {"geometry_type": "polygon", "polygon": [[4, 70], [10, 70], [10, 100]]}
    cell = {"geometry_type": "grid_cell", "bounds": [[5, 65], [6, 66]]}
    assert _intersects_coverage(circle)
    assert _intersects_coverage(polygon)
    assert _intersects_coverage(cell)
    assert circle["radius_km"] == 150


def test_live_failure_never_returns_demo(monkeypatch):
    monkeypatch.setattr("app.api.map.get_data_mode", lambda: "LIVE")
    with patch("app.api.map.open_meteo_provider.fetch_hazard_grid", return_value=None), patch(
        "app.api.map.imd_provider.fetch_hazard_alerts", return_value=None
    ):
        response = TestClient(app).get("/api/map/weather-hazards")
    assert response.status_code == 200
    assert response.json()["status"] == "UNAVAILABLE"
    assert response.json()["hazards"] == []


def test_multiple_live_hazard_types_and_provenance(monkeypatch):
    monkeypatch.setattr("app.api.map.get_data_mode", lambda: "LIVE")
    weather = {"fetched_at": "2026-01-01T00:00:00Z", "hazards": [
        {"type": "LIGHT_RAIN", "geometry_type": "grid_cell", "bounds": [[10, 70], [11, 71]], "source": "OPEN_METEO"},
        {"type": "THUNDERSTORM", "geometry_type": "grid_cell", "bounds": [[12, 70], [13, 71]], "source": "OPEN_METEO"},
    ]}
    cap = {"fetched_at": "2026-01-01T00:00:00Z", "hazards": [
        {"type": "CYCLONE", "geometry_type": "circle", "latitude": 15, "longitude": 80, "radius_km": 80, "source": "NDMA_SACHET_CAP"}
    ]}
    with patch("app.api.map.open_meteo_provider.fetch_hazard_grid", return_value=weather), patch(
        "app.api.map.imd_provider.fetch_hazard_alerts", return_value=cap
    ):
        payload = TestClient(app).get("/api/map/weather-hazards").json()
    assert {h["type"] for h in payload["hazards"]} == {"LIGHT_RAIN", "THUNDERSTORM", "CYCLONE"}
    assert all(h["source"] for h in payload["hazards"])


def test_cap_circle_and_polygon_are_preserved_and_expired_alerts_excluded(monkeypatch):
    rss = "<rss><channel><item><category>Met</category><link>https://cap/1</link></item><item><category>Met</category><link>https://cap/2</link></item></channel></rss>"
    active = """<alert xmlns='urn:oasis:names:tc:emergency:cap:1.2'><identifier>active</identifier><info><event>Cyclone warning</event><severity>Severe</severity><effective>2020-01-01T00:00:00Z</effective><expires>2099-01-01T00:00:00Z</expires><area><circle>15,80 150</circle></area><area><polygon>10,70 10,71 11,71</polygon></area></info></alert>"""
    expired = active.replace("active", "expired").replace("2099-01-01", "2020-01-02")
    class Response:
        def __init__(self, text, status_code=200): self.text, self.status_code = text, status_code
        def raise_for_status(self): pass
    responses = iter([Response(rss), Response(active), Response(expired)])
    monkeypatch.setattr(imd_provider._client, "get", lambda *args, **kwargs: next(responses))
    hazards = imd_provider.fetch_hazard_alerts()["hazards"]
    assert len(hazards) == 2
    assert {h["geometry_type"] for h in hazards} == {"circle", "polygon"}
    assert next(h for h in hazards if h["geometry_type"] == "circle")["radius_km"] == 150
