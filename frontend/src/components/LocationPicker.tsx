import { useEffect, useRef, useState } from "react";
import type { Language } from "../types";
import { CrosshairGlyph } from "./glyphs";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  label: string;
  source: "gps" | "map" | "port" | "default";
}

/** Landing centres a fisher can pick without typing coordinates. */
export const PORTS: { name: string; state: string; lat: number; lon: number }[] = [
  { name: "Mumbai", state: "Maharashtra", lat: 18.922, lon: 72.8347 },
  { name: "Ratnagiri", state: "Maharashtra", lat: 16.9902, lon: 73.312 },
  { name: "Panaji (Goa)", state: "Goa", lat: 15.4909, lon: 73.8278 },
  { name: "Veraval", state: "Gujarat", lat: 20.907, lon: 70.3679 },
  { name: "Kochi", state: "Kerala", lat: 9.9312, lon: 76.2673 },
  { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707 },
  { name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lon: 83.2185 },
  { name: "Paradip", state: "Odisha", lat: 20.2648, lon: 86.6947 },
  { name: "Digha", state: "West Bengal", lat: 21.627, lon: 87.509 },
  { name: "Port Blair", state: "Andaman & Nicobar", lat: 11.6234, lon: 92.7265 },
];

const T: Record<Language, Record<string, string>> = {
  en: {
    yourLocation: "Your location",
    useGps: "Use my location",
    locating: "Finding you…",
    denied: "Location blocked — pick your harbour below",
    unavailable: "Location unavailable — pick your harbour below",
    pickPort: "Choose harbour",
    tapMap: "You can also tap anywhere on the map",
    gps: "GPS",
    search: "Search harbour",
  },
  hi: {
    yourLocation: "आपका स्थान",
    useGps: "मेरा स्थान लें",
    locating: "आपको खोज रहे हैं…",
    denied: "स्थान बंद है — नीचे अपना बंदरगाह चुनें",
    unavailable: "स्थान उपलब्ध नहीं — नीचे अपना बंदरगाह चुनें",
    pickPort: "बंदरगाह चुनें",
    tapMap: "आप नक्शे पर कहीं भी टैप कर सकते हैं",
    gps: "जीपीएस",
    search: "बंदरगाह खोजें",
  },
  kn: {
    yourLocation: "ನಿಮ್ಮ ಸ್ಥಳ",
    useGps: "ನನ್ನ ಸ್ಥಳ ಬಳಸಿ",
    locating: "ನಿಮ್ಮನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ…",
    denied: "ಸ್ಥಳ ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ — ಕೆಳಗಿನ ಬಂದರನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    unavailable: "ಸ್ಥಳ ಲಭ್ಯವಿಲ್ಲ — ಕೆಳಗಿನ ಬಂದರನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    pickPort: "ಬಂದರು ಆಯ್ಕೆಮಾಡಿ",
    tapMap: "ನಕ್ಷೆಯಲ್ಲಿ ಎಲ್ಲಿಯಾದರೂ ಟ್ಯಾಪ್ ಮಾಡಬಹುದು",
    gps: "GPS",
    search: "ಬಂದರನ್ನು ಹುಡುಕಿ",
  },
};

export default function LocationPicker({
  current,
  language = "en",
  onPick,
}: {
  current: PickedLocation | null;
  language?: Language;
  onPick: (loc: PickedLocation) => void;
}) {
  const t = T[language] ?? T.en;
  const [status, setStatus] = useState<"idle" | "locating" | "denied" | "error">("idle");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const useGps = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("idle");
        onPick({
          latitude: +pos.coords.latitude.toFixed(4),
          longitude: +pos.coords.longitude.toFixed(4),
          label: t.yourLocation,
          source: "gps",
        });
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  const matches = query
    ? PORTS.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.state.toLowerCase().includes(query.toLowerCase()),
      )
    : PORTS;

  return (
    <div ref={boxRef} className="panel relative z-[600] px-3 py-2 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-1.5">
          <div className="label !text-[7.5px] !mb-0">{t.yourLocation}</div>
          {current && (
            <span className="font-mono text-[9.5px] tabular-nums text-ink-400">
              {current.latitude.toFixed(2)}°N, {current.longitude.toFixed(2)}°E
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="truncate font-display text-[14px] font-bold leading-tight text-ink-900">
            {current?.label ?? "—"}
          </span>
          {current?.source === "gps" && (
            <span className="shrink-0 border border-risk-low/70 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider text-risk-low">
              {t.gps}
            </span>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={useGps} disabled={status === "locating"} className="btn-line !py-0.5 !px-2 !text-[10px] disabled:opacity-55">
            <CrosshairGlyph size={11} />
            {status === "locating" ? t.locating : t.useGps}
          </button>

          <button onClick={() => setOpen((v) => !v)} className="btn-line !py-0.5 !px-2 !text-[10px]">
            {t.pickPort} ▾
          </button>
        </div>

        {(status === "denied" || status === "error") && (
          <p className="text-[10px] font-medium text-risk-high">
            {status === "denied" ? t.denied : t.unavailable}
          </p>
        )}
      </div>


      {open && (
        <div
          className="absolute left-3 right-3 top-full z-[700] mt-2 overflow-hidden rounded-[3px] border shadow-xl"
          style={{ borderColor: "var(--rule-strong)", background: "var(--paper-bright)" }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="w-full border-b bg-transparent px-4 py-3 text-[13px] text-ink-800 outline-none placeholder:text-ink-300"
            style={{ borderColor: "var(--rule)" }}
          />
          <div className="max-h-64 overflow-y-auto py-1">
            {matches.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  onPick({
                    latitude: p.lat,
                    longitude: p.lon,
                    label: p.name,
                    source: "port",
                  });
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-baseline gap-2 border-b px-4 py-2.5 text-left transition last:border-0 hover:bg-paper-150"
                style={{ borderColor: "var(--rule-faint)" }}
              >
                <span className="text-[13px] font-semibold text-ink-900">{p.name}</span>
                <span className="text-[11px] text-ink-400">{p.state}</span>
                <span className="ml-auto font-mono text-[9.5px] tabular-nums text-ink-300">
                  {p.lat.toFixed(2)}°N {p.lon.toFixed(2)}°E
                </span>
              </button>
            ))}
            {!matches.length && <div className="px-4 py-3 text-[12px] text-ink-400">—</div>}
          </div>
        </div>
      )}
    </div>
  );
}
