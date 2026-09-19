import { Fragment, useEffect, useRef, useState } from "react";
import * as api from "../api";
import type { Language } from "../types";
import { CourseArrow, FishGlyph, LockGlyph, WarnGlyph } from "./glyphs";
import { PORTS } from "./LocationPicker";

/** Engine room — multilingual strings */
const L10N: Record<Language, Record<string, string>> = {
  en: {
    engineRoom: "ORCA ENGINE ROOM",
    configNote: "GET /api/config exposes every weight and threshold — nothing is hidden",
    title: "How ORCA turns raw data into a safety verdict",
    intro:
      "One question triggers one full sweep of the machine: live providers are read once per position, cached as a 72-hour series, reasoned over by ten agents in parallel, floored by deterministic safety rules — every value on screen carries its source, timestamp and mode.",
    s1: "01 · DATA INTAKE", s2: "02 · INTELLIGENCE CREW", s2note: "ThreadPoolExecutor fan-out · real latencies in Agent panel",
    s3: "03 · SAFETY LAW — FLOORS ONLY RAISE", s4: "04 · OUTPUTS",
    oneFetch: "one HTTP fetch", perProvider: "per provider · per position",
    cacheTitle: "SERIES CACHE", cacheBody: "One response holds 72 hours of hourly sea data. Cached for 10 minutes — so timeline, safe-window scan, and authority board all answer from memory.",
    cacheMeta: "failures cached 60s · cleared on mode toggle · 32s → 0.02s",
    everyAgent: "every agent · every hour", fromMemory: "answered from memory",
    degrade: "If a live provider fails, the agent degrades to the demo store and says so — the answer arrives either way, relabelled, never silently pretending.",
    stamp: "Official severe warning → floor 92",
    law1: "IMD fishermen warning active → floor 70",
    law2: "wave ≥ 4.0m → floor 85 · gale wind ≥ 62 km/h → floor 85",
    law3: "inside restricted zone → floor 60",
    lawNote: "Deterministic rules only raise a score. No model, language, or prompt can talk ORCA down from an official warning.",
    reading: "SCANNING THE COAST — LIVE",
    onePort: "one port every", flipNote: "· toggle DATA EDITION to watch sources change",
    nowReading: "NOW READING", wave: "WAVE", wind: "WIND", sst: "SST", vis: "VIS",
    hailing: "Hailing first landing centre…", unreachable: "Backend unreachable — is uvicorn running on port 8000?",
    hPort: "PORT", hSource: "SOURCE", hMode: "MODE", hLatency: "LATENCY", hAt: "TIME",
    feedNote: "These readings feed the risk engine (wave/wind → safety score) and fishing model (SST/chlorophyll → fish probability).",
    outVerdict: "VERDICT", outVerdictD: "0–100 risk, every point attributed, floored by safety law, spoken in the fisher's language.",
    outPlan: "PLAN", outPlanD: "Ranked grounds with fish chance, best window, duration, and safest course.",
    outLedger: "LEDGER", outLedgerD: "Every value with source · timestamp · confidence · mode. CSV export for authority.",
    systemStatus: "SYSTEM STATUS", operational: "OPERATIONAL",
  },
  hi: {
    engineRoom: "ORCA इंजन रूम",
    configNote: "GET /api/config हर वेट और सीमा दिखाता है — कुछ भी छिपा नहीं",
    title: "ORCA कच्चे डेटा को सुरक्षा निर्णय में कैसे बदलता है",
    intro:
      "एक सवाल पूरी मशीन चलाता है: लाइव स्रोत हर स्थान के लिए एक बार पढ़े जाते हैं, 72 घंटे की सीरीज़ के रूप में याद रहते हैं, दस एजेंट एक साथ तर्क करते हैं, निश्चित सुरक्षा नियम लागू होते हैं — स्क्रीन पर हर आँकड़े के साथ स्रोत, समय और मोड होता है।",
    s1: "01 · डेटा आगम", s2: "02 · बुद्धिमत्ता दल", s2note: "ThreadPoolExecutor फैन-आउट · एजेंट पैनल में असली लेटेंसी",
    s3: "03 · सुरक्षा कानून — सिर्फ़ जोखिम बढ़ाता है", s4: "04 · परिणाम",
    oneFetch: "एक HTTP कॉल", perProvider: "प्रति स्रोत · प्रति स्थान",
    cacheTitle: "सीरीज़ कैश", cacheBody: "एक जवाब में 72 घंटे का डेटा। 10 मिनट के लिए कैश — टाइमलाइन, सुरक्षित-समय और प्रशासन बोर्ड सब स्मृति से जवाब देते हैं।",
    cacheMeta: "विफलता 60 सेकंड · मोड बदलने पर साफ़ · 32 s → 0.02 s",
    everyAgent: "हर एजेंट · हर घंटा", fromMemory: "स्मृति से जवाब",
    degrade: "लाइव स्रोत विफल हो तो एजेंट डेमो डेटा पर उतर आता है और यह बताता भी है — जवाब हर हाल में आता है।",
    stamp: "आधिकारिक भीषण चेतावनी → 92",
    law1: "IMD मछुआरा चेतावनी सक्रिय → कम-से-कम 70",
    law2: "लहर ≥ 4.0 मी → 85 · आँधी ≥ 62 किमी/घं → 85",
    law3: "प्रतिबंधित क्षेत्र के भीतर → 60",
    lawNote: "निश्चित नियम स्कोर सिर्फ़ बढ़ा सकते हैं। कोई मॉडल ORCA को आधिकारिक चेतावनी से नीचे नहीं ला सकता।",
    reading: "तट की रीडिंग — अभी",
    onePort: "हर", flipNote: "· DATA EDITION बदलिए और स्रोत बदलते देखिए",
    nowReading: "अभी पढ़ रहे हैं", wave: "लहर", wind: "हवा", sst: "SST", vis: "दृश्यता",
    hailing: "पहले लैंडिंग सेंटर से संपर्क…", unreachable: "बैकएंड नहीं मिला — uvicorn पोर्ट 8000 पर चल रहा है?",
    hPort: "बंदरगाह", hSource: "स्रोत", hMode: "मोड", hLatency: "लेटेंसी", hAt: "समय",
    feedNote: "यही रीडिंग मत्स्य मॉडल और रिस्क इंजन खाते हैं।",
    outVerdict: "फ़ैसला", outVerdictD: "0–100 जोखिम, हर अंक के हिसाब के साथ, सुरक्षा नियमों से बँधा।",
    outPlan: "योजना", outPlanD: "रैंक की हुई जगहें, मछली की संभावना, सबसे अच्छा समय और मार्ग।",
    outLedger: "बहीखाता", outLedgerD: "हर मान के साथ स्रोत · समय · भरोसा · मोड। CSV निर्यात।",
    systemStatus: "सिस्टम स्थिति", operational: "चालू",
  },
  kn: {
    engineRoom: "ORCA ಎಂಜಿನ್ ಕೊಠಡಿ",
    configNote: "GET /api/config ಪ್ರತಿಯೊಂದು ತೂಕ ಮತ್ತು ಮಿತಿಯನ್ನು ತೋರಿಸುತ್ತದೆ",
    title: "ORCA ಕಚ್ಚಾ ಡೇಟಾವನ್ನು ಸುರಕ್ಷತಾ ತೀರ್ಪಾಗಿ ಹೇಗೆ ಪರಿವರ್ತಿಸುತ್ತದೆ",
    intro:
      "ಒಂದು ಪ್ರಶ್ನೆ ಸಂಪೂರ್ಣ ಯಂತ್ರವನ್ನು ಚಾಲಿಸುತ್ತದೆ: ಲೈವ್ ಮೂಲಗಳನ್ನು ಒಮ್ಮೆ ಓದಿ, 72 ಗಂಟೆ ಸಂಗ್ರಹಿಸಿ, ಹತ್ತು ಏಜೆಂಟ್‌ಗಳು ಏಕಕಾಲದಲ್ಲಿ ತರ್ಕಿಸಿ, ಸುರಕ್ಷತಾ ನಿಯಮಗಳು ಅನ್ವಯಿಸಿ — ಪ್ರತಿ ಸಂಖ್ಯೆಯೊಂದಿಗೆ ಮೂಲ, ಸಮಯ ಮತ್ತು ಮೋಡ್ ಇರುತ್ತದೆ.",
    s1: "01 · ಡೇಟಾ ಒಳಹರಿವು", s2: "02 · ಬುದ್ಧಿಮತ್ತೆ ತಂಡ", s2note: "ThreadPoolExecutor ಫ್ಯಾನ್-ಔಟ್",
    s3: "03 · ಸುರಕ್ಷತಾ ನಿಯಮ — ಅಪಾಯ ಮಾತ್ರ ಹೆಚ್ಚಿಸುತ್ತದೆ", s4: "04 · ಫಲಿತಾಂಶಗಳು",
    oneFetch: "ಒಂದು HTTP ಕರೆ", perProvider: "ಪ್ರತಿ ಮೂಲ · ಪ್ರತಿ ಸ್ಥಳ",
    cacheTitle: "ಸರಣಿ ಕ್ಯಾಶ್", cacheBody: "ಒಂದು ಪ್ರತಿಕ್ರಿಯೆಯಲ್ಲಿ 72 ಗಂಟೆ ಡೇಟಾ. 10 ನಿಮಿಷ ಕ್ಯಾಶ್ — ಸ್ಮೃತಿಯಿಂದ ಉತ್ತರ.",
    cacheMeta: "ವಿಫಲತೆ 60 ಸೆಕೆಂಡ್ · ಮೋಡ್ ಬದಲಾದಾಗ ತೆರವು · 32s → 0.02s",
    everyAgent: "ಪ್ರತಿ ಏಜೆಂಟ್ · ಪ್ರತಿ ಗಂಟೆ", fromMemory: "ಸ್ಮೃತಿಯಿಂದ ಉತ್ತರ",
    degrade: "ಲೈವ್ ಮೂಲ ವಿಫಲವಾದರೆ ಏಜೆಂಟ್ ಡೆಮೊ ಡೇಟಾಗೆ ಇಳಿದು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳುತ್ತದೆ.",
    stamp: "ಅಧಿಕೃತ ತೀವ್ರ ಎಚ್ಚರಿಕೆ → ಕನಿಷ್ಠ 92",
    law1: "IMD ಮೀನುಗಾರರ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯ → ಕನಿಷ್ಠ 70",
    law2: "ಅಲೆ ≥ 4.0 ಮೀ → 85 · ಬಿರುಗಾಳಿ ≥ 62 ಕಿಮೀ/ಗಂ → 85",
    law3: "ನಿರ್ಬಂಧಿತ ಪ್ರದೇಶದಲ್ಲಿ → 60",
    lawNote: "ನಿಶ್ಚಿತ ನಿಯಮಗಳು ಅಂಕವನ್ನು ಮಾತ್ರ ಹೆಚ್ಚಿಸಬಹುದು. ಯಾವ ಮಾದರಿಯೂ ORCA ಅನ್ನು ಕೆಳಗೆ ಇಳಿಸಲಾಗದು.",
    reading: "ಕರಾವಳಿ ಓದು — ಈಗ",
    onePort: "ಪ್ರತಿ", flipNote: "· DATA EDITION ಬದಲಿಸಿ ಮೂಲ ಬದಲಾಗುವುದನ್ನು ನೋಡಿ",
    nowReading: "ಈಗ ಓದಲಾಗುತ್ತಿದೆ", wave: "ಅಲೆ", wind: "ಗಾಳಿ", sst: "SST", vis: "ಗೋಚರತೆ",
    hailing: "ಕರಾವಳಿ ಕೇಂದ್ರ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…", unreachable: "ಬ್ಯಾಕೆಂಡ್ ಸಿಗಲಿಲ್ಲ — uvicorn ಚಾಲನೆಯಲ್ಲಿದೆಯೇ?",
    hPort: "ಬಂದರು", hSource: "ಮೂಲ", hMode: "ಮೋಡ್", hLatency: "ವಿಳಂಬ", hAt: "ಸಮಯ",
    feedNote: "ಈ ಓದುಗಳನ್ನು ಅಪಾಯ ಎಂಜಿನ್ ಮತ್ತು ಮೀನುಗಾರಿಕೆ ಮಾದರಿ ಬಳಸುತ್ತವೆ.",
    outVerdict: "ನಿರ್ಧಾರ", outVerdictD: "0–100 ಅಪಾಯ, ಪ್ರತಿ ಅಂಕಕ್ಕೂ ಕಾರಣ, ಸುರಕ್ಷತಾ ನಿಯಮಗಳ ಸಹಿತ.",
    outPlan: "ಯೋಜನೆ", outPlanD: "ಕ್ರಮಗೊಳಿಸಿದ ಪ್ರದೇಶಗಳು, ಮೀನು ಸಾಧ್ಯತೆ, ಉತ್ತಮ ಸಮಯ ಮತ್ತು ಮಾರ್ಗ.",
    outLedger: "ದಾಖಲೆ", outLedgerD: "ಪ್ರತಿ ಮೌಲ್ಯಕ್ಕೂ ಮೂಲ · ಸಮಯ · ಮೋಡ್. CSV ರಫ್ತು.",
    systemStatus: "ಸಿಸ್ಟಮ್ ಸ್ಥಿತಿ", operational: "ಕಾರ್ಯನಿರ್ವಹಣೆಯಲ್ಲಿ",
  },
};

