import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { playSfx, vibrate } from '../sound.ts';
import { useT } from '../i18n.ts';

/**
 * Big tappable 3D CSS dice (Ludo Club style).
 * The dice value comes from the store; this component only animates toward it.
 */

interface Dice3DProps {
  value: number | null;
  /** Increments on every roll (human or bot) — triggers the spin animation. */
  rollSeq: number;
  canRoll: boolean;
  isBot: boolean;
  onRoll: () => void;
}

/** Cube rotation that shows each face front-and-center. */
const FACE_ROTATION: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};

/** Which of the 9 grid slots hold a pip for each face value. */
export const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const FACE_TRANSFORMS: Record<number, string> = {
  1: 'rotateY(0deg)',
  2: 'rotateX(90deg)',
  3: 'rotateY(90deg)',
  4: 'rotateY(-90deg)',
  5: 'rotateX(-90deg)',
  6: 'rotateY(180deg)',
};

function DiceFace({ value }: { value: number }) {
  const pips = PIP_MAP[value];
  return (
    <div className="d3-face" style={{ transform: `${FACE_TRANSFORMS[value]} translateZ(var(--d3-half))` }}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'd3-pip' : 'd3-pip d3-pip--off'} />
      ))}
    </div>
  );
}

/**
 * Small flat die badge shown next to an opponent's avatar while it's their
 * turn (Ludo Club style) — the big interactive Dice3D only appears in the
 * HUD during the LOCAL player's own turn.
 */
export function MiniDice({ value, rolling }: { value: number | null; rolling: boolean }) {
  const pips = value ? PIP_MAP[value] : [];
  return (
    <div className={`mini-dice ${rolling ? 'mini-dice--rolling' : ''}`}>
      {value ? (
        <div className="mini-dice-face">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className={pips.includes(i) ? 'mini-dice-pip' : 'mini-dice-pip mini-dice-pip--off'} />
          ))}
        </div>
      ) : (
        <span className="mini-dice-icon">🎲</span>
      )}
      <style>{`
        .mini-dice {
          width: clamp(20px, 5.5vmin, 26px);
          height: clamp(20px, 5.5vmin, 26px);
          border-radius: 22%;
          background: radial-gradient(circle at 30% 25%, #ffffff 0%, #f3eee2 55%, #ddd3bd 100%);
          border: 1.5px solid rgba(120, 100, 60, 0.3);
          box-shadow: 0 2px 6px rgba(18, 8, 60, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mini-dice--rolling {
          animation: pulse-glow 0.7s ease-in-out infinite;
        }
        .mini-dice-icon {
          font-size: clamp(11px, 3vmin, 14px);
          line-height: 1;
        }
        .mini-dice-face {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          place-items: center;
          padding: 14%;
        }
        .mini-dice-pip {
          width: 70%;
          height: 70%;
          border-radius: 50%;
          background: #4534b8;
        }
        .mini-dice-pip--off {
          visibility: hidden;
        }
      `}</style>
    </div>
  );
}

export default function Dice3D({ value, rollSeq, canRoll, isBot, onRoll }: Dice3DProps) {
  const t = useT();
  const [rotation, setRotation] = useState({ x: -20, y: -25 });
  const [rolling, setRolling] = useState(false);
  const spinCount = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Animate to the rolled value whenever a new roll happens.
  // Depends ONLY on rollSeq: diceValue resets to null on turn change, and that
  // must not cancel the settle timer (it would leave the dice locked "rolling").
  useEffect(() => {
    if (rollSeq === 0) return;
    const v = valueRef.current;
    if (v == null) return;
    spinCount.current += 1;
    const target = FACE_ROTATION[v];
    const extra = 360 * (spinCount.current * 2);
    setRotation({ x: target.x + extra, y: target.y + extra });
    setRolling(true);
    playSfx('dice');
    vibrate(25);
    const timer = setTimeout(() => {
      setRolling(false);
      if (v === 6) { playSfx('six'); vibrate([20, 30, 40]); }
    }, 950);
    return () => clearTimeout(timer);
  }, [rollSeq]);

  const tappable = canRoll && !isBot && !rolling;

  const handleTap = () => {
    if (tappable) onRoll();
  };

  return (
    <div className="dice3d-area">
      <motion.button
        className={`dice3d ${tappable ? 'dice3d--ready' : ''}`}
        onClick={handleTap}
        whileTap={tappable ? { scale: 0.9 } : {}}
        aria-label={t('rollDice')}
        disabled={!tappable}
      >
        <div
          className="d3-cube"
          style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}
        >
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <DiceFace key={f} value={f} />
          ))}
        </div>
        {tappable && <span className="dice3d-ring" />}
      </motion.button>

      <div className="dice3d-label-slot">
        <AnimatePresence mode="wait">
          {tappable && (
            <motion.span
              key="tap"
              className="dice3d-label"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              👆 {t('rollDice')}
            </motion.span>
          )}
          {rolling && (
            <motion.span
              key="rolling"
              className="dice3d-label dice3d-label--muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              🎲 {t('rolling')}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .dice3d-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .dice3d {
          --d3-size: clamp(58px, 16vmin, 86px);
          --d3-half: calc(var(--d3-size) / 2);
          position: relative;
          width: var(--d3-size);
          height: var(--d3-size);
          perspective: calc(var(--d3-size) * 5);
          background: transparent;
          border: none;
          cursor: default;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          filter: drop-shadow(0 10px 14px rgba(20, 8, 60, 0.45));
        }
        .dice3d--ready {
          cursor: pointer;
          animation: dice-nudge 1.6s ease-in-out infinite;
        }
        @keyframes dice-nudge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        .d3-cube {
          position: absolute;
          inset: 0;
          transform-style: preserve-3d;
          transition: transform 0.9s cubic-bezier(0.2, 0.75, 0.3, 1.1);
        }
        .d3-face {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
          place-items: center;
          padding: 16%;
          border-radius: 18%;
          background:
            radial-gradient(circle at 30% 25%, #ffffff 0%, #f3eee2 55%, #ddd3bd 100%);
          border: 1px solid rgba(120, 100, 60, 0.25);
          box-shadow: inset 0 0 10px rgba(120, 100, 60, 0.18);
          backface-visibility: hidden;
        }
        .d3-pip {
          width: 72%;
          height: 72%;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 30%, #6b5cf0 0%, #4534b8 70%, #32247e 100%);
          box-shadow: inset 0 -1px 2px rgba(0, 0, 0, 0.35), 0 1px 1px rgba(255, 255, 255, 0.6);
        }
        .d3-pip--off {
          visibility: hidden;
        }
        .dice3d-ring {
          position: absolute;
          inset: -9px;
          border-radius: 26%;
          border: 3px solid rgba(255, 214, 90, 0.85);
          pointer-events: none;
          animation: pulse-ring 1.4s ease-in-out infinite;
        }
        .dice3d-label-slot {
          min-height: 22px;
          display: flex;
          align-items: center;
        }
        .dice3d-label {
          font-family: var(--font-display);
          white-space: nowrap;
          font-size: 0.9rem;
          font-weight: 800;
          color: #ffd65a;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
        .dice3d-label--muted {
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}
