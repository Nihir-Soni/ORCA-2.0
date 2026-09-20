export type Language = "en" | "hi" | "kn";
export type IntentMode = "OFFLINE" | "AI";
export type DataMode = "LIVE" | "DEMO" | "CACHE";
export type RiskCategory = "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  state?: string | null;
}

export interface Intent {
  intent: string;
  activity: string;
  location: Location | null;
  location_text: string;
  date: string | null;
  time: string | null;
  language: Language;
  raw_query: string;
  needs: string[];
  missing: string[];
  intent_source: "KEYWORD_OFFLINE" | "GROQ_LLM";
}

export interface RiskFactor {
  key: string;
  label: string;
  factor: number;
  weight: number;
  contribution: number;
  detail: string;
}

export interface RiskAssessment {
  score: number;
  category: RiskCategory;
  factors: RiskFactor[];
  overrides: string[];
  official_warning: boolean;
  go: boolean;
  window?: string | null;
  sources: string[];
  generated_at: string;
  mode: DataMode;
}

export interface PFZZone {
  rank: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  bearing: string;
  sst_c: number | null;
  chlorophyll_mg_m3: number | null;
  wave_height_m: number | null;
  confidence: number;
  rationale: string;
  source: string;
  timestamp: string;
}

export interface RouteLeg {
  latitude: number;
  longitude: number;
}

export interface RouteOption {
  name: string;
  kind: "safest" | "shortest" | "alternate";
  legs: RouteLeg[];
  distance_km: number;
  eta_minutes: number;
  risk_score: number;
  risk_category: RiskCategory;
  penalties: Record<string, number>;
  recommended: boolean;
  notes: string;
}

export interface GeofenceAlert {
  zone_name: string;
  zone_type: string;
  distance_km: number;
  inside: boolean;
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface Evidence {
  label: string;
  value: string;
  source: string;
  timestamp: string;
  confidence: number | null;
  mode: DataMode;
}

export interface AgentTrace {
  agent: string;
  status: "ok" | "skipped" | "failed" | "degraded";
  latency_ms: number;
  summary: string;
  source: string;
  mode: DataMode;
}

export interface MarineAlert {
  type: string;
  severity: string;
  official: boolean;
  headline: string;
  detail: string;
  source: string;
  valid_till?: string;
  location?: string;
  /** Illustrative warning geometry so the chart can draw the alert. */
  storm?: {
    latitude: number;
    longitude: number;
    radius_km: number;
    track?: { latitude: number; longitude: number; label: string }[];
  };
}

export interface ChatResponse {
  session_id: string;
  language: Language;
  answer: string;
  intent: Intent;
  risk: RiskAssessment | null;
  pfz: PFZZone[];
  routes: RouteOption[];
  geofence: GeofenceAlert[];
  alerts: MarineAlert[];
  evidence: Evidence[];
  trace: AgentTrace[];
  suggestions: string[];
  mode: DataMode;
  disclaimer: string;
  elapsed_ms: number;
  sources: Record<string, string>;
}

export interface AuthorityRow {
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  risk_score: number;
  risk_category: RiskCategory;
  official_warning: boolean;
  wave_height_m: number | null;
  wind_speed_kmh: number | null;
  headline: string | null;
}

export interface AuthorityDashboard {
  generated_at: string;
  summary: Record<string, number>;
  locations: AuthorityRow[];
}

export interface ZoneFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    zone_type: string;
    severity: string;
    note: string;
  };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

export interface PositionCheck {
  latitude: number;
  longitude: number;
  status: "clear" | "warning" | "critical";
  headline: string;
  distance_from_shore_km: number | null;
  nearest_landing_centre: string | null;
  nearest_zone_km: number | null;
  nearest_zone_name: string | null;
  inside_restricted_zone: boolean;
  geofence_alerts: GeofenceAlert[];
  official_warning_active: boolean;
  checked_at: string;
}

export interface TimelinePoint {
  hour: number;
  time: string;
  score: number;
  category: RiskCategory;
  wave_height_m: number | null;
  wind_speed_kmh: number | null;
  warning: boolean;
}

export type CatchRating = "very_good" | "good" | "fair" | "poor";

export interface FishingArea {
  id: string;
  rank: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  bearing: string;
  sst_c: number | null;
  chlorophyll_mg_m3: number | null;
  wave_height_m: number | null;
  probability: number;
  value_score: number;
  rating: CatchRating;
  confidence: number;
  rationale: string;
  factors: Record<string, number>;
  /** Indicative species mix from SST/chlorophyll bands — never a promise. */
  likely_species?: string[];
  /** Best balance of odds against the run out — the one we route to. */
  recommended?: boolean;
}

export interface ForecastDay {
  day_offset: number;
  date: string;
  label: string;
  best_hour: number;
  probability: number;
  rating: CatchRating;
  wave_height_m: number;
  wind_speed_kmh: number;
  sea_state: string;
  calmer: boolean;
  official_warning: boolean;
  best_area_rank: number | null;
  best_area_distance_km: number | null;
}

