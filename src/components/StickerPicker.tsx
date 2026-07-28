import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUICK_PHRASES } from '../game/stickers.ts';
import { GIFS, GIF_PREFIX, TGIF_PREFIX } from '../game/gifs.ts';
import { tenorSearch, tenorTrending, tenorRegisterShare, type TenorGif } from '../game/tenor.ts';
import { MEME_SOUNDS, SND_PREFIX } from '../game/memeSounds.ts';
import { useFavStore } from '../favorites.ts';
import GifSticker from './GifSticker.tsx';

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the reaction payload (`gif:<id>` or `snd:<id>`). */
  onStickerSelect: (payload: string) => void;
  /** Quick phrases go to the chat as text messages. */
  onPhraseSelect: (text: string) => void;
  /** True when this player already used their ONE sound this turn. */
  soundsLocked?: boolean;
}

/** Bottom-sheet panel with animated GIF stickers + quick phrases. */
export default function StickerPicker({ isOpen, onClose, onStickerSelect, onPhraseSelect, soundsLocked }: StickerPickerProps) {
  const [activeTab, setActiveTab] = useState<'gifs' | 'sonidos' | 'frases'>('gifs');
  const favs = useFavStore((s) => s.favs);
  const toggleFav = useFavStore((s) => s.toggleFav);

  // Tenor GIF search: trending on open, live results on search
  const [query, setQuery] = useState('');
  const [tenorGifs, setTenorGifs] = useState<TenorGif[]>([]);
  const [tenorLoading, setTenorLoading] = useState(false);
  const lastQuery = useRef('trending');
  const trendingLoaded = useRef(false);

  useEffect(() => {
    if (!isOpen || activeTab !== 'gifs' || trendingLoaded.current) return;
    trendingLoaded.current = true;
    setTenorLoading(true);
    tenorTrending(16)
      .then(setTenorGifs)
      .catch(() => { /* offline/blocked — bundled stickers still work */ })
      .finally(() => setTenorLoading(false));
  }, [isOpen, activeTab]);

  const runSearch = () => {
    const q = query.trim();
    setTenorLoading(true);
    lastQuery.current = q || 'trending';
    (q ? tenorSearch(q, 16) : tenorTrending(16))
      .then(setTenorGifs)
      .catch(() => setTenorGifs([]))
      .finally(() => setTenorLoading(false));
  };

  const handleTenorClick = (gif: TenorGif) => {
    onStickerSelect(`${TGIF_PREFIX}${gif.url}`);
    tenorRegisterShare(gif.id, lastQuery.current);
    onClose();
  };

  const handleGifClick = (id: string) => {
    onStickerSelect(`${GIF_PREFIX}${id}`);
    onClose();
  };

  const handlePhraseClick = (text: string) => {
    onPhraseSelect(text);
    onClose();
  };

  const handleSoundClick = (id: string) => {
    if (soundsLocked) return; // one sound per turn
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
              <>
                <p className={`sticker-sound-note ${soundsLocked ? 'sticker-sound-note--locked' : ''}`}>
                  {soundsLocked ? '⏳ Ya usaste tu sonido este turno' : '🔊 1 sonido por turno'}
                </p>
                <div className="sticker-sounds">
                  {MEME_SOUNDS.map((snd, i) => {
                    const payload = `${SND_PREFIX}${snd.id}`;
                    const isFav = favs.includes(payload);
                    return (
                      <motion.div
                        key={snd.id}
                        className={`sticker-sound ${soundsLocked ? 'sticker-sound--locked' : ''}`}
                        role="button"
                        onClick={() => handleSoundClick(snd.id)}
                        whileTap={soundsLocked ? {} : { scale: 0.94 }}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.015, 0.4) }}
                      >
                        <span className="sticker-sound-name">🔊 {snd.name}</span>
                        <button
                          className={`sticker-fav ${isFav ? 'sticker-fav--on' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleFav(payload); }}
                          aria-label="favorito"
                        >
                          {isFav ? '⭐' : '☆'}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </>
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
              <div className="sticker-gifs-wrap">
                <div className="sticker-search-row">
                  <input
                    className="sticker-search"
                    type="text"
                    placeholder="Buscar GIFs…"
                    value={query}
                    maxLength={60}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                  <button className="sticker-search-btn" onClick={runSearch} aria-label="buscar">🔎</button>
                </div>

                {tenorLoading && <p className="sticker-tenor-note">Cargando GIFs…</p>}
                {!tenorLoading && tenorGifs.length > 0 && (
                  <>
                    <div className="sticker-tenor-grid">
                      {tenorGifs.map((gif) => (
                        <button
                          key={gif.id + gif.url}
                          className="sticker-tenor-item"
                          onClick={() => handleTenorClick(gif)}
                        >
                          <img src={gif.preview} alt="GIF" loading="lazy" draggable={false} />
                        </button>
                      ))}
                    </div>
                    <p className="sticker-tenor-note">Powered by Klipy</p>
                  </>
                )}

              <div className="sticker-grid">
                {GIFS.map((gif, i) => {
                  const payload = `${GIF_PREFIX}${gif.id}`;
                  const isFav = favs.includes(payload);
                  return (
                    <motion.div
                      key={gif.id}
                      className="sticker-item"
                      role="button"
                      onClick={() => handleGifClick(gif.id)}
                      whileTap={{ scale: 0.85 }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.35) }}
                    >
                      <GifSticker id={gif.id} size={54} />
                      <span className="sticker-item-label">{gif.label}</span>
                      <button
                        className={`sticker-fav sticker-fav--corner ${isFav ? 'sticker-fav--on' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleFav(payload); }}
                        aria-label="favorito"
                      >
                        {isFav ? '⭐' : '☆'}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
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
        .sticker-gifs-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          min-height: 0;
        }
        .sticker-search-row {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .sticker-search {
          flex: 1;
          min-width: 0;
          padding: 8px 12px;
          border-radius: var(--radius-full);
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 700;
          outline: none;
        }
        .sticker-search::placeholder { color: var(--color-text-muted); }
        .sticker-search-btn {
          width: 38px;
          border-radius: var(--radius-full);
          border: none;
          background: rgba(255, 255, 255, 0.14);
          cursor: pointer;
          font-size: 0.9rem;
        }
        .sticker-tenor-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          flex-shrink: 0;
        }
        .sticker-tenor-item {
          padding: 0;
          border: none;
          border-radius: var(--radius-md);
          overflow: hidden;
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
          aspect-ratio: 1;
        }
        .sticker-tenor-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .sticker-tenor-note {
          text-align: center;
          font-size: 0.62rem;
          font-weight: 700;
          color: var(--color-text-muted);
          flex-shrink: 0;
        }
        .sticker-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          grid-auto-rows: max-content;
          align-content: start;
          gap: var(--gap-sm);
          overflow-y: auto;
          min-height: 0;
          padding-bottom: var(--gap-sm);
        }
        .sticker-item {
          position: relative;
          cursor: pointer;
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
        .sticker-sound-note {
          font-size: 0.72rem;
          font-weight: 800;
          color: var(--color-text-muted);
          text-align: center;
        }
        .sticker-sound-note--locked {
          color: #ffb0bb;
        }
        .sticker-sounds {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          /* Rows keep their natural height and the LIST scrolls — without
             this the grid squashes all rows into the panel height and
             every title gets clipped by the next one. */
          grid-auto-rows: max-content;
          align-content: start;
          gap: 7px;
          overflow-y: auto;
          min-height: 0;
          padding-bottom: var(--gap-sm);
        }
        .sticker-sound {
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          text-align: left;
          padding: 8px 12px;
          border: none;
          border-radius: var(--radius-lg);
          background: rgba(255, 255, 255, 0.1);
          color: var(--color-text);
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 700;
          line-height: 1.2;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: background var(--transition-fast);
        }
        .sticker-sound:hover {
          background: rgba(255, 255, 255, 0.18);
        }
        .sticker-sound--locked {
          opacity: 0.45;
          cursor: default;
        }
        .sticker-sound-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .sticker-fav {
          flex-shrink: 0;
          width: 26px;
          height: 26px;
          border: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
          color: var(--color-text-muted);
          font-size: 0.8rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
        }
        .sticker-fav--on {
          color: #ffd65a;
          background: rgba(255, 214, 90, 0.18);
        }
        .sticker-fav--corner {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 22px;
          height: 22px;
          font-size: 0.7rem;
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
