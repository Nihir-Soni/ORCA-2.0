import time
import urllib.request
import json

url = 'https://orca-2-0.vercel.app/api/fishing?lat=19.0&lon=72.8&radius_km=100&days=3&lang=en'

print("--- VERCEL ---")
for i in range(3):
    t0 = time.time()
    try:
        response = urllib.request.urlopen(url)
        data = response.read()
        latency = (time.time() - t0) * 1000
        print(f"Request {i+1}: {latency:.1f} ms")
        if i == 0:
            parsed = json.loads(data)
            print(f"Mode: {parsed.get('mode')}")
    except Exception as e:
        print(f"Request {i+1} failed: {e}")
        
print("--- LOCAL (Simulated via script) ---")
