import type { Color, GameState, Piece, Player, GameMessage, CaptureEffect } from './types';
import { COLOR_CONFIG, HOME_STRETCH_ENTRY, teammateOf } from './types';
import {
  HEX_RING_LEN, HEX_GOAL, HEX_ENTRY, HEX_LANE_ENTRANCE, HEX_SAFE_SQUARES,
} from './hex/boardPath6';

/* ── Ring parameters: classic 15×15 cross (52/57) vs hex board (78/84).
 *    Every movement rule below reads these instead of hardcoding the 4p
 *    numbers, so both boards share ONE engine. ── */
const SAFE_4P = [0, 8, 13, 21, 26, 34, 39, 47];
export function ringLen(hex?: boolean): number { return hex ? HEX_RING_LEN : 52; }
export function finishOf(hex?: boolean): number { return hex ? HEX_GOAL : 57; }
export function laneStartOf(hex?: boolean): number { return hex ? HEX_RING_LEN : 52; }
export function entryOf(color: Color, hex?: boolean): number {
  return hex ? HEX_ENTRY[color] : COLOR_CONFIG[color].entryIndex;
}
export function laneEntranceOf(color: Color, hex?: boolean): number {
  return hex ? HEX_LANE_ENTRANCE[color] : HOME_STRETCH_ENTRY[color];
}
export function isSafeCell(pos: number, hex?: boolean): boolean {
  return (hex ? HEX_SAFE_SQUARES : SAFE_4P).includes(pos);
}
/** Capture-group key for teams mode on either board. */
function teamKeyOf(color: Color, hex?: boolean): string {
  if (!hex) return color === 'red' || color === 'yellow' ? 'team-a' : 'team-b';
  return color === 'red' || color === 'green' ? 'team-a'
    : color === 'blue' || color === 'purple' ? 'team-b' : 'team-c';
}
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
  hex?: boolean,
): number {
  const L = ringLen(hex);
  const LANE = laneStartOf(hex);
  const FIN = finishOf(hex);

  // Entering the board from home (position -1)
  if (currentPos === -1) {
    return entryOf(color, hex);
  }

  // Already in the home lane; the goal itself is one MORE step
  if (currentPos >= LANE) {
    const newPos = currentPos + steps;
    if (newPos > FIN) return -2; // Cannot overshoot the goal
    return newPos;
  }

  // On the main ring
  const laneEntrance = laneEntranceOf(color, hex); // last ring square before the lane

  // Distance from current position to the lane entrance, clockwise.
  let distToHS: number;
  if (currentPos <= laneEntrance) {
    distToHS = laneEntrance - currentPos;
  } else {
    distToHS = (L - currentPos) + laneEntrance;
  }

  if (steps <= distToHS) {
    return (currentPos + steps) % L;
  }

  // steps > distToHS → enters the home lane
  const hsPosition = LANE + (steps - distToHS - 1);
  if (hsPosition > FIN) return -2; // Overshot the goal
  return hsPosition;
}

/** Can a piece in home (position -1) enter the board with this dice roll?
 *  House rule: a 6 OR a 1 lets a piece leave the base (both are the
 *  bonus numbers that also grant an extra roll). */
export function canEnterBoard(piece: Piece, diceValue: number): boolean {
  return piece.position === -1 && (diceValue === 6 || diceValue === 1);
}

/** Check if a piece can make a valid move with the given dice value. */
export function canPieceMove(piece: Piece, diceValue: number, color: Color, hex?: boolean): boolean {
  if (piece.position >= finishOf(hex)) return false; // Already home, can't move

  if (piece.position === -1) {
    return canEnterBoard(piece, diceValue);
  }

  const newPos = calculateNewPosition(piece.position, diceValue, color, hex);
  return newPos !== -2; // -2 means overshoot
}

// ─── Movable Pieces ──────────────────────────────────────────────────

/** All 4 pieces already in the goal? */
export function allPiecesFinished(player: Player, hex?: boolean): boolean {
  return player.pieces.every((p) => p.position >= finishOf(hex));
}

/** Teams (Ludo Club): once a player's own 4 pieces are home, on their
 *  turns they play their TEAMMATE's pieces to help the team finish.
 *  Returns whose pieces the current player controls this turn. */
export function controlledPlayer(state: GameState): Player | undefined {
  const current = state.players[state.currentPlayerIndex];
  if (!current) return undefined;
  if (state.teamsMode && allPiecesFinished(current, state.hexMode)) {
    const mate = state.players.find((p) => p.color === teammateOf(current.color, state.hexMode));
    if (mate && !allPiecesFinished(mate, state.hexMode)) return mate;
  }
  return current;
}

/**
 * Get all pieces the current player may move with the given dice value —
 * their own, or (teams, once finished) their teammate's.
 */
