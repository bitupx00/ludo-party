import type { Color } from './types';
import { COLOR_CONFIG } from './types';

/**
 * Ludo board path: 52 squares numbered 0–51 in clockwise order.
 *
 * The board is a cross with 4 arms on a 15×15 logical grid.
 * Each arm is 3 cells wide and 6 cells long.
 *
 *   - Top arm:    cols 6–8, rows 0–5    (Red entry)
 *   - Left arm:   cols 0–5, rows 6–8    (Green entry)
 *   - Bottom arm: cols 6–8, rows 9–14  (Yellow entry)
 *   - Right arm:  cols 9–14, rows 6–8   (Blue entry)
 *   - Center:     cols 6–8, rows 6–8
 *
 * Positions are returned as percentages (0–100) for CSS absolute positioning.
 */

const GRID = 15;
const CELL = 100 / GRID; // ~6.667%

function cell(col: number, row: number): { x: number; y: number } {
  return {
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2,
  };
}

/**
 * Build the 52-square main path in clockwise order.
 *
 * Tracing the OUTSIDE perimeter of the cross, clockwise from top-left:
 *
 *   Segment A (0–5):   Top arm left side, going DOWN   — col 6, rows 0→5
 *   Segment B (6–11):  Cross top, going LEFT           — row 6, cols 5→0
 *   Segment C (12–13): Left arm tip                     — col 0, rows 7→8
 *   Segment D (14–18): Cross bottom-left, going RIGHT   — row 8, cols 1→5
 *   Segment E (19–24): Bottom arm left side, going DOWN — col 6, rows 9→14
 *   Segment F (25–26): Bottom arm tip                   — row 14, cols 7→8
 *   Segment G (27–31): Bottom arm right side, going UP  — col 8, rows 13→9
 *   Segment H (32–37): Cross bottom-right, going RIGHT  — row 8, cols 9→14
 *   Segment I (38–39): Right arm tip                   — col 14, rows 7→6
 *   Segment J (40–44): Cross top-right, going LEFT     — row 6, cols 13→9
 *   Segment K (45–50): Top arm right side, going UP    — col 8, rows 5→0
 *   Segment L (51):    Top arm tip                      — col 7, row 0
 *
 * Total: 6+6+2+5+6+2+5+6+2+5+6+1 = 52 ✓
 *
 * Entry indices: Red=0, Green=13, Yellow=26, Blue=39 (each 13 apart)
 */

const BOARD_PATH: { col: number; row: number }[] = [];

// A: indices 0–5 — down col 6 of top arm
for (let r = 0; r <= 5; r++) BOARD_PATH.push({ col: 6, row: r });
// B: indices 6–11 — left across row 6 toward left arm
for (let c = 5; c >= 0; c--) BOARD_PATH.push({ col: c, row: 6 });
// C: indices 12–13 — left arm tip going down
BOARD_PATH.push({ col: 0, row: 7 });
BOARD_PATH.push({ col: 0, row: 8 });
// D: indices 14–18 — right across row 8 toward center
for (let c = 1; c <= 5; c++) BOARD_PATH.push({ col: c, row: 8 });
// E: indices 19–24 — down col 6 of bottom arm
for (let r = 9; r <= 14; r++) BOARD_PATH.push({ col: 6, row: r });
// F: indices 25–26 — bottom arm tip going right
BOARD_PATH.push({ col: 7, row: 14 });
BOARD_PATH.push({ col: 8, row: 14 });
// G: indices 27–31 — up col 8 of bottom arm
for (let r = 13; r >= 9; r--) BOARD_PATH.push({ col: 8, row: r });
// H: indices 32–37 — right across row 8 into right arm
for (let c = 9; c <= 14; c++) BOARD_PATH.push({ col: c, row: 8 });
// I: indices 38–39 — right arm tip going up
BOARD_PATH.push({ col: 14, row: 7 });
BOARD_PATH.push({ col: 14, row: 6 });
// J: indices 40–44 — left across row 6 toward center
for (let c = 13; c >= 9; c--) BOARD_PATH.push({ col: c, row: 6 });
// K: indices 45–50 — up col 8 of top arm
for (let r = 5; r >= 0; r--) BOARD_PATH.push({ col: 8, row: r });
// L: index 51 — top arm tip connecting back
BOARD_PATH.push({ col: 7, row: 0 });

