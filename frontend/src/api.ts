import type {
  AuthorityDashboard,
  ChatResponse,
  EmergencyRoute,
  FishingOutlook,
  HistoricalDays,
  HistoricalResponse,
  Language,
  IntentMode,
  PositionCheck,
  RiskCategory,
  RouteOption,
  SosResponse,
  ZoneFeature,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function ask(params: {
  message: string;
  language?: Language;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  sessionId?: string;
  mode?: IntentMode;
}): Promise<ChatResponse> {
  return json<ChatResponse>(`${BASE}/chat`, {
    method: "POST",
    body: JSON.stringify({
      message: params.message,
      mode: params.mode ?? "OFFLINE",
      language: params.language ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      location_name: params.locationName ?? null,
      session_id: params.sessionId ?? "demo",
    }),
  });
}

export function resetSession(sessionId = "demo") {
  return json(`${BASE}/chat/reset?session_id=${encodeURIComponent(sessionId)}`, {
    method: "POST",
  });
}

export function zones(): Promise<{ features: ZoneFeature[]; note: string }> {
  return json(`${BASE}/map/zones`);
}

export function authority(): Promise<AuthorityDashboard> {
  return json(`${BASE}/authority/dashboard`);
}

export function fetchSSTGrid(): Promise<{ data: [number, number, number][] }> {
  return json(`${BASE}/map/sst-grid`);
}

export function fetchChlorophyllGrid(): Promise<{ data: [number, number, number][] }> {
  return json(`${BASE}/map/chlorophyll-grid`);
}

export type WeatherHazard = {
  type: "LIGHT_RAIN" | "HEAVY_RAIN" | "THUNDERSTORM" | "CYCLONE";
  geometry_type: "grid_cell" | "circle" | "polygon";
  latitude?: number; longitude?: number; radius_km?: number;
  bounds?: [[number, number], [number, number]];
  polygon?: [number, number][];
  source: string; valid_time?: string; valid_until?: string;
};
export function fetchWeatherHazards(): Promise<{ status: "LIVE" | "UNAVAILABLE"; hazards: WeatherHazard[]; fetched_at?: string; reason?: string }> {
  return json(`${BASE}/map/weather-hazards`);
}

export function riskTimeline(lat: number, lon: number, hours = 24) {
  return json<{
    points: {
      hour: number;
      time: string;
      score: number;
      category: RiskCategory;
      wave_height_m: number | null;
      wind_speed_kmh: number | null;
      warning: boolean;
    }[];
  }>(`${BASE}/risk/timeline?lat=${lat}&lon=${lon}&hours=${hours}`);
}

/** Fast geofence check — called while the vessel marker is dragged. */
export function checkPosition(lat: number, lon: number): Promise<PositionCheck> {
  return json<PositionCheck>(`${BASE}/position?lat=${lat}&lon=${lon}`);
}

/** Everything a fisher needs for a position: safety, grounds, timing, forecast. */
export function fishingOutlook(
  lat: number,
  lon: number,
  opts: { radiusKm?: number; days?: number; lang?: Language } = {},
): Promise<FishingOutlook> {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius_km: String(opts.radiusKm ?? 100),
    days: String(opts.days ?? 3),
    lang: opts.lang ?? "en",
  });
  return json<FishingOutlook>(`${BASE}/fishing?${p}`);
}

export function sendSos(payload: {
  latitude: number;
  longitude: number;
  risk: { category: RiskCategory; score: number };
  hazards: string[];
  route: EmergencyRoute | null;
  message: string;
  language: Language;
}): Promise<SosResponse> {
  return json<SosResponse>(`${BASE}/sos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function emergencyRoute(latitude: number, longitude: number): Promise<EmergencyRoute> {
  return json<EmergencyRoute>(`${BASE}/emergency-route`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  });
}

export interface Measurement {
  value: number | null;
  unit: string;
  label: string;
  provenance: {
    source: string;
    timestamp: string;
    mode: string;
    confidence: number | null;
    note?: string | null;
  };
}

export interface AgentSnapshot {
  agent: string;
  ok: boolean;
  data: Record<string, unknown>;
  measurements: Record<string, Measurement>;
  unavailable: string[];
  source: string;
  timestamp: string;
  confidence: number | null;
  mode: string;
  latency_ms: number;
}

/** One raw pull of the sea at a position — drives the System page's live feed. */
export function forecast(lat: number, lon: number) {
  return json<{
    location: { name: string; latitude: number; longitude: number; state?: string | null };
    valid_for: string;
    weather: AgentSnapshot;
    ocean: AgentSnapshot;
  }>(`${BASE}/forecast?lat=${lat}&lon=${lon}`);
}

export function setMode(mode: "LIVE" | "DEMO") {
  return json<{ ok: boolean; data_mode: string; note: string }>(`${BASE}/config/mode`, {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
}

export function health() {
  return json<{ status: string; data_mode: string; version: string }>(`${BASE}/health`);
}

export function config() {
  return json<{
    data_mode: string;
    risk_weights: Record<string, number>;
    risk_thresholds: Record<string, number>;
    deterministic_overrides: Record<string, number>;
    note: string;
  }>(`${BASE}/config`);
}

/** Historical marine analysis — full daily timeseries for the dashboard. */
export function getHistoricalAnalysis(
  lat: number,
  lon: number,
  days: HistoricalDays,
): Promise<HistoricalResponse> {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    days: String(days),
  });
  return json<HistoricalResponse>(`${BASE}/historical?${p}`);
}
