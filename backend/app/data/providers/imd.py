import re
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx
from shapely.geometry import Point, Polygon

from ...schemas import ProviderMetadata, ProviderResponse
from . import BaseProvider
from ..geo import nearest_port

COASTAL_AND_REGIONAL_KEYWORDS: Dict[str, List[str]] = {
    "tamil nadu": [
        "tamil nadu", "tamilnadu", "chennai", "madras", "cuddalore", "nagapattinam",
        "kancheepuram", "kanchipuram", "tiruvallur", "thiruvallur", "thoothukudi",
        "thoothukkudi", "tuticorin", "ramanathapuram", "kanyakumari", "kanniyakumari",
        "thanjavur", "thiruvarur", "tirunelveli", "tiruvannamalai", "viluppuram",
        "ariyalur", "chengalpattu", "perambalur", "sivaganga", "madurai",
        "coimbatore", "salem", "trichy", "vellore"
    ],
    "maharashtra": [
        "maharashtra", "mumbai", "bombay", "konkan", "ratnagiri", "thane",
        "palghar", "raigad", "sindhudurg", "sassoon", "alibag", "dahanu", "malvan"
    ],
    "goa": [
        "goa", "panaji", "panjim", "mormugao", "north goa", "south goa", "vasco", "margao"
    ],
    "gujarat": [
        "gujarat", "veraval", "saurashtra", "kutch", "kachchh", "jamnagar",
        "bhavnagar", "porbandar", "junagadh", "amreli", "dwarka", "surat",
        "valsad", "navsari", "bharuch", "okha", "mandvi"
    ],
    "kerala": [
        "kerala", "kochi", "cochin", "thiruvananthapuram", "trivandrum",
        "kozhikode", "calicut", "malabar", "kollam", "alappuzha", "ernakulam",
        "kannur", "kasaragod", "kottayam", "thrissur", "malappuram", "munambam", "vizhinjam"
    ],
    "karnataka": [
        "karnataka", "bangalore", "bengaluru", "mangalore", "mangaluru", "udupi",
        "karwar", "uttara kannada", "dakshina kannada", "malpe", "bhatkal", "kumta"
    ],
    "andhra pradesh": [
        "andhra", "visakhapatnam", "vizag", "srikakulam", "vizianagaram",
        "east godavari", "west godavari", "krishna", "guntur", "prakasam",
        "nellore", "kakinada", "machilipatnam", "bapatla", "tirupati"
    ],
    "odisha": [
        "odisha", "orissa", "puri", "paradip", "paradeep", "bhubaneswar",
        "cuttack", "balasore", "gopalpur", "ganjam", "bhadrak", "kendrapara",
        "jagatsinghpur", "chandipur", "dhamra"
    ],
    "west bengal": [
        "west bengal", "kolkata", "digha", "sundarbans", "sunderbans",
        "haldia", "howrah", "south 24 parganas", "north 24 parganas", "purba medinipur",
        "kakdwip", "namkhana", "frazerganj"
    ],
    "andaman & nicobar": [
        "andaman", "nicobar", "port blair", "havelock", "neil", "car nicobar"
    ],
    "puducherry": [
        "puducherry", "pondicherry", "karaikal", "mahe", "yanam"
    ],
    "lakshadweep": [
        "lakshadweep", "kavaratti", "agatti", "minicoy", "andrott"
    ],
}

