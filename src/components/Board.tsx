import { AnimatePresence } from 'framer-motion';
import type { Piece as PieceType, Player, Color } from '../game/types.ts';
import { PLAYER_CONFIG } from '../game/types.ts';
import { isSafeSquare } from '../game/boardPath.ts';
import Piece from './Piece.tsx';
import './Board.css';

interface BoardProps {
  pieces: (PieceType & { _color: Color; _playerId: string; _isMovable: boolean })[];
  currentPlayer: Player | undefined;
  onPieceClick: (pieceId: string) => void;
}

// Pre-build the position mapping
const MAIN_POSITIONS = (() => {
  // We need the actual positions - build them inline
  const p: Array<{ x: number; y: number }> = [];

  // Bottom arm, left column, going up: (6,13) -> (6,9)
  for (let r = 13; r >= 9; r--) p.push({ x: 6, y: r });
  p.push({ x: 6, y: 8 }); // turn left
  // Left arm, bottom row, going left: (5,8) -> (0,8)
  for (let c = 5; c >= 0; c--) p.push({ x: c, y: 8 });
  p.push({ x: 0, y: 7 }); // turn up
  // Left arm, top row, going right: (0,6) -> (5,6)
  for (let c = 0; c <= 5; c++) p.push({ x: c, y: 6 });
  p.push({ x: 6, y: 6 }); // turn up
  // Top arm, left column, going up: (6,5) -> (6,1)
  for (let r = 5; r >= 1; r--) p.push({ x: 6, y: r });
  p.push({ x: 6, y: 0 }); // turn right
  p.push({ x: 7, y: 0 }); // top of top arm
  p.push({ x: 8, y: 0 });
  // Top arm, right column, going down: (8,1) -> (8,5)
  for (let r = 1; r <= 5; r++) p.push({ x: 8, y: r });
  p.push({ x: 8, y: 6 }); // turn right
  // Right arm, top row, going right: (9,6) -> (14,6)
  for (let c = 9; c <= 14; c++) p.push({ x: c, y: 6 });
  p.push({ x: 14, y: 7 }); // turn down
  // Right arm, bottom row, going left: (14,8) -> (9,8)
  for (let c = 14; c >= 9; c--) p.push({ x: c, y: 8 });
  p.push({ x: 8, y: 8 }); // turn down
  // Bottom arm, right column, going down: (8,9) -> (8,13)
  for (let r = 9; r <= 13; r++) p.push({ x: 8, y: r });
  p.push({ x: 8, y: 14 }); // turn left
  p.push({ x: 7, y: 14 }); // bottom of bottom arm

  return p;
})();

const HOME_STRETCHES: Record<Color, Array<{ x: number; y: number }>> = {
  red:    [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
  green:  [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
  yellow: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }],
  blue:   [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
};

const HOME_BASES: Record<Color, Array<{ x: number; y: number }>> = {
  red:    [{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 4 }],
  green:  [{ x: 2, y: 10 }, { x: 4, y: 10 }, { x: 2, y: 12 }, { x: 4, y: 12 }],
  yellow: [{ x: 10, y: 10 }, { x: 12, y: 10 }, { x: 10, y: 12 }, { x: 12, y: 12 }],
  blue:   [{ x: 10, y: 2 }, { x: 12, y: 2 }, { x: 10, y: 4 }, { x: 12, y: 4 }],
};

// Determine which squares are colored for each arm
const ENTRY_SQUARES: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

export default function Board({ pieces, currentPlayer, onPieceClick }: BoardProps) {
  // Build a map of which board squares have color (entry points)
  const coloredSquares = new Map<number, Color>();
  for (const [color, sq] of Object.entries(ENTRY_SQUARES)) {
    coloredSquares.set(sq, color as Color);
    // Color the square before entry (safe square)
    coloredSquares.set((sq + 51) % 52, color as Color);
  }

  // Calculate piece position
  const getPieceCoords = (piece: PieceType & { _color: Color }): { x: number; y: number } => {
    if (piece.position === -1) {
      // Home base
      const idx = parseInt(piece.id.slice(-1)) % 4;
      return HOME_BASES[piece._color][idx];
    }
    if (piece.position >= 52) {
      // Home stretch (52-56) or finished (57+)
      const hsIdx = Math.min(piece.position - 52, 5);
      return HOME_STRETCHES[piece._color][hsIdx] ?? { x: 7, y: 7 };
    }
    // On the main board (0-51)
    const pos = MAIN_POSITIONS[piece.position];
    return pos ?? { x: 7, y: 7 };
  };

  const renderSquare = (x: number, y: number) => {
    // Check if this is a main path square
    const pathIndex = MAIN_POSITIONS.findIndex(p => p.x === x && p.y === y);
    const isCenter = x === 7 && y === 7;

    if (isCenter) {
      return (
        <div key={`sq-${x}-${y}`} className="board-center">
          🏁
        </div>
      );
    }

    if (pathIndex >= 0) {
      const color = coloredSquares.get(pathIndex);
      const safe = isSafeSquare(pathIndex);
      let className = 'board-square';
      if (safe) className += ' board-square--safe';
      if (color) className += ` board-square--${color}`;
      else className += ' board-square--default';

      return (
        <div
          key={`sq-${x}-${y}`}
          className={className}
          style={{
            gridColumn: x + 1,
            gridRow: y + 1,
          }}
        />
      );
    }

    // Check if this is a home stretch square
    for (const [color, squares] of Object.entries(HOME_STRETCHES)) {
      const idx = squares.findIndex(s => s.x === x && s.y === y);
      if (idx >= 0) {
        return (
          <div
            key={`sq-${x}-${y}`}
            className={`board-square board-square--home-stretch-${color}`}
            style={{
              gridColumn: x + 1,
              gridRow: y + 1,
            }}
          />
        );
      }
    }

    return null;
  };

  return (
    <div className="board-container">
      <div className="board-grid">
        {/* Render home bases as positioned overlays */}
        {(['red', 'green', 'yellow', 'blue'] as const).map(color => {
          const basePos = HOME_BASES[color];
          const minX = Math.min(...basePos.map(p => p.x));
          const minY = Math.min(...basePos.map(p => p.y));
          const maxX = Math.max(...basePos.map(p => p.x));
          const maxY = Math.max(...basePos.map(p => p.y));

          return (
            <div
              key={`base-${color}`}
              className={`home-base home-base--${color}`}
              style={{
                position: 'absolute',
                left: `${(minX / 15) * 100}%`,
                top: `${(minY / 15) * 100}%`,
                width: `${((maxX - minX + 1) / 15) * 100}%`,
                height: `${((maxY - minY + 1) / 15) * 100}%`,
                zIndex: 1,
              }}
            >
              <span className="home-base-label">{PLAYER_CONFIG[color].label}</span>
            </div>
          );
        })}

        {/* Render the grid squares */}
        {Array.from({ length: 15 }, (_, y) =>
          Array.from({ length: 15 }, (_, x) => renderSquare(x, y))
        )}

        {/* Center goal */}
        <div
          className="board-center"
          style={{
            gridColumn: 8,
            gridRow: 8,
          }}
        >
          🏁
        </div>
      </div>

      {/* Pieces overlay */}
      <div className="pieces-overlay">
        <AnimatePresence>
          {pieces.map(piece => {
            const coords = getPieceCoords(piece);
            const isCurrentPlayer = piece._playerId === currentPlayer?.id;
            const percentage = 100 / 15;

            return (
              <Piece
                key={piece.id}
                piece={piece}
                x={`${coords.x * percentage + percentage / 2}%`}
                y={`${coords.y * percentage + percentage / 2}%`}
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
