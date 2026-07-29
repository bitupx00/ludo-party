export type Color = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'cyan';

/** Game modes selectable from the home dashboard. */
export type GameMode = 'solo' | 'local' | 'teams' | 'online' | 'hex6';

/** Team pairing for 2v2 mode: opposite corners play together. */
export const TEAMMATE: Record<Color, Color> = {
  red: 'yellow',
  yellow: 'red',
  green: 'blue',
  blue: 'green',
  // purple/cyan only exist on the hex board (see HEX_TEAMMATE)
  purple: 'cyan',
  cyan: 'purple',
};

/** Hex 2v2v2 pairing: OPPOSITE arms play together (arm k ↔ arm k+3). */
export const HEX_TEAMMATE: Record<Color, Color> = {
  red: 'green', green: 'red',
  blue: 'purple', purple: 'blue',
  yellow: 'cyan', cyan: 'yellow',
};

/** Teammate of a color under the active board (4p pairs or hex pairs). */
export function teammateOf(color: Color, hex?: boolean): Color {
  return hex ? HEX_TEAMMATE[color] : TEAMMATE[color];
}

/** Team identity (2v2): red+yellow = Equipo Fuego 🔥, green+blue =
 *  Equipo Bosque 🌲 — shown as a badge on each avatar in team games. */
export const TEAM_INFO: Record<'fuego' | 'bosque', { nameKey: 'teamFire' | 'teamForest'; emoji: string }> = {
  fuego: { nameKey: 'teamFire', emoji: '🔥' },
  bosque: { nameKey: 'teamForest', emoji: '🌲' },
};

export function teamOf(color: Color): 'fuego' | 'bosque' {
  return color === 'red' || color === 'yellow' ? 'fuego' : 'bosque';
}

export interface Player {
  id: string;
  name: string;
  color: Color;
  emoji: string; // avatar emoji
  pieces: Piece[];
  isBot?: boolean;
  /** Lucky-dice shop points: +1 for every 6 or 1 rolled, spent buying
   *  weighted dice (see LUCKY_DICE_COST in gameEngine). */
  points?: number;
  /** Captures made this match (for the ranking screen). */
  kills?: number;
  /** Lucky dice bought this match — each purchase raises every dice's
   *  price by +1 ⭐ (cost = base + luckyBuys). Resets each match. */
  luckyBuys?: number;
  /** A bought lucky dice waiting to be used: applied automatically to
   *  this player's NEXT own roll (they still tap to roll). */
  pendingLucky?: number | null;
  /** Last turnCount this player triggered a panel sound on (limit: one
   *  user sound per game turn). */
  lastSoundTurn?: number;
  /** Chosen dice model (see game/diceSkins.ts) — picked in the lobby. */
  diceSkin?: string;
}

export interface Piece {
  id: string;
  position: number; // -1=home, 0-51=board, 52-56=final stretch lane, 57=goal
  isSafe: boolean;
  capturedCount: number;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  phase: 'lobby' | 'rolling' | 'moving' | 'finished';
  winner: Color | null;
  messages: GameMessage[];
  captureEffects: CaptureEffect[];
  turnCount: number;
  consecutiveSixes: number;
  /** Banked extra rolls: rolling a 6/1 AND capturing (or reaching the
   *  goal) in the same move stacks TWO extra rolls — one is used by
   *  staying on the turn, the rest waits here and keeps the turn alive
   *  even if the next roll earns nothing. */
  pendingExtraRolls?: number;
  /** When true (2v2 mode), teammates cannot capture each other. */
  teamsMode?: boolean;
  /** "Piezas Hermanas" mode: your pieces stacked on the SAME square move
   *  TOGETHER as one convoy. */
  siblingMode?: boolean;
  /** Hexagonal 6-player board: 78-ring / 6-lane geometry + hex teams. */
  hexMode?: boolean;
}

export interface GameMessage {
  id: string;
  playerId: string;
  text: string;
  sticker?: string;
  timestamp: number;
  /** 'chat' = user-authored (typed text, quick phrase, reaction/sticker) —
   *  shown in the chat panel. 'system' = engine narration (dice rolls,
   *  captures, turn events) — has its own dedicated UI elsewhere and is
   *  hidden from the chat panel. Defaults to 'system' when omitted. */
  kind?: 'chat' | 'system';
}

export interface CaptureEffect {
  id: string;
  x: number;
  y: number;
  gifUrl: string;
  timestamp: number;
  type: 'capture' | 'safe' | 'home' | 'win';
  /** Meme-toast text, e.g. "💥 Ana eliminó a Beto" (who did what to whom). */
  label?: string;
  /** Local ms to wait before SHOWING the effect (toast + sfx): the mover's
   *  travel animation duration, so the announcement never precedes the
   *  piece visibly arriving. Each client applies it from when the effect
   *  reaches them (no cross-device clock math). */
  delay?: number;
}

export const COLORS: Color[] = ['red', 'green', 'yellow', 'blue'];

