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
  /** Real animated image file (bundled in public/gifs). Entries without
   *  one render the built-in vector animation from GifSticker.tsx. */
  img?: string;
}

/** REAL animated GIFs (Google Noto Animated Emoji, CC BY 4.0 — bundled
 *  locally as downscaled animated WebP so they load instantly offline). */
const REAL_GIFS: GifDef[] = [
  { id: 'jaja', label: 'JAJAJA', sfx: 'laugh', img: '/gifs/jaja.webp' },
  { id: 'rofl', label: 'LOL', sfx: 'laugh', img: '/gifs/rofl.webp' },
  { id: 'llora', label: 'BUAAA', sfx: 'sadTrombone', img: '/gifs/llora.webp' },
  { id: 'rabia', label: '#$%!', sfx: 'angryBuzz', img: '/gifs/rabia.webp' },
  { id: 'grito', label: 'AAAH', sfx: 'scream', img: '/gifs/grito.webp' },
  { id: 'craneo', label: 'MUERTO', sfx: 'spooky', img: '/gifs/craneo.webp' },
  { id: 'aplausos', label: 'BRAVO', sfx: 'clap', img: '/gifs/aplausos.webp' },
  { id: 'fueguito', label: 'ON FIRE', sfx: 'whoosh', img: '/gifs/fueguito.webp' },
  { id: 'popo', label: 'POPÓ', sfx: 'fart', img: '/gifs/popo.webp' },
  { id: 'fiesta', label: 'FIESTA', sfx: 'party', img: '/gifs/fiesta.webp' },
  { id: 'confeti', label: 'YEEE', sfx: 'party', img: '/gifs/confeti.webp' },
  { id: 'payaso', label: 'PAYASO', sfx: 'clown', img: '/gifs/payaso.webp' },
  { id: 'diablito', label: 'DIABLO', sfx: 'evil', img: '/gifs/diablito.webp' },
  { id: 'amor', label: 'AMOR', sfx: 'kiss', img: '/gifs/amor.webp' },
];

/** Built-in vector stickers (zero-asset fallback set). */
const VECTOR_GIFS: GifDef[] = [
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

/** Every sticker offered in the picker — real GIFs first. */
export const GIFS: GifDef[] = [...REAL_GIFS, ...VECTOR_GIFS];

export const GIF_PREFIX = 'gif:';

/** The 6 quick-access gifs shown in the HUD row (real ones). */
export const QUICK_GIFS = ['jaja', 'llora', 'rabia', 'fueguito', 'craneo', 'aplausos'];

export function isGifReaction(value: string): boolean {
  return value.startsWith(GIF_PREFIX);
}

export function gifIdOf(value: string): string {
  return value.slice(GIF_PREFIX.length);
}

export function gifById(id: string): GifDef | undefined {
  return GIFS.find((g) => g.id === id);
}
