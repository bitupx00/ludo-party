/**
 * Tenor GIF API (v1) integration — real community meme GIFs.
 *
 * Two uses:
 * - OCCASION MEMES: the host prefetches a small pool per game occasion
 *   (kill, death, goal…) and picks one when the occasion fires; the URL
 *   travels in the memeFx snapshot so everyone sees the same GIF.
 * - USER SEARCH: the sticker panel gets a Tenor search bar + trending
 *   row; the chosen GIF is sent as a `tgif:<url>` reaction.
 *
 * Everything fails SOFT: no network / blocked Tenor simply falls back
 * to the bundled animated stickers.
 */

const TENOR_KEY = 'LIVDSRZULELA';
const BASE = 'https://g.tenor.com/v1';

export interface TenorGif {
  id: string;
  /** tinygif — small, fast, ideal for in-game bubbles. */
  url: string;
  /** nanogif — tiny preview for grids (falls back to tinygif). */
  preview: string;
}

interface TenorMediaEntry {
  tinygif?: { url?: string };
  nanogif?: { url?: string };
  gif?: { url?: string };
}
interface TenorResult { id?: string | number; media?: TenorMediaEntry[] }

function parseResults(json: unknown): TenorGif[] {
  const results = (json as { results?: TenorResult[] })?.results ?? [];
  const out: TenorGif[] = [];
  for (const r of results) {
    const m = r.media?.[0];
    const url = m?.tinygif?.url ?? m?.gif?.url ?? '';
    if (!url) continue;
    out.push({ id: String(r.id ?? ''), url, preview: m?.nanogif?.url ?? url });
  }
  return out;
}

async function tenorFetch(path: string): Promise<TenorGif[]> {
  const res = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}key=${TENOR_KEY}`);
  if (!res.ok) throw new Error(`tenor ${res.status}`);
  return parseResults(await res.json());
}

/** Search Tenor (Spanish-first locale, family-safe filter). */
export function tenorSearch(q: string, limit = 16): Promise<TenorGif[]> {
  return tenorFetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}&contentfilter=medium&locale=es_MX&media_filter=basic`);
}

/** Trending GIFs (shown before the user types anything). */
export function tenorTrending(limit = 16): Promise<TenorGif[]> {
  return tenorFetch(`/trending?limit=${limit}&contentfilter=medium&locale=es_MX&media_filter=basic`);
}

/** Tell Tenor a GIF was shared (tunes their ranking; fire-and-forget). */
export function tenorRegisterShare(id: string, q: string) {
  if (!id) return;
  try {
    void fetch(`${BASE}/registershare?id=${id}&key=${TENOR_KEY}&q=${encodeURIComponent(q)}`).catch(() => {});
  } catch { /* noop */ }
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

/** Cached Tenor URLs for an occasion ([] until the fetch lands). */
export function tenorPoolFor(kind: string): TenorGif[] {
  return pools.get(kind) ?? [];
}

/** Background-fill the pool for one occasion (no-op if cached/pending). */
export function fillPool(kind: string) {
  const q = OCCASION_QUERIES[kind];
  if (!q || pools.has(kind) || pending.has(kind)) return;
  pending.add(kind);
  tenorSearch(q, 8)
    .then((gifs) => { if (gifs.length > 0) pools.set(kind, gifs); })
    .catch(() => { /* offline/blocked — bundled stickers cover it */ })
    .finally(() => pending.delete(kind));
}

/** Prefetch the pools that fire most often (called at game start —
 *  HOST only; guests just render the URL from the snapshot). */
export function prefetchOccasionGifs() {
  for (const kind of ['kill', 'death', 'goal', 'escape', 'gameStart', 'block', 'homeLane', 'teamWin']) {
    fillPool(kind);
  }
}
