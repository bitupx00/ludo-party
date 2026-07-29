import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import type { GameMode } from '../game/types.ts';
import { useT, useLangStore, TIPS } from '../i18n.ts';
import ProfileCard from './ProfileCard.tsx';
import TutorialModal, { TUTORIAL_SEEN_KEY } from './TutorialModal.tsx';
import RegisterModal from './RegisterModal.tsx';
import { ensureProfile, getCoins, claimStatus, claimDaily, loadProfile, DAILY_REWARDS, DAY7_STAR_BONUS } from '../profile.ts';
import type { LucideIcon } from 'lucide-react';
import {
  Backpack, Bot, CircleHelp, Coins, Gamepad2, Gift, Globe, Handshake,
  Hexagon, Lightbulb, Star, Trophy, Users,
} from 'lucide-react';

const MODES: Array<{ mode: GameMode; Icon: LucideIcon; titleKey: 'modeSolo' | 'modeLocal' | 'modeTeams' | 'modeOnline' | 'modeHex'; descKey: 'modeSoloDesc' | 'modeLocalDesc' | 'modeTeamsDesc' | 'modeOnlineDesc' | 'modeHexDesc'; accent: string }> = [
  { mode: 'online', Icon: Globe, titleKey: 'modeOnline', descKey: 'modeOnlineDesc', accent: '#9333ea' },
  { mode: 'hex6', Icon: Hexagon, titleKey: 'modeHex', descKey: 'modeHexDesc', accent: '#14b8a6' },
  { mode: 'solo', Icon: Bot, titleKey: 'modeSolo', descKey: 'modeSoloDesc', accent: 'var(--color-blue)' },
  { mode: 'local', Icon: Users, titleKey: 'modeLocal', descKey: 'modeLocalDesc', accent: 'var(--color-green)' },
  { mode: 'teams', Icon: Handshake, titleKey: 'modeTeams', descKey: 'modeTeamsDesc', accent: 'var(--color-red)' },
];

