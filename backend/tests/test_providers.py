import pytest
from datetime import datetime
from unittest.mock import patch
import time

from app.data.providers.open_meteo import open_meteo_provider
from app.data.providers.copernicus import CopernicusProvider, copernicus_provider
from app.data.providers.incois import incois_provider
from app.data.providers.imd import imd_provider


class _CountingValue:
    def __init__(self, value):
        self.value = value
        self.reads = 0

    @property
    def values(self):
        self.reads += 1
        return self.value


class _FakeDataset:
    def __init__(self, **values):
        self.dims = {"time"}
        self.values = {name: _CountingValue(value) for name, value in values.items()}

    def sel(self, **kwargs):
        return self

    def isel(self, **kwargs):
        return self

    def __getitem__(self, name):
        return self.values[name]

def test_open_meteo_fetch_marine_live():
    """Test marine data fetch returns properly formatted Live response if successful, else None."""
    # Test valid coords
    res = open_meteo_provider.fetch_marine(19.0, 72.8, datetime.now())
    if res:
        assert res.metadata.mode == "LIVE"
        assert "wave_height_m" in res.data
        assert res.metadata.source == "Open-Meteo Marine"

def test_copernicus_no_credentials():
    """Test Copernicus returns None if credentials are missing."""
    # Temporarily remove credentials
    old_user = copernicus_provider.username
    copernicus_provider.username = None
    res = copernicus_provider.fetch_current(19.0, 72.8, datetime.now())
    assert res is None
    copernicus_provider.username = old_user


def test_copernicus_current_cache_uses_rounded_coordinates_and_skips_values():
    provider = CopernicusProvider()
    dataset = _FakeDataset(uo=1.2, vo=-0.4)
    provider._get_current_dataset = lambda: dataset

    first = provider.fetch_current(19.001, 72.801, datetime.now())
    second = provider.fetch_current(19.004, 72.804, datetime.now())
    different = provider.fetch_current(19.01, 72.81, datetime.now())

    assert first is not None and second is not None and different is not None
    assert dataset.values["uo"].reads == 2
    assert dataset.values["vo"].reads == 2


def test_copernicus_chlorophyll_cache_skips_values():
    provider = CopernicusProvider()
    dataset = _FakeDataset(CHL=0.72)
    provider._get_chlorophyll_dataset = lambda: dataset

    first = provider.fetch_chlorophyll(19.001, 72.801, datetime.now())
    second = provider.fetch_chlorophyll(19.004, 72.804, datetime.now())

    assert first is not None and second is not None
    assert dataset.values["CHL"].reads == 1


def test_copernicus_cache_expiry_repeats_extraction():
    provider = CopernicusProvider()
    dataset = _FakeDataset(uo=1.2, vo=-0.4)
    provider._get_current_dataset = lambda: dataset

    provider.fetch_current(19.0, 72.8, datetime.now())
    provider._current_cache[(19.0, 72.8)] = (time.monotonic() - 1, (1.2, -0.4))
    provider.fetch_current(19.0, 72.8, datetime.now())

    assert dataset.values["uo"].reads == 2
    assert dataset.values["vo"].reads == 2


def test_copernicus_extraction_errors_still_return_none():
    provider = CopernicusProvider()

    class _BrokenDataset:
        dims = {"time"}

        def sel(self, **kwargs):
            raise RuntimeError("read failed")

    provider._get_current_dataset = lambda: _BrokenDataset()
    provider._get_chlorophyll_dataset = lambda: _BrokenDataset()

    assert provider.fetch_current(19.0, 72.8, datetime.now()) is None
    assert provider.fetch_chlorophyll(19.0, 72.8, datetime.now()) is None

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
