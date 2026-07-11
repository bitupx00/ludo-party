import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Player } from '../game/types.ts';
import { PLAYER_CONFIG, TEAMMATE } from '../game/types.ts';
import type { Reaction } from '../store/gameStore.ts';
import { useVideoStore } from '../store/videoStore.ts';
import { useT } from '../i18n.ts';
import { MiniDice } from './Dice3D.tsx';

/** Attach a stream to a media element and keep playback alive: autoplay
 *  with sound is often blocked until a user gesture (mobile especially),
 *  so retry play() on the next interaction instead of staying silent. */
function useStreamPlayback(ref: React.RefObject<HTMLMediaElement | null>, stream: MediaStream) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    const tryPlay = () => { void el.play().catch(() => { /* retried on gesture */ }); };
    tryPlay();
    document.addEventListener('pointerdown', tryPlay);
    return () => document.removeEventListener('pointerdown', tryPlay);
  }, [ref, stream]);
}

/** Camera feed rendered inside the avatar circle (replaces the emoji). */
function AvatarVideo({ stream, mirrored, muted }: { stream: MediaStream; mirrored: boolean; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useStreamPlayback(ref, stream);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="avatar-badge-video"
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    />
  );
}

/** Voice-only playback for remote streams without a visible video track —
 *  without this, a mic-only participant (camera denied/off-device) would
 *  never be heard at all. */
function AvatarAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useStreamPlayback(ref, stream);
  return <audio ref={ref} autoPlay style={{ display: 'none' }} />;
}

interface AvatarBadgeProps {
  player: Player;
  isCurrent: boolean;
  isThinking: boolean;
  finishedCount: number;
  reaction?: Reaction;
  align: 'left' | 'right';
  showTeamBadge?: boolean;
  /** Mini dice badge (Ludo Club style): shown only for the player whose
   *  turn it currently is, when that turn isn't the local device's own
   *  (the big HUD dice covers that case instead). */
  diceValue?: number | null;
  diceRolling?: boolean;
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
  diceValue,
  diceRolling,
}: AvatarBadgeProps) {
  const t = useT();
  const config = PLAYER_CONFIG[player.color];
  const [bubbleVisible, setBubbleVisible] = useState(false);

  // Camera feed for this player (video chat): shown inside the circle
  const stream = useVideoStore((s) => s.streams[player.color]);
  const isLocalCam = useVideoStore((s) => s.localColor === player.color);
  const cameraOn = useVideoStore((s) => s.cameraOn);
  const micOn = useVideoStore((s) => s.micOn);
  const isSpeaking = useVideoStore((s) => !!s.speaking[player.color]);
  const hasVideoTrack = !!stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideoTrack && (!isLocalCam || cameraOn);

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
          {showVideo && stream ? (
            <AvatarVideo stream={stream} mirrored={isLocalCam} muted={isLocalCam} />
          ) : (
            <span className="avatar-badge-emoji">{player.emoji}</span>
          )}
          {/* Remote audio still plays when there's no video to show */}
          {!showVideo && stream && !isLocalCam && stream.getAudioTracks().length > 0 && (
            <AvatarAudio stream={stream} />
          )}
          {isLocalCam && !micOn && <span className="avatar-badge-mic-off">🔇</span>}
          {isSpeaking && <span className="avatar-badge-speaking" />}
          {isCurrent && <span className="avatar-badge-ring" />}
        </motion.div>

        {/* Turn dice (Ludo Club style): only for the currently-rolling
            player, shown here instead of the big HUD dice when it isn't
            the local device's own turn. */}
        {diceValue !== undefined && (
          <div className="avatar-badge-dice">
            <MiniDice value={diceValue} rolling={!!diceRolling} />
          </div>
        )}

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
        .avatar-badge-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
          background: #14092e;
          opacity: 1;
        }
        .avatar-badge-speaking {
          position: absolute;
          inset: -5px;
          border-radius: 50%;
          border: 3px solid #4ade80;
          box-shadow: 0 0 12px rgba(74, 222, 128, 0.8);
          animation: pulse-glow 0.9s ease-in-out infinite;
          pointer-events: none;
        }
        .avatar-badge-mic-off {
          position: absolute;
          bottom: -4px;
          left: -4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(20, 9, 46, 0.9);
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6rem;
          z-index: 3;
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
        .avatar-badge-dice {
          position: absolute;
          top: -9px;
          left: 50%;
          translate: -50% 0;
          z-index: 5;
          pointer-events: none;
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
