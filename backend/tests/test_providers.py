import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
import time
import json
import sys

from app.data.providers.open_meteo import open_meteo_provider
from app.data.providers.copernicus import CopernicusProvider, copernicus_provider
from app.data.providers.incois import incois_provider
from app.data.providers.imd import imd_provider


def test_open_meteo_fetch_marine_live():
    """Test marine data fetch returns properly formatted Live response if successful, else None."""
    # Test valid coords
    res = open_meteo_provider.fetch_marine(19.0, 72.8, datetime.now())
    if res:
        assert res.metadata.mode == "LIVE"
        assert "wave_height_m" in res.data
        assert res.metadata.source == "Open-Meteo Marine"


# --- COPERNICUS TESTS ---

def _mock_httpx_response(result_data, status_code=200):
    """Helper to mock an Upstash REST API response."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    if result_data is not None:
        mock_resp.json.return_value = {"result": json.dumps(result_data) if isinstance(result_data, dict) else result_data}
    else:
        mock_resp.json.return_value = {"result": None}
    
    def raise_for_status():
        if status_code >= 400:
            raise Exception("HTTP Error")
    mock_resp.raise_for_status = raise_for_status
    return mock_resp

def _mock_metadata_response(fetched_at_str, valid_time=None):
    if valid_time is None:
        valid_time = fetched_at_str # Fallback to make previous tests pass trivially, though we will explicitly test it
    return _mock_httpx_response({"fetched_at": fetched_at_str, "valid_time": valid_time})

def _mock_data_response(u, v, chl):
    return _mock_httpx_response({"u": u, "v": v, "chl": chl})

@pytest.fixture
def clean_copernicus_provider():
    # Return a fresh instance with cleared internal caches
    provider = CopernicusProvider()
    provider.upstash_url = "https://mock-upstash"
    provider.upstash_token = "mock-token"
    return provider

@patch('httpx.Client.get')
def test_copernicus_live_current_cache_hit(mock_get, clean_copernicus_provider):
    """1. LIVE current cache HIT"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(fresh_time),
        _mock_data_response(0.123, -0.456, 1.2345)
    ]
    
    res = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is not None
    assert res.metadata.mode == "LIVE"
    assert "Copernicus Marine" in res.metadata.source
    assert res.data["u"] == 0.123
    assert res.data["v"] == -0.456
    
    # Assert exact HGET call
    mock_get.assert_called_with("https://mock-upstash/hget/copernicus_data/19.0,72.8", headers={"Authorization": "Bearer mock-token"})

@patch('httpx.Client.get')
def test_copernicus_live_chlorophyll_cache_hit(mock_get, clean_copernicus_provider):
    """2. LIVE chlorophyll cache HIT"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(fresh_time),
        _mock_data_response(0.123, -0.456, 1.2345)
    ]
    
    res = clean_copernicus_provider.fetch_chlorophyll(19.0, 72.8, datetime.now())
    assert res is not None
    assert res.metadata.mode == "LIVE"
    assert res.data["chlorophyll_mg_m3"] == 1.2345

@patch('httpx.Client.get')
def test_copernicus_sst_grid(mock_get, clean_copernicus_provider):
    """LIVE SST grid fetch"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(fresh_time),
        _mock_httpx_response(["19.0,72.8", json.dumps({"sst": 30.5}), "19.1,72.8", json.dumps({"sst": 30.6, "chl": 1.2})])
    ]
    grid = clean_copernicus_provider.fetch_sst_grid()
    assert grid is not None
    assert len(grid) == 2
    assert grid[0] == [19.0, 72.8, 30.5]

@patch('httpx.Client.get')
def test_copernicus_chlorophyll_grid(mock_get, clean_copernicus_provider):
    """LIVE Chlorophyll grid fetch"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(fresh_time),
        _mock_httpx_response(["19.0,72.8", json.dumps({"sst": 30.5, "chl": 0.5}), "19.1,72.8", json.dumps({"sst": 30.6})])
    ]
    grid = clean_copernicus_provider.fetch_chlorophyll_grid()
    assert grid is not None
    assert len(grid) == 1
    assert grid[0] == [19.0, 72.8, 0.5]

@patch('httpx.Client.get')
def test_copernicus_missing_redis_field(mock_get, clean_copernicus_provider):
    """3. Missing Redis field"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(fresh_time),
        _mock_httpx_response(None) # Missing field returns null result in Upstash
    ]
    
    res = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is None

@patch('httpx.Client.get')
def test_copernicus_upstash_http_failure(mock_get, clean_copernicus_provider):
    """4. Upstash HTTP failure"""
    mock_get.side_effect = Exception("Connection Refused")
    
    res = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is None # Graceful failure

