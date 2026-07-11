import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import Board from './Board.tsx';
import Dice3D from './Dice3D.tsx';
import AvatarBadge from './AvatarBadge.tsx';
import GameChat from './GameChat.tsx';
import StickerPicker from './StickerPicker.tsx';
import CaptureOverlay from './CaptureOverlay.tsx';
import WinScreen from './WinScreen.tsx';
import VideoChat from './VideoChat.tsx';
import type { Color, Piece, Player } from '../game/types.ts';
import { PLAYER_CONFIG } from '../game/types.ts';
import { useT } from '../i18n.ts';

/** Quick reactions shown next to the dice (Ludo Club style). */
const QUICK_REACTIONS = ['😂', '😭', '🤬', '🔥', '💀', '👏'];

/** Corner layout: matches the board's base corners. */
const TOP_COLORS: Color[] = ['red', 'blue'];
const BOTTOM_COLORS: Color[] = ['green', 'yellow'];

export default function Game() {
  const t = useT();
  const phase = useGameStore((s) => s.phase);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const diceValue = useGameStore((s) => s.diceValue);
  const rollSeq = useGameStore((s) => s.rollSeq);
  const winner = useGameStore((s) => s.winner);
  const gameMode = useGameStore((s) => s.gameMode);
  const captureEffects = useGameStore((s) => s.captureEffects);
  const messages = useGameStore((s) => s.messages);
  const reactions = useGameStore((s) => s.reactions);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const roll = useGameStore((s) => s.roll);
  const sendReaction = useGameStore((s) => s.sendReaction);
  const sendChatMessage = useGameStore((s) => s.sendChatMessage);
  const clearCaptureEffects = useGameStore((s) => s.clearCaptureEffects);
  const movablePieceIds = useGameStore((s) => s.movablePieceIds);
  const goHome = useGameStore((s) => s.goHome);

  const [chatOpen, setChatOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentPlayer = players[currentPlayerIndex];
  const isBot = currentPlayer?.isBot ?? false;
  const canRoll = phase === 'rolling' && !winner;

  const playersByColor = useMemo(() => {
    const map = new Map<Color, Player>();
    for (const p of players) map.set(p.color, p);
    return map;
  }, [players]);

  // Movable pieces must react to dice/phase/turn changes — `players` alone
  // doesn't change on a roll, and depending only on it froze the game
  // whenever the player had 2+ movable pieces (none became clickable).
  const movableIds = useMemo(
    () => movablePieceIds(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, diceValue, phase, currentPlayerIndex, movablePieceIds],
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

  // Track unread messages when chat is closed
  useEffect(() => {
    if (!chatOpen) {
      setUnreadCount(messages.length);
    } else {
      setUnreadCount(0);
    }
  }, [messages.length, chatOpen]);

  const handlePieceClick = useCallback((pieceId: string) => {
    if (phase === 'moving') {
      selectPiece(pieceId);
    }
  }, [phase, selectPiece]);

  const handleStickerSelect = useCallback((emoji: string) => {
    sendReaction(emoji);
  }, [sendReaction]);

  if (players.length === 0) return null;

  const renderBadge = (color: Color) => {
    const player = playersByColor.get(color);
    if (!player) return <span key={color} />;
    const isCurrent = player.id === currentPlayer?.id;
    const finished = player.pieces.filter((p) => p.position >= 56).length;
    const align = color === 'red' || color === 'green' ? 'left' : 'right';
    return (
      <AvatarBadge
        key={player.id}
        player={player}
        isCurrent={isCurrent}
        isThinking={isCurrent && isBot && phase === 'rolling'}
        finishedCount={finished}
        reaction={reactions[player.id]}
        align={align}
        showTeamBadge={gameMode === 'teams'}
      />
    );
  };

  const turnColor = currentPlayer ? PLAYER_CONFIG[currentPlayer.color].cssColor : '#fff';
  const isHumanTurn = !isBot && !winner;

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
          <span className="game-header-spacer" />
        </div>

        {/* Middle: players + board, vertically centered */}
        <div className="game-mid">
        {/* Top players */}
        <div className="game-badges game-badges--top">
          {TOP_COLORS.map(renderBadge)}
        </div>

        {/* Board */}
        <Board
          pieces={allPieces}
          currentPlayer={currentPlayer}
          onPieceClick={handlePieceClick}
        />

        {/* Bottom players */}
        <div className="game-badges game-badges--bottom">
          {BOTTOM_COLORS.map(renderBadge)}
        </div>

        {/* Status line: extra turn / tap hint */}
        <div className="game-status-slot">
          <AnimatePresence mode="wait">
            {diceValue === 6 && phase === 'moving' ? (
              <motion.div
                key="extra"
                className="game-status game-status--gold"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                🔥 {t('extraTurn')} ({t('rolledSix')})
              </motion.div>
            ) : phase === 'moving' && !isBot && movableIds.length > 1 ? (
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
          <div className="game-reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <motion.button
                key={emoji}
                className="game-reaction-btn"
                onClick={() => sendReaction(emoji)}
                whileTap={{ scale: 0.8 }}
              >
                {emoji}
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

            <Dice3D
              value={diceValue}
              rollSeq={rollSeq}
              canRoll={canRoll}
              isBot={isBot}
              onRoll={roll}
            />

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
      />

      {/* Capture overlay */}
      <CaptureOverlay
        effects={captureEffects}
        onDismiss={clearCaptureEffects}
      />

      {/* Win screen */}
      {winner && <WinScreen winnerColor={winner} />}

      {/* Video chat overlay */}
      <VideoChat />

      <style>{`
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
          padding: 6px 14px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.14);
          min-width: 0;
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
        .game-header-spacer {
          width: 38px;
          flex-shrink: 0;
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
        .game-hud {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding-top: 4px;
        }
        .game-reactions {
          display: flex;
          gap: 6px;
        }
        .game-reaction-btn {
          width: 38px;
          height: 38px;
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
          width: 50px;
          height: 50px;
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
      `}</style>
    </div>
  );
}
