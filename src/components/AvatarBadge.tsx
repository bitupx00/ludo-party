import { styleOnce } from '../styleOnce.ts';
import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Player } from '../game/types.ts';
import { PLAYER_CONFIG, TEAM_INFO, teamOf } from '../game/types.ts';
import { useGameStore, type Reaction } from '../store/gameStore.ts';
import { useVideoStore } from '../store/videoStore.ts';
import { useT } from '../i18n.ts';
import { MiniDice } from './Dice3D.tsx';
import { isGifReaction, gifIdOf, gifById, isTenorReaction, tenorUrlOf } from '../game/gifs.ts';
import { isSoundReaction, soundIdOf, memeSoundById, playMemeSound } from '../game/memeSounds.ts';
import { playSfx } from '../sound.ts';
import GifSticker from './GifSticker.tsx';

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
  /** Gift button: open the throw-meme picker targeting this player. */
  onGift?: (playerId: string) => void;
  /** Last meme thrown at this player (gif payload) — stuck on the avatar. */
  pinnedMeme?: string | null;
  /** Non-null while it's THIS player's turn: restarts the 20s draining
   *  bar above the avatar (bar runs in the player's color). */
  timerKey?: string | null;
}

const REACTION_VISIBLE_MS = 2600;

/** A sound reaction ALWAYS shows a meme gif with it — picked
 *  deterministically from the sound id so every device shows the same. */
const SOUND_GIF_POOL = ['jaja', 'grito', 'craneo', 'rabia', 'aplausos', 'llora', 'payaso', 'rofl'];
function gifForSound(soundId: string): string {
  let h = 0;
  for (let i = 0; i < soundId.length; i++) h = (h * 31 + soundId.charCodeAt(i)) >>> 0;
  return SOUND_GIF_POOL[h % SOUND_GIF_POOL.length];
}

