#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime, timezone
import httpx
import math
import numpy as np

try:
    import copernicusmarine as cm
    import xarray as xr
except ImportError as e:
    print(f"Missing required packages: {e}")
    sys.exit(1)

CURRENT_PRODUCT = "cmems_mod_glo_phy_anfc_0.083deg_PT1H-m"
CHLOROPHYLL_PRODUCT = "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D"

# Indian EEZ Limits
LAT_MIN, LAT_MAX = 5.0, 25.0
LON_MIN, LON_MAX = 65.0, 90.0
# We use 0.1 degree resolution
LATS = np.arange(LAT_MIN, LAT_MAX + 0.1, 0.1)
LONS = np.arange(LON_MIN, LON_MAX + 0.1, 0.1)

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

def main():
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        print("Error: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.")
        sys.exit(1)

    copernicus_user = os.getenv("COPERNICUS_USERNAME")
    copernicus_pass = os.getenv("COPERNICUS_PASSWORD")

    if not copernicus_user or not copernicus_pass:
        print("Error: COPERNICUS_USERNAME and COPERNICUS_PASSWORD environment variables must be set.")
        sys.exit(1)

    print("Opening Copernicus datasets...")
    try:
        ds_curr = cm.open_dataset(
            dataset_id=CURRENT_PRODUCT,
            username=copernicus_user,
            password=copernicus_pass
        )
        ds_chl = cm.open_dataset(
            dataset_id=CHLOROPHYLL_PRODUCT,
            username=copernicus_user,
            password=copernicus_pass
        )
    except Exception as e:
        print(f"Failed to open Copernicus dataset: {e}")
        sys.exit(1)
        
    if ds_curr is None or ds_chl is None:
        print("Error: Copernicus SDK returned None instead of a dataset. Authentication or dataset access failed.")
        sys.exit(1)

    print("Subsetting to latest slice...")
    try:
        # Time -1, depth 0
        curr_subset = ds_curr.isel(time=-1)
        if 'depth' in curr_subset.dims:
            curr_subset = curr_subset.isel(depth=0)
            
        chl_subset = ds_chl.isel(time=-1)
    except Exception as e:
        print(f"Failed to subset dataset: {e}")
        sys.exit(1)

    print("Extracting dataset valid_time...")
    try:
        if 'time' not in curr_subset.coords or 'time' not in chl_subset.coords:
            print("Error: Dataset is missing the time coordinate.")
            sys.exit(1)
            
        import pandas as pd
        curr_time_dt = pd.Timestamp(curr_subset.time.values).tz_localize("UTC").isoformat()
        chl_time_dt = pd.Timestamp(chl_subset.time.values).tz_localize("UTC").isoformat()
        
        if curr_time_dt == chl_time_dt:
            valid_time_payload = curr_time_dt
        else:
            valid_time_payload = {"current": curr_time_dt, "chlorophyll": chl_time_dt}
    except Exception as e:
        print(f"Failed to extract dataset valid_time: {e}")
        sys.exit(1)

    print("Interpolating to Indian EEZ 0.1-degree grid...")
    data_map = {}
    try:
        # Ensure LATS and LONS are DataArrays for interp
        lats_da = xr.DataArray(LATS, dims="latitude", coords={"latitude": LATS})
        lons_da = xr.DataArray(LONS, dims="longitude", coords={"longitude": LONS})
        
        curr_grid = curr_subset.interp(latitude=lats_da, longitude=lons_da, method="nearest")
        chl_grid = chl_subset.interp(latitude=lats_da, longitude=lons_da, method="nearest")
        
        print("Extracting valid points...")
        df_curr = curr_grid[["uo", "vo"]].to_dataframe().dropna()
        df_chl = chl_grid[["CHL"]].to_dataframe().dropna()
        
        # Drop redundant coordinate columns to prevent overlap during join
        for col in ['time', 'depth']:
            if col in df_curr.columns:
                df_curr = df_curr.drop(columns=[col])
            if col in df_chl.columns:
                df_chl = df_chl.drop(columns=[col])
        
        # Join dataframes on latitude, longitude
        df = df_curr.join(df_chl, how='inner')
        
        for index, row in df.iterrows():
            lat = index[0]
            lon = index[1]
            u = row['uo']
            v = row['vo']
            chl = row['CHL']
            
            key = f"{lat:.1f},{lon:.1f}"
            data_map[key] = json.dumps({
                "u": round(float(u), 3),
                "v": round(float(v), 3),
                "chl": round(float(chl), 4)
            })
            
    except Exception as e:
        print(f"Failed to extract grid: {e}")
        sys.exit(1)

    if not data_map:
        print("No valid points found in grid!")
        sys.exit(1)

    print(f"Extracted {len(data_map)} valid marine points.")
    
    print("Uploading to Upstash...")
    url = f"{UPSTASH_URL.rstrip('/')}"
    headers = {"Authorization": f"Bearer {UPSTASH_TOKEN}", "Content-Type": "application/json"}
    
    keys_vals = list(data_map.items())
    CHUNK_SIZE = 500
    
    with httpx.Client(timeout=30.0) as client:
        client.post(url, headers=headers, json=["DEL", "copernicus_data"]).raise_for_status()
        
        pipeline = []
        for i in range(0, len(keys_vals), CHUNK_SIZE):
            chunk = keys_vals[i:i+CHUNK_SIZE]
            command = ["HSET", "copernicus_data"]
            for k, v in chunk:
                command.extend([k, v])
            pipeline.append(command)
            
        fetched_at_iso = datetime.now(timezone.utc).isoformat()
        metadata = json.dumps({"fetched_at": fetched_at_iso, "valid_time": valid_time_payload})
        pipeline.append(["SET", "copernicus_metadata", metadata])
        
        resp = client.post(f"{url}/pipeline", headers=headers, json=pipeline)
        resp.raise_for_status()
        
        results = resp.json()
        for res in results:
            if "error" in res:
                print(f"Upstash Error: {res['error']}")
                sys.exit(1)
                
    print("Successfully synced Copernicus data to Upstash.")

if __name__ == "__main__":
    main()
