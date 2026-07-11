import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Piece as PieceType, Color } from '../game/types.ts';
import PawnSVG from './PawnSVG.tsx';
import { playSfx } from '../sound.ts';

interface PieceProps {
  piece: PieceType & { _color: Color; _playerId: string; _isMovable: boolean };
  /** Waypoint keyframes (percent strings). Length 1 = direct placement. */
  xs: string[];
  ys: string[];
  /** Stacking offset in px when several pieces share a cell. */
  offset: { dx: number; dy: number };
  isCurrentPlayer: boolean;
  onClick: (pieceId: string) => void;
}

const STEP_DURATION = 0.17; // seconds per cell

export default function Piece({ piece, xs, ys, offset, onClick }: PieceProps) {
  const isFinished = piece.position >= 56;
  const canMove = piece._isMovable && !isFinished;
  const [traveling, setTraveling] = useState(false);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = xs.length - 1;

  // Movement sound: one tick per cell while traveling
  useEffect(() => {
    if (steps < 1) return;
    setTraveling(true);
    playSfx('move');
    let count = 1;
    tickTimer.current = setInterval(() => {
      if (count >= steps) {
        if (tickTimer.current) clearInterval(tickTimer.current);
        return;
      }
      count++;
      playSfx('move');
    }, STEP_DURATION * 1000);
    const settle = setTimeout(() => {
      setTraveling(false);
      playSfx('land');
    }, steps * STEP_DURATION * 1000 + 60);
    return () => {
      if (tickTimer.current) clearInterval(tickTimer.current);
      clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.position]);

  const handleClick = () => {
    if (canMove) {
      onClick(piece.id);
    }
  };

  const isKeyframed = steps >= 1;

  return (
    <motion.div
      className="piece-slot"
      style={{ zIndex: traveling ? 30 : canMove ? 20 : 10 }}
      initial={false}
      animate={{
        left: isKeyframed ? xs : xs[0],
        top: isKeyframed ? ys : ys[0],
      }}
      transition={
        isKeyframed
          ? { duration: steps * STEP_DURATION, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 }
      }
    >
      {/* Static layer owns the centering translate — framer animates scale on
          the button below and would clobber a CSS transform there. */}
      <div
        className="piece-offset"
        style={{ transform: `translate(calc(-50% + ${offset.dx}px), calc(-80% + ${offset.dy}px))` }}
      >
        <motion.button
          className={[
            'piece',
            canMove && 'piece--movable',
            traveling && 'piece--traveling',
            isFinished && 'piece--finished',
          ].filter(Boolean).join(' ')}
          onClick={handleClick}
          whileTap={canMove ? { scale: 0.85 } : {}}
          animate={traveling ? {} : { scale: [1.08, 0.96, 1] }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          aria-label={`${piece._color} piece`}
        >
          <PawnSVG color={piece._color} className="piece-svg" />
        </motion.button>
      </div>
    </motion.div>
  );
}