OTHER_INLAND_STATES: Dict[str, List[str]] = {
    "uttarakhand": ["uttarakhand", "uttaranchal", "dehradun", "haridwar", "tehri", "nainital", "chamoli", "rudraprayag", "pithoragarh", "bageshwar", "almora", "champawat", "pauri"],
    "himachal pradesh": ["himachal", "shimla", "manali", "kullu", "kangra", "mandi", "dharamshala", "solan", "chamba", "una"],
    "jammu & kashmir": ["jammu", "kashmir", "srinagar", "anantnag", "baramulla", "udhampur"],
    "ladakh": ["ladakh", "leh", "kargil"],
    "punjab": ["punjab", "amritsar", "ludhiana", "jalandhar", "patiala", "bathinda"],
    "haryana": ["haryana", "gurgaon", "gurugram", "faridabad", "panipat", "ambala", "rohtak", "hisar"],
    "delhi": ["delhi", "new delhi", "ncr"],
    "rajasthan": ["rajasthan", "jaipur", "jodhpur", "udaipur", "bikaner", "kota", "ajmer"],
    "uttar pradesh": ["uttar pradesh", "lucknow", "kanpur", "varanasi", "agra", "noida", "prayagraj", "ghaziabad", "meerut"],
    "bihar": ["bihar", "patna", "gaya", "muzaffarpur", "bhagalpur", "darbhanga"],
    "jharkhand": ["jharkhand", "ranchi", "jamshedpur", "dhanbad", "bokaro"],
    "chhattisgarh": ["chhattisgarh", "raipur", "bilaspur", "durg", "bastar"],
    "madhya pradesh": ["madhya pradesh", "bhopal", "indore", "gwalior", "jabalpur", "ujjain"],
    "assam": ["assam", "guwahati", "silchar", "dibrugarh", "jorhat"],
    "meghalaya": ["meghalaya", "shillong"],
    "manipur": ["manipur", "imphal"],
    "mizoram": ["mizoram", "aizawl"],
    "nagaland": ["nagaland", "kohima", "dimapur"],
    "tripura": ["tripura", "agartala"],
    "arunachal pradesh": ["arunachal", "itanagar"],
    "sikkim": ["sikkim", "gangtok"],
    "telangana": ["telangana", "hyderabad", "warangal", "nizamabad", "karimnagar"],
}

CITY_DISTRICT_CLUSTERS: Dict[str, Dict[str, List[str]]] = {
    "chennai": {
        "primary": ["chennai", "madras", "chengalpattu", "thiruvallur", "tiruvallur", "kanchipuram", "kancheepuram"],
        "coastal_subregion": ["north tamil nadu", "coromandel", "southwest bay of bengal"],
        "other_state_districts": [
            "cuddalore", "mayiladuthurai", "nagapattinam", "ramanathapuram", "thoothukudi", "thoothukkudi",
            "kanyakumari", "kanniyakumari", "thiruvarur", "thanjavur", "tirunelveli", "madurai", "salem"
        ]
    },
    "mumbai": {
        "primary": ["mumbai", "bombay", "thane", "palghar", "raigad", "sassoon"],
        "coastal_subregion": ["north maharashtra", "mumbai metropolitan", "konkan"],
        "other_state_districts": ["ratnagiri", "sindhudurg", "malvan", "goa", "pune", "nashik"]
    },
    "ratnagiri": {
        "primary": ["ratnagiri", "sindhudurg", "malvan", "raigad", "konkan"],
        "coastal_subregion": ["south maharashtra", "konkan coast"],
        "other_state_districts": ["mumbai", "palghar", "thane"]
    },
    "panaji (goa)": {
        "primary": ["goa", "panaji", "panjim", "mormugao", "north goa", "south goa", "vasco", "margao"],
        "coastal_subregion": ["goa coast", "konkan"],
        "other_state_districts": ["mumbai", "karwar", "mangalore"]
    },
    "veraval": {
        "primary": ["veraval", "gir somnath", "somnath", "junagadh", "amreli", "porbandar", "dwarka"],
        "coastal_subregion": ["saurashtra", "gujarat coast", "northeast arabian sea"],
        "other_state_districts": ["valsad", "navsari", "surat", "kutch", "kachchh", "ahmedabad"]
    },
    "kochi": {
        "primary": ["kochi", "cochin", "ernakulam", "alappuzha", "thrissur", "kottayam"],
        "coastal_subregion": ["central kerala", "kerala coast", "southeast arabian sea"],
        "other_state_districts": ["kasaragod", "kannur", "kozhikode", "kollam", "thiruvananthapuram", "vizhinjam"]
    },
    "visakhapatnam": {
        "primary": ["visakhapatnam", "vizag", "anakapalli", "vizianagaram", "srikakulam"],
        "coastal_subregion": ["north coastal andhra", "andhra coast", "west central bay of bengal"],
        "other_state_districts": ["kakinada", "machilipatnam", "bapatla", "prakasam", "nellore", "tirupati", "guntur", "krishna"]
    },
    "paradip": {
        "primary": ["paradip", "paradeep", "jagatsinghpur", "kendrapara", "cuttack", "puri", "bhubaneswar"],
        "coastal_subregion": ["odisha coast", "north bay of bengal"],
        "other_state_districts": ["balasore", "bhadrak", "gopalpur", "ganjam"]
    },
    "digha": {
        "primary": ["digha", "purba medinipur", "south 24 parganas", "north 24 parganas", "kolkata", "haldia", "kakdwip"],
        "coastal_subregion": ["west bengal coast", "bengal coast", "sundarbans", "north bay of bengal"],
        "other_state_districts": ["dhamra", "balasore", "paradip"]
    },
    "port blair": {
        "primary": ["port blair", "andaman", "nicobar", "havelock", "neil", "car nicobar"],
        "coastal_subregion": ["andaman sea", "southeast bay of bengal"],
        "other_state_districts": []
    }
}


