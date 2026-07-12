import { gifById } from '../game/gifs.ts';

/**
 * Animated GIF-style stickers. Two kinds, one component:
 * - REAL animated images (Noto Animated Emoji, bundled as downscaled
 *   animated WebP in public/gifs) — rendered as a plain <img>.
 * - Vector stickers drawn as pure SVG + CSS keyframes (zero assets).
 * Which one renders is decided by the sticker's registry entry
 * (game/gifs.ts): entries with `img` use the real file.
 */

interface GifStickerProps {
  id: string;
  /** Pixel size of the square sticker. */
  size?: number;
}

function Risa({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim gif-bounce">
      <circle cx="32" cy="32" r="26" fill="#ffd83d" stroke="#c99400" strokeWidth="2" />
      {/* squinted happy eyes */}
      <path d="M17 26 Q22 20 27 26" stroke="#5c4300" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M37 26 Q42 20 47 26" stroke="#5c4300" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {/* laughing mouth */}
      <path d="M18 36 Q32 54 46 36 Q32 42 18 36 Z" fill="#7a2d00" />
      <path d="M23 41 Q32 47 41 41 Q32 51 23 41 Z" fill="#ff7d99" />
      {/* flying tears */}
      <ellipse className="gif-tear-l" cx="10" cy="28" rx="4" ry="6" fill="#5ec8ff" />
      <ellipse className="gif-tear-r" cx="54" cy="28" rx="4" ry="6" fill="#5ec8ff" />
    </svg>
  );
}

function Llanto({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim gif-sway">
      <circle cx="32" cy="32" r="26" fill="#ffd83d" stroke="#c99400" strokeWidth="2" />
      <path d="M17 24 Q22 28 27 24" stroke="#5c4300" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M37 24 Q42 28 47 24" stroke="#5c4300" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      {/* wailing mouth */}
      <ellipse cx="32" cy="44" rx="9" ry="7" fill="#7a2d00" />
      {/* tear streams */}
      <rect className="gif-stream" x="19" y="27" width="5" height="22" rx="2.5" fill="#5ec8ff" />
      <rect className="gif-stream gif-stream--d" x="40" y="27" width="5" height="22" rx="2.5" fill="#5ec8ff" />
    </svg>
  );
}

