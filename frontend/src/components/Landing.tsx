import { useEffect, useState } from "react";
import type { Language } from "../types";
import OceanCanvas from "./OceanCanvas";
import { OrcaLogo } from "./glyphs";

type AppTab = "home" | "ask" | "authority" | "system";

const L10N: Record<
  Language,
  {
    headline: string;
    sub: string;
    enter: string;
    tour: string;
    langLabel: string;
    today: string; ask: string; authority: string;
    todayDesc: string; askDesc: string; authorityDesc: string;
    scenarios: string;
    demoLabel: string;
    liveLabel: string;
    badgeDemo: string;
    badgeLive: string;
    disclaimer: string;
    theme: string;
  }
> = {
  en: {
    headline: "Marine Intelligence for Safer Seas",
    sub: "Ten agents read weather, ocean, and GIS data — fused into one explainable safety verdict, in your language.",
    enter: "Open ORCA",
    tour: "Guided tour",
    langLabel: "Language",
    today: "Today's Plan", ask: "Ask ORCA", authority: "Authority",
    todayDesc: "Live PFZ map · safety score · trip economics · forecast",
    askDesc: "English · हिन्दी · ಕನ್ನಡ — spoken or typed",
    authorityDesc: "Coastal operations board · CSV export · live refresh",
    scenarios: "Try a demo",
    demoLabel: "Demo",
    liveLabel: "Live",
    badgeDemo: "DEMO DATA",
    badgeLive: "LIVE MARINE DATA",
    disclaimer: "Simulated data is always labelled · ORCA is decision support — not a replacement for official advisories",
    theme: "Theme",
  },
  hi: {
    headline: "सुरक्षित समुद्र के लिए समुद्री बुद्धिमत्ता",
    sub: "दस एजेंट मौसम, समुद्र और GIS डेटा पढ़ते हैं — आपकी भाषा में एक स्पष्ट सुरक्षा निर्णय देते हैं।",
    enter: "ORCA खोलें",
    tour: "गाइडेड टूर",
    langLabel: "भाषा",
    today: "आज की योजना", ask: "ORCA से पूछें", authority: "प्रशासन",
    todayDesc: "लाइव PFZ नक्शा · सुरक्षा स्कोर · यात्रा अर्थशास्त्र · पूर्वानुमान",
    askDesc: "English · हिन्दी · ಕನ್ನಡ — बोलकर या लिखकर",
    authorityDesc: "तटीय संचालन बोर्ड · CSV निर्यात · लाइव रिफ्रेश",
    scenarios: "डेमो आज़माएँ",
    demoLabel: "डेमो",
    liveLabel: "लाइव",
    badgeDemo: "डेमो डेटा",
    badgeLive: "लाइव समुद्री डेटा",
    disclaimer: "नक़ली डेटा पर हमेशा लेबल · ORCA निर्णय-सहायक है — आधिकारिक सलाह का विकल्प नहीं",
    theme: "थीम",
  },
  kn: {
    headline: "ಸುರಕ್ಷಿತ ಸಮುದ್ರಕ್ಕಾಗಿ ಸಮುದ್ರ ಬುದ್ಧಿಮತ್ತೆ",
    sub: "ಹತ್ತು ಏಜೆಂಟ್‌ಗಳು ಹವಾಮಾನ, ಸಮುದ್ರ ಮತ್ತು GIS ಡೇಟಾವನ್ನು ಓದುತ್ತವೆ — ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಒಂದು ಸ್ಪಷ್ಟ ಸುರಕ್ಷತಾ ತೀರ್ಪು.",
    enter: "ORCA ತೆರೆಯಿರಿ",
    tour: "ಮಾರ್ಗದರ್ಶಿ ಪ್ರವಾಸ",
    langLabel: "ಭಾಷೆ",
    today: "ಇಂದಿನ ಯೋಜನೆ", ask: "ORCA ಕೇಳಿ", authority: "ಪ್ರಾಧಿಕಾರ",
    todayDesc: "ಲೈವ್ PFZ ನಕ್ಷೆ · ಸುರಕ್ಷತಾ ಸ್ಕೋರ್ · ಪ್ರವಾಸ ಅರ್ಥಶಾಸ್ತ್ರ · ಮುನ್ಸೂಚನೆ",
    askDesc: "English · हिन्दी · ಕನ್ನಡ — ಮಾತನಾಡಿ ಅಥವಾ ಬರೆಯಿರಿ",
    authorityDesc: "ಕರಾವಳಿ ಕಾರ್ಯಾಚರಣೆ ಫಲಕ · CSV ರಫ್ತು · ಲೈವ್ ರಿಫ್ರೆಶ್",
    scenarios: "ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ",
    demoLabel: "ಡೆಮೊ",
    liveLabel: "ಲೈವ್",
    badgeDemo: "ಡೆಮೊ ಡೇಟಾ",
    badgeLive: "ಲೈವ್ ಸಮುದ್ರ ಡೇಟಾ",
    disclaimer: "ಸಿಮ್ಯುಲೇಟೆಡ್ ಡೇಟಾಕ್ಕೆ ಯಾವಾಗಲೂ ಲೇಬಲ್ · ORCA ನಿರ್ಧಾರ-ಸಹಾಯ — ಅಧಿಕೃತ ಸಲಹೆಯ ಬದಲಿ ಅಲ್ಲ",
    theme: "ಥೀಮ್",
  },
};

