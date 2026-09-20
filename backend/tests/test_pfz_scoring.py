import pytest
from app.services.fishing import environmental_suitability


def test_environmental_suitability_all_available():
    # Case A: all environmental data available
    result1 = environmental_suitability(
        chlorophyll=0.5,
        sst=28.0,
        ambient_sst=29.0,
        wave_m=1.0,
        hour=6
    )
    result2 = environmental_suitability(
        chlorophyll=2.0,
        sst=25.0,
        ambient_sst=29.0,
        wave_m=2.0,
        hour=14
    )
    assert result1["available"] is True
    assert result2["available"] is True
    assert isinstance(result1["suitability"], int)
    assert isinstance(result2["suitability"], int)
    assert result1["suitability"] != result2["suitability"]
    
    # Should have all factors
    factors = result1["factors"]
    assert "chlorophyll" in factors
    assert "sst" in factors
    assert "front" in factors
    assert "sea_state" in factors
    assert "time_of_day" in factors


def test_environmental_suitability_missing_chl():
    # Case B: CHL unavailable
    result = environmental_suitability(
        chlorophyll=None,
        sst=28.0,
        ambient_sst=29.0,
        wave_m=1.0,
        hour=6
    )
    assert result["available"] is True
    assert "chlorophyll" not in result["factors"]
    assert "sst" in result["factors"]


def test_environmental_suitability_missing_sst():
    # Case C: SST unavailable
    result = environmental_suitability(
        chlorophyll=0.5,
        sst=None,
        ambient_sst=29.0,
        wave_m=1.0,
        hour=6
    )
    assert result["available"] is True
    assert "sst" not in result["factors"]
    assert "front" not in result["factors"]  # Front should also disappear


def test_environmental_suitability_missing_ambient_sst():
    # Case D: Ambient SST unavailable
    result = environmental_suitability(
        chlorophyll=0.5,
        sst=28.0,
        ambient_sst=None,
        wave_m=1.0,
        hour=6
    )
    assert result["available"] is True
    assert "sst" in result["factors"]
    assert "front" not in result["factors"]  # Front should disappear


def test_environmental_suitability_missing_wave():
    # Case E: Wave unavailable
    result = environmental_suitability(
        chlorophyll=0.5,
        sst=28.0,
        ambient_sst=29.0,
        wave_m=None,
        hour=6
    )
    assert result["available"] is True
    assert "sea_state" not in result["factors"]


def test_environmental_suitability_none_available():
    # Case F: all environmental observations unavailable
    result = environmental_suitability(
        chlorophyll=None,
        sst=None,
        ambient_sst=None,
        wave_m=None,
        hour=6
    )
    assert result["available"] is False
    assert result["suitability"] is None
    assert "time_of_day" not in result["factors"]  # should not be present either