if (BOARD_PATH.length !== 52) {
  throw new Error(`Board path has ${BOARD_PATH.length} squares, expected 52`);
}

/** Get the pixel position (as % of board) for a main path square (0–51). */
export function getSquarePosition(index: number): { x: number; y: number } {
  const pos = BOARD_PATH[((index % 52) + 52) % 52];
  return cell(pos.col, pos.row);
}

/**
 * Home stretch positions — 5 squares from the edge of each arm toward the center.
 * Each color enters its home stretch from the board square just before its entry
 * point, then moves along the center lane of its arm toward the board center.
 */
const HOME_STRETCH_PATHS: Record<Color, { col: number; row: number }[]> = {
  red: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  green: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  yellow: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
  blue: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
};

/**
 * Get the position of a home stretch square.
 * @param color - Which color's home stretch.
 * @param index - 0 (just entered) to 4 (home / closest to center).
 */
export function getHomeStretchPosition(color: Color, index: number): { x: number; y: number } {
  const pos = HOME_STRETCH_PATHS[color][index];
  return cell(pos.col, pos.row);
}

/** Raw grid coordinates of a home stretch square (0–4). */
export function getHomeStretchGridCoord(color: Color, index: number): { col: number; row: number } {
  return HOME_STRETCH_PATHS[color][index];
}

/** Get the center position (home base target). */
export function getCenterPosition(): { x: number; y: number } {
  return cell(7, 7);
}

/** Home base positions (4 slots per color where pieces wait before entering). */
export function getHomeBasePositions(color: Color): { x: number; y: number }[] {
  const bases: Record<Color, { col: number; row: number }[]> = {
    red: [
      { col: 2, row: 2 }, { col: 4, row: 2 },
      { col: 2, row: 4 }, { col: 4, row: 4 },
    ],
    green: [
      { col: 2, row: 10 }, { col: 4, row: 10 },
      { col: 2, row: 12 }, { col: 4, row: 12 },
    ],
    yellow: [
      { col: 10, row: 10 }, { col: 12, row: 10 },
      { col: 10, row: 12 }, { col: 12, row: 12 },
    ],
    blue: [
      { col: 10, row: 2 }, { col: 12, row: 2 },
      { col: 10, row: 4 }, { col: 12, row: 4 },
    ],
  };
  return bases[color].map((p) => cell(p.col, p.row));
}

/** Get the raw grid coordinates for a main path square. */
export function getSquareGridCoord(index: number): { col: number; row: number } {
  return BOARD_PATH[((index % 52) + 52) % 52];
}

/**
 * Get the absolute position of any piece based on its state.
 * @param color - The piece's color.
 * @param position - -1=home, 0–51=board, 52–56=home stretch.
 * @param pieceIndex - 0–3, used to position pieces in home base.
 */
export function getPiecePosition(
  color: Color,
  position: number,
  pieceIndex: number,
): { x: number; y: number } {
  if (position === -1) {
    return getHomeBasePositions(color)[pieceIndex];
  }
  if (position >= 52) {
    const hsIndex = Math.min(position - 52, 4);
    if (hsIndex >= 4) return getCenterPosition();
    return getHomeStretchPosition(color, hsIndex);
  }
  return getSquarePosition(position);
}

/** Check if a board square (0–51) is a safe square. */
export function isSafeSquare(index: number): boolean {
  return COLOR_CONFIG.red.safeSquares.includes(index); // All colors share the same safe squares set
}