const SCENARIOS: { id: string; label: Record<Language, string>; ask: string; tag: string }[] = [
  { id: "safe",    label: { en: "Safe day", hi: "सुरक्षित दिन", kn: "ಸುರಕ್ಷಿತ ದಿನ" },    ask: "Is it safe to go fishing tomorrow morning near Goa?", tag: "LOW" },
  { id: "danger",  label: { en: "Rough seas", hi: "ख़राब मौसम", kn: "ಕಠಿಣ ಸಮುದ್ರ" },   ask: "ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಮುಂಬೈ ಹತ್ತಿರ ಮೀನುಗಾರಿಕೆಗೆ ಹೋಗಬಹುದೇ?", tag: "HIGH" },
  { id: "cyclone", label: { en: "Cyclone", hi: "चक्रवात", kn: "ಚಂಡಮಾರುತ" },             ask: "Is there a cyclone near Paradip? Can I go fishing?", tag: "EXTREME" },
  { id: "pfz",     label: { en: "Find PFZ", hi: "PFZ खोजें", kn: "PFZ ಹುಡುಕಿ" },        ask: "कोच्चि के पास मछली पकड़ने का क्षेत्र कहाँ है?", tag: "PFZ" },
  { id: "route",   label: { en: "Safe route", hi: "सुरक्षित मार्ग", kn: "ಸುರಕ್ಷಿತ ಮಾರ್ಗ" }, ask: "Give me the safest route to the nearest fishing zone near Mumbai", tag: "ROUTE" },
];

const RISK_TAG_COLOR: Record<string, string> = {
  LOW: "#22C55E",
  MODERATE: "#F59E0B",
  HIGH: "#F97316",
  EXTREME: "#EF4444",
  PFZ: "#00A8CC",
  ROUTE: "#8B5CF6",
};

const FEATURES = [
  { icon: "⊕", keyEn: "today" as const, descKey: "todayDesc" as const, tab: "home" as AppTab },
  { icon: "◎", keyEn: "ask" as const, descKey: "askDesc" as const, tab: "ask" as AppTab },
  { icon: "◈", keyEn: "authority" as const, descKey: "authorityDesc" as const, tab: "authority" as AppTab },
];

// Simulated intelligence metrics for the hero panel
const METRICS = [
  { label: "RISK SCORE", value: "32", unit: "MODERATE", color: "#F59E0B" },
  { label: "WIND SPEED", value: "18", unit: "kt" },
  { label: "WAVE HEIGHT", value: "1.2", unit: "m" },
  { label: "PFZ ZONES", value: "3", unit: "AREAS" },
  { label: "SAFE RETURN", value: "24.3", unit: "km" },
];

const PIPELINE = [
  { label: "Intent", status: "DONE" },
  { label: "Weather", status: "DONE" },
  { label: "Ocean", status: "DONE" },
  { label: "Cyclone", status: "DONE" },
  { label: "GIS", status: "DONE" },
  { label: "PFZ", status: "DONE" },
  { label: "Risk Engine", status: "DONE" },
  { label: "Route", status: "DONE" },
  { label: "Explanation", status: "DONE" },
];

