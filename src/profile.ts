import { useGameStore } from './store/gameStore';

/**
 * Local player registry ("cuenta" ligera, sin servidor): a JSON profile in
 * localStorage that keeps the player's identity and their accumulated
 * lucky-dice shop points ACROSS matches and sessions.
 *
 * - Auto-created the first time the player enters a name; the session then
 *   just continues on this device (same name, same wallet of ⭐).
 * - Identity = public ID (6 chars) + secret 4-digit PIN.
 * - Device/IP change: the profile exports a one-click-copyable TRANSFER
 *   CODE that carries the whole profile (name + points), sealed with the
 *   PIN. Pasting the code + PIN on the new device restores everything.
 */

export interface PlayerProfile {
  id: string;
  pin: string;
  name: string;
  /** Star wallet (⭐): earned rolling 6/1, spent on lucky dice & memes. */
  points: number;
  /** Coin wallet ("puntos"): betting/shop currency. Everyone starts with
   *  3000; +1000+ per daily login (escalating weekly calendar). */
  coins: number;
  /** Daily-claim tracking: last claim date (yyyy-mm-dd) + streak day 1-7. */
  lastClaim?: string;
  claimStreak?: number;
  createdAt: number;
}

const PROFILE_KEY = 'ludo-party-profile';
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomId(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return out;
}

export function loadProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PlayerProfile;
    if (!p.id || !p.pin || typeof p.points !== 'number') return null;
    if (typeof p.coins !== 'number') {
      // One-time migration bonus for EXISTING accounts: the 3,000 starting
      // coins plus 15 ⭐ of welcome (only fires once — coins get defined).
      p.coins = 3000;
      p.points = Math.max(0, Math.min(99999, p.points + 15));
      saveProfile(p);
    }
    return p;
  } catch {
    return null;
  }
}

export function saveProfile(profile: PlayerProfile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* noop */ }
}

/** Get (or lazily create) the device profile, updating the display name. */
export function ensureProfile(name: string): PlayerProfile {
  const clean = name.trim().slice(0, 24);
  const existing = loadProfile();
  if (existing) {
    if (clean && existing.name !== clean) {
      existing.name = clean;
      saveProfile(existing);
    }
    return existing;
  }
  const fresh: PlayerProfile = {
    id: randomId(6),
    pin: String(Math.floor(1000 + Math.random() * 9000)),
    name: clean || 'Jugador',
    points: 0,
    coins: 3000,
    createdAt: Date.now(),
  };
  saveProfile(fresh);
  return fresh;
}

export function setProfilePoints(points: number) {
  const p = loadProfile();
  if (!p) return;
  const clamped = Math.max(0, Math.min(99999, Math.round(points)));
  if (p.points === clamped) return;
  p.points = clamped;
  saveProfile(p);
}

/* ─── Coins ("puntos") + daily rewards ─────────────────────────────── */

const MAX_COINS = 99999999;

/** Fixed exchange rate for pricing anything in both currencies:
 *  200 puntos = 1 ⭐ (e.g. 3,000 pts ⇒ 15 ⭐). Star prices are always
 *  ceil(coins / COINS_PER_STAR). */
export const COINS_PER_STAR = 200;

export function coinsToStars(coins: number): number {
  return Math.ceil(coins / COINS_PER_STAR);
}

export function getCoins(): number {
  // No profile yet = the starting balance everyone begins with
  return loadProfile()?.coins ?? 3000;
}

export function addCoins(delta: number) {
  const p = loadProfile();
  if (!p) return;
  p.coins = Math.max(0, Math.min(MAX_COINS, Math.round((p.coins ?? 0) + delta)));
  saveProfile(p);
}

/** Escalating weekly login calendar (coins per consecutive day). Day 7
 *  also grants +100 ⭐. Missing a day restarts the streak. */
export const DAILY_REWARDS = [1000, 2000, 3000, 5000, 8000, 12000, 30000];
export const DAY7_STAR_BONUS = 100;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr(): string {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Where the player stands in the weekly calendar. `day` = the day they
 *  would claim NEXT (1-7). */
export function claimStatus(): { canClaim: boolean; day: number } {
  const p = loadProfile();
  if (!p) return { canClaim: true, day: 1 }; // profile auto-creates on claim
  if (p.lastClaim === todayStr()) {
    return { canClaim: false, day: Math.min((p.claimStreak ?? 1), 7) };
  }
  const streak = p.lastClaim === yesterdayStr() ? (p.claimStreak ?? 0) : 0;
  return { canClaim: true, day: (streak % 7) + 1 };
}

/** Claim today's login reward (null = already claimed / no profile). */
export function claimDaily(): { coins: number; stars: number; day: number } | null {
  const p = loadProfile();
  if (!p || p.lastClaim === todayStr()) return null;
  const streak = p.lastClaim === yesterdayStr() ? (p.claimStreak ?? 0) : 0;
  const day = (streak % 7) + 1;
  const coins = DAILY_REWARDS[day - 1];
  const stars = day === 7 ? DAY7_STAR_BONUS : 0;
  p.coins = Math.max(0, Math.min(MAX_COINS, (p.coins ?? 0) + coins));
  p.points = Math.max(0, Math.min(99999, p.points + stars));
  p.lastClaim = todayStr();
  p.claimStreak = day;
  saveProfile(p);
  return { coins, stars, day };
}

/* ─── Transfer code (PIN-sealed, serverless) ────────────────────────── */

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Simple keystream from the PIN (obfuscation, not cryptography — the goal
 *  is that a code without its PIN is useless to a casual snoop). */
function pinKey(pin: string, length: number): Uint8Array {
  const key = new Uint8Array(length);
  let seed = 0;
  for (const ch of pin) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    key[i] = (seed >>> 16) & 0xff;
  }
  return key;
}

