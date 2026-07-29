import { styleOnce } from '../styleOnce.ts';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import Board from './Board.tsx';
import BoardHex from './BoardHex.tsx';
import Dice3D from './Dice3D.tsx';
import AvatarBadge from './AvatarBadge.tsx';
import GameChat from './GameChat.tsx';
import StickerPicker from './StickerPicker.tsx';
import DiceShop from './DiceShop.tsx';
import CaptureOverlay from './CaptureOverlay.tsx';
import WinScreen from './WinScreen.tsx';
import type { Color, Piece, Player } from '../game/types.ts';
import { PLAYER_CONFIG } from '../game/types.ts';
import { ROTATION_FOR_COLOR, cornerForColor } from '../game/boardRotation.ts';
import { useVideoStore } from '../store/videoStore.ts';
import { useSoundStore, playSfx } from '../sound.ts';
import { isMemeReaction, memePartsOf, memePayload } from '../game/gifs.ts';
import { memeSoundById, playMemeSound } from '../game/memeSounds.ts';
import type { MemeFx } from '../game/memeFx.ts';
import type { MemeThrow } from '../store/gameStore.ts';
import { useInvStore, soundForMeme } from '../inventory.ts';
import { useT } from '../i18n.ts';
import TutorialModal, { TUTORIAL_SEEN_KEY } from './TutorialModal.tsx';
import { BookOpen } from 'lucide-react';
import {
  Ban, Camera, CameraOff, Dices, Flame, Gift, Hand, MessageCircle, Mic, MicOff,
  Plus, RadioTower, SmilePlus, Star, Target, Volume2, VolumeX,
} from 'lucide-react';

/** How long the 3D dice spin animation takes to visually settle (see
 *  Dice3D's 950ms settle timer) — inputs stay locked until then. */
const DICE_SETTLE_MS = 1000;

/** Flight time of a thrown meme (avatar → avatar). */
const THROW_FLIGHT_MS = 850;

/** A thrown meme flying from the sender's avatar to the target's, with a
 *  lobbed arc and spin. Positions are read from the badges' data
 *  attributes at launch time (fixed-position overlay). */
