import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { Color } from '../game/types.ts';
import { PLAYER_CONFIG, TEAMMATE } from '../game/types.ts';
import { useGameStore } from '../store/gameStore.ts';
import { useRankStore } from '../ranking.ts';
import { playSfx, vibrate } from '../sound.ts';
import { useT } from '../i18n.ts';
import PawnSVG from './PawnSVG.tsx';

interface WinScreenProps {
  winnerColor: Color;
}

export default function WinScreen({ winnerColor }: WinScreenProps) {
  const t = useT();
  const config = PLAYER_CONFIG[winnerColor];
  const players = useGameStore((s) => s.players);
  const onlineRole = useGameStore((s) => s.onlineRole);
  const playAgain = useGameStore((s) => s.playAgain);
  const goHome = useGameStore((s) => s.goHome);
  const canRestart = onlineRole !== 'guest';

  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const isTeams = useGameStore.getState().teamsMode === true;
  const teammateColor = TEAMMATE[winnerColor];
  const winnerPlayer = players.find((p) => p.color === winnerColor);
  const teammatePlayer = players.find((p) => p.color === teammateColor);

  // Victory or defeat sound, from this device's point of view
  useEffect(() => {
    const me = localPlayerId
      ? players.find((p) => p.id === localPlayerId)
      : players.find((p) => !p.isBot);
    const iWon = me
      ? me.color === winnerColor || (isTeams && me.color === teammateColor)
      : false;
    playSfx(iWon ? 'win' : 'lose');
    if (iWon) vibrate([60, 60, 60, 60, 120]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record the match in the DEVICE-LOCAL ranking: online games record only
  // this device's own player; local tables record every human seat.
  const recorded = useRef(false);
  const recordMatch = useRankStore((s) => s.recordMatch);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    const s = useGameStore.getState();
    const tracked = s.onlineRole !== 'none'
      ? s.players.filter((p) => p.id === s.localPlayerId && !p.isBot)
      : s.players.filter((p) => !p.isBot);
    if (tracked.length === 0) return;
    recordMatch(tracked.map((p) => ({
      name: p.name,
      won: p.color === winnerColor || (isTeams && p.color === teammateColor),
      kills: p.kills ?? 0,
      goals: p.pieces.filter((pc) => pc.position >= 57).length,
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const winnerColors = isTeams ? [winnerColor, teammateColor] : [winnerColor];
  const title = isTeams
    ? `${winnerPlayer?.name ?? ''} + ${teammatePlayer?.name ?? ''}`
    : winnerPlayer?.name ?? config.label;

  useEffect(() => {
    // Fire confetti bursts
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = [config.cssColor, config.cssLight, '#FFD700', '#ffffff'];

    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial big burst
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors });
    frame();

    return () => confetti.reset();
  }, [winnerColor, config]);

  return (
    <motion.div
      className="win-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
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

        <div className="win-pawns">
          {winnerColors.map((color, i) => (
            <motion.div
              key={color}
              className="win-pawn"
              initial={{ scale: 0, y: 30 }}
              animate={{ scale: 1, y: [0, -12, 0] }}
              transition={{
                scale: { type: 'spring', stiffness: 250, damping: 14, delay: 0.6 + i * 0.15 },
                y: { duration: 1.2, repeat: Infinity, delay: 0.8 + i * 0.2, ease: 'easeInOut' },
              }}
            >
              <PawnSVG color={color} />
            </motion.div>
          ))}
        </div>

        <motion.p
          className="win-label"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {isTeams ? t('teamWinner') : t('winner')}
        </motion.p>

        <motion.h1
          className="win-title"
          style={{ color: config.cssLight }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          {title} <span className="win-wins">{t('wins')}</span>
        </motion.h1>

        <motion.div
          className="win-stars"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          ⭐ 🏆 ⭐
        </motion.div>

        <motion.div
          className="win-actions"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          {canRestart && (
            <motion.button
              className="btn btn-primary win-btn"
              onClick={playAgain}
              whileTap={{ scale: 0.94 }}
            >
              🔄 {t('playAgain')}
            </motion.button>
          )}
          <motion.button
            className="btn btn-secondary win-btn"
            onClick={goHome}
            whileTap={{ scale: 0.94 }}
          >
            🏠 {t('mainMenu')}
          </motion.button>
        </motion.div>
      </motion.div>

      <style>{`
        .win-screen {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle, rgba(30, 15, 90, 0.9) 0%, rgba(15, 6, 50, 0.97) 100%);
          overflow: hidden;
        }
        .win-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--gap-sm);
          text-align: center;
          padding: var(--gap-xl);
          max-width: 92vw;
        }
        .win-crown {
          font-size: 3.6rem;
          filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
        }
        .win-pawns {
          display: flex;
          align-items: flex-end;
          gap: 14px;
        }
        .win-pawn {
          width: clamp(64px, 20vw, 96px);
        }
        .win-pawn svg {
          width: 100%;
          height: auto;
          display: block;
          filter: drop-shadow(0 0 24px rgba(255, 215, 0, 0.35));
        }
        .win-label {
          font-size: 0.85rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--color-text-muted);
        }
        .win-title {
          font-family: var(--font-display);
          font-size: clamp(1.7rem, 8vw, 2.8rem);
          font-weight: 800;
          line-height: 1.15;
          animation: winner-glow 2s ease-in-out infinite;
          word-break: break-word;
        }
        .win-wins {
          color: #ffd65a;
        }
        .win-stars {
          font-size: 1.2rem;
          animation: float 3s ease-in-out infinite;
        }
        .win-actions {
          margin-top: var(--gap-md);
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: min(300px, 80vw);
        }
        .win-btn {
          width: 100%;
        }
      `}</style>
    </motion.div>
  );
}
