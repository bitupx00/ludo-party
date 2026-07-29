/**
 * Hexagonal 6-player Ludo — board geometry (design Phase 1).
 *
 * Matches the classic commercial 6-player hex board: a FULL HEXAGON
 * silhouette (flat-top), 6 three-column spokes radiating from a central
 * hexagonal goal, round bases in the 6 corners, numbered 6-cell home
 * lanes, entry arrows and star refuges.
 *
 * There is NO grid: every cell position is computed in polar coordinates
 * around the center and expressed as % of the board square, so the SVG
 * board and the piece layer share the same source of truth (same pattern
 * as boardPath.ts for the 4p board).
 *
 * Ring: 78 squares (13 per spoke), clockwise. Per-spoke pattern for arm k
 * (arms numbered clockwise, arm 0 pointing UP at the flat edge):
 *   j = 0..5   OUT along the spoke's LEFT column (inner → rim)
 *   j = 6      RIM CROSSING on the spoke axis — the lane entrance of the
 *              spoke owner's color
 *   j = 7..12  IN along the spoke's RIGHT column (rim → inner)
 * The next spoke's j=0 sits beside j=12 around the central hexagon.
 *
 * Color k OWNS spoke k (its 6-cell numbered lane runs down the middle
 * column) and its BASE sits at the hexagon corner clockwise of the spoke.
 * A piece:
 *   - enters the ring at ENTRY = 13k + 8 (right column, 2 after the rim),
 *   - travels 76 ring squares clockwise to its LANE ENTRANCE = 13k + 6,
 *   - descends the 6 lane cells (labelled 1→6) and needs an exact roll to
 *     land on the central goal. Total trip: 76 + 6 + 1 = 83 steps
 *     (vs 56 on the 4p board).
 *
 * Position encoding for 6p pieces:
 *   -1 = base · 0..77 = ring · 78..83 = own lane · 84 = goal
 *
 * Safe squares (12): every entry (13k+8) and every left-column start
 * (13k+1) — two per sector, evenly spread like the 4p board's 8.
 */

export type HexColor = 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'cyan';

export const HEX_COLORS: HexColor[] = ['red', 'blue', 'yellow', 'green', 'purple', 'cyan'];

/** Clockwise seating starting at the TOP spoke. */
export const HEX_ORDER: HexColor[] = ['red', 'blue', 'yellow', 'green', 'purple', 'cyan'];

export const HEX_RING_LEN = 78;
export const HEX_SECTOR = 13;
export const HEX_LANE_LEN = 6;
export const HEX_GOAL = HEX_RING_LEN + HEX_LANE_LEN; // 84

/** Spoke index (0..5, clockwise from top) owned by each color. */
export const HEX_ARM: Record<HexColor, number> = {
  red: 0, blue: 1, yellow: 2, green: 3, purple: 4, cyan: 5,
};

export const HEX_ENTRY: Record<HexColor, number> = Object.fromEntries(
  HEX_COLORS.map((c) => [c, HEX_ARM[c] * HEX_SECTOR + 8]),
) as Record<HexColor, number>;

/** Last ring square before turning into the color's own lane. */
export const HEX_LANE_ENTRANCE: Record<HexColor, number> = Object.fromEntries(
  HEX_COLORS.map((c) => [c, HEX_ARM[c] * HEX_SECTOR + 6]),
) as Record<HexColor, number>;

export const HEX_SAFE_SQUARES: number[] = HEX_COLORS.flatMap((c) => [
  HEX_ARM[c] * HEX_SECTOR + 1,
  HEX_ARM[c] * HEX_SECTOR + 8,
]).sort((a, b) => a - b);

/** Display colors (purple/cyan extend the classic four). */
export const HEX_COLOR_CSS: Record<HexColor, { main: string; light: string; name: string }> = {
  red: { main: '#f0405c', light: '#fb7185', name: 'Rojo' },
  blue: { main: '#3d7bfa', light: '#60a5fa', name: 'Azul' },
  yellow: { main: '#f5a415', light: '#fcd34d', name: 'Amarillo' },
  green: { main: '#26c165', light: '#4ade80', name: 'Verde' },
  purple: { main: '#a855f7', light: '#c4b5fd', name: 'Morado' },
  cyan: { main: '#14b8a6', light: '#5eead4', name: 'Celeste' },
};

/* ── Polar layout (flat-top hexagon) ────────────────────────────────── */

const CX = 50;
const CY = 50;
/** Central goal hexagon radius (to its flat edges). */
const R_IN = 12.6;
/** Rim radius on the spoke axes (= apothem of the outer hexagon). */
const R_RIM = 42.6;
/** Outer hexagon corner radius (rim / cos 30°). */
export const HEX_CORNER_R = R_RIM / Math.cos(Math.PI / 6); // ≈ 49.2
/** Radial distance between consecutive cells along a column — sized so
 *  the rim-crossing cell (R0 + 6·STEP + CELL/2) stays INSIDE the hexagon
 *  edge. */
const STEP = (R_RIM - R_IN - 4.0) / 6.5; // = 4.0
/** Sideways offset of the left/right columns from the spoke axis. */
const W = STEP;
/** Cell size (%, square side) — shared by board render and piece layer. */
export const HEX_CELL = STEP * 0.98;

