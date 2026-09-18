import { useEffect, useState } from "react";
import * as api from "../api";
import type { AuthorityDashboard, Language } from "../types";
import { RISK_COLOR } from "./RiskDial";

const T: Record<Language, Record<string, string>> = {
  en: {
    centres: "Centres Monitored", extreme: "Extreme Risk", high: "High Risk", warnings: "Official Warnings",
    board: "COASTAL OPERATIONS BOARD", sub: "Risk Overview", refresh: "auto-refresh every 30s",
    export: "Export CSV", hCentre: "Landing Centre", hState: "State", hRisk: "Risk",
    hWave: "Wave", hWind: "Wind", hWarning: "Advisory", loading: "Loading coastline data…",
    opStatus: "OPERATIONAL STATUS", alertBanner: "ELEVATED RISK AREAS",
  },
  hi: {
    centres: "निगरानी केंद्र", extreme: "अत्यधिक जोखिम", high: "उच्च जोखिम", warnings: "आधिकारिक चेतावनियाँ",
    board: "तटीय संचालन बोर्ड", sub: "जोखिम अवलोकन", refresh: "हर 30 सेकंड में ताज़ा",
    export: "CSV निर्यात", hCentre: "लैंडिंग सेंटर", hState: "राज्य", hRisk: "जोखिम",
    hWave: "लहर", hWind: "हवा", hWarning: "चेतावनी", loading: "तटरेखा डेटा लोड हो रहा है…",
    opStatus: "परिचालन स्थिति", alertBanner: "उच्च जोखिम क्षेत्र",
  },
  kn: {
    centres: "ನಿಗರಾಣಿ ಕೇಂದ್ರಗಳು", extreme: "ಅತ್ಯಂತ ಅಪಾಯ", high: "ಹೆಚ್ಚಿನ ಅಪಾಯ", warnings: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು",
    board: "ಕರಾವಳಿ ಕಾರ್ಯಾಚರಣೆ ಫಲಕ", sub: "ಅಪಾಯ ಅವಲೋಕನ", refresh: "ಪ್ರತಿ 30 ಸೆಕೆಂಡಿಗೆ ನವೀಕರಿಸುತ್ತದೆ",
    export: "CSV ರಫ್ತು", hCentre: "ಕರಾವಳಿ ಕೇಂದ್ರ", hState: "ರಾಜ್ಯ", hRisk: "ಅಪಾಯ",
    hWave: "ಅಲೆ", hWind: "ಗಾಳಿ", hWarning: "ಎಚ್ಚರಿಕೆ", loading: "ಕರಾವಳಿ ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
    opStatus: "ಕಾರ್ಯಾಚರಣೆ ಸ್ಥಿತಿ", alertBanner: "ಎತ್ತರಿಸಿದ ಅಪಾಯ ಪ್ರದೇಶಗಳು",
  },
};

const translateAdvisory = (text: string | null | undefined, lang: Language): string | null | undefined => {
  if (!text) return text;
  if (lang === "en") return text;
  
  const dict: Record<Language, Record<string, string>> = {
    en: {},
    hi: {
      "Fishermen advised not to venture into the sea": "मछुआरों को समुद्र में न जाने की सलाह दी जाती है",
      "Severe Cyclonic Storm — Orange message for north Odisha coast": "गंभीर चक्रवाती तूफान — उत्तरी ओडिशा तट के लिए ऑरेंज संदेश",
      "High Wave Alert — wave height 4.5-6.0 m": "ऊंची लहरों की चेतावनी — लहरों की ऊंचाई 4.5-6.0 मीटर",
      "Fishermen warning — squally weather over the north Bay of Bengal": "मछुआरों को चेतावनी — उत्तरी बंगाल की खाड़ी के ऊपर तूफानी मौसम",
      "EXTREME": "अत्यधिक",
      "HIGH": "उच्च",
      "MODERATE": "मध्यम",
      "LOW": "कम",
    },
    kn: {
      "Fishermen advised not to venture into the sea": "ಮೀನುಗಾರರು ಸಮುದ್ರಕ್ಕೆ ಇಳಿಯದಂತೆ ಸಲಹೆ ನೀಡಲಾಗಿದೆ",
      "Severe Cyclonic Storm — Orange message for north Odisha coast": "ತೀವ್ರ ಚಂಡಮಾರುತ — ಉತ್ತರ ಒಡಿಶಾ ಕರಾವಳಿಗೆ ಆರೆಂಜ್ ಸಂದೇಶ",
      "High Wave Alert — wave height 4.5-6.0 m": "ಎತ್ತರದ ಅಲೆಗಳ ಎಚ್ಚರಿಕೆ — ಅಲೆಗಳ ಎತ್ತರ 4.5-6.0 ಮೀಟರ್",
      "Fishermen warning — squally weather over the north Bay of Bengal": "ಮೀನುಗಾರರಿಗೆ ಎಚ್ಚರಿಕೆ — ಉತ್ತರ ಬಂಗಾಳ ಕೊಲ್ಲಿಯಲ್ಲಿ ಬಿರುಗಾಳಿ ಸಹಿತ ಹವಾಮಾನ",
      "EXTREME": "ಅತ್ಯಂತ ಅಪಾಯ",
      "HIGH": "ಹೆಚ್ಚಿನ ಅಪಾಯ",
      "MODERATE": "ಮಧ್ಯಮ ಅಪಾಯ",
      "LOW": "ಕಡಿಮೆ ಅಪಾಯ",
    }
  };
  return dict[lang]?.[text] || text;
};

