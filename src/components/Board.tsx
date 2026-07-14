import { useEffect, useReducer, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Piece as PieceType, Player, Color } from '../game/types.ts';
import { HOME_STRETCH_ENTRY, PLAYER_CONFIG } from '../game/types.ts';
import { isSafeSquare, getSquareGridCoord, getHomeStretchGridCoord } from '../game/boardPath.ts';
import {
  ROTATION_FOR_COLOR,
  rotateCell,
  cornerForColor,
  CORNER_ORIGIN,
  arrowFor,
  centerSideColors,
} from '../game/boardRotation.ts';
import Piece from './Piece.tsx';
import GifSticker from './GifSticker.tsx';
import type { MemeFx } from '../game/memeFx.ts';
import { STEP_DURATION, RETURN_STEP_DURATION } from '../game/anim.ts';
import './Board.css';

interface BoardProps {
  pieces: (PieceType & { _color: Color; _playerId: string; _isMovable: boolean })[];
  currentPlayer: Player | undefined;
  onPieceClick: (pieceId: string) => void;
  /** The color whose corner is shown bottom-left (this device's player). */
  perspective: Color;
  /** Active system occasion effect: gif bubble anchored to a board square
   *  (playback timing is handled by Game — this only renders it). */
  memeFx?: MemeFx | null;
}

const COLORS_ORDER = ['red', 'green', 'yellow', 'blue'] as const;

/** Entry square index per color (matches boardPath.ts / gameEngine). */
const ENTRY_SQUARES: Record<Color, number> = { red: 0, blue: 13, yellow: 26, green: 39 };

/** Waiting slots inside each base, in UNROTATED grid units. */
const BASE_SLOTS: Record<Color, Array<{ x: number; y: number }>> = {
  red:    [{ x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 }, { x: 1.5, y: 3.5 }, { x: 3.5, y: 3.5 }],
  blue:   [{ x: 10.5, y: 1.5 }, { x: 12.5, y: 1.5 }, { x: 10.5, y: 3.5 }, { x: 12.5, y: 3.5 }],
  green:  [{ x: 1.5, y: 10.5 }, { x: 3.5, y: 10.5 }, { x: 1.5, y: 12.5 }, { x: 3.5, y: 12.5 }],
  yellow: [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }, { x: 10.5, y: 12.5 }, { x: 12.5, y: 12.5 }],
};

/** Ludo Club-style grouping for pieces sharing a square: instead of
 *  overlapping, they SHRINK and arrange side by side (2 = pair, 3 =
 *  triangle, 4 = 2x2 grid, 5+ = ring — the center goal can hold many).
 *  Offsets are fractions of the piece's own box (translate %), so the
 *  layout is fully responsive at any board size. */
function groupLayout(n: number, idx: number): { fx: number; fy: number; scale: number } {
  if (n <= 1) return { fx: 0, fy: 0, scale: 1 };
  if (n === 2) {
    const spots = [{ fx: -0.3, fy: 0.08 }, { fx: 0.3, fy: 0.08 }];
    return { ...spots[idx % 2], scale: 0.72 };
  }
  if (n === 3) {
    const spots = [{ fx: -0.34, fy: -0.12 }, { fx: 0.34, fy: -0.12 }, { fx: 0, fy: 0.24 }];
    return { ...spots[idx % 3], scale: 0.62 };
  }
  if (n === 4) {
    const spots = [
      { fx: -0.33, fy: -0.2 }, { fx: 0.33, fy: -0.2 },
      { fx: -0.33, fy: 0.24 }, { fx: 0.33, fy: 0.24 },
    ];
    return { ...spots[idx % 4], scale: 0.56 };
  }
  // 5+ (center goal): even ring around the middle
  const angle = (idx / n) * Math.PI * 2 - Math.PI / 2;
  return { fx: Math.cos(angle) * 0.55, fy: Math.sin(angle) * 0.45 + 0.05, scale: 0.5 };
}