export default function Landing({
  mode,
  language,
  onLanguage,
  theme,
  onTheme,
  onEnter,
  onScenario,
}: {
  mode: string;
  language: Language;
  onLanguage: (l: Language) => void;
  theme?: string;
  onTheme?: () => void;
  onEnter: (tab: AppTab | "landing") => void;
  onScenario: (ask: string) => void;
}) {
  const t = L10N[language] ?? L10N.en;
  const [visible, setVisible] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);

  // Entrance animation
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(id);
  }, []);

  // Pipeline animation loop
  useEffect(() => {
    const id = setInterval(() => {
      setPipelineStep((s) => (s + 1) % PIPELINE.length);
    }, 400);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Three.js ocean canvas — full-screen backdrop */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <OceanCanvas />
      </div>

      {/* Gradient overlay to improve text legibility */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(5,14,24,0.72) 0%, rgba(5,14,24,0.45) 40%, rgba(5,14,24,0.78) 80%, rgba(5,14,24,0.95) 100%)",
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ---- TOP BAR ---- */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 32px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(5,14,24,0.6)",
          backdropFilter: "blur(8px)",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <OrcaLogo size={38} style={{ color: "var(--ocean)" } as React.CSSProperties} />
            <div>
              <div style={{
                fontFamily: "'Fraunces Variable', Georgia, serif",
                fontSize: 24,
                fontWeight: 900,
                color: "var(--ocean-bright)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}>
                ORCA
              </div>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginTop: 2,
              }}>
                Marine Intelligence System
              </div>
            </div>
          </div>

          {/* Mode + Language */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Mode badge */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 2,
              border: `1px solid ${mode === "LIVE" ? "rgba(34,197,94,0.4)" : "rgba(245,158,11,0.4)"}`,
              background: mode === "LIVE" ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: mode === "LIVE" ? "#22C55E" : "#F59E0B",
                display: "inline-block",
                animation: mode === "LIVE" ? "blink 2s ease-in-out infinite" : "none",
              }} />
              <span style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: mode === "LIVE" ? "#22C55E" : "#F59E0B",
              }}>
                {mode === "LIVE" ? t.badgeLive : t.badgeDemo}
              </span>
            </div>

            {/* Language picker */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["en", "hi", "kn"] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => onLanguage(l)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: language === l ? "var(--ocean)" : "var(--border)",
                    background: language === l ? "rgba(0,168,204,0.15)" : "transparent",
                    color: language === l ? "var(--ocean-bright)" : "var(--text-dim)",
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {l === "en" ? "English" : l === "hi" ? "हिन्दी" : "ಕನ್ನಡ"}
                </button>
              ))}
            </div>

            {/* Theme toggle */}
            {onTheme && (
              <button
                onClick={onTheme}
                style={{
                  padding: "6px 12px",
                  borderRadius: 2,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: theme === "light" ? "var(--ocean)" : "var(--text-dim)",
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 16,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                title={t.theme}
              >
                {theme === "light" ? "☀" : "☾"}
              </button>
            )}
          </div>
        </div>

        {/* ---- HERO ---- */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 32px",
            transition: "opacity 0.8s ease, transform 0.8s ease",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(24px)",
          }}
        >
          <div style={{ maxWidth: 1100, width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: 60, alignItems: "center" }}>

            {/* Left: headline + features + actions */}
            <div>
              {/* Sonar ident */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <div style={{ position: "relative", width: 36, height: 36 }}>
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    border: "1px solid var(--ocean)",
                    animation: "sonar 2.4s cubic-bezier(0,0,.2,1) infinite",
                  }} />
                  <div style={{
                    position: "absolute", inset: 6, borderRadius: "50%",
                    border: "1px solid var(--ocean)",
                    animation: "sonar 2.4s cubic-bezier(0,0,.2,1) infinite 0.8s",
                  }} />
                  <div style={{
                    position: "absolute", inset: "50%", transform: "translate(-50%,-50%)",
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--ocean)",
                  }} />
                </div>
                <span style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--ocean)",
                }}>
                  ORCA · SIH26176 · {new Date().toLocaleDateString("en-IN")}
                </span>
              </div>

              {/* Main headline */}
              <h1 style={{
                fontFamily: "'Fraunces Variable', Georgia, serif",
                fontSize: "clamp(28px, 4vw, 52px)",
                fontWeight: 900,
                color: "var(--text-bright)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                marginBottom: 16,
              }}>
                {t.headline}
              </h1>

              <p style={{
                fontSize: 16,
                lineHeight: 1.7,
                color: "var(--text-mid)",
                maxWidth: 520,
                marginBottom: 40,
              }}>
                {t.sub}
              </p>

              {/* Feature links */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 40 }}>
                {FEATURES.map((f) => (
                  <button
                    key={f.keyEn}
                    onClick={() => onEnter(f.tab)}
                    style={{
                      background: "rgba(10,25,41,0.7)",
                      border: "1px solid var(--border-mid)",
                      borderRadius: 3,
                      padding: "16px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backdropFilter: "blur(8px)",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget.style.background = "rgba(0,168,204,0.08)");
                      (e.currentTarget.style.borderColor = "var(--ocean)");
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget.style.background = "rgba(10,25,41,0.7)");
                      (e.currentTarget.style.borderColor = "var(--border-mid)");
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 8, color: "var(--ocean)" }}>{f.icon}</div>
                    <div style={{
                      fontFamily: "'Fraunces Variable', Georgia, serif",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--text-bright)",
                      marginBottom: 5,
                    }}>
                      {t[f.keyEn]}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
                      {t[f.descKey]}
                    </div>
                  </button>
                ))}
              </div>

              {/* CTAs */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
                <button
                  onClick={() => onEnter("home")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 28px",
                    background: "var(--ocean)",
                    color: "#020810",
                    border: "none",
                    borderRadius: 2,
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget.style.background = "var(--ocean-bright)");
                    (e.currentTarget.style.transform = "translateY(-2px)");
                    (e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,168,204,0.4)");
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget.style.background = "var(--ocean)");
                    (e.currentTarget.style.transform = "translateY(0)");
                    (e.currentTarget.style.boxShadow = "none");
                  }}
                >
                  <span style={{ fontSize: 16 }}>→</span>
                  {t.enter}
                </button>

              </div>


            </div>

            {/* Right: Intelligence preview panel */}
            <div style={{ width: 300 }}>
              {/* Live metrics card */}
              <div style={{
                background: "rgba(10,25,41,0.85)",
                border: "1px solid var(--border-mid)",
                borderRadius: 3,
                backdropFilter: "blur(12px)",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(0,168,204,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--ocean)",
                  }}>
                    Live Marine Intelligence
                  </span>
                  <span style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 8,
                    color: "var(--text-dim)",
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--risk-low)", display: "inline-block", animation: "blink 2s ease-in-out infinite" }} />
                    {mode}
                  </span>
                </div>
                <div style={{ padding: "14px" }}>
                  {METRICS.map((m, i) => (
                    <div
                      key={m.label}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        paddingBottom: i < METRICS.length - 1 ? 10 : 0,
                        marginBottom: i < METRICS.length - 1 ? 10 : 0,
                        borderBottom: i < METRICS.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <span style={{
                        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--text-dim)",
                      }}>
                        {m.label}
                      </span>
                      <span>
                        <span style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: m.label === "RISK SCORE" ? 20 : 16,
                          fontWeight: 800,
                          color: m.color ?? "var(--text-bright)",
                          lineHeight: 1,
                        }}>
                          {m.value}
                        </span>
                        <span style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 9,
                          color: m.color ?? "var(--text-dim)",
                          marginLeft: 5,
                          fontWeight: 600,
                        }}>
                          {m.unit}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Pipeline status */}
                <div style={{
                  padding: "10px 14px",
                  borderTop: "1px solid var(--border)",
                  background: "rgba(0,168,204,0.03)",
                }}>
                  <div style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    marginBottom: 8,
                  }}>
                    Intelligence Pipeline
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                    {PIPELINE.map((p, i) => (
                      <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                          background: i === pipelineStep ? "var(--ocean-bright)" : "var(--risk-low)",
                          transition: "all 0.3s",
                          boxShadow: i === pipelineStep ? "0 0 8px var(--ocean-bright)" : "none",
                        }} />
                        <span style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 8.5,
                          color: i === pipelineStep ? "var(--ocean-bright)" : "var(--text-dim)",
                          transition: "color 0.3s",
                        }}>
                          {p.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stat boxes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                {[
                  { label: "Agents", value: "10" },
                  { label: "Languages", value: "3" },
                  { label: "Landing Centres", value: "10" },
                  { label: "Data Edition", value: "SIH26176" },
                ].map((s) => (
                  <div key={s.label} style={{
                    background: "rgba(10,25,41,0.75)",
                    border: "1px solid var(--border)",
                    borderRadius: 2,
                    padding: "10px 12px",
                    backdropFilter: "blur(8px)",
                  }}>
                    <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 4 }}>
                      {s.label}
                    </div>
                    <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 16, fontWeight: 800, color: "var(--text-bright)" }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ---- FOOTER ---- */}
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "12px 32px",
          background: "rgba(5,14,24,0.7)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            color: "var(--text-faint)",
            letterSpacing: "0.08em",
          }}>
            {t.disclaimer}
          </span>
          <span style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            color: "var(--text-faint)",
            letterSpacing: "0.12em",
          }}>
            SIH 2026 · ORCA
          </span>
        </div>
      </div>
    </div>
  );
}
