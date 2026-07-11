import { create } from 'zustand';

/**
 * Sound system: all SFX are synthesized with WebAudio (zero asset downloads,
 * tiny CPU cost, instant load). Includes mute persistence and Android vibration.
 */

const MUTE_KEY = 'ludo-party-muted';

interface SoundStore {
  muted: boolean;
  toggleMuted: () => void;
}

export const useSoundStore = create<SoundStore>((set, get) => ({
  muted: (() => {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; }
  })(),
  toggleMuted: () => {
    const muted = !get().muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* noop */ }
    set({ muted });
  },
}));

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Play a tone: freq (optionally gliding to freq2), duration, wave type. */
function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; gain?: number; when?: number; glideTo?: number } = {},
) {
  const c = audioCtx();
  if (!c) return;
  const { type = 'sine', gain = 0.12, when = 0, glideTo } = opts;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Short filtered-noise burst (dice rattle / capture impact). */
function noise(dur: number, opts: { gain?: number; when?: number; freq?: number } = {}) {
  const c = audioCtx();
  if (!c) return;
  const { gain = 0.1, when = 0, freq = 1800 } = opts;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

export type SfxName =
  | 'dice' | 'move' | 'land' | 'capture' | 'home' | 'win' | 'lose'
  | 'click' | 'chat' | 'pop' | 'join' | 'leave' | 'six'
  // Funny gif-sticker sounds
  | 'laugh' | 'sadTrombone' | 'angryBuzz' | 'whoosh' | 'spooky'
  | 'clap' | 'boom' | 'fart' | 'airhorn' | 'kiss';

const SFX: Record<SfxName, () => void> = {
  dice: () => {
    for (let i = 0; i < 5; i++) noise(0.05, { when: i * 0.075, gain: 0.14, freq: 1200 + Math.random() * 1600 });
    tone(220, 0.08, { type: 'triangle', when: 0.42, gain: 0.1 });
  },
  move: () => tone(340, 0.055, { type: 'triangle', gain: 0.09 }),
  land: () => { tone(420, 0.09, { type: 'triangle', gain: 0.12 }); tone(640, 0.12, { type: 'sine', when: 0.05, gain: 0.1 }); },
  capture: () => {
    tone(620, 0.28, { type: 'sawtooth', gain: 0.12, glideTo: 110 });
    noise(0.18, { gain: 0.16, freq: 500 });
    tone(90, 0.22, { type: 'square', when: 0.05, gain: 0.1 });
  },
  home: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', when: i * 0.09, gain: 0.12 })); },
  six: () => { tone(660, 0.1, { type: 'triangle', gain: 0.12 }); tone(880, 0.16, { type: 'triangle', when: 0.09, gain: 0.12 }); },
  win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', when: i * 0.13, gain: 0.14 })); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'sine', when: i * 0.18, gain: 0.11 })); },
  click: () => tone(700, 0.04, { type: 'triangle', gain: 0.07 }),
  chat: () => { tone(880, 0.07, { type: 'sine', gain: 0.09 }); tone(1175, 0.09, { type: 'sine', when: 0.06, gain: 0.08 }); },
  pop: () => tone(520, 0.06, { type: 'sine', gain: 0.08, glideTo: 780 }),
  join: () => { tone(440, 0.1, { type: 'triangle', gain: 0.1 }); tone(660, 0.14, { type: 'triangle', when: 0.09, gain: 0.1 }); },
  leave: () => { tone(660, 0.1, { type: 'triangle', gain: 0.1 }); tone(440, 0.16, { type: 'triangle', when: 0.09, gain: 0.09 }); },

  // ── Funny gif-sticker sounds ──────────────────────────────────────
  // Cartoon "ha-ha-ha": descending staccato squeaks
  laugh: () => {
    [720, 640, 700, 600, 660, 560].forEach((f, i) =>
      tone(f, 0.09, { type: 'square', when: i * 0.11, gain: 0.07, glideTo: f * 0.82 }));
  },
  // Classic wah-wah-wah sad trombone
  sadTrombone: () => {
    [311, 294, 277, 262].forEach((f, i) =>
      tone(f, i === 3 ? 0.55 : 0.24, { type: 'sawtooth', when: i * 0.28, gain: 0.09, glideTo: f * 0.94 }));
  },
  // Angry electric buzz + growl
  angryBuzz: () => {
    tone(95, 0.4, { type: 'sawtooth', gain: 0.12, glideTo: 70 });
    tone(97, 0.4, { type: 'square', gain: 0.07, glideTo: 72 });
    noise(0.25, { gain: 0.08, freq: 300 });
  },
  // Fire whoosh sweep
  whoosh: () => {
    noise(0.35, { gain: 0.14, freq: 900 });
    noise(0.3, { gain: 0.1, when: 0.12, freq: 2400 });
    tone(180, 0.35, { type: 'sine', gain: 0.07, glideTo: 480 });
  },
  // Spooky theremin wail
  spooky: () => {
    tone(520, 0.5, { type: 'sine', gain: 0.09, glideTo: 340 });
    tone(660, 0.5, { type: 'sine', when: 0.4, gain: 0.08, glideTo: 880 });
    tone(260, 0.7, { type: 'triangle', when: 0.15, gain: 0.05, glideTo: 180 });
  },
  // Crowd-ish clapping: rapid noise bursts
  clap: () => {
    for (let i = 0; i < 8; i++) {
      noise(0.045, { when: i * 0.09 + Math.random() * 0.02, gain: 0.13, freq: 1500 + Math.random() * 900 });
    }
  },
  // Cartoon explosion: deep thump + noise bloom
  boom: () => {
    tone(70, 0.5, { type: 'sine', gain: 0.2, glideTo: 36 });
    noise(0.45, { gain: 0.18, freq: 220 });
    noise(0.3, { when: 0.05, gain: 0.1, freq: 900 });
  },
  // The timeless classic: descending flappy squelch
  fart: () => {
    [140, 120, 100, 85, 72].forEach((f, i) =>
      tone(f, 0.09, { type: 'sawtooth', when: i * 0.07, gain: 0.13, glideTo: f * 0.72 }));
    noise(0.32, { gain: 0.06, freq: 160 });
  },
  // Stadium airhorn: three blasts, held last
  airhorn: () => {
    [0, 0.22, 0.44].forEach((when, i) => {
      const dur = i === 2 ? 0.55 : 0.16;
      tone(466, dur, { type: 'sawtooth', when, gain: 0.11 });
      tone(933, dur, { type: 'square', when, gain: 0.05 });
      tone(470, dur, { type: 'sawtooth', when, gain: 0.08 });
    });
  },
  // Kiss pop + sparkle
  kiss: () => {
    tone(900, 0.06, { type: 'sine', gain: 0.12, glideTo: 380 });
    tone(1320, 0.14, { type: 'triangle', when: 0.08, gain: 0.08 });
    tone(1760, 0.18, { type: 'sine', when: 0.14, gain: 0.06 });
  },
};

export function playSfx(name: SfxName) {
  if (useSoundStore.getState().muted) return;
  try { SFX[name](); } catch { /* audio unavailable */ }
}

/** Haptic feedback on Android (no-op elsewhere, respects mute). */
export function vibrate(pattern: number | number[]) {
  if (useSoundStore.getState().muted) return;
  try { navigator.vibrate?.(pattern); } catch { /* noop */ }
}
