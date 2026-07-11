import { create } from 'zustand';
import type { Color, Player, CaptureEffect, GameMessage } from '../game/types';
import { COLORS, COLOR_CONFIG, AVATAR_EMOJIS } from '../game/types';
import {
  rollDice,
  getMovablePieces,
  movePiece,
  advanceTurn,
  createInitialState,
  createPlayer,
  createId,
  addCaptureEffectToState,
  canPieceMove,
} from '../game/gameEngine';
import { getSquarePosition } from '../game/boardPath';
import { createBotPlayers, chooseBotMove, getBotReaction } from '../game/aiPlayer';
import {
  NO_MOVE_MESSAGES,
  WIN_MESSAGES,
  randomPick,
} from '../game/stickers';

interface GameStore {
  // State
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  phase: 'lobby' | 'rolling' | 'moving' | 'finished';
  winner: Color | null;
  messages: GameMessage[];
  captureEffects: CaptureEffect[];
  turnCount: number;
  consecutiveSixes: number;

  // Computed helpers (exposed for UI)
  currentPlayer: () => Player | undefined;
  movablePieceIds: () => string[];
  movablePieces: () => Player['pieces'];

  // Lobby
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  startGame: () => void;

  // Gameplay
  roll: () => void;
  selectPiece: (pieceId: string) => void;

  // Fun stuff
  addMessage: (text: string, sticker?: string) => void;
  addCaptureEffect: (x: number, y: number, type: CaptureEffect['type']) => void;
  clearCaptureEffects: () => void;

  // Internal
  _botTimeout: ReturnType<typeof setTimeout> | null;

  // Reset
  resetGame: () => void;
}

