import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import AgentTracePanel from "./components/AgentTrace";
import AuthorityPanel from "./components/AuthorityPanel";
import ChatPanel from "./components/ChatPanel";
import ConditionsStrip from "./components/ConditionsStrip";
import FishingPanel from "./components/FishingPanel";
import HistoricalPanel from "./components/HistoricalPanel";
import {
  ChartDefs,
  OrcaLogo,
  SpeakerGlyph,
  SpeakerOffGlyph,
  WarnGlyph,
} from "./components/glyphs";
import Landing from "./components/Landing";
import LocationPicker, { PORTS, type PickedLocation } from "./components/LocationPicker";
import MarineMap from "./components/MarineMap";
import PFZList from "./components/PFZList";
import RiskCard from "./components/RiskCard";
import { RISK_COLOR } from "./components/RiskDial";
import SystemPanel from "./components/SystemPanel";
import RiskTimeline from "./components/RiskTimeline";
import SosModal from "./components/SosModal";
import type {
  ChatMessage,
  ChatResponse,
  EmergencyRoute,
  FishingOutlook,
  Language,
  IntentMode,
  Location,
  ZoneFeature,
} from "./types";

const SESSION = "demo";
const RADIUS_KM = 100;
const DEFAULT_PORT = PORTS[0];

const EMPTY_PFZ: any[] = [];
const EMPTY_AREAS: any[] = [];
const EMPTY_ROUTES: any[] = [];
const EMPTY_GEOFENCE: any[] = [];
const EMPTY_ALERTS: any[] = [];

type AppTab = "home" | "ask" | "historical" | "authority" | "system";
type Tab = AppTab | "landing";

const SCENARIOS: {
  id: string;
  n: string;
  label: Record<Language, string>;
  ask: string;
  hint: string;
}[] = [
  { id: "safe", n: "1", label: { en: "Safe", hi: "सुरक्षित", kn: "ಸುರಕ್ಷಿತ" }, ask: "Is it safe to go fishing tomorrow morning near Goa?", hint: "Goa · LOW" },
  { id: "danger", n: "2", label: { en: "Rough", hi: "ख़राब मौसम", kn: "ಕಠಿಣ ಹವಾಮಾನ" }, ask: "ನಾಳೆ ಬೆಳಿಗ್ಗೆ 6 ಗಂಟೆಗೆ ಮುಂಬೈ ಹತ್ತಿರ ಮೀನುಗಾರಿಕೆಗೆ ಹೋಗಬಹುದೇ?", hint: "Mumbai · ಕನ್ನಡ" },
  { id: "cyclone", n: "3", label: { en: "Cyclone", hi: "चक्रवात", kn: "ಚಂಡಮಾರುತ" }, ask: "Is there a cyclone near Paradip? Can I go fishing?", hint: "Paradip · EXTREME" },
  { id: "pfz", n: "4", label: { en: "Fishing zones", hi: "मत्स्य क्षेत्र", kn: "ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು" }, ask: "कोच्चि के पास मछली पकड़ने का क्षेत्र कहाँ है?", hint: "Kochi · हिंदी" },
  { id: "route", n: "5", label: { en: "Safe route", hi: "सुरक्षित मार्ग", kn: "ಸುರಕ್ಷಿತ ಮಾರ್ಗ" }, ask: "Give me the safest route to the nearest fishing zone near Mumbai", hint: "Mumbai · geofence" },
];

const TAB_LABEL: Record<Language, Record<AppTab, string>> = {
  en: { home: "Today", ask: "Ask ORCA", historical: "Historical", authority: "Authority", system: "System" },
  hi: { home: "आज", ask: "ORCA से पूछें", historical: "ऐतिहासिक", authority: "प्रशासन", system: "प्रणाली" },
  kn: { home: "ಇಂದು", ask: "ORCA ಅನ್ನು ಕೇಳಿ", historical: "ಐತಿಹಾಸಿಕ", authority: "ಪ್ರಾಧಿಕಾರ", system: "ವ್ಯವಸ್ಥೆ" },
};

const TAB_ICON: Record<AppTab, string> = {
  home: "⊕",
  ask: "◎",
  historical: "◑",
  authority: "◈",
  system: "◧",
};