export interface AvoidZone {
  name: string;
  zone_type: string;
  distance_km: number;
  window: string | null;
  active_now: boolean;
  severity: string;
}

export interface TripDuration {
  recommended_hours: number;
  travel_each_way_minutes: number;
  round_trip_hours: number;
  total_trip_hours: number;
  safe_window_hours: number;
  limited_by_weather: boolean;
  feasible: boolean;
  /** "Return before HH:MM" — the end of the safe-weather window. */
  return_by?: string;
  return_reason_wave_m?: number | null;
}

/** Planning estimates for the recommended trip — assumptions ride along. */
export interface TripEconomics {
  fuel_litres: number;
  fuel_cost_inr: number;
  catch_kg_low: number;
  catch_kg_high: number;
  revenue_inr: number;
  profit_inr: number;
  assumptions: string;
}

export interface FishingOutlook {
  location: {
    latitude: number;
    longitude: number;
    name: string;
    state: string | null;
    nearest_landing_centre: string;
    distance_from_shore_km: number;
    is_on_land: boolean;
  };
  generated_at: string;
  radius_km: number;
  safety: {
    score: number;
    category: RiskCategory;
    official_warning: boolean;
    improves_after: string | null;
    wave_height_m: number | null;
    wind_speed_kmh: number | null;
    sea_state: string | null;
  };
  pfz_status: "AVAILABLE" | "NO_NEARBY_PFZ" | "UNAVAILABLE";
  total_available: number;
  nearest_distance_km: number | null;
  areas: FishingArea[];
  best_window: { from_hour: number; to_hour: number } | null;
  hourly_ranking: { hour: number; probability: number }[];
  duration: TripDuration | null;
  economics: TripEconomics | null;
  routes: RouteOption[];
  avoid: AvoidZone[];
  forecast: ForecastDay[];
  advice: string[];
  mode: DataMode;
  method: string;
}

export interface SosResponse {
  ok: boolean;
  message: string;
  recipient: string;
  delivered: boolean;
  sms: string;
  provider_id?: string | null;
}

export interface EmergencyRoute {
  available: boolean;
  destination: { latitude: number; longitude: number; name: string } | null;
  distance_km: number | null;
  eta_minutes: number | null;
  risk_score: number | null;
  risk_category: RiskCategory | null;
  waypoints: RouteLeg[];
  notes: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "orca";
  text: string;
  response?: ChatResponse;
}

// ---- Historical Marine Intelligence types --------------------------------
// These mirror the exact shape returned by GET /api/historical, which comes
// directly from analyze_historical_data() *before* timeseries stripping.

export interface HistoricalStats {
  first: number;
  last: number;
  mean: number;
  min: number;
  max: number;
  change: number;
  change_percent: number;
  trend: "increasing" | "decreasing" | "stable" | "insufficient_data";
  observation_count: number;
}

/** Daily time-series as parallel arrays of ISO date strings and float values. */
export interface HistoricalTimeseries {
  dates: string[];
  values: number[];
}

export interface HistoricalVariable {
  statistics: HistoricalStats;
  timeseries: HistoricalTimeseries;
}

/** Weather comes back as aggregate statistics, not a daily timeseries. */
export interface HistoricalWeatherStats {
  mean_temperature: number;
  mean_wind_speed: number;
  max_wind_speed: number;
  total_precipitation: number;
  rainy_day_count: number;
}

export interface HistoricalWeatherVariable {
  statistics: HistoricalWeatherStats;
}

export interface HistoricalAvailability {
  status: "AVAILABLE" | "UNAVAILABLE";
  reason?: string;
}

export interface HistoricalProvenance {
  provider: string;
  variable: string;
  dataset?: string;
  mode?: string;
  requested_start?: string;
  requested_end?: string;
  actual_coverage_start?: string;
  actual_coverage_end?: string;
  observation_count?: number;
  [key: string]: unknown;
}

export interface HistoricalCorrelation {
  variable_a: string;
  variable_b: string;
  coefficient: number;
  sample_count: number;
}

/** Full response from GET /api/historical */
export interface HistoricalResponse {
  analysis_type: string;
  overall_status: string;
  period: {
    start: string;
    end: string;
    days_requested: number;
  };
  location: {
    name: string;
    latitude: number;
    longitude: number;
    state: string | null;
  };
  variables: {
    chlorophyll?: HistoricalVariable;
    sst?: HistoricalVariable;
    current_speed?: HistoricalVariable;
    weather?: HistoricalWeatherVariable;
  };
  availability: Record<string, HistoricalAvailability>;
  provenance: HistoricalProvenance[];
  correlations: HistoricalCorrelation[];
}

/** Variables supported by the Historical panel. */
export type HistoricalVariable_ID = "chlorophyll" | "sst" | "current_speed" | "weather";

export type HistoricalDays = 7 | 30 | 90;