function Furia({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim gif-shake">
      <circle cx="32" cy="32" r="26" fill="#f0405c" stroke="#8f1730" strokeWidth="2" />
      {/* angled brows */}
      <path d="M16 22 L28 28" stroke="#5c0010" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 22 L36 28" stroke="#5c0010" strokeWidth="4" strokeLinecap="round" />
      <circle cx="24" cy="33" r="3.4" fill="#5c0010" />
      <circle cx="40" cy="33" r="3.4" fill="#5c0010" />
      {/* gritted mouth */}
      <rect x="22" y="42" width="20" height="7" rx="3" fill="#5c0010" />
      <path d="M26 42 V49 M32 42 V49 M38 42 V49" stroke="#ffb9c4" strokeWidth="1.6" />
      {/* steam puffs */}
      <circle className="gif-steam" cx="10" cy="14" r="4.5" fill="#ffffff" opacity="0.85" />
      <circle className="gif-steam gif-steam--d" cx="54" cy="14" r="4.5" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

function Fuego({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim">
      <g className="gif-flicker">
        <path d="M32 6 C38 16 48 20 46 36 C45 48 38 56 32 56 C26 56 19 48 18 36 C17 26 24 20 26 12 C28 18 31 20 32 6 Z" fill="#ff7a1a" stroke="#b34400" strokeWidth="2" />
        <path className="gif-flicker-inner" d="M32 22 C36 28 40 30 39 40 C38 48 35 52 32 52 C29 52 26 48 25 40 C24.5 33 29 30 32 22 Z" fill="#ffd83d" />
      </g>
    </svg>
  );
}

function Calavera({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim gif-bob">
      <path d="M32 6 C17 6 10 17 10 29 C10 38 14 43 18 46 L18 54 A4 4 0 0 0 26 54 L26 50 L30 50 L30 54 A4 4 0 0 0 38 54 L38 50 L38 54 A4 4 0 0 0 46 54 L46 46 C50 43 54 38 54 29 C54 17 47 6 32 6 Z" fill="#f2f2f2" stroke="#5a5a68" strokeWidth="2" />
      <circle className="gif-eye" cx="23" cy="29" r="6" fill="#2b2b36" />
      <circle className="gif-eye gif-eye--d" cx="41" cy="29" r="6" fill="#2b2b36" />
      <path d="M32 36 L28 42 L36 42 Z" fill="#2b2b36" />
    </svg>
  );
}

function Aplauso({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim">
      {/* two hands smacking together */}
      <g className="gif-hand-l">
        <path d="M8 34 C8 26 14 20 22 22 L30 26 L26 44 L14 42 C10 41 8 38 8 34 Z" fill="#ffc85c" stroke="#b37b16" strokeWidth="2" />
      </g>
      <g className="gif-hand-r">
        <path d="M56 34 C56 26 50 20 42 22 L34 26 L38 44 L50 42 C54 41 56 38 56 34 Z" fill="#ffc85c" stroke="#b37b16" strokeWidth="2" />
      </g>
      {/* impact sparks */}
      <g className="gif-spark">
        <path d="M32 10 L32 18 M20 14 L24 20 M44 14 L40 20" stroke="#ffd83d" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Bomba({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim gif-pulse">
      <circle cx="30" cy="38" r="19" fill="#2b2b36" stroke="#101018" strokeWidth="2" />
      <ellipse cx="24" cy="31" rx="6" ry="4" fill="#5a5a68" transform="rotate(-25 24 31)" />
      <rect x="34" y="14" width="9" height="8" rx="2" fill="#5a5a68" transform="rotate(24 38 18)" />
      <path d="M42 15 C46 10 50 12 52 8" stroke="#8a6b3a" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* fuse spark */}
      <g className="gif-spark-spin">
        <path d="M52 8 L52 2 M52 8 L57 5 M52 8 L57 11 M52 8 L47 5" stroke="#ffd83d" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function Caca({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim gif-wiggle">
      <path d="M32 8 C38 12 34 16 40 18 C50 21 50 28 46 31 C54 33 54 42 48 45 C56 48 52 58 42 58 L22 58 C12 58 8 48 16 45 C10 42 10 33 18 31 C14 28 16 20 26 18 C30 16 27 11 32 8 Z" fill="#9b6a43" stroke="#6b4426" strokeWidth="2" />
      <circle cx="25" cy="41" r="4" fill="#fff" /><circle cx="25" cy="41" r="1.8" fill="#3a2413" />
      <circle cx="39" cy="41" r="4" fill="#fff" /><circle cx="39" cy="41" r="1.8" fill="#3a2413" />
      <path d="M26 50 Q32 54 38 50" stroke="#3a2413" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* orbiting fly */}
      <circle className="gif-fly" cx="52" cy="16" r="2.6" fill="#2b2b36" />
    </svg>
  );
}

function Corneta({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim gif-toot">
      <path d="M10 40 L14 30 L34 26 L34 44 L14 40 Z" fill="#f0405c" stroke="#8f1730" strokeWidth="2" />
      <path d="M34 22 L50 14 L50 56 L34 48 Z" fill="#ffd83d" stroke="#b38a00" strokeWidth="2" />
      <rect x="12" y="40" width="6" height="10" rx="2" fill="#8f1730" />
      {/* sound waves */}
      <g className="gif-wave">
        <path d="M54 26 Q58 35 54 44" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M58 20 Q64 35 58 50" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.6" />
      </g>
    </svg>
  );
}

function Corazon({ s }: { s: number }) {
  return (
    <svg viewBox="0 0 64 64" width={s} height={s} className="gif-anim">
      <path className="gif-beat" d="M32 54 C10 40 6 24 16 16 C24 10 31 16 32 21 C33 16 40 10 48 16 C58 24 54 40 32 54 Z" fill="#f0405c" stroke="#8f1730" strokeWidth="2" />
      <ellipse cx="24" cy="24" rx="4.5" ry="3" fill="#ff9fb0" transform="rotate(-28 24 24)" />
    </svg>
  );
}

const RENDERERS: Record<string, (p: { s: number }) => React.JSX.Element> = {
  risa: Risa,
  llanto: Llanto,
  furia: Furia,
  fuego: Fuego,
  calavera: Calavera,
  aplauso: Aplauso,
  bomba: Bomba,
  caca: Caca,
  corneta: Corneta,
  corazon: Corazon,
};

export default function GifSticker({ id, size = 40 }: GifStickerProps) {
  // Real animated image sticker (bundled webp)
  const def = gifById(id);
  if (def?.img) {
    return (
      <img
        src={def.img}
        width={size}
        height={size}
        alt={def.label}
        draggable={false}
        style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
      />
    );
  }

  const Renderer = RENDERERS[id];
  if (!Renderer) return null;
  return (
    <>
      <Renderer s={size} />
      <style>{`
        .gif-anim { display: block; overflow: visible; }
        .gif-bounce { animation: gifBounce 0.55s ease-in-out infinite; }
        @keyframes gifBounce { 0%,100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-8%) rotate(4deg); } }
        .gif-sway { animation: gifSway 1.4s ease-in-out infinite; }
        @keyframes gifSway { 0%,100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        .gif-shake { animation: gifShake 0.28s linear infinite; }
        @keyframes gifShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5%) rotate(-2deg); } 75% { transform: translateX(5%) rotate(2deg); } }
        .gif-bob { animation: gifBob 1.2s ease-in-out infinite; }
        @keyframes gifBob { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-6%) rotate(6deg); } }
        .gif-pulse { animation: gifPulse 0.7s ease-in-out infinite; }
        @keyframes gifPulse { 0%,100% { transform: scale(1); } 60% { transform: scale(1.1); } }
        .gif-wiggle { animation: gifWiggle 0.8s ease-in-out infinite; }
        @keyframes gifWiggle { 0%,100% { transform: rotate(-6deg) scale(1); } 50% { transform: rotate(6deg) scale(1.05); } }
        .gif-toot { animation: gifToot 0.5s ease-in-out infinite; }
        @keyframes gifToot { 0%,100% { transform: rotate(-3deg) scale(1); } 50% { transform: rotate(3deg) scale(1.08); } }

        .gif-tear-l { animation: gifTearL 0.55s ease-out infinite; transform-origin: 10px 28px; }
        .gif-tear-r { animation: gifTearR 0.55s ease-out infinite; transform-origin: 54px 28px; }
        @keyframes gifTearL { 0% { transform: translate(6px, -2px) scale(0.4); opacity: 0; } 40% { opacity: 1; } 100% { transform: translate(-6px, 10px) scale(1); opacity: 0; } }
        @keyframes gifTearR { 0% { transform: translate(-6px, -2px) scale(0.4); opacity: 0; } 40% { opacity: 1; } 100% { transform: translate(6px, 10px) scale(1); opacity: 0; } }
        .gif-stream { animation: gifStream 0.8s linear infinite; }
        .gif-stream--d { animation-delay: 0.4s; }
        @keyframes gifStream { 0% { transform: scaleY(0.3); opacity: 0.4; } 50% { transform: scaleY(1); opacity: 1; } 100% { transform: scaleY(0.5) translateY(20%); opacity: 0; } }
        .gif-steam { animation: gifSteam 0.9s ease-out infinite; }
        .gif-steam--d { animation-delay: 0.45s; }
        @keyframes gifSteam { 0% { transform: translateY(4px) scale(0.4); opacity: 0; } 50% { opacity: 0.9; } 100% { transform: translateY(-8px) scale(1.4); opacity: 0; } }
        .gif-flicker { animation: gifFlicker 0.35s ease-in-out infinite; transform-origin: 32px 52px; }
        @keyframes gifFlicker { 0%,100% { transform: scaleY(1) skewX(0deg); } 50% { transform: scaleY(1.08) skewX(-3deg); } }
        .gif-flicker-inner { animation: gifFlickIn 0.28s ease-in-out infinite; transform-origin: 32px 50px; }
        @keyframes gifFlickIn { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.88) translateY(2px); } }
        .gif-eye { animation: gifEye 1.6s ease-in-out infinite; transform-origin: center; }
        .gif-eye--d { animation-delay: 0.2s; }
        @keyframes gifEye { 0%,100% { transform: scale(1); } 10% { transform: scale(0.55); } 20% { transform: scale(1); } }
        .gif-hand-l { animation: gifHandL 0.4s ease-in-out infinite; transform-origin: 12px 36px; }
        .gif-hand-r { animation: gifHandR 0.4s ease-in-out infinite; transform-origin: 52px 36px; }
        @keyframes gifHandL { 0%,100% { transform: rotate(-16deg); } 50% { transform: rotate(4deg); } }
        @keyframes gifHandR { 0%,100% { transform: rotate(16deg); } 50% { transform: rotate(-4deg); } }
        .gif-spark { animation: gifSpark 0.4s ease-in-out infinite; transform-origin: 32px 20px; }
        @keyframes gifSpark { 0%,40%,100% { opacity: 0; transform: scale(0.5); } 55% { opacity: 1; transform: scale(1.15); } }
        .gif-spark-spin { animation: gifSparkSpin 0.5s linear infinite; transform-origin: 52px 8px; }
        @keyframes gifSparkSpin { from { transform: rotate(0deg) scale(1); } 50% { transform: rotate(180deg) scale(1.25); } to { transform: rotate(360deg) scale(1); } }
        .gif-fly { animation: gifFly 1.1s linear infinite; transform-origin: 46px 20px; }
        @keyframes gifFly { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .gif-wave { animation: gifWaveAnim 0.5s ease-out infinite; transform-origin: 50px 35px; }
        @keyframes gifWaveAnim { 0% { opacity: 0.2; transform: scale(0.7); } 60% { opacity: 1; } 100% { opacity: 0; transform: scale(1.25); } }
        .gif-beat { animation: gifBeat 0.7s ease-in-out infinite; transform-origin: 32px 34px; }
        @keyframes gifBeat { 0%,100% { transform: scale(1); } 25% { transform: scale(1.14); } 45% { transform: scale(1.02); } 60% { transform: scale(1.1); } }
        @media (prefers-reduced-motion: reduce) {
          .gif-anim, .gif-anim * { animation: none !important; }
        }
      `}</style>
    </>
  );
}
