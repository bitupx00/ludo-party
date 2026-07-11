import { useEffect, useRef } from 'react';
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
import './Board.css';

interface BoardProps {
  pieces: (PieceType & { _color: Color; _playerId: string; _isMovable: boolean })[];
  currentPlayer: Player | undefined;
  onPieceClick: (pieceId: string) => void;
  /** The color whose corner is shown bottom-left (this device's player). */
  perspective: Color;
}

const COLORS_ORDER = ['red', 'green', 'yellow', 'blue'] as const;

/** Entry square index per color (matches boardPath.ts / gameEngine). */
const ENTRY_SQUARES: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

/** Waiting slots inside each base, in UNROTATED grid units. */
const BASE_SLOTS: Record<Color, Array<{ x: number; y: number }>> = {
  red:    [{ x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 }, { x: 1.5, y: 3.5 }, { x: 3.5, y: 3.5 }],
  blue:   [{ x: 10.5, y: 1.5 }, { x: 12.5, y: 1.5 }, { x: 10.5, y: 3.5 }, { x: 12.5, y: 3.5 }],
  green:  [{ x: 1.5, y: 10.5 }, { x: 3.5, y: 10.5 }, { x: 1.5, y: 12.5 }, { x: 3.5, y: 12.5 }],
  yellow: [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }, { x: 10.5, y: 12.5 }, { x: 12.5, y: 12.5 }],
};

/** Gradient angle per screen corner so the light always comes from the center. */
const CORNER_GRADIENT: Record<string, string> = {
  tl: '135deg',
  tr: '225deg',
  bl: '45deg',
  br: '315deg',
};

// Stacking offsets (px) for overlapping pieces (up to 4)
const STACK_OFFSETS = [
  { dx: 0, dy: 0 },
  { dx: 5, dy: -3 },
  { dx: -5, dy: 3 },
  { dx: 5, dy: 3 },
];

const CELL = 100 / 15;

/** Grid coords for every main-path square, from the single source of truth. */
const PATH_CELLS = Array.from({ length: 52 }, (_, i) => getSquareGridCoord(i));

/** Successor of a logical position along a color's route (for step animation). */
function nextLogical(pos: number, color: Color): number {
  if (pos >= 52) return pos + 1;
  if (pos === HOME_STRETCH_ENTRY[color]) return 52;
  return (pos + 1) % 52;
}

export default function Board({ pieces, currentPlayer, onPieceClick, perspective }: BoardProps) {
  const k = ROTATION_FOR_COLOR[perspective];
  const rot = (x: number, y: number) => rotateCell(x, y, k);

  /** Screen-percent center of a logical position for a given piece. */
  const coordsFor = (position: number, color: Color, pieceId: string): { x: number; y: number } => {
    let g: { x: number; y: number };
    if (position === -1) {
      const idx = parseInt(pieceId.slice(-1), 10) % 4;
      g = BASE_SLOTS[color][idx];
    } else if (position >= 56) {
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
  useEffect(() => {
    const map = prevPositions.current;
    for (const p of pieces) map.set(p.id, p.position);
  });

  /** Build the travel waypoints (percent coords) from prev → current position. */
  const travelFor = (piece: PieceType & { _color: Color }): { xs: string[]; ys: string[] } => {
    const target = coordsFor(piece.position, piece._color, piece.id);
    const prev = prevPositions.current.get(piece.id);
    if (
      prev === undefined || prev === piece.position ||
      prev < 0 || piece.position < 0 // base exits/captures fly directly
    ) {
      return { xs: [`${target.x}%`], ys: [`${target.y}%`] };
    }
    // Walk the route from prev to current (a dice move is at most 6 steps)
    const seq: number[] = [];
    let p = prev;
    for (let guard = 0; guard < 8 && p !== piece.position; guard++) {
      p = nextLogical(p, piece._color);
      seq.push(p);
    }
    if (p !== piece.position || seq.length < 2) {
      return { xs: [`${target.x}%`], ys: [`${target.y}%`] };
    }
    const start = coordsFor(prev, piece._color, piece.id);
    const points = [start, ...seq.map((s) => coordsFor(Math.min(s, 56), piece._color, piece.id))];
    return {
      xs: points.map((pt) => `${pt.x}%`),
      ys: points.map((pt) => `${pt.y}%`),
    };
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
        {safe && !entryColor && <span className="board-safe-star">★</span>}
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

  // Group pieces by final coordinate for stacking offsets
  const pieceGroups = new Map<string, typeof pieces>();
  for (const piece of pieces) {
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
                background: `linear-gradient(${CORNER_GRADIENT[corner]}, ${cfg.cssLight}, ${cfg.cssColor} 60%, ${cfg.cssColor})`,
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
          {pieces.map((piece) => {
            const c = coordsFor(piece.position, piece._color, piece.id);
            const key = `${c.x.toFixed(2)},${c.y.toFixed(2)}`;
            const group = pieceGroups.get(key) ?? [piece];
            const stackIdx = group.indexOf(piece);
            const offset = STACK_OFFSETS[Math.min(stackIdx, STACK_OFFSETS.length - 1)];
            const { xs, ys } = travelFor(piece);
            const isCurrentPlayer = piece._playerId === currentPlayer?.id;

            return (
              <Piece
                key={piece.id}
                piece={piece}
                xs={xs}
                ys={ys}
                offset={offset}
                isCurrentPlayer={isCurrentPlayer}
                onClick={onPieceClick}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
