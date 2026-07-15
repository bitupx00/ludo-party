import type { Color } from '../game/types.ts';

/** Ludo Club-style 3D glossy pawn, rendered from pre-generated sprite
 *  images (public/assets/pawn-*.png). Keeps the old PawnSVG API so every
 *  caller (Piece, Home, Lobby, WinScreen) works unchanged. */

const PAWN_SRC: Record<Color, string> = {
  red: '/assets/pawn-red.png',
  green: '/assets/pawn-green.png',
  yellow: '/assets/pawn-yellow.png',
  blue: '/assets/pawn-blue.png',
};

interface PawnSVGProps {
  color: Color;
  className?: string;
  /** Draw the soft ground shadow (on-board pieces want it; UI icons may not). */
  shadow?: boolean;
}

export default function PawnSVG({ color, className, shadow = true }: PawnSVGProps) {
  return (
    <img
      src={PAWN_SRC[color] || '/placeholder.svg'}
      alt=""
      draggable={false}
      className={className}
      aria-hidden="true"
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        filter: shadow ? 'drop-shadow(0 4px 3px rgba(10, 20, 50, 0.4))' : undefined,
        userSelect: 'none',
      }}
    />
  );
}
