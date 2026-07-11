import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore.ts';
import Board from './Board.tsx';
import Dice from './Dice.tsx';
import PlayerPanel from './PlayerPanel.tsx';
import GameChat from './GameChat.tsx';
import StickerPicker from './StickerPicker.tsx';
import CaptureOverlay from './CaptureOverlay.tsx';
import WinScreen from './WinScreen.tsx';
import type { Color, Piece } from '../game/types.ts';
import { PLAYER_CONFIG } from '../game/types.ts';

export default function Game() {
  const phase = useGameStore(s => s.phase);
  const players = useGameStore(s => s.players);
  const currentPlayerIndex = useGameStore(s => s.currentPlayerIndex);
  const diceValue = useGameStore(s => s.diceValue);
  const winner = useGameStore(s => s.winner);
  const captureEffects = useGameStore(s => s.captureEffects);
  const messages = useGameStore(s => s.messages);
  const selectPiece = useGameStore(s => s.selectPiece);
  const roll = useGameStore(s => s.roll);
  const addMessage = useGameStore(s => s.addMessage);
  const clearCaptureEffects = useGameStore(s => s.clearCaptureEffects);
  const movablePieceIds = useGameStore(s => s.movablePieceIds);

  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentPlayer = players[currentPlayerIndex];
  const isBot = currentPlayer?.isBot ?? false;
  const canRoll = phase === 'rolling' && !winner;

  // Flatten all pieces with their parent color and player
  const allPieces = useMemo(() => {
    const result: (Piece & { _color: Color; _playerId: string; _isMovable: boolean })[] = [];
    const movableSet = new Set(movablePieceIds());
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
  }, [players, movablePieceIds]);

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
    addMessage(emoji, emoji);
  }, [addMessage]);

  const handlePlayAgain = useCallback(() => {
    useGameStore.getState().resetGame();
  }, []);

  if (players.length === 0) return null;

  return (
    <div className="game-layout">
      {/* Player panel at top */}
      <PlayerPanel
        players={players}
        currentPlayerIndex={currentPlayerIndex}
      />

      {/* Main game area */}
      <div className="game-main">
        {/* Current player indicator */}
        {currentPlayer && (
          <div className="game-turn-indicator" style={{ color: PLAYER_CONFIG[currentPlayer.color].cssColor }}>
            <span>{currentPlayer.emoji}</span>
            <span className="game-turn-name">{currentPlayer.name}</span>
            {diceValue && (
              <span className="game-dice-mini">🎲 {diceValue}</span>
            )}
            {phase === 'rolling' && (
              <span className="game-turn-hint">
                {isBot ? '🤖 pensando...' : '🎲 ¡Tira el dado!'}
              </span>
            )}
          </div>
        )}

        {/* Dice */}
        <Dice
          value={diceValue}
          onRoll={roll}
          canRoll={canRoll}
          isBot={isBot}
        />

        {/* Board */}
        <Board
          pieces={allPieces}
          currentPlayer={currentPlayer}
          onPieceClick={handlePieceClick}
        />

        {/* Extra turn indicator */}
        <AnimatePresence>
          {diceValue === 6 && phase === 'moving' && (
            <motion.div
              className="extra-turn-indicator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ color: '#FFD700' }}
            >
              🔥 ¡TURNO EXTRA! (sacaste 6) 🔥
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat toggle */}
      <GameChat
        messages={messages}
        players={players}
        isOpen={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
        unreadCount={unreadCount}
      />

      {/* Sticker picker */}
      <StickerPicker
        onStickerSelect={handleStickerSelect}
        currentEmoji={currentPlayer?.emoji ?? '🎲'}
      />

      {/* Capture overlay */}
      <CaptureOverlay
        effects={captureEffects}
        onDismiss={clearCaptureEffects}
      />

      {/* Win screen */}
      {winner && (
        <WinScreen
          winnerColor={winner}
          onPlayAgain={handlePlayAgain}
        />
      )}

      <style>{`
        .game-layout {
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          background: radial-gradient(ellipse at center, rgba(26, 26, 46, 1) 0%, var(--color-bg) 100%);
        }
        .game-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--gap-md);
          padding: var(--gap-sm) var(--gap-md);
          overflow: hidden;
        }
        .game-turn-indicator {
          display: flex;
          align-items: center;
          gap: var(--gap-sm);
          font-size: 1rem;
          font-weight: 800;
          text-shadow: 0 0 10px currentColor;
          padding: 4px 16px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.05);
        }
        .game-turn-name {
          color: var(--color-text);
        }
        .game-dice-mini {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }
        .game-turn-hint {
          font-size: 0.8rem;
          color: var(--color-text-muted);
          animation: pulse-glow 2s ease-in-out infinite;
        }
        .extra-turn-indicator {
          font-size: 1rem;
          font-weight: 800;
          text-align: center;
          padding: 4px 16px;
          border-radius: var(--radius-full);
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid rgba(255, 215, 0, 0.3);
          animation: pulse-glow 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
