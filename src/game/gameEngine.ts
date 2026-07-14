import type { Color, GameState, Piece, Player, GameMessage, CaptureEffect } from './types';
import { COLOR_CONFIG, HOME_STRETCH_ENTRY, TEAMMATE } from './types';
import { getSquarePosition } from './boardPath';
import { randomPick, CAPTURE_MESSAGES, ENTRY_MESSAGES, HOME_MESSAGES, SIX_MESSAGES } from './stickers';

// ─── Dice ────────────────────────────────────────────────────────────

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

// ─── Lucky dice (points shop) ────────────────────────────────────────
// Players earn 1 point for every natural 6 or 1 they roll. Points buy a
// "lucky dice" of a chosen number: 50% chance the roll IS that number,
// 50% chance it lands one of the two numbers just below it (min 1).

/** Cost in points of each buyable lucky-dice number. The 1 and the 6 cost
 *  more because both grant an extra roll. */
export const LUCKY_DICE_COST: Record<number, number> = { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 4 };

/** Actual price for a player: the base cost plus +1 ⭐ for every lucky
 *  dice they already bought this match (escalating price). */
export function luckyCost(n: number, player: Pick<Player, 'luckyBuys'>): number {
  const base = LUCKY_DICE_COST[n];
  if (base === undefined) return Infinity;
  return base + (player.luckyBuys ?? 0);
}

/** True when the rolled value earns the roller a shop point. */
export function earnsPoint(value: number): boolean {
  return value === 6 || value === 1;
}

/** Weighted roll for a bought lucky dice of number `n`: 50% exactly `n`,
 *  50% one of the two numbers below it. The 1 has no lower numbers, so its
 *  other 50% falls on a 2 or a 3 instead. */
export function rollLuckyDice(n: number): number {
  if (Math.random() < 0.5) return n;
  const lower = [n - 1, n - 2].filter((v) => v >= 1);
  const pool = lower.length > 0 ? lower : [2, 3];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Check if rolling a 6 three times in a row should forfeit the turn. */
export function shouldForfeitTurn(consecutiveSixes: number): boolean {
  return consecutiveSixes >= 3;
}

/** Bonus numbers: a 6 OR a 1 grants an extra roll (a 1 still only moves one
 *  square). Three bonus rolls IN A ROW — any mix (1,1,6 / 6,6,1 / …) —
 *  forfeit the turn, so nobody chains extra rolls forever. */
export function isBonusRoll(value: number): boolean {
  return value === 6 || value === 1;
}

/** The goal (center triangle) is its own square: one step past the last
 *  home-stretch lane cell (56). */
export const FINISH_POS = 57;

// ─── Piece Movement Logic ────────────────────────────────────────────

/**
 * Calculate the new position of a piece after moving `steps` forward.
 *
 * Returns:
 *  - `>= 52`: home stretch lane (52–56) or the goal itself (57 = finished)
 *  - `0–51`: main board position (wrapped)
 *  - `-2`: cannot move (would overshoot the goal)
 *
 * @param currentPos - Current position of the piece (-1=home, 0-51=board, 52+=home stretch)
 * @param steps - Number of steps to move
 * @param color - Color of the piece (determines home stretch entry)
 */
export function calculateNewPosition(
  currentPos: number,
  steps: number,
  color: Color,
): number {
  // Entering the board from home (position -1)
  if (currentPos === -1) {
    return COLOR_CONFIG[color].entryIndex;
  }

  // Already in home stretch (52-56); the goal itself is one MORE step (57)
  if (currentPos >= 52) {
    const newPos = currentPos + steps;
    if (newPos > FINISH_POS) return -2; // Cannot overshoot the goal
    return newPos;
  }

  // On the main board (0-51)
  const homeStretchEntry = HOME_STRETCH_ENTRY[color]; // last board square before HS

  // Calculate distance from current position to the home stretch entry
  // going clockwise around the board.
  let distToHS: number;
  if (currentPos <= homeStretchEntry) {
    distToHS = homeStretchEntry - currentPos;
  } else {
    // Wrapping: need to go past 51 and back to 0
    distToHS = (52 - currentPos) + homeStretchEntry;
  }

  if (steps <= distToHS) {
    // Stays on the main board
    return (currentPos + steps) % 52;
  }

  // steps > distToHS → enters home stretch
  const hsPosition = 52 + (steps - distToHS - 1);
  if (hsPosition > FINISH_POS) return -2; // Overshot the goal
  return hsPosition;
}

/** Can a piece in home (position -1) enter the board with this dice roll?
 *  House rule: a 6 OR a 1 lets a piece leave the base (both are the
 *  bonus numbers that also grant an extra roll). */
export function canEnterBoard(piece: Piece, diceValue: number): boolean {
  return piece.position === -1 && (diceValue === 6 || diceValue === 1);
}

/** Check if a piece can make a valid move with the given dice value. */
export function canPieceMove(piece: Piece, diceValue: number, color: Color): boolean {
  if (piece.position >= FINISH_POS) return false; // Already home, can't move

  if (piece.position === -1) {
    return canEnterBoard(piece, diceValue);
  }

  const newPos = calculateNewPosition(piece.position, diceValue, color);
  return newPos !== -2; // -2 means overshoot
}

// ─── Movable Pieces ──────────────────────────────────────────────────

/**
 * Get all pieces of the current player that can move with the given dice value.
 */
export function getMovablePieces(state: GameState, diceValue: number): Piece[] {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return [];

  return currentPlayer.pieces.filter((piece) =>
    canPieceMove(piece, diceValue, currentPlayer.color),
  );
}

// ─── Capture Logic ───────────────────────────────────────────────────

/**
 * Opponent pieces the moved piece captures at its square (Ludo Club rules):
 * - Nothing is captured on safe squares (the 4 exits + the 4 stars).
 * - BLOCKS: 2+ pieces of the same owner (same TEAM in 2v2) on a square form
 *   a wall that cannot be captured — the mover just shares the square.
 * - Lone opponent pieces on the square are all captured.
 */
export function checkCapture(state: GameState, piece: Piece): Piece[] {
  if (piece.position < 0 || piece.position >= 52) return [];

  const GLOBAL_SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];
  if (GLOBAL_SAFE_SQUARES.includes(piece.position)) return [];

  const currentPlayer = state.players[state.currentPlayerIndex];

  // Group opponent pieces on this square by capture group
  // (their team in 2v2, otherwise their own color)
  const groups = new Map<string, Piece[]>();
  for (const player of state.players) {
    if (player.color === currentPlayer.color) continue;
    if (state.teamsMode && TEAMMATE[currentPlayer.color] === player.color) continue;
    const groupKey = state.teamsMode
      ? (player.color === 'red' || player.color === 'yellow' ? 'team-a' : 'team-b')
      : player.color;
    for (const opponentPiece of player.pieces) {
      if (opponentPiece.position === piece.position) {
        const list = groups.get(groupKey) ?? [];
        list.push(opponentPiece);
        groups.set(groupKey, list);
      }
    }
  }

  // Blocks (2+ pieces in a group) are safe; lone pieces get captured
  const captured: Piece[] = [];
  for (const pieces of groups.values()) {
    if (pieces.length === 1) captured.push(pieces[0]);
  }
  return captured;
}