let autoMoveTimeout: ReturnType<typeof setTimeout> | null = null;
let botTurnTimeout: ReturnType<typeof setTimeout> | null = null;

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),

  // ─── Computed helpers ──────────────────────────────────────────────
  currentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    return players[currentPlayerIndex];
  },

  movablePieceIds: () => {
    const { players, currentPlayerIndex, diceValue } = get();
    const dice = diceValue ?? 0;
    if (dice === 0) return [];
    const player = players[currentPlayerIndex];
    if (!player) return [];
    return player.pieces
      .filter((p) => p.position !== 56)
      .filter((p) => {
        if (p.position === -1) return dice === 5 || dice === 6;
        return canPieceMove(p, dice, player.color);
      })
      .map((p) => p.id);
  },

  movablePieces: () => {
    const { diceValue } = get();
    const dice = diceValue ?? 0;
    if (dice === 0) return [];
    return getMovablePieces(
      { ...get(), diceValue: dice },
      dice,
    );
  },

  // ─── Lobby ─────────────────────────────────────────────────────────
  addPlayer: (name: string) => {
    const { players } = get();
    if (players.length >= 4) return;

    const usedColors = new Set(players.map((p) => p.color));
    const nextColor = COLORS.find((c) => !usedColors.has(c));
    if (!nextColor) return;

    // Pick a random emoji avatar
    const usedEmojis = new Set(players.map((p) => p.emoji));
    const availableEmojis = AVATAR_EMOJIS.filter((e) => !usedEmojis.has(e));
    const emoji = availableEmojis[Math.floor(Math.random() * availableEmojis.length)] || '🎲';

    const newPlayer = createPlayer(createId(), name, nextColor, emoji);

    set({
      players: [...players, newPlayer],
    });
  },

  removePlayer: (id: string) => {
    const { players } = get();
    if (get().phase !== 'lobby') return;
    set({ players: players.filter((p) => p.id !== id) });
  },

  startGame: () => {
    const { players } = get();
    if (players.length < 2) return;

    // Fill remaining slots with bots
    const bots = createBotPlayers(players);
    const allPlayers = [...players, ...bots];

    // Shuffle starting order
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);

    set({
      players: shuffled,
      currentPlayerIndex: 0,
      phase: 'rolling',
      diceValue: null,
      winner: null,
      turnCount: 1,
      consecutiveSixes: 0,
      messages: [
        {
          id: createId(),
          playerId: 'system',
          text: '¡¡¡EL JUEGO COMIENZA!!! 🎲🔥',
          timestamp: Date.now(),
        },
      ],
    });

    // Start bot turns if first player is a bot
    const state = get();
    if (state.players[state.currentPlayerIndex]?.isBot) {
      scheduleBotTurn(set, get);
    }
  },

  // ─── Gameplay ──────────────────────────────────────────────────────
  roll: () => {
    const { phase, currentPlayerIndex } = get();
    if (phase !== 'rolling') return;

    const currentPlayer = get().players[currentPlayerIndex];
    if (!currentPlayer) return;

    // Don't allow rolling during bot turns (handled automatically)
    if (currentPlayer.isBot) return;

    const value = rollDice();

    set({
      diceValue: value,
      phase: 'moving',
      messages: [
        ...get().messages,
        {
          id: createId(),
          playerId: currentPlayer.id,
          text: `🎲 Salió un ${value}`,
          timestamp: Date.now(),
        },
      ],
    });

    // Check if any pieces can move
    const movable = getMovablePieces({ ...get(), diceValue: value }, value);

    if (movable.length === 0) {
      // No valid moves
      const state = get();
      const nextMsg: GameMessage = {
        id: createId(),
        playerId: currentPlayer.id,
        text: randomPick(NO_MOVE_MESSAGES),
        timestamp: Date.now(),
      };

      set({
        messages: [...state.messages, nextMsg],
      });

      // Auto-advance after a short delay
      setTimeout(() => {
        const current = get();
        if (current.phase !== 'moving') return;
        const advanced = advanceTurn({ ...current });
        set(advanced);
        scheduleBotTurn(set, get);
      }, 1500);
    } else if (movable.length === 1) {
      // Auto-select the only movable piece after a short delay
      if (autoMoveTimeout) clearTimeout(autoMoveTimeout);
      autoMoveTimeout = setTimeout(() => {
        const current = get();
        if (current.phase !== 'moving') return;
        get().selectPiece(movable[0].id);
      }, 800);
    }
  },

  selectPiece: (pieceId: string) => {
    const { phase, diceValue, players, currentPlayerIndex } = get();
    if (phase !== 'moving' || diceValue === null) return;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) return;

    // Don't allow manual selection during bot turns
    if (currentPlayer.isBot) return;

    executeMove(set, get, pieceId);
  },

  // ─── Fun stuff ────────────────────────────────────────────────────
  addMessage: (text: string, sticker?: string) => {
    const { messages, currentPlayerIndex, players } = get();
    const currentPlayer = players[currentPlayerIndex];
    set({
      messages: [
        ...messages,
        {
          id: createId(),
          playerId: currentPlayer?.id ?? 'system',
          text,
          sticker,
          timestamp: Date.now(),
        },
      ],
    });
  },

  addCaptureEffect: (x: number, y: number, type: CaptureEffect['type']) => {
    const state = get();
    const newState = addCaptureEffectToState(state, x, y, type);
    set(newState);

    // Auto-clear effects after 2 seconds
    setTimeout(() => {
      set({ captureEffects: get().captureEffects.filter((e) => Date.now() - e.timestamp > 2000) });
    }, 2500);
  },

  clearCaptureEffects: () => {
    set({ captureEffects: [] });
  },

  // Internal
  _botTimeout: null,

  // ─── Reset ───────────────────────────────────────────────────────
  resetGame: () => {
    if (autoMoveTimeout) { clearTimeout(autoMoveTimeout); autoMoveTimeout = null; }
    if (botTurnTimeout) { clearTimeout(botTurnTimeout); botTurnTimeout = null; }
    set({
      ...createInitialState(),
    });
  },
}));

// ─── Internal Helpers ──────────────────────────────────────────────────

