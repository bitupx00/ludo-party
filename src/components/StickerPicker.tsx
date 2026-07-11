import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STICKER_TABS, STICKER_GRID } from '../game/stickers.ts';
import type { StickerCategory } from '../game/stickers.ts';

interface StickerPickerProps {
  onStickerSelect: (emoji: string) => void;
  currentEmoji: string;
}

export default function StickerPicker({ onStickerSelect, currentEmoji }: StickerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StickerCategory>('reacciones');

  const handleStickerClick = (emoji: string) => {
    onStickerSelect(emoji);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        className="sticker-fab"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.9 }}
        animate={isOpen ? { rotate: 45 } : { rotate: 0 }}
        style={{ background: isOpen ? 'var(--color-yellow)' : 'var(--glass-bg)' }}
      >
        {isOpen ? '✕' : currentEmoji}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sticker-panel glass"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
            </div>

            {/* Grid */}
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
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .sticker-fab {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1px solid var(--glass-border);
          color: var(--color-text);
          font-size: 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(var(--glass-blur));
          transition: background 0.2s;
        }
        .sticker-panel {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          max-height: 50vh;
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          padding: var(--gap-md);
          z-index: 99;
          display: flex;
          flex-direction: column;
          gap: var(--gap-md);
        }
        .sticker-tabs {
          display: flex;
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
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .sticker-tab--active {
          background: rgba(255, 255, 255, 0.15);
          color: var(--color-text);
        }
        .sticker-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: var(--gap-xs);
          overflow-y: auto;
          padding-bottom: var(--gap-md);
        }
        .sticker-item {
          aspect-ratio: 1;
          border: none;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.05);
          font-size: 1.8rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background var(--transition-fast);
        }
        .sticker-item:hover {
          background: rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </>
  );
}
