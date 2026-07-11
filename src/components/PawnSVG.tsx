import { useId } from 'react';
import type { Color } from '../game/types.ts';

/** Glossy 3D-style board game pawn, rendered as pure SVG.
 *  Ludo Club proportions: a BIG shiny sphere head, a short plump
 *  bell body flaring into a fat rounded base, and a crisp darker
 *  outline around every part. */

const PAWN_PALETTE: Record<Color, { base: string; light: string; dark: string; deep: string }> = {
  red:    { base: '#f0405c', light: '#ff8fa0', dark: '#c22343', deep: '#7e1229' },
  green:  { base: '#26c165', light: '#7dedaa', dark: '#178a49', deep: '#0b532c' },
  yellow: { base: '#f5a415', light: '#ffd873', dark: '#c07c08', deep: '#7c4f05' },
  blue:   { base: '#3d7bfa', light: '#8fb8ff', dark: '#2453c4', deep: '#143077' },
};

interface PawnSVGProps {
  color: Color;
  className?: string;
  /** Draw the soft ground shadow (on-board pieces want it; UI icons may not). */
  shadow?: boolean;
}

export default function PawnSVG({ color, className, shadow = true }: PawnSVGProps) {
  const uid = useId();
  const c = PAWN_PALETTE[color];
  const headId = `${uid}-head`;
  const bodyId = `${uid}-body`;
  const baseId = `${uid}-base`;

  return (
    <svg viewBox="0 0 64 80" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={headId} cx="34%" cy="26%" r="85%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="52%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
        <linearGradient id={bodyId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.dark} />
          <stop offset="26%" stopColor={c.light} />
          <stop offset="55%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.deep} />
        </linearGradient>
        <linearGradient id={baseId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.dark} />
          <stop offset="28%" stopColor={c.light} />
          <stop offset="58%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.deep} />
        </linearGradient>
      </defs>

      {shadow && <ellipse cx="32" cy="74" rx="23" ry="5.5" fill="rgba(30, 12, 50, 0.32)" />}

      {/* Fat rounded base (torus) */}
      <path d="M10.5 62 L10.5 68 A21.5 8.5 0 0 0 53.5 68 L53.5 62 Z" fill={c.deep} />
      <ellipse cx="32" cy="68" rx="21.5" ry="8.5" fill={c.deep} />
      <ellipse cx="32" cy="62" rx="21.5" ry="8.5" fill={`url(#${baseId})`} stroke={c.deep} strokeWidth="1.4" />

      {/* Plump bell body: wide flare, short height */}
      <path
        d="M32 28 C22 31 17.5 42 15 58 C21.5 63.5 42.5 63.5 49 58 C46.5 42 42 31 32 28 Z"
        fill={`url(#${bodyId})`}
        stroke={c.deep}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      {/* Collar ring under the head */}
      <ellipse cx="32" cy="31.5" rx="10.5" ry="4" fill={c.dark} opacity="0.5" />

      {/* Big glossy sphere head (chubby look) */}
      <circle cx="32" cy="18" r="15.5" fill={`url(#${headId})`} stroke={c.deep} strokeWidth="1.4" />

      {/* Specular highlights */}
      <ellipse cx="26" cy="11" rx="5.6" ry="4" fill="#ffffff" opacity="0.85" transform="rotate(-22 26 11)" />
      <circle cx="22.5" cy="17.5" r="1.9" fill="#ffffff" opacity="0.55" />
      <path
        d="M24.5 36 C22.5 42 21.3 50 20.6 56"
        stroke="#ffffff"
        strokeOpacity="0.4"
        strokeWidth="3.4"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="22" cy="60.5" rx="3.4" ry="1.8" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}
