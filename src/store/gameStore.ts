import { create } from 'zustand';
import type { Color, Player, CaptureEffect, GameMessage, GameMode } from '../game/types';
import { COLORS, COLOR_CONFIG, AVATAR_EMOJIS, PLAYER_COLORS_ORDER, ONLINE_SEAT_ORDER, HOME_STRETCH_ENTRY } from '../game/types';
import {
  rollDice,
  rollLuckyDice,
  earnsPoint,
  isBonusRoll,
  LUCKY_DICE_COST,
  luckyCost,
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
  hostRoom,
  joinRoom,
  leaveRoom,
  sendActionToHost,
  generateRoomCode,
  setMyPlayerId,
} from '../online/onlineManager';
import { startAvSession, stopAvSession } from '../online/avManager';
import { ensureProfile } from '../profile';
import { playSfx } from '../sound';
import { STEP_DURATION } from '../game/anim';
import { buildMemeFx, MEME_FIRE_CHANCE, type MemeFx } from '../game/memeFx';
import type { MemeEventKind } from '../game/memeSounds';
import {
  NO_MOVE_MESSAGES,
  WIN_MESSAGES,
  CAPTURE_BONUS_MESSAGES,
  HOME_BONUS_MESSAGES,
  THREE_SIX_MESSAGES,
  randomPick,
} from '../game/stickers';

export type Screen = 'home' | 'lobby' | 'game' | 'ranking';

export type OnlineRole = 'none' | 'host' | 'guest';

export interface Reaction {
  emoji: string;
  key: number;
}

/** Fields mirrored from host to guests in online games. */
export const SNAPSHOT_KEYS = [
  'players',
  'currentPlayerIndex',
  'diceValue',
  'phase',
  'winner',
  'messages',
  'captureEffects',
  'turnCount',
  'consecutiveSixes',
  'teamsMode',
  'screen',
  'gameMode',
  'rollSeq',
  'reactions',
  'memeFx',
] as const;

