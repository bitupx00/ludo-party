import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore.ts';
import { ensureProfile, loadProfile, saveProfile, getCoins } from '../profile.ts';
import { playSfx } from '../sound.ts';

/**
 * 🕹️ Arcade: algorithmically-generated PUZZLES (sliding 8-puzzle, 3:00
 * limit) and MINIGAMES (memory pairs). Daily limits: 10 puzzles + 10
 * minigames per day. Rewards:
 *  - Puzzle: surprise — either stars (5-15) or coins (1,000-10,000 in
 *    ROUND thousands only: 3000, 5000, 7000… never 4598).
 *  - Minigame: coins only (1,000-3,000 round thousands).
 */

const LIMIT_KEY = 'ludo-party-arcade';
const DAILY_LIMIT = 10;

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function usage(): { puzzles: number; minis: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(LIMIT_KEY) || '{}');
    if (raw.date !== todayStr()) return { puzzles: 0, minis: 0 };
    return { puzzles: raw.puzzles ?? 0, minis: raw.minis ?? 0 };
  } catch { return { puzzles: 0, minis: 0 }; }
}

function bumpUsage(kind: 'puzzles' | 'minis') {
  const u = usage();
  u[kind]++;
  try { localStorage.setItem(LIMIT_KEY, JSON.stringify({ date: todayStr(), ...u })); } catch { /* noop */ }
}

/** Round-thousands coin roll between min..max inclusive. */
function roundCoins(minK: number, maxK: number): number {
  return (minK + Math.floor(Math.random() * (maxK - minK + 1))) * 1000;
}

function grantReward(kind: 'puzzle' | 'mini'): string {
  ensureProfile('');
  const p = loadProfile();
  if (!p) return '';
  if (kind === 'puzzle' && Math.random() < 0.4) {
    const stars = 5 + Math.floor(Math.random() * 11); // 5-15 ⭐
    p.points = Math.min(99999, p.points + stars);
    saveProfile(p);
    return `⭐ +${stars} star`;
  }
  const coins = kind === 'puzzle' ? roundCoins(1, 10) : roundCoins(1, 3);
  p.coins = Math.min(99999999, (p.coins ?? 0) + coins);
  saveProfile(p);
  return `🪙 +${coins.toLocaleString('es')} puntos`;
}

/* ── Sliding 8-puzzle (always solvable: shuffled by legal moves) ────── */

function shuffled(): number[] {
  const b = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let blank = 8;
  for (let i = 0; i < 120; i++) {
    const r = Math.floor(blank / 3), c = blank % 3;
    const opts = [
      r > 0 ? blank - 3 : -1, r < 2 ? blank + 3 : -1,
      c > 0 ? blank - 1 : -1, c < 2 ? blank + 1 : -1,
    ].filter((x) => x >= 0);
    const pick = opts[Math.floor(Math.random() * opts.length)];
    [b[blank], b[pick]] = [b[pick], b[blank]];
    blank = pick;
  }
  return b;
}

function Puzzle({ onWin, onFail }: { onWin: () => void; onFail: () => void }) {
  const [board, setBoard] = useState<number[]>(shuffled);
  const [left, setLeft] = useState(180);
  const done = board.every((v, i) => v === (i === 8 ? 0 : i + 1));
  const doneRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (done && !doneRef.current) { doneRef.current = true; onWin(); }
    else if (left <= 0 && !doneRef.current) { doneRef.current = true; onFail(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, left]);
  const tap = (i: number) => {
    const blank = board.indexOf(0);
    const [r, c] = [Math.floor(i / 3), i % 3];
    const [br, bc] = [Math.floor(blank / 3), blank % 3];
    if (Math.abs(r - br) + Math.abs(c - bc) !== 1) return;
    playSfx('click');
    const next = [...board];
    [next[i], next[blank]] = [next[blank], next[i]];
    setBoard(next);
  };
  return (
    <div className="arc-puzzle">
      <p className="arc-timer">⏱ {Math.floor(left / 60)}:{String(Math.max(left, 0) % 60).padStart(2, '0')}</p>
      <div className="arc-grid3">
        {board.map((v, i) => (
          <button key={i} className={`arc-cell ${v === 0 ? 'arc-cell--blank' : ''}`} onClick={() => tap(i)}>
            {v || ''}
          </button>
        ))}
      </div>
      <p className="arc-note">Ordena 1-8 antes de que acabe el tiempo</p>
    </div>
  );
}

/* ── Memory pairs minigame ──────────────────────────────────────────── */

const MEMO_EMOJIS = ['🐶', '🎲', '💩', '🔥', '👑', '💀'];

