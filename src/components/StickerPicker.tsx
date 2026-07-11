import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STICKER_TABS, STICKER_GRID, QUICK_PHRASES } from '../game/stickers.ts';
import type { StickerCategory } from '../game/stickers.ts';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerSelect: (emoji: string) => void;
  /** Quick phrases go to the chat as text messages. */
  onPhraseSelect: (text: string) => void;
}

/** Bottom-sheet sticker panel (controlled from the game HUD). */
export default function StickerPicker({ isOpen, onClose, onStickerSelect, onPhraseSelect }: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<StickerCategory>('reacciones');

  const handleStickerClick = (emoji: string) => {
    onStickerSelect(emoji);
    onClose();
  };

  const handlePhraseClick = (text: string) => {
    onPhraseSelect(text);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="sticker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="sticker-panel glass"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          >
            {/* Tabs */}
            <div className="sticker-tabs">
              {STICKER_TABS.map(tab => (
                <button
                  key={tab.key}
                  className={`sticker-tab ${activeTab === tab.key ? 'sticker-tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
              <button className="sticker-close" onClick={onClose} aria-label="✕">✕</button>
            </div>

            {/* Grid / quick phrases */}
            {activeTab === 'frases' ? (
              <div className="sticker-phrases">
                {QUICK_PHRASES.map((phrase, i) => (
                  <motion.button
                    key={i}
                    className="sticker-phrase"
                    onClick={() => handlePhraseClick(phrase)}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    {phrase}
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="sticker-grid">
                {(STICKER_GRID[activeTab] ?? []).map((emoji, i) => (
                  <motion.button
                    key={`${activeTab}-${i}`}
                    className="sticker-item"
                    onClick={() => handleStickerClick(emoji)}
                    whileTap={{ scale: 0.8 }}
                    whileHover={{ scale: 1.15 }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      <style>{`
        .sticker-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(10, 4, 40, 0.4);
          z-index: 98;
        }
        .sticker-panel {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: min(560px, 100%);
          max-height: 50vh;
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          padding: var(--gap-md);
          padding-bottom: calc(var(--gap-md) + env(safe-area-inset-bottom));
          z-index: 99;
          display: flex;
          flex-direction: column;
          gap: var(--gap-md);
          background: rgba(50, 34, 140, 0.92);
        }
        .sticker-tabs {
          display: flex;
          align-items: center;
          gap: var(--gap-sm);
          border-bottom: 1px solid var(--color-border);
          padding-bottom: var(--gap-sm);
        }
        .sticker-tab {
          padding: 6px 14px;
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          font-family: var(--font-display);
          font-size: 0.8rem;
          font-weight: 800;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .sticker-tab--active {
          background: rgba(255, 255, 255, 0.2);
          color: var(--color-text);
        }
        .sticker-close {
          margin-left: auto;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.14);
          color: var(--color-text-secondary);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 800;
        }
        .sticker-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: var(--gap-xs);
          overflow-y: auto;
          padding-bottom: var(--gap-sm);
        }
        .sticker-item {
          aspect-ratio: 1;
          border: none;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.08);
          font-size: 1.8rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast);
        }
        .sticker-item:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .sticker-phrases {
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-y: auto;
          padding-bottom: var(--gap-sm);
        }
        .sticker-phrase {
          text-align: left;
          padding: 10px 16px;
          border: none;
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .sticker-phrase:hover {
          background: rgba(255, 255, 255, 0.18);
        }
      `}</style>
    </AnimatePresence>
  );
}