function AvatarBadge({
  player,
  isCurrent,
  isThinking,
  finishedCount,
  reaction,
  align,
  showTeamBadge,
  diceValue,
  diceRolling,
  onGift,
  pinnedMeme,
  timerKey,
}: AvatarBadgeProps) {
  const t = useT();
  const config = PLAYER_CONFIG[player.color];
  const [bubbleVisible, setBubbleVisible] = useState(false);

  // Per-player silencing (local to this device): voice + reaction sounds
  const isMuted = useVideoStore((s) => !!s.mutedPlayers[player.id]);
  const toggleMutePlayer = useVideoStore((s) => s.toggleMutePlayer);
  const onlineRole = useGameStore((s) => s.onlineRole);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const canMute = onlineRole !== 'none' && player.id !== localPlayerId && !player.isBot;

  // Camera feed for this player (video chat): shown inside the circle
  const stream = useVideoStore((s) => s.streams[player.color]);
  const isLocalCam = useVideoStore((s) => s.localColor === player.color);
  const cameraOn = useVideoStore((s) => s.cameraOn);
  const micOn = useVideoStore((s) => s.micOn);
  const isSpeaking = useVideoStore((s) => !!s.speaking[player.color]);
  const hasVideoTrack = !!stream && stream.getVideoTracks().length > 0;
  const showVideo = hasVideoTrack && (!isLocalCam || cameraOn);

  // Show the reaction bubble briefly whenever a new reaction arrives —
  // panel sounds (limited to 1 per player per turn, validated host-side)
  // play on every client; gif stickers play their small sfx.
  useEffect(() => {
    if (!reaction) return;
    setBubbleVisible(true);
    // A silenced player's sounds never play on THIS device (bubble still shows)
    if (!isMuted) {
      if (isSoundReaction(reaction.emoji)) {
        playMemeSound(soundIdOf(reaction.emoji));
      } else if (isGifReaction(reaction.emoji)) {
        const gif = gifById(gifIdOf(reaction.emoji));
        if (gif) playSfx(gif.sfx);
      }
    }
    const timer = setTimeout(() => setBubbleVisible(false), REACTION_VISIBLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reaction?.key]);

  return (
    <div
      className={`avatar-badge avatar-badge--${align} ${isCurrent ? 'avatar-badge--current' : ''}`}
      data-badge-for={player.id}
      style={{ '--badge-color': config.cssColor, '--badge-light': config.cssLight } as React.CSSProperties}
    >
      <div className="avatar-badge-circle-wrap">
        {/* Turn countdown: thin bar draining over 20s in the player's color */}
        {timerKey != null && (
          <span key={timerKey} className="avatar-turn-timer">
            <span className="avatar-turn-timer-fill" />
          </span>
        )}
        {/* Turn "breathing" runs as a CSS animation (compositor thread) —
            the old framer-motion infinite keyframe loop kept a JS
            requestAnimationFrame ticking for the whole game. */}
        <div className={`avatar-badge-circle ${isCurrent ? 'avatar-badge-circle--pulse' : ''}`}>
          {showVideo && stream ? (
            <AvatarVideo stream={stream} mirrored={isLocalCam} muted={isLocalCam || isMuted} />
          ) : (
            <span className="avatar-badge-emoji">{player.emoji}</span>
          )}
          {/* Remote audio still plays when there's no video to show —
              unless this device silenced the player */}
          {!showVideo && stream && !isLocalCam && !isMuted && stream.getAudioTracks().length > 0 && (
            <AvatarAudio stream={stream} />
          )}
          {isLocalCam && !micOn && <span className="avatar-badge-mic-off">🔇</span>}
          {isSpeaking && <span className="avatar-badge-speaking" />}
          {isCurrent && <span className="avatar-badge-ring" />}
        </div>

        {/* Turn dice (Ludo Club style): only for the currently-rolling
            player, shown here instead of the big HUD dice when it isn't
            the local device's own turn. */}
        {diceValue !== undefined && (
          <div className="avatar-badge-dice">
            <MiniDice value={diceValue} rolling={!!diceRolling} skin={player.diceSkin} />
          </div>
        )}

        {/* Reaction bubble */}
        <AnimatePresence>
          {bubbleVisible && reaction && (
            <motion.div
              key={reaction.key}
              className={`avatar-reaction-bubble ${isGifReaction(reaction.emoji) || isTenorReaction(reaction.emoji) ? 'avatar-reaction-bubble--gif' : ''}`}
              initial={{ opacity: 0, scale: 0.3, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            >
              {isGifReaction(reaction.emoji)
                ? <GifSticker id={gifIdOf(reaction.emoji)} size={58} />
                : isTenorReaction(reaction.emoji)
                  ? <img className="avatar-tgif" src={tenorUrlOf(reaction.emoji)} alt="GIF" draggable={false} />
                  : isSoundReaction(reaction.emoji)
                    ? (
                      <span className="avatar-snd-wrap">
                        <GifSticker id={gifForSound(soundIdOf(reaction.emoji))} size={30} />
                        <span className="avatar-snd">{memeSoundById(soundIdOf(reaction.emoji))?.name ?? ''}</span>
                      </span>
                    )
                    : reaction.emoji}
            </motion.div>
          )}
        </AnimatePresence>

        {showTeamBadge && (
          <span className="avatar-team-badge" title={t(TEAM_INFO[teamOf(player.color)].nameKey)}>
            {TEAM_INFO[teamOf(player.color)].emoji}
          </span>
        )}

        {/* Meme stuck on the avatar: the last one thrown at this player */}
        {pinnedMeme && (
          <span className="avatar-pinned-meme">
            <GifSticker id={pinnedMeme.startsWith('gif:') ? pinnedMeme.slice(4) : pinnedMeme} size={30} />
          </span>
        )}

        {/* Gift: throw a meme at this player (Ludo Club style) */}
        {onGift && (
          <button
            className="avatar-gift-btn"
            onClick={(e) => { e.stopPropagation(); onGift(player.id); }}
            aria-label={t('throwMeme')}
            title={t('throwMeme')}
          >
            🎁
          </button>
        )}

        {/* Silence THIS player (local): mutes their voice + their sounds */}
        {canMute && (
          <button
            className={`avatar-mute-btn ${isMuted ? 'avatar-mute-btn--on' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleMutePlayer(player.id); }}
            aria-label={isMuted ? t('unmutePlayer') : t('mutePlayer')}
            title={isMuted ? t('unmutePlayer') : t('mutePlayer')}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
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

    </div>
  );
}

// Memoized: the game screen re-renders on every store change (chat,
// timers, effects) — a badge only needs to re-render when ITS props
// actually changed (shallow compare covers it: primitives + identities).
export default memo(AvatarBadge);

// Static component CSS — injected once per module (see styleOnce.ts)
styleOnce('avatar-badge', `
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
        .avatar-turn-timer {
          position: absolute;
          top: -10px;
          left: 50%;
          translate: -50% 0;
          width: 120%;
          height: 4px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.18);
          overflow: hidden;
          z-index: 6;
          pointer-events: none;
        }
        .avatar-turn-timer-fill {
          display: block;
          height: 100%;
          border-radius: 3px;
          background: var(--badge-color);
          transform-origin: left center;
          animation: turn-drain 20s linear forwards;
        }
        @keyframes turn-drain {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        .avatar-badge-circle--pulse {
          animation: badge-breathe 1.2s ease-in-out infinite;
        }
        @keyframes badge-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
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
        .avatar-pinned-meme {
          position: absolute;
          top: -10px;
          right: -10px;
          z-index: 6;
          rotate: 12deg;
          filter: drop-shadow(0 2px 4px rgba(18, 8, 60, 0.5));
          animation: pinned-splat 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
        }
        @keyframes pinned-splat {
          0% { scale: 2.2; opacity: 0; rotate: -30deg; }
          100% { scale: 1; opacity: 1; rotate: 12deg; }
        }
        .avatar-gift-btn {
          position: absolute;
          bottom: -6px;
          left: -8px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 214, 90, 0.6);
          background: rgba(20, 9, 46, 0.85);
          font-size: 0.62rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          padding: 0;
          touch-action: manipulation;
        }
        .avatar-snd-wrap {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 0 4px;
        }
        .avatar-tgif {
          width: 64px;
          height: 64px;
          object-fit: cover;
          border-radius: 12px;
          display: block;
        }
        .avatar-snd {
          font-size: 0.68rem;
          font-weight: 800;
          font-family: var(--font-display);
          color: #241865;
          white-space: nowrap;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 4px;
        }
        .avatar-reaction-bubble--gif {
          min-width: 70px;
          height: 70px;
          top: -38px;
        }
        .avatar-badge-dice {
          position: absolute;
          top: -9px;
          left: 50%;
          translate: -50% 0;
          z-index: 5;
          pointer-events: none;
        }
        .avatar-team-badge {
          position: absolute;
          bottom: -4px;
          right: -6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(20, 9, 46, 0.92);
          border: 1.5px solid rgba(255, 255, 255, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          line-height: 1;
          z-index: 4;
          pointer-events: none;
        }
        .avatar-mute-btn {
          position: absolute;
          top: -6px;
          left: -8px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.4);
          background: rgba(20, 9, 46, 0.85);
          font-size: 0.6rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          padding: 0;
          touch-action: manipulation;
        }
        .avatar-mute-btn--on {
          background: rgba(240, 64, 92, 0.85);
          border-color: rgba(255, 255, 255, 0.7);
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
      
`);
