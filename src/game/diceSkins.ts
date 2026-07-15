/**
 * Dice skins (Ludo Club style): 5 models the player picks in the lobby
 * BEFORE the match. Purely cosmetic — colors + optional glow effect,
 * applied via CSS custom properties on the 3D dice and the mini dice.
 * Synced through Player.diceSkin so everyone sees each player's dice.
 */

export interface DiceSkin {
  id: string;
  /** Display name (shown in the lobby picker). */
  name: string;
  /** CSS custom properties consumed by Dice3D / MiniDice. */
  vars: Record<string, string>;
  /** Optional visual effect class suffix ('glow' = colored halo). */
  effect?: 'glow';
}

export const DICE_SKINS: DiceSkin[] = [
  {
    id: 'clasico',
    name: 'Clásico',
    vars: {
      '--d3-f1': '#ffffff', '--d3-f2': '#f3eee2', '--d3-f3': '#ddd3bd',
      '--d3-bd': 'rgba(120, 100, 60, 0.25)',
      '--d3-p1': '#6b5cf0', '--d3-p2': '#4534b8', '--d3-p3': '#32247e',
    },
  },
  {
    id: 'rosa',
    name: 'Rosa ♥',
    effect: 'glow',
    vars: {
      '--d3-f1': '#fff0f6', '--d3-f2': '#ffd6e7', '--d3-f3': '#f7a8c8',
      '--d3-bd': 'rgba(214, 51, 108, 0.35)',
      '--d3-p1': '#f06595', '--d3-p2': '#d6336c', '--d3-p3': '#a61e4d',
      '--d3-glow': 'rgba(246, 121, 172, 0.55)',
    },
  },
  {
    id: 'zafiro',
    name: 'Zafiro',
    vars: {
      '--d3-f1': '#e8eef7', '--d3-f2': '#9db4cc', '--d3-f3': '#51677f',
      '--d3-bd': 'rgba(20, 40, 70, 0.4)',
      '--d3-p1': '#27415e', '--d3-p2': '#122a44', '--d3-p3': '#081527',
    },
  },
  {
    id: 'dorado',
    name: 'Dorado',
    effect: 'glow',
    vars: {
      '--d3-f1': '#fff7d6', '--d3-f2': '#ffd65a', '--d3-f3': '#d4a017',
      '--d3-bd': 'rgba(150, 105, 10, 0.45)',
      '--d3-p1': '#8a5a06', '--d3-p2': '#6b4404', '--d3-p3': '#452b02',
      '--d3-glow': 'rgba(255, 200, 60, 0.6)',
    },
  },
  {
    id: 'neon',
    name: 'Neón',
    effect: 'glow',
    vars: {
      '--d3-f1': '#2b3648', '--d3-f2': '#171e2b', '--d3-f3': '#080b12',
      '--d3-bd': 'rgba(60, 255, 150, 0.5)',
      '--d3-p1': '#7dffb8', '--d3-p2': '#2bff8b', '--d3-p3': '#0dbb5d',
      '--d3-glow': 'rgba(45, 255, 140, 0.55)',
    },
  },
];

const DEFAULT = DICE_SKINS[0];

export function skinById(id?: string | null): DiceSkin {
  return DICE_SKINS.find((s) => s.id === id) ?? DEFAULT;
}

export function isValidSkin(id: string): boolean {
  return DICE_SKINS.some((s) => s.id === id);
}

/* ── Device preference (auto-applied to your seat) ─────────────────── */

const SKIN_KEY = 'ludo-party-dice-skin';

export function loadSkinPref(): string {
  try { return localStorage.getItem(SKIN_KEY) ?? DEFAULT.id; } catch { return DEFAULT.id; }
}

export function saveSkinPref(id: string) {
  try { localStorage.setItem(SKIN_KEY, id); } catch { /* noop */ }
}