def contains_word(text: str, word: str) -> bool:
    """Check if word exists in text with whole-word boundaries."""
    return bool(re.search(r"\b" + re.escape(word) + r"\b", text))


def is_alert_relevant_to_location(
    area_desc: str,
    headline: str,
    description: str,
    sender: str,
    target_name: str,
    target_state: str,
) -> bool:
    """Checks if an alert belongs to the target location/state."""
    alert_content = f"{area_desc} {headline} {description}".lower()
    sender_lower = sender.lower()
    combined = f"{alert_content} {sender_lower}"

    t_name = target_name.lower().strip()
    t_state = target_state.lower().strip()

    target_key = None
    for k in CITY_DISTRICT_CLUSTERS:
        if k in t_name or t_name in k:
            target_key = k
            break

    cluster = CITY_DISTRICT_CLUSTERS.get(target_key, {})
    primary_kws = cluster.get("primary", [t_name] if t_name else [])
    other_districts = cluster.get("other_state_districts", [])
    subregion_kws = cluster.get("coastal_subregion", [])

    # 1. Direct local match in the ALERT CONTENT (not sender agency name!)
    for kw in primary_kws:
        if len(kw) > 2 and contains_word(alert_content, kw):
            return True

    # 2. Check if alert belongs to other inland states (sender or content)
    for other_st, other_kws in OTHER_INLAND_STATES.items():
        if any(contains_word(combined, k) for k in other_kws if len(k) > 3):
            return False

    # 3. Check if sender is an SDMA of another state (e.g. Andhra Pradesh SDMA)
    for other_st, other_kws in COASTAL_AND_REGIONAL_KEYWORDS.items():
        if t_state and (other_st in t_state or t_state in other_st):
            continue
        sdma_tag = other_st.replace(" ", "-") + "-sdma"
        if sdma_tag in sender_lower or contains_word(sender_lower, other_st):
            return False

    # 4. Check if it explicitly names other districts of the state, but NOT target location
    for d in other_districts:
        if len(d) > 3 and contains_word(alert_content, d):
            return False

    # 5. Check if alert content specifically names another coastal state (excluding 'bay of bengal')
    clean_content = alert_content.replace("bay of bengal", "").replace("bengal sea", "")
    for other_st, other_kws in COASTAL_AND_REGIONAL_KEYWORDS.items():
        if t_state and (other_st in t_state or t_state in other_st):
            continue
        if contains_word(clean_content, other_st):
            return False
        if any(contains_word(clean_content, k) for k in other_kws[:3] if len(k) > 3 and k != "bengal"):
            return False

    # 6. Check subregion match in alert content
    for kw in subregion_kws:
        if contains_word(alert_content, kw):
            return True

    # 7. Statewide warning without exclusions
    if t_state and contains_word(alert_content, t_state):
        return True

    return False