/** Execute captures: send the captured pieces home and update state. */
export function executeCapture(
  state: GameState,
  captured: Piece[],
): GameState {
  if (captured.length === 0) return state;
  const capturedIds = new Set(captured.map((p) => p.id));

  const newMessages: GameMessage[] = [
    ...state.messages,
    {
      id: crypto.randomUUID(),
      playerId: state.players[state.currentPlayerIndex].id,
      text: randomPick(CAPTURE_MESSAGES),
      timestamp: Date.now(),
      kind: 'system',
    },
  ];

  return {
    ...state,
    messages: newMessages,
    players: state.players.map((player) => ({
      ...player,
      pieces: player.pieces.map((piece) =>
        capturedIds.has(piece.id)
          ? { ...piece, position: -1, capturedCount: piece.capturedCount + 1 }
          : piece,
      ),
    })),
  };
}

// ─── Move Execution ─────────────────────────────────────────────────

/**
 * Execute a move for a specific piece.
 * Returns the new game state after the move.
 */
export function movePiece(
  state: GameState,
  pieceId: string,
  diceValue: number,
): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) return state;

  const pieceIndex = currentPlayer.pieces.findIndex((p) => p.id === pieceId);
  if (pieceIndex === -1) return state;

  const piece = currentPlayer.pieces[pieceIndex];

  // Calculate new position
  let newPos: number;
  if (piece.position === -1) {
    // Entering the board
    newPos = COLOR_CONFIG[currentPlayer.color].entryIndex;
  } else {
    newPos = calculateNewPosition(piece.position, diceValue, currentPlayer.color);
  }

  if (newPos === -2) return state; // Cannot move (overshoot)

  // Update piece position
  let newState: GameState = {
    ...state,
    players: state.players.map((player, idx) =>
      idx === state.currentPlayerIndex
        ? {
            ...player,
            pieces: player.pieces.map((p) =>
              p.id === pieceId
                ? { ...p, position: newPos, isSafe: newPos >= 52 || [0, 8, 13, 21, 26, 34, 39, 47].includes(newPos) }
                : p,
            ),
          }
        : player,
    ),
  };

  // Add entry message
  const movedPiece = newState.players[newState.currentPlayerIndex].pieces[pieceIndex];
  if (piece.position === -1 && newPos >= 0) {
    newState = {
      ...newState,
      messages: [
        ...newState.messages,
        {
          id: crypto.randomUUID(),
          playerId: currentPlayer.id,
          text: randomPick(ENTRY_MESSAGES),
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    };
  }

  // Check if piece reached home (the goal, position 57)
  if (newPos === FINISH_POS) {
    newState = {
      ...newState,
      messages: [
        ...newState.messages,
        {
          id: crypto.randomUUID(),
          playerId: currentPlayer.id,
          text: randomPick(HOME_MESSAGES),
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    };
    // Check for win
    if (checkWin(newState, currentPlayer.color)) {
      return {
        ...newState,
        phase: 'finished',
        winner: currentPlayer.color,
      };
    }
    return newState;
  }

  // Check for captures (only on main board, not in home stretch)
  if (newPos >= 0 && newPos < 52) {
    const captured = checkCapture(newState, movedPiece);
    if (captured.length > 0) {
      newState = executeCapture(newState, captured);
    }
  }

  return newState;
}

// ─── Win Detection ───────────────────────────────────────────────────

/** Check if a player has won (all 4 pieces in the goal). */
export function checkWin(state: GameState, color: Color): boolean {
  const player = state.players.find((p) => p.color === color);
  if (!player) return false;
  return player.pieces.every((piece) => piece.position >= FINISH_POS);
}

// ─── Turn Management ─────────────────────────────────────────────────

/**
 * Advance to the next player's turn (Ludo Club rules):
 * - Rolling a 6 grants an extra roll — but the THIRD consecutive 6 forfeits the turn.
 * - A capture or getting a piece home also grants an extra roll (`bonusRoll`).
 * - Otherwise the next player goes.
 */
export function advanceTurn(state: GameState, bonusRoll = false): GameState {
  const rolledBonus = isBonusRoll(state.diceValue ?? 0);
  const bonusInRow = rolledBonus ? state.consecutiveSixes + 1 : 0;

  // Third consecutive bonus roll (any mix of 6s and 1s) → turn forfeited
  if (rolledBonus && bonusInRow >= 3) {
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    return {
      ...state,
      currentPlayerIndex: nextIndex,
      phase: 'rolling',
      diceValue: null,
      consecutiveSixes: 0,
      turnCount: state.turnCount + 1,
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          playerId: state.players[state.currentPlayerIndex].id,
          text: '¡TRES TIRADAS EXTRA SEGUIDAS! 🎲🎲🎲 Turno perdido por tramposo 😤',
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    };
  }

  // Extra roll: rolled a 6 or a 1, captured a piece, or brought a piece home
  if (rolledBonus || bonusRoll) {
    return {
      ...state,
      phase: 'rolling',
      diceValue: null,
      consecutiveSixes: bonusInRow,
      messages: rolledBonus
        ? [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              playerId: state.players[state.currentPlayerIndex].id,
              text: randomPick(SIX_MESSAGES),
              timestamp: Date.now(),
              kind: 'system',
            },
          ]
        : state.messages,
    };
  }

  // Normal turn advancement
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    phase: 'rolling',
    diceValue: null,
    consecutiveSixes: 0,
    turnCount: state.turnCount + 1,
  };
}

/** @deprecated kept for test compatibility — use advanceTurn. */
export function getNextPlayer(state: GameState): GameState {
  return advanceTurn(state);
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Create a unique ID for game entities. */
export function createId(): string {
  return crypto.randomUUID();
}

/** Create a new piece for a player. */
export function createPiece(playerId: string, _color: Color, index: number): Piece {
  return {
    id: `${playerId}-piece-${index}`,
    position: -1, // Start in home base
    isSafe: false,
    capturedCount: 0,
  };
}

/** Create a new player. */
export function createPlayer(
  id: string,
  name: string,
  color: Color,
  emoji: string,
  isBot = false,
): Player {
  return {
    id,
    name,
    color,
    emoji,
    pieces: Array.from({ length: 4 }, (_, i) => createPiece(id, color, i)),
    isBot,
    points: 0,
  };
}

/** Create initial game state for the lobby. */
export function createInitialState(): GameState {
  return {
    players: [],
    currentPlayerIndex: 0,
    diceValue: null,
    phase: 'lobby',
    winner: null,
    messages: [],
    captureEffects: [],
    turnCount: 0,
    consecutiveSixes: 0,
  };
}

/** Get the position coordinates of a board square (for effects). */
export function getBoardPosition(index: number): { x: number; y: number } {
  return getSquarePosition(index);
}

/** Add a capture effect to the state. */
export function addCaptureEffectToState(
  state: GameState,
  x: number,
  y: number,
  type: CaptureEffect['type'],
): GameState {
  return {
    ...state,
    captureEffects: [
      ...state.captureEffects,
      {
        id: createId(),
        x,
        y,
        gifUrl: `capture-${type}-${Date.now()}`,
        timestamp: Date.now(),
        type,
      },
    ],
  };
}

/** Remove expired capture effects (older than 2 seconds). */
export function cleanCaptureEffects(state: GameState): GameState {
  const now = Date.now();
  return {
    ...state,
    captureEffects: state.captureEffects.filter(
      (effect) => now - effect.timestamp < 2000,
    ),
  };
}
