#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime, timezone, timedelta
import httpx
import math
import numpy as np
import pandas as pd

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))
except ImportError:
    pass

try:
    import copernicusmarine as cm
    import xarray as xr
except ImportError as e:
    print(f"Missing required packages: {e}")
    sys.exit(1)

HISTORICAL_CHL_PRODUCT = "cmems_obs-oc_glo_bgc-plankton_my_l4-gapfree-multi-4km_P1D"

# Indian EEZ Limits
LAT_MIN, LAT_MAX = 5.0, 25.0
LON_MIN, LON_MAX = 65.0, 95.0
# 0.1 degree resolution
LATS = np.arange(LAT_MIN, LAT_MAX + 0.1, 0.1)
LONS = np.arange(LON_MIN, LON_MAX + 0.1, 0.1)

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

# Days of historical data to cache
HISTORY_WINDOW_DAYS = int(os.getenv("ORCA_HISTORICAL_WINDOW_DAYS", "90"))

def main():
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        print("Error: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.")
        sys.exit(1)

    copernicus_user = os.getenv("COPERNICUS_USERNAME")
    copernicus_pass = os.getenv("COPERNICUS_PASSWORD")

    if not copernicus_user or not copernicus_pass:
        print("Error: COPERNICUS_USERNAME and COPERNICUS_PASSWORD environment variables must be set.")
        sys.exit(1)

    print(f"Opening metadata for historical CHL dataset: {HISTORICAL_CHL_PRODUCT}...")
    try:
        ds_meta = cm.open_dataset(
            dataset_id=HISTORICAL_CHL_PRODUCT,
            username=copernicus_user,
            password=copernicus_pass
        )
    except Exception as e:
        print(f"Failed to open dataset metadata: {e}")
        sys.exit(1)
        
    print("Determining time window...")
    try:
        # Get the very last available date in the dataset
        latest_time = pd.Timestamp(ds_meta.time.values[-1]).tz_localize(None).to_pydatetime()
        start_time = latest_time - timedelta(days=HISTORY_WINDOW_DAYS)
        
        start_str = start_time.strftime("%Y-%m-%d %H:%M:%S")
        end_str = latest_time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"Historical window: {start_str} to {end_str}")
    except Exception as e:
        print(f"Failed to extract dataset valid_time: {e}")
        sys.exit(1)

    print(f"Subsetting chlorophyll data for {HISTORY_WINDOW_DAYS} days...")
    try:
        chl_subset_resp = cm.subset(
            dataset_id=HISTORICAL_CHL_PRODUCT,
            username=copernicus_user,
            password=copernicus_pass,
            variables=["CHL"],
            minimum_latitude=LAT_MIN - 0.5,
            maximum_latitude=LAT_MAX + 0.5,
            minimum_longitude=LON_MIN - 0.5,
            maximum_longitude=LON_MAX + 0.5,
            start_datetime=start_str,
            end_datetime=end_str,
            output_filename="chl_historical_subset.nc",
            overwrite=True
        )
        chl_subset = xr.open_dataset(
            chl_subset_resp.file_path if hasattr(chl_subset_resp, 'file_path') else chl_subset_resp,
            engine="netcdf4"
        )
    except Exception as e:
        print(f"Failed to subset chlorophyll data: {e}")
        sys.exit(1)

    print("Interpolating to Indian EEZ 0.1-degree grid...")
    data_map = {}
    try:
        lats_da = xr.DataArray(LATS, dims="latitude", coords={"latitude": LATS})
        lons_da = xr.DataArray(LONS, dims="longitude", coords={"longitude": LONS})
        
        chl_grid = chl_subset.interp(latitude=lats_da, longitude=lons_da, method="nearest")
        chl_grid = chl_grid.squeeze().drop_vars(['depth'], errors='ignore')

        print("Formatting time series data per coordinate...")
        # Get time array as ISO strings (YYYY-MM-DD)
        times_iso = [pd.Timestamp(t).strftime("%Y-%m-%d") for t in chl_grid.time.values]
        
        # Load data into memory to iterate quickly
        chl_grid.load()
        
        for lat in LATS:
            for lon in LONS:
                # Extract the 1D time series for this coordinate
                ts = chl_grid.sel(latitude=lat, longitude=lon, method="nearest").CHL.values
                
                # Check if all values are NaN
                if np.isnan(ts).all():
                    continue
                
                # The user explicitly asked for {"time": "...", "value": ...}
                obs = []
                for i, val in enumerate(ts):
                    if not np.isnan(val):
                        obs.append({"time": times_iso[i], "value": round(float(val), 4)})
                
                if obs:
                    key = f"{lat:.1f},{lon:.1f}"
                    data_map[key] = json.dumps(obs)
            
    except Exception as e:
        print(f"Failed to extract grid: {e}")
        sys.exit(1)

    if not data_map:
        print("No valid points found in grid!")
        sys.exit(1)

    print(f"Extracted {len(data_map)} valid marine points with historical time series.")
    
    print("Uploading to Upstash...")
    url = f"{UPSTASH_URL.rstrip('/')}"
    headers = {"Authorization": f"Bearer {UPSTASH_TOKEN}", "Content-Type": "application/json"}
    
    keys_vals = list(data_map.items())
    # Smaller chunk size because JSON arrays are larger than single points
    CHUNK_SIZE = 100
    
    with httpx.Client(timeout=60.0) as client:
        # We use MSET instead of HSET because HSET can exceed Upstash's 100MB single record limit.
        pipeline = []
        for i in range(0, len(keys_vals), CHUNK_SIZE):
            chunk = keys_vals[i:i+CHUNK_SIZE]
            command = ["MSET"]
            for k, v in chunk:
                command.extend([f"historical_chl:{k}", v])
            pipeline.append(command)
            
        fetched_at_iso = datetime.now(timezone.utc).isoformat()
        metadata = json.dumps({
            "fetched_at": fetched_at_iso, 
            "dataset": HISTORICAL_CHL_PRODUCT,
            "coverage_start": times_iso[0],
            "coverage_end": times_iso[-1],
            "window_days": HISTORY_WINDOW_DAYS
        })
        pipeline.append(["SET", "historical_chl_metadata", metadata])
        
        print(f"Executing {len(pipeline)} pipeline commands...")
        # Since pipeline might be huge, chunk the pipeline execution
        BATCH_SIZE = 20
        for i in range(0, len(pipeline), BATCH_SIZE):
            batch = pipeline[i:i+BATCH_SIZE]
            resp = client.post(f"{url}/pipeline", headers=headers, json=batch)
            resp.raise_for_status()
            
            results = resp.json()
            for res in results:
                if "error" in res:
                    print(f"Upstash Error: {res['error']}")
                    sys.exit(1)
                
    print("Successfully synced Historical Copernicus CHL data to Upstash.")

if __name__ == "__main__":
    main()
