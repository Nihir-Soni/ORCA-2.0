import L from "leaflet";
import React, { useEffect, useRef, useState } from "react";
import * as api from "../api";
import type {
  EmergencyRoute,
  FishingArea,
  GeofenceAlert,
  Language,
  Location,
  MarineAlert,
  PFZZone,
  PositionCheck,
  RouteOption,
  ZoneFeature,
} from "../types";
import { RATING_COLOR } from "./FishingPanel";


/** Zone stroke colours; the fills are true chart hatching via CSS patterns. */
const ZONE_COLOR: Record<string, string> = {
  critical: "#AF2318",
  warning: "#BF4E12",
  info: "#2A7391",
};

const HINT: Record<Language, string> = {
  en: "Drag the boat to check any position",
  hi: "किसी भी स्थान की जाँच के लिए नाव खींचें",
  kn: "ಯಾವುದೇ ಸ್ಥಳವನ್ನು ಪರಿಶೀಲಿಸಲು ದೋಣಿಯನ್ನು ಎಳೆಯಿರಿ",
};

const LEGEND: Record<Language, Record<string, string>> = {
  en: {
    symbols: "Symbols",
    veryGood: "Very good chance",
    some: "Some chance",
    noEntry: "Do not enter",
    course: "Safest course",
    storm: "Cyclone / warning area",
    marginL: "Indian coastal waters · scale varies",
    marginR: "Illustrative boundaries — not for navigation",
  },
  hi: {
    symbols: "संकेत",
    veryGood: "बहुत अच्छी संभावना",
    some: "कुछ संभावना",
    noEntry: "प्रवेश न करें",
    course: "सबसे सुरक्षित मार्ग",
    storm: "चक्रवात / चेतावनी क्षेत्र",
    marginL: "भारतीय तटीय जल · पैमाना बदलता है",
    marginR: "सांकेतिक सीमाएँ — नौवहन के लिए नहीं",
  },
  kn: {
    symbols: "ಚಿಹ್ನೆಗಳು",
    veryGood: "ಉತ್ತಮ ಸಾಧ್ಯತೆ",
    some: "ಸ್ವಲ್ಪ ಸಾಧ್ಯತೆ",
    noEntry: "ಪ್ರವೇಶಿಸಬೇಡಿ",
    course: "ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ",
    storm: "ಚಂಡಮಾರುತ / ಎಚ್ಚರಿಕೆ ಪ್ರದೇಶ",
    marginL: "ಭಾರತೀಯ ಕರಾವಳಿ ನೀರು · ಪ್ರಮಾಣ ಬದಲಾಗುತ್ತದೆ",
    marginR: "ಸೂಚಕ ಗಡಿಗಳು — ನಾವಿಗೇಷನ್‌ಗಾಗಿ ಅಲ್ಲ",
  },
};

const STATUS_STYLE: Record<PositionCheck["status"], string> = {
  clear: "bg-risk-low",
  warning: "bg-risk-high",
  critical: "bg-risk-extreme",
};

const SERIF = `'Fraunces Variable',Georgia,serif`;
const MONO = `'Spline Sans Mono Variable',Consolas,monospace`;

/**
 * Leaflet map presented as a chart sheet: paper margin, tick marks, double
 * neatline, compass rose, hatched danger areas, plotted courses.
 *
 * Custom divIcons throughout so we never depend on Leaflet's default marker
 * image assets, which break under bundlers and would 404 with no network.
 */
const EMPTY_AREAS: FishingArea[] = [];
const EMPTY_ALERTS: MarineAlert[] = [];
const EMPTY_PFZ: PFZZone[] = [];
const EMPTY_ROUTES: RouteOption[] = [];
const EMPTY_GEOFENCE: GeofenceAlert[] = [];