class IMDProvider(BaseProvider):
    """Official cyclone warnings and marine alerts from IMD (via NDMA Sachet CAP Feed)."""

    RSS_FEED_URL = "https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml"
    TIMEOUT = 10.0
    CACHE_TTL = 1800.0  # 30 minutes

    def __init__(self):
        self._cache = {}
        self._lock = threading.Lock()
        self._client = httpx.Client(timeout=self.TIMEOUT)

    def fetch_alerts(
        self,
        lat: float,
        lon: float,
        when: datetime,
        location_name: Optional[str] = None,
        state: Optional[str] = None,
    ) -> Optional[ProviderResponse]:
        """Fetch active cyclone warnings and fishermen advisories."""
        if not state or not location_name:
            port = nearest_port(lat, lon)
            state = state or port.get("state", "")
            location_name = location_name or port.get("name", "")

        cache_key = "imd_cap_alerts"
        now = time.time()
        
        with self._lock:
            if cache_key in self._cache:
                data, ts = self._cache[cache_key]
                if now - ts < self.CACHE_TTL:
                    return self._process_alerts(data, lat, lon, location_name, state)

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
                
            return self._process_alerts(alerts_data, lat, lon, location_name, state)
        except Exception as e:
            print(f"[ORCA][LIVE][IMD] Failed to fetch NDMA RSS feed: {e}")
            return None

    def _process_alerts(
        self,
        alerts_xml: List[str],
        lat: float,
        lon: float,
        location_name: str = "",
        state: str = "",
    ) -> ProviderResponse:
        if not location_name or not state:
            port = nearest_port(lat, lon)
            location_name = location_name or port.get("name", "")
            state = state or port.get("state", "")

        boat_pt = Point(lon, lat)
        active_alerts = []
        
        seen_keys = set()

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
                expires = info.find("cap:expires", ns)
                
                area = info.find("cap:area", ns)
                area_desc = area.find("cap:areaDesc", ns) if area is not None else None
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

                # Regional filter: check spatial geometry or text-based regional matching
                headline_text = headline.text.strip() if headline is not None and headline.text else ""
                event_text = event.text.strip() if event is not None and event.text else "Marine Alert"
                desc_text = description.text.strip() if description is not None and description.text else ""
                sender_text = sender.text.strip() if sender is not None and sender.text else "IMD"
                area_text = area_desc.text.strip() if area_desc is not None and area_desc.text else ""

                if geom_found and is_inside:
                    sender_lower = sender_text.lower()
                    if state and any(f"{other_st.replace(' ', '-')}-sdma" in sender_lower
                                     for other_st in COASTAL_AND_REGIONAL_KEYWORDS
                                     if other_st not in state.lower() and state.lower() not in other_st):
                        is_relevant = False
                    else:
                        is_relevant = True
                elif not geom_found:
                    is_relevant = is_alert_relevant_to_location(
                        area_text, headline_text, desc_text, sender_text, location_name, state
                    )
                else:
                    is_relevant = False

                if not is_relevant:
                    continue

                # Deduplicate alerts with identical headline or event
                alert_key = (headline_text.lower() or event_text.lower(), (severity.text or "").lower())
                if alert_key in seen_keys:
                    continue
                seen_keys.add(alert_key)

                loc_disp = location_name if (location_name and location_name.lower() in f"{area_text} {headline_text}".lower()) else (area_text or location_name or "Regional")

                active_alerts.append({
                    "identifier": identifier.text if identifier is not None else "Unknown",
                    "sender": sender_text,
                    "event": event_text,
                    "severity": severity.text if severity is not None else "Unknown",
                    "headline": headline_text,
                    "description": desc_text,
                    "location": loc_disp,
                    "valid_till": expires.text.strip() if expires is not None and expires.text else "Active",
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
