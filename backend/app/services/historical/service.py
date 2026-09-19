import concurrent.futures
from datetime import datetime, timezone
from typing import Dict, Any, List

from ...schemas import Location
from .providers.copernicus import fetch_historical_chl, fetch_historical_chl_metadata
from .providers.weather import fetch_historical_marine, fetch_historical_weather
from .trends import calculate_statistics, pearson_correlation

def analyze_historical_data(
    location: Location, 
    start_date: str, 
    end_date: str
) -> Dict[str, Any]:
    
    # 1. Start parallel requests
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        chl_meta_future = executor.submit(fetch_historical_chl_metadata)
        chl_data_future = executor.submit(fetch_historical_chl, location.latitude, location.longitude)
        marine_future = executor.submit(fetch_historical_marine, location.latitude, location.longitude, start_date, end_date)
        weather_future = executor.submit(fetch_historical_weather, location.latitude, location.longitude, start_date, end_date)
        
        chl_meta = chl_meta_future.result()
        chl_data = chl_data_future.result()
        marine_data = marine_future.result()
        weather_data = weather_future.result()

    # Base payload structure
    evidence: Dict[str, Any] = {
        "analysis_type": "historical_marine_analysis",
        "location": {
            "lat": location.latitude,
            "lon": location.longitude
        },
        "period": {
            "start": start_date,
            "end": end_date
        },
        "variables": {},
        "correlations": [],
        "provenance": [],
        "availability": {}
    }
    
    overall_status = "LIVE"
    
    # 2. Process Chlorophyll
    if chl_data and chl_meta:
        # Check coverage
        cov_start = chl_meta.get("coverage_start", "")
        cov_end = chl_meta.get("coverage_end", "")
        
        if end_date < cov_start or start_date > cov_end:
            evidence["availability"]["chlorophyll"] = {
                "status": "UNAVAILABLE",
                "reason": f"Requested period ({start_date} to {end_date}) has no overlap with cached Copernicus historical coverage ({cov_start} to {cov_end})."
            }
            overall_status = "PARTIAL_LIVE"
        else:
            # Filter to requested dates
            dates = [item["time"] for item in chl_data]
            values = [item["value"] for item in chl_data]
            
            filtered_dates = []
            filtered_values = []
            for d, v in zip(dates, values):
                if start_date <= d <= end_date:
                    filtered_dates.append(d)
                    filtered_values.append(v)
                    
            if not filtered_values:
                evidence["availability"]["chlorophyll"] = {
                    "status": "UNAVAILABLE",
                    "reason": "No valid observations found in the requested range."
                }
                overall_status = "PARTIAL_LIVE"
            else:
                stats = calculate_statistics(filtered_values)
                evidence["variables"]["chlorophyll"] = {
                    "statistics": stats,
                    "timeseries": {"dates": filtered_dates, "values": filtered_values}
                }
                evidence["availability"]["chlorophyll"] = {"status": "AVAILABLE"}
                evidence["provenance"].append({
                    "provider": "Copernicus Marine",
                    "dataset": chl_meta.get("dataset", "Unknown"),
                    "variable": "CHL",
                    "mode": "HISTORICAL",
                    "requested_start": start_date,
                    "requested_end": end_date,
                    "actual_coverage_start": filtered_dates[0],
                    "actual_coverage_end": filtered_dates[-1],
                    "observation_count": len(filtered_dates)
                })
    else:
        evidence["availability"]["chlorophyll"] = {
            "status": "UNAVAILABLE",
            "reason": "Upstash historical CHL cache is unavailable or missing."
        }
        overall_status = "PARTIAL_LIVE"

    # 3. Process SST & Currents (Marine)
    if marine_data and "hourly" in marine_data:
        times = marine_data["hourly"].get("time", [])
        sst_vals = marine_data["hourly"].get("sea_surface_temperature", [])
        u_vals = marine_data["hourly"].get("ocean_current_velocity", []) # Actually this is speed in open-meteo if it's velocity
        # Note: open-meteo marine returns ocean_current_velocity (speed) and ocean_current_direction.
        
        # We need to aggregate to daily to align with CHL
        daily_sst = {}
        daily_current = {}
        
        for i, t in enumerate(times):
            day = t.split("T")[0]
            if 0 <= i < len(sst_vals) and sst_vals[i] is not None:
                daily_sst.setdefault(day, []).append(sst_vals[i])
            if 0 <= i < len(u_vals) and u_vals[i] is not None:
                daily_current.setdefault(day, []).append(u_vals[i])
                
        # Daily means
        sst_dates, sst_daily_means = [], []
        for day in sorted(daily_sst.keys()):
            if start_date <= day <= end_date:
                sst_dates.append(day)
                sst_daily_means.append(sum(daily_sst[day])/len(daily_sst[day]))
                
        curr_dates, curr_daily_means = [], []
        for day in sorted(daily_current.keys()):
            if start_date <= day <= end_date:
                curr_dates.append(day)
                curr_daily_means.append(sum(daily_current[day])/len(daily_current[day]))

        if sst_daily_means:
            evidence["variables"]["sst"] = {
                "statistics": calculate_statistics(sst_daily_means),
                "timeseries": {"dates": sst_dates, "values": sst_daily_means}
            }
            evidence["availability"]["sst"] = {"status": "AVAILABLE"}
            evidence["provenance"].append({
                "provider": "Open-Meteo Marine",
                "dataset/model": "Open-Meteo Marine API",
                "variable": "sst",
                "mode": "HISTORICAL"
            })
        else:
            evidence["availability"]["sst"] = {"status": "UNAVAILABLE", "reason": "No SST data returned."}
            overall_status = "PARTIAL_LIVE"
            
        if curr_daily_means:
            evidence["variables"]["current_speed"] = {
                "statistics": calculate_statistics(curr_daily_means),
                "timeseries": {"dates": curr_dates, "values": curr_daily_means}
            }
            evidence["availability"]["current_speed"] = {"status": "AVAILABLE"}
            evidence["provenance"].append({
                "provider": "Open-Meteo Marine",
                "dataset/model": "Open-Meteo Marine API",
                "variable": "current_speed",
                "mode": "HISTORICAL"
            })
        else:
            evidence["availability"]["current_speed"] = {"status": "UNAVAILABLE", "reason": "No current data returned."}
            overall_status = "PARTIAL_LIVE"
    else:
        evidence["availability"]["sst"] = {"status": "UNAVAILABLE", "reason": "Marine API failed."}
        evidence["availability"]["current_speed"] = {"status": "UNAVAILABLE", "reason": "Marine API failed."}
        overall_status = "PARTIAL_LIVE"

    # 4. Process Weather
    if weather_data and "hourly" in weather_data:
        times = weather_data["hourly"].get("time", [])
        temp_vals = weather_data["hourly"].get("temperature_2m", [])
        wind_vals = weather_data["hourly"].get("wind_speed_10m", [])
        precip_vals = weather_data["hourly"].get("precipitation", [])
        
        valid_temps = [v for v in temp_vals if v is not None]
        valid_winds = [v for v in wind_vals if v is not None]
        valid_precip = [v for v in precip_vals if v is not None]
        
        if valid_temps and valid_winds:
            evidence["variables"]["weather"] = {
                "statistics": {
                    "mean_temperature": round(sum(valid_temps)/len(valid_temps), 2),
                    "mean_wind_speed": round(sum(valid_winds)/len(valid_winds), 2),
                    "max_wind_speed": round(max(valid_winds), 2),
                    "total_precipitation": round(sum(valid_precip), 2) if valid_precip else 0.0,
                    "rainy_day_count": sum(1 for p in valid_precip if p > 1.0) # > 1mm is a rainy hour, rough proxy
                }
            }
            evidence["availability"]["weather"] = {"status": "AVAILABLE"}
            evidence["provenance"].append({
                "provider": "Open-Meteo",
                "dataset": "Open-Meteo Archive API",
                "variable": "weather",
                "mode": "HISTORICAL"
            })
        else:
            evidence["availability"]["weather"] = {"status": "UNAVAILABLE", "reason": "Missing weather vars."}
            overall_status = "PARTIAL_LIVE"
    else:
        evidence["availability"]["weather"] = {"status": "UNAVAILABLE", "reason": "Archive API failed."}
        overall_status = "PARTIAL_LIVE"

    # 5. Correlations
    # We only correlate SST, CHL, and Current Speed if they are aligned
    if "sst" in evidence["variables"] and "chlorophyll" in evidence["variables"]:
        sst_dates = evidence["variables"]["sst"]["timeseries"]["dates"]
        sst_vals = evidence["variables"]["sst"]["timeseries"]["values"]
        chl_dates = evidence["variables"]["chlorophyll"]["timeseries"]["dates"]
        chl_vals = evidence["variables"]["chlorophyll"]["timeseries"]["values"]
        
        # Align
        aligned_sst = []
        aligned_chl = []
        sst_dict = dict(zip(sst_dates, sst_vals))
        
        for d, v in zip(chl_dates, chl_vals):
            if d in sst_dict:
                aligned_chl.append(v)
                aligned_sst.append(sst_dict[d])
                
        coef = pearson_correlation(aligned_sst, aligned_chl)
        if coef is not None:
            evidence["correlations"].append({
                "variable_a": "sst",
                "variable_b": "chlorophyll",
                "coefficient": coef,
                "sample_count": len(aligned_sst)
            })

    if "current_speed" in evidence["variables"] and "chlorophyll" in evidence["variables"]:
        curr_dates = evidence["variables"]["current_speed"]["timeseries"]["dates"]
        curr_vals = evidence["variables"]["current_speed"]["timeseries"]["values"]
        chl_dates = evidence["variables"]["chlorophyll"]["timeseries"]["dates"]
        chl_vals = evidence["variables"]["chlorophyll"]["timeseries"]["values"]
        
        aligned_curr = []
        aligned_chl = []
        curr_dict = dict(zip(curr_dates, curr_vals))
        
        for d, v in zip(chl_dates, chl_vals):
            if d in curr_dict:
                aligned_chl.append(v)
                aligned_curr.append(curr_dict[d])
                
        coef = pearson_correlation(aligned_curr, aligned_chl)
        if coef is not None:
            evidence["correlations"].append({
                "variable_a": "current_speed",
                "variable_b": "chlorophyll",
                "coefficient": coef,
                "sample_count": len(aligned_curr)
            })

    evidence["overall_status"] = overall_status
    return evidence
