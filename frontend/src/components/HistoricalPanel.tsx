/**
 * HistoricalPanel — Historical Marine Intelligence workspace.
 *
 * Displays how marine conditions (CHL, SST, current speed, weather) have
 * changed over a selected time period at a given location.
 *
 * Data flows:
 *   GET /api/historical → analyze_historical_data() → full daily timeseries
 *
 * Design principles:
 * - One request per (location + period) — variables are switched locally.
 * - Timeseries values come exclusively from the backend. Nothing is fabricated.
 * - Trend labels come from backend statistics. The frontend does NOT re-derive them.
 * - Weather is aggregate stats only (backend does not expose daily precipitation series).
 * - "Ask ORCA about this" prefills the Ask ORCA tab — no second LLM call here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import * as api from "../api";
import LocationPicker, { PORTS, type PickedLocation } from "./LocationPicker";
import type {
  HistoricalDays,
  HistoricalResponse,
  HistoricalVariable_ID,
  Language,
} from "../types";

// ── Localisation ──────────────────────────────────────────────────────────────

const LABELS: Record<Language, Record<string, string>> = {
  en: {
    title: "Historical Marine Intelligence",
    subtitle: "Analyse how marine conditions changed over time.",
    period: "Period",
    variable: "Variable",
    days7: "7 Days",
    days30: "30 Days",
    days90: "90 Days",
    chlorophyll: "Chlorophyll",
    sst: "Sea Surface Temperature",
    current_speed: "Current Speed",
    weather: "Rainfall / Weather",
    loading: "Loading historical marine data…",
    error: "Unable to load historical marine data.",
    noLocation: "Select a location to view historical data.",
    unavailable: "No historical data available for this period.",
    partial: "Only {{n}} of {{d}} days available",
    fullCoverage: "{{n}} of {{d}} days available",
    trendSummary: "Trend Summary",
    trend: "Trend",
    first: "First",
    latest: "Latest",
    change: "Change",
    mean: "Mean",
    increasing: "↑ Increasing",
    decreasing: "↓ Decreasing",
    stable: "→ Stable",
    insufficient_data: "— Insufficient data",
    coverage: "Data Coverage",
    sources: "Sources",
    orcaAnalysis: "ORCA Analysis",
    askOrca: "Ask ORCA about this →",
    weatherSummary: "Weather Summary",
    totalRainfall: "Total rainfall",
    rainyDays: "Rainy days",
    meanWind: "Mean wind",
    maxWind: "Max wind",
    meanTemp: "Mean temperature",
    noObs: "No observations available for this location and period.",
    switchingVar: "Select a variable above to view the time-series chart.",
    provenance: "Copernicus Marine (CHL), Open-Meteo Marine (SST, Currents), Open-Meteo Historical (Weather)",
  },
  hi: {
    title: "ऐतिहासिक समुद्री जानकारी",
    subtitle: "समय के साथ समुद्री परिस्थितियाँ कैसे बदलीं।",
    period: "अवधि",
    variable: "चर",
    days7: "7 दिन",
    days30: "30 दिन",
    days90: "90 दिन",
    chlorophyll: "क्लोरोफिल",
    sst: "सतह जल तापमान",
    current_speed: "धारा गति",
    weather: "वर्षा / मौसम",
    loading: "ऐतिहासिक समुद्री डेटा लोड हो रहा है…",
    error: "ऐतिहासिक समुद्री डेटा लोड नहीं हो सका।",
    noLocation: "ऐतिहासिक डेटा देखने के लिए स्थान चुनें।",
    unavailable: "इस अवधि के लिए कोई ऐतिहासिक डेटा उपलब्ध नहीं।",
    partial: "केवल {{n}} / {{d}} दिन उपलब्ध",
    fullCoverage: "{{n}} / {{d}} दिन उपलब्ध",
    trendSummary: "प्रवृत्ति सारांश",
    trend: "प्रवृत्ति",
    first: "प्रथम",
    latest: "नवीनतम",
    change: "परिवर्तन",
    mean: "औसत",
    increasing: "↑ बढ़ रहा है",
    decreasing: "↓ घट रहा है",
    stable: "→ स्थिर",
    insufficient_data: "— अपर्याप्त डेटा",
    coverage: "डेटा कवरेज",
    sources: "स्रोत",
    orcaAnalysis: "ORCA विश्लेषण",
    askOrca: "इस बारे में ORCA से पूछें →",
    weatherSummary: "मौसम सारांश",
    totalRainfall: "कुल वर्षा",
    rainyDays: "वर्षा के दिन",
    meanWind: "औसत हवा",
    maxWind: "अधिकतम हवा",
    meanTemp: "औसत तापमान",
    noObs: "इस स्थान और अवधि के लिए कोई अवलोकन नहीं।",
    switchingVar: "टाइम-सीरीज़ देखने के लिए ऊपर एक चर चुनें।",
    provenance: "Copernicus Marine (CHL), Open-Meteo Marine (SST, धाराएँ), Open-Meteo ऐतिहासिक (मौसम)",
  },
  kn: {
    title: "ಐತಿಹಾಸಿಕ ಸಮುದ್ರ ಮಾಹಿತಿ",
    subtitle: "ಕಾಲಾನಂತರದಲ್ಲಿ ಸಮುದ್ರ ಪರಿಸ್ಥಿತಿಗಳು ಹೇಗೆ ಬದಲಾದವು.",
    period: "ಅವಧಿ",
    variable: "ಅಸ್ಥಿರ",
    days7: "7 ದಿನ",
    days30: "30 ದಿನ",
    days90: "90 ದಿನ",
    chlorophyll: "ಕ್ಲೋರೋಫಿಲ್",
    sst: "ಸಮುದ್ರ ಮೇಲ್ಮೈ ತಾಪಮಾನ",
    current_speed: "ಸಮುದ್ರ ಪ್ರವಾಹ ವೇಗ",
    weather: "ಮಳೆ / ಹವಾಮಾನ",
    loading: "ಐತಿಹಾಸಿಕ ಸಮುದ್ರ ಡೇಟಾ ಲೋಡ್ ಆಗುತ್ತಿದೆ…",
    error: "ಐತಿಹಾಸಿಕ ಸಮುದ್ರ ಡೇಟಾ ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.",
    noLocation: "ಐತಿಹಾಸಿಕ ಡೇಟಾ ವೀಕ್ಷಿಸಲು ಸ್ಥಳ ಆಯ್ಕೆಮಾಡಿ.",
    unavailable: "ಈ ಅವಧಿಗೆ ಯಾವುದೇ ಐತಿಹಾಸಿಕ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ.",
    partial: "ಕೇವಲ {{n}} / {{d}} ದಿನ ಲಭ್ಯ",
    fullCoverage: "{{n}} / {{d}} ದಿನ ಲಭ್ಯ",
    trendSummary: "ಪ್ರವೃತ್ತಿ ಸಾರಾಂಶ",
    trend: "ಪ್ರವೃತ್ತಿ",
    first: "ಮೊದಲ",
    latest: "ಇತ್ತೀಚಿನ",
    change: "ಬದಲಾವಣೆ",
    mean: "ಸರಾಸರಿ",
    increasing: "↑ ಹೆಚ್ಚಾಗುತ್ತಿದೆ",
    decreasing: "↓ ಕಡಿಮೆಯಾಗುತ್ತಿದೆ",
    stable: "→ ಸ್ಥಿರ",
    insufficient_data: "— ಅಸಮರ್ಪಕ ಡೇಟಾ",
    coverage: "ಡೇಟಾ ಕವರೇಜ್",
    sources: "ಮೂಲಗಳು",
    orcaAnalysis: "ORCA ವಿಶ್ಲೇಷಣೆ",
    askOrca: "ಇದರ ಬಗ್ಗೆ ORCA ಅನ್ನು ಕೇಳಿ →",
    weatherSummary: "ಹವಾಮಾನ ಸಾರಾಂಶ",
    totalRainfall: "ಒಟ್ಟು ಮಳೆ",
    rainyDays: "ಮಳೆ ದಿನಗಳು",
    meanWind: "ಸರಾಸರಿ ಗಾಳಿ",
    maxWind: "ಗರಿಷ್ಠ ಗಾಳಿ",
    meanTemp: "ಸರಾಸರಿ ತಾಪಮಾನ",
    noObs: "ಈ ಸ್ಥಳ ಮತ್ತು ಅವಧಿಗೆ ಯಾವುದೇ ಅವಲೋಕನಗಳಿಲ್ಲ.",
    switchingVar: "ಟೈಮ್-ಸೀರೀಸ್ ನೋಡಲು ಮೇಲಿನ ಅಸ್ಥಿರವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    provenance: "Copernicus Marine (CHL), Open-Meteo Marine (SST, ಪ್ರವಾಹ), Open-Meteo ಐತಿಹಾಸಿಕ (ಹವಾಮಾನ)",
  },
};

// ── Variable metadata ─────────────────────────────────────────────────────────

const VAR_META: Record<
  HistoricalVariable_ID,
  { unit: string; provider: string; color: string; decimals: number }
> = {
  chlorophyll: {
    unit: "mg/m³",
    provider: "Copernicus Marine",
    color: "#22C55E",
    decimals: 2,
  },
  sst: {
    unit: "°C",
    provider: "Open-Meteo Marine",
    color: "#00A8CC",
    decimals: 2,
  },
  current_speed: {
    unit: "m/s",
    provider: "Open-Meteo Marine",
    color: "#F59E0B",
    decimals: 3,
  },
  weather: {
    unit: "mm",
    provider: "Open-Meteo Historical",
    color: "#818CF8",
    decimals: 1,
  },
};

// ── Helper formatters ─────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  // "2026-08-21" → "Aug 21"
  try {
    return new Date(iso + "T12:00:00Z").toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function fmtValue(v: number, decimals: number): string {
  return v.toFixed(decimals);
}

function coverageMsg(
  observed: number,
  requested: number,
  l: Record<string, string>,
): string {
  const template =
    observed < requested ? l.partial : l.fullCoverage;
  return template
    .replace("{{n}}", String(observed))
    .replace("{{d}}", String(requested));
}

// ── Trend colour ──────────────────────────────────────────────────────────────

function trendColor(
  trend: string,
): string {
  if (trend === "increasing") return "var(--risk-low)";
  if (trend === "decreasing") return "var(--risk-high)";
  return "var(--text-mid)";
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  decimals,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
  decimals: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--surface-3)",
        border: "1px solid var(--border-mid)",
        padding: "8px 12px",
        borderRadius: 4,
        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
        fontSize: 12,
      }}
    >
      <div style={{ color: "var(--text-faint)", fontSize: 10, marginBottom: 2 }}>
        {label ? fmtDate(label) : ""}
      </div>
      <div style={{ color: "var(--text-bright)", fontWeight: 700 }}>
        {fmtValue(payload[0].value, decimals)} {unit}
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  place: PickedLocation | null;
  language: Language;
  onPlacePick: (p: PickedLocation) => void;
  /** Called when user clicks "Ask ORCA about this" */
  onAskOrca: (query: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistoricalPanel({
  place,
  language,
  onPlacePick,
  onAskOrca,
}: Props) {
  const l = LABELS[language] ?? LABELS.en;

  const [days, setDays] = useState<HistoricalDays>(30);
  const [variable, setVariable] = useState<HistoricalVariable_ID>("chlorophyll");
  const [data, setData] = useState<HistoricalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache: (lat,lon,days) → HistoricalResponse
  const cache = useRef<Map<string, HistoricalResponse>>(new Map());

  const cacheKey = useCallback(
    (lat: number, lon: number, d: HistoricalDays) =>
      `${lat.toFixed(4)},${lon.toFixed(4)},${d}`,
    [],
  );

  // Fetch whenever location or period changes.
  // Variables are switched locally — no re-fetch needed.
  useEffect(() => {
    if (!place) {
      setData(null);
      return;
    }
    const key = cacheKey(place.latitude, place.longitude, days);
    const cached = cache.current.get(key);
    if (cached) {
      setData(cached);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);

    api
      .getHistoricalAnalysis(place.latitude, place.longitude, days)
      .then((res) => {
        if (!alive) return;
        cache.current.set(key, res);
        setData(res);
      })
      .catch(() => {
        if (alive) setError(l.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.latitude, place?.longitude, days]);

  // ── Derived values from backend response ─────────────────────────────────

  const varData = useMemo(() => {
    if (!data) return null;
    if (variable === "weather") return null; // weather uses aggregate panel
    return data.variables[variable] ?? null;
  }, [data, variable]);

  const weatherData = useMemo(
    () => (variable === "weather" ? (data?.variables?.weather ?? null) : null),
    [data, variable],
  );

  const availability = data?.availability?.[variable];
  const isAvailable = availability?.status === "AVAILABLE";

  // Build chart data from backend parallel arrays — no interpolation
  const chartPoints = useMemo(() => {
    if (!varData?.timeseries) return [];
    const { dates, values } = varData.timeseries;
    return dates.map((d, i) => ({ date: d, value: values[i] }));
  }, [varData]);

  const stats = varData?.statistics;
  const meta = VAR_META[variable];

  // Coverage
  const requestedDays = days;
  const observedDays = stats?.observation_count ?? 0;

  // Provenance rows
  const provenance = data?.provenance ?? [];

  // ── Ask ORCA context builder ──────────────────────────────────────────────

  const handleAskOrca = () => {
    const loc = data?.location?.name ?? place?.label ?? "this location";
    const varLabel = l[variable] ?? variable;
    const query = `Why might ${varLabel.toLowerCase()} have changed near ${loc} over the last ${days} days?`;
    onAskOrca(query);
  };

  // ── Section header ────────────────────────────────────────────────────────

  const SectionHeader = ({ label }: { label: string }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--ocean)",
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );

  // ── Stat card ────────────────────────────────────────────────────────────

  const StatCard = ({
    label,
    value,
    sub,
    color,
  }: {
    label: string;
    value: string;
    sub?: string;
    color?: string;
  }) => (
    <div
      style={{
        flex: 1,
        minWidth: 100,
        padding: "10px 14px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
          fontSize: 8,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Fraunces Variable', Georgia, serif",
          fontSize: 20,
          fontWeight: 800,
          color: color ?? "var(--text-bright)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            color: "var(--text-dim)",
            marginTop: 3,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "20px 24px",
        gap: 24,
        maxWidth: 1100,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Page title */}
      <div>
        <div
          style={{
            fontFamily: "'Fraunces Variable', Georgia, serif",
            fontSize: 26,
            fontWeight: 900,
            color: "var(--ocean-bright)",
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {l.title}
        </div>
        <div
          style={{
            marginTop: 5,
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 11,
            color: "var(--text-dim)",
            letterSpacing: "0.06em",
          }}
        >
          {l.subtitle}
        </div>
      </div>

      {/* Controls: Location + Period + Variable */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        {/* Location picker — reuses existing ORCA component */}
        <div style={{ minWidth: 220, flex: "1 1 220px" }}>
          <LocationPicker current={place} language={language} onPick={onPlacePick} />
        </div>

        {/* Period */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 8,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            {l.period}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {([7, 30, 90] as HistoricalDays[]).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: days === d ? "var(--ocean)" : "var(--border)",
                  background:
                    days === d ? "rgba(0,168,204,0.15)" : "transparent",
                  color: days === d ? "var(--ocean)" : "var(--text-dim)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {l[`days${d}` as "days7" | "days30" | "days90"]}
              </button>
            ))}
          </div>
        </div>

        {/* Variable */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 8,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            {l.variable}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(
              [
                "chlorophyll",
                "sst",
                "current_speed",
                "weather",
              ] as HistoricalVariable_ID[]
            ).map((v) => (
              <button
                key={v}
                onClick={() => setVariable(v)}
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "6px 14px",
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: variable === v ? VAR_META[v].color : "var(--border)",
                  background:
                    variable === v
                      ? `${VAR_META[v].color}22`
                      : "transparent",
                  color: variable === v ? VAR_META[v].color : "var(--text-dim)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {l[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading / Error / No-location states ── */}
      {!place && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            color: "var(--text-dim)",
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 13,
            border: "1px dashed var(--border)",
            borderRadius: 6,
          }}
        >
          {l.noLocation}
        </div>
      )}

      {place && loading && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            color: "var(--ocean)",
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 13,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        >
          {l.loading}
        </div>
      )}

      {place && !loading && error && (
        <div
          style={{
            padding: "24px 20px",
            color: "var(--risk-ext)",
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 13,
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 6,
            background: "rgba(239,68,68,0.06)",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Main content (data loaded) ── */}
      {place && !loading && !error && data && (
        <>
          {/* ── Time-series chart or weather panel ── */}
          <div
            className="m-panel"
            style={{ padding: "20px 20px 16px", overflow: "hidden" }}
          >
            {variable === "weather" ? (
              /* ── Weather aggregate panel ── */
              <>
                <SectionHeader label={l.weatherSummary} />
                {!weatherData ? (
                  <div
                    style={{
                      color: "var(--text-dim)",
                      fontFamily:
                        "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 12,
                      padding: "20px 0",
                    }}
                  >
                    {l.unavailable}
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(160px, 1fr))",
                      gap: 12,
                      marginTop: 8,
                    }}
                  >
                    <StatCard
                      label={l.totalRainfall}
                      value={`${weatherData.statistics.total_precipitation.toFixed(1)} mm`}
                    />
                    <StatCard
                      label={l.rainyDays}
                      value={`${weatherData.statistics.rainy_day_count}`}
                      sub={`/ ${days} days`}
                    />
                    <StatCard
                      label={l.meanWind}
                      value={`${weatherData.statistics.mean_wind_speed.toFixed(1)} km/h`}
                    />
                    <StatCard
                      label={l.maxWind}
                      value={`${weatherData.statistics.max_wind_speed.toFixed(1)} km/h`}
                    />
                    <StatCard
                      label={l.meanTemp}
                      value={`${weatherData.statistics.mean_temperature.toFixed(1)} °C`}
                    />
                  </div>
                )}
              </>
            ) : !isAvailable ? (
              /* ── Variable unavailable ── */
              <>
                <SectionHeader label={l[variable]} />
                <div
                  style={{
                    color: "var(--text-dim)",
                    fontFamily:
                      "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 12,
                    padding: "20px 0",
                    lineHeight: 1.7,
                  }}
                >
                  {availability?.reason ?? l.unavailable}
                </div>
              </>
            ) : chartPoints.length === 0 ? (
              /* ── Empty series ── */
              <>
                <SectionHeader label={l[variable]} />
                <div
                  style={{
                    color: "var(--text-dim)",
                    fontFamily:
                      "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 12,
                    padding: "20px 0",
                  }}
                >
                  {l.noObs}
                </div>
              </>
            ) : (
              /* ── Line chart ── */
              <>
                <SectionHeader
                  label={`${l[variable]} — ${meta.unit} — ${meta.provider}`}
                />
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={chartPoints}
                    margin={{ top: 4, right: 8, left: 4, bottom: 8 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,168,204,0.1)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{
                        fontFamily:
                          "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 10,
                        fill: "var(--text-faint)",
                      }}
                      axisLine={{ stroke: "var(--border)" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{
                        fontFamily:
                          "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 10,
                        fill: "var(--text-faint)",
                      }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        fmtValue(v, meta.decimals)
                      }
                      width={52}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          unit={meta.unit}
                          decimals={meta.decimals}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={meta.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: meta.color, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* ── Trend summary (only for CHL/SST/current) ── */}
          {variable !== "weather" && stats && isAvailable && (
            <div className="m-panel" style={{ padding: "20px 20px 16px" }}>
              <SectionHeader label={l.trendSummary} />
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "stretch",
                }}
              >
                {/* Trend arrow */}
                <StatCard
                  label={l.trend}
                  value={l[stats.trend] ?? stats.trend}
                  color={trendColor(stats.trend)}
                />
                <StatCard
                  label={l.first}
                  value={`${fmtValue(stats.first, meta.decimals)} ${meta.unit}`}
                />
                <StatCard
                  label={l.latest}
                  value={`${fmtValue(stats.last, meta.decimals)} ${meta.unit}`}
                />
                <StatCard
                  label={l.change}
                  value={`${stats.change >= 0 ? "+" : ""}${stats.change_percent.toFixed(2)}%`}
                  color={
                    stats.change >= 0
                      ? "var(--risk-low)"
                      : "var(--risk-high)"
                  }
                />
                <StatCard
                  label={l.mean}
                  value={`${fmtValue(stats.mean, meta.decimals)} ${meta.unit}`}
                />
              </div>
            </div>
          )}

          {/* ── ORCA Analysis / Ask ORCA button ── */}
          <div className="m-panel" style={{ padding: "20px 20px 16px" }}>
            <SectionHeader label={l.orcaAnalysis} />
            <p
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--text-mid)",
                margin: "0 0 16px",
              }}
            >
              {variable !== "weather" && stats && isAvailable ? (
                <>
                  {l[variable]} {stats.trend === "increasing"
                    ? "increased"
                    : stats.trend === "decreasing"
                      ? "decreased"
                      : "remained broadly stable"}{" "}
                  from{" "}
                  <strong style={{ color: "var(--text-bright)" }}>
                    {fmtValue(stats.first, meta.decimals)} {meta.unit}
                  </strong>{" "}
                  to{" "}
                  <strong style={{ color: "var(--text-bright)" }}>
                    {fmtValue(stats.last, meta.decimals)} {meta.unit}
                  </strong>{" "}
                  over the last {days} days ({" "}
                  <span
                    style={{ color: trendColor(stats.trend), fontWeight: 600 }}
                  >
                    {stats.change_percent >= 0 ? "+" : ""}
                    {stats.change_percent.toFixed(1)}%
                  </span>
                  ). These figures come directly from{" "}
                  <span style={{ color: "var(--ocean)" }}>{meta.provider}</span>
                  . The available historical data does not independently
                  establish causation — concurrent environmental changes may
                  have contributed.
                </>
              ) : (
                <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>
                  {availability?.reason ?? l.unavailable}
                </span>
              )}
            </p>
            <button
              onClick={handleAskOrca}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                background: "rgba(0,168,204,0.12)",
                border: "1px solid var(--ocean)",
                borderRadius: 4,
                color: "var(--ocean)",
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(0,168,204,0.22)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(0,168,204,0.12)")
              }
            >
              {l.askOrca}
            </button>
          </div>

          {/* ── Coverage + Sources ── */}
          <div className="m-panel" style={{ padding: "20px 20px 16px" }}>
            <SectionHeader label={`${l.coverage} · ${l.sources}`} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              {/* Coverage */}
              <div>
                <div
                  style={{
                    fontFamily:
                      "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 8,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    marginBottom: 8,
                  }}
                >
                  {l.coverage}
                </div>
                {Object.entries(data.availability).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 5,
                      fontFamily:
                        "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background:
                          v.status === "AVAILABLE"
                            ? "var(--risk-low)"
                            : "var(--risk-mod)",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: "var(--text-mid)" }}>
                      {l[k as HistoricalVariable_ID] ?? k}
                    </span>
                    <span style={{ color: "var(--text-faint)" }}>
                      {v.status === "AVAILABLE"
                        ? k !== "weather"
                          ? coverageMsg(
                              (data.variables[k as "chlorophyll" | "sst" | "current_speed"]
                                ?.statistics?.observation_count) ?? observedDays,
                              requestedDays,
                              l,
                            )
                          : "available"
                        : v.reason ?? "unavailable"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Provenance */}
              <div>
                <div
                  style={{
                    fontFamily:
                      "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 8,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--text-faint)",
                    marginBottom: 8,
                  }}
                >
                  {l.sources}
                </div>
                {provenance.length === 0 ? (
                  <div
                    style={{
                      color: "var(--text-dim)",
                      fontFamily:
                        "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 11,
                    }}
                  >
                    {l.unavailable}
                  </div>
                ) : (
                  provenance.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 5,
                        fontFamily:
                          "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 11,
                        color: "var(--text-mid)",
                      }}
                    >
                      <span style={{ color: "var(--ocean)", fontSize: 9 }}>
                        ●
                      </span>
                      <span style={{ color: "var(--text-bright)" }}>
                        {l[p.variable as HistoricalVariable_ID] ?? p.variable}
                      </span>
                      <span style={{ color: "var(--text-faint)" }}>
                        — {p.provider}
                        {p.actual_coverage_start
                          ? ` · ${fmtDate(p.actual_coverage_start)} – ${fmtDate(p.actual_coverage_end ?? "")}`
                          : ""}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
