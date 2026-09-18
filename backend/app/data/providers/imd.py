import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx
from shapely.geometry import Point, Polygon

from ...schemas import ProviderMetadata, ProviderResponse
from . import BaseProvider

class IMDProvider(BaseProvider):
    """Official cyclone warnings and marine alerts from IMD (via NDMA Sachet CAP Feed)."""

    RSS_FEED_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
    TIMEOUT = 10.0
    CACHE_TTL = 1800.0  # 30 minutes

    def __init__(self):
        self._cache = {}
        self._lock = threading.Lock()
        self._client = httpx.Client(timeout=self.TIMEOUT)

    def fetch_alerts(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        """Fetch active cyclone warnings and fishermen advisories."""
        cache_key = "imd_cap_alerts"
        now = time.time()
        
        with self._lock:
            if cache_key in self._cache:
                data, ts = self._cache[cache_key]
                if now - ts < self.CACHE_TTL:
                    return self._process_alerts(data, lat, lon)

        try:
            resp = self._client.get(self.RSS_FEED_URL)
            resp.raise_for_status()
            
            # Parse RSS
            root = ET.fromstring(resp.text)
            cap_urls = []
            
            # Find all items
            for item in root.findall(".//item"):
                category = item.find("category")
                if category is not None and category.text == "Met":
                    link = item.find("link")
                    if link is not None and link.text:
                        cap_urls.append(link.text)
            
            # Fetch individual CAP XMLs
            alerts_data = []
            for url in cap_urls[:10]: # Limit to avoid excessive requests in prototype
                try:
                    cap_resp = self._client.get(url)
                    if cap_resp.status_code == 200:
                        alerts_data.append(cap_resp.text)
                except Exception as e:
                    print(f"[ORCA][LIVE][IMD] Failed to fetch CAP XML: {e}")
                    
            with self._lock:
                self._cache[cache_key] = (alerts_data, now)
                
            return self._process_alerts(alerts_data, lat, lon)
        except Exception as e:
            print(f"[ORCA][LIVE][IMD] Failed to fetch NDMA RSS feed: {e}")
            return None

    def _process_alerts(self, alerts_xml: List[str], lat: float, lon: float) -> ProviderResponse:
        boat_pt = Point(lon, lat)
        active_alerts = []
        
        for xml_text in alerts_xml:
            try:
                root = ET.fromstring(xml_text)
                # CAP namespace
                ns = {'cap': 'urn:oasis:names:tc:emergency:cap:1.2'}
                
                identifier = root.find("cap:identifier", ns)
                sender = root.find("cap:sender", ns)
                
                info = root.find("cap:info", ns)
                if info is None:
                    continue
                    
                event = info.find("cap:event", ns)
                severity = info.find("cap:severity", ns)
                headline = info.find("cap:headline", ns)
                description = info.find("cap:description", ns)
                
                area = info.find("cap:area", ns)
                is_inside = False
                geom_found = False
                
                if area is not None:
                    polygon = area.find("cap:polygon", ns)
                    if polygon is not None and polygon.text:
                        geom_found = True
                        coords = polygon.text.split()
                        poly_points = []
                        for coord in coords:
                            parts = coord.split(',')
                            if len(parts) == 2:
                                # CAP format is lat,lon
                                poly_points.append((float(parts[1]), float(parts[0])))
                        
                        if len(poly_points) >= 3:
                            poly = Polygon(poly_points)
                            if poly.contains(boat_pt):
                                is_inside = True
                                
                    # Note: We can also handle <cap:circle> here if needed
                    circle = area.find("cap:circle", ns)
                    if circle is not None and circle.text:
                        geom_found = True
                        # Parse circle and check distance... (simplified for now)
                        parts = circle.text.split()
                        if len(parts) == 2:
                            center = parts[0].split(',')
                            radius_km = float(parts[1])
                            if len(center) == 2:
                                center_pt = Point(float(center[1]), float(center[0]))
                                # rough distance check (not haversine for simplicity here, though should be)
                                # treating 1 deg ~ 111km
                                dist = boat_pt.distance(center_pt) * 111.0
                                if dist <= radius_km:
                                    is_inside = True

                # Include if the boat is inside the geometry, or if it has no geometry (global alert)
                if is_inside or not geom_found:
                    active_alerts.append({
                        "identifier": identifier.text if identifier is not None else "Unknown",
                        "sender": sender.text if sender is not None else "IMD",
                        "event": event.text if event is not None else "Marine Alert",
                        "severity": severity.text if severity is not None else "Unknown",
                        "headline": headline.text if headline is not None else "",
                        "description": description.text if description is not None else "",
                        "spatial": geom_found,
                        "inside_geometry": is_inside
                    })
                    
            except Exception as e:
                print(f"[ORCA][LIVE][IMD] Error parsing CAP XML: {e}")
                continue
                
        return ProviderResponse(
            data={"alerts": active_alerts},
            metadata=ProviderMetadata(
                source="NDMA_SACHET_CAP",
                valid_time=datetime.utcnow().isoformat(),
                mode="LIVE",
                confidence=1.0,
                note="Alerts sourced from official NDMA CAP feed. Geofencing applied locally."
            ),
            timestamp=datetime.utcnow().isoformat()
        )

    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        return self.fetch_alerts(lat, lon, when)

    @staticmethod
    def _cap_time(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    def fetch_hazard_alerts(self) -> Optional[Dict]:
        """Return active official cyclone CAP geometry for the map, unaltered."""
        now = datetime.now(timezone.utc)
        try:
            response = self._client.get(self.RSS_FEED_URL)
            response.raise_for_status()
            root = ET.fromstring(response.text)
            urls = [item.find("link").text for item in root.findall(".//item")
                    if item.find("category") is not None and item.find("category").text == "Met"
                    and item.find("link") is not None and item.find("link").text]
            alerts = []
            ns = {"cap": "urn:oasis:names:tc:emergency:cap:1.2"}
            for url in urls[:10]:
                cap = self._client.get(url)
                if cap.status_code != 200:
                    continue
                doc = ET.fromstring(cap.text)
                info = doc.find("cap:info", ns)
                if info is None:
                    continue
                event = (info.findtext("cap:event", default="", namespaces=ns) or "").upper()
                if not any(word in event for word in ("CYCLONE", "HURRICANE")):
                    continue
                effective = self._cap_time(info.findtext("cap:effective", namespaces=ns))
                expires = self._cap_time(info.findtext("cap:expires", namespaces=ns))
                if (effective and now < effective) or (expires and now > expires):
                    continue
                for area in info.findall("cap:area", ns):
                    polygon = area.findtext("cap:polygon", namespaces=ns)
                    circle = area.findtext("cap:circle", namespaces=ns)
                    base = {"type": "CYCLONE", "source": "NDMA_SACHET_CAP", "event": event,
                            "severity": info.findtext("cap:severity", namespaces=ns),
                            "valid_from": effective.isoformat() if effective else None,
                            "valid_until": expires.isoformat() if expires else None,
                            "identifier": doc.findtext("cap:identifier", namespaces=ns)}
                    if polygon:
                        points = [[float(x.split(",")[0]), float(x.split(",")[1])] for x in polygon.split() if "," in x]
                        if len(points) >= 3:
                            alerts.append({**base, "geometry_type": "polygon", "polygon": points})
                    if circle:
                        values = circle.split()
                        if len(values) == 2 and "," in values[0]:
                            lat, lon = (float(x) for x in values[0].split(","))
                            alerts.append({**base, "geometry_type": "circle", "latitude": lat,
                                           "longitude": lon, "radius_km": float(values[1])})
            return {"hazards": alerts, "fetched_at": datetime.utcnow().isoformat() + "Z"}
        except Exception as e:
            print(f"[ORCA][LIVE][IMD_HAZARDS] Failed to fetch NDMA CAP: {e}")
            return None

imd_provider = IMDProvider()
