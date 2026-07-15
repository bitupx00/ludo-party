import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CaptureEffect } from '../game/types.ts';
import { playSfx, vibrate } from '../sound.ts';
// CRITICAL: without this import the overlay renders UNSTYLED — a plain
// in-flow div whose ±350px particle bursts blow the page open sideways,
// visibly shoving the whole board every time a piece reaches the goal
// or captures.
import './CaptureOverlay.css';

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
  // The effect currently REVEALED (after its delay) — the raw store effect
  // is created the instant the move resolves, but the toast/sfx must wait
  // for the mover's travel animation so nothing announces the outcome
  // before the piece visibly lands on the square.
  const [shown, setShown] = useState<CaptureEffect | null>(null);
  const revealedIds = useRef<Set<string>>(new Set());

  // Only consider recent effects (stale ones can reappear via online snapshots)
  const fresh = effects.filter((e) => Date.now() - e.timestamp < 6000);
  const latestEffect = fresh.length > 0 ? fresh[fresh.length - 1] : null;

  useEffect(() => {
    if (!latestEffect || revealedIds.current.has(latestEffect.id)) return;
    // Bounded: only recent ids matter (stale effects are filtered above)
    if (revealedIds.current.size > 200) revealedIds.current.clear();
    revealedIds.current.add(latestEffect.id);
    // Delay counts from when the effect reaches THIS client (host: move
    // time; guest: snapshot receipt — matching their own piece animation).
    const wait = Math.max(0, latestEffect.delay ?? 0);
    const reveal = setTimeout(() => {
      setShown(latestEffect);
      // Reveal sound plays on EVERY device (host and guests alike)
      if (latestEffect.type === 'capture') {
        playSfx('capture');
        vibrate([40, 30, 70]);
      } else if (latestEffect.type === 'win') {
        playSfx('win');
      } else {
        playSfx('home');
      }
    }, wait);
    return () => clearTimeout(reveal);
  }, [latestEffect]);

  useEffect(() => {
    if (shown) {
      setVisible(true);
      const timeout = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [shown, onDismiss]);

  // Map effect type to a visual effect type for particles
  const effectTypeMap: Record<string, string> = {
    capture: 'fire-burst',
    safe: 'star-burst',
    home: 'star-burst',
    win: 'star-burst',
  };

  return (
    <AnimatePresence>
      {visible && shown && (
        <motion.div
          className="capture-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {shown.gifUrl.includes('lightning') && (
            <div className="capture-lightning" />
          )}

          <EffectParticles type={effectTypeMap[shown.type] ?? 'fire-burst'} />

          {/* Meme-notification toast: says WHO did WHAT to WHOM */}
          <motion.div
            className="capture-toast"
            initial={{ scale: 0, rotate: -6, y: -14 }}
            animate={{ scale: 1, rotate: 0, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
          >
            {shown.label
              ?? (shown.type === 'capture' ? '💥 ¡CAPTURA!' : shown.type === 'win' ? '🏆 ¡VICTORIA!' : '⭐ ¡BIEN!')}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
