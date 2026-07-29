import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { DICE_SKINS, DICE_COLLECTIONS, RARITY_INFO, loadSkinPref, saveSkinPref } from '../game/diceSkins.ts';
import { PIP_MAP } from './Dice3D.tsx';
import { tenorTrending, tenorSearch, tenorRegisterShare, type TenorGif } from '../game/tenor.ts';
import { useInvStore, recommendSounds, allSoundIds, MEME_COST_COINS, MEME_COST_STARS, LINK_COST_STARS } from '../inventory.ts';
import { loadProfile, getCoins } from '../profile.ts';
import { memeSoundById, playMemeSound } from '../game/memeSounds.ts';
import {
  Backpack, Check, ChevronLeft, Coins, Dices, Film, Lock, Map as MapIcon,
  Play, Search, Shapes, Star, Volume2,
} from 'lucide-react';

/**
 * Inventory: buy + equip dice (8 vectorized skins, 3,000–40,000 puntos by
 * tier), buy memes for your collection (3,500 puntos or 18 stars), link
 * sounds to them (15 stars, with automatic recommendations), and future
 * pieces/boards.
 */

function DicePreview({ skinId, value = 6 }: { skinId: string; value?: number }) {
  const skin = DICE_SKINS.find((s) => s.id === skinId) ?? DICE_SKINS[0];
  const pips = PIP_MAP[value];
  return (
    <div className="inv-die" style={skin.vars as React.CSSProperties}>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={pips.includes(i) ? 'inv-die-pip' : 'inv-die-pip inv-die-pip--off'} />
      ))}
    </div>
  );
}

