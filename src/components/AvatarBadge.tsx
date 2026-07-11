import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Player } from '../game/types.ts';
import { PLAYER_CONFIG, TEAMMATE } from '../game/types.ts';
import type { Reaction } from '../store/gameStore.ts';
import { useT } from '../i18n.ts';

interface AvatarBadgeProps {
  player: Player;
  isCurrent: boolean;
  isThinking: boolean;
  finishedCount: number;
  reaction?: Reaction;
  align: 'left' | 'right';
  showTeamBadge?: boolean;
}

const REACTION_VISIBLE_MS = 2600;

export default function AvatarBadge({
  player,
  isCurrent,
  isThinking,
  finishedCount,
  reaction,
  align,
  showTeamBadge,
}: AvatarBadgeProps) {
  const t = useT();
  const config = PLAYER_CONFIG[player.color];
  const [bubbleVisible, setBubbleVisible] = useState(false);

  // Show the reaction bubble briefly whenever a new reaction arrives
  useEffect(() => {
    if (!reaction) return;
    setBubbleVisible(true);
    const timer = setTimeout(() => setBubbleVisible(false), REACTION_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [reaction?.key]);

  return (
    <div
      className={`avatar-badge avatar-badge--${align} ${isCurrent ? 'avatar-badge--current' : ''}`}
      style={{ '--badge-color': config.cssColor, '--badge-light': config.cssLight } as React.CSSProperties}
    >
      <div className="avatar-badge-circle-wrap">
        <motion.div
          className="avatar-badge-circle"
          animate={isCurrent ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={isCurrent ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <span className="avatar-badge-emoji">{player.emoji}</span>
          {isCurrent && <span className="avatar-badge-ring" />}
        </motion.div>

        {/* Reaction bubble */}
        <AnimatePresence>
          {bubbleVisible && reaction && (
            <motion.div
              key={reaction.key}
              className="avatar-reaction-bubble"
              initial={{ opacity: 0, scale: 0.3, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              {reaction.emoji}
            </motion.div>
          )}
        </AnimatePresence>

        {showTeamBadge && (
          <span className="avatar-team-dot" title={PLAYER_CONFIG[TEAMMATE[player.color]].label}
            style={{ background: PLAYER_CONFIG[TEAMMATE[player.color]].cssColor }} />
        )}
      </div>

      <div className="avatar-badge-info">
        <span className="avatar-badge-name">
          {player.name}
          {player.isBot && <span className="avatar-badge-bot">🤖</span>}
        </span>
        <span className="avatar-badge-sub">
          {isCurrent && isThinking
            ? t('thinking')
            : `🏁 ${finishedCount}/4`}
        </span>
      </div>

      <style>{`
        .avatar-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          padding: 4px 6px;
          border-radius: var(--radius-full);
          transition: background var(--transition-normal);
        }
        .avatar-badge--right {
          flex-direction: row-reverse;
          text-align: right;
        }
        .avatar-badge--current {
          background: rgba(255, 255, 255, 0.1);
        }
        .avatar-badge-circle-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .avatar-badge-circle {
          position: relative;
          width: clamp(42px, 11vmin, 54px);
          height: clamp(42px, 11vmin, 54px);
          border-radius: 50%;
          background: linear-gradient(160deg, var(--badge-light), var(--badge-color));
          border: 3px solid rgba(255, 255, 255, 0.85);
          box-shadow: 0 4px 10px rgba(18, 8, 60, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .avatar-badge--current .avatar-badge-circle {
          box-shadow:
            0 0 0 3px var(--badge-color),
            0 0 18px var(--badge-color),
            0 4px 10px rgba(18, 8, 60, 0.35);
        }
        .avatar-badge-emoji {
          font-size: clamp(20px, 5.5vmin, 27px);
          line-height: 1;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
        }
        .avatar-badge-ring {
          position: absolute;
          inset: -8px;
          border-radius: 50%;
          border: 2px solid var(--badge-light);
          animation: pulse-ring 1.4s ease-in-out infinite;
          pointer-events: none;
        }
        .avatar-reaction-bubble {
          position: absolute;
          top: -14px;
          right: -12px;
          min-width: 34px;
          height: 34px;
          padding: 0 6px;
          border-radius: 17px 17px 17px 4px;
          background: #fff;
          box-shadow: 0 4px 10px rgba(18, 8, 60, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          z-index: 30;
          pointer-events: none;
        }
        .avatar-badge--right .avatar-reaction-bubble {
          right: auto;
          left: -12px;
          border-radius: 17px 17px 4px 17px;
        }
        .avatar-team-dot {
          position: absolute;
          bottom: 0;
          right: -2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #fff;
        }
        .avatar-badge-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .avatar-badge-name {
          font-family: var(--font-display);
          font-size: 0.82rem;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 16vw;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .avatar-badge--right .avatar-badge-name {
          flex-direction: row-reverse;
        }
        .avatar-badge-bot {
          font-size: 0.65rem;
        }
        .avatar-badge-sub {
          font-size: 0.68rem;
          color: var(--color-text-muted);
          font-weight: 700;
        }
        @media (max-width: 380px) {
          .avatar-badge-name { max-width: 22vw; font-size: 0.75rem; }
        }
      `}</style>
    </div>
  );
}
