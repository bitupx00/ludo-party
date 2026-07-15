import { useSoundStore } from '../sound';

/**
 * Meme sound system (myinstants.com clips, chosen by the project owner).
 *
 * The MP3 files live in public/sfx/<id>.mp3 — they are NOT committed by
 * the build environment (network policy blocks myinstants); run
 * `node scripts/download-sounds.mjs` once locally to fetch all of them.
 * Missing files fail silently, so the game works with any subset.
 *
 * Sounds are SYSTEM-ONLY: on notable game events (kills, deaths, goal,
 * passing an enemy, blocks…) the host rolls a 40% chance and broadcasts
 * one fitting sound + an occasion gif anchored to the piece involved
 * (memeFx in the snapshot — see src/game/memeFx.ts). Users cannot
 * trigger sounds directly.
 */

export interface MemeSound {
  id: string;
  /** Display name (shown in the picker and in bubbles). */
  name: string;
}

export const MEME_SOUNDS: MemeSound[] = [
  // Muertes (suena la pieza que muere)
  { id: 'bomberman', name: 'Bomberman death' },
  { id: 'oof5', name: 'Oof x5' },
  { id: 'bruh', name: 'Bruh' },
  { id: 'legoyoda', name: 'Lego Yoda' },
  { id: 'grito', name: 'Grito' },
  // Matar (suena el que mata)
  { id: 'faaah', name: '¡Faaah!' },
  { id: 'pew', name: 'Pew' },
  { id: 'lepego', name: '¡Le pegóoo!' },
  { id: 'vinuela', name: 'Risa Viñuela' },
  // Meta
  { id: 'rickastley', name: 'Directed by Rick Astley' },
  // Pasar enemigo sin matar
  { id: 'mariojump', name: 'Mario jump' },
  { id: 'heehee', name: 'MJ Hee-hee' },
  // El enemigo que sobrevive
  { id: 'nocreo', name: 'No creo' },
  { id: 'yelpico', name: '¿Y el pico?' },
  { id: 'fueradepre', name: 'Fuera depresión' },
  { id: 'basina', name: 'Suprema basina' },
  // Bloques / apilarse
  { id: 'hayalguien', name: '¿Hay alguien ahí?' },
  { id: 'gatitoboo', name: 'Gatito Boo' },
  // Escapadas largas
  { id: 'ysemarcho', name: 'Y se marchó' },
  { id: 'helicoptero', name: 'Helicóptero Homero' },
  { id: 'scouts', name: 'Scouts laugh' },
  // Eventos especiales
  { id: 'buenosdias', name: 'Buenos días estrellitas' },
  { id: 'recluta', name: '¿Qué es esto recluta?' },
  { id: 'patroclo', name: 'Patroclo' },
  { id: 'meamaba', name: 'Cuando alguien me amaba' },
  { id: 'shrekburro', name: 'Burro de Shrek' },
  { id: 'diablos', name: '¡Diablos señorita!' },
  { id: 'mision', name: 'Misión cumplida soldado' },
  // Panel del usuario
  { id: 'mcqueen', name: 'Rayo McQueen' },
  { id: 'winxp', name: 'Windows XP' },
  { id: 'batman', name: 'Conozca sus límites' },
  { id: 'ayuwoki', name: 'Ayuwoki' },
  { id: 'perraloca', name: 'Esa perra está loca' },
  { id: 'queasco', name: 'Qué asco que das' },
  { id: 'miau', name: 'Miau triste' },
  { id: 'cincomin', name: '5 minutos con la chica' },
  { id: 'guayaco', name: 'Chúpalo guayaco' },
  { id: 'tuproblema', name: 'Es tu problema' },
  { id: 'atrapada', name: '¡Atrapada, ayuda!' },
  { id: 'buenasbuenas', name: 'Buenas buenas' },
  { id: 'quienesese', name: '¿Quién es ese?' },
  { id: 'correperra', name: 'Corre perra' },
  { id: 'tlabaja', name: 'Tlabajaaa' },
  { id: 'ohnonono', name: 'Oh no no no' },
  { id: 'tiapaola', name: 'Tía Paola' },
  { id: 'excelente', name: 'Súper excelente' },
  { id: 'ajena', name: 'Ajena, eres ajena' },
];

