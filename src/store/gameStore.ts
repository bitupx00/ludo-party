import { create } from 'zustand';
import type { Color, Player, CaptureEffect, GameMessage, GameMode } from '../game/types';
import { COLORS, COLOR_CONFIG, AVATAR_EMOJIS, PLAYER_COLORS_ORDER } from '../game/types';
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
import { createBotPlayers, chooseBotMove, getBotReaction, BOT_NAMES, BOT_EMOJIS } from '../game/aiPlayer';
import {
  NO_MOVE_MESSAGES,
  WIN_MESSAGES,
  randomPick,
} from '../game/stickers';

export type Screen = 'home' | 'lobby' | 'game';

export interface Reaction {
  emoji: string;
  key: number;
}

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
  teamsMode?: boolean;

  // Navigation / mode
  screen: Screen;
  gameMode: GameMode;
  /** Incremented on every dice roll (human or bot) so the 3D dice can animate. */
  rollSeq: number;
  /** Latest quick reaction per player id (bubble next to avatar). */
  reactions: Record<string, Reaction>;

  // Computed helpers (exposed for UI)
  currentPlayer: () => Player | undefined;
  movablePieceIds: () => string[];
  movablePieces: () => Player['pieces'];

  // Navigation
  openLobby: (mode: GameMode) => void;
  goHome: () => void;

  // Lobby
  addPlayer: (name: string) => void;
  addBotPlayer: () => void;
  removePlayer: (id: string) => void;
  startGame: () => void;

  // Gameplay
  roll: () => void;
  selectPiece: (pieceId: string) => void;

  // Fun stuff
  addMessage: (text: string, sticker?: string) => void;
  sendReaction: (emoji: string) => void;
  addCaptureEffect: (x: number, y: number, type: CaptureEffect['type']) => void;
  clearCaptureEffects: () => void;

  // Reset
  resetGame: () => void;
  playAgain: () => void;
}

let autoMoveTimeout: ReturnType<typeof setTimeout> | null = null;
let botTurnTimeout: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (autoMoveTimeout) { clearTimeout(autoMoveTimeout); autoMoveTimeout = null; }
  if (botTurnTimeout) { clearTimeout(botTurnTimeout); botTurnTimeout = null; }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...createInitialState(),
  teamsMode: false,
  screen: 'home',
  gameMode: 'solo',
  rollSeq: 0,
  reactions: {},

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

  // ─── Navigation ────────────────────────────────────────────────────
  openLobby: (mode: GameMode) => {
    clearTimers();
    set({
      ...createInitialState(),
      screen: 'lobby',
      gameMode: mode,
      teamsMode: mode === 'teams',
      reactions: {},
    });
  },

  goHome: () => {
    clearTimers();
    set({
      ...createInitialState(),
      screen: 'home',
      reactions: {},
    });
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

  addBotPlayer: () => {
    const { players } = get();
    if (players.length >= 4) return;

    const usedColors = new Set(players.map((p) => p.color));
    const nextColor = COLORS.find((c) => !usedColors.has(c));
    if (!nextColor) return;

    const botPlayer = createPlayer(
      createId(),
      BOT_NAMES[nextColor],
      nextColor,
      BOT_EMOJIS[nextColor],
      true,
    );

    set({
      players: [...players, botPlayer],
    });
  },

  removePlayer: (id: string) => {
    const { players } = get();
    if (get().phase !== 'lobby') return;
    set({ players: players.filter((p) => p.id !== id) });
  },

  startGame: () => {
    const { players, gameMode } = get();
    const humans = players.filter((p) => !p.isBot);

    // Solo/teams: 1 human is enough (bots fill the rest). Local: need 2+ players.
    if (gameMode === 'local' && players.length < 2) return;
    if (gameMode !== 'local' && humans.length < 1) return;

    const allPlayers = [...players];
    if (allPlayers.length < 4) {
      allPlayers.push(...createBotPlayers(allPlayers));
    }

    // Fixed turn order by color (red → green → yellow → blue) so teams alternate.
    const ordered = [...allPlayers].sort(
      (a, b) => PLAYER_COLORS_ORDER.indexOf(a.color) - PLAYER_COLORS_ORDER.indexOf(b.color),
    );

    set({
      players: ordered,
      currentPlayerIndex: 0,
      screen: 'game',
      phase: 'rolling',
      diceValue: null,
      winner: null,
      turnCount: 1,
      consecutiveSixes: 0,
      teamsMode: gameMode === 'teams',
      reactions: {},
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
      rollSeq: get().rollSeq + 1,
      messages: pushMessage(get().messages, {
          id: createId(),
          playerId: currentPlayer.id,
          text: `🎲 Salió un ${value}`,
          timestamp: Date.now(),
        }),
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
        messages: pushMessage(state.messages, nextMsg),
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
      }, 1200);
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
      messages: pushMessage(messages, {
          id: createId(),
          playerId: currentPlayer?.id ?? 'system',
          text,
          sticker,
          timestamp: Date.now(),
        }),
    });
  },

  sendReaction: (emoji: string) => {
    const { players, currentPlayerIndex } = get();
    // Attribute the reaction to the device holder: the current player if human,
    // otherwise the first human at the table.
    const current = players[currentPlayerIndex];
    const target = current && !current.isBot
      ? current
      : players.find((p) => !p.isBot) ?? current;
    if (!target) return;

    set((s) => ({
      reactions: { ...s.reactions, [target.id]: { emoji, key: Date.now() } },
      messages: pushMessage(s.messages, {
        id: createId(),
        playerId: target.id,
        text: emoji,
        sticker: emoji,
        timestamp: Date.now(),
      }),
    }));
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

  // ─── Reset ───────────────────────────────────────────────────────
  resetGame: () => {
    clearTimers();
    set({
      ...createInitialState(),
      screen: 'home',
      reactions: {},
    });
  },

  playAgain: () => {
    clearTimers();
    const { players, gameMode } = get();
    if (players.length === 0) {
      get().goHome();
      return;
    }

    const fresh = players.map((p) => ({
      ...p,
      pieces: p.pieces.map((piece) => ({
        ...piece,
        position: -1,
        isSafe: false,
        capturedCount: 0,
      })),
    }));

    set({
      players: fresh,
      currentPlayerIndex: 0,
      screen: 'game',
      phase: 'rolling',
      diceValue: null,
      winner: null,
      turnCount: 1,
      consecutiveSixes: 0,
      teamsMode: gameMode === 'teams',
      captureEffects: [],
      reactions: {},
      messages: [
        {
          id: createId(),
          playerId: 'system',
          text: '¡REVANCHA! 🔄🔥',
          timestamp: Date.now(),
        },
      ],
    });

    const state = get();
    if (state.players[state.currentPlayerIndex]?.isBot) {
      scheduleBotTurn(set, get);
    }
  },
}));

