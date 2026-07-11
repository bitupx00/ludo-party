import { AnimatePresence } from 'framer-motion';
import type { Piece as PieceType, Player, Color } from '../game/types.ts';
import { isSafeSquare, getSquareGridCoord, getHomeStretchGridCoord } from '../game/boardPath.ts';
import Piece from './Piece.tsx';
import './Board.css';

interface BoardProps {
  pieces: (PieceType & { _color: Color; _playerId: string; _isMovable: boolean })[];
  currentPlayer: Player | undefined;
  onPieceClick: (pieceId: string) => void;
}

const COLORS_ORDER = ['red', 'green', 'yellow', 'blue'] as const;

/** Entry square index per color (matches boardPath.ts / gameEngine). */
const ENTRY_SQUARES: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

/** Direction of play at each entry square (for the entry arrow). */
const ENTRY_ARROWS: Record<Color, string> = { red: '↓', green: '→', yellow: '↑', blue: '←' };

/** Corner base regions: 6x6 blocks (grid units, 0-indexed). */
const BASE_REGIONS: Record<Color, { x: number; y: number }> = {
  red: { x: 0, y: 0 },      // top-left
  blue: { x: 9, y: 0 },     // top-right
  green: { x: 0, y: 9 },    // bottom-left
  yellow: { x: 9, y: 9 },   // bottom-right
};

/** Waiting slots inside each base (in grid units; +0.5 cell added when centering). */
const BASE_SLOTS: Record<Color, Array<{ x: number; y: number }>> = {
  red:    [{ x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 }, { x: 1.5, y: 3.5 }, { x: 3.5, y: 3.5 }],
  blue:   [{ x: 10.5, y: 1.5 }, { x: 12.5, y: 1.5 }, { x: 10.5, y: 3.5 }, { x: 12.5, y: 3.5 }],
  green:  [{ x: 1.5, y: 10.5 }, { x: 3.5, y: 10.5 }, { x: 1.5, y: 12.5 }, { x: 3.5, y: 12.5 }],
  yellow: [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }, { x: 10.5, y: 12.5 }, { x: 12.5, y: 12.5 }],
};

// Stacking offsets for overlapping pieces (up to 4)
const STACK_OFFSETS = [
  { dx: 0, dy: 0 },
  { dx: 4, dy: -3 },
  { dx: -4, dy: 3 },
  { dx: 4, dy: 3 },
];

/** Grid coords for every main-path square, from the single source of truth. */
const PATH_CELLS = Array.from({ length: 52 }, (_, i) => getSquareGridCoord(i));

export default function Board({ pieces, currentPlayer, onPieceClick }: BoardProps) {
  const entryColorBySquare = new Map<number, Color>(
    (Object.entries(ENTRY_SQUARES) as [Color, number][]).map(([color, sq]) => [sq, color]),
  );

  // Calculate piece board coordinates (grid units)
  const getPieceCoords = (piece: PieceType & { _color: Color }): { x: number; y: number } => {
    if (piece.position === -1) {
      const idx = parseInt(piece.id.slice(-1), 10) % 4;
      return BASE_SLOTS[piece._color][idx];
    }
    if (piece.position >= 56) {
      return { x: 7, y: 7 }; // reached the goal → center
    }
    if (piece.position >= 52) {
      const hs = getHomeStretchGridCoord(piece._color, piece.position - 52);
      return { x: hs.col, y: hs.row };
    }
    const pos = PATH_CELLS[piece.position];
    return { x: pos.col, y: pos.row };
  };

  // Main path cells
  const pathCells = PATH_CELLS.map((pos, pathIndex) => {
    const entryColor = entryColorBySquare.get(pathIndex);
    const safe = isSafeSquare(pathIndex);
    let className = 'board-square';
    if (entryColor) className += ` board-square--entry board-square--${entryColor}`;
    if (safe && !entryColor) className += ' board-square--safe';

    return (
      <div
        key={`path-${pathIndex}`}
        className={className}
        style={{ gridColumn: pos.col + 1, gridRow: pos.row + 1 }}
      >
        {entryColor && <span className="board-entry-arrow">{ENTRY_ARROWS[entryColor]}</span>}
        {safe && !entryColor && <span className="board-safe-star">★</span>}
      </div>
    );
  });

  // Home stretch cells (5 per color, positions 52–55 + last step before goal)
  const homeStretchCells = COLORS_ORDER.flatMap((color) =>
    Array.from({ length: 5 }, (_, idx) => {
      const c = getHomeStretchGridCoord(color, idx);
      return (
        <div
          key={`hs-${color}-${idx}`}
          className={`board-square board-square--hs board-square--hs-${color}`}
          style={{ gridColumn: c.col + 1, gridRow: c.row + 1 }}
        />
      );
    }),
  );

  // Group pieces by coordinate for stacking offsets
  const pieceGroups = new Map<string, typeof pieces>();
  for (const piece of pieces) {
    const coords = getPieceCoords(piece);
    const key = `${coords.x},${coords.y}`;
    if (!pieceGroups.has(key)) pieceGroups.set(key, []);
    pieceGroups.get(key)!.push(piece);
  }

  return (
    <div className="board-container">
      <div className="board-grid">
        {/* Corner home bases */}
        {COLORS_ORDER.map((color) => {
          const region = BASE_REGIONS[color];
          return (
            <div
              key={`base-${color}`}
              className={`home-base home-base--${color}`}
              style={{
                left: `${(region.x / 15) * 100}%`,
                top: `${(region.y / 15) * 100}%`,
              }}
            >
              <div className="home-base-pad">
                {BASE_SLOTS[color].map((slot, i) => (
                  <span
                    key={i}
                    className={`home-base-slot home-base-slot--${color}`}
                    style={{
                      left: `${((slot.x + 0.5 - region.x) / 6) * 100}%`,
                      top: `${((slot.y + 0.5 - region.y) / 6) * 100}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Path + home stretch cells */}
        {pathCells}
        {homeStretchCells}

        {/* Center goal: classic 4-triangle finish */}
        <div className="board-center">
          <svg viewBox="0 0 30 30" className="board-center-svg" aria-hidden="true">
            <polygon points="0,0 30,0 15,15" fill="var(--color-red)" stroke="#fff" strokeWidth="0.8" />
            <polygon points="30,0 30,30 15,15" fill="var(--color-blue)" stroke="#fff" strokeWidth="0.8" />
            <polygon points="0,30 30,30 15,15" fill="var(--color-yellow)" stroke="#fff" strokeWidth="0.8" />
            <polygon points="0,0 0,30 15,15" fill="var(--color-green)" stroke="#fff" strokeWidth="0.8" />
          </svg>
          <span className="board-center-trophy">🏆</span>
        </div>
      </div>

      {/* Pieces overlay */}
      <div className="pieces-overlay">
        <AnimatePresence>
          {pieces.map((piece) => {
            const coords = getPieceCoords(piece);
            const key = `${coords.x},${coords.y}`;
            const group = pieceGroups.get(key) ?? [piece];
            const stackIdx = group.indexOf(piece);
            const offset = STACK_OFFSETS[Math.min(stackIdx, STACK_OFFSETS.length - 1)];
            const pct = 100 / 15;

            const baseX = coords.x * pct + pct / 2;
            const baseY = coords.y * pct + pct / 2;
            const xPx = `calc(${baseX}% + ${offset.dx}px)`;
            const yPx = `calc(${baseY}% + ${offset.dy}px)`;

            const isCurrentPlayer = piece._playerId === currentPlayer?.id;

            return (
              <Piece
                key={piece.id}
                piece={piece}
                x={xPx}
                y={yPx}
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