function exportCsv(data: AuthorityDashboard) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Landing centre", "State", "Risk score", "Category", "Official warning", "Wave (m)", "Wind (km/h)", "Active warning"].join(","),
    ...data.locations.map((r) =>
      [q(r.name), q(r.state), r.risk_score, r.risk_category,
       r.official_warning ? "YES" : "", r.wave_height_m ?? "",
       r.wind_speed_kmh ?? "", q(r.headline)].join(","),
    ),
    "",
    q(`Generated ${data.generated_at} IST by ORCA (SIH26176). Demo/simulated data is labelled — this is decision support, not an official advisory.`),
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([rows], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `orca-coastal-risk-board-${data.generated_at.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
};

export default function AuthorityPanel({ language = "en" }: { language?: Language }) {
  const t = T[language] ?? T.en;
  const [data, setData] = useState<AuthorityDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.authority()
        .then((d) => alive && setData(d))
        .catch((e) => alive && setError(String(e)));
    load();
    const timer = setInterval(() => { load(); setTick(n => n + 1); }, 30_000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  if (error)
    return (
      <div style={{ padding: 24, display: "grid", placeItems: "center", flex: 1 }}>
        <div className="m-panel" style={{ padding: 20, borderColor: "rgba(239,68,68,0.4)", color: "var(--risk-ext)", maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
            BACKEND UNAVAILABLE
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{error}</div>
        </div>
      </div>
    );

  if (!data)
    return (
      <div style={{ padding: 24, display: "flex", justifyContent: "center", alignItems: "center", gap: 12, flex: 1 }}>
        <span style={{ color: "var(--ocean)", display: "inline-block", animation: "sonar 1.5s linear infinite" }}>◎</span>
        <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-dim)" }}>
          {t.loading}
        </span>
      </div>
    );

  const tiles = [
    { key: "monitored", label: t.centres, color: "var(--ocean)" },
    { key: "extreme", label: t.extreme, color: RISK_COLOR.EXTREME },
    { key: "high", label: t.high, color: RISK_COLOR.HIGH },
    { key: "official_warnings", label: t.warnings, color: RISK_COLOR.MODERATE },
  ];

  const alertRows = data.locations.filter(r => r.risk_category === "EXTREME" || r.risk_category === "HIGH" || r.official_warning);

  return (
    <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>

      {/* ---- PAGE HEADER ---- */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, fontWeight: 800, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--ocean)", marginBottom: 4 }}>
            {t.opStatus}
          </div>
          <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 22, fontWeight: 900, color: "var(--text-bright)", lineHeight: 1 }}>
            {t.board}
          </div>
          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-faint)", marginTop: 4, letterSpacing: "0.1em" }}>
            {data.generated_at.slice(0, 16).replace("T", " ")} IST · {t.refresh}
          </div>
        </div>
        <button
          onClick={() => exportCsv(data)}
          className="btn-ghost"
          style={{ fontSize: 10 }}
          title="Download board as CSV advisory sheet"
        >
          ↓ {t.export}
        </button>
      </div>

      {/* ---- SUMMARY TILES ---- */}
      <div className="m-panel" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {tiles.map((tile, i) => (
          <div key={tile.key} style={{
            padding: "14px 16px",
            borderLeft: i > 0 ? "1px solid var(--border)" : "none",
          }}>
            <div style={LABEL_STYLE}>{tile.label}</div>
            <div style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 34,
              fontWeight: 900,
              color: tile.color,
              lineHeight: 1,
              marginTop: 6,
            }}>
              {data.summary[tile.key] ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* ---- ALERT BANNER ---- */}
      {alertRows.length > 0 && (
        <div className="m-panel" style={{ borderColor: "rgba(239,68,68,0.35)", backgroundImage: "repeating-linear-gradient(45deg, rgba(239,68,68,0.03) 0 1.5px, transparent 1.5px 8px)" }}>
          <div className="m-hd" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--risk-ext)" }}>
              ⚠ {t.alertBanner}
            </div>
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-faint)" }}>
              {alertRows.length} {language === "kn" ? "ಪ್ರದೇಶಗಳು" : language === "hi" ? "क्षेत्र" : "areas"}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 14px" }}>
            {alertRows.slice(0, 6).map(r => {
              const col = RISK_COLOR[r.risk_category];
              return (
                <div key={r.name} style={{
                  padding: "6px 12px",
                  background: `${col}10`,
                  border: `1px solid ${col}40`,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 11, fontWeight: 700, color: col }}>
                    {r.risk_score}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>{r.name}</div>
                    <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
                      {r.state} · {translateAdvisory(r.risk_category, language)}
                    </div>
                  </div>
                  {r.official_warning && (
                    <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 7, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", padding: "1px 5px", border: "1px solid rgba(239,68,68,0.5)", color: "var(--risk-ext)" }}>
                      ⚠
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- MAIN TABLE ---- */}
      <div className="m-panel overflow-hidden" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="m-hd">
          <div>
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
              {t.board}
            </div>
            <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", marginTop: 1 }}>
              {t.sub}
            </div>
          </div>
          {/* Live pulse */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ocean)", display: "inline-block", animation: "blink 2s ease-in-out infinite" }} />
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--ocean)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {language === "kn" ? "ಲೈವ್" : language === "hi" ? "लाइव" : "Live"}
            </span>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-mid)", position: "sticky", top: 0, background: "var(--surface)" }}>
                {[t.hCentre, t.hState, t.hRisk, t.hWave, t.hWind, t.hWarning].map((h, i) => (
                  <th key={h} style={{
                    padding: i === 0 ? "9px 12px 9px 16px" : "9px 12px",
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.locations.map((row) => {
                const color = RISK_COLOR[row.risk_category];
                const isUrgent = row.risk_category === "EXTREME" || row.risk_category === "HIGH";
                return (
                  <tr
                    key={row.name}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: isUrgent ? `${color}06` : "transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isUrgent ? `${color}06` : "transparent"; }}
                  >
                    <td style={{ padding: "10px 12px 10px 16px", fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 13, fontWeight: 700, color: "var(--text-bright)", whiteSpace: "nowrap" }}>
                      {row.name}
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.06em" }}>
                      {row.state}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 15, fontWeight: 800, color }}>
                          {row.risk_score}
                        </span>
                        <span style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 7,
                          fontWeight: 800,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          padding: "2px 6px",
                          border: `1px solid ${color}60`,
                          color,
                        }}>
                          {translateAdvisory(row.risk_category, language)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 12, color: "var(--text-mid)" }}>
                      {row.wave_height_m ?? "—"} m
                    </td>
                    <td style={{ padding: "10px 12px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 12, color: "var(--text-mid)" }}>
                      {row.wind_speed_kmh ?? "—"} km/h
                    </td>
                    <td style={{ padding: "10px 16px 10px 12px", fontSize: 11, color: row.official_warning ? "var(--risk-ext)" : "var(--text-dim)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {translateAdvisory(row.headline, language) ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "7px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            ORCA SIH26176 · {t.refresh} · {data.locations.length} centres
          </span>
          <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
            tick #{tick}
          </span>
        </div>
      </div>
    </div>
  );
}
