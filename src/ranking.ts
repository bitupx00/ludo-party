import { create } from 'zustand';

/**
 * Device-local player ranking (no server): every finished match records
 * stats for the humans that played ON THIS DEVICE — in online games only
 * your own player (each device keeps its own record), in local/pass-and-
 * play games every human at the table. Persisted in localStorage.
 */

export interface RankEntry {
  name: string;
  games: number;
  wins: number;
  /** Captures made (kills) across matches. */
  kills: number;
  /** Pieces brought to the goal across matches. */
  goals: number;
  lastPlayed: number;
}

export interface MatchResult {
  name: string;
  won: boolean;
  kills: number;
  goals: number;
}

const RANK_KEY = 'ludo-party-ranking';

function loadRanking(): RankEntry[] {
  try {
    const raw = localStorage.getItem(RANK_KEY);
    const arr = raw ? (JSON.parse(raw) as RankEntry[]) : [];
    return Array.isArray(arr) ? arr.filter((e) => e && typeof e.name === 'string') : [];
  } catch {
    return [];
  }
}

function saveRanking(list: RankEntry[]) {
  try { localStorage.setItem(RANK_KEY, JSON.stringify(list)); } catch { /* noop */ }
}

/** Sort: wins, then win rate, then kills. */
export function sortRanking(list: RankEntry[]): RankEntry[] {
  return [...list].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const rateA = a.games > 0 ? a.wins / a.games : 0;
    const rateB = b.games > 0 ? b.wins / b.games : 0;
    if (rateB !== rateA) return rateB - rateA;
    return b.kills - a.kills;
  });
}

interface RankStore {
  entries: RankEntry[];
  recordMatch: (results: MatchResult[]) => void;
  clearRanking: () => void;
}

export const useRankStore = create<RankStore>((set, get) => ({
  entries: loadRanking(),

  recordMatch: (results) => {
    const byKey = new Map(get().entries.map((e) => [e.name.trim().toLowerCase(), { ...e }]));
    for (const r of results) {
      const name = r.name.replace(/ 🤖$/, '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = byKey.get(key) ?? { name, games: 0, wins: 0, kills: 0, goals: 0, lastPlayed: 0 };
      entry.name = name; // keep the latest capitalization
      entry.games += 1;
      if (r.won) entry.wins += 1;
      entry.kills += Math.max(0, r.kills);
      entry.goals += Math.max(0, r.goals);
      entry.lastPlayed = Date.now();
      byKey.set(key, entry);
    }
    const entries = [...byKey.values()];
    saveRanking(entries);
    set({ entries });
  },

  clearRanking: () => {
    saveRanking([]);
    set({ entries: [] });
  },
}));