export default function InventoryScreen() {
  const goHome = useGameStore((s) => s.goHome);
  const [tab, setTab] = useState<'dados' | 'memes' | 'piezas' | 'tableros'>('dados');
  const [equipped, setEquipped] = useState(loadSkinPref);
  const memes = useInvStore((s) => s.memes);
  const ownedDice = useInvStore((s) => s.dice);
  const buyMeme = useInvStore((s) => s.buyMeme);
  const buyDice = useInvStore((s) => s.buyDice);
  const linkSound = useInvStore((s) => s.linkSound);
  const [available, setAvailable] = useState<TenorGif[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [showAllSounds, setShowAllSounds] = useState(false);
  const [soundQuery, setSoundQuery] = useState('');
  const [wallet, setWallet] = useState({ coins: getCoins(), stars: loadProfile()?.points ?? 0 });
  const refreshWallet = () => setWallet({ coins: getCoins(), stars: loadProfile()?.points ?? 0 });

  useEffect(() => {
    if (tab !== 'memes' || available.length > 0) return;
    setLoading(true);
    tenorTrending(30).then(setAvailable).catch(() => {}).finally(() => setLoading(false));
  }, [tab, available.length]);

  const search = () => {
    setLoading(true);
    (query.trim() ? tenorSearch(query.trim(), 30) : tenorTrending(30))
      .then(setAvailable).catch(() => setAvailable([])).finally(() => setLoading(false));
  };

  const handleBuy = (gif: TenorGif, payWith: 'coins' | 'stars') => {
    const ok = buyMeme({ id: gif.id, url: gif.url, preview: gif.preview }, payWith);
    if (ok) { tenorRegisterShare(gif.id, query || 'inventario'); refreshWallet(); }
  };

  const linked = memes.find((m) => m.id === linkFor);

  return (
    <div className="screen">
      <div className="screen-inner inv-inner">
        <div className="inv-header">
          <button className="inv-back" onClick={goHome} aria-label="Volver"><ChevronLeft size={22} /></button>
          <h1 className="inv-title"><Backpack size={19} className="inv-ico" /> Inventario</h1>
          <span className="inv-wallet">
            <Coins size={12} className="inv-ico" />{wallet.coins.toLocaleString('es')} · <Star size={12} className="inv-ico" />{wallet.stars}
          </span>
        </div>

        <div className="inv-tabs">
          {(['dados', 'memes', 'piezas', 'tableros'] as const).map((tb) => (
            <button key={tb} className={`inv-tab ${tab === tb ? 'inv-tab--on' : ''}`} onClick={() => setTab(tb)}>
              {tb === 'dados' ? <><Dices size={13} className="inv-ico" /> Dados</>
                : tb === 'memes' ? <><Film size={13} className="inv-ico" /> Memes</>
                : tb === 'piezas' ? <><Shapes size={13} className="inv-ico" /> Piezas</>
                : <><MapIcon size={13} className="inv-ico" /> Tableros</>}
            </button>
          ))}
        </div>

        {tab === 'dados' && (
          <div className="inv-dice-cols">
            <p className="inv-note">
              {DICE_SKINS.length} dados en {DICE_COLLECTIONS.length} colecciones · 3.000 a 40.000 puntos por rareza.
              El equipado se usa en tus partidas (los rivales lo ven en tu mini-dado).
            </p>
            {DICE_COLLECTIONS.map((col) => (
              <div key={col}>
                <p className="inv-sec inv-collection">{col}</p>
                <div className="inv-grid">
                  {DICE_SKINS.filter((sk) => sk.collection === col).map((skin) => {
                    const owned = skin.price === 0 || ownedDice.includes(skin.id);
                    const isOn = equipped === skin.id;
                    const canAfford = wallet.coins >= skin.price;
                    const rar = RARITY_INFO[skin.rarity];
                    return (
                      <button
                        key={skin.id}
                        className={`inv-card ${isOn ? 'inv-card--on' : ''} ${!owned ? 'inv-card--locked' : ''}`}
                        onClick={() => {
                          if (owned) { saveSkinPref(skin.id); setEquipped(skin.id); return; }
                          if (buyDice(skin.id, skin.price)) {
                            refreshWallet();
                            saveSkinPref(skin.id);
                            setEquipped(skin.id);
                          }
                        }}
                        disabled={!owned && !canAfford}
                      >
                        <span className="inv-rarity" style={{ color: rar.color, borderColor: rar.color }}>{rar.name}</span>
                        <DicePreview skinId={skin.id} />
                        <span className="inv-card-name">{skin.name}</span>
                        {isOn ? (
                          <span className="inv-card-tag inv-card-tag--on"><Check size={10} className="inv-ico" /> Equipado</span>
                        ) : owned ? (
                          <span className="inv-card-tag">Tocar para equipar</span>
                        ) : (
                          <span className="inv-card-tag inv-card-tag--price">
                            {canAfford ? <Coins size={10} className="inv-ico" /> : <Lock size={10} className="inv-ico" />} {skin.price.toLocaleString('es')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'memes' && (
          <div className="inv-memes">
            {memes.length > 0 && (
              <>
                <p className="inv-sec">Tus memes ({memes.length})</p>
                <div className="inv-own-grid">
                  {memes.map((m) => (
                    <div key={m.id} className="inv-own">
                      <img src={m.preview || m.url} alt="meme" loading="lazy" />
                      <button className="inv-link-btn" onClick={() => { setLinkFor(m.id); setShowAllSounds(false); setSoundQuery(''); }}>
                        <Volume2 size={10} className="inv-ico" /> {m.sound ? (memeSoundById(m.sound)?.name ?? '') : `Vincular sonido (${LINK_COST_STARS} estrellas)`}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="inv-sec">Disponibles hoy</p>
            <div className="inv-search-row">
              <input className="inv-search" placeholder="Buscar memes…" value={query} maxLength={60}
                onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
              <button className="inv-search-btn" onClick={search} aria-label="buscar"><Search size={16} /></button>
            </div>
            {loading && <p className="inv-note">Cargando…</p>}
            <div className="inv-shop-grid">
              {available.filter((g) => !memes.some((m) => m.id === g.id)).map((gif) => (
                <div key={gif.id} className="inv-shop-item">
                  <img src={gif.preview} alt="GIF" loading="lazy" />
                  <div className="inv-buy-row">
                    <button className="inv-buy" disabled={wallet.coins < MEME_COST_COINS} onClick={() => handleBuy(gif, 'coins')}><Coins size={10} className="inv-ico" />{MEME_COST_COINS / 100 / 10}k</button>
                    <button className="inv-buy" disabled={wallet.stars < MEME_COST_STARS} onClick={() => handleBuy(gif, 'stars')}><Star size={10} className="inv-ico" />{MEME_COST_STARS}</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="inv-note">Meme: {MEME_COST_COINS.toLocaleString('es')} puntos o {MEME_COST_STARS} estrellas · Vincular sonido: {LINK_COST_STARS} estrellas. Tus memes son lo ÚNICO usable en partida: aparecen en tu barra rápida, en el panel de memes y al lanzar con el botón de regalo (siempre con su sonido).</p>
          </div>
        )}

        {(tab === 'piezas' || tab === 'tableros') && (
          <p className="inv-soon">{tab === 'piezas' ? 'Skins de piezas' : 'Tableros temáticos'} — próximamente. Se comprarán aquí con puntos y estrellas.</p>
        )}

        {linkFor && linked && (
          <div className="inv-modal-bg" onClick={() => setLinkFor(null)}>
            <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
              <p className="inv-sec">Vincular sonido ({LINK_COST_STARS} estrellas) — recomendados:</p>
              {recommendSounds(linked.id).map((sid) => (
                <button key={sid} className="inv-snd" onClick={() => { playMemeSound(sid); }}>
                  <span><Play size={11} className="inv-ico" /> {memeSoundById(sid)?.name ?? sid}</span>
                  <span className="inv-snd-buy" onClick={(e) => {
                    e.stopPropagation();
                    if (linkSound(linkFor, sid)) { refreshWallet(); setLinkFor(null); }
                  }}>Vincular</span>
                </button>
              ))}

              {!showAllSounds ? (
                <button className="inv-more-snd" onClick={() => setShowAllSounds(true)}>
                  <Volume2 size={12} className="inv-ico" /> Más sonidos ({allSoundIds().length} disponibles)
                </button>
              ) : (
                <>
                  <p className="inv-sec">Todos los sonidos:</p>
                  <div className="inv-search-row">
                    <input className="inv-search" type="text" placeholder="Buscar sonido…"
                      value={soundQuery} autoFocus
                      onChange={(e) => setSoundQuery(e.target.value)} />
                    <Search size={14} className="inv-ico" />
                  </div>
                  <div className="inv-snd-all">
                    {allSoundIds()
                      .filter((sid) => (memeSoundById(sid)?.name ?? sid).toLowerCase().includes(soundQuery.toLowerCase()))
                      .map((sid) => (
                        <button key={sid} className="inv-snd" onClick={() => { playMemeSound(sid); }}>
                          <span><Play size={11} className="inv-ico" /> {memeSoundById(sid)?.name ?? sid}</span>
                          <span className="inv-snd-buy" onClick={(e) => {
                            e.stopPropagation();
                            if (linkSound(linkFor, sid)) { refreshWallet(); setLinkFor(null); }
                          }}>Vincular</span>
                        </button>
                      ))}
                  </div>
                </>
              )}
              <p className="inv-note">Toca el nombre para escucharlo; "Vincular" lo compra y lo deja fijo en este meme.</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .inv-inner { max-width: 480px; gap: 12px; padding-top: calc(14px + env(safe-area-inset-top)); }
        .inv-header { display: flex; align-items: center; gap: 10px; }
        .inv-back { width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(255,255,255,.22); background: rgba(255,255,255,.1); color: var(--color-text); font-size: 1.5rem; cursor: pointer; }
        .inv-title { font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; flex: 1; }
        .inv-wallet { font-family: var(--font-display); font-size: .78rem; font-weight: 800; color: #ffd65a; }
        .inv-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .inv-tab { padding: 7px 12px; border-radius: var(--radius-full); border: none; background: rgba(255,255,255,.1); color: var(--color-text-secondary); font-family: var(--font-display); font-size: .78rem; font-weight: 800; cursor: pointer; }
        .inv-tab--on { background: rgba(255,214,90,.2); color: #ffd65a; }
        .inv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
        .inv-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; border-radius: var(--radius-lg); border: 2px solid rgba(255,255,255,.14); background: rgba(255,255,255,.07); cursor: pointer; }
        .inv-card--on { border-color: #ffd65a; background: rgba(255,214,90,.14); }
        .inv-card--locked { opacity: .85; }
        .inv-card:disabled { opacity: .45; cursor: default; }
        .inv-ico { vertical-align: -2px; display: inline; }
        .inv-back { display: flex; align-items: center; justify-content: center; }
        .inv-card-tag--on { color: #7dffb8; }
        .inv-card-tag--price { color: #ffd65a; }
        /* 96px dice, shrinking responsively on narrow screens */
        .inv-die { width: clamp(64px, 24vw, 96px); aspect-ratio: 1; border-radius: 18%; display: grid; grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(3,1fr); place-items: center; padding: 15%; background-image: var(--d3-pattern, linear-gradient(transparent, transparent)), radial-gradient(circle at 30% 25%, var(--d3-f1,#fff) 0%, var(--d3-f2,#f3eee2) 55%, var(--d3-f3,#ddd3bd) 100%); border: 2px solid var(--d3-bd, rgba(120,100,60,.3)); box-shadow: 0 6px 14px rgba(18,8,60,.35), 0 0 16px var(--d3-glow, transparent); }
        .inv-dice-cols { display: flex; flex-direction: column; gap: 12px; }
        .inv-collection { font-size: .95rem; color: #ffd65a; border-bottom: 1.5px solid rgba(255,214,90,.25); padding-bottom: 4px; }
        .inv-rarity { font-size: .56rem; font-weight: 800; border: 1.2px solid; border-radius: 8px; padding: 1px 7px; text-transform: uppercase; letter-spacing: .5px; }
        .inv-die-pip { width: 70%; height: 70%; border-radius: 50%; background: radial-gradient(circle at 35% 30%, var(--d3-p1,#6b5cf0), var(--d3-p2,#4534b8) 70%, var(--d3-p3,#32247e)); }
        .inv-die-pip--off { visibility: hidden; }
        .inv-card-name { font-family: var(--font-display); font-size: .8rem; font-weight: 800; }
        .inv-card-tag { font-size: .64rem; font-weight: 800; color: var(--color-text-muted); }
        .inv-note { grid-column: 1/-1; font-size: .7rem; font-weight: 700; color: var(--color-text-muted); text-align: center; }
        .inv-sec { font-family: var(--font-display); font-size: .82rem; font-weight: 800; color: var(--color-text-secondary); }
        .inv-memes { display: flex; flex-direction: column; gap: 10px; }
        .inv-own-grid, .inv-shop-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .inv-own img, .inv-shop-item img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; display: block; }
        .inv-own, .inv-shop-item { display: flex; flex-direction: column; gap: 4px; }
        .inv-link-btn { border: none; border-radius: 8px; background: rgba(255,214,90,.15); color: #ffd65a; font-size: .6rem; font-weight: 800; padding: 4px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .inv-buy-row { display: flex; gap: 4px; }
        .inv-buy { flex: 1; border: none; border-radius: 8px; background: rgba(255,255,255,.12); color: var(--color-text); font-size: .62rem; font-weight: 800; padding: 4px 2px; cursor: pointer; }
        .inv-buy:disabled { opacity: .4; cursor: default; }
        .inv-search-row { display: flex; gap: 6px; }
        .inv-search { flex: 1; min-width: 0; padding: 8px 12px; border-radius: var(--radius-full); border: 1.5px solid rgba(255,255,255,.2); background: rgba(255,255,255,.1); color: var(--color-text); font-weight: 700; outline: none; }
        .inv-search-btn { width: 40px; border-radius: var(--radius-full); border: none; background: rgba(255,255,255,.14); cursor: pointer; }
        .inv-soon { text-align: center; padding: 36px 16px; font-weight: 800; color: var(--color-text-secondary); background: rgba(255,255,255,.07); border-radius: var(--radius-xl); }
        .inv-modal-bg { position: fixed; inset: 0; z-index: 95; background: rgba(12,5,40,.6); display: flex; align-items: center; justify-content: center; padding: 18px; }
        .inv-modal { width: min(380px,100%); max-height: 70vh; overflow-y: auto; background: linear-gradient(165deg,#3d2b8f,#241865); border: 2px solid rgba(255,214,90,.45); border-radius: 18px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .inv-snd { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: none; border-radius: 10px; background: rgba(255,255,255,.1); color: var(--color-text); font-size: .78rem; font-weight: 700; padding: 9px 10px; cursor: pointer; text-align: left; }
        .inv-snd-buy { background: #ffd65a; color: #241865; border-radius: 8px; padding: 3px 9px; font-weight: 800; font-size: .7rem; }
        .inv-more-snd { display: flex; align-items: center; justify-content: center; gap: 6px; border: 1.5px dashed rgba(255,214,90,.5); border-radius: 10px; background: rgba(255,214,90,.08); color: #ffd65a; font-size: .78rem; font-weight: 800; padding: 9px 10px; cursor: pointer; }
        .inv-snd-all { display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; }
      `}</style>
    </div>
  );
}
