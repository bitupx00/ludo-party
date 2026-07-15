import type { Color } from './types';

/**
 * Board rotation (Ludo Club style): each player sees their own color at the
 * BOTTOM-LEFT corner. Only the rendering rotates — logical positions (and
 * therefore online sync) are untouched.
 *
 * Unrotated corners: red = top-left, blue = top-right,
 *                    green = bottom-left, yellow = bottom-right.
 */

/** Clockwise quarter-turns that bring each color to the bottom-left corner. */
export const ROTATION_FOR_COLOR: Record<Color, number> = {
  green: 0,
  yellow: 1,
  blue: 2,
  red: 3,
};

/** Rotate a (possibly fractional) 15×15 cell coordinate k quarter-turns clockwise. */
export function rotateCell(x: number, y: number, k: number): { x: number; y: number } {
  let cx = x;
  let cy = y;
  const turns = ((k % 4) + 4) % 4;
  for (let i = 0; i < turns; i++) {
    const nx = 14 - cy;
    const ny = cx;
    cx = nx;
    cy = ny;
  }
  return { x: cx, y: cy };
}

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

const BASE_REP: Record<Color, { x: number; y: number }> = {
  red: { x: 2, y: 2 },
  blue: { x: 12, y: 2 },
  green: { x: 2, y: 12 },
  yellow: { x: 12, y: 12 },
};

/** Which screen corner a color's base occupies after k quarter-turns. */
export function cornerForColor(color: Color, k: number): Corner {
  const p = rotateCell(BASE_REP[color].x, BASE_REP[color].y, k);
  return p.y < 7 ? (p.x < 7 ? 'tl' : 'tr') : (p.x < 7 ? 'bl' : 'br');
}

/** Grid origin (top-left cell) of the 6×6 base region at each corner. */
export const CORNER_ORIGIN: Record<Corner, { x: number; y: number }> = {
  tl: { x: 0, y: 0 },
  tr: { x: 9, y: 0 },
  bl: { x: 0, y: 9 },
  br: { x: 9, y: 9 },
};

/** Direction arrow character for a step from cell a to cell b (post-rotation). */
export function arrowFor(a: { x: number; y: number }, b: { x: number; y: number }): string {
  if (b.y > a.y) return '↓';
  if (b.y < a.y) return '↑';
  if (b.x > a.x) return '→';
  return '←';
}

/** Center-goal triangle color for each side (0=top, 1=right, 2=bottom, 3=left)
 *  after k quarter-turns. Unrotated home lanes (Ludo Club): blue arrives from
 *  the top arm, yellow from the right, green from the bottom, red from the left. */
export function centerSideColors(k: number): [Color, Color, Color, Color] {
  const base: Color[] = ['blue', 'yellow', 'green', 'red'];
  const turns = ((k % 4) + 4) % 4;
  return [0, 1, 2, 3].map((side) => base[(side - turns + 4) % 4]) as [Color, Color, Color, Color];
}
