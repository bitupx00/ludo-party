export type Color = 'red' | 'blue' | 'green' | 'yellow';

/** Game modes selectable from the home dashboard. */
export type GameMode = 'solo' | 'local' | 'teams' | 'online';

/** Team pairing for 2v2 mode: opposite corners play together. */
export const TEAMMATE: Record<Color, Color> = {
  red: 'yellow',
  yellow: 'red',
  green: 'blue',
  blue: 'green',
};

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
  /** When true (2v2 mode), teammates cannot capture each other. */
  teamsMode?: boolean;
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
};

export const AVATAR_EMOJIS = [
  '🎲', '🏃‍♂️', '🦊', '🐸', '🐱', '🦄', '🐝', '🎭',
  '👑', '🤖', '👽', '🐉', '🦁', '🦅', '🐹', '🐧',
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
};

export const PLAYER_COLORS_ORDER: Color[] = ['red', 'green', 'yellow', 'blue'];

/** Seat order for ONLINE rooms (Ludo Club style): the first two seats taken
 *  are always diagonally-opposite corners (red ↔ yellow), never adjacent
 *  ("lateral") ones. A 3rd/4th joiner then fills the remaining corners. */
export const ONLINE_SEAT_ORDER: Color[] = ['red', 'yellow', 'blue', 'green'];
