import type { CatchRating, FishingOutlook, Language } from "../types";
import { FishGlyph, SchoolGlyph, WarnGlyph } from "./glyphs";

export const RATING_COLOR: Record<CatchRating, string> = {
  very_good: "#22C55E",
  good:      "#84CC16",
  fair:      "#F59E0B",
  poor:      "#EF4444",
};

const RATING_WORD: Record<Language, Record<CatchRating, string>> = {
  en: { very_good: "Very good", good: "Good", fair: "Some chance", poor: "Low chance" },
  hi: { very_good: "बहुत अच्छा", good: "अच्छा", fair: "कुछ उम्मीद", poor: "कम उम्मीद" },
  kn: { very_good: "ಬಹಳ ಉತ್ತಮ", good: "ಉತ್ತಮ", fair: "ಸ್ವಲ್ಪ ಸಾಧ್ಯತೆ", poor: "ಕಡಿಮೆ ಸಾಧ್ಯತೆ" },
};

const T: Record<Language, Record<string, string>> = {
  en: {
    advice: "ORCA RECOMMENDATION", areas: "Best fishing zones", within: "within", away: "away", chance: "chance",
    trip: "TRIP PLAN", stay: "Stay", travel: "Travel each way", total: "Round trip", hours: "h", min: "min",
    bestTime: "Best window", avoid: "AVOID THESE AREAS", closedNow: "active now", closedBetween: "closed",
    always: "always closed", forecast: "3-DAY FORECAST", today: "Today", tomorrow: "Tomorrow", dayAfter: "Day 3",
    bestAt: "best at", notWorth: "Insufficient safe time for this trip today.",
    likely: "Likely", likelyNote: "from SST + chlorophyll — never a promise",
    returnBy: "RETURN BY", returnWhy: "waves reach", econ: "TRIP ECONOMICS",
    fuel: "Fuel", catch: "Catch", revenue: "Revenue", profit: "Profit",
    econNote: "Planning estimate — not a guarantee.", barsCaption: "Factors: chlorophyll · SST · front · sea · time",
    pfzTitle: "PFZ INTELLIGENCE", pfzSub: "Potential Fishing Zones",
    noNearby: "No INCOIS PFZ advisory within",
    nearestIs: "Nearest INCOIS PFZ advisory is approximately",
    kmAway: "km away.",
    atLandWarning: "You are currently at land, please choose a harbour or drag the boat icon to a location."
  },
  hi: {
    advice: "ORCA सुझाव", areas: "मछली पकड़ने की सबसे अच्छी जगहें", within: "के अंदर", away: "दूर", chance: "मछली की उम्मीद",
    trip: "यात्रा योजना", stay: "वहाँ रुकें", travel: "एक तरफ़", total: "कुल यात्रा", hours: "घंटे", min: "मिनट",
    bestTime: "सबसे अच्छा समय", avoid: "इन जगहों से बचें", closedNow: "अभी सक्रिय", closedBetween: "बंद",
    always: "हमेशा बंद", forecast: "3 दिन का अनुमान", today: "आज", tomorrow: "कल", dayAfter: "परसों",
    bestAt: "सबसे अच्छा", notWorth: "आज इस यात्रा के लिए पर्याप्त समय नहीं।",
    likely: "संभावित", likelyNote: "SST और क्लोरोफिल से — कोई गारंटी नहीं",
    returnBy: "इससे पहले लौटें", returnWhy: "लहरें होंगी", econ: "यात्रा का अर्थशास्त्र",
    fuel: "ईंधन", catch: "मछली", revenue: "आमदनी", profit: "मुनाफ़ा",
    econNote: "अनुमान — कोई वादा नहीं।", barsCaption: "कारक: क्लोरोफिल · SST · फ्रंट · समुद्र · समय",
    pfzTitle: "PFZ बुद्धिमत्ता", pfzSub: "संभावित मत्स्य क्षेत्र",
    noNearby: "इसके भीतर कोई INCOIS PFZ सलाह नहीं",
    nearestIs: "निकटतम INCOIS PFZ सलाह लगभग",
    kmAway: "किमी दूर है।",
    atLandWarning: "आप वर्तमान में ज़मीन पर हैं, कृपया एक बंदरगाह चुनें या नाव के आइकन को किसी स्थान पर खींचें।"
  },
  kn: {
    advice: "ORCA ಶಿಫಾರಸು", areas: "ಮೀನುಗಾರಿಕೆಗೆ ಉತ್ತಮ ಪ್ರದೇಶಗಳು", within: "ಒಳಗೆ", away: "ದೂರ", chance: "ಸಾಧ್ಯತೆ",
    trip: "ಪ್ರವಾಸ ಯೋಜನೆ", stay: "ಅಲ್ಲಿ ಇರಿ", travel: "ಒಂದು ದಿಕ್ಕು", total: "ಒಟ್ಟು", hours: "ಗಂಟೆ", min: "ನಿಮಿಷ",
    bestTime: "ಉತ್ತಮ ಸಮಯ", avoid: "ಈ ಪ್ರದೇಶಗಳಿಂದ ದೂರ ಇರಿ", closedNow: "ಈಗ ಸಕ್ರಿಯ", closedBetween: "ಮುಚ್ಚಲಾಗಿದೆ",
    always: "ಯಾವಾಗಲೂ ಮುಚ್ಚಲಾಗಿದೆ", forecast: "3 ದಿನದ ಮುನ್ಸೂಚನೆ", today: "ಇಂದು", tomorrow: "ನಾಳೆ", dayAfter: "ನಾಡಿದ್ದು",
    bestAt: "ಉತ್ತಮ ಸಮಯ", notWorth: "ಇಂದು ಸಾಕಷ್ಟು ಸಮಯವಿಲ್ಲ.",
    likely: "ಸಂಭಾವ್ಯ", likelyNote: "SST ಮತ್ತು ಕ್ಲೋರೊಫಿಲ್ ಆಧಾರಿತ — ಖಾತರಿ ಇಲ್ಲ",
    returnBy: "ಮರಳಬೇಕಾದ ಸಮಯ", returnWhy: "ಅಲೆಗಳು", econ: "ಪ್ರವಾಸದ ಅರ್ಥಶಾಸ್ತ್ರ",
    fuel: "ಇಂಧನ", catch: "ಮೀನು", revenue: "ಆದಾಯ", profit: "ಲಾಭ",
    econNote: "ಯೋಜನಾ ಅಂದಾಜು — ಖಾತರಿ ಇಲ್ಲ.", barsCaption: "ಅಂಶಗಳು: ಕ್ಲೋರೊಫಿಲ್ · SST · ಮುಂಭಾಗ · ಸಮುದ್ರ · ಸಮಯ",
    pfzTitle: "PFZ ಬುದ್ಧಿಮತ್ತೆ", pfzSub: "ಸಂಭಾವ್ಯ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು",
    noNearby: "ಇದರ ಒಳಗೆ INCOIS PFZ ಸಲಹೆ ಇಲ್ಲ",
    nearestIs: "ಹತ್ತಿರದ INCOIS PFZ ಸಲಹೆಯು ಸುಮಾರು",
    kmAway: "ಕಿಮೀ ದೂರದಲ್ಲಿದೆ.",
    atLandWarning: "ನೀವು ಪ್ರಸ್ತುತ ಭೂಮಿಯಲ್ಲಿದ್ದೀರಿ, ದಯವಿಟ್ಟು ಬಂದರನ್ನು ಆಯ್ಕೆಮಾಡಿ ಅಥವಾ ದೋಣಿ ಐಕಾನ್ ಅನ್ನು ಬೇರೆ ಸ್ಥಳಕ್ಕೆ ಎಳೆಯಿರಿ."
  },
};

