import type { Color, GameState, Piece, Player, GameMessage, CaptureEffect } from './types';
import { COLOR_CONFIG, HOME_STRETCH_ENTRY, TEAMMATE } from './types';
import { getSquarePosition } from './boardPath';
import { randomPick, CAPTURE_MESSAGES, ENTRY_MESSAGES, HOME_MESSAGES, SIX_MESSAGES } from './stickers';

// ─── Dice ────────────────────────────────────────────────────────────

export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** Check if rolling a 6 three times in a row should forfeit the turn. */
export function shouldForfeitTurn(consecutiveSixes: number): boolean {
  return consecutiveSixes >= 3;
}

// ─── Piece Movement Logic ────────────────────────────────────────────

/**
 * Calculate the new position of a piece after moving `steps` forward.
 *
 * Returns:
 *  - `>= 52`: home stretch position (52–56, where 56 = finished/home)
 *  - `0–51`: main board position (wrapped)
 *  - `-2`: cannot move (would overshoot home)
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

  // Already in home stretch (52-56)
  if (currentPos >= 52) {
    const newPos = currentPos + steps;
    // Max home stretch position is 56 (home)
    if (newPos > 56) return -2; // Cannot overshoot
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
  if (hsPosition > 56) return -2; // Overshot home
  return hsPosition;
}

/** Can a piece in home (position -1) enter the board with this dice roll?
 *  Ludo Club rule: only a 6 lets a piece leave the base. */
export function canEnterBoard(piece: Piece, diceValue: number): boolean {
  return piece.position === -1 && diceValue === 6;
}

/** Check if a piece can make a valid move with the given dice value. */
export function canPieceMove(piece: Piece, diceValue: number, color: Color): boolean {
  if (piece.position === 56) return false; // Already home, can't move

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

/** Check if a piece at the given position can capture an opponent's piece. */
export function checkCapture(state: GameState, piece: Piece): Piece | null {
  if (piece.position < 0 || piece.position >= 52) return null;

  // Cannot capture on safe squares (global safe squares set)
  const GLOBAL_SAFE_SQUARES = [0, 8, 13, 21, 26, 34, 39, 47];
  if (GLOBAL_SAFE_SQUARES.includes(piece.position)) return null;

  const currentPlayer = state.players[state.currentPlayerIndex];

  // Look for opponent pieces at the same position
  for (const player of state.players) {
    if (player.color === currentPlayer.color) continue;
    if (state.teamsMode && TEAMMATE[currentPlayer.color] === player.color) continue;
    for (const opponentPiece of player.pieces) {
      if (opponentPiece.position === piece.position) {
        return opponentPiece;
      }
    }
  }
  return null;
}

/** Execute a capture: send the captured piece home and update state. */
export function executeCapture(
  state: GameState,
  captured: Piece,
  _capturer: Piece,
): GameState {
  const newMessages: GameMessage[] = [
    ...state.messages,
    {
      id: crypto.randomUUID(),
      playerId: state.players[state.currentPlayerIndex].id,
      text: randomPick(CAPTURE_MESSAGES),
      timestamp: Date.now(),
    },
  ];

  return {
    ...state,
    messages: newMessages,
    players: state.players.map((player) => ({
      ...player,
      pieces: player.pieces.map((piece) =>
        piece.id === captured.id
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
        },
      ],
    };
  }

  // Check if piece reached home (position 56)
  if (newPos === 56) {
    newState = {
      ...newState,
      messages: [
        ...newState.messages,
        {
          id: crypto.randomUUID(),
          playerId: currentPlayer.id,
          text: randomPick(HOME_MESSAGES),
          timestamp: Date.now(),
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

  // Check for capture (only on main board, not in home stretch)
  if (newPos >= 0 && newPos < 52) {
    const captured = checkCapture(newState, movedPiece);
    if (captured) {
      newState = executeCapture(newState, captured, movedPiece);
    }
  }

  return newState;
}

// ─── Win Detection ───────────────────────────────────────────────────

/** Check if a player has won (all 4 pieces at position 56). */
export function checkWin(state: GameState, color: Color): boolean {
  const player = state.players.find((p) => p.color === color);
  if (!player) return false;
  return player.pieces.every((piece) => piece.position === 56);
}

// ─── Turn Management ─────────────────────────────────────────────────

/**
 * Advance to the next player's turn (Ludo Club rules):
 * - Rolling a 6 grants an extra roll — but the THIRD consecutive 6 forfeits the turn.
 * - A capture or getting a piece home also grants an extra roll (`bonusRoll`).
 * - Otherwise the next player goes.
 */
export function advanceTurn(state: GameState, bonusRoll = false): GameState {
  const rolledSix = state.diceValue === 6;
  const sixesInRow = rolledSix ? state.consecutiveSixes + 1 : 0;

  // Third consecutive six → turn forfeited (even if the move captured something)
  if (rolledSix && sixesInRow >= 3) {
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
          text: '¡TRES SEISES! 🎲🎲🎲 Turno perdido por tramposo 😤',
          timestamp: Date.now(),
        },
      ],
    };
  }

  // Extra roll: rolled a 6, captured a piece, or brought a piece home
  if (rolledSix || bonusRoll) {
    return {
      ...state,
      phase: 'rolling',
      diceValue: null,
      consecutiveSixes: sixesInRow,
      messages: rolledSix
        ? [
            ...state.messages,
            {
              id: crypto.randomUUID(),
              playerId: state.players[state.currentPlayerIndex].id,
              text: randomPick(SIX_MESSAGES),
              timestamp: Date.now(),
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