// ─── Internal Helpers ──────────────────────────────────────────────────

const MAX_MESSAGES = 100;
function pushMessage(existing: GameMessage[], msg: GameMessage): GameMessage[] {
  const next = [...existing, msg];
  return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
}

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
      messages: pushMessage(newState.messages, {
          id: createId(),
          playerId: winnerPlayer?.id ?? 'system',
          text: randomPick(WIN_MESSAGES),
          timestamp: Date.now(),
        }),
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
      rollSeq: get().rollSeq + 1,
      messages: pushMessage(state.messages, {
          id: createId(),
          playerId: currentPlayer.id,
          text: `🎲 ${currentPlayer.emoji} Salió un ${value}`,
          timestamp: Date.now(),
        }),
    });

    // Check movable pieces
    const movable = getMovablePieces({ ...get(), diceValue: value }, value);

    if (movable.length === 0) {
      // No moves — add message and advance
      setTimeout(() => {
        const s = get();
        if (s.phase !== 'moving') return;
        set({
          messages: pushMessage(s.messages, {
              id: createId(),
              playerId: currentPlayer.id,
              text: randomPick(NO_MOVE_MESSAGES),
              timestamp: Date.now(),
            }),
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

          // Bot reaction after move (sometimes, with an avatar bubble)
          if (Math.random() < 0.45) {
            const current = get();
            const reaction = getBotReaction();
            const bubbleEmoji = reaction.sticker ?? '😏';
            set({
              reactions: {
                ...current.reactions,
                [currentPlayer.id]: { emoji: bubbleEmoji, key: Date.now() },
              },
              messages: pushMessage(current.messages, {
                  id: createId(),
                  playerId: currentPlayer.id,
                  text: reaction.text,
                  sticker: reaction.sticker,
                  timestamp: Date.now(),
                }),
            });
          }
        }, 900);
      }
    }
  }, 1100 + Math.random() * 700); // ~1.1-1.8 second delay for natural feel
}
