"""Emergency message formatting for the ORCA SOS flow."""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import APIRouter
import httpx
from pydantic import BaseModel, Field
from ..schemas import Language

router = APIRouter(prefix="/api", tags=["sos"])
SOS_RECIPIENT = os.getenv("ORCA_SMS_TO", "9339698196")


class SosRisk(BaseModel):
    category: str
    score: int


class SosRoute(BaseModel):
    available: bool = False
    destination: Optional[dict] = None
    distance_km: Optional[float] = None
    eta_minutes: Optional[int] = None
    risk_score: Optional[int] = None
    risk_category: Optional[str] = None


class SosRequest(BaseModel):
    latitude: float
    longitude: float
    risk: SosRisk
    hazards: List[str] = Field(default_factory=list)
    route: Optional[SosRoute] = None
    message: str = "Engine failure. Unable to return to shore."
    language: Language = "en"


def _duration(minutes: int) -> str:
    hours, remainder = divmod(minutes, 60)
    return f"{hours}h {remainder}m" if hours else f"{remainder}m"


def _phone_number(value: str) -> str:
    digits = "".join(character for character in value if character.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    return f"+{digits}" if digits else value


def _send_sms(body: str) -> tuple[bool, str, Optional[str]]:
    """Send through TextBee when configured; retain a truthful demo fallback."""
    api_key = os.getenv("TEXTBEE_API_KEY", "").strip()
    if not api_key:
        return False, "SMS provider is not configured.", None

    device_id = os.getenv("TEXTBEE_DEVICE_ID", "").strip()
    endpoint = "https://api.textbee.dev/api/v1/gateway/send-sms"
    
    payload = {
        "recipients": [_phone_number(SOS_RECIPIENT)],
        "message": body
    }
    if device_id:
        payload["deviceId"] = device_id

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json"
    }

    try:
        response = httpx.post(
            endpoint,
            json=payload,
            headers=headers,
            timeout=10.0,
        )
        if response.is_success:
            return True, "Emergency SMS sent.", None
        return False, f"SMS provider rejected the message ({response.status_code}).", None
    except httpx.HTTPError:
        return False, "SMS provider could not be reached.", None


@router.post("/sos")
def send_sos(req: SosRequest) -> dict:
    """Create and, when configured, deliver the emergency SMS."""
    labels = {
        "en": {"title": "ORCA SOS EMERGENCY", "location": "BOAT LOCATION", "risk": "CURRENT RISK", "hazards": "ACTIVE HAZARDS", "route": "SAFEST ROUTE TO LAND", "unavailable": "Unavailable - ORCA could not determine a safe return route.", "destination": "Destination", "distance": "Distance", "eta": "ETA", "route_risk": "Route Risk", "message": "MESSAGE", "none": "None reported"},
        "hi": {"title": "ORCA SOS आपातकाल", "location": "नाव का स्थान", "risk": "वर्तमान जोखिम", "hazards": "सक्रिय खतरे", "route": "भूमि तक सबसे सुरक्षित मार्ग", "unavailable": "उपलब्ध नहीं - ORCA सुरक्षित वापसी मार्ग निर्धारित नहीं कर सका।", "destination": "गंतव्य", "distance": "दूरी", "eta": "अनुमानित समय", "route_risk": "मार्ग जोखिम", "message": "संदेश", "none": "कोई नहीं"},
        "kn": {"title": "ORCA SOS ತುರ್ತು ಪರಿಸ್ಥಿತಿ", "location": "ದೋಣಿಯ ಸ್ಥಳ", "risk": "ಪ್ರಸ್ತುತ ಅಪಾಯ", "hazards": "ಸಕ್ರಿಯ ಅಪಾಯಗಳು", "route": "ಭೂಮಿಗೆ ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ", "unavailable": "ಲಭ್ಯವಿಲ್ಲ - ORCA ಸುರಕ್ಷಿತ ಹಿಂದಿರುಗುವ ಮಾರ್ಗವನ್ನು ಕಂಡುಹಿಡಿಯಲಿಲ್ಲ.", "destination": "ಗಮ್ಯಸ್ಥಾನ", "distance": "ದೂರ", "eta": "ಅಂದಾಜು ಸಮಯ", "route_risk": "ಮಾರ್ಗದ ಅಪಾಯ", "message": "ಸಂದೇಶ", "none": "ಯಾವುದೂ ಇಲ್ಲ"},
    }.get(req.language, {})
    labels = labels or {
        "title": "ORCA SOS EMERGENCY", "location": "BOAT LOCATION", "risk": "CURRENT RISK", "hazards": "ACTIVE HAZARDS", "route": "SAFEST ROUTE TO LAND", "unavailable": "Unavailable - ORCA could not determine a safe return route.", "destination": "Destination", "distance": "Distance", "eta": "ETA", "route_risk": "Route Risk", "message": "MESSAGE", "none": "None reported",
    }
    lines = [
        labels["title"],
        "",
        labels["location"],
        f"Lat: {req.latitude:.6f}",
        f"Lng: {req.longitude:.6f}",
        f"Map: https://www.google.com/maps?q={req.latitude:.6f},{req.longitude:.6f}",
        "",
        labels["risk"],
        f"Risk: {req.risk.category} ({req.risk.score})",
        "",
        labels["hazards"],
    ]
    lines.extend(f"- {hazard}" for hazard in req.hazards or [labels["none"]])
    lines.extend(["", labels["route"]])
    if req.route and req.route.available:
        destination = req.route.destination or {}
        lines.extend([
            f"{labels['destination']}: {destination.get('name', 'Safe shore')}",
            f"{labels['distance']}: {req.route.distance_km:g} km" if req.route.distance_km is not None else f"{labels['distance']}: unavailable",
            f"{labels['eta']}: {_duration(req.route.eta_minutes)}" if req.route.eta_minutes is not None else f"{labels['eta']}: unavailable",
            f"{labels['route_risk']}: {req.route.risk_category} ({req.route.risk_score})",
        ])
    else:
        lines.append(labels["unavailable"])
    lines.extend(["", labels["message"], req.message.strip()])
    sms = "\n".join(lines)
    delivered, status, provider_id = _send_sms(sms)
    return {
        "ok": True,
        "message": status,
        "recipient": SOS_RECIPIENT,
        "delivered": delivered,
        "provider_id": provider_id,
        "sms": sms,
    }