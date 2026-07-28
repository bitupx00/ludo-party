import { useCallback, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, Bird, Brain, Cat,
  ChevronLeft, Coins, Crosshair, Crown, Divide, Dog, Fish, Gamepad2, Ghost,
  Hammer, Hash, Heart, KeyRound, LayoutGrid, Layers, Lightbulb, Map as MapIcon,
  Music, MousePointerClick, Puzzle as PuzzleIcon, Rocket, Scissors, Sigma,
  Star, Timer, Trophy, Zap,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore.ts';
import { ensureProfile, loadProfile, saveProfile, getCoins } from '../profile.ts';
import { playSfx } from '../sound.ts';

/**
 * Arcade 2.0: 8 algorithmic PUZZLES + 8 MINIGAMES, each playable in three
 * difficulty tiers (fácil / medio / difícil) that scale the challenge AND
 * the prize. Daily limits: 10 puzzle plays + 10 minigame plays.
 *  - Puzzle prize: 40% stars, 60% coins — always ROUND thousands.
 *  - Minigame prize: coins only (round thousands).
 *  - Multiplier by tier: ×1 / ×2 / ×3.
 */

const LIMIT_KEY = 'ludo-party-arcade';
const DAILY_LIMIT = 10;

type Diff = 0 | 1 | 2; // fácil / medio / difícil
const DIFF_NAMES = ['Fácil', 'Medio', 'Difícil'] as const;

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

/** Round-thousands coin roll between minK..maxK inclusive (in thousands). */
function roundCoins(minK: number, maxK: number): number {
  return (minK + Math.floor(Math.random() * (maxK - minK + 1))) * 1000;
}

/** Prize by kind + difficulty. Returns a human line for the result banner. */
function grantReward(kind: 'puzzle' | 'mini', diff: Diff): string {
  ensureProfile('');
  const p = loadProfile();
  if (!p) return '';
  const mult = diff + 1;
  if (kind === 'puzzle' && Math.random() < 0.4) {
    const base = 3 + Math.floor(Math.random() * 4); // 3-6
    const stars = base * mult;
    p.points = Math.min(99999, p.points + stars);
    saveProfile(p);
    return `+${stars} estrellas`;
  }
  const coins = kind === 'puzzle' ? roundCoins(1 * mult, 3 * mult + 1) : roundCoins(1 * mult, 1 * mult);
  p.coins = Math.min(99999999, (p.coins ?? 0) + coins);
  saveProfile(p);
  return `+${coins.toLocaleString('es')} puntos`;
}

/* ── Shared bits ────────────────────────────────────────────────────── */

function useCountdown(total: number, onExpire: () => void) {
  const [left, setLeft] = useState(total);
  const expired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0 && !expired.current) { expired.current = true; onExpire(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);
  return left;
}

function Clock({ left }: { left: number }) {
  return (
    <p className="arc-timer">
      <Timer size={13} className="arc-ico" /> {Math.floor(Math.max(left, 0) / 60)}:{String(Math.max(left, 0) % 60).padStart(2, '0')}
    </p>
  );
}

interface GameProps {
  diff: Diff;
  onWin: () => void;
  onFail: () => void;
}

function useOnce(fn: () => void): () => void {
  const fired = useRef(false);
  return useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    fn();
  }, [fn]);
}

/* ── P1 · Deslizante (sliding 8-puzzle, always solvable) ────────────── */