function Memory({ onWin }: { onWin: () => void }) {
  const [cards] = useState(() =>
    [...MEMO_EMOJIS, ...MEMO_EMOJIS].map((e, i) => ({ e, i })).sort(() => Math.random() - 0.5));
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<Set<string>>(new Set());
  const wonRef = useRef(false);
  const flip = (idx: number) => {
    if (open.includes(idx) || found.has(cards[idx].e) || open.length === 2) return;
    playSfx('pop');
    const next = [...open, idx];
    setOpen(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (cards[a].e === cards[b].e) {
        const nf = new Set(found); nf.add(cards[a].e);
        setTimeout(() => { setFound(nf); setOpen([]); if (nf.size === MEMO_EMOJIS.length && !wonRef.current) { wonRef.current = true; onWin(); } }, 350);
      } else {
        setTimeout(() => setOpen([]), 700);
      }
    }
  };
  return (
    <div className="arc-puzzle">
      <div className="arc-grid4">
        {cards.map((c, idx) => {
          const shown = open.includes(idx) || found.has(c.e);
          return (
            <button key={idx} className={`arc-cell arc-cell--memo ${shown ? '' : 'arc-cell--hidden'}`} onClick={() => flip(idx)}>
              {shown ? c.e : '🐾'}
            </button>
          );
        })}
      </div>
      <p className="arc-note">Encuentra los 6 pares</p>
    </div>
  );
}

export default function ArcadeScreen() {
  const goHome = useGameStore((s) => s.goHome);
  const [tab, setTab] = useState<'puzzles' | 'minis'>('puzzles');
  const [playing, setPlaying] = useState<null | 'puzzle' | 'memory'>(null);
  const [result, setResult] = useState<string | null>(null);
  const [use, setUse] = useState(usage);
  const [coins, setCoins] = useState(getCoins);

  const start = (kind: 'puzzle' | 'memory') => {
    const key = kind === 'puzzle' ? 'puzzles' : 'minis';
    if (use[key] >= DAILY_LIMIT) return;
    bumpUsage(key);
    setUse(usage());
    setResult(null);
    setPlaying(kind);
  };
  const win = (kind: 'puzzle' | 'mini') => {
    playSfx('win');
    setResult(`🎉 ¡Resuelto! Premio sorpresa: ${grantReward(kind)}`);
    setCoins(getCoins());
    setPlaying(null);
  };
  const fail = () => { playSfx('lose'); setResult('⏱ Se acabó el tiempo — sin premio esta vez.'); setPlaying(null); };

  return (
    <div className="screen">
      <div className="screen-inner inv-inner">
        <div className="inv-header">
          <button className="inv-back" onClick={goHome}>‹</button>
          <h1 className="inv-title">🕹️ Arcade</h1>
          <span className="inv-wallet">🪙{coins.toLocaleString('es')}</span>
        </div>

        {!playing && (
          <>
            <div className="inv-tabs">
              <button className={`inv-tab ${tab === 'puzzles' ? 'inv-tab--on' : ''}`} onClick={() => setTab('puzzles')}>🧩 Puzzles ({DAILY_LIMIT - use.puzzles}/día)</button>
              <button className={`inv-tab ${tab === 'minis' ? 'inv-tab--on' : ''}`} onClick={() => setTab('minis')}>🕹️ Minijuegos ({DAILY_LIMIT - use.minis}/día)</button>
            </div>
            {result && <p className="arc-result">{result}</p>}
            {tab === 'puzzles' ? (
              <button className="btn btn-primary" disabled={use.puzzles >= DAILY_LIMIT} onClick={() => start('puzzle')}>
                {use.puzzles >= DAILY_LIMIT ? 'Vuelve mañana' : '🧩 Jugar puzzle (3:00) — premio ⭐ o 🪙 sorpresa'}
              </button>
            ) : (
              <button className="btn btn-primary" disabled={use.minis >= DAILY_LIMIT} onClick={() => start('memory')}>
                {use.minis >= DAILY_LIMIT ? 'Vuelve mañana' : '🧠 Memoria de patitas — premio 🪙'}
              </button>
            )}
            <p className="arc-note">Puzzles: 40% de dar star (5-15), 60% de dar puntos redondos (1.000-10.000). Minijuegos: solo puntos (1.000-3.000).</p>
          </>
        )}

        {playing === 'puzzle' && <Puzzle onWin={() => win('puzzle')} onFail={fail} />}
        {playing === 'memory' && <Memory onWin={() => win('mini')} />}
      </div>

      <style>{`
        .arc-puzzle { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .arc-timer { font-family: var(--font-display); font-weight: 800; color: #ffd65a; }
        .arc-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: min(300px, 84vw); }
        .arc-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; width: min(320px, 88vw); }
        .arc-cell { aspect-ratio: 1; border: none; border-radius: 14px; background: rgba(255,255,255,.14); color: var(--color-text); font-family: var(--font-display); font-size: 1.6rem; font-weight: 800; cursor: pointer; touch-action: manipulation; }
        .arc-cell--blank { background: transparent; }
        .arc-cell--memo { font-size: 1.5rem; }
        .arc-cell--hidden { background: rgba(255,214,90,.15); }
        .arc-note { font-size: .72rem; font-weight: 700; color: var(--color-text-muted); text-align: center; }
        .arc-result { text-align: center; font-family: var(--font-display); font-weight: 800; color: #ffd65a; background: rgba(255,214,90,.12); border: 1.5px solid rgba(255,214,90,.4); border-radius: var(--radius-full); padding: 8px 14px; }
      `}</style>
    </div>
  );
}