export default function Home() {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const toggleLang = useLangStore((s) => s.toggleLang);
  const openLobby = useGameStore((s) => s.openLobby);
  const openRanking = useGameStore((s) => s.openRanking);
  const openInventory = useGameStore((s) => s.openInventory);
  const openArcade = useGameStore((s) => s.openArcade);
  const onlineError = useGameStore((s) => s.onlineError);
  const [tipIndex, setTipIndex] = useState(0);
  const [dailyOpen, setDailyOpen] = useState(false);
  // Mandatory registration: with no profile on this device the register
  // window ALWAYS shows (create account or restore one) — nothing else
  // is reachable until the account exists and the wallet is persisted.
  const [needsRegister, setNeedsRegister] = useState(() => !loadProfile());
  // Guided tutorial: auto-opens the very first time the game loads
  // (AFTER registration when the account is new).
  const [helpOpen, setHelpOpen] = useState(() => {
    try { return !!loadProfile() && !localStorage.getItem(TUTORIAL_SEEN_KEY); } catch { return false; }
  });
  const handleRegistered = () => {
    setNeedsRegister(false);
    setCoins(getCoins());
    setClaim(claimStatus());
    try { if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) setHelpOpen(true); } catch { /* noop */ }
  };
  const [coins, setCoins] = useState(getCoins);
  const [claim, setClaim] = useState(claimStatus);
  const handleClaim = () => {
    ensureProfile(''); // first claim may happen before any match names you
    const r = claimDaily();
    if (r) { setCoins(getCoins()); setClaim(claimStatus()); }
  };

  const tips = TIPS[lang];

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [tips.length]);

  // Deep link: opening /?room=CODE jumps straight to the online lobby —
  // but never before the device has a registered account (the register
  // modal only lives on this screen, so leaving would skip it).
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const room = url.searchParams.get('room');
      if (!room) return;
      // ONE-SHOT: strip the param so going back to the menu never bounces
      // you into the lobby again (the old loop trapped link visitors).
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname + url.search);
      useGameStore.setState({ pendingRoomCode: room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) });
      openLobby('online'); // registration (if needed) happens IN the lobby
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
        {lang === 'es' ? 'ES' : 'EN'}
      </button>

      {/* Local ranking */}
      <button className="home-rank" onClick={openRanking} aria-label={t('ranking')} title={t('ranking')}>
        <Trophy size={18} />
      </button>

      {/* Daily reward + manual */}
      <button className={`home-rank home-daily ${claim.canClaim ? 'home-daily--ready' : ''}`} onClick={() => setDailyOpen(true)} aria-label="Recompensa diaria">
        <Gift size={18} />
      </button>
      <button className="home-rank home-help" onClick={() => setHelpOpen(true)} aria-label="Cómo jugar">
        <CircleHelp size={18} />
      </button>
      <button className="home-rank home-inv" onClick={openInventory} aria-label="Inventario">
        <Backpack size={18} />
      </button>
      <button className="home-rank home-arc" onClick={openArcade} aria-label="Arcade">
        <Gamepad2 size={18} />
      </button>
      <div className="home-coins" title="Puntos (monedas)"><Coins size={13} className="home-coins-ico" /> {coins.toLocaleString('es')}</div>

      {dailyOpen && (
        <div className="home-modal-backdrop" onClick={() => setDailyOpen(false)}>
          <div className="home-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="home-modal-title"><Gift size={17} className="home-title-ico" /> Recompensa diaria</h2>
            <div className="home-cal">
              {DAILY_REWARDS.map((amt, i) => {
                const day = i + 1;
                const done = day < claim.day || (day === claim.day && !claim.canClaim);
                const isNext = day === claim.day && claim.canClaim;
                return (
                  <div key={day} className={`home-cal-day ${done ? 'home-cal-day--done' : ''} ${isNext ? 'home-cal-day--next' : ''}`}>
                    <span className="home-cal-num">Día {day}</span>
                    <span className="home-cal-amt"><Coins size={10} className="home-coins-ico" />{amt >= 1000 ? `${amt / 1000}k` : amt}</span>
                    {day === 7 && <span className="home-cal-star">+{DAY7_STAR_BONUS}<Star size={9} className="home-coins-ico" /></span>}
                  </div>
                );
              })}
            </div>
            <button className="btn btn-primary home-modal-btn" disabled={!claim.canClaim} onClick={handleClaim}>
              {claim.canClaim ? `Reclamar día ${claim.day}` : 'Reclamado hoy — vuelve mañana'}
            </button>
            <p className="home-modal-note">Entra todos los días: la racha sube el premio. Si faltas un día, vuelve al día 1.</p>
          </div>
        </div>
      )}

      {helpOpen && <TutorialModal onClose={() => setHelpOpen(false)} />}

      {needsRegister && <RegisterModal onDone={handleRegistered} />}

      <div className="screen-inner home-inner">
        {/* Logo */}
        <motion.div
          className="home-logo"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <img
            className="home-logo-img"
            src="/logo.webp"
            alt="LudoPata'S"
            draggable={false}
          />
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="home-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {t('tagline')}
        </motion.p>

        {/* Online error (e.g. host closed the room) */}
        {onlineError && (
          <motion.p
            className="home-online-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {t(onlineError as Parameters<typeof t>[0])}
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
              <span className="home-mode-icon"><m.Icon size={26} /></span>
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
              <Lightbulb size={13} className="home-tip-ico" /> {tips[tipIndex]}
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
        .home-rank svg, .home-coins svg { color: #ffd65a; }
        .home-rank { display: flex; align-items: center; justify-content: center; }
        .home-coins-ico { vertical-align: -2px; display: inline; }
        .home-title-ico { vertical-align: -3px; margin-right: 4px; }
        .home-tip-ico { vertical-align: -2px; margin-right: 2px; }
        .home-mode-icon svg { color: #fff; }
        .home-rank {
          position: absolute;
          top: calc(60px + env(safe-area-inset-top));
          right: 14px;
          width: 44px;
          height: 40px;
          border-radius: var(--radius-full);
          border: 2px solid rgba(255, 214, 90, 0.4);
          background: rgba(255, 214, 90, 0.12);
          font-size: 1.05rem;
          cursor: pointer;
          z-index: 5;
          backdrop-filter: blur(8px);
        }
        .home-daily { top: calc(106px + env(safe-area-inset-top)); }
        .home-daily--ready { animation: pulse-glow 1.4s ease-in-out infinite; border-color: rgba(255, 214, 90, 0.8); }
        .home-help { top: calc(152px + env(safe-area-inset-top)); }
        .home-inv { top: calc(198px + env(safe-area-inset-top)); }
        .home-arc { top: calc(244px + env(safe-area-inset-top)); }
        .home-coins {
          position: absolute;
          top: calc(60px + env(safe-area-inset-top));
          left: 14px;
          z-index: 5;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.8rem;
          color: #ffd65a;
          background: rgba(255, 214, 90, 0.12);
          border: 2px solid rgba(255, 214, 90, 0.4);
          border-radius: var(--radius-full);
          padding: 7px 12px;
          backdrop-filter: blur(8px);
        }
        .home-modal-backdrop {
          position: fixed; inset: 0; z-index: 90;
          background: rgba(12, 5, 40, 0.6);
          display: flex; align-items: center; justify-content: center; padding: 18px;
        }
        .home-modal {
          width: min(420px, 100%);
          max-height: 84vh;
          overflow-y: auto;
          background: linear-gradient(165deg, #3d2b8f, #241865);
          border: 2px solid rgba(255, 214, 90, 0.45);
          border-radius: 22px;
          padding: 18px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .home-modal-title { font-family: var(--font-display); font-size: 1.15rem; font-weight: 800; text-align: center; }
        .home-cal { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
        .home-cal-day {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 8px 4px; border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 2px solid rgba(255, 255, 255, 0.12);
        }
        .home-cal-day--done { opacity: 0.5; border-color: rgba(38, 193, 101, 0.6); }
        .home-cal-day--next { border-color: #ffd65a; background: rgba(255, 214, 90, 0.15); animation: pulse-glow 1.4s infinite; }
        .home-cal-num { font-size: 0.62rem; font-weight: 800; color: var(--color-text-muted); }
        .home-cal-amt { font-family: var(--font-display); font-size: 0.78rem; font-weight: 800; color: #ffd65a; }
        .home-cal-star { font-size: 0.6rem; font-weight: 800; color: #ffd65a; }
        .home-modal-btn { width: 100%; }
        .home-modal-note { font-size: 0.72rem; color: var(--color-text-muted); text-align: center; font-weight: 700; }
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
        .home-logo-img {
          width: clamp(170px, 46vw, 230px);
          aspect-ratio: 1;
          display: block;
          margin: 0 auto;
          border-radius: 26px;
          border: 3px solid rgba(255, 214, 90, 0.65);
          box-shadow:
            0 14px 30px rgba(18, 8, 60, 0.55),
            0 4px 10px rgba(18, 8, 60, 0.4),
            inset 0 0 0 1px rgba(255, 255, 255, 0.08);
          animation: float 3.4s ease-in-out infinite;
          user-select: none;
          -webkit-user-drag: none;
        }
        .home-tagline {
          margin-top: 8px;
          font-size: 0.95rem;
          color: var(--color-text-secondary);
          font-weight: 700;
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