function shuffled(): number[] {
  const b = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let blank = 8;
  for (let i = 0; i < 140; i++) {
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

function PzDeslizante({ diff, onWin, onFail }: GameProps) {
  const [board, setBoard] = useState<number[]>(shuffled);
  const win = useOnce(onWin);
  const left = useCountdown([240, 180, 120][diff], useOnce(onFail));
  useEffect(() => {
    if (board.every((v, i) => v === (i === 8 ? 0 : i + 1))) win();
  }, [board, win]);
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
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', width: 'min(300px, 84vw)' }}>
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

/* ── P2 · Secuencia (what number comes next) ────────────────────────── */

function makeSeq(diff: Diff): { seq: number[]; answer: number } {
  const kind = Math.floor(Math.random() * (diff === 0 ? 2 : 3));
  const a = 2 + Math.floor(Math.random() * 8);
  const d = 2 + Math.floor(Math.random() * (4 + diff * 3));
  if (kind === 0) { // arithmetic
    const seq = [a, a + d, a + 2 * d, a + 3 * d];
    return { seq, answer: a + 4 * d };
  }
  if (kind === 1) { // multiplicative (small)
    const r = 2 + (diff > 0 ? Math.floor(Math.random() * 2) : 0);
    const seq = [a, a * r, a * r * r, a * r * r * r];
    return { seq, answer: a * r ** 4 };
  }
  // alternating add/subtract
  const seq = [a, a + d, a + d - Math.ceil(d / 2), a + 2 * d - Math.ceil(d / 2)];
  return { seq, answer: a + 2 * d - 2 * Math.ceil(d / 2) + d };
}

function PzSecuencia({ diff, onWin, onFail }: GameProps) {
  const need = [3, 4, 5][diff];
  const [round, setRound] = useState(0);
  const [q, setQ] = useState(() => makeSeq(diff));
  const [opts, setOpts] = useState<number[]>([]);
  const win = useOnce(onWin);
  const left = useCountdown(90, useOnce(onFail));
  useEffect(() => {
    const set = new Set<number>([q.answer]);
    while (set.size < 4) set.add(q.answer + Math.floor(Math.random() * 21) - 10);
    setOpts([...set].sort(() => Math.random() - 0.5));
  }, [q]);
  const pick = (n: number) => {
    if (n !== q.answer) { playSfx('lose'); onFail(); return; }
    playSfx('pop');
    if (round + 1 >= need) { win(); return; }
    setRound(round + 1);
    setQ(makeSeq(diff));
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <p className="arc-big">{q.seq.join(' · ')} · <b>?</b></p>
      <div className="arc-opts">
        {opts.map((n) => <button key={n} className="arc-opt" onClick={() => pick(n)}>{n}</button>)}
      </div>
      <p className="arc-note">Acierta {need} seguidas — un fallo termina el reto ({round}/{need})</p>
    </div>
  );
}

/* ── P3 · Sudoku 4×4 ────────────────────────────────────────────────── */

function makeSudoku(blanks: number): { grid: number[]; fixed: boolean[] } {
  // Base valid 4×4 latin square with box constraint, shuffled by symbol swap
  const base = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
  const perm = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
  const grid = base.map((v) => perm[v - 1]);
  const fixed = Array(16).fill(true);
  const idxs = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (let i = 0; i < blanks; i++) { grid[idxs[i]] = 0; fixed[idxs[i]] = false; }
  return { grid, fixed };
}

function sudokuOk(g: number[]): boolean {
  if (g.includes(0)) return false;
  const rows = [0, 1, 2, 3].map((r) => g.slice(r * 4, r * 4 + 4));
  const cols = [0, 1, 2, 3].map((c) => [g[c], g[c + 4], g[c + 8], g[c + 12]]);
  const boxes = [[0, 1, 4, 5], [2, 3, 6, 7], [8, 9, 12, 13], [10, 11, 14, 15]].map((b) => b.map((i) => g[i]));
  return [...rows, ...cols, ...boxes].every((set) => new Set(set).size === 4);
}

function PzSudoku({ diff, onWin, onFail }: GameProps) {
  const [{ grid: g0, fixed }] = useState(() => makeSudoku([5, 7, 9][diff]));
  const [grid, setGrid] = useState(g0);
  const win = useOnce(onWin);
  const left = useCountdown(180, useOnce(onFail));
  useEffect(() => { if (sudokuOk(grid)) win(); }, [grid, win]);
  const tap = (i: number) => {
    if (fixed[i]) return;
    playSfx('click');
    setGrid((g) => g.map((v, j) => (j === i ? (v % 4) + 1 : v)));
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-grid arc-sudoku" style={{ gridTemplateColumns: 'repeat(4, 1fr)', width: 'min(280px, 80vw)' }}>
        {grid.map((v, i) => (
          <button key={i} className={`arc-cell ${fixed[i] ? 'arc-cell--fixed' : ''}`} onClick={() => tap(i)}>
            {v || ''}
          </button>
        ))}
      </div>
      <p className="arc-note">Toca las casillas libres para rotar 1-4. Sin repetir en fila, columna ni caja 2×2.</p>
    </div>
  );
}

/* ── P4 · Torres de Hanoi ───────────────────────────────────────────── */

function PzHanoi({ diff, onWin, onFail }: GameProps) {
  const n = [3, 4, 5][diff];
  const [pegs, setPegs] = useState<number[][]>(() => [Array.from({ length: n }, (_, i) => n - i), [], []]);
  const [sel, setSel] = useState<number | null>(null);
  const win = useOnce(onWin);
  const left = useCountdown(180, useOnce(onFail));
  useEffect(() => { if (pegs[2].length === n) win(); }, [pegs, n, win]);
  const tap = (p: number) => {
    if (sel === null) {
      if (pegs[p].length) { setSel(p); playSfx('click'); }
      return;
    }
    if (sel === p) { setSel(null); return; }
    const disc = pegs[sel][pegs[sel].length - 1];
    const top = pegs[p][pegs[p].length - 1];
    if (top !== undefined && top < disc) { playSfx('lose'); setSel(null); return; }
    playSfx('pop');
    setPegs((ps) => ps.map((st, i) => i === sel ? st.slice(0, -1) : i === p ? [...st, disc] : st));
    setSel(null);
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-hanoi">
        {pegs.map((st, p) => (
          <button key={p} className={`arc-peg ${sel === p ? 'arc-peg--sel' : ''}`} onClick={() => tap(p)}>
            <span className="arc-peg-rod" />
            {st.map((d, i) => (
              <span key={i} className="arc-disc" style={{ width: `${28 + d * (52 / n)}%`, bottom: `${6 + i * 16}px`, background: `hsl(${260 - d * 30}, 75%, 62%)` }} />
            ))}
          </button>
        ))}
      </div>
      <p className="arc-note">Mueve la torre completa a la tercera vara. Nunca un disco grande sobre uno pequeño.</p>
    </div>
  );
}

/* ── P5 · Luces (Lights Out, generated solvable) ────────────────────── */

function PzLuces({ diff, onWin, onFail }: GameProps) {
  const n = [3, 4, 5][diff];
  const [cells, setCells] = useState<boolean[]>(() => {
    const c = Array(n * n).fill(false);
    const press = (i: number) => {
      const r = Math.floor(i / n), col = i % n;
      [i, r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, col > 0 ? i - 1 : -1, col < n - 1 ? i + 1 : -1]
        .filter((x) => x >= 0).forEach((x) => { c[x] = !c[x]; });
    };
    for (let k = 0; k < n * 2 + 2; k++) press(Math.floor(Math.random() * n * n));
    if (c.every((v) => !v)) press(0);
    return c;
  });
  const win = useOnce(onWin);
  const left = useCountdown(120, useOnce(onFail));
  useEffect(() => { if (cells.every((v) => !v)) win(); }, [cells, win]);
  const tap = (i: number) => {
    playSfx('click');
    setCells((c) => {
      const next = [...c];
      const r = Math.floor(i / n), col = i % n;
      [i, r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, col > 0 ? i - 1 : -1, col < n - 1 ? i + 1 : -1]
        .filter((x) => x >= 0).forEach((x) => { next[x] = !next[x]; });
      return next;
    });
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, width: 'min(300px, 84vw)' }}>
        {cells.map((on, i) => (
          <button key={i} className={`arc-cell ${on ? 'arc-cell--lit' : ''}`} onClick={() => tap(i)} aria-label={on ? 'on' : 'off'} />
        ))}
      </div>
      <p className="arc-note">Apaga TODAS las luces: cada toque invierte la casilla y sus vecinas</p>
    </div>
  );
}

/* ── P6 · Laberinto (DFS maze) ──────────────────────────────────────── */

function makeMaze(n: number): boolean[][] {
  // walls[r][c] true = wall. Odd cells carve.
  const g = Array.from({ length: n }, () => Array(n).fill(true));
  const carve = (r: number, c: number) => {
    g[r][c] = false;
    const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]].sort(() => Math.random() - 0.5);
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < n - 1 && nc > 0 && nc < n - 1 && g[nr][nc]) {
        g[r + dr / 2][c + dc / 2] = false;
        carve(nr, nc);
      }
    }
  };
  carve(1, 1);
  g[n - 2][n - 1] = false; // exit hole
  return g;
}

