export type Color = 'red' | 'blue' | 'green' | 'yellow';

export interface Player {
  id: string;
  name: string;
  color: Color;
  emoji: string; // avatar emoji
  pieces: Piece[];
  isBot?: boolean;
}

export interface Piece {
  id: string;
  position: number; // -1=home, 0-51=board, 52-56=final stretch
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
}

export interface GameMessage {
  id: string;
  playerId: string;
  text: string;
  sticker?: string;
  timestamp: number;
}

export interface CaptureEffect {
  id: string;
  x: number;
  y: number;
  gifUrl: string;
  timestamp: number;
  type: 'capture' | 'safe' | 'home' | 'win';
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
    entryIndex: 13,
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
    entryIndex: 39,
    safeSquares: [0, 8, 13, 21, 26, 34, 39, 47],
    homeStretchStart: 52,
    homeStretchEnd: 56,
    emoji: '🔵',
    cssClass: 'player-blue',
    displayName: 'Azul',
  },
};

/** Position just before home stretch entry for each color. */
export const HOME_STRETCH_ENTRY: Record<Color, number> = {
  red: 50,   // index before re-entering home stretch (after going around)
  green: 11,
  yellow: 24,
  blue: 37,
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
    cssColor: '#FF4757',
    cssLight: '#FF6B81',
    cssClass: COLOR_CONFIG.red.cssClass,
  },
  green: {
    label: COLOR_CONFIG.green.displayName,
    emoji: COLOR_CONFIG.green.emoji,
    cssColor: '#2ED573',
    cssLight: '#7BED9F',
    cssClass: COLOR_CONFIG.green.cssClass,
  },
  yellow: {
    label: COLOR_CONFIG.yellow.displayName,
    emoji: COLOR_CONFIG.yellow.emoji,
    cssColor: '#FFA502',
    cssLight: '#ECCC68',
    cssClass: COLOR_CONFIG.yellow.cssClass,
  },
  blue: {
    label: COLOR_CONFIG.blue.displayName,
    emoji: COLOR_CONFIG.blue.emoji,
    cssColor: '#3742FA',
    cssLight: '#70A1FF',
    cssClass: COLOR_CONFIG.blue.cssClass,
  },
};

export const PLAYER_COLORS_ORDER: Color[] = ['red', 'green', 'yellow', 'blue'];
