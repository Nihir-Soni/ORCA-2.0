import sys
import time
from datetime import datetime
from app.api import fishing
from app.schemas import Location

def benchmark():
    lat, lon = 19.0, 72.8 # Mumbai
    
    import app.api.fishing as f
    
    # Keep original functions
    orig_weather = f.weather_agent.run
    orig_ocean = f.ocean_agent.run
    orig_cyclone = f.cyclone_agent.run
    orig_gis = f.gis_agent.run
    orig_risk = f.risk_agent.run
    orig_route = f.route_agent.run
    orig_safe_window = f._safe_window_hours
    
    timers = {
        "init_weather": 0, "init_ocean": 0, "init_cyclone": 0, "init_gis": 0,
        "risk_calc": 0, "route_gen": 0, "safe_window": 0
    }
    
    loop_stats = []
    in_loop = False
    
    def wrap_weather(loc, dt):
        t0 = time.time()
        res = orig_weather(loc, dt)
        dt_time = time.time() - t0
        if not in_loop: timers["init_weather"] = dt_time
        return res
        
    def wrap_ocean(loc, dt):
        t0 = time.time()
        res = orig_ocean(loc, dt)
        dt_time = time.time() - t0
        if not in_loop: timers["init_ocean"] = dt_time
        return res
        
    def wrap_cyclone(loc, dt):
        t0 = time.time()
        res = orig_cyclone(loc, dt)
        dt_time = time.time() - t0
        if not in_loop: timers["init_cyclone"] = dt_time
        return res
        
    def wrap_gis(loc, dt):
        t0 = time.time()
        res = orig_gis(loc, dt)
        dt_time = time.time() - t0
        if not in_loop: timers["init_gis"] = dt_time
        return res
        
    def wrap_risk(loc, dt, **kwargs):
        t0 = time.time()
        res = orig_risk(loc, dt, **kwargs)
        dt_time = time.time() - t0
        if not in_loop: timers["risk_calc"] = dt_time
        return res
        
    def wrap_route(loc, now, **kwargs):
        t0 = time.time()
        res = orig_route(loc, now, **kwargs)
        timers["route_gen"] = time.time() - t0
        return res
        
    def wrap_safe(loc, start, gis_data):
        nonlocal in_loop
        in_loop = True
        t0 = time.time()
        
        hours = 0.0
        from datetime import timedelta
        for h in range(0, 14):
            loop_stats.append({"weather": 0, "ocean": 0, "cyclone": 0, "hour": h})
            dt = start + timedelta(hours=h)
            
            t_w = time.time()
            weather = orig_weather(loc, dt)
            loop_stats[-1]["weather"] = time.time() - t_w
            
            t_o = time.time()
            ocean = orig_ocean(loc, dt)
            loop_stats[-1]["ocean"] = time.time() - t_o
            
            t_c = time.time()
            cyclone = orig_cyclone(loc, dt)
            loop_stats[-1]["cyclone"] = time.time() - t_c
            
            assessment = orig_risk(loc, dt, weather=weather.data, ocean=ocean.data,
                                        cyclone=cyclone.data, gis=gis_data, sources=[],
                                        mode=weather.mode)
            if assessment.data.get("category") in ("HIGH", "EXTREME"):
                break
            hours += 1
            
        timers["safe_window"] = time.time() - t0
        in_loop = False
        return hours
        
    f.weather_agent.run = wrap_weather
    f.ocean_agent.run = wrap_ocean
    f.cyclone_agent.run = wrap_cyclone
    f.gis_agent.run = wrap_gis
    f.risk_agent.run = wrap_risk
    f.route_agent.run = wrap_route
    f._safe_window_hours = wrap_safe
    
    t0 = time.time()
    try:
        f.fishing_outlook(lat=lat, lon=lon, radius_km=100.0, days=3, lang="en")
    except Exception as e:
        print(f"Error: {e}")
    total_time = time.time() - t0
    
    print("--- BENCHMARK RESULTS ---")
    print(f"1. Initial weather_agent: {timers['init_weather']*1000:.1f} ms")
    print(f"2. Initial ocean_agent:   {timers['init_ocean']*1000:.1f} ms")
    print(f"3. Initial cyclone_agent: {timers['init_cyclone']*1000:.1f} ms")
    print(f"4. Initial gis_agent:     {timers['init_gis']*1000:.1f} ms")
    print(f"6. Risk calculation:      {timers['risk_calc']*1000:.1f} ms")
    print(f"7. Route generation:      {timers['route_gen']*1000:.1f} ms")
    print(f"5. _safe_window_hours:    {timers['safe_window']*1000:.1f} ms")
    print(f"8. Total /fishing req:    {total_time*1000:.1f} ms")
    print("\nLoop hour breakdown:")
    for stat in loop_stats:
        h = stat['hour']
        w_ms = stat['weather']*1000
        o_ms = stat['ocean']*1000
        c_ms = stat['cyclone']*1000
        w_cache = "Cache Hit" if w_ms < 50 else "Network/Provider"
        o_cache = "Cache Hit" if o_ms < 50 else "Network/Provider"
        c_cache = "Cache Hit" if c_ms < 50 else "Network/Provider"
        
        print(f"  Hour {h}:")
        print(f"    Weather: {w_ms:.1f} ms ({w_cache})")
        print(f"    Ocean:   {o_ms:.1f} ms ({o_cache})")
        print(f"    Cyclone: {c_ms:.1f} ms ({c_cache})")

if __name__ == '__main__':
    benchmark()