export default function MarineMap({
  origin,
  emergencyRoute,
  zones,
  pfz = EMPTY_PFZ,
  areas = EMPTY_AREAS,
  radiusKm,
  routes = EMPTY_ROUTES,
  geofence = EMPTY_GEOFENCE,
  alerts = EMPTY_ALERTS,
  language = "en",
  onPickLocation,
  focusRank,
  height,
  fill = false,
}: {
  origin: Location | null;
  emergencyRoute?: EmergencyRoute | null;
  zones: ZoneFeature[];
  pfz: PFZZone[];
  /** Scored fishing grounds — takes precedence over `pfz` when present. */
  areas?: FishingArea[];
  radiusKm?: number;
  routes: RouteOption[];
  geofence: GeofenceAlert[];
  /** Official warnings; those carrying `storm` geometry are drawn on the chart. */
  alerts?: MarineAlert[];
  language?: Language;
  /** Tap anywhere on the water to move the fisher's position. */
  onPickLocation?: (lat: number, lon: number) => void;
  focusRank?: number | null;
  /** Optional custom height for the chart viewport (e.g. to fill available vertical space) */
  height?: number | string;
  /** When true, stretches the entire chart sheet, frame, and map to 100% of parent height */
  fill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const boatRef = useRef<L.Marker | null>(null);
  const coordBadgeRef = useRef<HTMLDivElement>(null);
  const initialFitDoneRef = useRef(false);
  const prevOriginKeyRef = useRef<string | null>(null);
  const isBoatDragRef = useRef(false);
  const [probe, setProbe] = useState<PositionCheck | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showSST, setShowSST] = useState(false);
  const [sstGrid, setSSTGrid] = useState<[number, number, number][] | null>(null);
  const sstLayerRef = useRef<L.LayerGroup | null>(null);
  const [showChl, setShowChl] = useState(false);
  const [chlGrid, setChlGrid] = useState<[number, number, number][] | null>(null);
  const chlLayerRef = useRef<L.LayerGroup | null>(null);
  const [showWeatherHazards, setShowWeatherHazards] = useState(false);
  const [weatherHazards, setWeatherHazards] = useState<api.WeatherHazard[] | null>(null);
  const [weatherUnavailable, setWeatherUnavailable] = useState(false);
  const weatherLayerRef = useRef<L.LayerGroup | null>(null);
  const mapHeight = height ?? (areas.length ? 540 : 420);

  // Leaflet caches the container size, so tell it whenever the height changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(id);
  }, [mapHeight]);

  // Keep Leaflet in sync with container size changes
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch SST Grid
  useEffect(() => {
    if (showSST && !sstGrid) {
      api.fetchSSTGrid().then(res => setSSTGrid(res.data)).catch(console.error);
    }
  }, [showSST, sstGrid]);

  // Fetch Chlorophyll Grid
  useEffect(() => {
    if (showChl && !chlGrid) {
      api.fetchChlorophyllGrid().then(res => setChlGrid(res.data)).catch(console.error);
    }
  }, [showChl, chlGrid]);

  useEffect(() => {
    if (!showWeatherHazards || weatherHazards) return;
    api.fetchWeatherHazards().then((res) => {
      setWeatherHazards(res.hazards);
      setWeatherUnavailable(res.status !== "LIVE");
    }).catch(() => setWeatherUnavailable(true));
  }, [showWeatherHazards, weatherHazards]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!showWeatherHazards || !weatherHazards) {
      if (weatherLayerRef.current) { weatherLayerRef.current.clearLayers(); map.removeLayer(weatherLayerRef.current); weatherLayerRef.current = null; }
      return;
    }
    if (weatherLayerRef.current) return;
    const colors: Record<api.WeatherHazard["type"], string> = { LIGHT_RAIN: "#54bdf7", HEAVY_RAIN: "#0754a5", THUNDERSTORM: "#7c3aed", CYCLONE: "#dc2626" };
    const layer = L.layerGroup(); const renderer = L.canvas({ padding: 0.5 });
    weatherHazards.forEach((hazard) => {
      const style = { color: colors[hazard.type], weight: 1.5, fillColor: colors[hazard.type], fillOpacity: 0.28, renderer };
      const popup = `<b>${hazard.type.replace("_", " ")}</b><br/>LIVE · ${hazard.source}${hazard.valid_until ? `<br/>Valid until ${hazard.valid_until}` : hazard.valid_time ? `<br/>Valid ${hazard.valid_time}` : ""}`;
      if (hazard.geometry_type === "grid_cell" && hazard.bounds) L.rectangle(hazard.bounds, style).bindPopup(popup).addTo(layer);
      else if (hazard.geometry_type === "circle" && hazard.latitude != null && hazard.longitude != null && hazard.radius_km != null) L.circle([hazard.latitude, hazard.longitude], { ...style, radius: hazard.radius_km * 1000 }).bindPopup(popup).addTo(layer);
      else if (hazard.geometry_type === "polygon" && hazard.polygon) L.polygon(hazard.polygon, style).bindPopup(popup).addTo(layer);
    });
    layer.addTo(map); weatherLayerRef.current = layer;
    return () => { if (weatherLayerRef.current) { weatherLayerRef.current.clearLayers(); map.removeLayer(weatherLayerRef.current); weatherLayerRef.current = null; } };
  }, [showWeatherHazards, weatherHazards]);

  // SST Layer renderer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!showSST || !sstGrid) {
      if (sstLayerRef.current) {
        sstLayerRef.current.clearLayers();
        map.removeLayer(sstLayerRef.current);
        sstLayerRef.current = null;
      }
      return;
    }

    if (sstLayerRef.current) return;

    const lg = L.layerGroup();
    const renderer = L.canvas({ padding: 0.5 });
    
    const getColor = (t: number) => {
       const min = 24, max = 32;
       const pct = Math.max(0, Math.min(1, (t - min) / (max - min)));
       const r = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(1 - 4 * (pct - 0.5))))));
       const g = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(1 - 4 * (pct - 0.25))))));
       const b = Math.max(0, Math.min(255, Math.round(255 * (1.5 - Math.abs(1 - 4 * pct)))));
       return `rgb(${r},${g},${b})`;
    };

    sstGrid.forEach(([lat, lon, t]) => {
      const bounds: L.LatLngBoundsExpression = [[lat - 0.05, lon - 0.05], [lat + 0.05, lon + 0.05]];
      L.rectangle(bounds, {
          renderer,
          stroke: false,
          fillColor: getColor(t),
          fillOpacity: 0.55,
          interactive: false
      }).addTo(lg);
    });
    
    lg.addTo(map);
    sstLayerRef.current = lg;

    return () => {
       if (sstLayerRef.current) {
          sstLayerRef.current.clearLayers();
          map.removeLayer(sstLayerRef.current);
          sstLayerRef.current = null;
       }
    };
  }, [showSST, sstGrid]);

  // Chlorophyll Layer renderer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!showChl || !chlGrid) {
      if (chlLayerRef.current) {
        chlLayerRef.current.clearLayers();
        map.removeLayer(chlLayerRef.current);
        chlLayerRef.current = null;
      }
      return;
    }

    if (chlLayerRef.current) return;

    const lg = L.layerGroup();
    const renderer = L.canvas({ padding: 0.5 });
    
    // Log scale visualization for highly skewed chlorophyll data.
    // Range roughly 0.03 to 30.0 mg/m³ mapped to log10 space [-1.5 to 1.5]
    const getColor = (c: number) => {
       if (c <= 0 || isNaN(c)) return 'transparent';
       const logC = Math.log10(c);
       const minLog = -1.5, maxLog = 1.5;
       const pct = Math.max(0, Math.min(1, (logC - minLog) / (maxLog - minLog)));
       
       // Dark blue -> Light Blue -> Green -> Yellow -> Red
       let r, g, b;
       if (pct < 0.25) { // Dark Blue to Light Blue
          r = 0;
          g = Math.round(255 * (pct / 0.25));
          b = Math.round(128 + 127 * (pct / 0.25));
       } else if (pct < 0.5) { // Light Blue to Green
          const p = (pct - 0.25) / 0.25;
          r = 0;
          g = 255;
          b = Math.round(255 * (1 - p));
       } else if (pct < 0.75) { // Green to Yellow
          const p = (pct - 0.5) / 0.25;
          r = Math.round(255 * p);
          g = 255;
          b = 0;
       } else { // Yellow to Red
          const p = (pct - 0.75) / 0.25;
          r = 255;
          g = Math.round(255 * (1 - p));
          b = 0;
       }
       return `rgb(${r},${g},${b})`;
    };

    chlGrid.forEach(([lat, lon, c]) => {
      const bounds: L.LatLngBoundsExpression = [[lat - 0.05, lon - 0.05], [lat + 0.05, lon + 0.05]];
      L.rectangle(bounds, {
          renderer,
          stroke: false,
          fillColor: getColor(c),
          fillOpacity: 0.55,
          interactive: false
      }).addTo(lg);
    });
    
    lg.addTo(map);
    chlLayerRef.current = lg;

    return () => {
       if (chlLayerRef.current) {
          chlLayerRef.current.clearLayers();
          map.removeLayer(chlLayerRef.current);
          chlLayerRef.current = null;
       }
    };
  }, [showChl, chlGrid]);

  // ---- init once -------------------------------------------------------
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    // SVG renderer (not canvas): zone polygons take CSS pattern fills, and the
    // recommended course animates its dashes — neither works on canvas.
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([18.92, 72.6], 10);

    L.control.zoom({ position: "topleft" }).addTo(map);

    // OSM standard tiles — keyless and never watermarked. CARTO's free
    // basemaps started stamping "API KEY REQUIRED" over anonymous raster
    // tiles mid-demo-rehearsal; a basemap that can silently start demanding
    // a key is not acceptable on stage. The sepia tile filter in index.css
    // warms OSM's palette to match the paper.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "",
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Tap-to-choose-position. Registered separately so the handler always closes
  // over the latest callback rather than the one from first render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPickLocation) return;
    const handler = (e: L.LeafletMouseEvent) =>
      onPickLocation(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4));
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onPickLocation]);

  // Live coordinate readout on mousemove — direct DOM update without React re-renders
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const badge = coordBadgeRef.current;
    const onMove = (e: L.LeafletMouseEvent) => {
      if (!badge) return;
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      const latStr = lat >= 0 ? `${lat.toFixed(4)}°N` : `${Math.abs(lat).toFixed(4)}°S`;
      const lonStr = lon >= 0 ? `${lon.toFixed(4)}°E` : `${Math.abs(lon).toFixed(4)}°W`;
      badge.textContent = `${latStr}  ${lonStr}`;
      badge.classList.add("visible");
    };
    const onOut = () => {
      const badge = coordBadgeRef.current;
      if (badge) badge.classList.remove("visible");
    };
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
    };
  }, []);

  // ---- redraw content --------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    boatRef.current = null;
    setProbe(null);

    const bounds: L.LatLngExpression[] = [];

    // Animated ocean currents in water bodies
    if (origin) {
      const oLat = origin.latitude;
      const oLon = origin.longitude;
      // Curved streamlines flowing along natural marine current paths in open water
      const streams = [
        [[oLat + 0.16, oLon - 0.18], [oLat + 0.06, oLon - 0.14], [oLat - 0.05, oLon - 0.11], [oLat - 0.18, oLon - 0.07]],
        [[oLat + 0.22, oLon - 0.08], [oLat + 0.10, oLon - 0.04], [oLat - 0.02, oLon - 0.02], [oLat - 0.15, oLon + 0.01]],
        [[oLat + 0.18, oLon + 0.06], [oLat + 0.04, oLon + 0.09], [oLat - 0.08, oLon + 0.12], [oLat - 0.22, oLon + 0.15]],
        [[oLat + 0.28, oLon - 0.25], [oLat + 0.13, oLon - 0.22], [oLat - 0.04, oLon - 0.18], [oLat - 0.19, oLon - 0.14]],
        [[oLat + 0.09, oLon - 0.32], [oLat - 0.03, oLon - 0.29], [oLat - 0.15, oLon - 0.25], [oLat - 0.27, oLon - 0.21]],
        [[oLat + 0.02, oLon - 0.12], [oLat - 0.10, oLon - 0.08], [oLat - 0.21, oLon - 0.04], [oLat - 0.31, oLon + 0.01]],
      ];

      streams.forEach((pts, i) => {
        L.polyline(pts as [number, number][], {
          color: i % 2 === 0 ? "#00E5FF" : "#38BDF8",
          weight: 2,
          opacity: 0.65,
          dashArray: "12 28",
          className: i % 2 === 0 ? "water-stream-flow-1" : "water-stream-flow-2",
          interactive: false,
        }).addTo(group);
      });
    }

    // search radius — shows exactly how far ORCA looked for grounds
    if (origin && radiusKm) {
      L.circle([origin.latitude, origin.longitude], {
        radius: radiusKm * 1000,
        color: "#2A7391",
        weight: 1.6,
        opacity: 0.75,
        dashArray: "2 7",
        fillColor: "#2A7391",
        fillOpacity: 0.03,
        interactive: false,
        className: "radius-drift",
      })
        .bindTooltip(`${radiusKm} km search area`, { permanent: false, direction: "top" })
        .addTo(group);
    }

    // restricted zones — hatched like chart danger areas
    zones.forEach((z) => {
      const ring = z.geometry.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]);
      const severity = z.properties.severity in ZONE_COLOR ? z.properties.severity : "critical";
      const color = ZONE_COLOR[severity];
      L.polygon(ring, {
        color,
        weight: 2,
        dashArray: "9 5",
        className: `zone-hatch-${severity}`,
      })
        .bindPopup(
          `<b>${z.properties.name}</b><br/><span style="opacity:.75">${z.properties.zone_type.replace(/_/g, " ")}</span><br/><span style="font-size:10px;opacity:.6">${z.properties.note}</span>`,
        )
        .addTo(group);
    });

    // official warnings with geometry — the storm is DRAWN, not just recited
    alerts.forEach((al) => {
      const s = al.storm;
      if (!s) return;
      const isCyclone = al.type === "cyclone_warning";

      // warning area, hatched like every danger area on this chart
      L.circle([s.latitude, s.longitude], {
        radius: s.radius_km * 1000,
        color: "#AF2318",
        weight: 2,
        opacity: 0.9,
        dashArray: "10 6",
        className: "zone-hatch-critical",
        interactive: false,
      }).addTo(group);

      // past + forecast track with timestamped position dots
      const track = s.track ?? [];
      if (track.length > 1) {
        const line = track.map((p) => [p.latitude, p.longitude] as [number, number]);
        L.polyline(line, {
          color: "#AF2318",
          weight: 2.5,
          opacity: 0.85,
          dashArray: "3 7",
          className: "route-live",
        }).addTo(group);
        track.forEach((p) => {
          L.marker([p.latitude, p.longitude], {
            icon: L.divIcon({
              className: "",
              iconSize: [11, 11],
              iconAnchor: [5.5, 5.5],
              html: `<div style="width:11px;height:11px;border-radius:50%;background:#FBF7ED;
                       border:2.5px solid #AF2318;box-shadow:0 1px 4px rgba(18,33,45,.4)"></div>`,
            }),
          })
            .bindTooltip(p.label, { direction: "top", offset: [0, -6] })
            .addTo(group);
          bounds.push([p.latitude, p.longitude]);
        });
      }

      // the storm itself — the meteorological symbol, turning
      if (isCyclone) {
        L.marker([s.latitude, s.longitude], {
          zIndexOffset: 800,
          icon: L.divIcon({
            className: "",
            iconSize: [56, 56],
            iconAnchor: [28, 28],
            html: `<div class="storm-spin" style="width:56px;height:56px;
                        filter:drop-shadow(0 0 3px rgba(245,238,221,.95)) drop-shadow(0 2px 6px rgba(18,33,45,.35))">
                     <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
                       <path d="M28 5 A 23 23 0 0 1 51 28" stroke="#AF2318" stroke-width="6" stroke-linecap="round"/>
                       <path d="M28 51 A 23 23 0 0 1 5 28" stroke="#AF2318" stroke-width="6" stroke-linecap="round"/>
                       <circle cx="28" cy="28" r="10.5" fill="#AF2318"/>
                       <circle cx="28" cy="28" r="4" fill="#FBF7ED"/>
                     </svg>
                   </div>`,
          }),
        })
          .bindTooltip(al.headline, {
            permanent: true,
            direction: "top",
            offset: [0, -32],
            className: "storm-label",
          })
          .bindPopup(
            `<b>${al.headline}</b><br/>${al.detail}<br/>
             <span style="font-size:10px;opacity:.65">${al.source} · illustrative storm geometry — Demo / simulated</span>`,
          )
          .addTo(group);
      }
      bounds.push([s.latitude, s.longitude]);
    });

    // plotted courses (under the pins)
    routes.forEach((r) => {
      const line = r.legs.map((l) => [l.latitude, l.longitude] as [number, number]);
      line.forEach((p) => bounds.push(p));
      const rec = r.recommended;
      L.polyline(line, {
        color: rec ? "#1D7A50" : "#5D7386",
        weight: rec ? 4 : 2.5,
        opacity: rec ? 0.95 : 0.55,
        dashArray: rec ? "12 12" : "2 8",
        className: rec ? "route-live" : "",
      })
        .bindPopup(
          `<b>${r.name}</b><br/>${r.distance_km} km · ${Math.round(r.eta_minutes)} min<br/><span style="font-size:11px;opacity:.8">${r.notes}</span>`,
        )
        .addTo(group);
    });

    if (emergencyRoute?.available && emergencyRoute.waypoints.length > 1) {
      const line = emergencyRoute.waypoints.map((p) => [p.latitude, p.longitude] as [number, number]);
      line.forEach((p) => bounds.push(p));
      L.polyline(line, {
        color: "#AF2318",
        weight: 5,
        opacity: 0.9,
        dashArray: "16 8",
        className: "route-emergency",
      })
        .bindPopup(`<b>Emergency return to land</b><br/>${emergencyRoute.destination?.name ?? "Safe shore"}<br/>${emergencyRoute.distance_km} km`)
        .addTo(group);
    }

    // fishing grounds as numbered buoys: paper face, rating-coloured ring,
    // rank set in the chart's serif, probability as a sounding beneath it.
    if (areas.length) {
      areas.forEach((a) => {
        const best = a.rank === 1;
        const size = best ? 46 : 38;
        const color = RATING_COLOR[a.rating];
        const focused = focusRank === a.rank;
        L.marker([a.latitude, a.longitude], {
          zIndexOffset: best ? 500 : 0,
          icon: L.divIcon({
            className: "",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            html: `<div class="bob" style="position:relative;width:${size}px;height:${size}px;
                        animation-delay:${((a.rank * 7) % 10) / 3}s">
                     ${focused ? `<div style="position:absolute;inset:-8px;border-radius:50%;
                        border:2px solid ${color};animation:ping2 1.6s cubic-bezier(0,0,.2,1) infinite"></div>` : ""}
                     <div class="buoy" style="position:absolute;inset:0;border-radius:50%;background:#FBF7ED;
                       border:${best ? 4 : 3.5}px solid ${color};display:flex;flex-direction:column;
                       align-items:center;justify-content:center;line-height:1;gap:1px;
                       box-shadow:0 3px 10px rgba(18,33,45,.4);color:#12212D">
                       <span style="font:${best ? "800 16px" : "700 14px"} ${SERIF}">${a.rank}</span>
                       <span style="font:600 ${best ? 8.5 : 8}px ${MONO};color:#42596D">${a.probability}%</span>
                     </div>
                   </div>`,
          }),
        })
          .bindPopup(
            `<b>Area ${a.rank}</b> — ${a.probability}% chance of fish<br/>
             ${Math.round(a.distance_km)} km ${a.bearing}<br/>
             SST ${a.sst_c ?? "—"} °C · chlorophyll ${a.chlorophyll_mg_m3 ?? "—"} mg/m³<br/>
             ${a.likely_species?.length ? `Likely: ${a.likely_species.join(", ")}<br/>` : ""}
             <span style="font-size:10px;opacity:.65">A likelihood from the data — never a guarantee of fish.</span>`,
          )
          .addTo(group);
        bounds.push([a.latitude, a.longitude]);
      });
    } else {
      pfz.forEach((z) => {
        const best = z.rank === 1;
        const size = best ? 40 : 32;
        const color = best ? "#1D7A50" : "#2A7391";
        L.marker([z.latitude, z.longitude], {
          icon: L.divIcon({
            className: "",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            html: `<div class="bob" style="width:${size}px;height:${size}px;animation-delay:${((z.rank * 7) % 10) / 3}s">
                     <div class="buoy" style="width:100%;height:100%;border-radius:50%;background:#FBF7ED;
                       border:${best ? 4 : 3}px solid ${color};display:grid;place-items:center;
                       color:#12212D;font:${best ? "800 16px" : "700 13px"} ${SERIF};
                       box-shadow:0 3px 10px rgba(18,33,45,.4)">${z.rank}</div>
                   </div>`,
          }),
        })
          .bindPopup(
            `<b>Fishing zone #${z.rank}</b><br/>${z.distance_km} km ${z.bearing}<br/>
             SST ${z.sst_c ?? "—"} °C · chlorophyll ${z.chlorophyll_mg_m3 ?? "—"} mg/m³<br/>
             confidence ${Math.round(z.confidence * 100)}%<br/>
             <span style="font-size:10px;opacity:.65">Potential zone — not a guarantee of fish.</span>`,
          )
          .addTo(group);
        bounds.push([z.latitude, z.longitude]);
      });
    }

    // draggable vessel — ink boat on a paper disc
    if (origin) {
      const boat = L.marker([origin.latitude, origin.longitude], {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          // Inline SVG rather than an emoji: emoji glyphs vary by OS and can
          // fail to render entirely on a projector/kiosk machine.
          html: `<div class="roll" style="position:relative;width:34px;height:34px;cursor:grab">
                   <div style="position:absolute;inset:-9px;border-radius:50%;
                     border:2px solid rgba(42,115,145,.6);
                     animation:ping2 2s cubic-bezier(0,0,.2,1) infinite"></div>
                   <div class="buoy" style="position:absolute;inset:0;border-radius:50%;background:#12212D;
                     border:2.5px solid #FBF7ED;box-shadow:0 3px 10px rgba(18,33,45,.5);
                     display:grid;place-items:center">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="#FBF7ED" stroke-width="2" stroke-linecap="round"
                          stroke-linejoin="round">
                       <path d="M12 3v10"/><path d="M12 5l7 8H5l7-8z" fill="#FBF7ED" stroke="none"/>
                       <path d="M3 17c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0"/>
                     </svg>
                   </div>
                 </div>`,
        }),
      })
        .bindPopup(`<b>${origin.name}</b><br/>Drag me anywhere to check that position`)
        .addTo(group);

      boat.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      });
      boat.on("dragstart", () => {
        isBoatDragRef.current = true;
        setDragging(true);
      });
      boat.on("dragend", async () => {
        setDragging(false);
        const { lat, lng } = boat.getLatLng();
        const nextLatitude = +lat.toFixed(4);
        const nextLongitude = +lng.toFixed(4);
        onPickLocation?.(nextLatitude, nextLongitude);
        try {
          setProbe(await api.checkPosition(nextLatitude, nextLongitude));
        } catch {
          setProbe(null);
        }
      });

      boatRef.current = boat;
      bounds.push([origin.latitude, origin.longitude]);
    }

    const originKey = origin ? `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}` : null;
    const wasDrag = isBoatDragRef.current;
    isBoatDragRef.current = false;

    // Only fitBounds on initial load or if location changed from an external picker/GPS.
    // Never reset user zoom/pan during interactive zooming, panning, or boat dragging.
    if (!initialFitDoneRef.current) {
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.22), { animate: false });
        initialFitDoneRef.current = true;
      } else if (origin) {
        map.setView([origin.latitude, origin.longitude], 10, { animate: false });
        initialFitDoneRef.current = true;
      }
    } else if (!wasDrag && originKey && prevOriginKeyRef.current && originKey !== prevOriginKeyRef.current) {
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.22), { animate: true });
      } else if (origin) {
        map.setView([origin.latitude, origin.longitude], map.getZoom(), { animate: true });
      }
    }
    prevOriginKeyRef.current = originKey;
  }, [origin, emergencyRoute, zones, pfz, areas, routes, radiusKm, focusRank, alerts, onPickLocation]);

  // Fly to a ground when the user taps its card in the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRank) return;
    const target = areas.find((a) => a.rank === focusRank);
    if (target) map.flyTo([target.latitude, target.longitude], 11, { duration: 0.8 });
  }, [focusRank, areas]);

  const critical = geofence.filter((g) => g.severity === "critical");
  const banner =
    probe != null
      ? { style: STATUS_STYLE[probe.status], text: probe.headline, sub: probeSub(probe) }
      : critical.length
        ? { style: STATUS_STYLE.critical, text: critical[0].message, sub: null }
        : null;

  const lg = LEGEND[language] ?? LEGEND.en;

  return (
    <div
      className="chart-sheet"
      style={fill ? { height: "100%", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : undefined}
    >
      {/* Admiralty-style chart header strip */}
      <div className="chart-header-bar">
        <span className="chart-header-label chart-header-label--accent">
          ◉ {lg.marginL}
        </span>
        <span className="chart-header-label">
          {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
        </span>
      </div>

      <div
        className="chart-frame"
        style={fill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" } : undefined}
      >
        {/*
          The height is an inline style on purpose. Leaflet adds its own classes
          (leaflet-container, leaflet-touch, ...) to this element on mount; a
          conditional `className` makes React rewrite the whole class attribute
          when it changes, silently removing them. Without leaflet-container the
          library's CSS stops applying, the tile panes collapse to 0x0 and every
          tile renders at zero width — tiles download fine, the map just vanishes.
          React writes style properties individually, so this leaves classes alone.
        */}
        <div
          ref={containerRef}
          className="w-full"
          style={
            fill
              ? { flex: 1, minHeight: 380, height: "100%", width: "100%" }
              : { height: mapHeight, minHeight: typeof mapHeight === "number" ? mapHeight : 440 }
          }
        />

        {/* Animated ocean surface — subtle moving water swell and current drift */}
        <div className="ocean-water-anim" aria-hidden="true">
          <div className="ocean-swell-layer ocean-swell-layer--1" />
          <div className="ocean-swell-layer ocean-swell-layer--2" />
          <div className="ocean-caustic-layer" />
        </div>

        {/* Compass rose — top-right corner overlay */}
        <div className="chart-compass">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
            {/* Outer ring */}
            <circle cx="28" cy="28" r="26" stroke="rgba(0,168,204,0.4)" strokeWidth="0.8" />
            {/* Cardinal tick marks */}
            {[0, 90, 180, 270].map((deg) => (
              <line
                key={deg}
                x1="28" y1="4" x2="28" y2="8"
                stroke="rgba(0,168,204,0.7)" strokeWidth="1.2"
                transform={`rotate(${deg} 28 28)`}
              />
            ))}
            {/* Inter-cardinal ticks */}
            {[45, 135, 225, 315].map((deg) => (
              <line
                key={deg}
                x1="28" y1="4" x2="28" y2="6"
                stroke="rgba(0,168,204,0.35)" strokeWidth="0.8"
                transform={`rotate(${deg} 28 28)`}
              />
            ))}
            {/* North needle (bright) */}
            <polygon points="28,6 31,28 28,24 25,28" fill="rgba(0,229,255,0.9)" />
            {/* South needle (dim) */}
            <polygon points="28,50 31,28 28,32 25,28" fill="rgba(0,168,204,0.3)" />
            {/* Centre dot */}
            <circle cx="28" cy="28" r="2.5" fill="rgba(0,168,204,0.8)" />
            {/* N label */}
            <text x="28" y="3" textAnchor="middle" fontSize="5" fontWeight="800"
              fontFamily="Spline Sans Mono Variable, Consolas, monospace"
              fill="rgba(0,229,255,0.8)" letterSpacing="0.08em">N</text>
          </svg>
        </div>

        {/* Live coordinate readout badge */}
        <div ref={coordBadgeRef} className="chart-coordinate-badge" />

        {/* Chart key (redesigned legend) */}
        <div className="chart-key pointer-events-none absolute bottom-3 left-3 z-[500] shadow-md">
          <div className="chart-key-hd">{lg.symbols}</div>
          {([
            { sym: <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #1D7A50", background: "transparent", display: "inline-block" }} />, label: lg.veryGood },
            { sym: <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #B08000", background: "transparent", display: "inline-block" }} />, label: lg.some },
            { sym: <svg width="10" height="10" aria-hidden><rect x="0.5" y="0.5" width="9" height="9" fill="url(#hatch-critical)" stroke="#AF2318" strokeWidth="1" /></svg>, label: lg.noEntry },
            { sym: <svg width="14" height="6" aria-hidden><line x1="0" y1="3" x2="14" y2="3" stroke="#1D7A50" strokeWidth="2" strokeDasharray="4 2.5" /></svg>, label: lg.course },
          ] as { sym: React.ReactNode; label: string }[]).map(({ sym, label }) => (
            <div key={label} className="chart-key-row">
              <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{sym}</span>
              <span>{label}</span>
            </div>
          ))}
          {alerts.some((a) => a.storm) && (
            <div className="chart-key-row">
              <svg width="11" height="11" viewBox="0 0 56 56" fill="none" aria-hidden>
                <path d="M28 5 A 23 23 0 0 1 51 28" stroke="#AF2318" strokeWidth="9" strokeLinecap="round" />
                <path d="M28 51 A 23 23 0 0 1 5 28" stroke="#AF2318" strokeWidth="9" strokeLinecap="round" />
                <circle cx="28" cy="28" r="12" fill="#AF2318" />
              </svg>
              <span>{lg.storm}</span>
            </div>
          )}
        </div>

        {/* Map Layers Toggle & Legends */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col items-end gap-2 pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            <button
              onClick={() => setShowSST(!showSST)}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-[11px] font-bold shadow-md transition-colors ${
                showSST ? "bg-[var(--ocean)] text-white border-[var(--ocean-bright)]" : "bg-paper-50 text-[var(--text-mid)] border-[var(--border)]"
              }`}
              style={{ border: "1px solid" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: showSST ? "#fff" : "transparent", border: "1px solid currentColor" }} />
              SST Layer
            </button>
            <button
              onClick={() => setShowChl(!showChl)}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-[11px] font-bold shadow-md transition-colors ${
                showChl ? "bg-[#1D7A50] text-white border-[#249864]" : "bg-paper-50 text-[var(--text-mid)] border-[var(--border)]"
              }`}
              style={{ border: "1px solid" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: showChl ? "#fff" : "transparent", border: "1px solid currentColor" }} />
              Chlorophyll
            </button>
            <button
              onClick={() => setShowWeatherHazards(!showWeatherHazards)}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-[11px] font-bold shadow-md transition-colors ${
                showWeatherHazards ? "bg-[#5b21b6] text-white border-[#7c3aed]" : "bg-paper-50 text-[var(--text-mid)] border-[var(--border)]"
              }`}
              style={{ border: "1px solid" }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: showWeatherHazards ? "#fff" : "transparent", border: "1px solid currentColor" }} />
              Weather Hazards
            </button>
          </div>
          
          <div className="flex flex-col gap-2 pointer-events-auto">
            {showSST && sstGrid && (
              <div className="bg-paper-50 p-2.5 text-[10px] font-mono shadow-md rounded" style={{ color: "var(--text-mid)", border: "1px solid var(--border)" }}>
                 <div className="mb-1.5 font-bold">Sea Surface Temp °C</div>
                 <div className="flex h-2.5 w-40 rounded" style={{ background: "linear-gradient(to right, rgb(0,0,255), rgb(0,255,255), rgb(0,255,0), rgb(255,255,0), rgb(255,0,0))" }} />
                 <div className="flex justify-between mt-1" style={{ color: "var(--text-faint)" }}>
                    <span>24°</span><span>28°</span><span>32°</span>
                 </div>
              </div>
            )}
            
            {showChl && chlGrid && (
              <div className="bg-paper-50 p-2.5 text-[10px] font-mono shadow-md rounded" style={{ color: "var(--text-mid)", border: "1px solid var(--border)" }}>
                 <div className="mb-1.5 font-bold">Chlorophyll mg/m³ (log)</div>
                 <div className="flex h-2.5 w-40 rounded" style={{ background: "linear-gradient(to right, rgb(0,0,128), rgb(0,255,255), rgb(0,255,0), rgb(255,255,0), rgb(255,0,0))" }} />
                 <div className="flex justify-between mt-1" style={{ color: "var(--text-faint)" }}>
                    <span>0.1</span><span>1</span><span>10</span>
                 </div>
              </div>
            )}
            {showWeatherHazards && (
              <div className="bg-paper-50 p-2.5 text-[10px] font-mono shadow-md rounded" style={{ color: "var(--text-mid)", border: "1px solid var(--border)" }}>
                <div className="mb-1.5 font-bold">LIVE WEATHER HAZARDS</div>
                {weatherUnavailable ? <div>Live weather hazards unavailable</div> : (
                  ([
                    ["LIGHT_RAIN", "#54bdf7", "Light Rain"], ["HEAVY_RAIN", "#0754a5", "Heavy Rain"],
                    ["THUNDERSTORM", "#7c3aed", "Thunderstorm"], ["CYCLONE", "#dc2626", "Cyclone / Hurricane"],
                  ] as const).filter(([type]) => weatherHazards?.some((h) => h.type === type)).map(([, color, label]) => (
                    <div className="flex items-center gap-1.5" key={label}><span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />{label}</div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Drag hint */}
        {origin && !probe && !dragging && (
          <div
            className="chart-key pointer-events-none absolute bottom-0 right-0 z-[500] shadow-md"
            style={{ padding: "4px 9px" }}
          >
            <span style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--text-mid)",
            }}>
              {HINT[language] ?? HINT.en}
            </span>
          </div>
        )}

        {/* Live geofence banner */}
        {banner && (
          <div
            className={`absolute left-1/2 top-3 z-[500] max-w-[78%] -translate-x-1/2 animate-rise rounded-[2px] px-3.5 py-2 text-[12px] font-semibold text-paper-50 shadow-lg ${banner.style}`}
          >
            <div>{banner.text}</div>
            {banner.sub && (
              <div className="mt-0.5 font-mono text-[10px] font-normal opacity-85">{banner.sub}</div>
            )}
          </div>
        )}
      </div>

      {/* Sheet margin note */}
      <div className="mt-[7px] flex items-baseline justify-between shrink-0">
        <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          {lg.marginR}
        </span>
        <span
          className="chart-header-label"
          style={{ fontSize: 7, letterSpacing: "0.14em" }}
        >
          WGS 84 · SOUNDINGS IN METRES
        </span>
      </div>
    </div>
  );
}

function probeSub(p: PositionCheck): string {
  const bits: string[] = [];
  if (p.distance_from_shore_km != null) bits.push(`${p.distance_from_shore_km} km offshore`);
  if (p.nearest_zone_name && p.nearest_zone_km != null && !p.inside_restricted_zone)
    bits.push(`${p.nearest_zone_name}: ${p.nearest_zone_km} km`);
  return bits.join(" · ");
}
