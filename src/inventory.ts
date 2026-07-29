import { create } from 'zustand';
import { loadProfile, saveProfile, coinsToStars } from './profile';
import { EVENT_POOLS, MEME_SOUNDS, THROW_SOUNDS } from './game/memeSounds';

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

const DICE_KEY = 'ludo-party-dice-owned';

function loadDice(): string[] {
  try {
    const raw = localStorage.getItem(DICE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((d) => typeof d === 'string') : [];
  } catch { return []; }
}

function saveDice(list: string[]) {
  try { localStorage.setItem(DICE_KEY, JSON.stringify(list)); } catch { /* noop */ }
}

interface InvStore {
  memes: OwnedMeme[];
  /** Purchased dice skin ids ('clasico' is always owned implicitly). */
  dice: string[];
  /** Buy with coins (3,500) or stars (18). Returns false if can't afford. */
  buyMeme: (meme: Omit<OwnedMeme, 'sound'>, payWith: 'coins' | 'stars') => boolean;
  /** Buy a dice skin with puntos (price from DICE_SKINS). */
  buyDice: (skinId: string, price: number) => boolean;
  /** Link a sound to an owned meme — 15 ⭐ only. */
  linkSound: (memeId: string, soundId: string) => boolean;
}

export const useInvStore = create<InvStore>((set, get) => ({
  memes: loadInv(),
  dice: loadDice(),

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

  buyDice: (skinId, price) => {
    if (skinId === 'clasico' || get().dice.includes(skinId)) return false;
    const p = loadProfile();
    if (!p) return false;
    if (price > 0) {
      if ((p.coins ?? 0) < price) return false;
      p.coins -= price;
      saveProfile(p);
    }
    const dice = [...get().dice, skinId];
    saveDice(dice);
    set({ dice });
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

/** Every meme ALWAYS travels with a sound: the linked one if bought, or a
 *  deterministic fallback picked from the meme id so all clients agree. */
export function soundForMeme(meme: OwnedMeme): string {
  if (meme.sound) return meme.sound;
  let h = 0;
  const key = meme.id || meme.url;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return THROW_SOUNDS[h % THROW_SOUNDS.length];
}

/** Recommended sounds for a meme — same occasion logic the pieces use:
 *  keyword-match the meme id/name against the event pools, plus a few
 *  extra picks from the full catalog (deterministic per-meme, so two
 *  memes in the same category don't always show the exact same list). */
export function recommendSounds(memeIdOrName: string): string[] {
  const k = memeIdOrName.toLowerCase();
  const pick = (kind: keyof typeof EVENT_POOLS) => [...EVENT_POOLS[kind]];
  let base: string[];
  if (/(craneo|calavera|skull|muert|rip|dead)/.test(k)) base = pick('death');
  else if (/(bomba|boom|explo|pew|kill|elimina)/.test(k)) base = pick('kill');
  else if (/(jaja|risa|rofl|laugh|lol|payaso|clown)/.test(k)) base = [...pick('passMover'), 'vinuela', 'scouts'];
  else if (/(llora|cry|sad|buaa|triste)/.test(k)) base = ['miau', 'ohnonono', ...pick('allyDeath')];
  else if (/(rabia|furia|angry|grr)/.test(k)) base = ['queasco', 'perraloca', 'tuproblema'];
  else if (/(amor|love|corazon|kiss|beso)/.test(k)) base = ['ajena', 'meamaba', 'cincomin'];
  else if (/(fiesta|party|confeti|gol|win|victoria)/.test(k)) base = [...pick('goal'), ...pick('teamWin'), 'excelente'];
  else if (/(corre|run|escape|rapido|fast|mcqueen)/.test(k)) base = [...pick('escape'), 'mcqueen', 'correperra'];
  else if (/(diablo|devil|evil)/.test(k)) base = ['diablos', 'ayuwoki'];
  else if (/(popo|caca|poop|fart|asco)/.test(k)) base = ['queasco', 'bruh', 'guayaco'];
  else base = ['bruh', 'buenasbuenas', 'excelente', 'ohnonono'];

  let h = 0;
  for (let i = 0; i < memeIdOrName.length; i++) h = (h * 31 + memeIdOrName.charCodeAt(i)) >>> 0;
  const pool = MEME_SOUNDS.map((s) => s.id).filter((id) => !base.includes(id));
  const extras: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < 5 && used.size < pool.length; i++) {
    let idx = (h + i * 17) % pool.length;
    while (used.has(idx)) idx = (idx + 1) % pool.length;
    used.add(idx);
    extras.push(pool[idx]);
  }
  return [...base, ...extras];
}

/** Every sound in the catalog, for the "más sonidos" browse-all view. */
export function allSoundIds(): string[] {
  return MEME_SOUNDS.map((s) => s.id);
}
