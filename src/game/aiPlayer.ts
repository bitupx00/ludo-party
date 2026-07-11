import type { Color, GameState, Piece, Player } from './types';
import { COLORS, TEAMMATE } from './types';
import {
  canPieceMove,
  calculateNewPosition,
  createPlayer,
  createId,
} from './gameEngine';
import { randomPick, STICKERS, CAPTURE_MESSAGES } from './stickers';

export const BOT_NAMES: Record<Color, string> = {
  red: 'Rex',
  green: 'Kiwi',
  yellow: 'Sol',
  blue: 'Nube',
};

export const BOT_EMOJIS: Record<Color, string> = {
  red: '🦖',
  green: '🥝',
  yellow: '🌞',
  blue: '☁️',
};

/** Create bot players to fill missing slots (up to 4 total). */
export function createBotPlayers(existingPlayers: Player[]): Player[] {
  const usedColors = new Set(existingPlayers.map((p) => p.color));
  const availableColors = COLORS.filter((c) => !usedColors.has(c));
  const bots: Player[] = [];

  for (const color of availableColors) {
    bots.push(
      createPlayer(
        createId(),
        BOT_NAMES[color],
        color,
        BOT_EMOJIS[color],
        true,
      ),
    );
  }

  return bots;
}

/**
 * AI decision: which piece should the bot move?
 * Priority:
 * 1. Capture an opponent's piece
 * 2. Enter a new piece (if rolled 5 or 6 and pieces in home)
 * 3. Move the piece closest to home stretch entry (furthest along)
 * 4. Move a piece that would land on a safe square
 * 5. Move the first movable piece
 */
export function chooseBotMove(
  state: GameState,
  diceValue: number,
): string | null {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return null;

  const movable = currentPlayer.pieces.filter((piece) =>
    canPieceMove(piece, diceValue, currentPlayer.color),
  );

  if (movable.length === 0) return null;
  if (movable.length === 1) return movable[0].id;

  // Priority 1: Capture
  const capturePiece = findCaptureMove(state, currentPlayer, movable, diceValue);
  if (capturePiece) return capturePiece.id;

  // Priority 2: Enter new piece
  const entryPiece = movable.find((p) => p.position === -1);
  if (entryPiece) return entryPiece.id;

  // Priority 3: Reach home (the goal square)
  const homePiece = movable.find((p) => {
    if (p.position === -1) return false;
    const newPos = calculateNewPosition(p.position, diceValue, currentPlayer.color);
    return newPos === 57;
  });
  if (homePiece) return homePiece.id;

  // Priority 4: Enter home stretch (position 52-55)
  const hsPiece = movable.find((p) => {
    if (p.position === -1) return false;
    const newPos = calculateNewPosition(p.position, diceValue, currentPlayer.color);
    return newPos >= 52 && newPos <= 55;
  });
  if (hsPiece) return hsPiece.id;

  // Priority 5: Land on safe square
  const safePiece = movable.find((p) => {
    if (p.position === -1) return false;
    const newPos = calculateNewPosition(p.position, diceValue, currentPlayer.color);
    return newPos >= 0 && newPos < 52 && [0, 8, 13, 21, 26, 34, 39, 47].includes(newPos);
  });
  if (safePiece) return safePiece.id;

  // Priority 6: Move the furthest-advanced piece
  const sortedByProgress = [...movable].sort((a, b) => {
    // Pieces further along the board (higher position) are prioritized
    const progressA = a.position === -1 ? -1 : a.position;
    const progressB = b.position === -1 ? -1 : b.position;
    return progressB - progressA;
  });

  return sortedByProgress[0].id;
}

/** Find a piece that can capture an opponent (respecting safe cells and blocks). */
function findCaptureMove(
  state: GameState,
  currentPlayer: Player,
  movable: Piece[],
  diceValue: number,
): Piece | null {
  const GLOBAL_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

  for (const piece of movable) {
    if (piece.position === -1) continue;

    const newPos = calculateNewPosition(piece.position, diceValue, currentPlayer.color);
    if (newPos < 0 || newPos >= 52) continue;
    if (GLOBAL_SAFE.includes(newPos)) continue;

    // Group opponents at the target square: blocks (2+ per group) can't be captured
    const groups = new Map<string, number>();
    for (const player of state.players) {
      if (player.color === currentPlayer.color) continue;
      if (state.teamsMode && TEAMMATE[currentPlayer.color] === player.color) continue;
      const key = state.teamsMode
        ? (player.color === 'red' || player.color === 'yellow' ? 'team-a' : 'team-b')
        : player.color;
      for (const opponentPiece of player.pieces) {
        if (opponentPiece.position === newPos) {
          groups.set(key, (groups.get(key) ?? 0) + 1);
        }
      }
    }
    for (const count of groups.values()) {
      if (count === 1) return piece; // a lone piece is capturable
    }
  }
  return null;
}

/** Generate a random bot reaction message. */
export function getBotReaction(): { text: string; sticker?: string } {
  const roll = Math.random();

  if (roll < 0.3) {
    const sticker = randomPick(STICKERS);
    return {
      text: `${sticker.emoji} ${sticker.label}`,
      sticker: sticker.emoji,
    };
  }

  if (roll < 0.5) {
    const taunts = [
      '¡Ven a mi nivel! 😤',
      'Eso fue fácil 🧠',
      'Bot master race 🤖',
      'Calculando... ¡captura ejecutada! 💥',
      'Mi IA es mejor que tu suerte 🎯',
      'Error 404: compasión no encontrada 😈',
      'No es trampa, es inteligencia artificial 🧬',
    ];
    return { text: randomPick(taunts) };
  }

  return { text: randomPick(CAPTURE_MESSAGES) };
}
