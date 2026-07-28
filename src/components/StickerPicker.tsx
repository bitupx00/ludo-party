import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { QUICK_PHRASES } from '../game/stickers.ts';
import { memePayload } from '../game/gifs.ts';
import { memeSoundById } from '../game/memeSounds.ts';
import { useInvStore, soundForMeme } from '../inventory.ts';
import { useT } from '../i18n.ts';
import { Backpack, Hourglass, MessageSquareText, Volume2, X } from 'lucide-react';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the reaction payload (`meme:<sound>|<url>`). */
  onStickerSelect: (payload: string) => void;
  /** Quick phrases go to the chat as text messages. */
  onPhraseSelect: (text: string) => void;
  /** True when this player already used their ONE sound this turn. */
  soundsLocked?: boolean;
}

/** Bottom-sheet panel: the user's PURCHASED memes (each paired with its
 *  linked sound) + quick phrases. Free stickers/GIF search/sound lists are
 *  gone — only inventory purchases are usable. */
export default function StickerPicker({ isOpen, onClose, onStickerSelect, onPhraseSelect, soundsLocked }: StickerPickerProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<'memes' | 'frases'>('memes');
  const memes = useInvStore((s) => s.memes);

  const handleMemeClick = (idx: number) => {
    if (soundsLocked) return; // every meme carries a sound: one per turn
    const m = memes[idx];
    onStickerSelect(memePayload(soundForMeme(m), m.url));
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
              <button
                className={`sticker-tab ${activeTab === 'memes' ? 'sticker-tab--active' : ''}`}
                onClick={() => setActiveTab('memes')}
              >
                <Backpack size={14} className="sticker-tab-ico" /> {t('myMemes')}
              </button>
              <button
                className={`sticker-tab ${activeTab === 'frases' ? 'sticker-tab--active' : ''}`}
                onClick={() => setActiveTab('frases')}
              >
                <MessageSquareText size={14} className="sticker-tab-ico" /> Frases
              </button>
              <button className="sticker-close" onClick={onClose} aria-label="cerrar"><X size={15} /></button>
            </div>

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
              <>
                <p className={`sticker-sound-note ${soundsLocked ? 'sticker-sound-note--locked' : ''}`}>
                  {soundsLocked
                    ? <><Hourglass size={12} className="sticker-tab-ico" /> Ya usaste tu meme este turno</>
                    : <><Volume2 size={12} className="sticker-tab-ico" /> 1 meme con sonido por turno</>}
                </p>
                {memes.length === 0 ? (
                  <p className="sticker-own-empty">{t('noMemesOwned')}</p>
                ) : (
                  <div className="sticker-own-grid">
                    {memes.map((m, i) => {
                      const snd = memeSoundById(soundForMeme(m));
                      return (
                        <motion.button
                          key={m.id}
                          className={`sticker-own ${soundsLocked ? 'sticker-own--locked' : ''}`}
                          onClick={() => handleMemeClick(i)}
                          whileTap={soundsLocked ? {} : { scale: 0.88 }}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.02, 0.3) }}
                        >
                          <img src={m.preview || m.url} alt="Meme" loading="lazy" draggable={false} />
                          {snd && <span className="sticker-own-snd">{snd.name}</span>}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </>
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
          max-height: 62vh;
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
          display: inline-flex;
          align-items: center;
          gap: 5px;
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
        .sticker-tab-ico { flex-shrink: 0; vertical-align: -2px; }
        .sticker-close {
          margin-left: auto;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.14);
          color: var(--color-text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sticker-sound-note {
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--color-text-muted);
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .sticker-sound-note--locked {
          color: #ffb0bb;
        }
        .sticker-own-empty {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-align: center;
          padding: 22px 14px;
          line-height: 1.5;
        }
        .sticker-own-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-auto-rows: max-content;
          align-content: start;
          gap: 8px;
          overflow-y: auto;
          min-height: 0;
          padding-bottom: var(--gap-sm);
        }
        .sticker-own {
          position: relative;
          padding: 0;
          border: none;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
          aspect-ratio: 1;
        }
        .sticker-own img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .sticker-own--locked { opacity: 0.4; cursor: default; }
        .sticker-own-snd {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          font-size: 0.55rem;
          font-weight: 800;
          color: #fff;
          background: rgba(10, 4, 40, 0.72);
          padding: 2px 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sticker-phrases {
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-y: auto;
          min-height: 0;
          padding-bottom: var(--gap-sm);
        }
        .sticker-phrase { flex-shrink: 0; }
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
