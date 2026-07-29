/**
 * Hexagonal 6-player Ludo — board geometry (Phase 1 of the 6p design).
 *
 * The board is a 6-armed star. There is NO grid: every cell position is
 * computed in polar coordinates around the center and expressed as % of
 * the board square, so the SVG board and the piece layer share the same
 * source of truth (same pattern as boardPath.ts for the 4p board).
 *
 * Ring: 78 squares (13 per arm), clockwise. Per-arm pattern for arm k
 * (arms numbered clockwise, arm 0 pointing UP):
 *   j = 0..5   OUT along the arm's LEFT column (inner → tip)
 *   j = 6      TIP CENTER — the lane entrance of arm k's color
 *   j = 7..12  IN along the arm's RIGHT column (tip → inner)
 * The next arm's j=0 sits right beside j=12 around the center hexagon.
 *
 * Color k OWNS arm k (its home lane runs up the arm's middle column) and
 * its BASE sits in the wedge clockwise of the arm, touching the right
 * column. A piece:
 *   - enters the ring at ENTRY = 13k + 8 (right column, 2 after the tip),
 *   - travels 76 ring squares clockwise to its LANE ENTRANCE = 13k + 6,
 *   - climbs 5 lane squares and lands on the central goal with an exact
 *     roll. Total trip: 76 + 5 + 1 = 82 steps (vs 56 on the 4p board).
 *
 * Position encoding for 6p pieces:
 *   -1 = base · 0..77 = ring · 78..82 = own lane · 83 = goal
 *
 * Safe squares (12): every entry (13k+8) and every left-column start
 * (13k+1) — two per sector, evenly spread like the 4p board's 8.
 */

export type HexColor = 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'cyan';

export const HEX_COLORS: HexColor[] = ['red', 'blue', 'yellow', 'green', 'purple', 'cyan'];

/** Clockwise seating starting at the TOP arm. */
export const HEX_ORDER: HexColor[] = ['red', 'blue', 'yellow', 'green', 'purple', 'cyan'];

export const HEX_RING_LEN = 78;
export const HEX_SECTOR = 13;
export const HEX_LANE_LEN = 5;
export const HEX_GOAL = HEX_RING_LEN + HEX_LANE_LEN; // 83

/** Arm index (0..5, clockwise from top) owned by each color. */
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

/* ── Polar layout ───────────────────────────────────────────────────── */

const CX = 50;
const CY = 50;
/** Inner radius where the arms sprout from the central hexagon. */
const R_IN = 16.5;
/** Tip radius (outermost ring cell centers). */
const R_TIP = 46.5;
/** Radial distance between consecutive cells along a column. */
const STEP = (R_TIP - R_IN) / 6;
/** Sideways half-offset of the left/right columns from the arm axis. */
const W = 4.4;
/** Cell diameter (%) — shared by the board render and the piece layer. */
export const HEX_CELL = 6.6;

/** Unit vectors for arm k (0 = up, clockwise). */
function armAxis(k: number): { ux: number; uy: number; vx: number; vy: number } {
  const phi = (-90 + k * 60) * (Math.PI / 180);
  // u = outward along the arm, v = 90° clockwise from u
  return { ux: Math.cos(phi), uy: Math.sin(phi), vx: -Math.sin(phi), vy: Math.cos(phi) };
}

function at(k: number, radial: number, side: number): { x: number; y: number } {
  const { ux, uy, vx, vy } = armAxis(k);
  return { x: CX + ux * radial + vx * side, y: CY + uy * radial + vy * side };
}

/** All 78 ring cell centers, index 0..77 (see header for the pattern). */
export const HEX_RING: { x: number; y: number }[] = (() => {
  const cells: { x: number; y: number }[] = [];
  for (let k = 0; k < 6; k++) {
    for (let j = 0; j <= 5; j++) cells.push(at(k, R_IN + j * STEP, -W)); // out, left col
    cells.push(at(k, R_TIP, 0));                                        // tip center
    for (let j = 5; j >= 0; j--) cells.push(at(k, R_IN + j * STEP, +W)); // in, right col
  }
  return cells;
})();

if (HEX_RING.length !== HEX_RING_LEN) {
  throw new Error(`Hex ring has ${HEX_RING.length} cells, expected ${HEX_RING_LEN}`);
}

/** Lane cells for a color: 5 cells along its arm's axis, tip → center. */
export function hexLane(color: HexColor): { x: number; y: number }[] {
  const k = HEX_ARM[color];
  const cells: { x: number; y: number }[] = [];
  for (let j = 5; j >= 1; j--) cells.push(at(k, R_IN + (j - 0.5) * STEP, 0));
  return cells;
}

/** Central goal position. */
export function hexCenter(): { x: number; y: number } {
  return { x: CX, y: CY };
}

/** Base wedge center for a color (clockwise of its arm) + 4 piece slots. */
export function hexBase(color: HexColor): { center: { x: number; y: number }; slots: { x: number; y: number }[] } {
  const k = HEX_ARM[color];
  const phi = (-90 + k * 60 + 30) * (Math.PI / 180); // wedge bisector, CW of arm
  const r = 33;
  const cx = CX + Math.cos(phi) * r;
  const cy = CY + Math.sin(phi) * r;
  const s = 4.6;
  return {
    center: { x: cx, y: cy },
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

/** Arm outline polygon (5 points: inner-left, tip-left, apex, tip-right,
 *  inner-right) for the colored arm background. */
export function hexArmPolygon(k: number): { x: number; y: number }[] {
  const wOut = W + HEX_CELL / 2;
  const rInEdge = R_IN - HEX_CELL / 2;
  const rTipEdge = R_TIP - HEX_CELL / 2 + 0.6;
  const apex = R_TIP + HEX_CELL * 0.85;
  return [
    at(k, rInEdge, -wOut),
    at(k, rTipEdge, -wOut),
    at(k, apex, 0),
    at(k, rTipEdge, +wOut),
    at(k, rInEdge, +wOut),
  ];
}

/** Central hexagon polygon (goal area), vertices between the arms. */
export function hexCenterPolygon(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k < 6; k++) {
    const phi = (-90 + k * 60 + 30) * (Math.PI / 180);
    pts.push({ x: CX + Math.cos(phi) * (R_IN - HEX_CELL / 2), y: CY + Math.sin(phi) * (R_IN - HEX_CELL / 2) });
  }
  return pts;
}
