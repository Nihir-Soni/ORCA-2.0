import pytest
import pandas as pd
import xarray as xr
import numpy as np

def test_sync_copernicus_dataframe_merge():
    # Reproduce the scenario where both datasets have a scalar 'time' coordinate
    # after xarray .isel(time=-1)
    
    # Create fake xarray datasets with a time coordinate
    lats = [19.0, 19.1]
    lons = [72.8, 72.9]
    
    curr_data = xr.DataArray(
        np.array([[0.1, 0.2], [0.3, 0.4]]),
        dims=("latitude", "longitude"),
        coords={
            "latitude": lats,
            "longitude": lons,
            "time": pd.Timestamp("2026-09-17T12:00:00Z"),
            "depth": 0.0
        },
        name="uo"
    ).to_dataset()
    curr_data["thetao"] = xr.DataArray(
        np.array([[29.1, 29.2], [29.3, 29.4]]),
        dims=("latitude", "longitude"),
        coords={
            "latitude": lats,
            "longitude": lons,
            "time": pd.Timestamp("2026-09-17T12:00:00Z"),
            "depth": 0.0
        }
    )
    curr_data["vo"] = xr.DataArray(
        np.array([[-0.1, -0.2], [-0.3, -0.4]]),
        dims=("latitude", "longitude"),
        coords={
            "latitude": lats,
            "longitude": lons,
            "time": pd.Timestamp("2026-09-17T12:00:00Z"),
            "depth": 0.0
        }
    )
    
    chl_data = xr.DataArray(
        np.array([[1.1, 1.2], [1.3, 1.4]]),
        dims=("latitude", "longitude"),
        coords={
            "latitude": lats,
            "longitude": lons,
            "time": pd.Timestamp("2026-09-17T12:00:00Z")
        },
        name="CHL"
    ).to_dataset()
    
    # Convert to dataframe as in the sync script
    df_curr = curr_data[["uo", "vo", "thetao"]].to_dataframe().dropna()
    df_chl = chl_data[["CHL"]].to_dataframe().dropna()
    
    # Verify the collision occurs if we just join
    # df = df_curr.join(df_chl, how='inner') # This would fail with overlap
    
    # Apply the fix
    for col in ['time', 'depth']:
        if col in df_curr.columns:
            df_curr = df_curr.drop(columns=[col])
        if col in df_chl.columns:
            df_chl = df_chl.drop(columns=[col])
            
    # Join should now succeed
    df = df_curr.join(df_chl, how='inner')
    
    assert "uo" in df.columns
    assert "vo" in df.columns
    assert "thetao" in df.columns
    assert "CHL" in df.columns
    assert "time" not in df.columns
    assert "depth" not in df.columns
    
    # Verify the values
    assert df.loc[(19.0, 72.8), "uo"] == 0.1
    assert df.loc[(19.0, 72.8), "thetao"] == 29.1
    assert df.loc[(19.0, 72.8), "CHL"] == 1.1
