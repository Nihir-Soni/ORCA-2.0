import { useEffect, useState } from "react";
import * as api from "../api";
import type { EmergencyRoute, FishingOutlook, Language } from "../types";
import { RISK_COLOR } from "./RiskDial";

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins ? `${mins}m` : ""}`.trim() : `${mins}m`;
}

const L: Record<Language, Record<string, string>> = {
  en: {
    title: "SOS EMERGENCY",
    subtitle: "Emergency Position Report",
    location: "CURRENT LOCATION",
    viewMap: "View on map",
    risk: "CURRENT RISK",
    hazards: "ACTIVE HAZARDS",
    noHazards: "No active hazards reported",
    calcRisk: "Calculating risk assessment…",
    calcHazards: "Awaiting condition data…",
    route: "SAFE RETURN TO LAND",
    calcRoute: "Calculating safest route to shore…",
    routeUnavail: "Safe return route unavailable from current position.",
    destination: "DESTINATION",
    distance: "DISTANCE",
    eta: "ETA",
    routeRisk: "ROUTE RISK",
    message: "ADDITIONAL MESSAGE",
    cancel: "Cancel",
    viewRoute: "View Route",
    send: "SEND SOS",
    sending: "Transmitting…",
    disclaimer: "ORCA will prepare an SMS with your position, risk, and route. This is decision support — also contact official maritime rescue.",
    successTitle: "SOS TRANSMITTED",
    failTitle: "TRANSMISSION FAILED",
    failNote: "Keep the location link and contact emergency services directly.",
  },
  hi: {
    title: "SOS आपातकाल",
    subtitle: "आपातकालीन स्थान रिपोर्ट",
    location: "वर्तमान स्थान",
    viewMap: "नक्शे पर देखें",
    risk: "वर्तमान जोखिम",
    hazards: "सक्रिय खतरे",
    noHazards: "कोई सक्रिय खतरा नहीं",
    calcRisk: "जोखिम की गणना हो रही है…",
    calcHazards: "स्थिति डेटा की प्रतीक्षा…",
    route: "भूमि पर सुरक्षित वापसी",
    calcRoute: "सबसे सुरक्षित मार्ग की गणना हो रही है…",
    routeUnavail: "वर्तमान स्थान से सुरक्षित वापसी मार्ग उपलब्ध नहीं है।",
    destination: "गंतव्य",
    distance: "दूरी",
    eta: "अनुमानित समय",
    routeRisk: "मार्ग जोखिम",
    message: "अतिरिक्त संदेश",
    cancel: "रद्द करें",
    viewRoute: "मार्ग देखें",
    send: "SOS भेजें",
    sending: "प्रेषण हो रहा है…",
    disclaimer: "ORCA आपकी स्थिति, जोखिम और मार्ग के साथ SMS तैयार करेगा।",
    successTitle: "SOS प्रेषित",
    failTitle: "प्रेषण विफल",
    failNote: "स्थान लिंक रखें और सीधे आपातकालीन सेवाओं से संपर्क करें।",
  },
  kn: {
    title: "SOS ತುರ್ತು",
    subtitle: "ತುರ್ತು ಸ್ಥಾನ ವರದಿ",
    location: "ಪ್ರಸ್ತುತ ಸ್ಥಳ",
    viewMap: "ನಕ್ಷೆಯಲ್ಲಿ ನೋಡಿ",
    risk: "ಪ್ರಸ್ತುತ ಅಪಾಯ",
    hazards: "ಸಕ್ರಿಯ ಅಪಾಯಗಳು",
    noHazards: "ಯಾವುದೇ ಸಕ್ರಿಯ ಅಪಾಯ ವರದಿಯಾಗಿಲ್ಲ",
    calcRisk: "ಅಪಾಯ ಮೌಲ್ಯಮಾಪನ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ…",
    calcHazards: "ಸ್ಥಿತಿ ಡೇಟಾಕ್ಕಾಗಿ ನಿರೀಕ್ಷಿಸಲಾಗುತ್ತಿದೆ…",
    route: "ಭೂಮಿಗೆ ಸುರಕ್ಷಿತ ಮರಳು",
    calcRoute: "ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ…",
    routeUnavail: "ಪ್ರಸ್ತುತ ಸ್ಥಳದಿಂದ ಸುರಕ್ಷಿತ ಮರಳು ಮಾರ್ಗ ಲಭ್ಯವಿಲ್ಲ.",
    destination: "ಗಮ್ಯಸ್ಥಾನ",
    distance: "ದೂರ",
    eta: "ಅಂದಾಜು ಸಮಯ",
    routeRisk: "ಮಾರ್ಗ ಅಪಾಯ",
    message: "ಹೆಚ್ಚುವರಿ ಸಂದೇಶ",
    cancel: "ರದ್ದು ಮಾಡಿ",
    viewRoute: "ಮಾರ್ಗ ನೋಡಿ",
    send: "SOS ಕಳುಹಿಸಿ",
    sending: "ರವಾನಿಸಲಾಗುತ್ತಿದೆ…",
    disclaimer: "ORCA ನಿಮ್ಮ ಸ್ಥಳ, ಅಪಾಯ ಮತ್ತು ಮಾರ್ಗದೊಂದಿಗೆ SMS ತಯಾರಿಸುತ್ತದೆ.",
    successTitle: "SOS ರವಾನಿಸಲಾಗಿದೆ",
    failTitle: "ರವಾನೆ ವಿಫಲ",
    failNote: "ಸ್ಥಳ ಲಿಂಕ್ ಇಟ್ಟುಕೊಳ್ಳಿ ಮತ್ತು ತುರ್ತು ಸೇವೆಗಳನ್ನು ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ.",
  },
};

export default function SosModal({
  outlook,
  emergencyRoute,
  latitude,
  longitude,
  language = "en",
  onClose,
  onFetchEmergencyRoute,
}: {
  outlook: FishingOutlook | null;
  emergencyRoute: EmergencyRoute | null;
  latitude: number;
  longitude: number;
  language?: Language;
  onClose: () => void;
  onFetchEmergencyRoute?: () => Promise<EmergencyRoute | null>;
}) {
  const t = L[language] ?? L.en;
  const [message, setMessage] = useState("Engine failure. Unable to return to shore.");
  const [sending, setSending] = useState(false);
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pulse, setPulse] = useState(true);

  const current = outlook?.location.latitude === latitude && outlook.location.longitude === longitude;
  const route = current ? emergencyRoute : null;
  const hazards = current
    ? outlook.avoid.filter((item) => item.active_now).map((item) => `${item.name} (${item.severity})`)
    : [];
  const locationLink = `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const riskColor = current && outlook ? RISK_COLOR[outlook.safety.category] : "var(--text-dim)";

  // Pulse animation for emergency beacon
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 800);
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    if (!current || !outlook) return;
    setSending(true);
    setResult(null);
    
    let finalRoute = route;
    if (!finalRoute && onFetchEmergencyRoute) {
      setFetchingRoute(true);
      finalRoute = await onFetchEmergencyRoute();
      setFetchingRoute(false);
    }

    try {
      const res = await api.sendSos({
        latitude,
        longitude,
        risk: { category: outlook.safety.category, score: outlook.safety.score },
        hazards,
        route: finalRoute,
        message,
        language,
      });
      setResult({ ok: res.ok, text: `${res.message}\n\n${res.sms}` });
    } catch {
      setResult({ ok: false, text: t.failNote });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%",
        maxWidth: 520,
        maxHeight: "92vh",
        overflowY: "auto",
        background: "var(--surface)",
        border: "1px solid rgba(239,68,68,0.5)",
        borderRadius: 3,
        boxShadow: "0 0 60px rgba(239,68,68,0.2), 0 20px 60px rgba(0,0,0,0.8)",
      }}>

        {/* ---- HEADER ---- */}
        <div style={{
          background: "rgba(239,68,68,0.1)",
          borderBottom: "1px solid rgba(239,68,68,0.3)",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Emergency beacon */}
            <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "1.5px solid #EF4444",
                opacity: pulse ? 0.8 : 0.2,
                transition: "opacity 0.4s",
              }} />
              <div style={{
                position: "absolute",
                inset: 5,
                borderRadius: "50%",
                background: "#EF4444",
                opacity: pulse ? 1 : 0.4,
                transition: "opacity 0.4s",
                boxShadow: pulse ? "0 0 12px #EF4444" : "none",
              }} />
            </div>
            <div>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#EF4444",
              }}>
                {t.title}
              </div>
              <div style={{
                fontFamily: "'Fraunces Variable', Georgia, serif",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--text-bright)",
                lineHeight: 1.2,
                marginTop: 2,
              }}>
                {t.subtitle}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              display: "grid",
              placeItems: "center",
              border: "1px solid var(--border-mid)",
              borderRadius: 2,
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: 16,
              fontFamily: "monospace",
            }}
            aria-label="Close SOS"
          >
            ×
          </button>
        </div>

        {/* ---- BODY ---- */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Location */}
          <div>
            <div style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
              marginBottom: 8,
            }}>
              {t.location}
            </div>
            <div style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-mid)",
              borderRadius: 2,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-bright)",
                letterSpacing: "0.04em",
              }}>
                {latitude.toFixed(6)}°N &nbsp;·&nbsp; {longitude.toFixed(6)}°E
              </div>
              <a
                href={locationLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--ocean)",
                  textDecoration: "none",
                  border: "1px solid var(--ocean-dim)",
                  padding: "3px 8px",
                  borderRadius: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {t.viewMap} ↗
              </a>
            </div>
          </div>

          {/* Risk + Hazards — 2 col */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Risk */}
            <div>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}>
                {t.risk}
              </div>
              <div style={{
                background: "var(--surface-2)",
                border: `1px solid ${current && outlook ? riskColor + "40" : "var(--border)"}`,
                borderRadius: 2,
                padding: "10px 14px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                {current && outlook ? (
                  <>
                    <div style={{
                      fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 28,
                      fontWeight: 800,
                      lineHeight: 1,
                      color: riskColor,
                    }}>
                      {outlook.safety.score}
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 10,
                        fontWeight: 700,
                        color: riskColor,
                        letterSpacing: "0.1em",
                      }}>
                        {outlook.safety.category}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 2 }}>/ 100</div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
                    {t.calcRisk}
                  </div>
                )}
              </div>
            </div>

            {/* Hazards */}
            <div>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}>
                {t.hazards}
              </div>
              <div style={{
                background: "var(--surface-2)",
                border: hazards.length > 0 ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border)",
                borderRadius: 2,
                padding: "10px 14px",
                height: "100%",
              }}>
                {current ? (
                  hazards.length > 0 ? (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      {hazards.map((h) => (
                        <li key={h} style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                          fontSize: 11,
                          color: "#EF4444",
                          lineHeight: 1.4,
                        }}>
                          <span style={{ marginTop: 2, flexShrink: 0 }}>⚠</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--risk-low)" }}>✓ {t.noHazards}</div>
                  )
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
                    {t.calcHazards}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Route */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(239,68,68,0.7)",
              marginBottom: 8,
            }}>
              {t.route}
            </div>

            {!current || (!route && fetchingRoute) ? (
              <div style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--text-dim)",
                fontStyle: "italic",
              }}>
                {t.calcRoute}
              </div>
            ) : (!route && !fetchingRoute) ? (
              <div style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--text-dim)",
                fontStyle: "italic",
              }}>
                {language === "kn" ? "SOS ಕಳುಹಿಸಿದಾಗ ಮಾರ್ಗವನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತದೆ." : language === "hi" ? "SOS भेजने पर मार्ग की गणना की जाएगी।" : "Route will be calculated upon sending SOS."}
              </div>
            ) : route!.available ? (
              <div style={{
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 2,
                padding: "12px 14px",
              }}>
                {/* Stats row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: t.distance, value: `${route.distance_km}`, unit: "km" },
                    { label: t.eta, value: duration(route.eta_minutes ?? 0), unit: "" },
                    {
                      label: t.routeRisk,
                      value: route.risk_category ?? "—",
                      unit: "",
                      color: route.risk_category ? RISK_COLOR[route.risk_category] : undefined,
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <div style={{
                        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 8,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--text-faint)",
                        marginBottom: 4,
                      }}>
                        {s.label}
                      </div>
                      <div style={{
                        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 15,
                        fontWeight: 800,
                        color: s.color ?? "var(--text-bright)",
                        lineHeight: 1,
                      }}>
                        {s.value}
                        {s.unit && <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)", marginLeft: 3 }}>{s.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {route.destination && (
                  <div style={{
                    borderTop: "1px solid rgba(239,68,68,0.15)",
                    paddingTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 10, color: "rgba(239,68,68,0.6)" }}>→</span>
                    <div>
                      <div style={{
                        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 8,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--text-faint)",
                      }}>
                        {t.destination}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginTop: 1 }}>
                        {route.destination.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 2,
                padding: "10px 14px",
                fontSize: 12,
                color: "rgba(239,68,68,0.8)",
              }}>
                {t.routeUnavail}
              </div>
            )}
          </div>

          {/* Message */}
          <div>
            <div style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
              marginBottom: 8,
            }}>
              {t.message}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 13px",
                background: "var(--surface-2)",
                color: "var(--text-bright)",
                border: "1px solid var(--border-mid)",
                borderRadius: 2,
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--ocean)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border-mid)"; }}
            />
          </div>

          {/* Result */}
          {result && (
            <div style={{
              background: result.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${result.ok ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
              borderRadius: 2,
              padding: "12px 14px",
            }}>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: result.ok ? "var(--risk-low)" : "#EF4444",
                marginBottom: 8,
              }}>
                {result.ok ? t.successTitle : t.failTitle}
              </div>
              <pre style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 10,
                color: "var(--text-mid)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 160,
                overflowY: "auto",
                margin: 0,
                lineHeight: 1.6,
              }}>
                {result.text}
              </pre>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            color: "var(--text-faint)",
            lineHeight: 1.6,
            borderTop: "1px solid var(--border)",
            paddingTop: 12,
          }}>
            ⚠ {t.disclaimer}
          </div>
        </div>

        {/* ---- FOOTER ---- */}
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          background: "rgba(0,0,0,0.2)",
        }}>
          <button onClick={onClose} className="btn-ghost">
            {t.cancel}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} className="btn-ghost">
              {t.viewRoute}
            </button>
            <button
              onClick={submit}
              disabled={sending || fetchingRoute || !current}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 22px",
                background: (sending || fetchingRoute) ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.15)",
                color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.6)",
                borderRadius: 2,
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: (sending || fetchingRoute) || !current ? "not-allowed" : "pointer",
                opacity: !current ? 0.4 : 1,
                transition: "all 0.2s",
                animation: (sending || fetchingRoute) ? "inkblink 1s ease-in-out infinite" : "none",
              }}
              onMouseEnter={(e) => {
                if (!sending && !fetchingRoute && current) {
                  e.currentTarget.style.background = "rgba(239,68,68,0.3)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(239,68,68,0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {sending || fetchingRoute ? (
                <>
                  <span style={{ display: "inline-block", animation: "sonar 1.2s linear infinite" }}>◎</span>
                  {fetchingRoute ? (language === "kn" ? "ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ…" : language === "hi" ? "गणना हो रही है…" : "CALCULATING…") : t.sending}
                </>
              ) : (
                <>
                  <span style={{ fontSize: 10 }}>⚡</span>
                  {t.send}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}