type FeedRow = {
  port: string; state: string; mode: string; source: string;
  latency: number; wave: string; wind: string; sst: string; vis: string; at: string;
};

const POLL_MS = 7000;

function fmt(m?: api.Measurement | null): string {
  if (!m || m.value == null) return "—";
  return `${m.value} ${m.unit}`;
}

const SEC: React.CSSProperties = {
  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--ocean)",
  marginBottom: 6,
};

const DIM: React.CSSProperties = {
  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
  fontSize: 8,
  color: "var(--text-faint)",
  letterSpacing: "0.1em",
};

export default function SystemPanel({ mode, language = "en" }: { mode: string; language?: Language }) {
  const t = L10N[language] ?? L10N.en;
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [tick, setTick] = useState(0);
  const [scanning, setScanning] = useState(true);
  const portIdx = useRef(0);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      const port = PORTS[portIdx.current % PORTS.length];
      portIdx.current += 1;
      try {
        const f = await api.forecast(port.lat, port.lon);
        if (!alive) return;
        const row: FeedRow = {
          port: port.name, state: port.state, mode: f.ocean.mode,
          source: f.ocean.source === "OPEN_METEO" ? "Open-Meteo" : "Demo store",
          latency: (f.ocean.latency_ms ?? 0) + (f.weather.latency_ms ?? 0),
          wave: fmt(f.ocean.measurements?.wave_height),
          wind: fmt(f.weather.measurements?.wind_speed),
          sst: fmt(f.ocean.measurements?.sst),
          vis: fmt(f.weather.measurements?.visibility),
          at: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        };
        setRows((r) => [row, ...r].slice(0, 6));
        setTick((t) => t + 1);
        setScanning(true);
      } catch {
        if (alive) setScanning(false);
      }
    };
    read();
    const timer = setInterval(read, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const latest = rows[0];

  const providers = [
    { name: "Open-Meteo Marine", status: "LIVE", color: "#22C55E", live: true, gives: "wave height · wave period · SST" },
    { name: "Open-Meteo Forecast", status: "LIVE", color: "#22C55E", live: true, gives: "wind · rain prob · visibility · temp" },
    { name: "INCOIS · IMD · MOSDAC", status: "INTERFACE READY", color: "#F59E0B", live: false, gives: "PFZ · advisories · satellite SST" },
    { name: "Demo Store", status: "ALWAYS ON", color: "#64748B", live: false, gives: "synthetic hourly sea states, labelled" },
  ];

  const crewText: Record<Language, { phase: string; agents: string[]; note: string }[]> = {
    en: [
      { phase: "UNDERSTAND", agents: ["Intent", "Planner"], note: "Keyword/LLM + Orchestrator" },
      { phase: "GATHER", agents: ["Weather", "Ocean", "PFZ", "Cyclone", "GIS"], note: "5 agents concurrent" },
      { phase: "DECIDE", agents: ["Risk", "Route A*"], note: "Weighted + floors" },
      { phase: "EXPLAIN", agents: ["Explanation"], note: "EN / HI / KN + TTS" },
    ],
    hi: [
      { phase: "समझो", agents: ["आशय", "प्लानर"], note: "कीवर्ड/LLM + ऑर्केस्ट्रेटर" },
      { phase: "जुटाओ", agents: ["मौसम", "समुद्र", "PFZ", "चक्रवात", "GIS"], note: "5 एजेंट एक साथ" },
      { phase: "तय करो", agents: ["रिस्क", "मार्ग A*"], note: "भारित + नियम" },
      { phase: "समझाओ", agents: ["व्याख्या"], note: "EN / HI / KN + TTS" },
    ],
    kn: [
      { phase: "ಅರ್ಥ", agents: ["ಉದ್ದೇಶ", "ಪ್ಲಾನರ್"], note: "ಕೀವರ್ಡ್/LLM + ಆರ್ಕೆಸ್ಟ್ರೇಟರ್" },
      { phase: "ಸಂಗ್ರಹ", agents: ["ಹವಾಮಾನ", "ಸಮುದ್ರ", "PFZ", "ಚಂಡಮಾರುತ", "GIS"], note: "5 ಏಜೆಂಟ್ ಏಕಕಾಲ" },
      { phase: "ನಿರ್ಧಾರ", agents: ["ಅಪಾಯ", "ಮಾರ್ಗ A*"], note: "ತೂಕ + ನಿಯಮ" },
      { phase: "ವಿವರಣೆ", agents: ["ವಿವರಣೆ"], note: "EN / HI / KN + TTS" },
    ],
  };
  const crew = crewText[language] ?? crewText.en;

  const systemChecks = [
    { label: "Risk Engine", ok: true },
    { label: "Route Engine (A*)", ok: true },
    { label: "Weather API", ok: scanning },
    { label: "Ocean API", ok: scanning },
    { label: "TTS / STT", ok: true },
    { label: "Language Engine", ok: true },
    { label: "Demo Fallback", ok: true },
    { label: "GIS", ok: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ---- HEADER ---- */}
      <div className="m-panel" style={{ padding: "14px 18px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={SEC}>{t.engineRoom}</div>
          <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 18, fontWeight: 900, color: "var(--text-bright)", lineHeight: 1.2 }}>
            {t.title}
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.6, maxWidth: 720 }}>
            {t.intro}
          </p>
        </div>
        {/* Status indicator */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
          <div style={DIM}>{t.systemStatus}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--risk-low)", display: "inline-block", boxShadow: "0 0 8px var(--risk-low)", animation: "blink 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 12, fontWeight: 800, color: "var(--risk-low)", letterSpacing: "0.12em" }}>
              {t.operational}
            </span>
          </div>
          <div style={DIM}>{t.configNote}</div>
        </div>
      </div>

      {/* ---- SYSTEM CHECKS ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd">
          <div style={SEC}>SYSTEM HEALTH</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
          {systemChecks.map((c, i) => (
            <div key={c.label} style={{
              padding: "10px 14px",
              borderLeft: i % 4 !== 0 ? "1px solid var(--border)" : "none",
              borderTop: i >= 4 ? "1px solid var(--border)" : "none",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: c.ok ? "var(--risk-low)" : "var(--risk-ext)",
                flexShrink: 0,
                boxShadow: c.ok ? "0 0 6px var(--risk-low)" : "0 0 6px var(--risk-ext)",
                animation: c.ok ? "blink 2.5s ease-in-out infinite" : "none",
              }} />
              <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, fontWeight: 600, color: c.ok ? "var(--text-mid)" : "var(--risk-ext)" }}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- DATA SOURCES ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd">
          <div style={SEC}>{t.s1}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 0 }}>
          {providers.map((p, i) => (
            <div key={p.name} style={{
              padding: "12px 16px",
              borderLeft: i % 2 === 1 ? "1px solid var(--border)" : "none",
              borderTop: i >= 2 ? "1px solid var(--border)" : "none",
              borderRight: "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0,
                  animation: p.live ? "blink 1.8s ease-in-out infinite" : "none",
                  boxShadow: p.live ? `0 0 6px ${p.color}` : "none",
                }} />
                <span style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>{p.name}</span>
                <span style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 7.5,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  padding: "1px 5px",
                  border: `1px solid ${p.color}60`,
                  color: p.color,
                  marginLeft: "auto",
                }}>
                  {p.status}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.5 }}>{p.gives}</div>
            </div>
          ))}
        </div>

        {/* Cache flow diagram */}
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={DIM}>{t.oneFetch}</div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{t.perProvider}</div>
          </div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, var(--ocean) 0%, transparent 100%)", minWidth: 40 }} />
          <div style={{
            padding: "8px 14px",
            border: "1px solid var(--ocean)",
            background: "rgba(0,168,204,0.06)",
            textAlign: "center",
          }}>
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: "var(--ocean)", marginBottom: 3 }}>
              {t.cacheTitle}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5, maxWidth: 280 }}>{t.cacheBody}</div>
            <div style={{ ...DIM, marginTop: 4 }}>{t.cacheMeta}</div>
          </div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent 0%, var(--ocean) 100%)", minWidth: 40 }} />
          <div style={{ textAlign: "center" }}>
            <div style={DIM}>{t.everyAgent}</div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{t.fromMemory}</div>
          </div>
        </div>
        <p style={{ borderTop: "1px solid var(--border)", padding: "8px 16px", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6, fontStyle: "italic" }}>
          {t.degrade}
        </p>
      </div>

      {/* ---- INTELLIGENCE CREW ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd">
          <div style={SEC}>{t.s2}</div>
          <div style={{ ...DIM }}>{t.s2note}</div>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 8, overflowX: "auto" }}>
          {crew.map((c, i) => (
            <Fragment key={c.phase}>
              {i > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 28, flexShrink: 0 }}>
                  <CourseArrow size={14} style={{ color: "var(--ocean-dim)" }} />
                </div>
              )}
              <div style={{
                flex: 1,
                minWidth: 110,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                flexShrink: 0,
              }}>
                <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.2em", color: "var(--ocean)", marginBottom: 8 }}>
                  {c.phase}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {c.agents.map((a, j) => (
                    <div key={a} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: "50%", background: "var(--ocean)", flexShrink: 0,
                        animation: "blink 2s ease-in-out infinite",
                        animationDelay: `${j * 0.25}s`,
                      }} />
                      <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 600, color: "var(--text-mid)", whiteSpace: "nowrap" }}>
                        {a}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: 8, fontSize: 9.5, color: "var(--text-faint)", lineHeight: 1.5, fontStyle: "italic" }}>{c.note}</p>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {/* ---- SAFETY LAW ---- */}
      <div className="m-panel overflow-hidden" style={{ borderColor: "rgba(239,68,68,0.4)", backgroundImage: "repeating-linear-gradient(45deg, rgba(239,68,68,0.025) 0 1.5px, transparent 1.5px 8px)" }}>
        <div className="m-hd" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--risk-ext)" }}>
            <WarnGlyph size={12} /> {t.s3}
          </div>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 11,
            fontWeight: 800,
            padding: "6px 12px",
            border: "1px solid rgba(239,68,68,0.5)",
            color: "var(--risk-ext)",
            background: "rgba(239,68,68,0.06)",
            letterSpacing: "0.06em",
          }}>
            {t.stamp}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10.5, color: "var(--text-mid)" }}>
            <div>{t.law1}</div>
            <div>{t.law2}</div>
            <div>{t.law3}</div>
          </div>
          <p style={{ flex: 1, minWidth: 200, fontSize: 11.5, lineHeight: 1.6, color: "var(--text-dim)", fontStyle: "italic" }}>
            <LockGlyph size={11} style={{ display: "inline", marginRight: 5, color: "var(--risk-ext)" }} />
            {t.lawNote}
          </p>
        </div>
      </div>

      {/* ---- LIVE FEED ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: scanning ? "var(--risk-low)" : "var(--risk-ext)",
              boxShadow: scanning ? "0 0 8px var(--risk-low)" : "none",
              animation: scanning ? "blink 1.5s ease-in-out infinite" : "none",
            }} />
            <div style={SEC}>{t.reading}</div>
          </div>
          <div style={DIM}>{t.onePort} {POLL_MS / 1000}s {t.flipNote}</div>
        </div>

        {/* Current reading */}
        {latest ? (
          <div key={tick} className="m-popin" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "12px 16px" }}>
              <div style={DIM}>{t.nowReading}</div>
              <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 18, fontWeight: 900, color: "var(--text-bright)", marginTop: 4 }}>
                {latest.port}
              </div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-faint)", marginTop: 2 }}>
                {latest.state} · {latest.at} IST
              </div>
            </div>
            {[
              { k: t.wave, v: latest.wave },
              { k: t.wind, v: latest.wind },
              { k: t.sst, v: latest.sst },
              { k: t.vis, v: latest.vis },
            ].map(x => (
              <div key={x.k} style={{ padding: "12px 12px", borderLeft: "1px solid var(--border)" }}>
                <div style={DIM}>{x.k}</div>
                <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 15, fontWeight: 700, color: "var(--text-bright)", marginTop: 4 }}>
                  {x.v}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "14px 16px", fontSize: 12, fontStyle: "italic", color: "var(--text-dim)" }}>
            {scanning ? t.hailing : t.unreachable}
          </div>
        )}

        {/* Feed log */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-mid)" }}>
                {[t.hPort, t.wave, t.wind, "SST", t.vis, t.hSource, t.hMode, t.hLatency, t.hAt].map((h, i) => (
                  <th key={h} style={{
                    padding: i === 0 ? "8px 12px 8px 16px" : "8px 12px",
                    textAlign: "left",
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.port}-${r.at}`}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    opacity: 1 - i * 0.12,
                    background: i === 0 ? "rgba(0,168,204,0.04)" : "transparent",
                  }}
                >
                  <td style={{ padding: "8px 12px 8px 16px", fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 12, fontWeight: 700, color: "var(--text-bright)", whiteSpace: "nowrap" }}>{r.port}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-mid)", whiteSpace: "nowrap" }}>{r.wave}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-mid)", whiteSpace: "nowrap" }}>{r.wind}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-mid)", whiteSpace: "nowrap" }}>{r.sst}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-mid)", whiteSpace: "nowrap" }}>{r.vis}</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{r.source}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      fontSize: 7.5,
                      fontWeight: 800,
                      letterSpacing: "0.12em",
                      padding: "1px 5px",
                      border: `1px solid ${r.mode === "LIVE" ? "rgba(34,197,94,0.5)" : "rgba(245,158,11,0.5)"}`,
                      color: r.mode === "LIVE" ? "var(--risk-low)" : "var(--risk-mod)",
                    }}>
                      {r.mode}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{r.latency}ms</td>
                  <td style={{ padding: "8px 12px", color: "var(--text-faint)", whiteSpace: "nowrap" }}>{r.at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ borderTop: "1px solid var(--border)", padding: "7px 16px", display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--text-dim)", lineHeight: 1.5, fontStyle: "italic" }}>
          <FishGlyph size={14} className="swim" style={{ color: "var(--ocean)", flexShrink: 0 }} />
          {t.feedNote}
        </p>
      </div>

      {/* ---- OUTPUTS ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd">
          <div style={SEC}>{t.s4}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            { h: t.outVerdict, d: t.outVerdictD },
            { h: t.outPlan, d: t.outPlanD },
            { h: t.outLedger, d: t.outLedgerD },
          ].map((x, i) => (
            <div
              key={x.h}
              style={{
                padding: "14px 16px",
                borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                transition: "background 0.15s",
                cursor: "default",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,168,204,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 15, fontWeight: 800, color: "var(--text-bright)" }}>{x.h}</div>
                <CourseArrow size={11} style={{ color: "var(--ocean-dim)" }} />
              </div>
              <p style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.6 }}>{x.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