const UI: Record<Language, Record<string, string>> = {
  en: {
    voice: "Voice",
    lang: "Language",
    tour: "Guided tour",
    stopTour: "Stop tour",
    scenarios: "Rehearsed scenarios",
    courses: "Plotted courses",
    recommended: "Recommended",
    warnings: "Official marine warnings",
    validTill: "valid till",
    marginalia: "Soundings in metres · WGS 84",
    chartNo: "Chart №",
    dataEdition: "Data edition",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
  },
  hi: {
    voice: "आवाज़",
    lang: "भाषा",
    tour: "गाइडेड टूर",
    stopTour: "टूर रोकें",
    scenarios: "तैयार परिदृश्य",
    courses: "आँके गए मार्ग",
    recommended: "सुझाया गया",
    warnings: "आधिकारिक समुद्री चेतावनियाँ",
    validTill: "मान्य",
    marginalia: "गहराई मीटर में · WGS 84",
    chartNo: "चार्ट क्र.",
    dataEdition: "डेटा संस्करण",
    theme: "थीम",
    light: "लाइट",
    dark: "डार्क",
  },
  kn: {
    voice: "ಧ್ವನಿ",
    lang: "ಭಾಷೆ",
    tour: "ಮಾರ್ಗದರ್ಶಿತ ಪ್ರವಾಸ",
    stopTour: "ಪ್ರವಾಸ ನಿಲ್ಲಿಸಿ",
    scenarios: "ಸಿದ್ಧಪಡಿಸಿದ ಸನ್ನಿವೇಶಗಳು",
    courses: "ಗುರುತಿಸಿದ ಮಾರ್ಗಗಳು",
    recommended: "ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ",
    warnings: "ಅಧಿಕೃತ ಸಮುದ್ರ ಎಚ್ಚರಿಕೆಗಳು",
    validTill: "ವರೆಗೆ",
    marginalia: "ಆಳ ಮೀಟರ್‌ಗಳಲ್ಲಿ · WGS 84",
    chartNo: "ಚಾರ್ಟ್ ಸಂಖ್ಯೆ",
    dataEdition: "ಡೇಟಾ ಆವೃತ್ತಿ",
    theme: "ಥೀಮ್",
    light: "ಲೈಟ್",
    dark: "ಡಾರ್ಕ್",
  },
};