function executeMove(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  pieceId: string,
) {
  const state = get();
  const { diceValue } = state;
  if (diceValue === null) return;

  // Execute the move
  let newState = movePiece({ ...state }, pieceId, diceValue);

  // Check for captures and add effects
  if (newState.messages.length > state.messages.length) {
    const newMessages = newState.messages.slice(state.messages.length);
    for (const msg of newMessages) {
      // Check if any capture happened (new message contains capture keywords)
      const isCapture = msg.text.includes('BOOM') ||
        msg.text.includes('dormir') ||
        msg.text.includes('CASA') ||
        msg.text.includes('R.I.P') ||
        msg.text.includes('CAPTURADO') ||
        msg.text.includes('Eliminado') ||
        msg.text.includes('taxi');

      if (isCapture) {
        // Add capture effect at the piece's position
        const movedPiece = newState.players[state.currentPlayerIndex].pieces.find(
          (p) => p.id === pieceId,
        );
        if (movedPiece && movedPiece.position >= 0 && movedPiece.position < 52) {
          const pos = getSquarePosition(movedPiece.position);
          newState = addCaptureEffectToState(newState, pos.x, pos.y, 'capture');
        }
      }

      // Check for home arrival
      const isHome = msg.text.includes('casa') || msg.text.includes('Safe') || msg.text.includes('fiesta');
      if (isHome) {
        const pos = getSquarePosition(COLOR_CONFIG[state.players[state.currentPlayerIndex].color].entryIndex);
        newState = addCaptureEffectToState(newState, pos.x, pos.y, 'home');
      }
    }
  }

  // Check for win
  if (newState.phase === 'finished' && newState.winner) {
    const winnerPlayer = newState.players.find((p) => p.color === newState.winner);
    set({
      ...newState,
      messages: [
        ...newState.messages,
        {
          id: createId(),
          playerId: winnerPlayer?.id ?? 'system',
          text: randomPick(WIN_MESSAGES),
          timestamp: Date.now(),
        },
      ],
    });
    // Add win effects
    const winPos = getSquarePosition(COLOR_CONFIG[newState.winner as Color].entryIndex);
    newState = addCaptureEffectToState(newState, winPos.x, winPos.y, 'win');
    set(newState);
    return;
  }

  // Advance turn
  const advanced = advanceTurn(newState);
  set(advanced);

  // Schedule bot turn if next player is a bot
  scheduleBotTurn(set, get);
}

function scheduleBotTurn(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) {
  if (botTurnTimeout) clearTimeout(botTurnTimeout);

  // Delay before bot acts (simulate "thinking")
  botTurnTimeout = setTimeout(() => {
    const state = get();
    if (state.phase === 'finished') return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer?.isBot) return;

    // Bot rolls
    const value = rollDice();

    set({
      diceValue: value,
      phase: 'moving',
      messages: [
        ...state.messages,
        {
          id: createId(),
          playerId: currentPlayer.id,
          text: `🎲 ${currentPlayer.emoji} Salió un ${value}`,
          timestamp: Date.now(),
        },
      ],
    });

    // Check movable pieces
    const movable = getMovablePieces({ ...get(), diceValue: value }, value);

    if (movable.length === 0) {
      // No moves — add message and advance
      setTimeout(() => {
        const s = get();
        if (s.phase !== 'moving') return;
        set({
          messages: [
            ...s.messages,
            {
              id: createId(),
              playerId: currentPlayer.id,
              text: randomPick(NO_MOVE_MESSAGES),
              timestamp: Date.now(),
            },
          ],
        });
        setTimeout(() => {
          const current = get();
          if (current.phase !== 'moving') return;
          const advanced = advanceTurn({ ...current });
          set(advanced);
          scheduleBotTurn(set, get);
        }, 800);
      }, 600);
    } else {
      // Bot chooses a piece
      const chosen = chooseBotMove({ ...get(), diceValue: value }, value);
      if (chosen) {
        setTimeout(() => {
          executeMove(set, get, chosen);

          // Bot reaction after move
          const current = get();
          const reaction = getBotReaction();
          set({
            messages: [
              ...current.messages,
              {
                id: createId(),
                playerId: currentPlayer.id,
                text: reaction.text,
                sticker: reaction.sticker,
                timestamp: Date.now(),
              },
            ],
          });
        }, 800);
      }
    }
  }, 1200 + Math.random() * 800); // 1.2-2 second delay for natural feel
}
