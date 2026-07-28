import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { DICE_SKINS, loadSkinPref, saveSkinPref } from '../game/diceSkins.ts';
import { PIP_MAP } from './Dice3D.tsx';
import { tenorTrending, tenorSearch, tenorRegisterShare, type TenorGif } from '../game/tenor.ts';
import { useInvStore, recommendSounds, MEME_COST_COINS, MEME_COST_STARS, LINK_COST_STARS } from '../inventory.ts';
import { loadProfile, getCoins } from '../profile.ts';
import { memeSoundById, playMemeSound } from '../game/memeSounds.ts';

/**
 * 🎒 Inventory: equip your dice (96px previews, fully responsive), buy
 * memes for your collection (3,500 🪙 or 18 ⭐), link sounds to them
 * (15 ⭐ only, with automatic recommendations), and future pieces/boards.
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
  const buyMeme = useInvStore((s) => s.buyMeme);
  const linkSound = useInvStore((s) => s.linkSound);
  const [available, setAvailable] = useState<TenorGif[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
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
          <button className="inv-back" onClick={goHome}>‹</button>
          <h1 className="inv-title">🎒 Inventario</h1>
          <span className="inv-wallet">🪙{wallet.coins.toLocaleString('es')} · ⭐{wallet.stars}</span>
        </div>

        <div className="inv-tabs">
          {(['dados', 'memes', 'piezas', 'tableros'] as const).map((tb) => (
            <button key={tb} className={`inv-tab ${tab === tb ? 'inv-tab--on' : ''}`} onClick={() => setTab(tb)}>
              {tb === 'dados' ? '🎲 Dados' : tb === 'memes' ? '🎬 Memes' : tb === 'piezas' ? '♟️ Piezas' : '🗺️ Tableros'}
            </button>
          ))}
        </div>

        {tab === 'dados' && (
          <div className="inv-grid">
            {DICE_SKINS.map((skin) => (
              <button
                key={skin.id}
                className={`inv-card ${equipped === skin.id ? 'inv-card--on' : ''}`}
                onClick={() => { saveSkinPref(skin.id); setEquipped(skin.id); }}
              >
                <DicePreview skinId={skin.id} />
                <span className="inv-card-name">{skin.name}</span>
                <span className="inv-card-tag">{equipped === skin.id ? '✅ Equipado' : 'Gratis'}</span>
              </button>
            ))}
            <p className="inv-note">El dado equipado se usa en tus partidas (tú lo ves grande; los rivales lo ven en tu mini-dado). Más modelos con costo llegarán aquí.</p>
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
                      <button className="inv-link-btn" onClick={() => setLinkFor(m.id)}>
                        {m.sound ? `🔊 ${memeSoundById(m.sound)?.name ?? ''}` : `＋🔊 (⭐${LINK_COST_STARS})`}
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
              <button className="inv-search-btn" onClick={search}>🔎</button>
            </div>
            {loading && <p className="inv-note">Cargando…</p>}
            <div className="inv-shop-grid">
              {available.filter((g) => !memes.some((m) => m.id === g.id)).map((gif) => (
                <div key={gif.id} className="inv-shop-item">
                  <img src={gif.preview} alt="GIF" loading="lazy" />
                  <div className="inv-buy-row">
                    <button className="inv-buy" disabled={wallet.coins < MEME_COST_COINS} onClick={() => handleBuy(gif, 'coins')}>🪙{MEME_COST_COINS / 100 / 10}k</button>
                    <button className="inv-buy" disabled={wallet.stars < MEME_COST_STARS} onClick={() => handleBuy(gif, 'stars')}>⭐{MEME_COST_STARS}</button>
                  </div>
                </div>
              ))}
            </div>
            <p className="inv-note">Powered by Tenor · Meme: {MEME_COST_COINS.toLocaleString('es')} 🪙 o {MEME_COST_STARS} ⭐ · Vincular sonido: solo ⭐{LINK_COST_STARS}. Tus memes aparecen en el panel 🎬 y al lanzar 🎁 (con su sonido vinculado).</p>
          </div>
        )}

        {(tab === 'piezas' || tab === 'tableros') && (
          <p className="inv-soon">🔧 {tab === 'piezas' ? 'Skins de piezas' : 'Tableros temáticos'} — próximamente. Se comprarán aquí con 🪙 y ⭐.</p>
        )}

        {linkFor && linked && (
          <div className="inv-modal-bg" onClick={() => setLinkFor(null)}>
            <div className="inv-modal" onClick={(e) => e.stopPropagation()}>
              <p className="inv-sec">Vincular sonido (⭐{LINK_COST_STARS}) — recomendados:</p>
              {recommendSounds(linked.id).map((sid) => (
                <button key={sid} className="inv-snd" onClick={() => { playMemeSound(sid); }}>
                  ▶ {memeSoundById(sid)?.name ?? sid}
                  <span className="inv-snd-buy" onClick={(e) => {
                    e.stopPropagation();
                    if (linkSound(linkFor, sid)) { refreshWallet(); setLinkFor(null); }
                  }}>Vincular</span>
                </button>
              ))}
              <p className="inv-note">Toca ▶ para escuchar; "Vincular" lo compra y lo deja fijo en este meme.</p>
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
        /* 96px dice, shrinking responsively on narrow screens */
        .inv-die { width: clamp(64px, 24vw, 96px); aspect-ratio: 1; border-radius: 18%; display: grid; grid-template-columns: repeat(3,1fr); grid-template-rows: repeat(3,1fr); place-items: center; padding: 15%; background: radial-gradient(circle at 30% 25%, var(--d3-f1,#fff) 0%, var(--d3-f2,#f3eee2) 55%, var(--d3-f3,#ddd3bd) 100%); border: 2px solid var(--d3-bd, rgba(120,100,60,.3)); box-shadow: 0 6px 14px rgba(18,8,60,.35); }
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
      `}</style>
    </div>
  );
}
