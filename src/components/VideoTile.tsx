import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface VideoTileProps {
  stream?: MediaStream | null;
  emoji: string;
  name: string;
  color: string;
  isSpeaking?: boolean;
  size?: number;
  isLocal?: boolean;
  muted?: boolean;
}

export default function VideoTile({
  stream,
  emoji,
  name,
  color,
  isSpeaking = false,
  size = 64,
  isLocal = false,
  muted = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

  return (
    <motion.div
      className="video-tile-wrapper"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{ width: size, height: size }}
    >
      {/* Speaking pulse ring */}
      {isSpeaking && (
        <div
          className="video-tile-speaking-ring"
          style={{
            borderColor: color,
            boxShadow: `0 0 12px ${color}88`,
          }}
        />
      )}

      {/* Main tile */}
      <div
        className="video-tile"
        style={{
          width: size,
          height: size,
          borderColor: color,
        }}
      >
        {hasVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="video-tile-video"
            style={{ transform: isLocal ? 'scaleX(-1)' : undefined }}
          />
        ) : (
          <div
            className="video-tile-placeholder"
            style={{
              width: size,
              height: size,
              background: `linear-gradient(160deg, ${color}, #1a0f3a)`,
            }}
          >
            <span style={{ fontSize: size * 0.4 }}>{emoji}</span>
          </div>
        )}
      </div>

      {/* Emoji badge top-right */}
      <div
        className="video-tile-emoji-badge"
        style={{
          fontSize: size * 0.3,
          lineHeight: 1,
        }}
      >
        {emoji}
      </div>

      {/* Muted indicator */}
      {muted && (
        <div
          className="video-tile-muted"
          style={{
            fontSize: size * 0.25,
          }}
        >
          🔇
        </div>
      )}

      {/* Name label */}
      <div
        className="video-tile-name"
        style={{
          fontSize: Math.max(10, size * 0.2),
          maxWidth: size * 2,
        }}
      >
        {name}
      </div>

      <style>{videoTileStyles}</style>
    </motion.div>
  );
}

const videoTileStyles = `
.video-tile-wrapper {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.video-tile {
  border-radius: 50%;
  border: 2.5px solid;
  overflow: hidden;
  background: #14092e; /* solid — video must not look translucent */
  position: relative;
}

.video-tile-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}

.video-tile-placeholder {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-tile-speaking-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid;
  animation: speaking-pulse 1.2s ease-in-out infinite;
  pointer-events: none;
}

.video-tile-emoji-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  z-index: 2;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
  pointer-events: none;
}

.video-tile-muted {
  position: absolute;
  bottom: -2px;
  right: -2px;
  z-index: 2;
  background: rgba(0,0,0,0.6);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.video-tile-name {
  position: absolute;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  color: var(--color-text-secondary);
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7);
  pointer-events: none;
}

@keyframes speaking-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.5;
  }
}
`;
