import {
  HEX_RING, HEX_COLORS, HEX_COLOR_CSS, HEX_ARM, HEX_CELL, HEX_ENTRY,
  hexLane, hexBase, hexOuterPolygon, hexCenterPolygon, hexIsSafe,
  hexCellRotation, hexArmOf,
} from '../game/hex/boardPath6.ts';
import { styleOnce } from '../styleOnce.ts';

/**
 * Hexagonal 6-player board — SVG render straight from boardPath6's
 * geometry, matching the classic commercial hex-ludo layout: full
 * hexagon silhouette, 3-column spokes with numbered 6-cell lanes, round
 * corner bases, entry arrows, star refuges and a trophy goal.
 */

function poly(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/** Square cell aligned with its spoke. */
function Cell({ x, y, rot, fill, stroke = 'rgba(30,20,80,0.55)' }: {
  x: number; y: number; rot: number; fill: string; stroke?: string;
}) {
  const s = HEX_CELL;
  return (
    <rect
      x={x - s / 2}
      y={y - s / 2}
      width={s}
      height={s}
      transform={`rotate(${rot} ${x} ${y})`}
      fill={fill}
      stroke={stroke}
      strokeWidth={0.28}
    />
  );
}

/** Five-point star (refuge marker). */
function StarMark({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.44;
    const a = (-90 + i * 36) * (Math.PI / 180);
    pts.push(`${(x + Math.cos(a) * rad).toFixed(2)},${(y + Math.sin(a) * rad).toFixed(2)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} stroke="rgba(30,20,80,0.5)" strokeWidth={0.2} />;
}

/** Travel-direction arrow inside an entry cell, aligned with the spoke. */
function ArrowMark({ x, y, rot }: { x: number; y: number; rot: number }) {
  const s = HEX_CELL * 0.62;
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <path
        d={`M ${x - s * 0.22} ${y - s * 0.45} L ${x - s * 0.22} ${y + 0.05} L ${x - s * 0.48} ${y + 0.05} L ${x} ${y + s * 0.5} L ${x + s * 0.48} ${y + 0.05} L ${x + s * 0.22} ${y + 0.05} L ${x + s * 0.22} ${y - s * 0.45} Z`}
        fill="#1d1440"
        opacity={0.85}
      />
    </g>
  );
}

export default function BoardHex({ showIndexes = false }: { showIndexes?: boolean }) {
  return (
    <div className="hexboard-wrap">
      <svg className="hexboard" viewBox="0 0 100 100" role="img" aria-label="Tablero hexagonal de 6 jugadores">
        {/* Hexagon body */}
        <polygon
          points={poly(hexOuterPolygon())}
          fill="#fdfaf3"
          stroke="#221562"
          strokeWidth={1.1}
          strokeLinejoin="round"
        />

        {/* Corner bases */}
        {HEX_COLORS.map((c) => {
          const b = hexBase(c);
          return (
            <g key={`base-${c}`}>
              <circle cx={b.center.x} cy={b.center.y} r={b.r} fill={HEX_COLOR_CSS[c].main} stroke="rgba(30,20,80,0.4)" strokeWidth={0.4} />
              {b.slots.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={2.55} fill="#fdfaf3" stroke="rgba(30,20,80,0.25)" strokeWidth={0.25} />
              ))}
            </g>
          );
        })}

        {/* Ring cells (white; entries colored with arrow; refuges starred) */}
        {HEX_RING.map((cell, i) => {
          const k = hexArmOf(i);
          const rot = hexCellRotation(k);
          const entryColor = HEX_COLORS.find((c) => HEX_ENTRY[c] === i) ?? null;
          const safe = hexIsSafe(i) && !entryColor;
          const owner = HEX_COLORS.find((c) => HEX_ARM[c] === k)!;
          const isLaneEntrance = i % 13 === 6;
          return (
            <g key={`ring-${i}`}>
              <Cell
                x={cell.x}
                y={cell.y}
                rot={rot}
                fill={entryColor ? HEX_COLOR_CSS[entryColor].main : isLaneEntrance ? HEX_COLOR_CSS[owner].light : '#ffffff'}
              />
              {safe && <StarMark x={cell.x} y={cell.y} r={HEX_CELL * 0.34} fill={HEX_COLOR_CSS[owner].main} />}
              {entryColor && (
                // Arrow points INTO the board (direction of travel from entry)
                <ArrowMark x={cell.x} y={cell.y} rot={rot + 180} />
              )}
              {showIndexes && (
                <text x={cell.x} y={cell.y + 0.9} textAnchor="middle" fontSize={1.7} fill="#221562" fontWeight={700}>{i}</text>
              )}
            </g>
          );
        })}

        {/* Numbered lanes (1 at the rim → 6 beside the goal) */}
        {HEX_COLORS.map((c) => {
          const k = HEX_ARM[c];
          const rot = hexCellRotation(k);
          return hexLane(c).map((cell, i) => (
            <g key={`lane-${c}-${i}`}>
              <Cell x={cell.x} y={cell.y} rot={rot} fill={HEX_COLOR_CSS[c].main} />
              <text
                x={cell.x}
                y={cell.y + 1.05}
                textAnchor="middle"
                fontSize={2.5}
                fontWeight={800}
                fill="#fff"
                transform={`rotate(${rot} ${cell.x} ${cell.y})`}
              >
                {i + 1}
              </text>
            </g>
          ));
        })}

        {/* Central goal: hexagon of colored wedges + trophy medallion */}
        <polygon points={poly(hexCenterPolygon())} fill="#fdfaf3" stroke="#221562" strokeWidth={0.7} strokeLinejoin="round" />
        {HEX_COLORS.map((c) => {
          const k = HEX_ARM[c];
          const verts = hexCenterPolygon();
          const a = verts[k];
          const b = verts[(k + 1) % 6];
          return (
            <polygon key={`goal-${c}`} points={`50,50 ${a.x},${a.y} ${b.x},${b.y}`} fill={HEX_COLOR_CSS[c].main} opacity={0.95} />
          );
        })}
        <circle cx={50} cy={50} r={6.4} fill="#84104b" stroke="#f2c14e" strokeWidth={0.9} />
        {/* Gold trophy */}
        <g stroke="#ffd65a" strokeWidth={0.9} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 46.8 46.6 h 6.4 v 2.6 a 3.2 3.2 0 0 1 -6.4 0 Z" fill="#ffd65a" />
          <path d="M 46.8 47.4 h -1.9 a 2 2 0 0 0 2.2 2.4 M 53.2 47.4 h 1.9 a 2 2 0 0 1 -2.2 2.4" />
          <path d="M 49.2 52 h 1.6 v 1.2 h -1.6 Z M 47.9 53.4 h 4.2" fill="#ffd65a" />
        </g>
      </svg>
    </div>
  );
}

styleOnce('board-hex', `
  .hexboard-wrap {
    width: min(100vw - 6px, 60svh, 580px);
    margin: 0 auto;
  }
  .hexboard {
    display: block;
    width: 100%;
    height: auto;
    filter: drop-shadow(0 12px 26px rgba(14, 6, 50, 0.55));
  }
`);