export type GameSnapshot = Pick<GameStore, (typeof SNAPSHOT_KEYS)[number]>;

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
  /** System occasion effect (sound + gif on the piece involved), decided
   *  host-side with a 40% chance per occasion. Synced to guests. */
  memeFx: MemeFx | null;

  // Online multiplayer
  onlineRole: OnlineRole;
  roomCode: string | null;
  /** This device's player id (set in online games; null = shared device). */
  localPlayerId: string | null;
  /** i18n key of the last online error (shown in the lobby/home). */
  onlineError: string | null;
  onlineConnecting: boolean;
  /** Guest: the link to the host dropped and is being rebuilt in the background. */
  onlineReconnecting: boolean;

  // Computed helpers (exposed for UI)
  currentPlayer: () => Player | undefined;
  movablePieceIds: () => string[];
  movablePieces: () => Player['pieces'];

  // Navigation
  openLobby: (mode: GameMode) => void;
  goHome: () => void;
  /** Open the local ranking screen (from home only). */
  openRanking: () => void;

  // Online multiplayer
  createOnlineRoom: (hostName: string) => Promise<void>;
  joinOnlineRoom: (code: string, name: string) => Promise<void>;
  /** Host: seat a remote guest; returns the new player id (null if full). */
  addRemotePlayer: (name: string, points?: number) => string | null;
  /** Host: apply a validated action coming from a guest. */
  applyGuestAction: (playerId: string, action: { a: string; pieceId?: string; emoji?: string; text?: string; lucky?: number; color?: Color }) => void;
  /** Host: a guest disconnected — unseat (lobby) or convert to bot (game). */
  handleGuestLeft: (playerId: string) => void;
  /** Host: a disconnected guest came back (validated seat ticket) — give
   *  their seat back, flipping the bot substitute back to human. */
  reclaimSeat: (playerId: string, name?: string) => void;
  /** Guest: the host closed the room. */
  handleHostLeft: () => void;
  /** Guest: mirror a host snapshot. */
  _applySnapshot: (snap: GameSnapshot) => void;

  // Lobby
  addPlayer: (name: string, initialPoints?: number) => void;
  addBotPlayer: () => void;
  removePlayer: (id: string) => void;
  /** Move a player onto a FREE color seat (lobby only). Online: moves this
   *  device's own player (guests go through the host); local modes: moves
   *  the most recently added human. */
  changeSeat: (color: Color) => void;
  /** Host (online lobby): toggle 2v2 team play for the room. Requires 4
   *  human players to start; syncs to guests via the snapshot. */
  setTeamsMode: (on: boolean) => void;
  startGame: () => void;

  // Gameplay
  roll: () => void;
  /** Buy a lucky dice at ANY moment of the game: it arms for the buyer's
   *  next own roll (50% the chosen number, 50% a lower one). The price
   *  escalates +1 ⭐ per purchase; validated/deducted host-side. */
  buyLucky: (n: number) => void;
  selectPiece: (pieceId: string) => void;

  // Fun stuff
  addMessage: (text: string, sticker?: string) => void;
  sendReaction: (emoji: string) => void;
  sendChatMessage: (text: string) => void;
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
  memeFx: null,
  onlineRole: 'none',
  roomCode: null,
  localPlayerId: null,
  onlineError: null,
  onlineConnecting: false,
  onlineReconnecting: false,

  // ─── Computed helpers ──────────────────────────────────────────────
  currentPlayer: () => {
    const { players, currentPlayerIndex } = get();
    return players[currentPlayerIndex];
  },

  movablePieceIds: () => {
    const { players, currentPlayerIndex, diceValue, phase, consecutiveSixes } = get();
    const dice = diceValue ?? 0;
    if (dice === 0 || phase !== 'moving') return [];
    // Third consecutive bonus roll (6s/1s): play cancelled, nothing may move
    if (isBonusRoll(dice) && consecutiveSixes >= 2) return [];
    const player = players[currentPlayerIndex];
    if (!player) return [];
    return player.pieces
      .filter((p) => canPieceMove(p, dice, player.color))
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
    leaveRoom();
    stopAvSession();
    set({
      ...createInitialState(),
      screen: 'lobby',
      gameMode: mode,
      teamsMode: mode === 'teams',
      reactions: {},
      memeFx: null,
      onlineRole: 'none',
      roomCode: null,
      localPlayerId: null,
      onlineError: null,
      onlineConnecting: false,
      onlineReconnecting: false,
    });
  },

  openRanking: () => {
    if (get().screen !== 'home') return;
    set({ screen: 'ranking' });
  },

  goHome: () => {
    clearTimers();
    leaveRoom();
    stopAvSession();
    set({
      ...createInitialState(),
      screen: 'home',
      reactions: {},
      memeFx: null,
      onlineRole: 'none',
      roomCode: null,
      localPlayerId: null,
      onlineError: null,
      onlineConnecting: false,
      onlineReconnecting: false,
    });
  },

  // ─── Online multiplayer ────────────────────────────────────────────
  createOnlineRoom: async (hostName: string) => {
    const name = hostName.trim();
    if (!name) return;
    set({ onlineConnecting: true, onlineError: null });

    // Retry a few times on room-code collisions
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateRoomCode();
      try {
        await hostRoom(code);
        // Seat the host as the first player
        get().addPlayer(name);
        const hostPlayer = get().players[get().players.length - 1];
        set({
          onlineRole: 'host',
          roomCode: code,
          localPlayerId: hostPlayer?.id ?? null,
          onlineConnecting: false,
          onlineReconnecting: false,
          onlineError: null,
        });
        if (hostPlayer) setMyPlayerId(hostPlayer.id);
        startAvSession();
        return;
      } catch (err) {
        if ((err as Error).message === 'code-taken') continue;
        set({ onlineConnecting: false, onlineError: 'errConnection' });
        return;
      }
    }
    set({ onlineConnecting: false, onlineError: 'errConnection' });
  },

  joinOnlineRoom: async (code: string, name: string) => {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!trimmedCode || !trimmedName) return;
    ensureProfile(trimmedName); // guests carry their wallet into the room
    set({ onlineConnecting: true, onlineError: null });
    try {
      await joinRoom(trimmedCode, trimmedName);
      set({ onlineConnecting: false });
      startAvSession();
    } catch (err) {
      const reason = (err as Error).message;
      const key = reason === 'room-not-found' ? 'errRoomNotFound'
        : reason === 'room-full' ? 'errRoomFull'
        : reason === 'in-game' ? 'errInGame'
        : 'errConnection';
      set({ onlineConnecting: false, onlineError: key });
    }
  },

  addRemotePlayer: (name: string, points?: number) => {
    const { players } = get();
    if (players.length >= 4) return null;
    get().addPlayer(name.trim().slice(0, 24) || 'Jugador', points ?? 0);
    const added = get().players[get().players.length - 1];
    if (added) playSfx('join');
    return added?.id ?? null;
  },

  applyGuestAction: (playerId, action) => {
    const state = get();
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;

    if (action.a === 'reaction' && action.emoji) {
      // Sounds are system-only now — old clients' snd: reactions are dropped
      if (action.emoji.startsWith('snd:')) return;
      reactionFromPlayer(set, get, player, action.emoji.slice(0, 20));
      return;
    }
    if (action.a === 'buy' && action.lucky !== undefined) {
      // Not turn-bound: a lucky dice can be bought at any moment
      if (state.screen !== 'game' || state.phase === 'finished') return;
      applyLuckyPurchase(set, get, playerId, action.lucky);
      return;
    }
    if (action.a === 'chat' && action.text) {
      chatFromPlayer(set, get, player, action.text);
      return;
    }
    if (action.a === 'seat' && action.color) {
      if (state.screen !== 'lobby') return;
      if (state.players.some((p) => p.color === action.color)) return; // taken
      set({ players: state.players.map((p) => (p.id === playerId ? { ...p, color: action.color! } : p)) });
      return;
    }

    // Turn-bound actions: only the current player may roll/move
    const current = state.players[state.currentPlayerIndex];
    if (!current || current.id !== playerId) return;

    if (action.a === 'roll') {
      doRoll(set, get);
    } else if (action.a === 'select' && action.pieceId) {
      if (state.phase !== 'moving' || state.diceValue === null) return;
      if (isBonusRoll(state.diceValue) && state.consecutiveSixes >= 2) return; // third bonus roll: cancelled
      const owns = player.pieces.some((p) => p.id === action.pieceId);
      if (!owns) return;
      executeMove(set, get, action.pieceId);
    }
  },

  handleGuestLeft: (playerId: string) => {
    const state = get();
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;
    playSfx('leave');

    if (state.screen === 'lobby') {
      set({ players: state.players.filter((p) => p.id !== playerId) });
      return;
    }

    // Mid-game: the seat becomes a bot so the game can continue
    if (state.phase === 'finished') return;
    set({
      players: state.players.map((p) =>
        p.id === playerId
          ? { ...p, isBot: true, name: `${p.name} 🤖`, emoji: BOT_EMOJIS[p.color] }
          : p,
      ),
      messages: pushMessage(state.messages, {
        id: createId(),
        playerId: 'system',
        text: `📴 ${player.name} se desconectó — ahora juega un bot`,
        timestamp: Date.now(),
        kind: 'system',
      }),
    });

    // If it was their turn, let the bot take over
    const after = get();
    const current = after.players[after.currentPlayerIndex];
    if (current?.id === playerId) {
      if (after.phase === 'rolling') {
        scheduleBotTurn(set, get);
      } else if (after.phase === 'moving' && after.diceValue !== null) {
        const chosen = chooseBotMove({ ...after, diceValue: after.diceValue }, after.diceValue);
        if (chosen) {
          setTimeout(() => {
            const s = get();
            if (s.phase === 'moving') executeMove(set, get, chosen);
          }, 800);
        } else {
          const advanced = advanceTurn({ ...after });
          set(advanced);
          scheduleBotTurn(set, get);
        }
      }
    }
  },

  reclaimSeat: (playerId: string, name?: string) => {
    const state = get();
    const player = state.players.find((p) => p.id === playerId);
    if (!player) return;
    playSfx('join');

    // Nothing to restore if the seat never got botified (very fast rejoin
    // where the old link hadn't dropped yet) — just keep playing.
    if (!player.isBot) return;

    const cleanName = name?.trim().slice(0, 24) || player.name.replace(/ 🤖$/, '');
    // Give them back a human avatar (the original was replaced by the bot's)
    const usedEmojis = new Set(state.players.filter((p) => p.id !== playerId).map((p) => p.emoji));
    const available = AVATAR_EMOJIS.filter((e) => !usedEmojis.has(e));
    const emoji = available[Math.floor(Math.random() * available.length)] || '🎲';

    set({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, isBot: false, name: cleanName, emoji } : p,
      ),
      messages: pushMessage(state.messages, {
        id: createId(),
        playerId: 'system',
        text: `🔌 ${cleanName} se reconectó`,
        timestamp: Date.now(),
        kind: 'system',
      }),
    });
  },

  handleHostLeft: () => {
    clearTimers();
    stopAvSession();
    set({
      ...createInitialState(),
      screen: 'home',
      reactions: {},
      memeFx: null,
      onlineRole: 'none',
      roomCode: null,
      localPlayerId: null,
      onlineError: 'errHostLeft',
      onlineConnecting: false,
      onlineReconnecting: false,
    });
  },

  _applySnapshot: (snap: GameSnapshot) => {
    set({ ...snap });
  },

  // ─── Lobby ─────────────────────────────────────────────────────────
  addPlayer: (name: string, initialPoints?: number) => {
    const { players, gameMode } = get();
    if (players.length >= 4) return;

    // Online seating always fills diagonally-opposite corners first (Ludo
    // Club style) so a 2-player game never sits its players side by side.
    const seatOrder = gameMode === 'online' ? ONLINE_SEAT_ORDER : COLORS;
    const usedColors = new Set(players.map((p) => p.color));
    const nextColor = seatOrder.find((c) => !usedColors.has(c));
    if (!nextColor) return;

    // Pick a random emoji avatar
    const usedEmojis = new Set(players.map((p) => p.emoji));
    const availableEmojis = AVATAR_EMOJIS.filter((e) => !usedEmojis.has(e));
    const emoji = availableEmojis[Math.floor(Math.random() * availableEmojis.length)] || '🎲';

    // Persistent ⭐ wallet: the first human seated on this device is the
    // device's own player — their profile wallet funds their in-game
    // points. Remote guests bring their own (initialPoints, from their
    // join message); extra pass-and-play humans start at 0.
    const isOwnSeat = initialPoints === undefined && !players.some((p) => !p.isBot);
    const points = initialPoints !== undefined
      ? Math.max(0, Math.min(99999, Math.round(initialPoints)))
      : isOwnSeat
        ? ensureProfile(name).points
        : 0;

    const newPlayer = { ...createPlayer(createId(), name, nextColor, emoji), points };

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

  changeSeat: (color: Color) => {
    const { players, screen, onlineRole, localPlayerId } = get();
    if (screen !== 'lobby') return;
    if (players.some((p) => p.color === color)) return; // seat taken

    if (onlineRole === 'guest') {
      sendActionToHost({ a: 'seat', color });
      return;
    }
    // Online host → own player; local modes → most recently added human
    const target = onlineRole === 'host'
      ? players.find((p) => p.id === localPlayerId)
      : [...players].reverse().find((p) => !p.isBot);
    if (!target) return;
    playSfx('click');
    set({ players: players.map((p) => (p.id === target.id ? { ...p, color } : p)) });
  },

  setTeamsMode: (on: boolean) => {
    const { screen, gameMode, onlineRole } = get();
    if (screen !== 'lobby' || gameMode !== 'online') return;
    if (onlineRole !== 'host') return; // guests just mirror the snapshot
    set({ teamsMode: on });
  },

  startGame: () => {
    const { players, gameMode, onlineRole } = get();
    const humans = players.filter((p) => !p.isBot);

    // Online: only the host starts the game
    if (onlineRole === 'guest') return;

    // Solo: 1 human is enough (bots fill the rest). Local: need 2+ players.
    // Online: always human-only — needs 2+ real players, remaining seats stay empty.
    // Teams 2v2 (local mode or online toggle): HUMANS ONLY, all 4 seats.
    const isTeamsGame = gameMode === 'teams' || (gameMode === 'online' && get().teamsMode === true);
    if (isTeamsGame && humans.length < 4) return;
    if (gameMode === 'local' && players.length < 2) return;
    if (gameMode === 'online' && humans.length < 2) return;
    if (gameMode !== 'local' && gameMode !== 'online' && humans.length < 1) return;

    const allPlayers = [...players];
    if (gameMode !== 'online' && gameMode !== 'teams' && allPlayers.length < 4) {
      allPlayers.push(...createBotPlayers(allPlayers));
    }

    // Fixed turn order by color (red → green → yellow → blue) so teams alternate.
    // Shop points are a persistent wallet — they carry across matches; the
    // per-match fields (kills, price escalation, armed dice) reset here.
    const ordered = [...allPlayers]
      .sort((a, b) => PLAYER_COLORS_ORDER.indexOf(a.color) - PLAYER_COLORS_ORDER.indexOf(b.color))
      .map((p) => ({ ...p, kills: 0, luckyBuys: 0, pendingLucky: null }));

    set({
      players: ordered,
      currentPlayerIndex: 0,
      screen: 'game',
      phase: 'rolling',
      diceValue: null,
      winner: null,
      turnCount: 1,
      consecutiveSixes: 0,
      teamsMode: gameMode === 'teams' || (gameMode === 'online' && get().teamsMode === true),
      reactions: {},
      memeFx: null,
          messages: [
        {
          id: createId(),
          playerId: 'system',
          text: '¡¡¡EL JUEGO COMIENZA!!! 🎲🔥',
          timestamp: Date.now(),
          kind: 'system',
        },
      ],
    });

    // Match-opener meme (same 40% chance as every occasion). Fired a beat
    // AFTER the screen switch so the game screen is mounted and hears it.
    setTimeout(() => {
      const s = get();
      if (s.screen !== 'game' || s.phase === 'finished') return;
      if (Math.random() < MEME_FIRE_CHANCE) {
        set({ memeFx: buildMemeFx('gameStart', s.memeFx?.key ?? 0, { position: 57, color: 'red' }, 0) });
      }
    }, 900);

    // Start bot turns if first player is a bot
    const state = get();
    if (state.players[state.currentPlayerIndex]?.isBot) {
      scheduleBotTurn(set, get);
    }
  },

  // ─── Gameplay ──────────────────────────────────────────────────────
  roll: () => {
    const { phase, currentPlayerIndex, players, onlineRole, localPlayerId } = get();
    if (phase !== 'rolling') return;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isBot) return;

    // Online: only the owner of the current turn may roll
    if (onlineRole === 'guest') {
      if (currentPlayer.id === localPlayerId) sendActionToHost({ a: 'roll' });
      return;
    }
    if (onlineRole === 'host' && currentPlayer.id !== localPlayerId) return;

    doRoll(set, get);
  },

  buyLucky: (n: number) => {
    const { screen, phase, onlineRole } = get();
    if (screen !== 'game' || phase === 'finished') return;
    if (LUCKY_DICE_COST[n] === undefined) return;

    // Guests ask the host (host validates points/pending); any moment is
    // fine — the dice arms for the buyer's NEXT own roll.
    if (onlineRole === 'guest') {
      sendActionToHost({ a: 'buy', lucky: n });
      return;
    }
    const buyer = deviceHolder(get());
    if (!buyer || buyer.isBot) return;
    applyLuckyPurchase(set, get, buyer.id, n);
  },

  selectPiece: (pieceId: string) => {
    const { phase, diceValue, players, currentPlayerIndex, onlineRole, localPlayerId, consecutiveSixes } = get();
    if (phase !== 'moving' || diceValue === null) return;
    if (isBonusRoll(diceValue) && consecutiveSixes >= 2) return; // third bonus roll: cancelled

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer || currentPlayer.isBot) return;

    // Online: only the owner of the current turn may move
    if (onlineRole === 'guest') {
      if (currentPlayer.id === localPlayerId) sendActionToHost({ a: 'select', pieceId });
      return;
    }
    if (onlineRole === 'host' && currentPlayer.id !== localPlayerId) return;

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
    if (get().onlineRole === 'guest') {
      sendActionToHost({ a: 'reaction', emoji });
      return;
    }
    const target = deviceHolder(get());
    if (!target) return;
    reactionFromPlayer(set, get, target, emoji);
  },

  sendChatMessage: (text: string) => {
    if (!text.trim()) return;
    if (get().onlineRole === 'guest') {
      sendActionToHost({ a: 'chat', text: text.trim().slice(0, 200) });
      return;
    }
    const target = deviceHolder(get());
    if (!target) return;
    playSfx('chat');
    chatFromPlayer(set, get, target, text);
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
    leaveRoom();
    stopAvSession();
    set({
      ...createInitialState(),
      screen: 'home',
      reactions: {},
      memeFx: null,
      onlineRole: 'none',
      roomCode: null,
      localPlayerId: null,
      onlineError: null,
      onlineConnecting: false,
      onlineReconnecting: false,
    });
  },

  playAgain: () => {
    const { players, gameMode, onlineRole } = get();
    // Online: only the host restarts; guests follow via snapshot
    if (onlineRole === 'guest') return;
    clearTimers();
    if (players.length === 0) {
      get().goHome();
      return;
    }

    const fresh = players.map((p) => ({
      ...p,
      kills: 0,
      luckyBuys: 0,
      pendingLucky: null,
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
      teamsMode: gameMode === 'teams' || (gameMode === 'online' && get().teamsMode === true),
      captureEffects: [],
      reactions: {},
      memeFx: null,
          messages: [
        {
          id: createId(),
          playerId: 'system',
          text: '¡REVANCHA! 🔄🔥',
          timestamp: Date.now(),
          kind: 'system',
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

/** Who holds the device: the identified local player (online), else the
 *  current player if human, else the first human (pass & play). */
function deviceHolder(state: GameStore): Player | undefined {
  if (state.localPlayerId) {
    const me = state.players.find((p) => p.id === state.localPlayerId);
    if (me) return me;
  }
  const current = state.players[state.currentPlayerIndex];
  if (current && !current.isBot) return current;
  return state.players.find((p) => !p.isBot) ?? current;
}

function reactionFromPlayer(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  _get: () => GameStore,
  player: Player,
  emoji: string,
) {
  set((s) => ({
    reactions: { ...s.reactions, [player.id]: { emoji, key: Date.now() } },
    messages: pushMessage(s.messages, {
      id: createId(),
      playerId: player.id,
      text: emoji,
      sticker: emoji,
      timestamp: Date.now(),
      kind: 'chat',
    }),
  }));
}

function chatFromPlayer(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  _get: () => GameStore,
  player: Player,
  text: string,
) {
  const trimmed = text.trim();
  if (!trimmed) return;
  set((s) => ({
    messages: pushMessage(s.messages, {
      id: createId(),
      playerId: player.id,
      text: trimmed.slice(0, 200),
      timestamp: Date.now(),
      kind: 'chat',
    }),
  }));
}

/** Main-track squares strictly BETWEEN from and to along a color's route
 *  (excludes the landing square) — used to detect "passed an enemy". */
function routeSquaresBetween(from: number, to: number, color: Color): number[] {
  if (from < 0 || from >= 52) return [];
  const squares: number[] = [];
  let p = from;
  for (let guard = 0; guard < 8 && p !== to; guard++) {
    p = p >= 52 ? p + 1 : p === HOME_STRETCH_ENTRY[color] ? 52 : (p + 1) % 52;
    if (p !== to && p >= 0 && p < 52) squares.push(p);
  }
  return squares;
}

/** Detect the most significant meme occasion of a resolved move. Returns
 *  the occasion plus where to anchor the gif (logical board position). */
function detectMemeOccasion(args: {
  state: GameStore;
  mover: Player;
  movedBefore: { position: number };
  movedAfter: { position: number };
  diceValue: number;
  captured: boolean;
  victim: Player | null;
  reachedHome: boolean;
  isWin: boolean;
}): { kind: MemeEventKind; position: number; color: Color } | null {
  const { state, mover, movedBefore, movedAfter, diceValue, captured, victim, reachedHome, isWin } = args;
  const landed = movedAfter.position;

  if (isWin) return { kind: 'teamWin', position: 57, color: mover.color };
  if (reachedHome) return { kind: 'goal', position: 57, color: mover.color };
  if (captured) {
    // Randomly let the killer brag or the victim cry
    return Math.random() < 0.5
      ? { kind: 'kill', position: landed, color: mover.color }
      : { kind: 'death', position: landed, color: victim?.color ?? mover.color };
  }

  // Enemies on squares the piece walked OVER (not the landing square)
  const isEnemy = (p: Player) =>
    p.color !== mover.color && !(state.teamsMode && TEAMMATE_SAFE[mover.color] === p.color);
  const walked = new Set(routeSquaresBetween(movedBefore.position, landed, mover.color));
  let passedSquare = -1;
  for (const p of state.players) {
    if (!isEnemy(p)) continue;
    for (const piece of p.pieces) {
      if (walked.has(piece.position)) { passedSquare = piece.position; break; }
    }
  }

  if (diceValue === 6 && passedSquare >= 0) {
    return { kind: 'escape', position: landed, color: mover.color };
  }

  if (landed >= 0 && landed < 52) {
    // Landed on an enemy color's entry square
    const entries: Array<[Color, number]> = [['red', 0], ['blue', 13], ['yellow', 26], ['green', 39]];
    const enemyEntry = entries.find(([c, sq]) => sq === landed && c !== mover.color);
    if (enemyEntry) return { kind: 'enemyEntry', position: landed, color: mover.color };

    // Sharing the landing square: with enemies (uncapturable = block) or
    // with own pieces (stack)
    let enemyOnSquare = false;
    let ownOnSquare = false;
    for (const p of state.players) {
      for (const piece of p.pieces) {
        if (piece.position !== landed) continue;
        if (p.color === mover.color) ownOnSquare = true;
        else if (isEnemy(p)) enemyOnSquare = true;
      }
    }
    if (enemyOnSquare) return { kind: 'block', position: landed, color: mover.color };
    if (ownOnSquare) return { kind: 'ownStack', position: landed, color: mover.color };
  }

  if (movedBefore.position >= 0 && movedBefore.position < 52 && landed >= 52 && landed < 57) {
    return { kind: 'homeLane', position: landed, color: mover.color };
  }

  if (passedSquare >= 0) {
    return Math.random() < 0.5
      ? { kind: 'passMover', position: landed, color: mover.color }
      : { kind: 'passSurvivor', position: passedSquare, color: mover.color };
  }

  return null;
}

/** Teams pairing (duplicated tiny map to avoid importing TEAMMATE here
 *  twice — red+yellow vs green+blue). */
const TEAMMATE_SAFE: Record<Color, Color> = { red: 'yellow', yellow: 'red', green: 'blue', blue: 'green' };

/** Ludo Club rule: the THIRD consecutive six cancels the play entirely —
 *  no piece moves, the turn passes to the next player. */
function cancelThirdSix(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  playerId: string,
) {
  set({
    messages: pushMessage(get().messages, {
      id: createId(),
      playerId,
      text: randomPick(THREE_SIX_MESSAGES),
      timestamp: Date.now(),
      kind: 'system',
    }),
  });
  setTimeout(() => {
    const current = get();
    if (current.phase !== 'moving') return;
    set({
      currentPlayerIndex: (current.currentPlayerIndex + 1) % current.players.length,
      phase: 'rolling',
      diceValue: null,
      consecutiveSixes: 0,
      turnCount: current.turnCount + 1,
    });
    scheduleBotTurn(set, get);
  }, 1600);
}

/** Validate and apply a lucky-dice purchase (host-authoritative): deducts
 *  the escalated cost, bumps the escalation counter and ARMS the dice for
 *  the buyer's next own roll. One armed dice at a time. */
function applyLuckyPurchase(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  playerId: string,
  n: number,
) {
  const player = get().players.find((p) => p.id === playerId);
  if (!player || player.isBot) return;
  if (player.pendingLucky) return; // already armed — use it first
  const cost = luckyCost(n, player);
  if ((player.points ?? 0) < cost) return;
  set((s) => ({
    players: s.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            points: Math.max(0, (p.points ?? 0) - cost),
            luckyBuys: (p.luckyBuys ?? 0) + 1,
            pendingLucky: n,
          }
        : p,
    ),
  }));
}

/** Add/subtract lucky-dice shop points for a player. */
function adjustPoints(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  playerId: string,
  delta: number,
) {
  set((state) => ({
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, points: Math.max(0, (p.points ?? 0) + delta) } : p,
    ),
  }));
}

/** Roll the dice for the current (human) player and resolve the aftermath.
 *  If the player has an ARMED lucky dice (bought in the shop at any point
 *  before this roll), the roll uses the 50/50 weighted distribution for
 *  that number and the armed dice is consumed. */
function doRoll(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
) {
  const { currentPlayerIndex } = get();
  const currentPlayer = get().players[currentPlayerIndex];
  if (!currentPlayer) return;

  let value: number;
  const armed = currentPlayer.pendingLucky;
  if (armed && LUCKY_DICE_COST[armed] !== undefined) {
    value = rollLuckyDice(armed);
    // Consume the armed dice (it was already paid for at purchase time)
    set((s) => ({
      players: s.players.map((p) =>
        p.id === currentPlayer.id ? { ...p, pendingLucky: null } : p,
      ),
    }));
  } else {
    value = rollDice();
  }
  // Every 6 or 1 rolled earns a shop point
  if (earnsPoint(value)) adjustPoints(set, currentPlayer.id, 1);

  const isThirdSix = isBonusRoll(value) && get().consecutiveSixes >= 2;

  set({
    diceValue: value,
    phase: 'moving',
    rollSeq: get().rollSeq + 1,
    messages: pushMessage(get().messages, {
        id: createId(),
        playerId: currentPlayer.id,
        text: `🎲 Salió un ${value}`,
        timestamp: Date.now(),
        kind: 'system',
      }),
    });

  // Third consecutive six: the play is cancelled, nothing moves
  if (isThirdSix) {
    cancelThirdSix(set, get, currentPlayer.id);
    return;
  }

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
      kind: 'system',
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
    // Auto-select the only movable piece after a short delay — always AFTER
    // the dice reveal animation (~1000ms) so the move never starts before
    // the player has seen what they rolled.
    if (autoMoveTimeout) clearTimeout(autoMoveTimeout);
    autoMoveTimeout = setTimeout(() => {
      const current = get();
      if (current.phase !== 'moving') return;
      executeMove(set, get, movable[0].id);
    }, 1400);
  }
}

function executeMove(
  set: (partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore>)) => void,
  get: () => GameStore,
  pieceId: string,
) {
  const state = get();
  const { diceValue, currentPlayerIndex } = state;
  if (diceValue === null) return;

  const movedBefore = state.players[currentPlayerIndex]?.pieces.find((p) => p.id === pieceId);
  if (!movedBefore) return;

  // Execute the move
  let newState = movePiece({ ...state }, pieceId, diceValue);
  const movedAfter = newState.players[currentPlayerIndex].pieces.find((p) => p.id === pieceId);

  // Structural event detection (no message sniffing):
  // capture = an opponent piece that was on the board is now back at base
  const mover = state.players[currentPlayerIndex];
  let captured = false;
  let capturesMade = 0;
  let victim: Player | null = null;
  for (let i = 0; i < state.players.length; i++) {
    if (i === currentPlayerIndex) continue;
    const before = state.players[i].pieces;
    const after = newState.players[i].pieces;
    for (let j = 0; j < before.length; j++) {
      if (before[j].position >= 0 && after[j].position === -1) {
        captured = true;
        capturesMade++;
        victim = state.players[i];
      }
    }
  }
  const reachedHome = movedAfter != null && movedAfter.position === 57 && movedBefore.position !== 57;

  // Ranking stat: captures made this match
  if (capturesMade > 0) {
    newState = {
      ...newState,
      players: newState.players.map((p, i) =>
        i === currentPlayerIndex ? { ...p, kills: (p.kills ?? 0) + capturesMade } : p,
      ),
    };
  }

  // How long the mover's cell-by-cell travel animation takes: effects
  // (toast + sfx) wait for it so nothing announces the outcome before the
  // piece visibly lands. Base exits fly directly (no travel).
  const travelMs = movedBefore.position < 0 ? 0 : diceValue * STEP_DURATION * 1000;

  // Visual + audio effects (sfx/vibration play in CaptureOverlay on reveal,
  // so guests hear them too — not just the host device)
  if (captured && movedAfter && movedAfter.position >= 0 && movedAfter.position < 52) {
    const pos = getSquarePosition(movedAfter.position);
    newState = addCaptureEffectToState(newState, pos.x, pos.y, 'capture');
    // Meme-style toast: WHO killed WHOM (rendered by CaptureOverlay)
    const fx = newState.captureEffects[newState.captureEffects.length - 1];
    if (fx) {
      fx.label = `💥 ${mover.name} eliminó a ${victim?.name ?? '???'}`;
      fx.delay = travelMs;
    }
  }
  if (reachedHome && newState.phase !== 'finished') {
    const pos = getSquarePosition(COLOR_CONFIG[state.players[currentPlayerIndex].color].entryIndex);
    newState = addCaptureEffectToState(newState, pos.x, pos.y, 'home');
    const fx = newState.captureEffects[newState.captureEffects.length - 1];
    if (fx) {
      fx.label = `🏁 ${mover.name} llegó a la meta`;
      fx.delay = travelMs;
    }
  }

  // System meme effect: ONE significant occasion per move, fired with a
  // 40% chance (wins always fire). Broadcast via the snapshot so every
  // device plays the same sound + shows the same gif on the piece.
  const isWin = newState.phase === 'finished' && !!newState.winner;
  const occasion = movedAfter
    ? detectMemeOccasion({
        state, mover, movedBefore, movedAfter, diceValue,
        captured, victim, reachedHome, isWin,
      })
    : null;
  const memeFx: MemeFx | null =
    occasion && (isWin || Math.random() < MEME_FIRE_CHANCE)
      ? buildMemeFx(occasion.kind, state.memeFx?.key ?? 0, occasion, travelMs)
      : null;

  // Check for win
  if (isWin) {
    const winnerPlayer = newState.players.find((p) => p.color === newState.winner);
    const winPos = getSquarePosition(COLOR_CONFIG[newState.winner as Color].entryIndex);
    newState = addCaptureEffectToState(newState, winPos.x, winPos.y, 'win');
    const winFx = newState.captureEffects[newState.captureEffects.length - 1];
    if (winFx) {
      winFx.label = `🏆 ¡${winnerPlayer?.name ?? ''} GANA la partida!`;
      winFx.delay = movedBefore.position < 0 ? 0 : diceValue * STEP_DURATION * 1000;
    }
    set({
      ...newState,
      ...(memeFx ? { memeFx } : {}),
      messages: pushMessage(newState.messages, {
          id: createId(),
          playerId: winnerPlayer?.id ?? 'system',
          text: randomPick(WIN_MESSAGES),
          timestamp: Date.now(),
          kind: 'system',
        }),
    });
    return;
  }

  // Ludo Club rule: capturing or reaching the goal grants an extra roll
  const bonusRoll = captured || reachedHome;
  let advanced = advanceTurn(newState, bonusRoll);
  if (bonusRoll && !isBonusRoll(diceValue) && advanced.currentPlayerIndex === currentPlayerIndex) {
    advanced = {
      ...advanced,
      messages: pushMessage(advanced.messages, {
        id: createId(),
        playerId: state.players[currentPlayerIndex].id,
        text: randomPick(captured ? CAPTURE_BONUS_MESSAGES : HOME_BONUS_MESSAGES),
        timestamp: Date.now(),
        kind: 'system',
      }),
    };
  }
  set(memeFx ? { ...advanced, memeFx } : advanced);

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

    // Bot rolls (bots also earn shop points — visible fairness, they just never spend them)
    const value = rollDice();
    if (earnsPoint(value)) adjustPoints(set, currentPlayer.id, 1);
    const isThirdSix = isBonusRoll(value) && state.consecutiveSixes >= 2;

    set({
      diceValue: value,
      phase: 'moving',
      rollSeq: get().rollSeq + 1,
      messages: pushMessage(state.messages, {
          id: createId(),
          playerId: currentPlayer.id,
          text: `🎲 ${currentPlayer.emoji} Salió un ${value}`,
          timestamp: Date.now(),
          kind: 'system',
        }),
    });

    // Third consecutive six: the bot's play is cancelled too
    if (isThirdSix) {
      cancelThirdSix(set, get, currentPlayer.id);
      return;
    }

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
              kind: 'system',
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
      // Bot chooses a piece (after the dice reveal animation finishes)
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
                  kind: 'chat',
                }),
            });
          }
        }, 1250);
      }
    }
  }, 1100 + Math.random() * 700); // ~1.1-1.8 second delay for natural feel
}
