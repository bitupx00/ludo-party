import { create } from 'zustand';
import { loadProfile, saveProfile, coinsToStars } from './profile';
import { EVENT_POOLS, MEME_SOUNDS } from './game/memeSounds';

/**
 * Player inventory (device-local, like the wallet): purchased memes with
 * optional LINKED sounds, plus equipment (dice skin lives in diceSkins
 * pref; pieces/boards arrive later).
 *
 * Prices (fixed 200 pts = 1 ⭐ exchange):
 *  - Meme: 3,500 puntos or 18 ⭐
 *  - Link a sound to an owned meme: 15 ⭐ ONLY (never puntos)
 */

export const MEME_COST_COINS = 3500;
export const MEME_COST_STARS = coinsToStars(MEME_COST_COINS); // 18
export const LINK_COST_STARS = 15;

export interface OwnedMeme {
  id: string;       // tenor id or sticker id
  url: string;      // tinygif url ('' for bundled stickers)
  preview: string;
  /** Linked meme-sound id — plays when this meme is thrown/sent. */
  sound?: string;
}

const INV_KEY = 'ludo-party-inventory';

function loadInv(): OwnedMeme[] {
  try {
    const raw = localStorage.getItem(INV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((m) => m && typeof m.id === 'string') : [];
  } catch { return []; }
}

function saveInv(list: OwnedMeme[]) {
  try { localStorage.setItem(INV_KEY, JSON.stringify(list.slice(0, 200))); } catch { /* noop */ }
}

interface InvStore {
  memes: OwnedMeme[];
  /** Buy with coins (3,500) or stars (18). Returns false if can't afford. */
  buyMeme: (meme: Omit<OwnedMeme, 'sound'>, payWith: 'coins' | 'stars') => boolean;
  /** Link a sound to an owned meme — 15 ⭐ only. */
  linkSound: (memeId: string, soundId: string) => boolean;
}

export const useInvStore = create<InvStore>((set, get) => ({
  memes: loadInv(),

  buyMeme: (meme, payWith) => {
    if (get().memes.some((m) => m.id === meme.id)) return false;
    const p = loadProfile();
    if (!p) return false;
    if (payWith === 'coins') {
      if ((p.coins ?? 0) < MEME_COST_COINS) return false;
      p.coins -= MEME_COST_COINS;
    } else {
      if (p.points < MEME_COST_STARS) return false;
      p.points -= MEME_COST_STARS;
    }
    saveProfile(p);
    const memes = [...get().memes, meme];
    saveInv(memes);
    set({ memes });
    return true;
  },

  linkSound: (memeId, soundId) => {
    if (!MEME_SOUNDS.some((s) => s.id === soundId)) return false;
    if (!get().memes.some((m) => m.id === memeId)) return false;
    const p = loadProfile();
    if (!p || p.points < LINK_COST_STARS) return false;
    p.points -= LINK_COST_STARS;
    saveProfile(p);
    const memes = get().memes.map((m) => (m.id === memeId ? { ...m, sound: soundId } : m));
    saveInv(memes);
    set({ memes });
    return true;
  },
}));

/** Recommended sounds for a meme — same occasion logic the pieces use:
 *  keyword-match the meme id/name against the event pools. */
export function recommendSounds(memeIdOrName: string): string[] {
  const k = memeIdOrName.toLowerCase();
  const pick = (kind: keyof typeof EVENT_POOLS) => [...EVENT_POOLS[kind]];
  if (/(craneo|calavera|skull|muert|rip|dead)/.test(k)) return pick('death');
  if (/(bomba|boom|explo|pew|kill|elimina)/.test(k)) return pick('kill');
  if (/(jaja|risa|rofl|laugh|lol|payaso|clown)/.test(k)) return [...pick('passMover'), 'vinuela', 'scouts'];
  if (/(llora|cry|sad|buaa|triste)/.test(k)) return ['miau', 'ohnonono', ...pick('allyDeath')];
  if (/(rabia|furia|angry|grr)/.test(k)) return ['queasco', 'perraloca', 'tuproblema'];
  if (/(amor|love|corazon|kiss|beso)/.test(k)) return ['ajena', 'meamaba', 'cincomin'];
  if (/(fiesta|party|confeti|gol|win|victoria)/.test(k)) return [...pick('goal'), ...pick('teamWin'), 'excelente'];
  if (/(corre|run|escape|rapido|fast|mcqueen)/.test(k)) return [...pick('escape'), 'mcqueen', 'correperra'];
  if (/(diablo|devil|evil)/.test(k)) return ['diablos', 'ayuwoki'];
  if (/(popo|caca|poop|fart|asco)/.test(k)) return ['queasco', 'bruh', 'guayaco'];
  return ['bruh', 'buenasbuenas', 'excelente', 'ohnonono'];
}
