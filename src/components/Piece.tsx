import { motion } from 'framer-motion';
import type { Piece as PieceType, Color } from '../game/types.ts';
import { PLAYER_CONFIG } from '../game/types.ts';

interface PieceProps {
  piece: PieceType & { _color: Color; _playerId: string; _isMovable: boolean };
  x: string;
  y: string;
  isCurrentPlayer: boolean;
  onClick: (pieceId: string) => void;
}

export default function Piece({ piece, x, y, isCurrentPlayer, onClick }: PieceProps) {
  const config = PLAYER_CONFIG[piece._color];
  const canMove = piece._isMovable && piece.position !== 56;
  const isFinished = piece.position === 56;

  const handleClick = () => {
    if (canMove) {
      onClick(piece.id);
    }
  };

  return (
    <motion.div
      className={`piece-slot`}
      style={{
        left: x,
        top: y,
      }}
      initial={false}
      animate={{
        left: x,
        top: y,
        scale: canMove ? [1, 1.08, 1] : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
        mass: 0.5,
      }}
    >
      <motion.div
        className={[
          'piece',
          `piece--${piece._color}`,
          canMove && 'piece--movable',
          isCurrentPlayer && !canMove && 'piece--current',
          isFinished && 'piece--finished',
        ].filter(Boolean).join(' ')}
        onClick={handleClick}
        whileTap={canMove ? { scale: 0.8 } : {}}
      >
        {config.emoji}
      </motion.div>
    </motion.div>
  );
}