/** Unit vectors for spoke k (0 = up, clockwise). */
function armAxis(k: number): { ux: number; uy: number; vx: number; vy: number } {
  const phi = (-90 + k * 60) * (Math.PI / 180);
  // u = outward along the spoke, v = 90° clockwise from u
  return { ux: Math.cos(phi), uy: Math.sin(phi), vx: -Math.sin(phi), vy: Math.cos(phi) };
}

function at(k: number, radial: number, side: number): { x: number; y: number } {
  const { ux, uy, vx, vy } = armAxis(k);
  return { x: CX + ux * radial + vx * side, y: CY + uy * radial + vy * side };
}

/** First column-cell radius. */
const R0 = R_IN + 1.6 + STEP / 2;

/** All 78 ring cell centers, index 0..77 (see header for the pattern). */
export const HEX_RING: { x: number; y: number }[] = (() => {
  const cells: { x: number; y: number }[] = [];
  for (let k = 0; k < 6; k++) {
    for (let j = 0; j <= 5; j++) cells.push(at(k, R0 + j * STEP, -W)); // out, left col
    cells.push(at(k, R0 + 6 * STEP, 0));                               // rim crossing
    for (let j = 5; j >= 0; j--) cells.push(at(k, R0 + j * STEP, +W)); // in, right col
  }
  return cells;
})();

if (HEX_RING.length !== HEX_RING_LEN) {
  throw new Error(`Hex ring has ${HEX_RING.length} cells, expected ${HEX_RING_LEN}`);
}

/** Lane cells for a color: 6 cells down the spoke axis, rim → center
 *  (labelled 1..6 like the reference board). */
export function hexLane(color: HexColor): { x: number; y: number }[] {
  const k = HEX_ARM[color];
  const cells: { x: number; y: number }[] = [];
  for (let j = 5; j >= 0; j--) cells.push(at(k, R0 + j * STEP, 0));
  return cells;
}

/** Central goal position. */
export function hexCenter(): { x: number; y: number } {
  return { x: CX, y: CY };
}

/** Base circle for a color (hexagon corner clockwise of its spoke). */
export function hexBase(color: HexColor): { center: { x: number; y: number }; r: number; slots: { x: number; y: number }[] } {
  const k = HEX_ARM[color];
  const phi = (-90 + k * 60 + 30) * (Math.PI / 180); // corner bisector, CW of spoke
  const r = 30.5;
  const cx = CX + Math.cos(phi) * r;
  const cy = CY + Math.sin(phi) * r;
  const s = 4.1;
  return {
    center: { x: cx, y: cy },
    r: 9.2,
    slots: [
      { x: cx - s, y: cy - s }, { x: cx + s, y: cy - s },
      { x: cx - s, y: cy + s }, { x: cx + s, y: cy + s },
    ],
  };
}

/** Any 6p piece position → board % coords (mirrors getPiecePosition). */
export function hexPiecePosition(color: HexColor, position: number, pieceIndex: number): { x: number; y: number } {
  if (position === -1) return hexBase(color).slots[pieceIndex % 4];
  if (position >= HEX_GOAL) return hexCenter();
  if (position >= HEX_RING_LEN) return hexLane(color)[position - HEX_RING_LEN];
  return HEX_RING[((position % HEX_RING_LEN) + HEX_RING_LEN) % HEX_RING_LEN];
}

export function hexIsSafe(index: number): boolean {
  return HEX_SAFE_SQUARES.includes(index);
}

/** Next ring/lane position along a color's route (for step animation). */
export function hexNextLogical(pos: number, color: HexColor): number {
  if (pos >= HEX_RING_LEN) return pos + 1;
  if (pos === HEX_LANE_ENTRANCE[color]) return HEX_RING_LEN;
  return (pos + 1) % HEX_RING_LEN;
}

/** New position after moving `steps` from `pos` (-1 handled by caller). */
export function hexCalculateNewPosition(pos: number, steps: number, color: HexColor): number {
  let p = pos;
  for (let i = 0; i < steps; i++) {
    p = hexNextLogical(p, color);
    if (p > HEX_GOAL) return -2; // overshoot — illegal move
  }
  return p;
}

/* ── Board rendering data (SVG) ─────────────────────────────────────── */

/** Outer hexagon (flat-top): 6 corners at the base bisectors. */
export function hexOuterPolygon(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k < 6; k++) {
    const phi = (-90 + k * 60 + 30) * (Math.PI / 180);
    pts.push({ x: CX + Math.cos(phi) * HEX_CORNER_R, y: CY + Math.sin(phi) * HEX_CORNER_R });
  }
  return pts;
}

/** Central hexagon polygon (goal area), corners toward the spokes. */
export function hexCenterPolygon(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k < 6; k++) {
    const phi = (-90 + k * 60) * (Math.PI / 180);
    pts.push({ x: CX + Math.cos(phi) * R_IN, y: CY + Math.sin(phi) * R_IN });
  }
  return pts;
}

/** Rotation (deg) that aligns a square cell with spoke k. */
export function hexCellRotation(k: number): number {
  return k * 60;
}

/** Which spoke a ring index belongs to. */
export function hexArmOf(index: number): number {
  return Math.floor(index / HEX_SECTOR) % 6;
}
