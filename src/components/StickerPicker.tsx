import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUICK_PHRASES } from '../game/stickers.ts';
import { GIFS, GIF_PREFIX } from '../game/gifs.ts';
import { MEME_SOUNDS, SND_PREFIX } from '../game/memeSounds.ts';
import GifSticker from './GifSticker.tsx';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the reaction payload (`gif:<id>`). */
  onStickerSelect: (payload: string) => void;
  /** Quick phrases go to the chat as text messages. */
  onPhraseSelect: (text: string) => void;
}

/** Bottom-sheet panel with animated GIF stickers + quick phrases. */
export default function StickerPicker({ isOpen, onClose, onStickerSelect, onPhraseSelect }: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<'gifs' | 'sonidos' | 'frases'>('gifs');

  const handleGifClick = (id: string) => {
    onStickerSelect(`${GIF_PREFIX}${id}`);
    onClose();
  };

  const handlePhraseClick = (text: string) => {
    onPhraseSelect(text);
    onClose();
  };

  const handleSoundClick = (id: string) => {
    onStickerSelect(`${SND_PREFIX}${id}`);
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
              <button
                className={`sticker-tab ${activeTab === 'gifs' ? 'sticker-tab--active' : ''}`}
                onClick={() => setActiveTab('gifs')}
              >
                🎬 GIFs
              </button>
              <button
                className={`sticker-tab ${activeTab === 'sonidos' ? 'sticker-tab--active' : ''}`}
                onClick={() => setActiveTab('sonidos')}
              >
                🔊 Sonidos
              </button>
              <button
                className={`sticker-tab ${activeTab === 'frases' ? 'sticker-tab--active' : ''}`}
                onClick={() => setActiveTab('frases')}
              >
                💬 Frases
              </button>
              <button className="sticker-close" onClick={onClose} aria-label="✕">✕</button>
            </div>

            {activeTab === 'sonidos' ? (
              <div className="sticker-sounds">
                {MEME_SOUNDS.map((snd, i) => (
                  <motion.button
                    key={snd.id}
                    className="sticker-sound"
                    onClick={() => handleSoundClick(snd.id)}
                    whileTap={{ scale: 0.94 }}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.4) }}
                  >
                    🔊 {snd.name}
                  </motion.button>
                ))}
              </div>
            ) : activeTab === 'frases' ? (
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
                {GIFS.map((gif, i) => (
                  <motion.button
                    key={gif.id}
                    className="sticker-item"
                    onClick={() => handleGifClick(gif.id)}
                    whileTap={{ scale: 0.8 }}
                    whileHover={{ scale: 1.08 }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <GifSticker id={gif.id} size={54} />
                    <span className="sticker-item-label">{gif.label}</span>
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
          /* Centered via auto margins — framer-motion owns this element's
             transform (y slide animation) and would clobber a CSS
             translateX(-50%), shoving the panel off to the right. */
          left: 0;
          right: 0;
          margin: 0 auto;
          width: min(560px, 100%);
          max-height: 54vh;
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
          grid-template-columns: repeat(5, 1fr);
          gap: var(--gap-sm);
          overflow-y: auto;
          padding-bottom: var(--gap-sm);
        }
        .sticker-item {
          border: none;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px 2px 6px;
          transition: background var(--transition-fast);
        }
        .sticker-item:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .sticker-item-label {
          font-family: var(--font-display);
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: var(--color-text-secondary);
        }
        .sticker-sounds {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          overflow-y: auto;
          padding-bottom: var(--gap-sm);
        }
        .sticker-sound {
          text-align: left;
          padding: 9px 12px;
          border: none;
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: background var(--transition-fast);
        }
        .sticker-sound:hover {
          background: rgba(255, 255, 255, 0.18);
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
