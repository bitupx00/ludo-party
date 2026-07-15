/**
 * Klipy GIF API (v2) integration — real community meme GIFs.
 *
 * Drop-in replacement for the discontinued Tenor V1 API.
 * Uses api.klipy.com/v2 with Brad's production key.
 *
 * Two uses:
 * - OCCASION MEMES: the host prefetches a small pool per game occasion
 *   (kill, death, goal…) and picks one when the occasion fires; the URL
 *   travels in the memeFx snapshot so everyone sees the same GIF.
 * - USER SEARCH: the sticker panel gets a Klipy search bar + trending
 *   row; the chosen GIF is sent as a `tgif:<url>` reaction.
 *
 * Everything fails SOFT: no network / blocked Klipy simply falls back
 * to the bundled animated stickers.
 */

const KLIPY_KEY = 'eLKzy04aaioet2Yp86ROdEFkIhw72prUsn8c0GdcFzLlywFmXpljiSzJVBcLbksV';
const BASE = 'https://api.klipy.com/v2';

export interface TenorGif {
  id: string;
  /** tinygif — small, fast, ideal for in-game bubbles. */
  url: string;
  /** nanogif — tiny preview for grids (falls back to tinygif). */
  preview: string;
}

interface KlipyMediaEntry {
  gif?: { url?: string; dims?: number[]; size?: number };
  tinygif?: { url?: string; dims?: number[]; size?: number };
  nanogif?: { url?: string; dims?: number[]; size?: number };
  mp4?: { url?: string };
}
interface KlipyResult {
  id?: string | number;
  media_formats?: KlipyMediaEntry | KlipyMediaEntry[];
  url?: string;
}

function parseResults(json: unknown): TenorGif[] {
  const results = (json as { results?: KlipyResult[] })?.results ?? [];
  const out: TenorGif[] = [];
  for (const r of results) {
    const mf = r.media_formats ?? {};
    // Klipy returns media_formats as a dict (one entry per requested format)
    const formats = Array.isArray(mf) ? {} : mf;
    const url =
      formats.tinygif?.url ??
      formats.gif?.url ??
      r.url ??
      '';
    if (!url) continue;
    out.push({
      id: String(r.id ?? ''),
      url,
      preview: formats.nanogif?.url ?? formats.tinygif?.url ?? url,
    });
  }
  return out;
}

async function klipyFetch(path: string): Promise<TenorGif[]> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${BASE}${path}${sep}key=${KLIPY_KEY}`);
  if (!res.ok) throw new Error(`klipy ${res.status}`);
  return parseResults(await res.json());
}

/** Search Klipy (Spanish-first locale, family-safe filter). */
export function tenorSearch(q: string, limit = 16): Promise<TenorGif[]> {
  return klipyFetch(
    `/search?q=${encodeURIComponent(q)}&limit=${limit}&contentfilter=medium&locale=es_MX&media_filter=gif,tinygif,nanogif`
  );
}

/** Trending GIFs (shown before the user types anything). */
export function tenorTrending(limit = 16): Promise<TenorGif[]> {
  return klipyFetch(
    `/trending?limit=${limit}&contentfilter=medium&locale=es_MX&media_filter=gif,tinygif,nanogif`
  );
}

/** Registershare is a no-op for Klipy (fire-and-forget compatibility). */
export function tenorRegisterShare(_id: string, _q: string) {
  /* Klipy does not require share registration */
}

/* ─── Occasion meme pools ──────────────────────────────────────────── */

/** Search term per game occasion (crafted for meme-style results). */
export const OCCASION_QUERIES: Record<string, string> = {
  death: 'muerte meme funny death',
  kill: 'eliminated hasta la vista meme',
  goal: 'gooool celebration meme',
  passMover: 'bye bye adios meme',
  passSurvivor: 'phew alivio meme',
  block: 'no pasa nada blocked meme',
  ownStack: 'best friends team meme',
  enemyEntry: 'knock knock sorpresa meme',
  escape: 'corre run away meme',
  gameStart: 'lets go empezamos meme',
  allyNoKill: 'jaja risa meme',
  allyDeath: 'llorando crying meme',
  allyKill: 'aplausos bravo meme',
  enemyNear: 'miedo scared meme',
  homeLane: 'ya casi almost there meme',
  teamWin: 'victoria winner meme',
};

const pools = new Map<string, TenorGif[]>();
const pending = new Set<string>();

/** Cached Klipy URLs for an occasion ([] until the fetch lands). */
export function tenorPoolFor(kind: string): TenorGif[] {
  return pools.get(kind) ?? [];
}

/** Background-fill the pool for one occasion (no-op if cached/pending). */
export function fillPool(kind: string) {
  const q = OCCASION_QUERIES[kind];
  if (!q || pools.has(kind) || pending.has(kind)) return;
  pending.add(kind);
  tenorSearch(q, 8)
    .then((gifs) => {
      if (gifs.length > 0) pools.set(kind, gifs);
    })
    .catch(() => {
      /* offline/blocked — bundled stickers cover it */
    })
    .finally(() => pending.delete(kind));
}

/** Prefetch the pools that fire most often (called at game start —
 *  HOST only; guests just render the URL from the snapshot). */
export function prefetchOccasionGifs() {
  for (const kind of [
    'kill',
    'death',
    'goal',
    'escape',
    'gameStart',
    'block',
    'homeLane',
    'teamWin',
  ]) {
    fillPool(kind);
  }
}