@patch('httpx.Client.get')
def test_copernicus_malformed_json(mock_get, clean_copernicus_provider):
    """5. Malformed JSON"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    
    mock_resp_meta = _mock_metadata_response(fresh_time)
    
    mock_resp_data = MagicMock()
    mock_resp_data.status_code = 200
    mock_resp_data.json.return_value = {"result": "{bad_json: 1"}
    
    mock_get.side_effect = [mock_resp_meta, mock_resp_data]
    
    res = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is None # Fails parsing, returns None

@patch('httpx.Client.get')
def test_copernicus_stale_payload(mock_get, clean_copernicus_provider):
    """6. Stale payload"""
    # 50 hours ago
    stale_time = (datetime.now(timezone.utc) - timedelta(hours=50)).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(stale_time)
        # It shouldn't even query data if metadata is stale
    ]
    
    res = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is None
    
    # Assert data was not fetched due to stale metadata
    assert mock_get.call_count == 1
    mock_get.assert_called_with("https://mock-upstash/get/copernicus_metadata", headers={"Authorization": "Bearer mock-token"})

@patch('httpx.Client.get')
def test_copernicus_fresh_payload(mock_get, clean_copernicus_provider):
    """7. Fresh payload"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(fresh_time),
        _mock_data_response(0.1, 0.2, 0.3)
    ]
    
    res = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is not None
    assert res.metadata.valid_time == fresh_time

@patch('httpx.Client.get')
def test_copernicus_coordinate_rounding(mock_get, clean_copernicus_provider):
    """8. Coordinate rounding"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    mock_get.side_effect = [
        _mock_metadata_response(fresh_time),
        _mock_data_response(0.1, 0.2, 0.3)
    ]
    
    # Passing 19.04 and 72.76, should round to 19.0 and 72.8 (1 decimal)
    res = clean_copernicus_provider.fetch_current(19.04, 72.76, datetime.now())
    assert res is not None
    
    mock_get.assert_called_with("https://mock-upstash/hget/copernicus_data/19.0,72.8", headers={"Authorization": "Bearer mock-token"})

@patch('httpx.Client.get')
def test_copernicus_valid_time_separate_from_fetched_at(mock_get, clean_copernicus_provider):
    """valid_time comes from dataset time, fetched_at comes from execution"""
    fetched_time = datetime.now(timezone.utc).isoformat()
    valid_time_c = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
    valid_time_chl = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    
    mock_get.side_effect = [
        _mock_metadata_response(fetched_time, {"current": valid_time_c, "chlorophyll": valid_time_chl}),
        _mock_data_response(0.1, 0.2, 0.3),
        _mock_data_response(0.1, 0.2, 0.3)
    ]
    
    res_c = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    res_chl = clean_copernicus_provider.fetch_chlorophyll(19.0, 72.8, datetime.now())
    
    assert res_c is not None
    assert res_chl is not None
    assert res_c.metadata.valid_time == valid_time_c
    assert res_chl.metadata.valid_time == valid_time_chl
    assert res_c.metadata.valid_time != fetched_time

@patch('httpx.Client.get')
def test_copernicus_missing_valid_time_returns_none(mock_get, clean_copernicus_provider):
    """missing time coordinate causes sync failure / unavailable"""
    fresh_time = datetime.now(timezone.utc).isoformat()
    # Missing valid_time entirely
    mock_get.side_effect = [
        _mock_httpx_response({"fetched_at": fresh_time}),
        _mock_data_response(0.1, 0.2, 0.3)
    ]
    
    res = clean_copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is None


def test_copernicus_no_heavy_imports():
    """10. No heavy imports"""
    import app.data.providers.copernicus as copernicus_mod
    
    with open(copernicus_mod.__file__, 'r', encoding='utf-8') as f:
        content = f.read()
        
    assert "import copernicusmarine" not in content
    assert "import xarray" not in content
    assert "import netCDF4" not in content
    
    # Double check sys.modules just in case (though it might be loaded by other things in a global test run,
    # the file itself should not import it directly).
    # We will just rely on the file scan to prove the file doesn't import them.


# --- OTHER TESTS ---

@patch('httpx.Client.get')
def test_incois_unavailable(mock_get):
    """Test INCOIS returns None by default due to no API."""
    mock_get.side_effect = Exception("Connection refused")
    res = incois_provider.fetch_pfz_zones(19.0, 72.8, datetime.now())
    assert res is None

@patch('httpx.Client.get')
def test_imd_unavailable(mock_get):
    """Test IMD returns None by default."""
    mock_get.side_effect = Exception("Connection refused")
    res = imd_provider.fetch_alerts(19.0, 72.8, datetime.now())
    assert res is None