function ThrowFlight({ fx, onDone }: { fx: MemeThrow; onDone: () => void }) {
  const [pts] = useState(() => {
    const center = (el: Element | null) => {
      const r = el?.getBoundingClientRect();
      return r
        ? { x: r.x + r.width / 2, y: r.y + r.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    };
    // Self-throw: the meme flies to the player's LAST PLAYED piece on the
    // board (falls back to their avatar if none moved yet).
    const selfPieceId = fx.from === fx.to
      ? useGameStore.getState().lastPieceByPlayer[fx.from]
      : undefined;
    const pieceEl = selfPieceId ? document.querySelector(`[data-piece-id="${selfPieceId}"]`) : null;
    return {
      a: center(document.querySelector(`[data-badge-for="${fx.from}"]`)),
      b: center(pieceEl ?? document.querySelector(`[data-badge-for="${fx.to}"]`)),
    };
  });
  useEffect(() => {
    const timer = setTimeout(onDone, THROW_FLIGHT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const gifUrl = isMemeReaction(fx.gif) ? memePartsOf(fx.gif).url : '';
  return (
    <motion.div
      className="throw-fly"
      initial={{ left: pts.a.x, top: pts.a.y, scale: 0.5, rotate: 0, opacity: 0.9 }}
      animate={{
        left: [pts.a.x, (pts.a.x + pts.b.x) / 2, pts.b.x],
        top: [pts.a.y, Math.min(pts.a.y, pts.b.y) - 110, pts.b.y],
        scale: [0.6, 1.25, 1],
        rotate: 540,
        opacity: 1,
      }}
      transition={{ duration: THROW_FLIGHT_MS / 1000, ease: 'easeIn' }}
    >
      {gifUrl && <img className="throw-fly-img" src={gifUrl} alt="" draggable={false} />}
    </motion.div>
  );
}

/** Meme sitting on a board piece (self-throw): follows the piece's DOM
 *  position while visible, so board resizes/animations don't detach it. */
function PiecePin({ pieceId, gif }: { pieceId: string; gif: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const track = () => {
      const el = document.querySelector(`[data-piece-id="${pieceId}"]`);
      const r = el?.getBoundingClientRect();
      setPos(r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null);
    };
    track();
    const timer = setInterval(track, 250);
    return () => clearInterval(timer);
  }, [pieceId]);
  const url = isMemeReaction(gif) ? memePartsOf(gif).url : '';
  if (!pos || !url) return null;
  return (
    <div className="piece-pin" style={{ left: pos.x, top: pos.y }}>
      <img className="piece-pin-img" src={url} alt="" draggable={false} />
    </div>
  );
}

export default function Game() {
  const t = useT();
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const diceValue = useGameStore((s) => s.diceValue);
  const rollSeq = useGameStore((s) => s.rollSeq);
  const winner = useGameStore((s) => s.winner);
  const consecutiveSixes = useGameStore((s) => s.consecutiveSixes);
  const turnCount = useGameStore((s) => s.turnCount);
  const teamsMode = useGameStore((s) => s.teamsMode);
  const captureEffects = useGameStore((s) => s.captureEffects);
  const messages = useGameStore((s) => s.messages);
  const reactions = useGameStore((s) => s.reactions);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const roll = useGameStore((s) => s.roll);
  const buyLucky = useGameStore((s) => s.buyLucky);
  const memeFx = useGameStore((s) => s.memeFx);
  const memeThrow = useGameStore((s) => s.memeThrow);
  const throwMeme = useGameStore((s) => s.throwMeme);
  const sendReaction = useGameStore((s) => s.sendReaction);
  const sendChatMessage = useGameStore((s) => s.sendChatMessage);
  const clearCaptureEffects = useGameStore((s) => s.clearCaptureEffects);
  const movablePieceIds = useGameStore((s) => s.movablePieceIds);
  const turnTimeout = useGameStore((s) => s.turnTimeout);
  const goHome = useGameStore((s) => s.goHome);

  const onlineRole = useGameStore((s) => s.onlineRole);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const onlineReconnecting = useGameStore((s) => s.onlineReconnecting);
  const hexMode = useGameStore((s) => s.hexMode === true);

  const [chatOpen, setChatOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  // In-game manual: auto-opens for FIRST-TIME players (dismiss anytime —
  // tap outside or ✕ — and it hides ITSELF when your turn arrives so it
  // never blocks play).
  const [manualOpen, setManualOpen] = useState(() => {
    try { return !localStorage.getItem(TUTORIAL_SEEN_KEY); } catch { return false; }
  });
  const [unreadCount, setUnreadCount] = useState(0);

  const currentPlayer = players[currentPlayerIndex];
  const isBot = currentPlayer?.isBot ?? false;

  // System meme effect playback: when the host broadcasts a memeFx, every
  // device waits the mover's travel time, then plays the sound (50% vol,
  // 5s cap) and shows the occasion gif anchored on the piece's square.
  // Effects already present when this screen mounts (stale snapshot /
  // rejoin) are ignored — only NEW keys fire.
  const [activeFx, setActiveFx] = useState<MemeFx | null>(null);
  const seenFxKey = useRef<number>(useGameStore.getState().memeFx?.key ?? 0);
  useEffect(() => {
    if (!memeFx || memeFx.key === seenFxKey.current) return;
    seenFxKey.current = memeFx.key;
    const wait = Math.max(0, memeFx.delay ?? 0);
    const show = setTimeout(() => {
      playMemeSound(memeFx.sound);
      setActiveFx(memeFx);
    }, wait);
    return () => clearTimeout(show);
  }, [memeFx]);
  // Auto-hide is keyed to the SHOWN fx, not to memeFx: the old combined
  // effect lost its hide timer whenever memeFx changed/reset mid-display
  // (rematch, snapshot churn), leaving the gif STUCK on the board and
  // sitting over the pieces. This way anything shown always dies in 3.2s.
  useEffect(() => {
    if (!activeFx) return;
    const hide = setTimeout(() => setActiveFx(null), 3200);
    return () => clearTimeout(hide);
  }, [activeFx]);

  // Thrown memes (gift button): animate the flight on every device, play
  // the impact sound, and pin the meme on the target's avatar for a minute.
  const PIN_MS = 60000;
  /** Self-thrown memes sit on the piece only while the sound plays. */
  const PIECE_PIN_MS = 5000;
  const [flight, setFlight] = useState<MemeThrow | null>(null);
  const [pinned, setPinned] = useState<Record<string, string>>({});
  const [piecePin, setPiecePin] = useState<{ pieceId: string; gif: string; key: number } | null>(null);
  const piecePinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const seenThrowKey = useRef<number>(useGameStore.getState().memeThrow?.key ?? 0);
  const [giftTarget, setGiftTarget] = useState<string | null>(null);
  useEffect(() => {
    if (!memeThrow || memeThrow.key === seenThrowKey.current) return;
    seenThrowKey.current = memeThrow.key;
    setFlight(memeThrow);
  }, [memeThrow]);
  const handleFlightDone = useCallback(() => {
    setFlight((fx) => {
      if (!fx) return null;
      // The thrower may be silenced on this device — no impact sound then
      if (!useVideoStore.getState().mutedPlayers[fx.from]) playMemeSound(fx.sound);
      // Self-throw: land on the player's last played piece, visible only
      // while the sound plays, then vanish without touching anything else.
      const selfPieceId = fx.from === fx.to
        ? useGameStore.getState().lastPieceByPlayer[fx.from]
        : undefined;
      if (selfPieceId && document.querySelector(`[data-piece-id="${selfPieceId}"]`)) {
        setPiecePin({ pieceId: selfPieceId, gif: fx.gif, key: fx.key });
        if (piecePinTimer.current) clearTimeout(piecePinTimer.current);
        piecePinTimer.current = setTimeout(() => setPiecePin(null), PIECE_PIN_MS);
        return null;
      }
      setPinned((p) => ({ ...p, [fx.to]: fx.gif }));
      if (pinTimers.current[fx.to]) clearTimeout(pinTimers.current[fx.to]);
      pinTimers.current[fx.to] = setTimeout(() => {
        setPinned((p) => {
          const next = { ...p };
          delete next[fx.to];
          return next;
        });
      }, PIN_MS);
      return null;
    });
  }, []);
  useEffect(() => () => {
    Object.values(pinTimers.current).forEach(clearTimeout);
    if (piecePinTimer.current) clearTimeout(piecePinTimer.current);
  }, []);

  // ⏱ 20s turn timer: the acting device (host/local) forces an auto-roll
  // or auto-move when the current human runs out of time; every device
  // shows the draining bar over the current player's avatar.
  const TURN_MS = 20000;
  const timerKey = !winner && currentPlayer && !currentPlayer.isBot && (phase === 'rolling' || phase === 'moving')
    ? `${currentPlayerIndex}-${phase}-${rollSeq}`
    : null;
  useEffect(() => {
    if (!timerKey || onlineRole === 'guest') return;
    const timer = setTimeout(() => turnTimeout(), TURN_MS);
    return () => clearTimeout(timer);
  }, [timerKey, onlineRole, turnTimeout]);

  // Dice reveal gate: after every roll the 3D dice takes ~950ms to settle on
  // its face. Until then NOTHING may leak the result — no movable rings, no
  // piece taps, no status banners, no mini-dice value. Without this gate a
  // player could move (or see) the outcome before the dice visually lands.
  const [diceSettled, setDiceSettled] = useState(true);
  useEffect(() => {
    if (rollSeq === 0) return;
    setDiceSettled(false);
    const timer = setTimeout(() => setDiceSettled(true), DICE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [rollSeq]);
  // Whose turn controls this device: online → only your own player;
  // local modes → any human (shared device).
  const myTurn = onlineRole === 'none'
    ? !isBot
    : currentPlayer?.id === localPlayerId;
  useEffect(() => {
    if (myTurn && phase === 'rolling') setManualOpen(false);
  }, [myTurn, phase]);
  const canRoll = phase === 'rolling' && !winner;

  // Lucky-dice shop: whose points this device shows/spends — online →
  // your own player; local modes → the current human (shared device),
  // falling back to the first human while a bot plays.
  const shopPlayer = onlineRole !== 'none'
    ? players.find((p) => p.id === localPlayerId)
    : currentPlayer && !currentPlayer.isBot
      ? currentPlayer
      : players.find((p) => !p.isBot);
  const shopPoints = shopPlayer?.points ?? 0;

  // Board perspective (Ludo Club): this device's color sits bottom-left
  const myColor: Color = useMemo(() => {
    if (localPlayerId) {
      const me = players.find((p) => p.id === localPlayerId);
      if (me) return me.color;
    }
    return players.find((p) => !p.isBot)?.color ?? 'green';
  }, [players, localPlayerId]);

  // Corner → player mapping after rotation (badges follow the board)
  const rotationK = ROTATION_FOR_COLOR[myColor];
  const cornerPlayers = useMemo(() => {
    const corners: Record<'tl' | 'tr' | 'bl' | 'br', Color | null> = { tl: null, tr: null, bl: null, br: null };
    for (const color of ['red', 'green', 'yellow', 'blue'] as Color[]) {
      corners[cornerForColor(color, rotationK)] = color;
    }
    return corners;
  }, [rotationK]);

  // Sound & AV controls
  const muted = useSoundStore((s) => s.muted);
  const toggleMuted = useSoundStore((s) => s.toggleMuted);
  const avActive = useVideoStore((s) => s.localColor !== null);
  const camOn = useVideoStore((s) => s.cameraOn);
  const micOn = useVideoStore((s) => s.micOn);
  const avControls = useVideoStore((s) => s.controls);

  const playersByColor = useMemo(() => {
    const map = new Map<Color, Player>();
    for (const p of players) map.set(p.color, p);
    return map;
  }, [players]);

  // Movable pieces must react to dice/phase/turn changes — `players` alone
  // doesn't change on a roll, and depending only on it froze the game
  // whenever the player had 2+ movable pieces (none became clickable).
  const movableIds = useMemo(
    () => (myTurn && diceSettled ? movablePieceIds() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, diceValue, phase, currentPlayerIndex, myTurn, diceSettled, movablePieceIds],
  );

  // Flatten all pieces with their parent color and player
  const allPieces = useMemo(() => {
    const result: (Piece & { _color: Color; _playerId: string; _isMovable: boolean })[] = [];
    const movableSet = new Set(movableIds);
    for (const player of players) {
      for (const piece of player.pieces) {
        result.push({
          ...piece,
          _color: player.color,
          _playerId: player.id,
          _isMovable: movableSet.has(piece.id),
        });
      }
    }
    return result;
  }, [players, movableIds]);

  // Track unread CHAT messages when the panel is closed (engine narration
  // like dice rolls/captures has its own status banner and shouldn't
  // inflate the chat's unread badge).
  const chatMessageCount = useMemo(
    () => messages.filter((m) => m.kind === 'chat').length,
    [messages],
  );
  useEffect(() => {
    if (!chatOpen) {
      setUnreadCount(chatMessageCount);
    } else {
      setUnreadCount(0);
    }
  }, [chatMessageCount, chatOpen]);

  const handlePieceClick = useCallback((pieceId: string) => {
    if (phase === 'moving' && diceSettled) {
      selectPiece(pieceId);
    }
  }, [phase, diceSettled, selectPiece]);

  // Quick bar: the user's PURCHASED memes (inventory) — nothing else is
  // sendable. Every meme travels with its linked (or fallback) sound.
  const ownedMemes = useInvStore((s) => s.memes);
  const quickItems = useMemo(
    () => ownedMemes.slice(0, 6).map((m) => memePayload(soundForMeme(m), m.url)),
    [ownedMemes],
  );

  const sendQuick = useCallback((payload: string) => {
    playSfx('pop');
    sendReaction(payload);
  }, [sendReaction]);

  // Long-press on a quick-bar item shows WHICH sound/gif it is (tooltip)
  // instead of sending it — release hides it shortly after.
  const [tipFor, setTipFor] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const quickLabel = useCallback((payload: string) => {
    if (isMemeReaction(payload)) {
      return memeSoundById(memePartsOf(payload).sound)?.name ?? 'Meme';
    }
    return payload;
  }, []);
  const quickPressStart = useCallback((payload: string) => {
    longPressed.current = false;
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      longPressed.current = true;
      setTipFor(payload);
    }, 380);
  }, []);
  const quickPressEnd = useCallback(() => {
    if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null; }
    setTimeout(() => setTipFor(null), 1100);
  }, []);
  const quickClick = useCallback((payload: string) => {
    if (longPressed.current) { longPressed.current = false; return; } // long-press = only peek
    sendQuick(payload);
  }, [sendQuick]);

  const handleStickerSelect = useCallback((emoji: string) => {
    sendReaction(emoji);
  }, [sendReaction]);

  if (players.length === 0) return null;

  const renderBadge = (color: Color, align: 'left' | 'right' = 'left') => {
    const player = playersByColor.get(color);
    if (!player) return <span key={color} />;
    const isCurrent = player.id === currentPlayer?.id;
    const finished = player.pieces.filter((p) => p.position >= (hexMode ? 84 : 57)).length;
    // Turn dice (Ludo Club style): the big HUD dice only shows on the local
    // device's own turn, so opponents' turns get a small dice badge on
    // their avatar instead — undefined means "don't show one at all".
    const showTurnDice = isCurrent && !myTurn;
    return (
      <AvatarBadge
        key={player.id}
        player={player}
        isCurrent={isCurrent}
        isThinking={isCurrent && isBot && phase === 'rolling'}
        finishedCount={finished}
        reaction={reactions[player.id]}
        align={align}
        showTeamBadge={teamsMode === true && !hexMode}
        diceValue={showTurnDice ? (phase === 'moving' && diceSettled ? diceValue : null) : undefined}
        diceRolling={showTurnDice && (phase === 'rolling' || (phase === 'moving' && !diceSettled))}
        onGift={setGiftTarget}
        pinnedMeme={pinned[player.id] ?? null}
        timerKey={isCurrent ? timerKey : null}
      />
    );
  };

  const turnColor = currentPlayer ? PLAYER_CONFIG[currentPlayer.color].cssColor : '#fff';
  const isHumanTurn = myTurn && !winner;

  return (
    <div className="game-layout">
      <div className="game-column">
        {/* Header */}
        <div className="game-header">
          <button className="game-exit" onClick={goHome} aria-label={t('exitGame')}>
            ‹
          </button>
          <div className="game-turn-pill" style={{ '--turn-color': turnColor } as React.CSSProperties}>
            <span className="game-turn-dot" />
            <span className="game-turn-text">
              {isHumanTurn && phase === 'rolling'
                ? t('yourTurn')
                : `${t('turnOf')} ${currentPlayer?.name ?? ''}`}
            </span>
          </div>
          <button
            className="game-exit game-manual"
            onClick={() => setManualOpen(true)}
            aria-label="Manual"
            title="Manual de juego"
          >
            <BookOpen size={17} />
          </button>
          <button
            className="game-exit game-mute"
            onClick={toggleMuted}
            aria-label={muted ? 'unmute' : 'mute'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Middle: players + board, vertically centered */}
        <div className="game-mid">
        {/* Top players (hex: first 3 seats · 4p: corners follow rotation) */}
        <div className="game-badges game-badges--top">
          {hexMode
            ? players.slice(0, 3).map((p, i) => renderBadge(p.color, i === 2 ? 'right' : 'left'))
            : <>
                {cornerPlayers.tl && renderBadge(cornerPlayers.tl, 'left')}
                {cornerPlayers.tr && renderBadge(cornerPlayers.tr, 'right')}
              </>}
        </div>

        {/* Board */}
        {hexMode ? (
          <BoardHex pieces={allPieces} onPieceClick={handlePieceClick} />
        ) : (
          <Board
            pieces={allPieces}
            onPieceClick={handlePieceClick}
            perspective={myColor}
            memeFx={activeFx}
          />
        )}

        {/* Bottom players */}
        <div className="game-badges game-badges--bottom">
          {hexMode
            ? players.slice(3, 6).map((p, i) => renderBadge(p.color, i === 2 ? 'right' : 'left'))
            : <>
                {cornerPlayers.bl && renderBadge(cornerPlayers.bl, 'left')}
                {cornerPlayers.br && renderBadge(cornerPlayers.br, 'right')}
              </>}
        </div>

        {/* Status line: extra turn / tap hint */}
        <div className="game-status-slot">
          <AnimatePresence mode="wait">
            {!diceSettled ? null : (diceValue === 6 || diceValue === 1) && phase === 'moving' && consecutiveSixes >= 2 ? (
              <motion.div
                key="cancelled"
                className="game-status game-status--danger"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Ban size={14} className="game-status-ico" /> {t('thirdSix')}
              </motion.div>
            ) : (diceValue === 6 || diceValue === 1) && phase === 'moving' ? (
              <motion.div
                key="extra"
                className="game-status game-status--gold"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Flame size={14} className="game-status-ico" /> {t('extraTurn')} ({diceValue === 1 ? t('rolledOne') : t('rolledSix')})
              </motion.div>
            ) : phase === 'moving' && myTurn && movableIds.length > 1 ? (
              <motion.div
                key="tap"
                className="game-status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Hand size={14} className="game-status-ico" /> {t('tapPiece')}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        </div>

        {/* Bottom HUD: reactions + dice + chat */}
        <div className="game-hud">
          {/* Camera / mic controls — fixed, non-invasive, available for the
              whole online game (not just once media is already active) so
              the first tap is what actually requests the camera/mic. */}
          {onlineRole !== 'none' && (
            <div className="game-av-controls">
              <button
                className={`game-av-btn ${avActive && !camOn ? 'game-av-btn--off' : ''} ${avActive ? 'game-av-btn--on' : ''}`}
                onClick={() => avControls?.toggleCamera()}
                aria-label="camera"
                title={avActive ? (camOn ? t('turnCameraOff') : t('turnCameraOn')) : t('enableAv')}
              >
                {!avActive || camOn ? <Camera size={17} /> : <CameraOff size={17} />}
              </button>
              <button
                className={`game-av-btn ${avActive && !micOn ? 'game-av-btn--off' : ''} ${avActive ? 'game-av-btn--on' : ''}`}
                onClick={() => avControls?.toggleMic()}
                aria-label="microphone"
                title={avActive ? (micOn ? t('turnMicOff') : t('turnMicOn')) : t('enableAv')}
              >
                {!avActive || micOn ? <Mic size={17} /> : <MicOff size={17} />}
              </button>
            </div>
          )}

          <div className="game-reactions">
            {quickItems.map((payload) => (
              <motion.button
                key={payload}
                className="game-reaction-btn"
                onClick={() => quickClick(payload)}
                onPointerDown={() => quickPressStart(payload)}
                onPointerUp={quickPressEnd}
                onPointerLeave={quickPressEnd}
                onContextMenu={(e) => e.preventDefault()}
                whileTap={{ scale: 0.8 }}
                aria-label={payload}
                title={quickLabel(payload)}
              >
                <img className="game-reaction-tgif" src={memePartsOf(payload).url} alt="Meme" draggable={false} />
                {tipFor === payload && (
                  <span className="game-reaction-tip">{quickLabel(payload)}</span>
                )}
              </motion.button>
            ))}
            <motion.button
              className="game-reaction-btn game-reaction-btn--more"
              onClick={() => setStickersOpen(true)}
              whileTap={{ scale: 0.8 }}
              aria-label="stickers"
            >
              <Plus size={18} />
            </motion.button>
          </div>

          <div className="game-hud-row">
            <button
              className="game-hud-side-btn"
              onClick={() => setChatOpen(!chatOpen)}
              aria-label={t('chatTitle')}
            >
              <MessageCircle size={20} />
              {unreadCount > 0 && !chatOpen && (
                <span className="game-chat-unread">{Math.min(unreadCount, 99)}</span>
              )}
            </button>

            {/* Lucky-dice shop: always visible so players track their ⭐,
                buying only enabled on your own roll. */}
            <button
              className={`game-hud-side-btn game-shop-btn ${shopPlayer?.pendingLucky ? 'game-shop-btn--armed' : ''}`}
              onClick={() => setShopOpen(true)}
              aria-label={t('luckyTitle')}
              title={t('luckyTitle')}
            >
              <Target size={20} />
              <span className="game-shop-points"><Star size={10} className="game-star-ico" />{shopPoints}</span>
              {shopPlayer?.pendingLucky ? (
                <span className="game-shop-armed" title={t('luckyArmed')}>
                  <Dices size={11} className="game-star-ico" />{shopPlayer.pendingLucky}
                </span>
              ) : null}
            </button>

            {/* Big interactive dice: only during the local player's own
                turn (Ludo Club style) — other turns show a small dice next
                to that player's avatar instead (see renderBadge above). */}
            {myTurn && (
              <Dice3D
                value={diceValue}
                rollSeq={rollSeq}
                canRoll={canRoll}
                isBot={false}
                skin={currentPlayer?.diceSkin}
                onRoll={roll}
              />
            )}

            <button
              className="game-hud-side-btn"
              onClick={() => setStickersOpen(true)}
              aria-label="stickers"
            >
              <SmilePlus size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Chat panel */}
      <GameChat
        messages={messages}
        players={players}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        unreadCount={unreadCount}
        onSendMessage={sendChatMessage}
      />

      {/* Sticker picker */}
      <StickerPicker
        isOpen={stickersOpen}
        onClose={() => setStickersOpen(false)}
        onStickerSelect={handleStickerSelect}
        onPhraseSelect={(text) => {
          // Quick phrases show as a bubble on your avatar AND land in chat
          sendChatMessage(text);
          sendReaction(text.slice(0, 80));
        }}
        soundsLocked={(shopPlayer?.lastSoundTurn ?? -1) === turnCount}
      />

      {/* Lucky-dice shop: buy at ANY moment — the dice arms for your next roll */}
      <DiceShop
        isOpen={shopOpen}
        points={shopPoints}
        luckyBuys={shopPlayer?.luckyBuys ?? 0}
        pendingLucky={shopPlayer?.pendingLucky ?? null}
        canBuy={!!shopPlayer && !shopPlayer.isBot && !winner}
        onClose={() => setShopOpen(false)}
        onBuy={buyLucky}
      />

      {/* Capture overlay */}
      <CaptureOverlay
        effects={captureEffects}
        onDismiss={clearCaptureEffects}
      />

      {/* Connection lost: rebuilding the link to the host in the background */}
      {onlineReconnecting && (
        <div className="game-reconnecting">
          <RadioTower size={15} className="game-status-ico" /> {t('reconnecting')}
        </div>
      )}

      {/* Thrown meme in flight */}
      {flight && <ThrowFlight fx={flight} onDone={handleFlightDone} />}

      {/* Self-thrown meme resting on the last played piece (sound-length only) */}
      {piecePin && <PiecePin key={piecePin.key} pieceId={piecePin.pieceId} gif={piecePin.gif} />}

      {/* Throw-meme picker (gift button on an avatar) */}
      <AnimatePresence>
        {giftTarget && (
          <motion.div
            className="throw-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGiftTarget(null)}
          >
            <motion.div
              className="throw-picker"
              initial={{ scale: 0.85, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 16, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="throw-picker-title">
                <Gift size={16} className="game-status-ico" /> {t('throwMemeTo')} {players.find((p) => p.id === giftTarget)?.name ?? ''}
              </span>
              {ownedMemes.length > 0 ? (
                <div className="throw-picker-grid">
                  {ownedMemes.slice(0, 12).map((m) => (
                    <motion.button
                      key={m.id}
                      className="throw-picker-item"
                      whileTap={{ scale: 0.82 }}
                      onClick={() => {
                        throwMeme(giftTarget, memePayload(soundForMeme(m), m.url));
                        setGiftTarget(null);
                      }}
                    >
                      <img className="throw-picker-img" src={m.preview || m.url} alt="Meme" draggable={false} />
                    </motion.button>
                  ))}
                </div>
              ) : (
                <span className="throw-picker-empty">{t('noMemesOwned')}</span>
              )}
              <span className="throw-picker-note">1 {t('luckyReady') === 'listo' ? 'lanzamiento por turno' : 'throw per turn'}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-game manual overlay (quick to dismiss, auto-hides on your turn) */}
      {manualOpen && <TutorialModal onClose={() => setManualOpen(false)} />}

      {/* Win screen */}
      {winner && <WinScreen winnerColor={winner} />}

    </div>
  );
}

// Static component CSS — injected once per module (see styleOnce.ts)
styleOnce('game', `
        .game-layout {
          min-height: 100dvh;
          display: flex;
          justify-content: center;
        }
        .game-column {
          width: 100%;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          padding: calc(6px + env(safe-area-inset-top)) 5px calc(8px + env(safe-area-inset-bottom));
          gap: 4px;
        }
        .game-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 2px 0;
        }
        .game-exit {
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          font-size: 1.4rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .game-turn-pill {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.1);
          border: 1.5px solid color-mix(in srgb, var(--turn-color) 55%, transparent);
          box-shadow: 0 2px 10px color-mix(in srgb, var(--turn-color) 25%, transparent);
          min-width: 0;
          transition: border-color 250ms ease, box-shadow 250ms ease;
        }
        .game-turn-dot {
          width: 10px;
          height: 10px;
          flex-shrink: 0;
          border-radius: 50%;
          background: var(--turn-color);
          box-shadow: 0 0 8px var(--turn-color);
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
        .game-turn-text {
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .game-mute {
          font-size: 1rem;
        }
        .game-av-controls {
          display: flex;
          gap: 8px;
        }
        .game-av-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.12);
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast);
          touch-action: manipulation;
        }
        .game-av-btn--off {
          background: rgba(240, 64, 92, 0.35);
          border-color: rgba(240, 64, 92, 0.6);
        }
        .game-av-btn--on:not(.game-av-btn--off) {
          background: rgba(38, 193, 101, 0.3);
          border-color: rgba(38, 193, 101, 0.55);
        }
        .game-mid {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
        }
        .game-badges {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 2px;
        }
        .game-status-slot {
          min-height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .game-status {
          font-family: var(--font-display);
          font-size: 0.85rem;
          font-weight: 800;
          padding: 3px 14px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text-secondary);
        }
        .game-status--gold {
          color: #ffd65a;
          background: rgba(255, 214, 90, 0.12);
          border: 1px solid rgba(255, 214, 90, 0.35);
        }
        .game-status--danger {
          color: #ffb0bb;
          background: rgba(240, 64, 92, 0.15);
          border: 1px solid rgba(240, 64, 92, 0.4);
        }
        .game-hud {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding-top: 2px;
        }
        .game-reactions {
          display: flex;
          gap: 6px;
        }
        .game-reaction-btn {
          position: relative;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.1);
          font-size: 1.15rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast), transform var(--transition-fast);
          touch-action: manipulation;
        }
        .game-reaction-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }
        .game-reaction-tgif {
          width: 30px;
          height: 30px;
          object-fit: cover;
          border-radius: 8px;
          display: block;
        }
        .game-reaction-snd {
          font-size: 0.95rem;
          line-height: 1;
        }
        .game-reaction-tip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          translate: -50% 0;
          z-index: 60;
          background: #ffffff;
          color: #241865;
          border: 2px solid #241865;
          border-radius: 12px;
          padding: 5px 12px;
          font-family: var(--font-display);
          font-size: 0.75rem;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 6px 14px rgba(18, 8, 60, 0.35);
          pointer-events: none;
          animation: scale-pop 0.18s ease-out;
        }
        .game-reaction-btn--more {
          color: var(--color-text-secondary);
          font-weight: 800;
        }
        .game-hud-row {
          display: flex;
          align-items: center;
          gap: 26px;
        }
        .game-hud-side-btn {
          position: relative;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.12);
          font-size: 1.35rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 0 rgba(20, 8, 70, 0.3);
          transition: transform 120ms ease, box-shadow 120ms ease;
          touch-action: manipulation;
        }
        .game-hud-side-btn:active {
          transform: translateY(3px);
          box-shadow: 0 1px 0 rgba(20, 8, 70, 0.3);
        }
        .throw-fly {
          position: fixed;
          z-index: 170;
          translate: -50% -50%;
          pointer-events: none;
          filter: drop-shadow(0 6px 10px rgba(18, 8, 60, 0.5));
        }
        .piece-pin {
          position: fixed;
          z-index: 165;
          translate: -50% -88%;
          pointer-events: none;
          animation: piece-pin-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          filter: drop-shadow(0 4px 8px rgba(18, 8, 60, 0.55));
        }
        @keyframes piece-pin-in {
          from { scale: 1.8; opacity: 0; }
          to { scale: 1; opacity: 1; }
        }
        .piece-pin-img {
          width: 46px;
          height: 46px;
          border-radius: 10px;
          object-fit: cover;
          display: block;
        }
        .throw-backdrop {
          position: fixed;
          inset: 0;
          z-index: 120;
          background: rgba(12, 5, 40, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .throw-picker {
          background: linear-gradient(165deg, #3d2b8f, #241865);
          border: 2px solid rgba(255, 214, 90, 0.5);
          border-radius: 20px;
          box-shadow: 0 16px 44px rgba(8, 2, 30, 0.6);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          max-width: 320px;
        }
        .throw-picker-title {
          font-family: var(--font-display);
          font-size: 0.9rem;
          font-weight: 800;
          text-align: center;
        }
        .throw-picker-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .throw-picker-item {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          border: 2px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
        }
        .throw-picker-item:hover {
          background: rgba(255, 214, 90, 0.16);
          border-color: rgba(255, 214, 90, 0.5);
        }
        .throw-picker-note {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--color-text-muted);
        }
        .game-reconnecting {
          position: fixed;
          top: calc(54px + env(safe-area-inset-top));
          left: 50%;
          translate: -50% 0;
          z-index: 80;
          font-family: var(--font-display);
          font-size: 0.85rem;
          font-weight: 800;
          color: #ffd65a;
          background: rgba(20, 9, 46, 0.92);
          border: 1.5px solid rgba(255, 214, 90, 0.55);
          border-radius: var(--radius-full);
          padding: 7px 18px;
          box-shadow: 0 6px 18px rgba(8, 2, 30, 0.5);
          animation: pulse-glow 1.2s ease-in-out infinite;
          pointer-events: none;
          white-space: nowrap;
        }
        .game-shop-btn--armed {
          border-color: rgba(255, 214, 90, 0.85);
          box-shadow: 0 0 12px rgba(255, 214, 90, 0.45), 0 4px 0 rgba(20, 8, 70, 0.3);
        }
        .game-shop-armed {
          position: absolute;
          top: -7px;
          right: -7px;
          font-size: 0.6rem;
          font-weight: 800;
          font-family: var(--font-display);
          color: #241865;
          background: #ffd65a;
          border: 1.5px solid #fff;
          border-radius: var(--radius-full);
          padding: 2px 6px;
          white-space: nowrap;
          animation: pulse-glow 1.4s ease-in-out infinite;
        }
        .game-shop-points {
          position: absolute;
          bottom: -6px;
          left: 50%;
          translate: -50% 0;
          font-size: 0.62rem;
          font-weight: 800;
          font-family: var(--font-display);
          color: #ffd65a;
          background: rgba(20, 9, 46, 0.92);
          border: 1px solid rgba(255, 214, 90, 0.5);
          border-radius: var(--radius-full);
          padding: 1px 7px;
          white-space: nowrap;
        }
        .game-chat-unread {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 19px;
          height: 19px;
          border-radius: 10px;
          background: var(--color-red);
          color: #fff;
          font-size: 0.65rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }
        /* Lucide icon alignment + purchased-meme imagery */
        .game-status-ico { vertical-align: -2px; margin-right: 2px; }
        /* Reaction bubbles open TOWARD the board (not into the screen
           edge): top row → below the avatar; bottom row → above it. */
        .game-badges--top .avatar-reaction-bubble { top: auto; bottom: -46px; border-radius: 4px 17px 17px 17px; }
        .game-badges--bottom .avatar-reaction-bubble { top: auto; bottom: calc(100% + 10px); }
        .game-star-ico { vertical-align: -1px; margin-right: 1px; color: #ffd65a; }
        .game-hud-side-btn svg, .game-reaction-btn--more svg, .game-av-btn svg,
        .game-mute svg { display: block; margin: 0 auto; }
        .game-hud-side-btn { display: inline-flex; align-items: center; justify-content: center; }
        .throw-fly-img {
          width: 48px; height: 48px; object-fit: cover;
          border-radius: 12px;
          box-shadow: 0 6px 16px rgba(8, 2, 30, 0.5);
        }
        .throw-picker-img {
          width: 52px; height: 52px; object-fit: cover;
          border-radius: 10px; display: block;
        }
        .throw-picker-empty {
          font-size: 0.78rem; font-weight: 700;
          color: var(--color-text-secondary);
          text-align: center; padding: 10px 6px;
        }
        /* Short screens: tighten */
        @media (max-height: 700px) {
          .game-column { gap: 2px; }
          .game-status-slot { min-height: 20px; }
        }

`);