export default function App() {
  const [tab, setTab] = useState<Tab>("landing");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latest, setLatest] = useState<ChatResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [langChoice, setLangChoice] = useState<Language | null>(null);
  const [detected, setDetected] = useState<Language>("en");
  const language = langChoice ?? detected;
  const [zones, setZones] = useState<ZoneFeature[]>([]);
  const [mode, setMode] = useState<string>("DEMO");
  const [intentMode, setIntentMode] = useState<IntentMode>("AI");
  const [switching, setSwitching] = useState(false);
  const [speak, setSpeak] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const [place, setPlace] = useState<PickedLocation | null>(null);
  const [outlook, setOutlook] = useState<FishingOutlook | null>(null);
  const [emergencyRoute, setEmergencyRoute] = useState<EmergencyRoute | null>(null);
  const [showEmergencyRoute, setShowEmergencyRoute] = useState(false);
  const [loadingOutlook, setLoadingOutlook] = useState(false);
  const [focusRank, setFocusRank] = useState<number | null>(null);
  const [sosOpen, setSosOpen] = useState(false);

  const checkAndFetchEmergencyRoute = useCallback(async (lat: number, lon: number, forceDisplay: boolean = false) => {
    try {
      const route = await api.emergencyRoute(lat, lon);
      setEmergencyRoute(route);
      if (forceDisplay) setShowEmergencyRoute(true);
      return route;
    } catch {
      const errRoute = { available: false, destination: null, distance_km: null, eta_minutes: null, risk_score: null, risk_category: null, waypoints: [], notes: "Emergency route service unavailable." } as unknown as EmergencyRoute;
      setEmergencyRoute(errRoute);
      return errRoute;
    }
  }, []);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Boot
  useEffect(() => {
    api.zones().then((z) => setZones(z.features)).catch(() => setZones([]));
    api.health().then((h) => setMode(h.data_mode)).catch(() => setMode("DEMO"));

    const fallback = () =>
      setPlace({ latitude: DEFAULT_PORT.lat, longitude: DEFAULT_PORT.lon, label: DEFAULT_PORT.name, source: "default" });

    const params = new URLSearchParams(window.location.search);
    const at = (params.get("at") ?? "").split(",").map(Number);
    if (at.length === 2 && at.every(Number.isFinite)) {
      setPlace({ latitude: at[0], longitude: at[1], label: "Selected point", source: "map" });
      setTab("home");
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPlace({ latitude: +pos.coords.latitude.toFixed(4), longitude: +pos.coords.longitude.toFixed(4), label: "Your location", source: "gps" }),
        fallback,
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 300_000 },
      );
    } else {
      fallback();
    }

    const tabParam = params.get("tab");
    if (tabParam === "home" || tabParam === "ask" || tabParam === "historical" || tabParam === "authority" || tabParam === "system")
      setTab(tabParam);
    const langParam = params.get("lang");
    if (langParam === "en" || langParam === "hi" || langParam === "kn") setLangChoice(langParam);
    const wanted = params.get("demo");
    if (wanted) {
      const s = SCENARIOS.find((x) => x.id === wanted || x.n === wanted);
      if (s) setTimeout(() => runScenario(s.ask), 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outlook on position
  useEffect(() => {
    if (!place) return;
    setOutlook(null);
    setEmergencyRoute(null);
    let alive = true;
    setLoadingOutlook(true);
    setFocusRank(null);
    api
      .fishingOutlook(place.latitude, place.longitude, { radiusKm: RADIUS_KM, days: 3, lang: language })
      .then((d) => alive && setOutlook(d))
      .catch(() => alive && setOutlook(null))
      .finally(() => alive && setLoadingOutlook(false));
    return () => { alive = false; };
  }, [place?.latitude, place?.longitude, language]);

  // Emergency route visibility based on hazard presence
  useEffect(() => {
    if (!outlook || !place) {
      setShowEmergencyRoute(false);
      setEmergencyRoute(null);
      return;
    }
    const inHazard = outlook.safety.category === "EXTREME" || outlook.avoid.some(item => item.active_now);
    if (inHazard) {
      checkAndFetchEmergencyRoute(place.latitude, place.longitude, true);
    } else {
      setShowEmergencyRoute(false);
    }
  }, [outlook, place?.latitude, place?.longitude, checkAndFetchEmergencyRoute]);

  // Chat
  const send = async (text: string) => {
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { id: `${Date.now()}-u`, role: "user", text }]);
    try {
      const res = await api.ask({
        message: text,
        language: langChoice ?? undefined,
        latitude: place?.latitude,
        longitude: place?.longitude,
        locationName: place?.label,
        sessionId: SESSION,
        mode: intentMode
      });
      setLatest(res);
      setDetected(res.language);
      setMode(res.mode);
      if (res.intent.location) {
        setPlace({
          latitude: res.intent.location.latitude,
          longitude: res.intent.location.longitude,
          label: res.intent.location.name,
          source: "search"
        });
      }
      setMessages((m) => [...m, { id: `${Date.now()}-o`, role: "orca", text: res.answer, response: res }]);
      if (speak) {
        try {
          const u = new SpeechSynthesisUtterance(res.answer.split(". ").slice(0, 2).join(". "));
          u.lang = res.language === "kn" ? "kn-IN" : res.language === "hi" ? "hi-IN" : "en-IN";
          u.rate = 0.98;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        } catch { /* TTS unavailable */ }
      }
    } catch (e) {
      setError(String(e));
      setMessages((m) => [...m, { id: `${Date.now()}-e`, role: "orca", text: "I could not reach the ORCA backend. Is it running on port 8000?" }]);
    } finally {
      setBusy(false);
    }
  };

  const runScenario = async (ask: string) => {
    setTab("ask");
    await api.resetSession(SESSION).catch(() => {});
    setMessages([]);
    setLatest(null);
    setLangChoice(null);
    await send(ask);
  };


  const toggleMode = async () => {
    const next = mode === "LIVE" ? "DEMO" : "LIVE";
    setSwitching(true);
    try {
      const r = await api.setMode(next);
      setMode(r.data_mode);
      if (place) setPlace({ ...place });
    } catch { /* keep current mode */ } finally {
      setSwitching(false);
    }
  };

  const pickLocation = useCallback((lat: number, lon: number) => {
    setPlace({ latitude: lat, longitude: lon, label: "Selected point", source: "map" });
  }, []);

  const suggestions = useMemo(() => latest?.suggestions ?? [], [latest]);
  const tabLabels = TAB_LABEL[language] ?? TAB_LABEL.en;
  const ui = UI[language] ?? UI.en;

  const homeOrigin: Location | null = place
    ? { name: outlook?.location.name ?? place.label, latitude: place.latitude, longitude: place.longitude, state: outlook?.location.state ?? null }
    : null;

  if (tab === "landing") {
    return (
      <>
        <ChartDefs />
        <Landing
          mode={mode}
          language={language}
          onLanguage={setLangChoice}
          theme={theme}
          onTheme={() => setTheme((t) => t === "light" ? "dark" : "light")}
          onEnter={setTab}
          onScenario={runScenario}
        />
      </>
    );
  }

  const riskScore = outlook?.safety.score;
  const riskCat = outlook?.safety.category;

  return (
    <div className="flex min-h-full flex-col" style={{ background: "var(--bg)" }}>
      <ChartDefs />
      <div className="fish-drift" aria-hidden />

      {/* ====== HEADER ====== */}
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border-mid)" }}>
        {/* Top bar */}
        <div className="flex items-center gap-0 overflow-x-auto no-scrollbar" style={{ minHeight: 58 }}>
          {/* Identity */}
          <button
            onClick={() => setTab("landing")}
            title="Back to the front page"
            className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 shrink-0"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <OrcaLogo size={42} className="shrink-0" style={{ color: "var(--ocean)" } as React.CSSProperties} />
            <div>
              <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 22, fontWeight: 900, lineHeight: 1, color: "var(--ocean-bright)", letterSpacing: "-0.01em" }}>
                ORCA
              </div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--text-dim)", marginTop: 2 }}>
                Marine Intelligence
              </div>
            </div>
          </button>

          {/* Coordinate strip */}
          {place && (
            <div className="hidden items-center gap-2 px-4 sm:flex" style={{ borderRight: "1px solid var(--border)" }}>
              <div style={{ color: "var(--ocean)", fontSize: 12 }}>◎</div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 11, color: "var(--text-mid)", lineHeight: 1 }}>
                <div style={{ color: "var(--text-faint)", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 2 }}>Position</div>
                {place.latitude.toFixed(4)}°N · {place.longitude.toFixed(4)}°E
              </div>
            </div>
          )}

          {/* Risk badge */}
          {riskScore != null && riskCat && (
            <div className="hidden items-center gap-2 px-4 sm:flex" style={{ borderRight: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", lineHeight: 1 }}>
                <div style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 2 }}>Risk</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: RISK_COLOR[riskCat] }}>
                  {riskScore} <span style={{ fontSize: 10, fontWeight: 600 }}>{riskCat}</span>
                </div>
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Mode toggle */}
          <button
            onClick={toggleMode}
            disabled={switching}
            title="Switch data mode"
            className="flex flex-col items-center justify-center gap-1 px-4 py-3 transition-colors"
            style={{ borderLeft: "1px solid var(--border)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: mode === "LIVE" ? "var(--risk-low)" : "var(--risk-mod)",
                  boxShadow: mode === "LIVE" ? "0 0 6px var(--risk-low)" : "none",
                  display: "inline-block",
                  animation: mode === "LIVE" ? "blink 2s ease-in-out infinite" : "none",
                }}
              />
              <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: mode === "LIVE" ? "var(--risk-low)" : "var(--risk-mod)" }}>
                {switching ? "…" : mode}
              </span>
              <span style={{ color: "var(--text-faint)", fontSize: 10 }}>⇄</span>
            </div>
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-faint)" }}>
              Data
            </span>
          </button>

          {/* Voice */}
          <button
            onClick={() => setSpeak((v) => !v)}
            title="Speak answers aloud"
            className="flex flex-col items-center justify-center gap-1 px-4 py-3 transition-colors"
            style={{ borderLeft: "1px solid var(--border)" }}
          >
            <span style={{ color: speak ? "var(--ocean)" : "var(--text-faint)", fontSize: 16 }}>
              {speak ? <SpeakerGlyph size={16} /> : <SpeakerOffGlyph size={16} />}
            </span>
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-faint)" }}>
              {ui.voice}
            </span>
          </button>

          {/* Language */}
          <div className="flex flex-col items-center justify-center gap-1 px-3 py-3" style={{ borderLeft: "1px solid var(--border)" }}>
            <div className="flex gap-1">
              {(["en", "hi", "kn"] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLangChoice(l)}
                  style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    padding: "2px 6px",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: language === l ? "var(--ocean)" : "var(--border)",
                    background: language === l ? "rgba(0,168,204,0.15)" : "transparent",
                    color: language === l ? "var(--ocean)" : "var(--text-dim)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {l === "en" ? "EN" : l === "hi" ? "HI" : "KN"}
                </button>
              ))}
            </div>
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-faint)" }}>
              {ui.lang}
            </span>
          </div>

          {/* Theme */}
          <button
            onClick={() => setTheme((t) => t === "light" ? "dark" : "light")}
            title="Toggle theme"
            className="flex flex-col items-center justify-center gap-1 px-4 py-3 transition-colors"
            style={{ borderLeft: "1px solid var(--border)" }}
          >
            <span style={{ color: theme === "light" ? "var(--ocean)" : "var(--text-faint)", fontSize: 16 }}>
              {theme === "light" ? "☀" : "☾"}
            </span>
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-faint)" }}>
              {ui.theme}
            </span>
          </button>


          {/* SOS — always visible */}
          <button
            onClick={() => setSosOpen(true)}
            disabled={!place}
            className="flex items-center shrink-0 gap-2 px-4 sm:px-5 py-3 font-mono text-[11px] font-bold tracking-widest uppercase transition-all disabled:opacity-30"
            style={{
              borderLeft: "1px solid rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.1)",
              color: "#EF4444",
              letterSpacing: "0.18em",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "blink 1.4s ease-in-out infinite" }} />
            SOS
          </button>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-end gap-3 sm:gap-5 px-3 sm:px-5 overflow-x-auto no-scrollbar" style={{ borderTop: "1px solid var(--border)" }}>
          {(["home", "ask", "historical", "authority", "system"] as AppTab[]).map((x) => (
            <button key={x} onClick={() => setTab(x)} className={`tab mt-1 flex items-center gap-2 ${tab === x ? "tab-on" : ""}`}>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{TAB_ICON[x]}</span>
              {tabLabels[x]}
            </button>
          ))}
          <span className="ml-auto pb-2.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-text-faint" style={{ color: "var(--text-faint)" }}>
            {ui.marginalia}
          </span>
        </nav>
      </header>


      {error && (
        <div className="flex items-center gap-3 px-5 py-3 text-[12.5px]" style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
          <WarnGlyph size={14} className="shrink-0" />
          <span>
            {error} — start the backend with{" "}
            <code className="font-mono font-bold">uvicorn app.main:app --port 8000</code>
          </span>
        </div>
      )}

      {/* ====== MAIN CONTENT ====== */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">

        {/* ===== HOME TAB ===== */}
        {tab === "home" && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:flex-row lg:overflow-hidden">

            {/* Left sidebar: marine status */}
            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72 lg:overflow-y-auto no-scrollbar">
              {/* Location picker */}
              <LocationPicker current={place} language={language} onPick={setPlace} />

              {/* Marine conditions — Instrument Cluster */}
              {outlook && (
                <div className="m-panel overflow-hidden">
                  <div className="m-hd">
                    <span className="m-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--ocean)", fontSize: 9 }}>⊕</span>
                      {language === "kn" ? "ಸಮುದ್ರ ಸ್ಥಿತಿ" : language === "hi" ? "समुद्र स्थिति" : "Position Status"}
                    </span>
                    <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      {outlook.mode}
                    </span>
                  </div>

                  {/* Instrument cluster */}
                  <div style={{ padding: "12px 12px 0" }}>
                    <div className="instrument-cluster">
                      <div className="instrument-cell">
                        <div className="instrument-cell-label">
                          <span className="instrument-cell-icon">≋</span>
                          {language === "kn" ? "ಅಲೆ ಎತ್ತರ" : language === "hi" ? "लहरें" : "Wave Ht"}
                        </div>
                        <div className="instrument-cell-val">{outlook.safety.wave_height_m?.toFixed(1) ?? "—"}</div>
                        <div className="instrument-cell-unit">metres</div>
                      </div>
                      <div className="instrument-cell">
                        <div className="instrument-cell-label">
                          <span className="instrument-cell-icon">↑</span>
                          {language === "kn" ? "ಗಾಳಿ" : language === "hi" ? "हवा" : "Wind"}
                        </div>
                        <div className="instrument-cell-val">{Math.round(outlook.safety.wind_speed_kmh ?? 0)}</div>
                        <div className="instrument-cell-unit">km/h</div>
                      </div>
                      <div className="instrument-cell">
                        <div className="instrument-cell-label">
                          <span className="instrument-cell-icon">◈</span>
                          {language === "kn" ? "ಸಮುದ್ರ" : language === "hi" ? "समुद्र" : "Sea State"}
                        </div>
                        <div className="instrument-cell-val" style={{ fontSize: 14 }}>{outlook.safety.sea_state ?? "—"}</div>
                        <div className="instrument-cell-unit">&nbsp;</div>
                      </div>
                      <div className="instrument-cell">
                        <div className="instrument-cell-label">
                          <span className="instrument-cell-icon">◉</span>
                          {language === "kn" ? "ಪ್ರದೇಶಗಳು" : language === "hi" ? "क्षेत्र" : "PFZ Areas"}
                        </div>
                        <div className="instrument-cell-val">{outlook.areas.length}</div>
                        <div className="instrument-cell-unit">in {outlook.radius_km} km</div>
                      </div>
                    </div>
                  </div>

                  {/* Safety score — barograph */}
                  <div style={{ padding: "12px 12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                      <span className="m-label">{language === "kn" ? "ಸುರಕ್ಷತಾ ಸ್ಕೋರ್" : language === "hi" ? "सुरक्षा स्कोर" : "Safety Score"}</span>
                      <span style={{
                        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 22,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: RISK_COLOR[outlook.safety.category],
                      }}>
                        {outlook.safety.score}
                        <span style={{ fontSize: 10, fontWeight: 600, color: RISK_COLOR[outlook.safety.category], marginLeft: 3 }}>
                          {outlook.safety.category}
                        </span>
                      </span>
                    </div>
                    {/* Barograph */}
                    <div className="barograph">
                      {/* Zone bands */}
                      <div className="barograph-zones">
                        <div style={{ width: "40%", background: "rgba(34,197,94,0.22)" }} />
                        <div style={{ width: "20%", background: "rgba(245,158,11,0.22)" }} />
                        <div style={{ width: "20%", background: "rgba(249,115,22,0.22)" }} />
                        <div style={{ width: "20%", background: "rgba(239,68,68,0.22)" }} />
                      </div>
                      {/* Animated fill */}
                      <div
                        className="barograph-fill grow-x"
                        style={{ width: `${outlook.safety.score}%`, background: RISK_COLOR[outlook.safety.category], opacity: 0.7 }}
                      />
                      {/* Needle */}
                      <div className="barograph-needle" style={{ left: `calc(${outlook.safety.score}% - 1px)` }} />
                    </div>
                    <div className="barograph-scale">
                      <span>0</span><span>LOW</span><span>MOD</span><span>HIGH</span><span>100</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency route panel */}
              {(showEmergencyRoute && emergencyRoute) && (
                <div className="m-panel overflow-hidden" style={{ borderColor: emergencyRoute.available ? "rgba(239,68,68,0.25)" : "var(--border)" }}>
                  <div className="m-hd" style={{ background: emergencyRoute.available ? "rgba(239,68,68,0.06)" : undefined }}>
                    <span className="m-label" style={{ color: emergencyRoute.available ? "#EF4444" : undefined }}>
                      {language === "kn" ? "ತುರ್ತು ಮಾರ್ಗ" : language === "hi" ? "आपातकालीन मार्ग" : "Emergency Return"}
                    </span>
                  </div>
                  {emergencyRoute.available ? (
                    <div className="px-4 py-3 space-y-2">
                      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
                        {language === "kn" ? "ಭೂಮಿಗೆ ಸುರಕ್ಷಿತ ಮರಳು" : language === "hi" ? "सुरक्षित भूमि वापसी" : "Safe Return to Land"}
                      </div>
                      <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 28, fontWeight: 800, color: "var(--text-bright)", lineHeight: 1 }}>
                        {emergencyRoute.distance_km} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-dim)" }}>km</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>ETA</div>
                          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 14, fontWeight: 700, color: "var(--text-mid)" }}>
                            {Math.floor((emergencyRoute.eta_minutes ?? 0) / 60)}h {(emergencyRoute.eta_minutes ?? 0) % 60}m
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>Risk</div>
                          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 14, fontWeight: 700, color: emergencyRoute.risk_category ? RISK_COLOR[emergencyRoute.risk_category] : "var(--text-mid)" }}>
                            {emergencyRoute.risk_category ?? "—"}
                          </div>
                        </div>
                      </div>
                      {emergencyRoute.destination && (
                        <div style={{ fontSize: 11, color: "var(--text-dim)", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
                          → {emergencyRoute.destination.name}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-[12px]" style={{ color: "var(--text-dim)" }}>
                      {language === "kn" ? "ಸುರಕ್ಷಿತ ಮರಳು ಮಾರ್ಗ ಲಭ್ಯವಿಲ್ಲ" : language === "hi" ? "सुरक्षित वापसी मार्ग उपलब्ध नहीं" : "Return route unavailable from this position."}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Center: Map */}
            <div className="flex flex-col min-h-[450px] flex-1 lg:min-h-0">
              {/* Mobile location picker */}
              {loadingOutlook && !outlook && (
                <div
                  className="mb-3 flex items-center gap-3 rounded px-4 py-3"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  {/* Sonar sweep animation */}
                  <div style={{ position: "relative", width: 18, height: 18, flexShrink: 0 }}>
                    <span style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      border: "1.5px solid var(--ocean)",
                      animation: "ping2 1.4s cubic-bezier(0,0,.2,1) infinite",
                      opacity: 0.7,
                    }} />
                    <span style={{
                      position: "absolute",
                      inset: "25%",
                      borderRadius: "50%",
                      background: "var(--ocean)",
                      opacity: 0.8,
                    }} />
                  </div>
                  <span style={{ fontSize: 12.5, color: "var(--text-mid)", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", letterSpacing: "0.06em" }}>
                    {language === "kn" ? "ನಿಮ್ಮ ಸ್ಥಳದ ಮಾಹಿತಿ ತರಲಾಗುತ್ತಿದೆ…" : language === "hi" ? "आपके स्थान की जानकारी ले रहे हैं…" : "Reading the sea at your location…"}
                  </span>
                </div>
              )}

              <MarineMap
                origin={homeOrigin}
                emergencyRoute={showEmergencyRoute ? emergencyRoute : null}
                zones={zones}
                pfz={EMPTY_PFZ}
                areas={outlook?.areas ?? EMPTY_AREAS}
                radiusKm={outlook?.radius_km ?? RADIUS_KM}
                routes={outlook?.routes ?? EMPTY_ROUTES}
                geofence={EMPTY_GEOFENCE}
                alerts={EMPTY_ALERTS}
                language={language}
                onPickLocation={pickLocation}
                focusRank={focusRank}
              />

              {/* Mobile quick stats */}
              {outlook && (
                <div className="mt-3 grid grid-cols-4 gap-2 lg:hidden">
                  {[
                    { k: "Risk", v: `${outlook.safety.score}`, s: outlook.safety.category, color: RISK_COLOR[outlook.safety.category] },
                    { k: "Wave", v: `${outlook.safety.wave_height_m?.toFixed(1) ?? "—"}`, s: "m" },
                    { k: "Wind", v: `${Math.round(outlook.safety.wind_speed_kmh ?? 0)}`, s: "km/h" },
                    { k: "PFZ", v: `${outlook.areas.length}`, s: `areas` },
                  ].map((x) => (
                    <div key={x.k} className="m-panel px-3 py-2 text-center">
                      <div className="m-label">{x.k}</div>
                      <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 18, fontWeight: 700, color: x.color ?? "var(--text-bright)", lineHeight: 1.2 }}>
                        {x.v}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-dim)" }}>{x.s}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right sidebar: intelligence */}
            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-80 lg:overflow-y-auto no-scrollbar">
              {outlook && <FishingPanel data={outlook} language={language} isPortSelected={place?.source === "port" || place?.source === "default"} onSelectArea={(rank) => setFocusRank(rank)} />}
            </div>
          </div>
        )}

        {/* ===== ASK TAB ===== */}
        {tab === "ask" && (
          <>
            <div className="grid min-h-0 flex-1 gap-4 p-3 sm:p-4 grid-cols-1 lg:grid-cols-[minmax(340px,1fr)_1.6fr] lg:overflow-hidden">
              <div className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto min-h-[460px]">
                <LocationPicker current={place} language={language} onPick={setPlace} />
                <ChatPanel
                  messages={messages}
                  busy={busy}
                  language={language}
                  suggestions={suggestions}
                  onSend={send}
                  onLanguage={setLangChoice}
                  intentMode={intentMode}
                  onIntentMode={setIntentMode}
                />
              </div>

              <div className={`flex flex-col min-h-[450px] lg:min-h-0 gap-3 ${latest ? "lg:overflow-y-auto" : ""}`}>
                {latest && <ConditionsStrip res={latest} language={latest.language} />}

                <MarineMap
                  origin={place ? { latitude: place.latitude, longitude: place.longitude } : (latest?.intent.location ?? homeOrigin)}
                  onPickLocation={(lat, lon) => {
                    setPlace({ latitude: lat, longitude: lon, label: "Dropped pin", source: "map" });
                  }}
                  zones={zones}
                  pfz={latest?.pfz ?? EMPTY_PFZ}
                  routes={latest?.routes ?? EMPTY_ROUTES}
                  geofence={latest?.geofence ?? EMPTY_GEOFENCE}
                  alerts={latest?.alerts ?? EMPTY_ALERTS}
                  language={language}
                  fill={!latest}
                  height={latest ? 480 : undefined}
                />

                {latest?.risk && (
                  <RiskCard risk={latest.risk} evidence={latest.evidence} language={latest.language} />
                )}

                {latest && (
                  <RiskTimeline location={latest.intent.location} language={latest.language} />
                )}

                {latest && latest.alerts.length > 0 && (
                  <div className="m-panel hatch-danger overflow-hidden" style={{ borderColor: "rgba(239,68,68,0.4)" }}>
                    <div className="m-hd" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
                      <span className="m-label flex items-center gap-2" style={{ color: "#EF4444" }}>
                        <WarnGlyph size={12} /> {ui.warnings}
                      </span>
                    </div>
                    <div className="px-4 py-3.5 space-y-3">
                      {latest.alerts.map((a, i) => (
                        <div key={i}>
                          <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 14, fontWeight: 700, color: "#EF4444" }}>{a.headline}</div>
                          <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: "var(--text-mid)" }}>{a.detail}</div>
                          <div style={{ marginTop: 4, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-dim)" }}>
                            {a.source} · {a.severity}{a.valid_till ? ` · ${ui.validTill} ${a.valid_till}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {latest && <PFZList zones={latest.pfz} language={latest.language} />}

                {latest && latest.routes.length > 0 && (
                  <div className="m-panel overflow-hidden">
                    <div className="m-hd">
                      <span className="m-label">{ui.courses}</span>
                    </div>
                    <div className="space-y-2 px-4 py-3">
                      {latest.routes.map((r) => (
                        <div
                          key={r.name}
                          className="rounded-sm px-3.5 py-3"
                          style={{
                            border: `1px solid ${r.recommended ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                            background: r.recommended ? "rgba(34,197,94,0.05)" : "var(--surface-2)",
                          }}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="flex items-center gap-2.5" style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 14, fontWeight: 700, color: "var(--text-bright)" }}>
                              <svg width="26" height="8" aria-hidden>
                                <line x1="1" y1="4" x2="25" y2="4" stroke={r.recommended ? "#22C55E" : "var(--text-dim)"} strokeWidth="2" strokeDasharray={r.recommended ? "7 4" : "2 4"} />
                              </svg>
                              {r.name}
                              {r.recommended && (
                                <span className="stamp !text-[9px]" style={{ color: "#22C55E" }}>{ui.recommended}</span>
                              )}
                            </span>
                            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                              {r.distance_km} km · {Math.round(r.eta_minutes)} min
                            </span>
                          </div>
                          <div style={{ marginTop: 4, paddingLeft: 36, fontSize: 11.5, lineHeight: 1.6, color: "var(--text-dim)" }}>{r.notes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {latest && <AgentTracePanel trace={latest.trace} elapsed={latest.elapsed_ms} language={latest.language} />}

                {latest && (
                  <p style={{ padding: "0 4px 8px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, lineHeight: 1.6, color: "var(--text-faint)" }}>
                    {latest.disclaimer}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "authority" && <AuthorityPanel language={language} />}
        {tab === "system" && <SystemPanel mode={mode} language={language} />}
        {tab === "historical" && (
          <HistoricalPanel
            place={place}
            language={language}
            onPlacePick={setPlace}
            onAskOrca={(query) => {
              setTab("ask");
              // Small delay so the chat panel mounts before we fire the query
              setTimeout(() => send(query), 100);
            }}
          />
        )}
      </main>

      {/* SOS Modal */}
      {sosOpen && place && (
        <SosModal
          outlook={outlook}
          emergencyRoute={emergencyRoute}
          latitude={place.latitude}
          longitude={place.longitude}
          language={language}
          onClose={() => setSosOpen(false)}
          onFetchEmergencyRoute={async () => {
            if (place) {
              return await checkAndFetchEmergencyRoute(place.latitude, place.longitude, true);
            }
            return null;
          }}
        />
      )}
    </div>
  );
}
