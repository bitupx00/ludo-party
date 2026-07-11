import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CaptureEffect } from '../game/types.ts';

interface CaptureOverlayProps {
  effects: CaptureEffect[];
  onDismiss: () => void;
}

const EFFECT_CONFIGS = {
  'skull-rain': {
    emoji: '💀',
    count: 20,
    animation: 'skull-rain',
    duration: 2.5,
  },
  'fire-burst': {
    emoji: '🔥',
    count: 16,
    animation: 'fire-burst',
    duration: 2,
  },
  'lightning': {
    emoji: '⚡',
    count: 1,
    animation: 'lightning',
    duration: 2,
  },
  'star-burst': {
    emoji: '⭐',
    count: 16,
    animation: 'star-burst',
    duration: 2,
  },
};

function EffectParticles({ type }: { type: string }) {
  const config = EFFECT_CONFIGS[type as keyof typeof EFFECT_CONFIGS];

  if (!config) return null;

  if (type === 'lightning') {
    return (
      <div className="capture-lightning" />
    );
  }

  return (
    <>
      {Array.from({ length: config.count }).map((_, i) => {
        const delay = Math.random() * 0.5;
        const angle = (i / config.count) * Math.PI * 2;
        const distance = 150 + Math.random() * 200;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        return (
          <span
            key={i}
            className={`capture-particle capture-particle--${type}`}
            style={{
              '--tx': `${tx}px`,
              '--ty': `${ty}px`,
              animationDelay: `${delay}s`,
              left: '50%',
              top: '50%',
            } as React.CSSProperties}
          >
            {config.emoji}
          </span>
        );
      })}
    </>
  );
}

export default function CaptureOverlay({ effects, onDismiss }: CaptureOverlayProps) {
  const [visible, setVisible] = useState(false);

  // Find the first non-expired capture effect to display
  const latestEffect = effects.length > 0 ? effects[effects.length - 1] : null;

  useEffect(() => {
    if (latestEffect) {
      setVisible(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [latestEffect, onDismiss]);

  // Map effect type to a visual effect type for particles
  const effectTypeMap: Record<string, string> = {
    capture: 'fire-burst',
    safe: 'star-burst',
    home: 'star-burst',
    win: 'star-burst',
  };

  return (
    <AnimatePresence>
      {visible && latestEffect && (
        <motion.div
          className="capture-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {latestEffect.gifUrl.includes('lightning') && (
            <div className="capture-lightning" />
          )}

          <EffectParticles type={effectTypeMap[latestEffect.type] ?? 'fire-burst'} />

          <motion.div
            className="capture-text"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
          >
            <span className="capture-emojis">
              {latestEffect.type === 'capture' ? '💥💥💥' : latestEffect.type === 'win' ? '🏆🏆🏆' : '⭐⭐⭐'}
            </span>
            <span className="capture-sub">
              {latestEffect.type === 'capture' ? '💀💀💀' : latestEffect.type === 'win' ? '🎉🎉🎉' : '✨✨✨'}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
