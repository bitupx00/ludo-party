import type { Color } from './types';
import { EVENT_POOLS, type MemeEventKind } from './memeSounds';
import { tenorPoolFor, fillPool } from './tenor';
import memeGifManifest from './memeGifs.json';

/**
 * SYSTEM occasion effects: when something notable happens on the board
 * (kill, death, goal, block, escape…), the HOST rolls a 40% chance and —
 * if it hits — broadcasts ONE meme effect (sound + animated gif) anchored
 * to the piece involved. Users can NOT trigger sounds themselves anymore;
 * every sound comes from the system.
 *
 * The gif shown per occasion comes from `memeGifs.json` when the user has
 * downloaded real community meme GIFs (see scripts/download-gifs.mjs);
 * until then each occasion falls back to a bundled animated sticker.
 */

/** Chance that a detected occasion actually fires its effect. */
export const MEME_FIRE_CHANCE = 0.4;

/** Effect broadcast in the game snapshot: what to play + where. */
export interface MemeFx {
  /** Monotonic key — clients react to changes of this value. */
  key: number;
  /** Meme sound id (public/sfx/<id>.mp3). */
  sound: string;
  /** Gif to show: a sticker id (GifSticker) or a bundled file path
   *  starting with '/' (real meme gif from public/gifs/memes). */
  gif: string;
  /** Board anchor: logical position + color → each client computes the
   *  screen spot with its OWN board rotation. */
  position: number;
  color: Color;
  /** Local ms to wait before playing (the mover's travel duration). */
  delay: number;
}

/** Fallback: bundled animated stickers per occasion (used until the user
 *  installs real meme GIFs via scripts/download-gifs.mjs). */
const FALLBACK_GIFS: Record<MemeEventKind, string[]> = {
  death: ['craneo', 'llora', 'calavera'],
  kill: ['diablito', 'fueguito', 'bomba'],
  goal: ['fiesta', 'confeti', 'aplausos'],
  passMover: ['jaja', 'risa', 'rofl'],
  passSurvivor: ['grito', 'llora'],
  block: ['rabia', 'furia'],
  ownStack: ['amor', 'aplausos'],
  enemyEntry: ['diablito', 'grito'],
  escape: ['fueguito', 'rofl', 'jaja'],
  gameStart: ['fiesta', 'confeti'],
  allyNoKill: ['jaja'],
  allyDeath: ['llora'],
  allyKill: ['aplausos'],
  enemyNear: ['grito'],
  homeLane: ['fueguito', 'aplausos'],
  teamWin: ['confeti', 'fiesta'],
};

const manifest = memeGifManifest as Partial<Record<MemeEventKind, string[]>>;

/** Gif candidates for an occasion, best source first:
 *  1. Tenor pool (real community memes, fetched live by the host)
 *  2. downloaded meme files (scripts/download-gifs.mjs manifest)
 *  3. bundled animated stickers (always available). */
export function gifsForOccasion(kind: MemeEventKind): string[] {
  const tenor = tenorPoolFor(kind);
  if (tenor.length > 0) {
    fillPool(kind); // keep it warm for the next occasion
    return tenor.map((g) => g.url);
  }
  fillPool(kind); // kick off the fetch for next time
  const real = manifest[kind];
  if (real && real.length > 0) return real;
  return FALLBACK_GIFS[kind];
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Host-side: build the MemeFx for a detected occasion (already past the
 *  40% gate — this only picks the sound + gif). */
export function buildMemeFx(
  kind: MemeEventKind,
  prevKey: number,
  anchor: { position: number; color: Color },
  delay: number,
): MemeFx {
  return {
    key: prevKey + 1,
    sound: pick(EVENT_POOLS[kind]),
    gif: pick(gifsForOccasion(kind)),
    position: anchor.position,
    color: anchor.color,
    delay,
  };
}