export function getMovablePieces(state: GameState, diceValue: number): Piece[] {
  const controlled = controlledPlayer(state);
  if (!controlled) return [];

  return controlled.pieces.filter((piece) =>
    canPieceMove(piece, diceValue, controlled.color, state.hexMode),
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
  if (piece.position < 0 || piece.position >= ringLen(state.hexMode)) return [];

  if (isSafeCell(piece.position, state.hexMode)) return [];

  const currentPlayer = state.players[state.currentPlayerIndex];

  // Group opponent pieces on this square by capture group
  // (their team in 2v2, otherwise their own color)
  const groups = new Map<string, Piece[]>();
  for (const player of state.players) {
    if (player.color === currentPlayer.color) continue;
    if (state.teamsMode && teammateOf(currentPlayer.color, state.hexMode) === player.color) continue;
    const groupKey = state.teamsMode
      ? teamKeyOf(player.color, state.hexMode)
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
      id: createId(),
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

  // Whose piece is this? Normally the current player's; in teams a
  // FINISHED player moves their teammate's pieces (Ludo Club assist).
  const controlled = controlledPlayer(state);
  if (!controlled) return state;
  const ownerIdx = state.players.findIndex((p) => p.id === controlled.id);
  const pieceIndex = controlled.pieces.findIndex((p) => p.id === pieceId);
  if (pieceIndex === -1) return state;

  const piece = controlled.pieces[pieceIndex];

  // Calculate new position (always along the piece OWNER's route)
  let newPos: number;
  if (piece.position === -1) {
    // Entering the board
    newPos = entryOf(controlled.color, state.hexMode);
  } else {
    newPos = calculateNewPosition(piece.position, diceValue, controlled.color, state.hexMode);
  }

  if (newPos === -2) return state; // Cannot move (overshoot)

  // Update piece position. Piezas Hermanas: every OWN piece stacked on
  // the starting square rides along to the same destination (a convoy).
  const convoy = new Set<string>([pieceId]);
  if (state.siblingMode && piece.position >= 0) {
    for (const p of controlled.pieces) {
      if (p.id !== pieceId && p.position === piece.position && p.position < finishOf(state.hexMode)) convoy.add(p.id);
    }
  }
  let newState: GameState = {
    ...state,
    players: state.players.map((player, idx) =>
      idx === ownerIdx
        ? {
            ...player,
            pieces: player.pieces.map((p) =>
              convoy.has(p.id)
                ? { ...p, position: newPos, isSafe: newPos >= laneStartOf(state.hexMode) || isSafeCell(newPos, state.hexMode) }
                : p,
            ),
          }
        : player,
    ),
  };

  // Add entry message
  const movedPiece = newState.players[ownerIdx].pieces[pieceIndex];
  if (piece.position === -1 && newPos >= 0) {
    newState = {
      ...newState,
      messages: [
        ...newState.messages,
        {
          id: createId(),
          playerId: currentPlayer.id,
          text: randomPick(ENTRY_MESSAGES),
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    };
  }

  // Check if piece reached home (the goal square)
  if (newPos === finishOf(state.hexMode)) {
    newState = {
      ...newState,
      messages: [
        ...newState.messages,
        {
          id: createId(),
          playerId: currentPlayer.id,
          text: randomPick(HOME_MESSAGES),
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    };
    // Check for win (teams: the WHOLE team's 8 pieces must be home)
    if (checkWin(newState, controlled.color)) {
      return {
        ...newState,
        phase: 'finished',
        winner: controlled.color,
      };
    }
    return newState;
  }

  // Check for captures (only on the main ring, not in the home lane)
  if (newPos >= 0 && newPos < ringLen(state.hexMode)) {
    const captured = checkCapture(newState, movedPiece);
    if (captured.length > 0) {
      newState = executeCapture(newState, captured);
    }
  }

  return newState;
}

// ─── Win Detection ───────────────────────────────────────────────────

/** Check for a win. Free-for-all: all 4 of the color's pieces home.
 *  Teams (Ludo Club): the ENTIRE team wins together — all 8 pieces of
 *  BOTH teammates must reach the goal, not just one player's. */
export function checkWin(state: GameState, color: Color): boolean {
  const player = state.players.find((p) => p.color === color);
  if (!player) return false;
  if (!allPiecesFinished(player, state.hexMode)) return false;
  if (state.teamsMode) {
    const mate = state.players.find((p) => p.color === teammateOf(color, state.hexMode));
    if (mate && !allPiecesFinished(mate, state.hexMode)) return false;
  }
  return true;
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
  // (any banked extra rolls are forfeited with it)
  if (rolledBonus && bonusInRow >= 3) {
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    return {
      ...state,
      currentPlayerIndex: nextIndex,
      phase: 'rolling',
      diceValue: null,
      consecutiveSixes: 0,
      pendingExtraRolls: 0,
      turnCount: state.turnCount + 1,
      messages: [
        ...state.messages,
        {
          id: createId(),
          playerId: state.players[state.currentPlayerIndex].id,
          text: '¡TRES TIRADAS EXTRA SEGUIDAS! Turno perdido por tramposo',
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    };
  }

  // Extra-roll credits: rolling a 6/1 earns one AND capturing/reaching the
  // goal earns another — they STACK (6 + kill = DOUBLE extra roll). One
  // credit is spent by staying on the turn now; the rest is banked in
  // pendingExtraRolls and keeps the turn alive on later rolls that earn
  // nothing on their own.
  const credits = (state.pendingExtraRolls ?? 0) + (rolledBonus ? 1 : 0) + (bonusRoll ? 1 : 0);
  if (credits > 0) {
    return {
      ...state,
      phase: 'rolling',
      diceValue: null,
      consecutiveSixes: bonusInRow,
      pendingExtraRolls: credits - 1,
      messages: rolledBonus
        ? [
            ...state.messages,
            {
              id: createId(),
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
    pendingExtraRolls: 0,
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
  // crypto.randomUUID needs iOS 15.4+ AND a secure context — older
  // iPhones/WebViews throw here, which broke EVERYTHING online (room
  // create/join died on the first generated id). Fall back to a
  // getRandomValues-based v4 (supported since iOS 7).
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    try { return c.randomUUID(); } catch { /* insecure context */ }
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
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
    pendingExtraRolls: 0,
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
