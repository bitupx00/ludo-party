import type { SfxName } from '../sound';

/**
 * Animated GIF-style stickers (replace the old static emoji reactions).
 * Each entry pairs an animated vector sticker (see GifSticker.tsx) with a
 * funny synthesized sound. Rendered as looping CSS/SVG animations — they
 * behave like GIFs but weigh nothing and never need a network fetch.
 *
 * A reaction payload for a gif is the string `gif:<id>` — legacy plain
 * emoji strings still render for backwards compatibility mid-rollout.
 */

export interface GifDef {
  id: string;
  /** Short caption shown under the sticker in the picker. */
  label: string;
  /** Funny sound played (on EVERY client) when the sticker lands. */
  sfx: SfxName;
}

export const GIFS: GifDef[] = [
  { id: 'risa', label: 'JAJAJA', sfx: 'laugh' },
  { id: 'llanto', label: 'BUAAA', sfx: 'sadTrombone' },
  { id: 'furia', label: 'GRRR', sfx: 'angryBuzz' },
  { id: 'fuego', label: 'FUEGO', sfx: 'whoosh' },
  { id: 'calavera', label: 'R.I.P.', sfx: 'spooky' },
  { id: 'aplauso', label: 'BRAVO', sfx: 'clap' },
  { id: 'bomba', label: 'BOOM', sfx: 'boom' },
  { id: 'caca', label: 'CACA', sfx: 'fart' },
  { id: 'corneta', label: 'PIIII', sfx: 'airhorn' },
  { id: 'corazon', label: 'LOVE', sfx: 'kiss' },
];

export const GIF_PREFIX = 'gif:';

/** The 6 quick-access gifs shown in the HUD row. */
export const QUICK_GIFS = ['risa', 'llanto', 'furia', 'fuego', 'calavera', 'aplauso'];

export function isGifReaction(value: string): boolean {
  return value.startsWith(GIF_PREFIX);
}

export function gifIdOf(value: string): string {
  return value.slice(GIF_PREFIX.length);
}

export function gifById(id: string): GifDef | undefined {
  return GIFS.find((g) => g.id === id);
}
