import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMessage, Player } from '../game/types.ts';

interface GameChatProps {
  messages: GameMessage[];
  players: Player[];
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export default function GameChat({ messages, players, isOpen, onToggle, unreadCount }: GameChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a playerId → player lookup
  const playerMap = new Map<string, Player>();
  for (const p of players) {
    playerMap.set(p.id, p);
  }

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Classify messages: system messages have playerId 'system'
  const getMsgType = (msg: GameMessage): string => {
    if (msg.playerId === 'system') return 'system';
    const player = playerMap.get(msg.playerId);
    if (!player) return 'system';
    // Classify as sticker if it has a sticker field
    if (msg.sticker) return 'sticker';
    // Check for capture keywords
    if (msg.text.includes('BOOM') || msg.text.includes('CAPTURADO') || msg.text.includes('Eliminado')) return 'capture';
    if (msg.text.includes('GANASTE') || msg.text.includes('CAMPEÓN') || msg.text.includes('VICTORIA')) return 'win';
    return 'message';
  };

  return (
    <>
      {/* Toggle button */}
      <button className="chat-toggle glass" onClick={onToggle}>
        <span>💬</span>
        {unreadCount > 0 && (
          <motion.span
            className="chat-unread"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="chat-panel glass"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="chat-header">
              <span className="chat-header-title">💬 Chat del juego</span>
              <button className="chat-close" onClick={onToggle}>✕</button>
            </div>

            <div className="chat-messages" ref={scrollRef}>
              <AnimatePresence initial={false}>
                {messages.map(msg => {
                  const msgType = getMsgType(msg);
                  const player = playerMap.get(msg.playerId);
                  const playerColor = player?.color ?? 'red';

                  return (
                    <motion.div
                      key={msg.id}
                      className={[
                        'chat-bubble',
                        `chat-bubble--${msgType}`,
                        msgType !== 'system' && `chat-bubble--${playerColor}`,
                      ].filter(Boolean).join(' ')}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                    >
                      {msgType !== 'system' && player && (
                        <span className="chat-bubble-sender">
                          {player.emoji} {player.name}
                        </span>
                      )}
                      <span className="chat-bubble-text">
                        {msg.sticker ? (
                          <span className="chat-sticker">{msg.sticker}</span>
                        ) : (
                          msg.text
                        )}
                      </span>
                      <span className="chat-bubble-time">{formatTime(msg.timestamp)}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .chat-toggle {
          position: fixed;
          top: var(--gap-md);
          right: var(--gap-md);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          color: var(--color-text);
          font-size: 1.3rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          transition: all var(--transition-fast);
        }
        .chat-toggle:hover {
          background: var(--color-surface-hover);
        }
        .chat-unread {
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          background: var(--color-red);
          color: white;
          font-size: 0.65rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }
        .chat-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(380px, 85vw);
          display: flex;
          flex-direction: column;
          z-index: 80;
          border-radius: 0;
          border-right: none;
        }
        @media (max-width: 768px) {
          .chat-panel {
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            max-height: 60vh;
            border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          }
        }
        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--gap-md);
          border-bottom: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .chat-header-title {
          font-size: 1rem;
          font-weight: 700;
        }
        .chat-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--gap-md);
          display: flex;
          flex-direction: column;
          gap: var(--gap-sm);
        }
        .chat-bubble {
          max-width: 85%;
          padding: 8px 12px;
          border-radius: var(--radius-lg);
          font-size: 0.85rem;
          word-wrap: break-word;
        }
        .chat-bubble--system {
          background: rgba(255, 255, 255, 0.04);
          color: var(--color-text-muted);
          text-align: center;
          max-width: 100%;
          font-size: 0.75rem;
          border-radius: var(--radius-md);
          align-self: center;
          padding: 4px 12px;
        }
        .chat-bubble--red {
          background: rgba(255, 71, 87, 0.15);
          border: 1px solid rgba(255, 71, 87, 0.2);
        }
        .chat-bubble--green {
          background: rgba(46, 213, 115, 0.15);
          border: 1px solid rgba(46, 213, 115, 0.2);
        }
        .chat-bubble--yellow {
          background: rgba(255, 165, 2, 0.15);
          border: 1px solid rgba(255, 165, 2, 0.2);
        }
        .chat-bubble--blue {
          background: rgba(55, 66, 250, 0.15);
          border: 1px solid rgba(55, 66, 250, 0.2);
        }
        .chat-bubble--capture {
          animation: bounce-in 0.4s ease;
          background: rgba(255, 71, 87, 0.25);
          border: 1px solid rgba(255, 71, 87, 0.4);
        }
        .chat-bubble--win {
          animation: bounce-in 0.4s ease;
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 2, 0.2));
          border: 1px solid rgba(255, 215, 0, 0.3);
          text-align: center;
          max-width: 100%;
        }
        .chat-bubble--sticker {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          text-align: center;
          align-self: center;
        }
        .chat-bubble--message {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .chat-bubble-sender {
          display: block;
          font-size: 0.7rem;
          font-weight: 700;
          margin-bottom: 2px;
          opacity: 0.7;
        }
        .chat-bubble-text {
          display: block;
          line-height: 1.3;
        }
        .chat-sticker {
          font-size: 2rem;
        }
        .chat-bubble-time {
          display: block;
          font-size: 0.6rem;
          opacity: 0.4;
          text-align: right;
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}