const FACTOR_ORDER: { key: string; label: string }[] = [
  { key: "chlorophyll", label: "Chl" },
  { key: "sst", label: "SST" },
  { key: "front", label: "Front" },
  { key: "sea_state", label: "Sea" },
  { key: "time_of_day", label: "Time" },
];

function clock12(h: number): string {
  const hh = h % 24;
  return `${hh % 12 || 12}${hh < 12 ? "AM" : "PM"}`;
}

function dayName(offset: number, t: Record<string, string>): string {
  return offset === 0 ? t.today : offset === 1 ? t.tomorrow : t.dayAfter;
}

// ---- Shared styles ----
const SEC_LABEL: React.CSSProperties = {
  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
  fontSize: 8.5,
  fontWeight: 800,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  marginBottom: 8,
};

export default function FishingPanel({
  data,
  language = "en",
  isPortSelected = false,
  onSelectArea,
}: {
  data: FishingOutlook;
  language?: Language;
  isPortSelected?: boolean;
  onSelectArea?: (rank: number) => void;
}) {
  const t = T[language] ?? T.en;
  const words = RATING_WORD[language] ?? RATING_WORD.en;
  const top = data.areas.slice(0, 3);
  const showLandWarning = data.location.is_on_land && !isPortSelected;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ---- ADVICE ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd">
          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
            {t.advice}
          </div>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!(showLandWarning && data.location.distance_from_shore_km > 100) && (
            data.advice.map((line, i) =>
              i === 0 ? (
                <p key={i} style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 16, fontWeight: 700, color: "var(--text-bright)", lineHeight: 1.4 }}>
                  {line}
                </p>
              ) : (
                <p key={i} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.6, color: "var(--text-mid)" }}>
                  <span style={{ marginTop: 6, width: 5, height: 5, flexShrink: 0, background: "var(--ocean)", transform: "rotate(45deg)", display: "inline-block" }} />
                  <span>{line}</span>
                </p>
              )
            )
          )}
          {showLandWarning && (
            <div style={{ marginTop: data.location.distance_from_shore_km > 100 ? 0 : 8, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, display: "flex", gap: 8, alignItems: "center", color: "var(--risk-high)" }}>
              <div style={{ flexShrink: 0, display: "flex" }}>
                <WarnGlyph size={14} />
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.4, color: "var(--risk-high)", fontWeight: 500, margin: 0 }}>
                {t.atLandWarning}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- PFZ ZONES ---- */}
      {data.pfz_status === "AVAILABLE" && top.length > 0 && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
                {t.pfzTitle}
              </div>
              <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", marginTop: 1 }}>
                {t.pfzSub}
              </div>
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ocean-dim)" }}>
              <SchoolGlyph size={22} />
              <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
                {data.radius_km}km
              </span>
            </span>
          </div>

          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {top.map((a) => {
              const rCol = RATING_COLOR[a.rating];
              return (
                <button
                  key={a.id}
                  onClick={() => onSelectArea?.(a.rank)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--surface-2)",
                    border: `1px solid ${rCol}30`,
                    borderRadius: 2,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.18s",
                    width: "100%",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${rCol}70`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = `0 4px 16px ${rCol}15`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${rCol}30`;
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Rank badge */}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: `2.5px solid ${rCol}`,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 17,
                    fontWeight: 900,
                    color: rCol,
                    flexShrink: 0,
                    background: `${rCol}10`,
                  }}>
                    {a.rank}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>
                        {Math.round(a.distance_km)} km {t.away}
                      </span>
                      {a.recommended && (
                        <span style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 7,
                          fontWeight: 800,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          border: `1px solid ${rCol}60`,
                          color: rCol,
                        }}>
                          {language === "kn" ? "ಅತ್ಯುತ್ತಮ" : language === "hi" ? "सुझाया" : "Best"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>
                      {words[a.rating]} · {t.chance}
                    </div>
                    {/* Factor bars */}
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {FACTOR_ORDER.map((f) => {
                        const v = a.factors?.[f.key];
                        if (v == null) return null;
                        return (
                          <span key={f.key} title={`${f.label}: ${Math.round(v * 100)}%`} style={{ display: "inline-block", height: 3, width: 22, overflow: "hidden", background: "var(--surface-3)", borderRadius: 1 }}>
                            <span className="grow-x" style={{ display: "block", height: "100%", width: `${Math.round(v * 100)}%`, background: rCol, opacity: 0.8 }} />
                          </span>
                        );
                      })}
                    </div>
                    {/* Species */}
                    {(a.likely_species?.length ?? 0) > 0 && (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--ocean-dim)" }}>
                        <FishGlyph size={11} className="swim" />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.likely_species!.map(s => s.split(" (")[0]).join(" · ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Probability */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 22, fontWeight: 900, color: rCol, lineHeight: 1 }}>
                      {a.probability}
                      <span style={{ fontSize: 12, fontWeight: 500 }}>%</span>
                    </div>
                    <div style={{ marginTop: 4, height: 3, width: 60, overflow: "hidden", background: "var(--surface-3)", borderRadius: 1 }}>
                      <div className="grow-x" style={{ height: "100%", width: `${a.probability}%`, background: rCol }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Best window */}
          {data.best_window && (
            <div style={{
              borderTop: "1px solid var(--border)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(34,197,94,0.04)",
            }}>
              <div style={{ flex: 1 }}>
                <div style={SEC_LABEL as React.CSSProperties}>{t.bestTime}</div>
                <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 16, fontWeight: 800, color: "var(--risk-low)" }}>
                  {clock12(data.best_window.from_hour)} – {clock12(data.best_window.to_hour)}
                </div>
              </div>
            </div>
          )}

          <p style={{ padding: "6px 14px 8px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-faint)" }}>
            {t.barsCaption}
          </p>
        </div>
      )}

      {/* ---- PFZ ZONES (NO NEARBY) ---- */}
      {data.pfz_status === "NO_NEARBY_PFZ" && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
                {t.pfzTitle}
              </div>
              <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", marginTop: 1 }}>
                {t.pfzSub}
              </div>
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ocean-dim)" }}>
              <SchoolGlyph size={22} />
            </span>
          </div>

          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)" }}>
              {language === "en" 
                ? `No INCOIS PFZ advisory within ${data.radius_km} km of your location.` 
                : `${data.radius_km} ${t.noNearby}.`}
            </p>
            {data.total_available > 0 && data.nearest_distance_km != null && (
              <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
                {t.nearestIs} {Math.round(data.nearest_distance_km)} {t.kmAway}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---- TRIP PLAN ---- */}
      {data.duration && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
              {t.trip}
            </div>
          </div>
          {data.duration.feasible ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                {[
                  { k: t.stay, v: `${data.duration.recommended_hours}`, u: t.hours, hero: true },
                  { k: t.travel, v: `${data.duration.travel_each_way_minutes}`, u: t.min, hero: false },
                  { k: t.total, v: `${data.duration.total_trip_hours}`, u: t.hours, hero: false },
                ].map((x, i) => (
                  <div key={x.k} style={{
                    padding: "12px 14px",
                    borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                    background: x.hero ? "rgba(34,197,94,0.05)" : "transparent",
                  }}>
                    <div style={SEC_LABEL as React.CSSProperties}>{x.k}</div>
                    <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 20, fontWeight: 800, color: x.hero ? "var(--risk-low)" : "var(--text-bright)", lineHeight: 1 }}>
                      {x.v}
                      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)", marginLeft: 3 }}>{x.u}</span>
                    </div>
                  </div>
                ))}
              </div>
              {data.duration.return_by && (
                <div style={{
                  borderTop: "1px solid rgba(239,68,68,0.25)",
                  padding: "10px 14px",
                  background: "rgba(239,68,68,0.05)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--risk-ext)" }}>
                    {t.returnBy}
                  </span>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 18, fontWeight: 900, color: "var(--risk-ext)" }}>
                    {data.duration.return_by}
                  </span>
                  {data.duration.return_reason_wave_m != null && (
                    <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, color: "var(--text-dim)" }}>
                      — {t.returnWhy} {data.duration.return_reason_wave_m}m
                    </span>
                  )}
                </div>
              )}
              {data.duration.limited_by_weather && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--risk-high)" }}>
                  <WarnGlyph size={12} />
                  {language === "kn" ? "ಹವಾಮಾನದಿಂದ ಸಮಯ ಕಡಿಮೆ — ಬೇಗ ಹಿಂದಿರುಗಿ." : language === "hi" ? "मौसम के कारण समय कम — जल्दी लौटें।" : "Weather shortens your window — return earlier."}
                </div>
              )}
            </>
          ) : (
            <p style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "var(--risk-high)" }}>{t.notWorth}</p>
          )}
        </div>
      )}

      {/* ---- ECONOMICS ---- */}
      {data.economics && data.duration?.feasible && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
              {t.econ}
            </div>
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
              {t.econNote}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {[
              { k: t.fuel, v: `₹${data.economics.fuel_cost_inr.toLocaleString("en-IN")}`, s: `${data.economics.fuel_litres}L`, hero: false },
              { k: t.catch, v: `${data.economics.catch_kg_low}–${data.economics.catch_kg_high}`, s: "kg", hero: false },
              { k: t.revenue, v: `₹${data.economics.revenue_inr.toLocaleString("en-IN")}`, s: "", hero: false },
              { k: t.profit, v: `₹${data.economics.profit_inr.toLocaleString("en-IN")}`, s: "", hero: true },
            ].map((x, i) => (
              <div key={x.k} style={{
                padding: "11px 14px",
                borderLeft: i % 2 === 1 ? "1px solid var(--border)" : "none",
                borderTop: i >= 2 ? "1px solid var(--border)" : "none",
                background: x.hero ? "rgba(34,197,94,0.05)" : "transparent",
              }}>
                <div style={SEC_LABEL as React.CSSProperties}>{x.k}</div>
                <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 16, fontWeight: 700, color: x.hero ? "var(--risk-low)" : "var(--text-bright)", lineHeight: 1 }}>
                  {x.v}
                  {x.s && <span style={{ fontSize: 9, fontWeight: 500, color: "var(--text-dim)", marginLeft: 3 }}>{x.s}</span>}
                </div>
              </div>
            ))}
          </div>
          <p style={{ borderTop: "1px solid var(--border)", padding: "6px 14px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-faint)" }}>
            {data.economics.assumptions}
          </p>
        </div>
      )}

      {/* ---- AVOID ZONES ---- */}
      {data.avoid.length > 0 && (
        <div className="m-panel overflow-hidden" style={{ borderColor: "rgba(239,68,68,0.4)", backgroundImage: "repeating-linear-gradient(45deg, rgba(239,68,68,0.03) 0 1.5px, transparent 1.5px 8px)" }}>
          <div className="m-hd" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--risk-ext)" }}>
              <WarnGlyph size={12} />
              {t.avoid}
            </div>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {data.avoid.map((z) => (
              <div key={z.name} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <svg width="12" height="12" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden>
                  <rect x="0.5" y="0.5" width="11" height="11" fill="url(#hatch-critical)" stroke="#EF4444" strokeWidth="1" />
                </svg>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>{z.name}</div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                    {Math.round(z.distance_km)} km {t.away} ·{" "}
                    {z.window ? (
                      <span style={{ color: z.active_now ? "var(--risk-ext)" : "var(--text-dim)", fontWeight: z.active_now ? 700 : 400 }}>
                        {t.closedBetween} {z.window}{z.active_now ? ` (${t.closedNow})` : ""}
                      </span>
                    ) : t.always}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- 3-DAY FORECAST ---- */}
      {data.forecast.length > 1 && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
              {t.forecast}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.forecast.length, 3)}, 1fr)` }}>
            {data.forecast.slice(0, 3).map((f, i) => {
              const fCol = RATING_COLOR[f.rating];
              return (
                <div key={f.day_offset} style={{
                  padding: "12px 10px",
                  textAlign: "center",
                  borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                  background: f.day_offset === 0 ? "rgba(0,168,204,0.04)" : "transparent",
                }}>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>
                    {dayName(f.day_offset, t)}
                  </div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 24, fontWeight: 900, color: fCol, lineHeight: 1 }}>
                    {f.probability}<span style={{ fontSize: 12 }}>%</span>
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>
                    {t.bestAt} {clock12(f.best_hour)}
                  </div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-faint)", marginTop: 2 }}>
                    {f.wave_height_m}m
                  </div>
                  {f.official_warning && (
                    <div style={{
                      marginTop: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      border: "1px solid rgba(239,68,68,0.5)",
                      padding: "1px 5px",
                      color: "var(--risk-ext)",
                    }}>
                      <WarnGlyph size={9} />
                      <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 7, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>⚠</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ borderTop: "1px solid var(--border)", padding: "6px 14px 8px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-faint)" }}>
            {data.method}
          </p>
        </div>
      )}
    </div>
  );
}