/** Which sounds fit each game occasion (one is picked at random). */
export const EVENT_POOLS = {
  /** A piece was captured — "spoken" by the DYING piece. */
  death: ['bomberman', 'oof5', 'bruh', 'legoyoda'],
  /** "Spoken" by the killer piece. */
  kill: ['faaah', 'pew', 'lepego', 'vinuela'],
  /** A piece reached the center goal. */
  goal: ['rickastley'],
  /** Moved past an enemy piece without killing it (the mover). */
  passMover: ['mariojump', 'heehee'],
  /** The enemy piece that was passed and survived. */
  passSurvivor: ['nocreo', 'yelpico', 'fueradepre', 'basina'],
  /** Landed with enemies on the square that can't be killed (safe/block). */
  block: ['hayalguien'],
  /** Landed on a square with a piece of your own color. */
  ownStack: ['gatitoboo'],
  /** Landed exactly on an enemy's entry square — you showed up at their
   *  front door, so the fitting memes are a cheeky greeting or the owner
   *  asking who the intruder is. */
  enemyEntry: ['buenasbuenas', 'quienesese'],
  /** A 6-square sprint past enemies (big escape). */
  escape: ['ysemarcho', 'helicoptero', 'scouts'],
  /** Host starts the match (always plays, for everyone). */
  gameStart: ['buenosdias'],
  /** Teams: your ally passed an enemy and didn't kill it. */
  allyNoKill: ['recluta'],
  /** Teams: an allied piece died. */
  allyDeath: ['patroclo'],
  /** Teams: your ally killed an enemy piece. */
  allyKill: ['diablos'],
  /** An enemy piece ended up within 3 squares behind yours. */
  enemyNear: ['meamaba'],
  /** Entered the home lane. */
  homeLane: ['shrekburro'],
  /** A team won the match (always plays). */
  teamWin: ['mision'],
} as const;

export type MemeEventKind = keyof typeof EVENT_POOLS;

export const SND_PREFIX = 'snd:';

export function isSoundReaction(value: string): boolean {
  return value.startsWith(SND_PREFIX);
}

export function soundIdOf(value: string): string {
  return value.slice(SND_PREFIX.length);
}

export function memeSoundById(id: string): MemeSound | undefined {
  return MEME_SOUNDS.find((s) => s.id === id);
}

/* ─── Player ────────────────────────────────────────────────────────── */

const cache = new Map<string, HTMLAudioElement>();
let currentAudio: HTMLAudioElement | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

/** Hard cap per clip — nothing plays longer than this. */
const MAX_CLIP_MS = 5000;

/** LRU cap: decoded audio buffers are memory-heavy; over a long game the
 *  old unbounded cache could accumulate all 47 clips. Keep the most
 *  recently used dozen and release the rest. */
const AUDIO_CACHE_MAX = 12;

function cacheAudio(id: string, audio: HTMLAudioElement) {
  cache.delete(id); // re-insert = move to the "most recent" end
  cache.set(id, audio);
  while (cache.size > AUDIO_CACHE_MAX) {
    const [oldId, old] = cache.entries().next().value as [string, HTMLAudioElement];
    if (old === currentAudio) break; // never evict the playing clip
    cache.delete(oldId);
    try { old.pause(); old.src = ''; } catch { /* noop */ }
  }
}

/** Play a meme sound by id. Rules:
 *  - Only ONE clip at a time: a new sound (from any player) cuts off
 *    whatever was still playing.
 *  - Clips are capped at 5 seconds.
 *  - Missing files fail silently (the pack is optional). */
export function playMemeSound(id: string) {
  if (useSoundStore.getState().muted) return;
  if (!MEME_SOUNDS.some((s) => s.id === id)) return;
  try {
    // Cut off the previous clip — one sound at a time, latest wins
    if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
    if (currentAudio) {
      try { currentAudio.pause(); currentAudio.currentTime = 0; } catch { /* noop */ }
    }
    let audio = cache.get(id);
    if (!audio || !audio.src) {
      audio = new Audio(`/sfx/${id}.mp3`);
      audio.preload = 'auto';
    }
    cacheAudio(id, audio);
    currentAudio = audio;
    audio.currentTime = 0;
    audio.volume = 0.42; // 50% of the original level — the clips ran hot
    void audio.play().catch(() => { /* file missing or autoplay blocked */ });
    stopTimer = setTimeout(() => {
      if (currentAudio === audio) {
        try { audio.pause(); audio.currentTime = 0; } catch { /* noop */ }
        currentAudio = null;
      }
    }, MAX_CLIP_MS);
  } catch {
    /* audio unavailable */
  }
}

/** Pick a random sound id from an event pool. */
export function pickFromPool(kind: MemeEventKind): string {
  const pool = EVENT_POOLS[kind];
  return pool[Math.floor(Math.random() * pool.length)];
}
