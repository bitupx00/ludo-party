import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { Color } from '../game/types.ts';
import { PLAYER_CONFIG } from '../game/types.ts';

interface WinScreenProps {
  winnerColor: Color;
  onPlayAgain: () => void;
}

export default function WinScreen({ winnerColor, onPlayAgain }: WinScreenProps) {
  const config = PLAYER_CONFIG[winnerColor];

  useEffect(() => {
    // Fire confetti bursts
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: [config.cssColor, config.cssLight, '#FFD700', '#ffffff'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: [config.cssColor, config.cssLight, '#FFD700', '#ffffff'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: [config.cssColor, config.cssLight, '#FFD700', '#ffffff'],
    });

    frame();

    return () => confetti.reset();
  }, [winnerColor, config]);

  // Parade emojis
  const paradeEmojis = Array.from({ length: 8 }, () => config.emoji);

  return (
    <motion.div
      className="win-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Parade */}
      {paradeEmojis.map((emoji, i) => (
        <span
          key={i}
          className="win-parade-emoji"
          style={{
            animation: `parade 4s linear ${i * 0.5}s infinite`,
            top: `${20 + (i % 3) * 25}%`,
            fontSize: `${1.5 + (i % 3) * 0.5}rem`,
          }}
        >
          {emoji}
        </span>
      ))}

      <motion.div
        className="win-content"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
      >
        <motion.div
          className="win-crown"
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.5 }}
        >
          👑
        </motion.div>

        <motion.div
          className="win-emoji"
          style={{ color: config.cssColor }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.7 }}
        >
          {config.emoji}
        </motion.div>

        <motion.h1
          className="win-title"
          style={{ color: config.cssColor }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          ¡GANASTE!
        </motion.h1>

        <motion.div
          className="win-stars"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
        >
          ⭐ 🏆 ⭐ 🏆 ⭐
        </motion.div>

        <motion.button
          className="btn btn-primary win-restart-btn"
          onClick={onPlayAgain}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5 }}
          whileTap={{ scale: 0.9 }}
          style={{
            background: `linear-gradient(135deg, ${config.cssColor}, ${config.cssLight})`,
          }}
        >
          🔄 Jugar de nuevo
        </motion.button>
      </motion.div>

      <style>{`
        .win-screen {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%);
          overflow: hidden;
        }
        .win-parade-emoji {
          position: absolute;
          pointer-events: none;
          z-index: 1;
        }
        .win-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--gap-md);
          text-align: center;
          padding: var(--gap-xl);
        }
        .win-crown {
          font-size: 4rem;
          filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
        }
        .win-emoji {
          font-size: 5rem;
          filter: drop-shadow(0 0 30px currentColor);
        }
        .win-title {
          font-size: clamp(2.5rem, 10vw, 4rem);
          font-weight: 900;
          letter-spacing: 4px;
          text-transform: uppercase;
          animation: winner-glow 2s ease-in-out infinite;
        }
        .win-stars {
          font-size: 1.2rem;
          animation: float 3s ease-in-out infinite;
        }
        .win-restart-btn {
          margin-top: var(--gap-lg);
          padding: 16px 40px;
          font-size: 1.1rem;
          min-height: 56px;
        }
      `}</style>
    </motion.div>
  );
}
