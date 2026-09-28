"""Explanation agent — the only component allowed to speak in sentences.

It answers the five questions every ORCA recommendation must answer:
WHAT (the verdict), WHY (ranked factors), WHERE, WHEN, and from WHICH SOURCE
with what confidence. It renders from structured agent output only; it cannot
invent a number, because it never sees free text — only typed measurements.
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from ..config import SOURCE_LABELS
from ..schemas import (AgentResult, Evidence, Language, Location, PFZZone,
                       RiskAssessment, RouteOption, StructuredResponse)
from ..services.i18n import SUGGESTIONS, humanise_duration, t, verdict_key
from .base import timed

# Localised names for the risk factors (rendering concern, kept next to the renderer)
FACTOR_LABELS: Dict[str, Dict[str, str]] = {
    "wave":    {"en": "Wave height",        "hi": "लहरों की ऊँचाई", "kn": "ಅಲೆಯ ಎತ್ತರ"},
    "wind":    {"en": "Wind speed",         "hi": "हवा की गति",     "kn": "ಗಾಳಿಯ ವೇಗ"},
    "cyclone": {"en": "Official warning",   "hi": "आधिकारिक चेतावनी", "kn": "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ"},
    "weather": {"en": "Rain / visibility",  "hi": "बारिश / दृश्यता", "kn": "ಮಳೆ / ಗೋಚರತೆ"},
    "ocean":   {"en": "Sea state",          "hi": "समुद्र की स्थिति", "kn": "ಸಮುದ್ರದ ಸ್ಥಿತಿ"},
    "gis":     {"en": "Position & zones",   "hi": "स्थिति व क्षेत्र",  "kn": "ಸ್ಥಳ ಮತ್ತು ಪ್ರದೇಶಗಳು"},
}


def _factor_label(key: str, lang: Language) -> str:
    return FACTOR_LABELS.get(key, {}).get(lang) or FACTOR_LABELS.get(key, {}).get("en", key)


WARNING_STATE = {"active": {"en": "active", "hi": "सक्रिय", "kn": "ಸಕ್ರಿಯ"},
                 "none": {"en": "none", "hi": "कोई नहीं", "kn": "ಯಾವುದೂ ಇಲ್ಲ"}}
SEA_STATE_L10N = {
    "calm":       {"en": "calm", "hi": "शांत", "kn": "ಶಾಂತ"},
    "slight":     {"en": "slight", "hi": "हल्का", "kn": "ಸ್ವಲ್ಪ"},
    "moderate":   {"en": "moderate", "hi": "मध्यम", "kn": "ಮಧ್ಯಮ"},
    "rough":      {"en": "rough", "hi": "उग्र", "kn": "ಪ್ರಕ್ಷುಬ್ಧ"},
    "very rough": {"en": "very rough", "hi": "अति उग्र", "kn": "ಬಹಳ ಪ್ರಕ್ಷುಬ್ಧ"},
    "phenomenal": {"en": "phenomenal", "hi": "अत्यंत भीषण", "kn": "ಅತ್ಯಂತ ಭೀಕರ"},
}


def _short_value(key: str, weather: Dict, ocean: Dict, cyclone: Dict, gis: Dict,
                 lang: Language = "en") -> str:
    """Compact value for the reason line — units stay numeric in every language."""
    if key == "wave" and ocean.get("wave_height_m") is not None:
        return f"{ocean['wave_height_m']:.1f} m"
    if key == "wind" and weather.get("wind_speed_kmh") is not None:
        return f"{weather['wind_speed_kmh']:.0f} km/h"
    if key == "cyclone":
        state = "active" if cyclone.get("official_warning_active") else "none"
        return WARNING_STATE[state].get(lang, state)
    if key == "weather" and weather.get("rain_probability_pct") is not None:
        return f"{weather['rain_probability_pct']:.0f}%"
    if key == "ocean":
        label = str(ocean.get("sea_state", "-"))
        return SEA_STATE_L10N.get(label, {}).get(lang, label)
    if key == "gis":
        if gis.get("inside_restricted_zone"):
                return {"en": "restricted area", "hi": "प्रतिबंधित क्षेत्र",
                    "kn": "ನಿರ್ಬಂಧಿತ ಪ್ರದೇಶ"}.get(lang, "restricted area")
        if gis.get("distance_from_shore_km") is not None:
            offshore = {"en": "km offshore", "hi": "किमी दूर", "kn": "ಕಿಮೀ ದೂರ"}.get(lang, "km offshore")
            return f"{gis['distance_from_shore_km']:.0f} {offshore}"
    return "-"


def build_evidence(weather: Dict, ocean: Dict, cyclone: Dict, gis: Dict,
                   agents: Dict[str, AgentResult]) -> List[Evidence]:
    """The 'tap to see the source' table behind every recommendation."""
    rows: List[Evidence] = []

    def add(label: str, value: str, agent_key: str):
        a = agents.get(agent_key)
        if not a:
            return
        rows.append(Evidence(label=label, value=value,
                             source=SOURCE_LABELS.get(a.source, a.source),
                             timestamp=a.timestamp, confidence=a.confidence,
                             mode=a.mode))

    if ocean.get("wave_height_m") is not None:
        add("Wave height", f"{ocean['wave_height_m']:.1f} m", "ocean")
    if ocean.get("wave_period_s") is not None:
        add("Wave period", f"{ocean['wave_period_s']:.1f} s", "ocean")
    if ocean.get("sea_state"):
        add("Sea state", str(ocean["sea_state"]), "ocean")
    if ocean.get("sst_c") is not None:
        add("Sea surface temperature", f"{ocean['sst_c']:.1f} deg C", "ocean")
    if weather.get("wind_speed_kmh") is not None:
        add("Wind", f"{weather['wind_speed_kmh']:.0f} km/h {weather.get('wind_direction', '')}".strip(), "weather")
    if weather.get("rain_probability_pct") is not None:
        add("Rain probability", f"{weather['rain_probability_pct']:.0f}%", "weather")
    if weather.get("visibility_km") is not None:
        add("Visibility", f"{weather['visibility_km']:.1f} km", "weather")
    if cyclone.get("headline"):
        add("Marine warning", str(cyclone["headline"]), "cyclone")
    if gis.get("distance_from_shore_km") is not None:
        add("Distance from shore", f"{gis['distance_from_shore_km']:.1f} km", "gis")
    if gis.get("nearest_zone_name"):
        add("Nearest restricted zone",
            f"{gis['nearest_zone_name']} ({gis.get('nearest_zone_km')} km)", "gis")
    return rows


def _pfz_summary(pfz: List[PFZZone], lang: Language) -> str:
    """Summarise ranked PFZ candidates without implying INCOIS ranked them."""
    if not pfz:
        return ""
    source = "INCOIS advisory geometries" if all(z.source == "INCOIS_WFS" for z in pfz) else "ORCA candidate data"
    ranked = "; ".join(
        f"#{z.rank} {z.distance_km} km {z.bearing}, SST {z.sst_c if z.sst_c is not None else '-'} deg C, "
        f"chlorophyll {z.chlorophyll_mg_m3 if z.chlorophyll_mg_m3 is not None else '-'} mg/m3, "
        f"confidence {int(z.confidence * 100)}%"
        for z in pfz
    )
    if lang == "hi":
        intro = f"{len(pfz)} संभावित मत्स्य क्षेत्र मिले"
        method = f"आधार {source} है; ORCA ने दूरी, क्लोरोफिल और समुद्री स्थिति के आधार पर क्रम तय किया"
    elif lang == "kn":
        intro = f"{len(pfz)} ಸಂಭಾವ್ಯ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು ಸಿಕ್ಕಿವೆ"
        method = f"ಆಧಾರ {source}; ದೂರ, ಕ್ಲೋರೊಫಿಲ್ ಮತ್ತು ಸಮುದ್ರದ ಸ್ಥಿತಿಯ ಆಧಾರದ ಮೇಲೆ ORCA ಕ್ರಮ ನೀಡಿದೆ"
    else:
        intro = f"Found {len(pfz)} potential fishing zones"
        method = f"The source is {source}; ORCA ranked these candidates using distance, chlorophyll and sea state"
    return f"{intro}. {method}. Ranked zones: {ranked}."


@timed
def run(*, intent, risk: Optional[RiskAssessment], pfz: List[PFZZone],
        routes: List[RouteOption], geofence: List, weather: Dict, ocean: Dict,
        cyclone: Dict, gis: Dict, agents: Dict[str, AgentResult],
        mode: str, when: datetime, chat_mode: str = "OFFLINE", historical: Optional[Dict[str, Any]] = None) -> AgentResult:
    lang: Language = intent.language
    parts: List[str] = []
    structured: Optional[StructuredResponse] = None

    if getattr(intent, "intent", None) == "historical_analysis" and historical:
        vars_ = historical.get("variables", {})
        avail = historical.get("availability", {})
        prov = historical.get("provenance", [{}])
        provider = prov[0].get("provider", "Copernicus/Open-Meteo") if prov else "Copernicus/Open-Meteo"
        
        rows = []
        for var_id, label, unit in [("chlorophyll", "Chlorophyll", "mg/m³"), ("sst", "SST", "°C"), ("current_speed", "Current speed", "m/s")]:
            if avail.get(var_id, {}).get("status") == "AVAILABLE" and var_id in vars_:
                s = vars_[var_id].get("statistics", {})
                chg = s.get("change_percent")
                chg_str = f"{chg:+.1f}%" if chg is not None else None
                rows.append([label, s.get("first"), s.get("last"), chg_str, s.get("trend", "stable"), provider])
        if rows:
            structured = StructuredResponse(
                type="historical",
                title=f"Historical Trends ({historical.get('period', {}).get('start')} to {historical.get('period', {}).get('end')})",
                columns=["Variable", "Start", "End", "Change", "Trend", "Source"],
                rows=rows,
                source=f"Source: {provider}"
            )
            
    elif intent.intent in ("find_pfz", "route") and pfz and len(pfz) > 1:
        has_suitability = any(z.environmental_inputs and "suitability" in z.environmental_inputs for z in pfz)
        columns = ["Rank", "Distance", "Direction", "Latitude", "Longitude", "SST", "Chlorophyll", "Wave"]
        if has_suitability:
            columns.append("Suitability")
            
        rows = []
        for z in pfz:
            row = [
                z.rank,
                f"{z.distance_km} km" if z.distance_km is not None else None,
                z.bearing,
                f"{z.latitude:.4f}",
                f"{z.longitude:.4f}",
                f"{z.sst_c:.1f}°C" if z.sst_c is not None else None,
                f"{z.chlorophyll_mg_m3:.2f} mg/m³" if z.chlorophyll_mg_m3 is not None else None,
                f"{z.wave_height_m:.2f} m" if z.wave_height_m is not None else None
            ]
            if has_suitability:
                suit = z.environmental_inputs.get("suitability") if z.environmental_inputs else None
                row.append(f"{suit} / 100" if suit is not None else None)
            rows.append(row)
            
        source_str = "INCOIS PFZ advisory + ORCA environmental observations" if any(z.environmental_inputs for z in pfz) else "ORCA candidate data"
        structured = StructuredResponse(
            type="fishing_zones",
            title="Nearby Fishing Zones",
            columns=columns,
            rows=rows,
            source=f"Source: {source_str}"
        )

    elif intent.intent in ("alerts", "emergency", "weather", "marine_conditions", "fishing_safety"):
        # Hazards combined table
        hazard_rows = []
        for alert in geofence:
            hazard_rows.append([
                alert.zone_name,
                alert.severity.upper(),
                f"{alert.distance_km:.1f} km",
                "N/A",
                "ORCA Geofence"
            ])
        
        alerts_list = cyclone.get("alerts", []) if isinstance(cyclone, dict) else []
        for a in alerts_list:
            hazard_rows.append([
                a.get("headline") or a.get("type", "Alert"),
                str(a.get("severity", "")).upper(),
                a.get("location", "Regional"),
                a.get("valid_till", "Unknown"),
                a.get("source", "IMD")
            ])
            
        if len(hazard_rows) > 1:
            structured = StructuredResponse(
                type="hazards",
                title="Marine Hazards & Alerts",
                columns=["Hazard", "Severity", "Location", "Valid Until", "Source"],
                rows=hazard_rows,
                source="Source: Integrated Alerts"
            )
        elif weather and ocean and not routes and not pfz:
            # Weather compact key-value
            w_rows = []
            if weather.get("wind_speed_kmh") is not None:
                w_rows.append(["Wind", f"{weather['wind_speed_kmh']:.0f} km/h {weather.get('wind_direction', '')}".strip()])
            if ocean.get("wave_height_m") is not None:
                w_rows.append(["Wave height", f"{ocean['wave_height_m']:.1f} m"])
            if ocean.get("sst_c") is not None:
                w_rows.append(["SST", f"{ocean['sst_c']:.1f}°C"])
            if weather.get("visibility_km") is not None:
                w_rows.append(["Visibility", f"{weather['visibility_km']:.1f} km"])
                
            if len(w_rows) > 1:
                structured = StructuredResponse(
                    type="weather",
                    title="Marine Conditions",
                    columns=["Condition", "Value"],
                    rows=w_rows,
                    source="Source: Open-Meteo Marine / Copernicus Marine"
                )

    if routes and len(routes) > 1 and not (structured and structured.type == "fishing_zones"):
        r_rows = []
        for r in routes:
            r_rows.append([
                r.name,
                f"{r.distance_km:.1f} km",
                r.risk_category,
                humanise_duration(r.eta_minutes, lang),
                "Recommended" if r.recommended else "Alternate"
            ])
        structured = StructuredResponse(
            type="routes",
            title="Available Routes",
            columns=["Route", "Distance", "Risk", "Estimated Time", "Status"],
            rows=r_rows,
            source="Source: ORCA Routing Engine"
        )


    # ── Historical-analysis path ───────────────────────────────────────────
    # When the intent is a trend/history query, skip the safety verdict entirely.
    # The answer is grounded exclusively in the historical timeseries statistics.
    if getattr(intent, "intent", None) == "historical_analysis":
        if chat_mode == "AI" and historical:
            from ..services import groq_intent
            context_data = {
                "intent": intent.model_dump() if intent else None,
                "historical": historical,
                "sources": [],
            }
            ai_answer = groq_intent.generate_explanation(context_data, lang)
            if ai_answer:
                return AgentResult(
                    agent="explanation", ok=True,
                    data={
                        "answer": ai_answer,
                        "evidence": [],
                        "suggestions": SUGGESTIONS.get(lang, SUGGESTIONS["en"]),
                        "disclaimer": t("disclaimer", lang),
                    },
                    source="ORCA",
                    timestamp=when.isoformat(timespec="seconds"),
                    confidence=0.9,
                    mode=mode,  # type: ignore[arg-type]
                )

        # OFFLINE deterministic fallback for historical intent
        if historical:
            vars_ = historical.get("variables", {})
            avail = historical.get("availability", {})
            period = historical.get("period", {})
            loc_name = historical.get("location", {}).get("name", "this location")
            start = period.get("start", "")
            end = period.get("end", "")
            lines = [f"Historical marine analysis for {loc_name} ({start} to {end}):"]
            for var_id, label, unit in [
                ("chlorophyll", "Chlorophyll", "mg/m³"),
                ("sst", "Sea surface temperature", "°C"),
                ("current_speed", "Current speed", "m/s"),
            ]:
                st = avail.get(var_id, {}).get("status", "UNAVAILABLE")
                if st == "AVAILABLE" and var_id in vars_:
                    s = vars_[var_id].get("statistics", {})
                    trend = s.get("trend", "stable")
                    chg = s.get("change_percent")
                    chg_str = f" ({chg:+.1f}%)" if chg is not None else ""
                    lines.append(
                        f"{label}: {s.get('first', '-')} → {s.get('last', '-')} {unit}, "
                        f"trend {trend}{chg_str} [Source: {historical.get('provenance', [{}])[0].get('provider', 'Copernicus/Open-Meteo')}]."
                    )
                else:
                    reason = avail.get(var_id, {}).get("reason", "Data unavailable.")
                    lines.append(f"{label}: {reason}")
            answer = " ".join(lines)
        else:
            answer = (
                "ORCA was unable to retrieve historical marine data for this location. "
                "Please try again or select a different period."
            )

        return AgentResult(
            agent="explanation", ok=True,
            data={
                "answer": answer,
                "evidence": [],
                "suggestions": SUGGESTIONS.get(lang, SUGGESTIONS["en"]),
                "disclaimer": t("disclaimer", lang),
            },
            source="ORCA",
            timestamp=when.isoformat(timespec="seconds"),
            confidence=0.9,
            mode=mode,  # type: ignore[arg-type]
        )

    # ── Standard safety/risk path ──────────────────────────────────────────

    # ---- WHAT ------------------------------------------------------------
    if risk is not None:
        verdict = t(verdict_key(risk.category), lang)
        parts.append(f"{verdict}. {t('risk_score', lang)}: {risk.score}/100.")

        # ---- WHY ---------------------------------------------------------
        top = [f for f in risk.factors if f.contribution > 0][:3]
        if top:
            reasons = "; ".join(
                f"{_factor_label(f.key, lang)} {_short_value(f.key, weather, ocean, cyclone, gis, lang)}"
                for f in top
            )
            parts.append(f"{t('why', lang)}: {reasons}.")

        if risk.official_warning:
            parts.append(t("official_warning", lang))

        # ---- WHEN --------------------------------------------------------
        if risk.category in ("HIGH", "EXTREME"):
            if risk.window:
                parts.append(t("improves_at", lang, hour=risk.window.split(":")[0]))
            else:
                parts.append(t("no_improvement", lang))

    # ---- fishing zones ---------------------------------------------------
    if pfz and intent.intent in ("find_pfz", "route"):
        parts.append(_pfz_summary(pfz, lang))
        parts.append(t("pfz_note", lang))

    # ---- route -----------------------------------------------------------
    if routes:
        rec = next((r for r in routes if r.recommended), routes[0])
        parts.append(
            f"{t('route_intro', lang)}: "
            + t("route_detail", lang, distance=rec.distance_km,
                eta=humanise_duration(rec.eta_minutes, lang))
        )

    # ---- geofence --------------------------------------------------------
    for alert in geofence[:2]:
        key = "geofence_inside" if alert.inside else "geofence_warn"
        parts.append(t(key, lang, zone=alert.zone_name, distance=alert.distance_km))

    # ---- provenance ------------------------------------------------------
    # Only real data providers belong in the citation line — "ORCA" is us.
    srcs = sorted({SOURCE_LABELS.get(a.source, a.source)
                   for a in agents.values() if a.ok and a.source not in ("ORCA",)})
    parts.append(f"{t('sources', lang)}: {', '.join(srcs)} · "
                 f"{t('updated', lang)} {when.strftime('%d %b %Y, %H:%M IST')}")
    if mode == "DEMO":
        parts.append(t("demo_mode", lang))

    answer = " ".join(parts)

    if chat_mode == "AI":
        from ..services import groq_intent
        context_data = {
            "intent": intent.model_dump() if intent else None,
            "risk": risk.model_dump() if risk else None,
            "pfz": [p.model_dump() for p in pfz] if pfz else [],
            "routes": [r.model_dump() for r in routes] if routes else [],
            "weather": weather,
            "ocean": ocean,
            "cyclone": cyclone,
            "gis": gis,
            "historical": historical,
            "sources": srcs,
            "has_structured_table": structured.type if structured else None
        }

        ai_answer = groq_intent.generate_explanation(context_data, lang)
        if ai_answer:
            answer = ai_answer

    return AgentResult(
        agent="explanation",
        ok=True,
        data={
            "answer": answer,

            "evidence": [e.model_dump() for e in build_evidence(weather, ocean, cyclone, gis, agents)],
            "suggestions": SUGGESTIONS.get(lang, SUGGESTIONS["en"]),
            "disclaimer": t("disclaimer", lang),
        },
        source="ORCA",
        timestamp=when.isoformat(timespec="seconds"),
        confidence=0.9,
        mode=mode,  # type: ignore[arg-type]
    )
    if structured:
        res.data["structured"] = structured.model_dump()
        # Remove the dense pfz prose if we have a table
        if structured.type == "fishing_zones" and not chat_mode == "AI":
            res.data["answer"] = " ".join([p for p in parts if not p.startswith("Found") and not p.startswith("The source is")])
    return res


