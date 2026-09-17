/**
 * The sheet's ink glyphs. Every icon is drawn here as inline SVG —
 * no emoji anywhere: emoji glyphs vary by OS, break the drafted-chart
 * voice, and can fail to render on a projector machine entirely.
 */

import type { CSSProperties } from "react";
import logoUrl from "../assets/logo.png";
type G = { size?: number; className?: string; style?: CSSProperties };

/**
 * OrcaLogo — primary ORCA brand mark.
 * Side-profile killer whale: pointed snout (left), very tall dorsal fin (centre),
 * iconic white eye patch, white belly patch, and horizontal tail flukes (right).
 * Uses currentColor for the black body so it respects the theme colour.
 */
export function OrcaLogo({ size = 44, className = "", style }: G) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", borderRadius: "50%", ...style }}
      alt="ORCA Logo"
      aria-hidden
    />
  );
}

/** The ORCA mark: a compass rose whose needle is a dorsal fin breaking the waterline. */
export function CompassMark({ size = 44, className = "", style }: G) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      className={className}
      style={style}
      aria-hidden
    >
      <circle cx="22" cy="22" r="20" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="22" cy="22" r="16.5" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
      {/* tick ring */}
      {Array.from({ length: 16 }).map((_, i) => {
        const a = (i * Math.PI) / 8;
        const long = i % 4 === 0;
        const r1 = long ? 17.4 : 18.6;
        return (
          <line
            key={i}
            x1={22 + r1 * Math.sin(a)}
            y1={22 - r1 * Math.cos(a)}
            x2={22 + 20 * Math.sin(a)}
            y2={22 - 20 * Math.cos(a)}
            stroke="currentColor"
            strokeWidth={long ? 1.4 : 0.7}
          />
        );
      })}
      {/* the fin is the needle — it points north */}
      <g className="compass-needle">
        <path
          d="M17.2 27.5 C17.2 19.5 19.6 12.5 22.3 9 C22.9 15 25.4 21 27.1 27.5 Z"
          fill="currentColor"
        />
      </g>
      {/* waterline */}
      <path
        d="M10.5 30 Q14 27.6 17.5 30 T24.5 30 T31.5 30"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M13.5 33.5 Q16.5 31.5 19.5 33.5 T25.5 33.5 T31 33.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function SpeakerGlyph({ size = 16, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 7.5 H6.5 L10.5 4 V16 L6.5 12.5 H3.5 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13 7 A4.2 4.2 0 0 1 13 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.2 5 A7.4 7.4 0 0 1 15.2 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function SpeakerOffGlyph({ size = 16, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 7.5 H6.5 L10.5 4 V16 L6.5 12.5 H3.5 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M13.2 8 L17.2 12 M17.2 8 L13.2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MicGlyph({ size = 16, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="7.2" y="2.5" width="5.6" height="9" rx="2.8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.5 9.5 A5.5 5.5 0 0 0 15.5 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M10 15 V17.5 M7 17.5 H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function StopGlyph({ size = 14, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="9" height="9" fill="currentColor" />
    </svg>
  );
}

/** Drafting arrow — plotted-course style, with barbs. */
export function CourseArrow({ size = 16, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path d="M2.5 10 H16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M11.5 4.5 L17.5 10 L11.5 15.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function CrosshairGlyph({ size = 15, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="1.2" fill="currentColor" />
      <path
        d="M10 1.5 V5 M10 15 V18.5 M1.5 10 H5 M15 10 H18.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WarnGlyph({ size = 14, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M10 2.6 L18.4 17 H1.6 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 8 V12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="10" cy="14.6" r="1" fill="currentColor" />
    </svg>
  );
}

export function LockGlyph({ size = 13, className = "", style }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} style={style} aria-hidden>
      <rect x="4" y="9" width="12" height="8.5" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.8 9 V6.8 A3.2 3.2 0 0 1 13.2 6.8 V9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="13.2" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function CheckGlyph({ size = 13, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 10.5 L8 15 L16.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A fish in ink — side profile, swimming left. */
export function FishGlyph({ size = 16, className = "" }: G) {
  return (
    <svg
      width={size}
      height={size * 0.55}
      viewBox="0 0 22 12"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M1.5 6 C4.5 1.8 10 1.2 14 4.6 L20.5 1.5 C19.3 3 18.7 4.5 18.7 6 C18.7 7.5 19.3 9 20.5 10.5 L14 7.4 C10 10.8 4.5 10.2 1.5 6 Z"
        fill="currentColor"
      />
      <circle cx="5" cy="5.3" r="0.9" fill="#F5EEDD" />
    </svg>
  );
}

/** Three fish travelling together — the school. */
export function SchoolGlyph({ size = 34, className = "", style }: G) {
  return (
    <svg
      width={size}
      height={size * 0.62}
      viewBox="0 0 44 27"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden
    >
      <g opacity="0.9">
        <path d="M1 6.5 C3.2 3.5 7 3.1 9.8 5.5 L14.2 3.4 C13.4 4.4 13 5.4 13 6.5 C13 7.6 13.4 8.6 14.2 9.6 L9.8 7.5 C7 9.9 3.2 9.5 1 6.5 Z" />
      </g>
      <g opacity="0.65">
        <path d="M18 13.5 C20.2 10.5 24 10.1 26.8 12.5 L31.2 10.4 C30.4 11.4 30 12.4 30 13.5 C30 14.6 30.4 15.6 31.2 16.6 L26.8 14.5 C24 16.9 20.2 16.5 18 13.5 Z" />
      </g>
      <g opacity="0.45">
        <path d="M6 20.5 C8.2 17.5 12 17.1 14.8 19.5 L19.2 17.4 C18.4 18.4 18 19.4 18 20.5 C18 21.6 18.4 22.6 19.2 23.6 L14.8 21.5 C12 23.9 8.2 23.5 6 20.5 Z" />
      </g>
    </svg>
  );
}

/** Small fishing boat in side profile, for hints and empty states. */
export function BoatGlyph({ size = 16, className = "", style }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" className={className} style={style} aria-hidden>
      <path d="M11 3.2 V12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M11 4.5 L16.5 12 H11 Z" fill="currentColor" />
      <path
        d="M4.5 13.5 H17.5 L15.5 17 H6.5 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 19.5 Q4.5 18 6.5 19.5 T10.5 19.5 T14.5 19.5 T18.5 19.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export function PauseGlyph({ size = 13, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} aria-hidden>
      <rect x="2.6" y="2" width="3.2" height="10" fill="currentColor" />
      <rect x="8.2" y="2" width="3.2" height="10" fill="currentColor" />
    </svg>
  );
}

export function PlayGlyph({ size = 13, className = "" }: G) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={className} aria-hidden>
      <path d="M3.5 2 L12 7 L3.5 12 Z" fill="currentColor" />
    </svg>
  );
}

/** SVG <defs> injected once at app root: chart hatch patterns for the map. */
export function ChartDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <pattern id="hatch-critical" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#AF2318" fillOpacity="0.08" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#AF2318" strokeWidth="1.6" strokeOpacity="0.5" />
        </pattern>
        <pattern id="hatch-warning" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#BF4E12" fillOpacity="0.07" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#BF4E12" strokeWidth="1.4" strokeOpacity="0.45" />
        </pattern>
        <pattern id="hatch-info" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#2A7391" fillOpacity="0.05" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#2A7391" strokeWidth="1.2" strokeOpacity="0.4" />
        </pattern>
      </defs>
    </svg>
  );
}
