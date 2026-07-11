import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameMessage, Player } from '../game/types.ts';
import { useT } from '../i18n.ts';

interface GameChatProps {
  messages: GameMessage[];
  players: Player[];
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
  onSendMessage: (text: string) => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

export default function GameChat({ messages, players, isOpen, onToggle, onSendMessage }: GameChatProps) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');

  // Only user-authored content belongs in the chat panel — dice rolls,
  // captures, entries, etc. are engine narration with their own dedicated
  // UI (status banner, capture overlay) and would just be noise here.
  const chatMessages = messages.filter((m) => m.kind === 'chat');

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSendMessage(text);
    setDraft('');
  };

  // Build a playerId → player lookup
  const playerMap = new Map<string, Player>();
  for (const p of players) {
    playerMap.set(p.id, p);
  }

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isOpen]);

  // Classify messages for bubble styling (only 'chat'-kind messages reach
  // this component: typed text, quick phrases, and reactions/stickers).
  const getMsgType = (msg: GameMessage): string => {
    if (msg.playerId === 'system') return 'system';
    const player = playerMap.get(msg.playerId);
    if (!player) return 'system';
    if (msg.sticker) return 'sticker';
    return 'message';
  };

  return (
    <>
      {/* Chat panel (toggle lives in the game HUD) */}
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
              <span className="chat-header-title">💬 {t('chatTitle')}</span>
              <button className="chat-close" onClick={onToggle}>✕</button>
            </div>

            <div className="chat-messages" ref={scrollRef}>
              <AnimatePresence initial={false}>
                {chatMessages.length === 0 && (
                  <p className="chat-empty">{t('chatEmpty')}</p>
                )}
                {chatMessages.map(msg => {
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

            {/* Message input */}
            <div className="chat-input-row">
              <input
                type="text"
                className="chat-input"
                placeholder={t('typeMessage')}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                maxLength={200}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!draft.trim()}
                aria-label={t('send')}
              >
                ➤
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
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
          background: rgba(46, 32, 128, 0.94);
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
        .chat-empty {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.85rem;
          font-weight: 700;
          margin: auto;
          padding: var(--gap-lg);
        }
        .chat-input-row {
          display: flex;
          gap: 8px;
          padding: 10px var(--gap-md) calc(10px + env(safe-area-inset-bottom));
          border-top: 1px solid var(--color-border);
          flex-shrink: 0;
        }
        .chat-input {
          flex: 1;
          min-width: 0;
          padding: 10px 16px;
          border-radius: var(--radius-full);
          border: 2px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 700;
          outline: none;
        }
        .chat-input:focus {
          border-color: #ffd65a;
        }
        .chat-input::placeholder {
          color: var(--color-text-muted);
        }
        .chat-send-btn {
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          border-radius: 50%;
          border: none;
          background: linear-gradient(180deg, #ffc93d, #ff9f1a);
          color: #fff;
          font-size: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 0 #d97a06;
          transition: transform 100ms ease, box-shadow 100ms ease, opacity 150ms ease;
        }
        .chat-send-btn:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow: 0 1px 0 #d97a06;
        }
        .chat-send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
}