function PzLaberinto({ diff, onWin, onFail }: GameProps) {
  const n = [9, 11, 13][diff];
  const [maze] = useState(() => makeMaze(n));
  const [pos, setPos] = useState<[number, number]>([1, 1]);
  const win = useOnce(onWin);
  const left = useCountdown(120, useOnce(onFail));
  const move = (dr: number, dc: number) => {
    setPos(([r, c]) => {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= n || nc >= n || maze[nr][nc]) return [r, c];
      playSfx('click');
      if (nr === n - 2 && nc === n - 1) win();
      return [nr, nc];
    });
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-maze" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {maze.flatMap((row, r) => row.map((wall, c) => (
          <span
            key={`${r}-${c}`}
            className={`arc-mz ${wall ? 'arc-mz--wall' : ''} ${r === pos[0] && c === pos[1] ? 'arc-mz--me' : ''} ${r === n - 2 && c === n - 1 ? 'arc-mz--exit' : ''}`}
          />
        )))}
      </div>
      <div className="arc-dpad">
        <button className="arc-opt" onClick={() => move(-1, 0)} aria-label="arriba"><ArrowUp size={17} /></button>
        <div>
          <button className="arc-opt" onClick={() => move(0, -1)} aria-label="izquierda"><ArrowLeft size={17} /></button>
          <button className="arc-opt" onClick={() => move(1, 0)} aria-label="abajo"><ArrowDown size={17} /></button>
          <button className="arc-opt" onClick={() => move(0, 1)} aria-label="derecha"><ArrowRight size={17} /></button>
        </div>
      </div>
      <p className="arc-note">Llega a la salida (verde) antes de que acabe el tiempo</p>
    </div>
  );
}

/* ── P7 · Ordenar (swap-sort) ───────────────────────────────────────── */

function PzOrdenar({ diff, onWin, onFail }: GameProps) {
  const n = [5, 7, 9][diff];
  const [arr, setArr] = useState<number[]>(() => {
    let a: number[];
    do {
      a = Array.from({ length: n }, () => 10 + Math.floor(Math.random() * 89));
    } while (a.every((v, i) => i === 0 || a[i - 1] <= v));
    return a;
  });
  const [sel, setSel] = useState<number | null>(null);
  const win = useOnce(onWin);
  const left = useCountdown(90, useOnce(onFail));
  useEffect(() => {
    if (arr.every((v, i) => i === 0 || arr[i - 1] <= v)) win();
  }, [arr, win]);
  const tap = (i: number) => {
    if (sel === null) { setSel(i); playSfx('click'); return; }
    if (sel === i) { setSel(null); return; }
    playSfx('pop');
    setArr((a) => a.map((v, j) => (j === i ? a[sel] : j === sel ? a[i] : v)));
    setSel(null);
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-opts">
        {arr.map((v, i) => (
          <button key={i} className={`arc-opt ${sel === i ? 'arc-opt--sel' : ''}`} onClick={() => tap(i)}>{v}</button>
        ))}
      </div>
      <p className="arc-note">Toca dos números para intercambiarlos hasta dejarlos de menor a mayor</p>
    </div>
  );
}

/* ── P8 · Código secreto (mastermind) ───────────────────────────────── */

const CODE_COLORS = ['#f0405c', '#3d7bfa', '#26c165', '#f5a415', '#a855f7', '#14b8a6'];