/** One-click-copyable code carrying the full profile, sealed with the PIN. */
export function exportProfileCode(profile: PlayerProfile): string {
  const payload = JSON.stringify({
    id: profile.id,
    name: profile.name,
    points: profile.points,
    coins: profile.coins ?? 3000,
    ts: Date.now(),
  });
  const bytes = new TextEncoder().encode(payload);
  const key = pinKey(profile.pin, bytes.length);
  const sealed = bytes.map((b, i) => b ^ key[i]);
  return `LP1.${toBase64Url(sealed)}`;
}

/** Restore a profile from a transfer code + its PIN (null = wrong code/PIN). */
export function importProfileCode(code: string, pin: string): PlayerProfile | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith('LP1.') || !/^\d{4}$/.test(pin.trim())) return null;
  const sealed = fromBase64Url(trimmed.slice(4));
  if (!sealed) return null;
  const key = pinKey(pin.trim(), sealed.length);
  const bytes = sealed.map((b, i) => b ^ key[i]);
  try {
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
      id?: string; name?: string; points?: number; coins?: number;
    };
    if (!payload.id || typeof payload.points !== 'number') return null;
    const restored: PlayerProfile = {
      id: payload.id,
      pin: pin.trim(),
      name: (payload.name ?? 'Jugador').slice(0, 24),
      points: Math.max(0, Math.min(99999, Math.round(payload.points))),
      coins: Math.max(0, Math.min(MAX_COINS, Math.round(payload.coins ?? 3000))),
      createdAt: Date.now(),
    };
    saveProfile(restored);
    return restored;
  } catch {
    return null; // wrong PIN → garbage bytes → JSON parse fails
  }
}

/* ─── Live sync: persist the own player's in-game points ────────────── */

/** Which player this DEVICE owns in the current game. */
function ownPlayerId(): string | null {
  const s = useGameStore.getState();
  if (s.localPlayerId) return s.localPlayerId;
  const firstHuman = s.players.find((p) => !p.isBot);
  return firstHuman?.id ?? null;
}

/** Subscribe once at app start: whenever the own player's points change
 *  during a game, persist them to the profile wallet. Covers normal play,
 *  guests (points arrive via snapshots), disconnects and mid-game exits —
 *  the wallet always reflects the last known in-game balance. */
export function startProfileSync() {
  let lastSaved: number | null = null;
  useGameStore.subscribe((state) => {
    if (state.screen !== 'game') return;
    const ownId = ownPlayerId();
    if (!ownId) return;
    const me = state.players.find((p) => p.id === ownId);
    if (!me || me.isBot) return;
    const pts = me.points ?? 0;
    if (pts !== lastSaved) {
      lastSaved = pts;
      setProfilePoints(pts);
    }

    // ── Match bets (coins): pay the entry once per match; the winner
    //    (or winning team, split) collects the pot. Self-reported wallet
    //    like the stars — each device settles its OWN player.
    const bet = state.betAmount ?? 0;
    if (bet > 0 && state.matchId) {
      try {
        if (localStorage.getItem('ludo-party-paid') !== state.matchId) {
          localStorage.setItem('ludo-party-paid', state.matchId);
          addCoins(-bet);
        }
        if (state.phase === 'finished' && state.winner &&
            localStorage.getItem('ludo-party-payout') !== state.matchId) {
          const humans = state.players.filter((p) => !p.isBot).length;
          const pot = bet * Math.max(humans, 2);
          const mateWin = state.teamsMode &&
            state.players.find((p) => p.id === ownId)?.color &&
            state.winner === TEAMMATE_LOCAL[state.players.find((p) => p.id === ownId)!.color];
          const iWon = me.color === state.winner || !!mateWin;
          if (iWon) {
            localStorage.setItem('ludo-party-payout', state.matchId);
            addCoins(state.teamsMode ? Math.round(pot / 2) : pot);
          }
        }
      } catch { /* storage unavailable */ }
    }
  });
}

/** Local copy of the teammate map (avoids importing game types here). */
const TEAMMATE_LOCAL: Record<string, string> = { red: 'yellow', yellow: 'red', green: 'blue', blue: 'green' };
