import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import type { GameMode } from '../game/types.ts';
import { useT, useLangStore, TIPS } from '../i18n.ts';
import PawnSVG from './PawnSVG.tsx';
import ProfileCard from './ProfileCard.tsx';

const MODES: Array<{ mode: GameMode; icon: string; titleKey: 'modeSolo' | 'modeLocal' | 'modeTeams' | 'modeOnline'; descKey: 'modeSoloDesc' | 'modeLocalDesc' | 'modeTeamsDesc' | 'modeOnlineDesc'; accent: string }> = [
  { mode: 'online', icon: '🌐', titleKey: 'modeOnline', descKey: 'modeOnlineDesc', accent: '#9333ea' },
  { mode: 'solo', icon: '🤖', titleKey: 'modeSolo', descKey: 'modeSoloDesc', accent: 'var(--color-blue)' },
  { mode: 'local', icon: '👥', titleKey: 'modeLocal', descKey: 'modeLocalDesc', accent: 'var(--color-green)' },
  { mode: 'teams', icon: '🤝', titleKey: 'modeTeams', descKey: 'modeTeamsDesc', accent: 'var(--color-red)' },
];

export default function Home() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const toggleLang = useLangStore((s) => s.toggleLang);
  const openLobby = useGameStore((s) => s.openLobby);
  const onlineError = useGameStore((s) => s.onlineError);
  const [tipIndex, setTipIndex] = useState(0);

  const tips = TIPS[lang];

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [tips.length]);

  // Deep link: opening /?room=CODE jumps straight to the online lobby
  useEffect(() => {
    try {
      const room = new URLSearchParams(window.location.search).get('room');
      if (room) openLobby('online');
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen home">
      {/* Player profile (persistent points + transfer between devices) */}
      <ProfileCard />

      {/* Language toggle */}
      <button className="home-lang" onClick={toggleLang} aria-label="Language">
        {lang === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
      </button>

      <div className="screen-inner home-inner">
        {/* Logo */}
        <motion.div
          className="home-logo"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div className="home-dice-emoji">🎲</div>
          <h1 className="home-title">
            LUDO<span className="home-title-accent">PARTY</span>
          </h1>
          <p className="home-tagline">{t('tagline')}</p>
        </motion.div>

        {/* Pawn parade */}
        <motion.div
          className="home-pawns"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {(['red', 'green', 'yellow', 'blue'] as const).map((color, i) => (
            <motion.div
              key={color}
              className="home-pawn"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            >
              <PawnSVG color={color} />
            </motion.div>
          ))}
        </motion.div>

        {/* Online error (e.g. host closed the room) */}
        {onlineError && (
          <motion.p
            className="home-online-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            ⚠️ {t(onlineError as Parameters<typeof t>[0])}
          </motion.p>
        )}

        {/* Mode cards */}
        <div className="home-modes">
          <motion.p
            className="home-choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            {t('chooseMode')}
          </motion.p>
          {MODES.map((m, i) => (
            <motion.button
              key={m.mode}
              className="home-mode-card"
              style={{ '--accent': m.accent } as React.CSSProperties}
              onClick={() => openLobby(m.mode)}
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.1, type: 'spring', stiffness: 260, damping: 22 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="home-mode-icon">{m.icon}</span>
              <span className="home-mode-text">
                <span className="home-mode-title">{t(m.titleKey)}</span>
                <span className="home-mode-desc">{t(m.descKey)}</span>
              </span>
              <span className="home-mode-arrow">›</span>
            </motion.button>
          ))}
        </div>

        {/* Rotating tip */}
        <div className="home-tips">
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 0.75 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="home-tip"
            >
              💡 {tips[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <style>{`
        .home {
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        .home-inner {
          align-items: center;
          justify-content: center;
          gap: var(--gap-lg);
          max-width: 440px;
        }
        .home-lang {
          position: absolute;
          top: calc(14px + env(safe-area-inset-top));
          right: 14px;
          padding: 8px 14px;
          border-radius: var(--radius-full);
          border: 2px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.12);
          color: var(--color-text);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          z-index: 5;
          backdrop-filter: blur(8px);
        }
        .home-logo {
          text-align: center;
        }
        .home-dice-emoji {
          font-size: 3.2rem;
          animation: float 3s ease-in-out infinite;
          filter: drop-shadow(0 6px 10px rgba(18, 8, 60, 0.4));
        }
        .home-title {
          font-family: var(--font-display);
          font-size: clamp(2.6rem, 12vw, 3.6rem);
          font-weight: 800;
          letter-spacing: 1px;
          line-height: 1;
          color: #fff;
          text-shadow:
            0 3px 0 rgba(40, 20, 120, 0.9),
            0 8px 20px rgba(18, 8, 60, 0.5);
        }
        .home-title-accent {
          color: #ffd65a;
        }
        .home-tagline {
          margin-top: 8px;
          font-size: 0.95rem;
          color: var(--color-text-secondary);
          font-weight: 700;
        }
        .home-pawns {
          display: flex;
          align-items: flex-end;
          gap: 10px;
        }
        .home-pawn {
          width: clamp(38px, 11vw, 52px);
        }
        .home-pawn svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .home-online-error {
          font-size: 0.85rem;
          font-weight: 800;
          color: #ffb0bb;
          background: rgba(240, 64, 92, 0.18);
          border: 1px solid rgba(240, 64, 92, 0.4);
          padding: 6px 16px;
          border-radius: var(--radius-full);
        }
        .home-modes {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .home-choose {
          text-align: center;
          font-size: 0.85rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--color-text-muted);
          margin-bottom: 2px;
        }
        .home-mode-card {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 18px;
          border: none;
          border-radius: var(--radius-xl);
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255, 255, 255, 0.16);
          box-shadow:
            0 5px 0 rgba(20, 8, 70, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          color: var(--color-text);
          cursor: pointer;
          text-align: left;
          transition: transform 120ms ease, box-shadow 120ms ease, background 150ms ease;
          touch-action: manipulation;
        }
        .home-mode-card:hover {
          background: rgba(255, 255, 255, 0.18);
        }
        .home-mode-card:active {
          transform: translateY(4px);
          box-shadow: 0 1px 0 rgba(20, 8, 70, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }
        .home-mode-icon {
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          border-radius: var(--radius-lg);
          background: var(--accent);
          box-shadow: inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 2px 0 rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.7rem;
        }
        .home-mode-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }
        .home-mode-title {
          font-family: var(--font-display);
          font-size: 1.15rem;
          font-weight: 800;
        }
        .home-mode-desc {
          font-size: 0.8rem;
          color: var(--color-text-secondary);
          font-weight: 700;
        }
        .home-mode-arrow {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--color-text-muted);
        }
        .home-tips {
          min-height: 24px;
          text-align: center;
        }
        .home-tip {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
