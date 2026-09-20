/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ORCA Maritime Intelligence — deep navy operational palette
        marine: {
          950: "#020810",
          900: "#050E18",
          850: "#071526",
          800: "#0A1929",
          750: "#0C1F32",
          700: "#0F2236",
          600: "#132A42",
          500: "#1A3652",
          400: "#234462",
          300: "#2E5478",
          200: "#3D6B94",
          100: "#5589B0",
        },
        ocean: {
          900: "#003D52",
          800: "#005066",
          700: "#00657D",
          600: "#007A96",
          500: "#008FB0",
          400: "#00A8CC",
          300: "#00C3E8",
          200: "#00DEFF",
          100: "#7AEEFF",
          50:  "#C5F7FF",
        },
        // Semantic risk — bright, high-contrast against dark background
        risk: {
          low:      "#22C55E",
          moderate: "#F59E0B",
          high:     "#F97316",
          extreme:  "#EF4444",
        },
        // Text system
        text: {
          bright: "#E8F4F8",
          mid:    "#8BAFC4",
          dim:    "#4A6E85",
          faint:  "#2E4A5E",
        },
        // Emergency red
        emergency: "#EF4444",
        // Signal colours (kept for backwards compat in Leaflet markers)
        signal: "#EF4444",
        // Legacy alias paper/ink — mapped to new marine palette so any
        // residual Tailwind classes don't error
        paper: {
          50:  "var(--surface)",
          100: "var(--surface-2)",
          150: "var(--surface-3)",
          200: "var(--surface-3)",
          300: "var(--border)",
          400: "var(--border-strong)",
        },
        ink: {
          900: "var(--text-bright)",
          800: "var(--text-bright)",
          700: "var(--text-mid)",
          500: "var(--text-mid)",
          400: "var(--text-dim)",
          300: "var(--text-faint)",
        },
        chart: {
          700: "#007A96",
          600: "#008FB0",
          500: "#00A8CC",
          300: "#5589B0",
          100: "#0F2236",
        },
      },
      fontFamily: {
        display: [
          '"Fraunces Variable"',
          '"Noto Serif Devanagari Variable"',
          "Georgia",
          "serif",
        ],
        sans: [
          '"Inter"',
          '"Nirmala UI"',
          "system-ui",
          "sans-serif",
        ],
        mono: ['"Spline Sans Mono Variable"', '"Nirmala UI"', "Consolas", "monospace"],
      },
      keyframes: {
        // Entrance — transform only, never opacity-0 (safety data must always render)
        rise: {
          "0%": { transform: "translateY(10px)" },
          "100%": { transform: "translateY(0)" },
        },
        stampIn: {
          "0%": { transform: "scale(1.3) rotate(-5deg)" },
          "60%": { transform: "scale(0.96) rotate(-1.4deg)" },
          "100%": { transform: "scale(1) rotate(-2deg)" },
        },
        // Sonar ring — expands and fades
        sonar: {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "100%": { transform: "scale(2.8)", opacity: "0" },
        },
        // Radar sweep — rotates around center
        radar: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        // Signal travelling a wire
        signal: {
          "0%":   { left: "0%", opacity: "0" },
          "12%":  { opacity: "1" },
          "88%":  { opacity: "1" },
          "100%": { left: "calc(100% - 6px)", opacity: "0" },
        },
        // Blink — used for SOS and live indicators
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.2" },
        },
        // Ping for Leaflet markers (referenced by inline styles)
        ping2: {
          "0%":   { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        // Bar draw-in
        growx: {
          from: { transform: "scaleX(0)" },
        },
        // Dash travel (route animation, Leaflet)
        dashdrift: {
          to: { strokeDashoffset: "-48" },
        },
        // Compass sway
        needlesway: {
          "0%, 100%": { transform: "rotate(-7deg)" },
          "50%":      { transform: "rotate(6deg)" },
        },
        // Bob (Leaflet boat marker)
        bob: {
          "0%, 100%": { transform: "translateY(1.5px)" },
          "50%":      { transform: "translateY(-2.5px)" },
        },
        // Roll (Leaflet boat marker)
        roll: {
          "0%, 100%": { transform: "rotate(-2.5deg)" },
          "50%":      { transform: "rotate(2deg)" },
        },
        // Pop-in for readings
        popin: {
          "0%":   { transform: "scale(0.7)" },
          "70%":  { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)" },
        },
        // Storm spin (Leaflet)
        stormspin: {
          to: { transform: "rotate(360deg)" },
        },
        // X travel (System page signals)
        travelx: {
          "0%":   { left: "0%", opacity: "0" },
          "12%":  { opacity: "1" },
          "88%":  { opacity: "1" },
          "100%": { left: "calc(100% - 6px)", opacity: "0" },
        },
        // Fish swim
        swim: {
          "0%, 100%": { transform: "translateX(0) rotate(0deg)" },
          "50%":      { transform: "translateX(-4px) rotate(-2.5deg)" },
        },
        // Fish school
        schoolrun: {
          to: { backgroundPositionX: "620px" },
        },
        // Sea drift layers
        seadrift_a: { to: { backgroundPositionX: "-280px" } },
        seadrift_b: { to: { backgroundPositionX: "340px" } },
        seadrift_c: { to: { backgroundPositionX: "-420px" } },
        // Ink blink
        inkblink: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.25" },
        },
        // Wave crawl
        wavecrawl: {
          to: { backgroundPositionX: "-14px" },
        },
        // Glow pulse for emergency elements
        glowpulse: {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(239,68,68,0.6)" },
          "50%":      { boxShadow: "0 0 20px 6px rgba(239,68,68,0.9)" },
        },
      },
      animation: {
        rise:       "rise .35s ease-out both",
        stampIn:    "stampIn .45s cubic-bezier(.2,.9,.3,1.2) both",
        sonar:      "sonar 2s cubic-bezier(0,0,.2,1) infinite",
        "sonar-slow": "sonar 3.2s cubic-bezier(0,0,.2,1) infinite",
        radar:      "radar 4s linear infinite",
        blink:      "blink 1.2s ease-in-out infinite",
        glowpulse:  "glowpulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
