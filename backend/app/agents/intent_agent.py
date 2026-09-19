"""Intent agent — turns one free-text/voice line into a structured request.

Rule-based on purpose. A hackathon demo cannot depend on an LLM round-trip (or
an API key) to understand "उद्या सकाळी ६ वाजता", and a safety product should not
let a language model decide *what was asked* without a deterministic fallback.
When an LLM is configured it is used only to enrich, never to replace, this.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from ..data.demo_store import now_ist
from ..data.geo import find_port, nearest_port
from ..schemas import Intent, IntentMode, Language, Location
from ..services.i18n import detect_language
from ..services.groq_intent import GroqIntentError, extract_intent
from .base import timed
from ..schemas import AgentResult

# Devanagari -> Latin digits
DEV_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

TIME_WORDS: Dict[str, int] = {
    # English
    "dawn": 5, "sunrise": 6, "early morning": 5, "morning": 6, "forenoon": 10,
    "noon": 12, "midday": 12, "afternoon": 14, "evening": 18, "sunset": 18,
    "night": 21, "midnight": 0,
    # Hindi
    "सुबह": 6, "तड़के": 5, "दोपहर": 12, "शाम": 18, "रात": 21,
    # Kannada
    "ಬೆಳಿಗ್ಗೆ": 6, "ಮುಂಜಾನೆ": 5, "ಮಧ್ಯಾಹ್ನ": 12, "ಸಂಜೆ": 18, "ರಾತ್ರಿ": 21,
}

INTENT_KEYWORDS: Dict[str, List[str]] = {
    "fishing_safety": ["safe", "safety", "danger", "risk", "is it safe", "सुरक्षित", "खतरा", "ಅಪಾಯ", "ಸುರಕ್ಷಿತ"],
    "emergency": ["sos", "emergency", "help", "return", "nearest port", "वापस", "मदद", "ತುರ್ತು", "ಸಹಾಯ"],
    "weather": ["weather", "rain", "temperature", "wind", "visibility", "मौसम", "बारिश", "ಹವಾಮಾನ", "ಮಳೆ"],
    "marine_conditions": ["wave", "waves", "sea", "ocean", "current", "swell", "sst", "chlorophyll", "लहर", "समुद्र", "ಅಲೆ", "ಸಮುದ್ರ"],
    "find_pfz": ["pfz", "fishing zone", "fishing zones", "fishing area", "fishing location", "where are the fish", "where to fish",
                 "catch", "मत्स्य क्षेत्र", "मछली", "मासेमारी क्षेत्र", "मासे कुठे", "जवळचे pfz",
                 "मछली कहाँ", "ಮೀನು ಎಲ್ಲಿದೆ", "ಹತ್ತಿರದ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶ", "ಮೀನುಗಾರಿಕೆಗೆ ಸ್ಥಳ"],
    "route": ["route", "path", "way", "way to", "how do i get", "navigate", "रास्ता", "मार्ग", "ಸುರಕ್ಷಿತ ದಾರಿ", "ಸುರಕ್ಷಿತ ಮಾರ್ಗ",
              "कसे जाऊ", "कैसे जाऊं", "ಹೇಗೆ ಹೋಗುವುದು", "ಸುರಕ್ಷಿತ ಮಾರ್ಗ"],
    "alerts": ["cyclone", "storm", "warning", "alert", "tsunami", "चक्रवात", "चक्रीवादळ",
               "तूफान", "वादळ", "ಚಂಡಮಾರುತ", "ಬಿರುಗಾಳಿ", "चेतावनी", "ಎಚ್ಚರಿಕೆ", "ಅಲರ್ಟ್"],
    "explain": ["why", "explain", "reason", "क्यों", "क्यूँ", "का ", "कारण", "कशामुळे"],
    "historical_analysis": [
        # Explicit time-window phrases
        "historical", "history",
        "last 7 days", "last week", "last 30 days", "last month", "last 3 months",
        "past 7 days", "past week", "past 30 days", "past month", "past 3 months",
        "last 90 days", "past 90 days",
        "over time", "over the last", "over the past",
        "compared with", "previously", "past few",
        # Change / trend verbs and nouns
        "trend", "trends",
        "changed", "change", "changing",
        "declined", "declining",
        "increased", "increasing",
        "decreased", "decreasing",
        "rising", "falling",
        "higher than", "lower than",
        "was it", "were conditions", "has it", "have conditions",
        "how has", "how have", "how did",
        # Marine/productivity compound signals
        "productivity",
        "productivity trend", "productivity changed", "productivity increase",
        "productivity decrease", "productivity higher", "productivity lower",
        "marine productivity", "ocean productivity", "fish productivity",
        "chlorophyll trend", "chlorophyll change", "chlorophyll increased",
        "chlorophyll decreased", "chlorophyll concentration over",
        "sst trend", "sst change",
        "current trend", "current speed trend",
        "conditions over", "conditions changed", "conditions change",
        # Multilingual
        "पिछले", "बदलाव", "प्रवृत्ति",
        "ಹಿಂದಿನ", "ಬದಲಾವಣೆ", "ಪ್ರವೃತ್ತಿ",
    ],
    "restricted": ["restricted", "boundary", "border", "prohibited", "प्रतिबंधित", "सीमा",
                   "बंदी", "निषिद्ध", "ನಿರ್ಬಂಧಿತ", "ಗಡಿ"],
}

ACTIVITY_KEYWORDS = {
    "fishing": ["fish", "fishing", "ಮೀನು", "ಮೀನುಗಾರಿಕೆ", "मछली"],
    "travel": ["travel", "go to", "sail", "ಪ್ರಯಾಣ", "ಹೋಗುವುದು", "ಹೊರಡಲು", "जाना"],
}


def _normalise(text: str) -> str:
    return text.translate(DEV_DIGITS).lower().strip()


def _extract_time(text: str) -> Optional[str]:
    """Return 'HH:MM' if the message pins a time of day."""
    t = _normalise(text)

    # 6 am / 6pm / 06:00 / 12 pm
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b", t)
    if m:
        hour = int(m.group(1)) % 12
        minute = int(m.group(2) or 0)
        if m.group(3).startswith("p"):
            hour += 12
        return f"{hour:02d}:{minute:02d}"

    m = re.search(r"\b(\d{1,2}):(\d{2})\b", t)
    if m:
        return f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"

    # "सकाळी ६ वाजता" / "दुपारी १२" — word sets the part of day, digit the hour
    for word, default_hour in TIME_WORDS.items():
        if word in t:
            m = re.search(rf"{re.escape(word)}\D{{0,12}}(\d{{1,2}})", t)
            if not m:
                m = re.search(rf"(\d{{1,2}})\D{{0,12}}{re.escape(word)}", t)
            if m:
                hour = int(m.group(1))
                if default_hour >= 12 and hour < 12:
                    hour += 12
                if hour <= 23:
                    return f"{hour:02d}:00"
            return f"{default_hour:02d}:00"

    # bare "at 6" / "६ वाजता"
    m = re.search(r"\b(?:at|ಗಂಟೆಗೆ|वाजता|बजे)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:ಗಂಟೆಗೆ|वाजता|बजे)\b", t)
    if m:
        hour = int(m.group(1) or m.group(2))
        if hour <= 23:
            return f"{hour:02d}:00"
    return None


def _extract_date(text: str, base: datetime) -> str:
    t = _normalise(text)
    if any(w in t for w in ["day after tomorrow", "ನಾಡಿದ್ದು", "परवा", "परसों"]):
        return (base + timedelta(days=2)).date().isoformat()
    if any(w in t for w in ["tomorrow", "ನಾಳೆ", "उद्या", "कल"]):
        return (base + timedelta(days=1)).date().isoformat()
    if any(w in t for w in ["today", "ಇಂದು", "ಈಗ", "आज", "अभी", "आत्ता"]):
        return base.date().isoformat()
    return base.date().isoformat()


def _extract_date_range(text: str, base: datetime) -> Tuple[Optional[str], Optional[str]]:
    t = _normalise(text)
    if "last 3 months" in t or "पिछले 3 महीने" in t or "ಕಳೆದ 3 ತಿಂಗಳು" in t:
        return (base - timedelta(days=90)).date().isoformat(), base.date().isoformat()
    if "last month" in t or "last 30 days" in t or "पिछले 30 दिन" in t or "पिछले महीने" in t or "ಕಳೆದ ತಿಂಗಳು" in t or "ಕಳೆದ 30 ದಿನ" in t:
        return (base - timedelta(days=30)).date().isoformat(), base.date().isoformat()
    if "last week" in t or "last 7 days" in t or "पिछले 7 दिन" in t or "पिछले सप्ताह" in t or "ಕಳೆದ ವಾರ" in t or "ಕಳೆದ 7 ದಿನ" in t:
        return (base - timedelta(days=7)).date().isoformat(), base.date().isoformat()
    return None, None


# Most specific question wins: "safest route to the fishing zone" is a ROUTE
# question even though it also mentions fishing zones.
INTENT_PRIORITY = ["emergency", "route", "historical_analysis", "fishing_safety", "find_pfz", "weather", "marine_conditions", "restricted", "alerts", "explain"]


def _classify(text: str) -> str:
    t = _normalise(text)
    for intent in INTENT_PRIORITY:
        if any(w in t for w in INTENT_KEYWORDS[intent]):
            return intent
    return "fishing_safety"


def _intent_needs(intent_type: str, requested: Optional[List[str]] = None) -> List[str]:
    if requested:
        allowed = {"weather", "ocean", "pfz", "route", "cyclone", "gis", "risk"}
        needs = [item for item in requested if item in allowed]
        if needs:
            return list(dict.fromkeys([*SAFETY_CORE, *needs]))
    return needs_for(intent_type)


def _location_for(message: str, location_name: Optional[str], latitude: Optional[float],
                  longitude: Optional[float], location_text: str = "") -> Optional[Location]:
    location: Optional[Location] = None
    port = find_port(message) or find_port(location_name) or find_port(location_text)
    if latitude is not None and longitude is not None:
        near = nearest_port(latitude, longitude)
        location = Location(name=location_name or near["name"], latitude=latitude,
                            longitude=longitude, state=near["state"])
    elif port:
        location = Location(name=port["name"], latitude=port["lat"],
                            longitude=port["lon"], state=port["state"])
    return location


def _activity(text: str) -> str:
    t = _normalise(text)
    for activity, words in ACTIVITY_KEYWORDS.items():
        if any(w in t for w in words):
            return activity
    return "fishing"


# Every question gets the full safety core — a user who asks "is there a cyclone"
# still deserves a go/no-go verdict. Intent only adds the optional specialists.
SAFETY_CORE = ["weather", "ocean", "cyclone", "gis", "risk"]
EXTRA_BY_INTENT = {
    "fishing_safety": [],
    "find_pfz":       ["pfz"],
    "route":          ["pfz", "route"],
    "alerts":         [],
    "restricted":     [],
    "explain":        [],
    "historical_analysis": ["historical"],
}


def needs_for(intent_type: str) -> List[str]:
    return SAFETY_CORE + EXTRA_BY_INTENT.get(intent_type, [])


@timed
def run(message: str, *, language: Optional[Language] = None,
        latitude: Optional[float] = None, longitude: Optional[float] = None,
        location_name: Optional[str] = None,
    previous: Optional[Intent] = None, mode: IntentMode = "OFFLINE") -> AgentResult:
    """Extract language, intent, place and time; inherit context on follow-ups."""
    now = now_ist()
    lang: Language = language or detect_language(message)
    source = "KEYWORD_OFFLINE"
    payload: Dict[str, Any] = {}
    if mode == "AI":
        payload = extract_intent(message)
        intent_type = str(payload.get("intent", ""))
        if intent_type not in {"fishing_safety", "find_pfz", "fishing_outlook", "route", "emergency",
                               "weather", "marine_conditions", "alerts", "restricted", "general_query", "historical_analysis"}:
            raise GroqIntentError("AI mode is unavailable")
        activity = str(payload.get("activity", "fishing"))
        if activity not in {"fishing", "travel"}:
            raise GroqIntentError("AI mode is unavailable")
        source = getattr(payload, "provider", "GROQ")
        source = "NVIDIA_FALLBACK" if source == "NVIDIA_FALLBACK" else "GROQ_LLM"
    else:
        intent_type = _classify(message)
        activity = _activity(message)

    # --- location ---------------------------------------------------------
    location_text = str(payload.get("location_text", "")) if payload else ""
    location = _location_for(message, location_name, latitude, longitude, location_text)
    if location is None and previous and previous.location:
        location = previous.location            # follow-up inherits the place

    # --- time -------------------------------------------------------------
    time_str = _extract_time(message) or (str(payload.get("time")) if payload.get("time") else None)
    
    start_str, end_str = _extract_date_range(message, now)
    
    date_str = str(payload.get("date")) if payload.get("date") else _extract_date(message, now)
    if time_str is None and previous and previous.time and not _mentions_new_day(message):
        time_str = previous.time
        date_str = previous.date or date_str

    missing: List[str] = []
    if location is None:
        missing.append("location")

    intent = Intent(
        intent=intent_type,
        activity=activity,
        location=location,
        location_text=(location.name if location else ""),
        date=date_str,
        start_date=start_str,
        end_date=end_str,
        time=time_str or f"{now.hour:02d}:00",
        language=(payload.get("language") if payload.get("language") in {"en", "hi", "kn"} else lang),
        raw_query=message,
        needs=_intent_needs(intent_type, payload.get("needs")),
        missing=missing,
        intent_source=source,
    )

    return AgentResult(
        agent="intent",
        ok=True,
        location=location,
        data=intent.model_dump(),
        source=source,
        timestamp=now.isoformat(timespec="seconds"),
        confidence=0.9 if location else 0.6,
        mode="STATIC",
    )


def _mentions_new_day(text: str) -> bool:
    t = _normalise(text)
    return any(w in t for w in ["tomorrow", "today", "उद्या", "आज", "कल", "परवा", "परसों"])