// Board path: 52 squares in clockwise order
// Each color has: home base, entry point, safe squares, final stretch (5 squares)
export const COLOR_CONFIG: Record<Color, {
  entryIndex: number;
  safeSquares: number[];
  homeStretchStart: number;
  homeStretchEnd: number;
  emoji: string;
  cssClass: string;
  displayName: string;
}> = {
  red: {
    entryIndex: 0,
    safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
    homeStretchStart: 52,
    homeStretchEnd: 56,
    emoji: '🔴',
    cssClass: 'player-red',
    displayName: 'Rojo',
  },
  green: {
    entryIndex: 39,
    safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
    homeStretchStart: 52,
    homeStretchEnd: 56,
    emoji: '🟢',
    cssClass: 'player-green',
    displayName: 'Verde',
  },
  yellow: {
    entryIndex: 26,
    safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
    homeStretchStart: 52,
    homeStretchEnd: 56,
    emoji: '🟡',
    cssClass: 'player-yellow',
    displayName: 'Amarillo',
  },
  blue: {
    entryIndex: 13,
    safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
    homeStretchStart: 52,
    homeStretchEnd: 56,
    emoji: '🔵',
    cssClass: 'player-blue',
    displayName: 'Azul',
  },
  // Hex-only colors — entry/lane data for them lives in hex/boardPath6;
  // these 4p fields are placeholders so the Record stays total.
  purple: {
    entryIndex: 0,
    safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
    homeStretchStart: 52,
    homeStretchEnd: 56,
    emoji: '🟣',
    cssClass: 'player-purple',
    displayName: 'Morado',
  },
  cyan: {
    entryIndex: 0,
    safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
    homeStretchStart: 52,
    homeStretchEnd: 56,
    emoji: '🔷',
    cssClass: 'player-cyan',
    displayName: 'Celeste',
  },
};

/** Last board square (0-51) from which rolling 1+ enters the home stretch.
 *  Ludo Club convention: each color travels 50 ring squares from its entry
 *  and turns into its own arm's center lane at the arm tip.
 *  Red (entry=0): HS_entry = 50 — left tip (0,7)
 *  Blue (entry=13): HS_entry = 11 — top tip (7,0)
 *  Yellow (entry=26): HS_entry = 24 — right tip (14,7)
 *  Green (entry=39): HS_entry = 37 — bottom tip (7,14) */
export const HOME_STRETCH_ENTRY: Record<Color, number> = {
  red: 50,
  green: 37,
  yellow: 24,
  blue: 11,
  purple: 0, // hex-only (see HEX_LANE_ENTRANCE)
  cyan: 0,   // hex-only
};

/** Avatar ICON keys (see components/AvatarIcon.tsx) — professional vector
 *  icons replaced the old emoji set; the field name `emoji` survives for
 *  wire/profile compatibility. */
export const AVATAR_EMOJIS = [
  'dice', 'rocket', 'crown', 'ghost', 'cat', 'dog', 'bird', 'fish',
  'rabbit', 'turtle', 'squirrel', 'skull', 'star', 'zap', 'flame', 'gamepad',
];

/** UI-friendly alias for Color. */
export type PlayerColor = Color;

/** UI-friendly alias for CaptureEffect. */
export type CaptureEvent = CaptureEffect;

/** UI-friendly alias for GameMessage. */
export type ChatMessage = GameMessage;

/** PLAYER_CONFIG: UI-friendly config mapping color → display properties.
 *  Re-exports COLOR_CONFIG with renamed fields for the UI layer. */
export const PLAYER_CONFIG: Record<Color, {
  label: string;
  emoji: string;
  cssColor: string;
  cssLight: string;
  cssClass: string;
}> = {
  red: {
    label: COLOR_CONFIG.red.displayName,
    emoji: COLOR_CONFIG.red.emoji,
    cssColor: '#f0405c',
    cssLight: '#fb7185',
    cssClass: COLOR_CONFIG.red.cssClass,
  },
  green: {
    label: COLOR_CONFIG.green.displayName,
    emoji: COLOR_CONFIG.green.emoji,
    cssColor: '#26c165',
    cssLight: '#4ade80',
    cssClass: COLOR_CONFIG.green.cssClass,
  },
  yellow: {
    label: COLOR_CONFIG.yellow.displayName,
    emoji: COLOR_CONFIG.yellow.emoji,
    cssColor: '#f5a415',
    cssLight: '#fcd34d',
    cssClass: COLOR_CONFIG.yellow.cssClass,
  },
  blue: {
    label: COLOR_CONFIG.blue.displayName,
    emoji: COLOR_CONFIG.blue.emoji,
    cssColor: '#3d7bfa',
    cssLight: '#60a5fa',
    cssClass: COLOR_CONFIG.blue.cssClass,
  },
  purple: {
    label: COLOR_CONFIG.purple.displayName,
    emoji: COLOR_CONFIG.purple.emoji,
    cssColor: '#a855f7',
    cssLight: '#c4b5fd',
    cssClass: COLOR_CONFIG.purple.cssClass,
  },
  cyan: {
    label: COLOR_CONFIG.cyan.displayName,
    emoji: COLOR_CONFIG.cyan.emoji,
    cssColor: '#14b8a6',
    cssLight: '#5eead4',
    cssClass: COLOR_CONFIG.cyan.cssClass,
  },
};

/** Turn order = CLOCKWISE seating around the board (any rotation keeps
 *  the cycle clockwise): red TL → blue TR → yellow BR → green BL. Teams
 *  still alternate (red+yellow vs blue+green). */
export const PLAYER_COLORS_ORDER: Color[] = ['red', 'blue', 'yellow', 'green'];

/** Clockwise seating for the HEX board (6 arms from the top). */
export const HEX_COLORS_ORDER: Color[] = ['red', 'blue', 'yellow', 'green', 'purple', 'cyan'];

/** Seat order for ONLINE rooms (Ludo Club style): the first two seats taken
 *  are always diagonally-opposite corners (red ↔ yellow), never adjacent
 *  ("lateral") ones. A 3rd/4th joiner then fills the remaining corners. */
export const ONLINE_SEAT_ORDER: Color[] = ['red', 'yellow', 'blue', 'green'];
