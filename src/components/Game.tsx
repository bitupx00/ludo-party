import { styleOnce } from '../styleOnce.ts';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import Board from './Board.tsx';
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
import { QUICK_GIFS, GIF_PREFIX, isGifReaction, gifIdOf, gifById } from '../game/gifs.ts';
import { isSoundReaction, playMemeSound } from '../game/memeSounds.ts';
import type { MemeFx } from '../game/memeFx.ts';
import { useFavStore } from '../favorites.ts';
import GifSticker from './GifSticker.tsx';
import { useT } from '../i18n.ts';

/** How long the 3D dice spin animation takes to visually settle (see
 *  Dice3D's 950ms settle timer) — inputs stay locked until then. */
const DICE_SETTLE_MS = 1000;

export default function Game() {
  const t = useT();
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const diceValue = useGameStore((s) => s.diceValue);
  const rollSeq = useGameStore((s) => s.rollSeq);
  const winner = useGameStore((s) => s.winner);
  const consecutiveSixes = useGameStore((s) => s.consecutiveSixes);
  const teamsMode = useGameStore((s) => s.teamsMode);
  const captureEffects = useGameStore((s) => s.captureEffects);
  const messages = useGameStore((s) => s.messages);
  const reactions = useGameStore((s) => s.reactions);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const roll = useGameStore((s) => s.roll);
  const buyLucky = useGameStore((s) => s.buyLucky);
  const memeFx = useGameStore((s) => s.memeFx);
  const sendReaction = useGameStore((s) => s.sendReaction);
  const sendChatMessage = useGameStore((s) => s.sendChatMessage);
  const clearCaptureEffects = useGameStore((s) => s.clearCaptureEffects);
  const movablePieceIds = useGameStore((s) => s.movablePieceIds);
  const goHome = useGameStore((s) => s.goHome);

  const onlineRole = useGameStore((s) => s.onlineRole);
  const localPlayerId = useGameStore((s) => s.localPlayerId);
  const onlineReconnecting = useGameStore((s) => s.onlineReconnecting);

  const [chatOpen, setChatOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
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
    const hide = setTimeout(() => {
      setActiveFx((cur) => (cur?.key === memeFx.key ? null : cur));
    }, wait + 3200);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [memeFx]);

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

  // Quick bar: the user's FAVORITES (⭐ in the picker) first, and the most
  // recent send last — falls back to a default gif set when empty.
  const favs = useFavStore((s) => s.favs);
  const recent = useFavStore((s) => s.recent);
  const recordRecent = useFavStore((s) => s.recordRecent);
  const quickItems = useMemo(() => {
    // Sounds are system-only now: legacy snd: favorites are filtered out
    const items = favs.filter((p) => !isSoundReaction(p)).slice(0, 6);
    if (recent && !isSoundReaction(recent) && !items.includes(recent)) items.push(recent);
    return items.length > 0 ? items : QUICK_GIFS.map((id) => `${GIF_PREFIX}${id}`);
  }, [favs, recent]);

  const sendQuick = useCallback((payload: string) => {
    playSfx('pop');
    recordRecent(payload);
    sendReaction(payload);
  }, [recordRecent, sendReaction]);

  // Long-press on a quick-bar item shows WHICH sound/gif it is (tooltip)
  // instead of sending it — release hides it shortly after.
  const [tipFor, setTipFor] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const quickLabel = useCallback((payload: string) => {
    if (isGifReaction(payload)) return gifById(gifIdOf(payload))?.label ?? '';
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
    recordRecent(emoji);
    sendReaction(emoji);
  }, [recordRecent, sendReaction]);

  if (players.length === 0) return null;

  const renderBadge = (color: Color, align: 'left' | 'right' = 'left') => {
    const player = playersByColor.get(color);
    if (!player) return <span key={color} />;
    const isCurrent = player.id === currentPlayer?.id;
    const finished = player.pieces.filter((p) => p.position >= 57).length;
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
        showTeamBadge={teamsMode === true}
        diceValue={showTurnDice ? (phase === 'moving' && diceSettled ? diceValue : null) : undefined}
        diceRolling={showTurnDice && (phase === 'rolling' || (phase === 'moving' && !diceSettled))}
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
                ? `${currentPlayer?.emoji} ${t('yourTurn')}`
                : `${t('turnOf')} ${currentPlayer?.name ?? ''}`}
            </span>
          </div>
          <button
            className="game-exit game-mute"
            onClick={toggleMuted}
            aria-label={muted ? 'unmute' : 'mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* Middle: players + board, vertically centered */}
        <div className="game-mid">
        {/* Top players (corners follow board rotation) */}
        <div className="game-badges game-badges--top">
          {cornerPlayers.tl && renderBadge(cornerPlayers.tl, 'left')}
          {cornerPlayers.tr && renderBadge(cornerPlayers.tr, 'right')}
        </div>

        {/* Board */}
        <Board
          pieces={allPieces}
          onPieceClick={handlePieceClick}
          perspective={myColor}
          memeFx={activeFx}
        />

        {/* Bottom players */}
        <div className="game-badges game-badges--bottom">
          {cornerPlayers.bl && renderBadge(cornerPlayers.bl, 'left')}
          {cornerPlayers.br && renderBadge(cornerPlayers.br, 'right')}
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
                🚫 {t('thirdSix')}
              </motion.div>
            ) : (diceValue === 6 || diceValue === 1) && phase === 'moving' ? (
              <motion.div
                key="extra"
                className="game-status game-status--gold"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                🔥 {t('extraTurn')} ({diceValue === 1 ? t('rolledOne') : t('rolledSix')})
              </motion.div>
            ) : phase === 'moving' && myTurn && movableIds.length > 1 ? (
              <motion.div
                key="tap"
                className="game-status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                👇 {t('tapPiece')}
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
                {!avActive ? '📷' : camOn ? '📷' : '🚫'}
              </button>
              <button
                className={`game-av-btn ${avActive && !micOn ? 'game-av-btn--off' : ''} ${avActive ? 'game-av-btn--on' : ''}`}
                onClick={() => avControls?.toggleMic()}
                aria-label="microphone"
                title={avActive ? (micOn ? t('turnMicOff') : t('turnMicOn')) : t('enableAv')}
              >
                {!avActive ? '🎤' : micOn ? '🎤' : '🔇'}
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
                {isGifReaction(payload)
                  ? <GifSticker id={gifIdOf(payload)} size={27} />
                  : <span className="game-reaction-snd">🔊</span>}
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
              ＋
            </motion.button>
          </div>

          <div className="game-hud-row">
            <button
              className="game-hud-side-btn"
              onClick={() => setChatOpen(!chatOpen)}
              aria-label={t('chatTitle')}
            >
              💬
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
              🎯
              <span className="game-shop-points">⭐{shopPoints}</span>
              {shopPlayer?.pendingLucky ? (
                <span className="game-shop-armed" title={t('luckyArmed')}>
                  🎲{shopPlayer.pendingLucky}
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
                onRoll={roll}
              />
            )}

            <button
              className="game-hud-side-btn"
              onClick={() => setStickersOpen(true)}
              aria-label="stickers"
            >
              😂
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
        onPhraseSelect={sendChatMessage}
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
          📡 {t('reconnecting')}
        </div>
      )}

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
          padding: calc(6px + env(safe-area-inset-top)) 10px calc(8px + env(safe-area-inset-bottom));
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
        /* Short screens: tighten */
        @media (max-height: 700px) {
          .game-column { gap: 2px; }
          .game-status-slot { min-height: 20px; }
        }
      
`);
