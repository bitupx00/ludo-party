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
  points: number;
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
      id?: string; name?: string; points?: number;
    };
    if (!payload.id || typeof payload.points !== 'number') return null;
    const restored: PlayerProfile = {
      id: payload.id,
      pin: pin.trim(),
      name: (payload.name ?? 'Jugador').slice(0, 24),
      points: Math.max(0, Math.min(99999, Math.round(payload.points))),
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
    if (pts === lastSaved) return;
    lastSaved = pts;
    setProfilePoints(pts);
  });
}
