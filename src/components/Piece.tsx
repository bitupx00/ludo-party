import { motion } from 'framer-motion';
import type { Piece as PieceType, Color } from '../game/types.ts';
import PawnSVG from './PawnSVG.tsx';

interface PieceProps {
  piece: PieceType & { _color: Color; _playerId: string; _isMovable: boolean };
  x: string;
  y: string;
  isCurrentPlayer: boolean;
  onClick: (pieceId: string) => void;
}

export default function Piece({ piece, x, y, onClick }: PieceProps) {
  const isFinished = piece.position >= 56;
  const canMove = piece._isMovable && !isFinished;

  const handleClick = () => {
    if (canMove) {
      onClick(piece.id);
    }
  };

  return (
    <motion.div
      className="piece-slot"
      style={{ zIndex: canMove ? 20 : 10 }}
      initial={false}
      animate={{ left: x, top: y }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        mass: 0.5,
      }}
    >
      <motion.button
        className={[
          'piece',
          canMove && 'piece--movable',
          isFinished && 'piece--finished',
        ].filter(Boolean).join(' ')}
        onClick={handleClick}
        whileTap={canMove ? { scale: 0.85 } : {}}
        aria-label={`${piece._color} piece`}
      >
        <PawnSVG color={piece._color} className="piece-svg" />
      </motion.button>
    </motion.div>
  );
}