const CELL = 100 / 15;

/** Grid coords for every main-path square, from the single source of truth. */
const PATH_CELLS = Array.from({ length: 52 }, (_, i) => getSquareGridCoord(i));

/** Successor of a logical position along a color's route (for step animation). */
function nextLogical(pos: number, color: Color): number {
  if (pos >= 52) return pos + 1;
  if (pos === HOME_STRETCH_ENTRY[color]) return 52;
  return (pos + 1) % 52;
}

/** Number of cell-hops walking a color's route from `from` to `to` (0 if unreachable within 8 hops). */
function stepsBetween(from: number, to: number, color: Color): number {
  let p = from;
  for (let steps = 1; steps <= 8; steps++) {
    p = nextLogical(p, color);
    if (p === to) return steps;
  }
  return 0;
}

/** Extra buffer (ms) after the capturer's travel duration before the
 *  captured piece is released to fly back to its base. */
const CAPTURE_RELEASE_BUFFER_MS = 90;

export default function Board({ pieces, currentPlayer, onPieceClick, perspective, memeFx }: BoardProps) {
  const k = ROTATION_FOR_COLOR[perspective];
  const rot = (x: number, y: number) => rotateCell(x, y, k);

  /** Screen-percent center of a logical position for a given piece. */
  const coordsFor = (position: number, color: Color, pieceId: string): { x: number; y: number } => {
    let g: { x: number; y: number };
    if (position === -1) {
      const idx = parseInt(pieceId.slice(-1), 10) % 4;
      g = BASE_SLOTS[color][idx];
    } else if (position >= 57) {
      g = { x: 7, y: 7 };
    } else if (position >= 52) {
      const hs = getHomeStretchGridCoord(color, position - 52);
      g = { x: hs.col, y: hs.row };
    } else {
      const c = PATH_CELLS[position];
      g = { x: c.col, y: c.row };
    }
    const r = rot(g.x, g.y);
    return { x: r.x * CELL + CELL / 2, y: r.y * CELL + CELL / 2 };
  };

  // Previous logical positions (for cell-by-cell travel animation)
  const prevPositions = useRef<Map<string, number>>(new Map());

  // Captured pieces must stay visible at their board square until the
  // capturing piece's own travel animation lands — otherwise the captured
  // piece snaps back to base the instant the dice result resolves, well
  // before the capturer has visibly arrived. Any board(>=0) → base(-1)
  // transition is always a capture (no other rule sends a piece to base),
  // so we detect that transition here, freeze the piece at its last board
  // position for the capturer's travel duration, then release it.
  const captureHolds = useRef<Map<string, number>>(new Map()); // pieceId -> frozen board position
  // After the hold releases, the captured piece doesn't teleport to base:
  // it RUNS BACKWARD along the main track to its own entry square and then
  // hops into its yard (Ludo Club style). This records where the run starts.
  const captureReturns = useRef<Map<string, number>>(new Map()); // pieceId -> board pos the run starts from
  const [, releaseTick] = useReducer((c: number) => c + 1, 0);

  for (const piece of pieces) {
    if (captureHolds.current.has(piece.id)) continue;
    const prevPos = prevPositions.current.get(piece.id);
    if (prevPos === undefined || prevPos < 0 || piece.position !== -1) continue;

    // Genuine capture detected — find the capturing piece's travel time.
    let moverSteps = 0;
    for (const other of pieces) {
      if (other.id === piece.id) continue;
      const otherPrev = prevPositions.current.get(other.id);
      if (otherPrev === undefined || otherPrev === other.position) continue;
      if (otherPrev < 0 || other.position < 0) continue; // base-entry or itself captured: instant, not a "traveler"
      const steps = stepsBetween(otherPrev, other.position, other._color);
      if (steps > moverSteps) moverSteps = steps;
    }

    captureHolds.current.set(piece.id, prevPos);
    const releaseMs = moverSteps * STEP_DURATION * 1000 + CAPTURE_RELEASE_BUFFER_MS;
    setTimeout(() => {
      captureHolds.current.delete(piece.id);
      // Kick off the backward run home from the square it was captured on
      captureReturns.current.set(piece.id, prevPos);
      // Resync prevPositions to the TRUE (base) position now, in the same
      // tick as the release. Without this, the next render's detection
      // loop would still see the stale pre-capture prevPos (since the
      // sync effect skips held pieces) and immediately re-detect the SAME
      // capture, re-arming the hold forever in a 90ms loop.
      prevPositions.current.set(piece.id, piece.position);
      releaseTick();
    }, releaseMs);
  }

  // Effective pieces: captured ones under an active hold render frozen at
  // their last board square instead of jumping straight to base.
  const effectivePieces = pieces.map((piece) => {
    const frozenAt = captureHolds.current.get(piece.id);
    return frozenAt === undefined ? piece : { ...piece, position: frozenAt };
  });

  useEffect(() => {
    const map = prevPositions.current;
    for (const p of pieces) {
      if (captureHolds.current.has(p.id)) continue; // keep the pre-capture position until released
      map.set(p.id, p.position);
      if (p.position >= 0) captureReturns.current.delete(p.id); // back on the board: stale run data
    }
  });

  // Cache the computed waypoint arrays per piece, keyed by the CURRENT
  // logical position. Board re-renders for many reasons unrelated to this
  // piece (reactions, chat, capture-effect timers, and — critically — an
  // online guest's `players` array being replaced wholesale by every
  // incoming network snapshot). Without this cache, `prevPositions` is
  // already synced to the piece's new position within ~10ms of a move
  // starting (see the effect above), so any LATER incidental re-render
  // would recompute travelFor and see prev===position, collapsing the
  // in-flight multi-step keyframe array down to a single-point fallback
  // and making Framer abandon the cell-by-cell walk partway through.
  // Returning the SAME cached array reference for the life of a given
  // position keeps the piece's `animate` prop stable across those renders.
  const travelCache = useRef<Map<string, { forPosition: number; xs: string[]; ys: string[]; stepDuration: number }>>(new Map());

  /** Build the travel waypoints (percent coords) from prev → current position. */
  const travelFor = (piece: PieceType & { _color: Color }): { xs: string[]; ys: string[]; stepDuration: number } => {
    const cached = travelCache.current.get(piece.id);
    if (cached && cached.forPosition === piece.position) {
      return cached;
    }

    const target = coordsFor(piece.position, piece._color, piece.id);
    const prev = prevPositions.current.get(piece.id);
    const direct = { forPosition: piece.position, xs: [`${target.x}%`], ys: [`${target.y}%`], stepDuration: STEP_DURATION };

    // Captured piece released from its hold: fast backward run along the
    // main track to its own entry square, then into the yard (Ludo Club).
    if (piece.position === -1) {
      const runFrom = captureReturns.current.get(piece.id);
      if (runFrom !== undefined && runFrom >= 0 && runFrom < 52) {
        captureReturns.current.delete(piece.id);
        const entry = ENTRY_SQUARES[piece._color];
        const seq: number[] = [runFrom];
        let p = runFrom;
        for (let guard = 0; guard < 52 && p !== entry; guard++) {
          p = (p + 51) % 52; // one square backward around the ring
          seq.push(p);
        }
        const points = seq.map((s) => coordsFor(s, piece._color, piece.id));
        points.push(target); // final hop into the base slot
        const result = {
          forPosition: piece.position,
          xs: points.map((pt) => `${pt.x}%`),
          ys: points.map((pt) => `${pt.y}%`),
          stepDuration: RETURN_STEP_DURATION,
        };
        travelCache.current.set(piece.id, result);
        return result;
      }
    }

    if (
      prev === undefined || prev === piece.position ||
      prev < 0 || piece.position < 0 // base exits fly directly
    ) {
      travelCache.current.set(piece.id, direct);
      return direct;
    }
    // Walk the route from prev to current (a dice move is at most 6 steps)
    const seq: number[] = [];
    let p = prev;
    for (let guard = 0; guard < 8 && p !== piece.position; guard++) {
      p = nextLogical(p, piece._color);
      seq.push(p);
    }
    if (p !== piece.position || seq.length < 1) {
      travelCache.current.set(piece.id, direct);
      return direct;
    }
    const start = coordsFor(prev, piece._color, piece.id);
    const points = [start, ...seq.map((s) => coordsFor(Math.min(s, 57), piece._color, piece.id))];
    const result = {
      forPosition: piece.position,
      xs: points.map((pt) => `${pt.x}%`),
      ys: points.map((pt) => `${pt.y}%`),
      stepDuration: STEP_DURATION,
    };
    travelCache.current.set(piece.id, result);
    return result;
  };

  // ── Static cells ──────────────────────────────────────────────────
  const pathCells = PATH_CELLS.map((pos, pathIndex) => {
    const entryColor = (Object.entries(ENTRY_SQUARES) as [Color, number][])
      .find(([, sq]) => sq === pathIndex)?.[0];
    const safe = isSafeSquare(pathIndex);
    const r = rot(pos.col, pos.row);

    let className = 'board-square';
    if (entryColor) className += ` board-square--entry board-square--${entryColor}`;
    if (safe && !entryColor) className += ' board-square--safe';

    let arrow: string | null = null;
    if (entryColor) {
      const next = PATH_CELLS[(pathIndex + 1) % 52];
      arrow = arrowFor(r, rot(next.col, next.row));
    }

    return (
      <div
        key={`path-${pathIndex}`}
        className={className}
        style={{ gridColumn: r.x + 1, gridRow: r.y + 1 }}
      >
        {arrow && <span className="board-entry-arrow">{arrow}</span>}
        {safe && !entryColor && (
          /* SVG star that FILLS the cell — points reaching the edges
             (Ludo Club), white fill with a golden edge. */
          <svg className="board-safe-star" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 1 L14.7 8.28 L22.46 8.6 L16.37 13.42 L18.47 20.9 L12 16.6 L5.53 20.9 L7.63 13.42 L1.54 8.6 L9.3 8.28 Z"
              fill="#ffffff"
              stroke="#e3a812"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    );
  });

  const homeStretchCells = COLORS_ORDER.flatMap((color) =>
    Array.from({ length: 5 }, (_, idx) => {
      const c = getHomeStretchGridCoord(color, idx);
      const r = rot(c.col, c.row);
      return (
        <div
          key={`hs-${color}-${idx}`}
          className={`board-square board-square--hs board-square--hs-${color}`}
          style={{ gridColumn: r.x + 1, gridRow: r.y + 1 }}
        />
      );
    }),
  );

  // Center triangles rotate with the board
  const [topC, rightC, bottomC, leftC] = centerSideColors(k);

  // Group pieces by final coordinate for stacking offsets (uses effective
  // positions so a held/frozen captured piece still stacks correctly with
  // whatever else is on its square).
  const pieceGroups = new Map<string, typeof effectivePieces>();
  for (const piece of effectivePieces) {
    const c = coordsFor(piece.position, piece._color, piece.id);
    const key = `${c.x.toFixed(2)},${c.y.toFixed(2)}`;
    if (!pieceGroups.has(key)) pieceGroups.set(key, []);
    pieceGroups.get(key)!.push(piece);
  }

  return (
    <div className="board-container">
      <div className="board-grid">
        {/* Corner home bases */}
        {COLORS_ORDER.map((color) => {
          const corner = cornerForColor(color, k);
          const origin = CORNER_ORIGIN[corner];
          const cfg = PLAYER_CONFIG[color];
          return (
            <div
              key={`base-${color}`}
              className="home-base"
              style={{
                left: `${(origin.x / 15) * 100}%`,
                top: `${(origin.y / 15) * 100}%`,
                // Flat saturated corner color (Ludo Club) — no gradient
                background: cfg.cssColor,
              }}
            >
              <div className="home-base-pad" />
            </div>
          );
        })}

        {/* Base waiting slots — same coordinate math as the pieces, so the
            pawns always sit exactly on their circles (any rotation). */}
        {COLORS_ORDER.flatMap((color) =>
          BASE_SLOTS[color].map((slot, i) => {
            const r = rot(slot.x, slot.y);
            return (
              <span
                key={`slot-${color}-${i}`}
                className={`home-base-slot home-base-slot--${color}`}
                style={{
                  left: `${r.x * CELL + CELL / 2}%`,
                  top: `${r.y * CELL + CELL / 2}%`,
                }}
              />
            );
          }),
        )}

        {/* Path + home stretch cells */}
        {pathCells}
        {homeStretchCells}

        {/* Center goal: classic 4-triangle finish (rotates with perspective) */}
        <div className="board-center">
          <svg viewBox="0 0 30 30" className="board-center-svg" aria-hidden="true">
            <polygon points="0,0 30,0 15,15" fill={PLAYER_CONFIG[topC].cssColor} stroke="#fff" strokeWidth="0.8" />
            <polygon points="30,0 30,30 15,15" fill={PLAYER_CONFIG[rightC].cssColor} stroke="#fff" strokeWidth="0.8" />
            <polygon points="0,30 30,30 15,15" fill={PLAYER_CONFIG[bottomC].cssColor} stroke="#fff" strokeWidth="0.8" />
            <polygon points="0,0 0,30 15,15" fill={PLAYER_CONFIG[leftC].cssColor} stroke="#fff" strokeWidth="0.8" />
          </svg>
          <span className="board-center-trophy">🏆</span>
        </div>
      </div>

      {/* Pieces overlay */}
      <div className="pieces-overlay">
        <AnimatePresence>
          {effectivePieces.map((piece) => {
            const c = coordsFor(piece.position, piece._color, piece.id);
            const key = `${c.x.toFixed(2)},${c.y.toFixed(2)}`;
            const group = pieceGroups.get(key) ?? [piece];
            const stackIdx = group.indexOf(piece);
            const layout = groupLayout(group.length, Math.max(stackIdx, 0));
            const { xs, ys, stepDuration } = travelFor(piece);
            const isCurrentPlayer = piece._playerId === currentPlayer?.id;

            return (
              <Piece
                key={piece.id}
                piece={piece}
                xs={xs}
                ys={ys}
                layout={layout}
                stepDuration={stepDuration}
                isCurrentPlayer={isCurrentPlayer}
                onClick={onPieceClick}
              />
            );
          })}
        </AnimatePresence>

        {/* System occasion gif: small transparent sticker popping out of a
            CORNER of the piece involved (no speech bubble). The corner is
            picked from the square's board position so the gif never runs
            off the edge: right of the piece by default, flipped to the
            left near the right edge, and below it near the top edge. */}
        {memeFx && (() => {
          const c = coordsFor(Math.min(memeFx.position, 57), memeFx.color, '');
          const flipX = c.x > 64; // near the right edge → gif to the LEFT
          const below = c.y < 16; // near the top edge → gif BELOW the piece
          const dx = flipX ? -2.6 : 2.6; // % of board: piece's corner offset
          const dy = below ? 2.2 : -5.2;
          return (
            <div
              key={memeFx.key}
              className="board-meme"
              style={{
                left: `${c.x + dx}%`,
                top: `${c.y + dy}%`,
                translate: `${flipX ? '-100%' : '0'} ${below ? '0' : '-100%'}`,
              }}
            >
              {memeFx.gif.startsWith('/')
                ? <img className="board-meme-img" src={memeFx.gif} alt="" draggable={false} />
                : <GifSticker id={memeFx.gif} size={46} />}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