function PzCodigo({ diff, onWin, onFail }: GameProps) {
  const nColors = [4, 5, 6][diff];
  const [secret] = useState(() => Array.from({ length: 4 }, () => Math.floor(Math.random() * nColors)));
  const [draft, setDraft] = useState<number[]>([]);
  const [rows, setRows] = useState<Array<{ guess: number[]; exact: number; near: number }>>([]);
  const win = useOnce(onWin);
  const fail = useOnce(onFail);
  const left = useCountdown(180, fail);
  const submit = () => {
    if (draft.length !== 4) return;
    const exact = draft.filter((v, i) => v === secret[i]).length;
    const counts = Array(nColors).fill(0);
    secret.forEach((v) => counts[v]++);
    let hits = 0;
    draft.forEach((v) => { if (counts[v] > 0) { hits++; counts[v]--; } });
    const near = hits - exact;
    const next = [...rows, { guess: draft, exact, near }];
    setRows(next);
    setDraft([]);
    if (exact === 4) { playSfx('win'); win(); }
    else if (next.length >= 8) fail();
    else playSfx('click');
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-code-rows">
        {rows.map((r, i) => (
          <div key={i} className="arc-code-row">
            {r.guess.map((v, j) => <span key={j} className="arc-code-dot" style={{ background: CODE_COLORS[v] }} />)}
            <span className="arc-code-fb">{r.exact} exactos · {r.near} casi</span>
          </div>
        ))}
      </div>
      <div className="arc-code-row">
        {Array.from({ length: 4 }, (_, j) => (
          <span key={j} className="arc-code-dot arc-code-dot--slot" style={{ background: draft[j] !== undefined ? CODE_COLORS[draft[j]] : 'transparent' }} />
        ))}
        <button className="arc-opt" onClick={submit} disabled={draft.length !== 4}>Probar</button>
        <button className="arc-opt" onClick={() => setDraft([])}>Borrar</button>
      </div>
      <div className="arc-opts">
        {CODE_COLORS.slice(0, nColors).map((c, i) => (
          <button key={c} className="arc-code-pick" style={{ background: c }} onClick={() => setDraft((d) => d.length < 4 ? [...d, i] : d)} aria-label={`color ${i + 1}`} />
        ))}
      </div>
      <p className="arc-note">Adivina el código de 4 colores en 8 intentos ({8 - rows.length} restantes)</p>
    </div>
  );
}

/* ── M1 · Memoria de pares ──────────────────────────────────────────── */

const MEMO_ICONS: LucideIcon[] = [Heart, Star, Zap, Ghost, Crown, Rocket, Fish, Bird, Cat, Dog];

function MgMemoria({ diff, onWin, onFail }: GameProps) {
  const nPairs = [6, 8, 10][diff];
  const [cards] = useState(() => {
    const picks = MEMO_ICONS.slice(0, nPairs);
    return [...picks, ...picks].map((I, i) => ({ I, key: i, sym: picks.indexOf(I) }))
      .sort(() => Math.random() - 0.5);
  });
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<Set<number>>(new Set());
  const win = useOnce(onWin);
  const left = useCountdown([90, 100, 110][diff], useOnce(onFail));
  const flip = (idx: number) => {
    if (open.includes(idx) || found.has(cards[idx].sym) || open.length === 2) return;
    playSfx('pop');
    const next = [...open, idx];
    setOpen(next);
    if (next.length === 2) {
      const [a, b] = next;
      if (cards[a].sym === cards[b].sym) {
        const nf = new Set(found); nf.add(cards[a].sym);
        setTimeout(() => { setFound(nf); setOpen([]); if (nf.size === nPairs) win(); }, 320);
      } else {
        setTimeout(() => setOpen([]), 650);
      }
    }
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', width: 'min(330px, 88vw)' }}>
        {cards.map((c, idx) => {
          const shown = open.includes(idx) || found.has(c.sym);
          return (
            <button key={idx} className={`arc-cell arc-cell--memo ${shown ? '' : 'arc-cell--hidden'}`} onClick={() => flip(idx)}>
              {shown ? <c.I size={22} /> : <PuzzleIcon size={16} className="arc-memo-back" />}
            </button>
          );
        })}
      </div>
      <p className="arc-note">Encuentra los {nPairs} pares antes de que acabe el tiempo</p>
    </div>
  );
}

/* ── M2 · Reflejos ──────────────────────────────────────────────────── */

