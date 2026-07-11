import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiceProps {
  value: number | null;
  onRoll: () => void;
  canRoll: boolean;
  isBot: boolean;
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function Dice({ value, onRoll, canRoll, isBot }: DiceProps) {
  const [rolling, setRolling] = useState(false);
  const [displayFace, setDisplayFace] = useState(DICE_FACES[0]);

  const roll = useCallback(() => {
    if (!canRoll || rolling) return;
    setRolling(true);

    let count = 0;
    const interval = setInterval(() => {
      setDisplayFace(DICE_FACES[Math.floor(Math.random() * 6)]);
      count++;
      if (count >= 12) {
        clearInterval(interval);
        setRolling(false);
        onRoll();
      }
    }, 80);
  }, [canRoll, rolling, onRoll]);

  // Auto-roll for bots
  useEffect(() => {
    if (isBot && canRoll && !rolling) {
      const timeout = setTimeout(roll, 500);
      return () => clearTimeout(timeout);
    }
  }, [isBot, canRoll, rolling, roll]);

  // Update display when value changes
  useEffect(() => {
    if (value !== null && !rolling) {
      setDisplayFace(DICE_FACES[value - 1]);
    }
  }, [value, rolling]);

  const isSix = value === 6 && !rolling;

  return (
    <div className="dice-area">
      <motion.div
        className={`dice ${rolling ? 'dice--rolling' : ''} ${isSix ? 'dice--six' : ''}`}
        animate={rolling ? {
          rotate: [0, -15, 15, -10, 10, -5, 5, 0],
          scale: [1, 1.1, 1.05, 1.1, 1.05, 1.08, 1.03, 1],
        } : value !== null ? {
          scale: [0.8, 1.15, 1],
        } : {}}
        transition={rolling ? {
          duration: 0.8,
          repeat: Infinity,
          ease: 'easeInOut',
        } : {
          duration: 0.3,
          ease: 'easeOut',
        }}
        onClick={roll}
        style={{ cursor: canRoll && !rolling && !isBot ? 'pointer' : 'default' }}
      >
        <span className="dice-face">{displayFace}</span>
        {isSix && <div className="dice-gold-ring" />}
      </motion.div>

      <AnimatePresence>
        {canRoll && !rolling && !isBot && (
          <motion.button
            className="btn btn-primary dice-roll-btn"
            onClick={roll}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            whileTap={{ scale: 0.9 }}
          >
            🎲 ¡Tira el dado!
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rolling && (
          <motion.p
            className="dice-status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
          >
            {isBot ? '🤖 Bot pensando...' : '🎲 Tirando...'}
          </motion.p>
        )}
      </AnimatePresence>

      <style>{`
        .dice-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--gap-md);
        }
        .dice {
          position: relative;
          width: min(14vmin, 80px);
          height: min(14vmin, 80px);
          border-radius: var(--radius-lg);
          background: linear-gradient(145deg, #ffffff, #e6e6e6);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 4px 16px rgba(0, 0, 0, 0.3),
            inset 0 2px 4px rgba(255, 255, 255, 0.8),
            inset 0 -2px 4px rgba(0, 0, 0, 0.1);
          user-select: none;
          -webkit-tap-highlight-color: transparent;
          transition: box-shadow 0.3s ease;
        }
        .dice:hover {
          box-shadow:
            0 6px 24px rgba(0, 0, 0, 0.4),
            inset 0 2px 4px rgba(255, 255, 255, 0.8),
            inset 0 -2px 4px rgba(0, 0, 0, 0.1);
        }
        .dice-face {
          font-size: min(8vmin, 50px);
          line-height: 1;
        }
        .dice--rolling {
          cursor: not-allowed;
        }
        .dice--six {
          box-shadow:
            0 0 20px rgba(255, 215, 0, 0.6),
            0 0 40px rgba(255, 215, 0, 0.3),
            0 4px 16px rgba(0, 0, 0, 0.3),
            inset 0 2px 4px rgba(255, 255, 255, 0.8);
        }
        .dice-gold-ring {
          position: absolute;
          inset: -4px;
          border-radius: var(--radius-lg);
          border: 3px solid rgba(255, 215, 0, 0.6);
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
        .dice-roll-btn {
          font-size: 1rem;
          padding: 10px 24px;
        }
        .dice-status {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
