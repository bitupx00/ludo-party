import { useId } from 'react';
import type { Color } from '../game/types.ts';

/** Glossy 3D-style board game pawn, rendered as pure SVG. */

const PAWN_PALETTE: Record<Color, { base: string; light: string; dark: string; deep: string }> = {
  red:    { base: '#f0405c', light: '#ff8fa0', dark: '#c22343', deep: '#8f1730' },
  green:  { base: '#26c165', light: '#7dedaa', dark: '#178a49', deep: '#0e6234' },
  yellow: { base: '#f5a415', light: '#ffd873', dark: '#c07c08', deep: '#8f5c06' },
  blue:   { base: '#3d7bfa', light: '#8fb8ff', dark: '#2453c4', deep: '#183a8f' },
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
        <radialGradient id={headId} cx="36%" cy="28%" r="80%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="55%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
        <linearGradient id={bodyId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.dark} />
          <stop offset="28%" stopColor={c.light} />
          <stop offset="55%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.deep} />
        </linearGradient>
        <linearGradient id={baseId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.dark} />
          <stop offset="30%" stopColor={c.light} />
          <stop offset="60%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.deep} />
        </linearGradient>
      </defs>

      {shadow && <ellipse cx="32" cy="73" rx="21" ry="6" fill="rgba(30, 12, 50, 0.3)" />}

      {/* Base disc */}
      <ellipse cx="32" cy="68" rx="19" ry="8.5" fill={c.deep} />
      <path d="M13 62 L13 68 A19 8.5 0 0 0 51 68 L51 62 Z" fill={c.deep} />
      <ellipse cx="32" cy="62" rx="19" ry="8.5" fill={`url(#${baseId})`} />

      {/* Body cone */}
      <path
        d="M32 24 C25.5 28 22.5 38 20 58 C24 61.5 40 61.5 44 58 C41.5 38 38.5 28 32 24 Z"
        fill={`url(#${bodyId})`}
      />

      {/* Collar ring */}
      <ellipse cx="32" cy="26.5" rx="8.5" ry="3.6" fill={c.dark} opacity="0.55" />

      {/* Head sphere */}
      <circle cx="32" cy="16" r="12.5" fill={`url(#${headId})`} />

      {/* Specular highlights */}
      <ellipse cx="27" cy="10.5" rx="4.6" ry="3.2" fill="#ffffff" opacity="0.65" transform="rotate(-20 27 10.5)" />
      <path
        d="M26 32 C24.5 38 23.5 46 22.8 54"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="24" cy="60" rx="3" ry="1.6" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}
