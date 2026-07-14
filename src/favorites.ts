import { create } from 'zustand';

/**
 * Favorite + most-recent reactions (gif stickers and meme sounds).
 * The quick bar under the board shows the user's FAVORITES first and the
 * MOST RECENT send last, replacing the old fixed gif row. Persisted per
 * device. A "payload" is a reaction string: `gif:<id>` or `snd:<id>`.
 */

const FAV_KEY = 'ludo-party-favs';
const RECENT_KEY = 'ludo-party-recent';
const MAX_FAVS = 6;

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    // snd: payloads are legacy — sounds are system-only now
    return Array.isArray(arr)
      ? arr.filter((v) => typeof v === 'string' && !v.startsWith('snd:'))
      : [];
  } catch {
    return [];
  }
}

function saveList(key: string, list: string[]) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* noop */ }
}

interface FavStore {
  favs: string[];
  recent: string | null;
  toggleFav: (payload: string) => void;
  recordRecent: (payload: string) => void;
}

export const useFavStore = create<FavStore>((set, get) => ({
  favs: loadList(FAV_KEY),
  recent: loadList(RECENT_KEY)[0] ?? null,

  toggleFav: (payload) => {
    const favs = get().favs.includes(payload)
      ? get().favs.filter((f) => f !== payload)
      : [...get().favs, payload].slice(-MAX_FAVS);
    saveList(FAV_KEY, favs);
    set({ favs });
  },

  recordRecent: (payload) => {
    saveList(RECENT_KEY, [payload]);
    set({ recent: payload });
  },
}));
