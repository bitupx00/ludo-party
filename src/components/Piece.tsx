import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Piece as PieceType, Color } from '../game/types.ts';
import PawnSVG from './PawnSVG.tsx';
import { playSfx } from '../sound.ts';
import { STEP_DURATION } from '../game/anim.ts';

export { STEP_DURATION };

interface PieceProps {
  piece: PieceType & { _color: Color; _playerId: string; _isMovable: boolean };
  /** Waypoint keyframes (percent strings). Length 1 = direct placement. */
  xs: string[];
  ys: string[];
  /** Group layout when several pieces share a square (Ludo Club style):
   *  fractional offsets of the piece's own box + a shrink factor, so
   *  grouped pieces sit side by side instead of overlapping. */
  layout: { fx: number; fy: number; scale: number };
  /** Seconds per travel cell — normal moves use STEP_DURATION; a captured
   *  piece's backward run to base uses a much faster step. */
  stepDuration?: number;
  onClick: (pieceId: string) => void;
}

function Piece({ piece, xs, ys, layout, stepDuration = STEP_DURATION, onClick }: PieceProps) {
  const isFinished = piece.position >= 57;
  const canMove = piece._isMovable && !isFinished;
  const [traveling, setTraveling] = useState(false);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps = xs.length - 1;

  // Movement sound: one tick per cell while traveling. Fast backward runs
  // (captured piece flying home) only tick every few cells — a click per
  // 50ms cell would be machine-gun noise.
  useEffect(() => {
    if (steps < 1) return;
    setTraveling(true);
    playSfx('move');
    const tickEvery = stepDuration < 0.1 ? 4 : 1;
    let count = 1;
    tickTimer.current = setInterval(() => {
      if (count >= steps) {
        if (tickTimer.current) clearInterval(tickTimer.current);
        return;
      }
      count++;
      if (count % tickEvery === 0) playSfx('move');
    }, stepDuration * 1000);
    const settle = setTimeout(() => {
      setTraveling(false);
      playSfx('land');
    }, steps * stepDuration * 1000 + 60);
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
          ? { duration: steps * stepDuration, ease: stepDuration < 0.1 ? 'linear' : 'easeInOut' }
          : { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 }
      }
    >
      {/* Static layer owns the centering translate — framer animates scale on
          the button below and would clobber a CSS transform there. Group
          layout shrinks the piece around its cell-anchor point (50%, 80%)
          and nudges it by fractions of its own box → responsive. */}
      <div
        className="piece-offset"
        style={{
          transform: `translate(calc(-50% + ${layout.fx * 100}%), calc(-80% + ${layout.fy * 100}%)) scale(${layout.scale})`,
          transformOrigin: '50% 80%',
          transition: 'transform 180ms ease',
        }}
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

/** Memoized with a field-level comparator: every move rebuilds ALL piece
 *  objects (immutable state updates), so identity checks alone would
 *  re-render all 16 pawns on every store change. Only re-render when
 *  something this pawn actually shows has changed. The travel keyframe
 *  arrays (xs/ys) come from Board's cache, so their identity is stable
 *  for the life of a position. */
export default memo(Piece, (a, b) =>
  a.piece.id === b.piece.id &&
  a.piece.position === b.piece.position &&
  a.piece._color === b.piece._color &&
  a.piece._isMovable === b.piece._isMovable &&
  a.xs === b.xs &&
  a.ys === b.ys &&
  a.stepDuration === b.stepDuration &&
  a.layout.fx === b.layout.fx &&
  a.layout.fy === b.layout.fy &&
  a.layout.scale === b.layout.scale &&
  a.onClick === b.onClick,
);
