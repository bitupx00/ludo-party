import type { Color } from './types';
import { COLOR_CONFIG } from './types';

/**
 * Ludo board path: 52 squares numbered 0–51, LUDO CLUB convention.
 *
 * The board is a cross with 4 arms on a 15×15 logical grid.
 * Bases: red = top-left, blue = top-right, green = bottom-left, yellow = bottom-right.
 *
 * Ludo Club geometry (counterclockwise travel):
 *  - Each color EXITS onto the arm beside its base (bottom-right of the base
 *    from that player's rotated point of view) and walks around the ring.
 *  - Each color's HOME LANE is the center column/row of that same arm,
 *    entered from the arm's tip after 50 ring squares.
 *
 *  Entries:  red (1,6) → east   | blue (8,1) → south
 *            yellow (13,8) → west | green (6,13) → north
 *  Home-lane entrances (last ring square before the lane):
 *            red (0,7)=idx 50 | blue (7,0)=idx 11
 *            yellow (14,7)=idx 24 | green (7,14)=idx 37
 */

const GRID = 15;
const CELL = 100 / GRID; // ~6.667%

function cell(col: number, row: number): { x: number; y: number } {
  return {
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2,
  };
}

const BOARD_PATH: { col: number; row: number }[] = [];

// 0–4: red entry — east along left arm's top row: (1,6) → (5,6)
for (let c = 1; c <= 5; c++) BOARD_PATH.push({ col: c, row: 6 });
// 5–10: north up the top arm's left column: (6,5) → (6,0)
for (let r = 5; r >= 0; r--) BOARD_PATH.push({ col: 6, row: r });
// 11: (7,0) — top tip (BLUE home-lane entrance)
BOARD_PATH.push({ col: 7, row: 0 });
// 12: (8,0)
BOARD_PATH.push({ col: 8, row: 0 });
// 13–17: blue entry — south down the top arm's right column: (8,1) → (8,5)
for (let r = 1; r <= 5; r++) BOARD_PATH.push({ col: 8, row: r });
// 18–23: east along right arm's top row: (9,6) → (14,6)
for (let c = 9; c <= 14; c++) BOARD_PATH.push({ col: c, row: 6 });
// 24: (14,7) — right tip (YELLOW home-lane entrance)
BOARD_PATH.push({ col: 14, row: 7 });
// 25: (14,8)
BOARD_PATH.push({ col: 14, row: 8 });
// 26–30: yellow entry — west along right arm's bottom row: (13,8) → (9,8)
for (let c = 13; c >= 9; c--) BOARD_PATH.push({ col: c, row: 8 });
// 31–36: south down the bottom arm's right column: (8,9) → (8,14)
for (let r = 9; r <= 14; r++) BOARD_PATH.push({ col: 8, row: r });
// 37: (7,14) — bottom tip (GREEN home-lane entrance)
BOARD_PATH.push({ col: 7, row: 14 });
// 38: (6,14)
BOARD_PATH.push({ col: 6, row: 14 });
// 39–43: green entry — north up the bottom arm's left column: (6,13) → (6,9)
for (let r = 13; r >= 9; r--) BOARD_PATH.push({ col: 6, row: r });
// 44–49: west along left arm's bottom row: (5,8) → (0,8)
for (let c = 5; c >= 0; c--) BOARD_PATH.push({ col: c, row: 8 });
// 50: (0,7) — left tip (RED home-lane entrance)
BOARD_PATH.push({ col: 0, row: 7 });
// 51: (0,6)
BOARD_PATH.push({ col: 0, row: 6 });

if (BOARD_PATH.length !== 52) {
  throw new Error(`Board path has ${BOARD_PATH.length} squares, expected 52`);
}

/** Get the pixel position (as % of board) for a main path square (0–51). */
export function getSquarePosition(index: number): { x: number; y: number } {
  const pos = BOARD_PATH[((index % 52) + 52) % 52];
  return cell(pos.col, pos.row);
}

/**
 * Home stretch positions — 5 squares along the CENTER lane of each color's
 * own arm, from the arm tip toward the board center (Ludo Club).
 */
const HOME_STRETCH_PATHS: Record<Color, { col: number; row: number }[]> = {
  red: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
  ],
  blue: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
  ],
  yellow: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
  ],
  green: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
  ],
};

/**
 * Get the position of a home stretch square.
 * @param color - Which color's home stretch.
 * @param index - 0 (just entered) to 4 (closest to the center goal).
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