function MgReflejos({ diff, onWin, onFail }: GameProps) {
  const maxMs = [800, 550, 400][diff];
  const [round, setRound] = useState(0);
  const [state, setState] = useState<'wait' | 'go'>('wait');
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const win = useOnce(onWin);
  const fail = useOnce(onFail);
  useEffect(() => {
    setState('wait');
    timer.current = setTimeout(() => {
      setState('go');
      goAt.current = performance.now();
    }, 900 + Math.random() * 2200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [round]);
  const tap = () => {
    if (state === 'wait') { playSfx('lose'); fail(); return; } // tapped early
    const ms = performance.now() - goAt.current;
    if (ms > maxMs) { playSfx('lose'); fail(); return; }
    playSfx('pop');
    if (round + 1 >= 5) { win(); return; }
    setRound(round + 1);
  };
  return (
    <div className="arc-play">
      <button className={`arc-reflex ${state === 'go' ? 'arc-reflex--go' : ''}`} onClick={tap}>
        {state === 'go' ? '¡TOCA YA!' : 'Espera el verde…'}
      </button>
      <p className="arc-note">Ronda {round + 1}/5 — toca solo cuando se ponga verde (máx {maxMs}ms). Tocar antes = perder.</p>
    </div>
  );
}

/* ── M3 · Topo (whack-a-mole) ───────────────────────────────────────── */

function MgTopo({ diff, onWin, onFail }: GameProps) {
  const need = [10, 15, 20][diff];
  const showMs = [900, 700, 500][diff];
  const [mole, setMole] = useState(-1);
  const [hits, setHits] = useState(0);
  const win = useOnce(onWin);
  const left = useCountdown(30, useOnce(() => (hits >= need ? onWin() : onFail())));
  useEffect(() => {
    const t = setInterval(() => setMole(Math.floor(Math.random() * 9)), showMs);
    return () => clearInterval(t);
  }, [showMs]);
  const tap = (i: number) => {
    if (i !== mole) return;
    playSfx('pop');
    setMole(-1);
    setHits((h) => {
      const nh = h + 1;
      if (nh >= need) win();
      return nh;
    });
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <div className="arc-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', width: 'min(300px, 84vw)' }}>
        {Array.from({ length: 9 }, (_, i) => (
          <button key={i} className={`arc-cell ${mole === i ? 'arc-cell--mole' : ''}`} onClick={() => tap(i)}>
            {mole === i && <Hammer size={22} />}
          </button>
        ))}
      </div>
      <p className="arc-note">Golpea {need} topos en 30s ({hits}/{need})</p>
    </div>
  );
}

/* ── M4 · Simon (repeat the sequence) ───────────────────────────────── */

const SIMON_COLORS = ['#f0405c', '#3d7bfa', '#26c165', '#f5a415'];

function MgSimon({ diff, onWin, onFail }: GameProps) {
  const target = [5, 7, 9][diff];
  const [seq, setSeq] = useState<number[]>(() => [Math.floor(Math.random() * 4)]);
  const [showing, setShowing] = useState(true);
  const [lit, setLit] = useState(-1);
  const [idx, setIdx] = useState(0);
  const win = useOnce(onWin);
  const fail = useOnce(onFail);
  useEffect(() => {
    if (!showing) return;
    let i = 0;
    setLit(-1);
    const t = setInterval(() => {
      if (i >= seq.length) { clearInterval(t); setLit(-1); setShowing(false); setIdx(0); return; }
      setLit(seq[i]);
      setTimeout(() => setLit(-1), 320);
      i++;
    }, 560);
    return () => clearInterval(t);
  }, [seq, showing]);
  const tap = (c: number) => {
    if (showing) return;
    if (c !== seq[idx]) { playSfx('lose'); fail(); return; }
    playSfx('click');
    if (idx + 1 < seq.length) { setIdx(idx + 1); return; }
    if (seq.length >= target) { win(); return; }
    setSeq((s) => [...s, Math.floor(Math.random() * 4)]);
    setShowing(true);
  };
  return (
    <div className="arc-play">
      <div className="arc-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', width: 'min(260px, 74vw)' }}>
        {SIMON_COLORS.map((c, i) => (
          <button
            key={c}
            className="arc-simon"
            style={{ background: c, opacity: lit === i ? 1 : 0.45, transform: lit === i ? 'scale(1.05)' : 'none' }}
            onClick={() => tap(i)}
            aria-label={`simon ${i + 1}`}
          />
        ))}
      </div>
      <p className="arc-note">{showing ? 'Memoriza la secuencia…' : 'Repite la secuencia'} · llega a {target} ({seq.length}/{target})</p>
    </div>
  );
}

/* ── M5 · Piedra, papel o tijera ────────────────────────────────────── */

function MgPpt({ diff, onWin, onFail }: GameProps) {
  const target = [3, 4, 5][diff];
  const [me, setMe] = useState(0);
  const [bot, setBot] = useState(0);
  const [last, setLast] = useState('');
  const win = useOnce(onWin);
  const fail = useOnce(onFail);
  const NAMES = ['Piedra', 'Papel', 'Tijera'];
  const play = (m: number) => {
    const b = Math.floor(Math.random() * 3);
    if (m === b) { setLast(`Empate (${NAMES[b]})`); return; }
    const iWin = (m === 0 && b === 2) || (m === 1 && b === 0) || (m === 2 && b === 1);
    setLast(`Bot jugó ${NAMES[b]}`);
    if (iWin) {
      playSfx('pop');
      setMe((s) => { const ns = s + 1; if (ns >= target) win(); return ns; });
    } else {
      playSfx('lose');
      setBot((s) => { const ns = s + 1; if (ns >= target) fail(); return ns; });
    }
  };
  return (
    <div className="arc-play">
      <p className="arc-big">{me} — {bot}</p>
      {last && <p className="arc-note">{last}</p>}
      <div className="arc-opts">
        <button className="arc-opt" onClick={() => play(0)}><Hammer size={16} className="arc-ico" /> Piedra</button>
        <button className="arc-opt" onClick={() => play(1)}><Hash size={16} className="arc-ico" /> Papel</button>
        <button className="arc-opt" onClick={() => play(2)}><Scissors size={16} className="arc-ico" /> Tijera</button>
      </div>
      <p className="arc-note">El primero en llegar a {target} gana</p>
    </div>
  );
}

/* ── M6 · Adivina el número ─────────────────────────────────────────── */

function MgAdivina({ diff, onWin, onFail }: GameProps) {
  const tries = [7, 6, 5][diff];
  const [secret] = useState(() => 1 + Math.floor(Math.random() * 100));
  const [used, setUsed] = useState(0);
  const [hint, setHint] = useState('Número entre 1 y 100');
  const [val, setVal] = useState('');
  const win = useOnce(onWin);
  const fail = useOnce(onFail);
  const guess = () => {
    const n = parseInt(val, 10);
    if (!n || n < 1 || n > 100) return;
    setVal('');
    if (n === secret) { playSfx('win'); win(); return; }
    const nu = used + 1;
    setUsed(nu);
    if (nu >= tries) { playSfx('lose'); setHint(`Era ${secret}`); fail(); return; }
    playSfx('click');
    setHint(n < secret ? `${n} es MENOR que el secreto` : `${n} es MAYOR que el secreto`);
  };
  return (
    <div className="arc-play">
      <p className="arc-big">{hint}</p>
      <div className="arc-opts">
        <input
          className="arc-input"
          type="number"
          min={1}
          max={100}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && guess()}
        />
        <button className="arc-opt" onClick={guess}>Probar</button>
      </div>
      <p className="arc-note">Intentos: {used}/{tries}</p>
    </div>
  );
}

/* ── M7 · Contador (tap speed) ──────────────────────────────────────── */

function MgContador({ diff, onWin, onFail }: GameProps) {
  const need = [40, 55, 70][diff];
  const [taps, setTaps] = useState(0);
  const win = useOnce(onWin);
  useCountdown(10, useOnce(() => (taps >= need ? onWin() : onFail())));
  const [left10, setLeft10] = useState(10);
  useEffect(() => {
    const t = setInterval(() => setLeft10((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const tap = () => {
    setTaps((n) => {
      const nn = n + 1;
      if (nn >= need) win();
      return nn;
    });
  };
  return (
    <div className="arc-play">
      <p className="arc-big">{taps} / {need} · {left10}s</p>
      <button className="arc-reflex arc-reflex--go" onClick={tap}>
        <MousePointerClick size={22} /> ¡TOCA!
      </button>
      <p className="arc-note">Llega a {need} toques en 10 segundos</p>
    </div>
  );
}

/* ── M8 · Par o impar (fast parity streak) ──────────────────────────── */

function MgParidad({ diff, onWin, onFail }: GameProps) {
  const need = [10, 12, 15][diff];
  const [n, setN] = useState(() => 10 + Math.floor(Math.random() * 980));
  const [streak, setStreak] = useState(0);
  const win = useOnce(onWin);
  const fail = useOnce(onFail);
  const left = useCountdown([30, 26, 22][diff], useOnce(onFail));
  const answer = (even: boolean) => {
    if ((n % 2 === 0) !== even) { playSfx('lose'); fail(); return; }
    playSfx('click');
    const ns = streak + 1;
    if (ns >= need) { win(); return; }
    setStreak(ns);
    setN(10 + Math.floor(Math.random() * 980));
  };
  return (
    <div className="arc-play">
      <Clock left={left} />
      <p className="arc-big">{n}</p>
      <div className="arc-opts">
        <button className="arc-opt" onClick={() => answer(true)}>PAR</button>
        <button className="arc-opt" onClick={() => answer(false)}>IMPAR</button>
      </div>
      <p className="arc-note">Acierta {need} seguidas sin fallar ({streak}/{need})</p>
    </div>
  );
}

/* ── Registry + screen ──────────────────────────────────────────────── */

interface GameDef {
  id: string;
  name: string;
  desc: string;
  Icon: LucideIcon;
  kind: 'puzzle' | 'mini';
  Comp: (p: GameProps) => React.ReactElement;
}

const GAMES: GameDef[] = [
  { id: 'deslizante', name: 'Deslizante', desc: 'Ordena el 1-8', Icon: LayoutGrid, kind: 'puzzle', Comp: PzDeslizante },
  { id: 'secuencia', name: 'Secuencia', desc: '¿Qué número sigue?', Icon: Sigma, kind: 'puzzle', Comp: PzSecuencia },
  { id: 'sudoku', name: 'Mini Sudoku', desc: '4×4 sin repetir', Icon: Hash, kind: 'puzzle', Comp: PzSudoku },
  { id: 'hanoi', name: 'Torres', desc: 'Mueve la torre', Icon: Layers, kind: 'puzzle', Comp: PzHanoi },
  { id: 'luces', name: 'Luces', desc: 'Apágalas todas', Icon: Lightbulb, kind: 'puzzle', Comp: PzLuces },
  { id: 'laberinto', name: 'Laberinto', desc: 'Encuentra la salida', Icon: MapIcon, kind: 'puzzle', Comp: PzLaberinto },
  { id: 'ordenar', name: 'Ordenar', desc: 'De menor a mayor', Icon: ArrowUpDown, kind: 'puzzle', Comp: PzOrdenar },
  { id: 'codigo', name: 'Código', desc: 'Rompe el código', Icon: KeyRound, kind: 'puzzle', Comp: PzCodigo },
  { id: 'memoria', name: 'Memoria', desc: 'Encuentra los pares', Icon: Brain, kind: 'mini', Comp: MgMemoria },
  { id: 'reflejos', name: 'Reflejos', desc: 'Toca al verde', Icon: Zap, kind: 'mini', Comp: MgReflejos },
  { id: 'topo', name: 'Topos', desc: 'Golpéalos a tiempo', Icon: Hammer, kind: 'mini', Comp: MgTopo },
  { id: 'simon', name: 'Simon', desc: 'Repite la secuencia', Icon: Music, kind: 'mini', Comp: MgSimon },
  { id: 'ppt', name: 'Piedra-Papel', desc: 'Vence al bot', Icon: Scissors, kind: 'mini', Comp: MgPpt },
  { id: 'adivina', name: 'Adivina', desc: 'El número secreto', Icon: Crosshair, kind: 'mini', Comp: MgAdivina },
  { id: 'contador', name: 'Contador', desc: 'Toca a toda velocidad', Icon: MousePointerClick, kind: 'mini', Comp: MgContador },
  { id: 'paridad', name: 'Par o Impar', desc: 'Cálculo relámpago', Icon: Divide, kind: 'mini', Comp: MgParidad },
];

export default function ArcadeScreen() {
  const goHome = useGameStore((s) => s.goHome);
  const [tab, setTab] = useState<'puzzles' | 'minis'>('puzzles');
  const [diff, setDiff] = useState<Diff>(0);
  const [playing, setPlaying] = useState<GameDef | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [use, setUse] = useState(usage);
  const [coins, setCoins] = useState(getCoins);

  const start = (g: GameDef) => {
    const key = g.kind === 'puzzle' ? 'puzzles' : 'minis';
    if (use[key] >= DAILY_LIMIT) return;
    bumpUsage(key);
    setUse(usage());
    setResult(null);
    setPlaying(g);
  };
  const win = () => {
    if (!playing) return;
    playSfx('win');
    setResult(`¡Resuelto en ${DIFF_NAMES[diff]}! Premio: ${grantReward(playing.kind, diff)}`);
    setCoins(getCoins());
    setPlaying(null);
  };
  const fail = () => {
    playSfx('lose');
    setResult('Esta vez no salió — inténtalo de nuevo.');
    setPlaying(null);
  };

  const list = GAMES.filter((g) => (tab === 'puzzles' ? g.kind === 'puzzle' : g.kind === 'mini'));

  return (
    <div className="screen">
      <div className="screen-inner inv-inner">
        <div className="inv-header">
          <button className="inv-back" onClick={goHome} aria-label="Volver"><ChevronLeft size={22} /></button>
          <h1 className="inv-title"><Gamepad2 size={19} className="arc-ico" /> Arcade</h1>
          <span className="inv-wallet"><Coins size={12} className="arc-ico" />{coins.toLocaleString('es')}</span>
        </div>

        {!playing && (
          <>
            <div className="inv-tabs">
              <button className={`inv-tab ${tab === 'puzzles' ? 'inv-tab--on' : ''}`} onClick={() => setTab('puzzles')}>
                <PuzzleIcon size={13} className="arc-ico" /> Puzzles ({DAILY_LIMIT - use.puzzles}/día)
              </button>
              <button className={`inv-tab ${tab === 'minis' ? 'inv-tab--on' : ''}`} onClick={() => setTab('minis')}>
                <Gamepad2 size={13} className="arc-ico" /> Minijuegos ({DAILY_LIMIT - use.minis}/día)
              </button>
            </div>

            {/* Difficulty tier: harder = bigger prize */}
            <div className="arc-diffs">
              {DIFF_NAMES.map((name, i) => (
                <button
                  key={name}
                  className={`arc-diff ${diff === i ? 'arc-diff--on' : ''}`}
                  onClick={() => setDiff(i as Diff)}
                >
                  {Array.from({ length: i + 1 }, (_, k) => <Star key={k} size={10} className="arc-ico" />)} {name} ×{i + 1}
                </button>
              ))}
            </div>

            {result && <p className="arc-result"><Trophy size={13} className="arc-ico" /> {result}</p>}

            <div className="arc-games">
              {list.map((g) => {
                const locked = use[g.kind === 'puzzle' ? 'puzzles' : 'minis'] >= DAILY_LIMIT;
                return (
                  <button key={g.id} className="arc-game" disabled={locked} onClick={() => start(g)}>
                    <span className="arc-game-ico"><g.Icon size={22} /></span>
                    <span className="arc-game-name">{g.name}</span>
                    <span className="arc-game-desc">{g.desc}</span>
                  </button>
                );
              })}
            </div>

            <p className="arc-note">
              Puzzles: 40% estrellas, 60% puntos redondos — la dificultad multiplica el premio (×1/×2/×3).
              Minijuegos: puntos redondos por dificultad. Límite diario: {DAILY_LIMIT} + {DAILY_LIMIT}.
            </p>
          </>
        )}

        {playing && (
          <>
            <p className="arc-playing-title"><playing.Icon size={15} className="arc-ico" /> {playing.name} · {DIFF_NAMES[diff]}</p>
            <playing.Comp diff={diff} onWin={win} onFail={fail} />
            <button className="btn btn-secondary" onClick={() => { setPlaying(null); setResult('Abandonado — la partida cuenta para el límite diario.'); }}>
              Salir del reto
            </button>
          </>
        )}
      </div>

      <style>{`
        /* Shared header/tab shell (duplicated from InventoryScreen: that
           component's inline <style> unmounts with it, so Arcade must
           carry its own copy). */
        .inv-inner { max-width: 480px; gap: 12px; padding-top: calc(14px + env(safe-area-inset-top)); }
        .inv-header { display: flex; align-items: center; gap: 10px; }
        .inv-back { width: 40px; height: 40px; border-radius: 50%; border: 2px solid rgba(255,255,255,.22); background: rgba(255,255,255,.1); color: var(--color-text); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .inv-title { font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; flex: 1; }
        .inv-wallet { font-family: var(--font-display); font-size: .78rem; font-weight: 800; color: #ffd65a; }
        .inv-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
        .inv-tab { padding: 7px 12px; border-radius: var(--radius-full); border: none; background: rgba(255,255,255,.1); color: var(--color-text-secondary); font-family: var(--font-display); font-size: .78rem; font-weight: 800; cursor: pointer; }
        .inv-tab--on { background: rgba(255,214,90,.2); color: #ffd65a; }
        .arc-ico { vertical-align: -2px; display: inline; }
        .arc-play { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .arc-timer { font-family: var(--font-display); font-weight: 800; color: #ffd65a; }
        .arc-grid { display: grid; gap: 6px; }
        .arc-cell { aspect-ratio: 1; border: none; border-radius: 14px; background: rgba(255,255,255,.14); color: var(--color-text); font-family: var(--font-display); font-size: 1.4rem; font-weight: 800; cursor: pointer; touch-action: manipulation; display: flex; align-items: center; justify-content: center; }
        .arc-cell--blank { background: transparent; }
        .arc-cell--fixed { background: rgba(255,214,90,.16); color: #ffd65a; cursor: default; }
        .arc-cell--lit { background: #ffd65a; }
        .arc-cell--memo { font-size: 1.3rem; }
        .arc-cell--hidden { background: rgba(255,214,90,.15); color: rgba(255,255,255,.35); }
        .arc-cell--mole { background: #26c165; }
        .arc-memo-back { opacity: .5; }
        .arc-note { font-size: .72rem; font-weight: 700; color: var(--color-text-muted); text-align: center; max-width: 340px; }
        .arc-result { text-align: center; font-family: var(--font-display); font-weight: 800; color: #ffd65a; background: rgba(255,214,90,.12); border: 1.5px solid rgba(255,214,90,.4); border-radius: var(--radius-full); padding: 8px 14px; }
        .arc-big { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; text-align: center; }
        .arc-opts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-items: center; }
        .arc-opt { min-width: 56px; padding: 10px 14px; border: none; border-radius: 12px; background: rgba(255,255,255,.14); color: var(--color-text); font-family: var(--font-display); font-size: 1rem; font-weight: 800; cursor: pointer; touch-action: manipulation; }
        .arc-opt--sel { background: rgba(255,214,90,.3); color: #ffd65a; }
        .arc-opt:disabled { opacity: .4; }
        .arc-input { width: 90px; padding: 10px 12px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,.25); background: rgba(255,255,255,.1); color: var(--color-text); font-family: var(--font-display); font-size: 1rem; font-weight: 800; outline: none; text-align: center; }
        .arc-diffs { display: flex; gap: 6px; }
        .arc-diff { flex: 1; padding: 8px 6px; border: 1.5px solid rgba(255,255,255,.16); border-radius: var(--radius-full); background: rgba(255,255,255,.07); color: var(--color-text-secondary); font-family: var(--font-display); font-size: .72rem; font-weight: 800; cursor: pointer; }
        .arc-diff--on { border-color: #ffd65a; background: rgba(255,214,90,.14); color: #ffd65a; }
        .arc-games { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
        .arc-game { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border: 2px solid rgba(255,255,255,.13); border-radius: var(--radius-lg); background: rgba(255,255,255,.07); color: var(--color-text); cursor: pointer; }
        .arc-game:disabled { opacity: .4; cursor: default; }
        .arc-game-ico { width: 40px; height: 40px; border-radius: 12px; background: rgba(255,214,90,.14); color: #ffd65a; display: flex; align-items: center; justify-content: center; }
        .arc-game-name { font-family: var(--font-display); font-size: .78rem; font-weight: 800; }
        .arc-game-desc { font-size: .6rem; font-weight: 700; color: var(--color-text-muted); text-align: center; }
        .arc-playing-title { font-family: var(--font-display); font-weight: 800; text-align: center; color: var(--color-text-secondary); }
        .arc-hanoi { display: flex; gap: 8px; width: min(360px, 92vw); }
        .arc-peg { position: relative; flex: 1; height: 130px; border: none; border-radius: 12px; background: rgba(255,255,255,.07); cursor: pointer; }
        .arc-peg--sel { background: rgba(255,214,90,.18); }
        .arc-peg-rod { position: absolute; left: 50%; bottom: 6px; translate: -50% 0; width: 6px; height: 80%; border-radius: 3px; background: rgba(255,255,255,.25); }
        .arc-disc { position: absolute; left: 50%; translate: -50% 0; height: 13px; border-radius: 7px; box-shadow: 0 2px 4px rgba(8,2,30,.4); }
        .arc-maze { display: grid; gap: 1px; width: min(300px, 84vw); }
        .arc-mz { aspect-ratio: 1; border-radius: 2px; background: rgba(255,255,255,.1); }
        .arc-mz--wall { background: rgba(20, 12, 70, .85); }
        .arc-mz--me { background: #ffd65a; }
        .arc-mz--exit { background: #26c165; }
        .arc-dpad { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .arc-dpad > div { display: flex; gap: 4px; }
        .arc-reflex { width: min(300px, 84vw); height: 130px; border: none; border-radius: 18px; background: rgba(240, 64, 92, .8); color: #fff; font-family: var(--font-display); font-size: 1.2rem; font-weight: 800; cursor: pointer; touch-action: manipulation; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .arc-reflex--go { background: #26c165; }
        .arc-simon { aspect-ratio: 1; border: none; border-radius: 16px; cursor: pointer; transition: opacity 120ms ease, transform 120ms ease; touch-action: manipulation; }
        .arc-code-rows { display: flex; flex-direction: column; gap: 5px; max-height: 30vh; overflow-y: auto; width: min(320px, 88vw); }
        .arc-code-row { display: flex; align-items: center; gap: 6px; }
        .arc-code-dot { width: 24px; height: 24px; border-radius: 50%; box-shadow: inset 0 -2px 0 rgba(0,0,0,.25); }
        .arc-code-dot--slot { border: 2px dashed rgba(255,255,255,.35); }
        .arc-code-fb { font-size: .68rem; font-weight: 800; color: var(--color-text-muted); margin-left: auto; }
        .arc-code-pick { width: 34px; height: 34px; border: 2px solid rgba(255,255,255,.4); border-radius: 50%; cursor: pointer; }
      `}</style>
    </div>
  );
}
