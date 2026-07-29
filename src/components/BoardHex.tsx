import {
  HEX_RING, HEX_COLORS, HEX_COLOR_CSS, HEX_ARM, HEX_CELL, HEX_ENTRY,
  hexLane, hexBase, hexArmPolygon, hexCenterPolygon, hexIsSafe, hexCenter,
} from '../game/hex/boardPath6.ts';
import { Star } from 'lucide-react';
import { styleOnce } from '../styleOnce.ts';

/**
 * Hexagonal 6-player board — SVG render straight from boardPath6's
 * geometry (design prototype; the piece layer will reuse the exact same
 * coordinates via hexPiecePosition, like Board.tsx does on the 4p grid).
 */

function poly(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

export default function BoardHex({ showIndexes = false }: { showIndexes?: boolean }) {
  const r = HEX_CELL / 2;
  return (
    <div className="hexboard-wrap">
      <svg className="hexboard" viewBox="0 0 100 100" role="img" aria-label="Tablero hexagonal de 6 jugadores">
        {/* Colored arms */}
        {HEX_COLORS.map((c) => (
          <polygon
            key={`arm-${c}`}
            points={poly(hexArmPolygon(HEX_ARM[c]))}
            fill={HEX_COLOR_CSS[c].main}
            opacity={0.92}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
        ))}

        {/* Central goal hexagon */}
        <polygon
          points={poly(hexCenterPolygon())}
          fill="#2c1f77"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={0.8}
          strokeLinejoin="round"
        />
        {HEX_COLORS.map((c) => {
          // Pie slice from center toward each arm (goal wedge in arm color)
          const k = HEX_ARM[c];
          const a1 = (-90 + k * 60 - 30) * (Math.PI / 180);
          const a2 = (-90 + k * 60 + 30) * (Math.PI / 180);
          const rr = 13.2;
          return (
            <polygon
              key={`goal-${c}`}
              points={`50,50 ${50 + Math.cos(a1) * rr},${50 + Math.sin(a1) * rr} ${50 + Math.cos(a2) * rr},${50 + Math.sin(a2) * rr}`}
              fill={HEX_COLOR_CSS[c].main}
              opacity={0.9}
            />
          );
        })}

        {/* Base pads */}
        {HEX_COLORS.map((c) => {
          const b = hexBase(c);
          return (
            <g key={`base-${c}`}>
              <circle cx={b.center.x} cy={b.center.y} r={9.6} fill={HEX_COLOR_CSS[c].main} opacity={0.94} stroke="rgba(255,255,255,0.85)" strokeWidth={0.7} />
              <circle cx={b.center.x} cy={b.center.y} r={7.8} fill="rgba(255,255,255,0.88)" />
              {b.slots.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={2.5} fill="rgba(0,0,0,0.12)" />
              ))}
            </g>
          );
        })}

        {/* Ring cells */}
        {HEX_RING.map((cell, i) => {
          const armOf = Math.floor(i / 13);
          const j = i % 13;
          const owner = HEX_COLORS[armOf];
          const entryColor = HEX_COLORS.find((c) => HEX_ENTRY[c] === i) ?? null;
          const laneEntrance = j === 6;
          return (
            <g key={`ring-${i}`}>
              <circle
                cx={cell.x}
                cy={cell.y}
                r={r}
                fill={entryColor ? HEX_COLOR_CSS[entryColor].light : laneEntrance ? HEX_COLOR_CSS[owner].light : 'rgba(255,255,255,0.96)'}
                stroke="rgba(44,31,119,0.35)"
                strokeWidth={0.45}
              />
              {hexIsSafe(i) && !entryColor && (
                <Star x={cell.x - 1.7} y={cell.y - 1.7} width={3.4} height={3.4} color="#b9a23a" strokeWidth={2.6} />
              )}
              {entryColor && (
                <circle cx={cell.x} cy={cell.y} r={r * 0.42} fill={HEX_COLOR_CSS[entryColor].main} opacity={0.85} />
              )}
              {showIndexes && (
                <text x={cell.x} y={cell.y + 1} textAnchor="middle" fontSize={1.9} fill="#2c1f77" fontWeight={700}>{i}</text>
              )}
            </g>
          );
        })}

        {/* Lanes */}
        {HEX_COLORS.map((c) =>
          hexLane(c).map((cell, i) => (
            <circle
              key={`lane-${c}-${i}`}
              cx={cell.x}
              cy={cell.y}
              r={r * 0.92}
              fill={HEX_COLOR_CSS[c].light}
              stroke="rgba(44,31,119,0.4)"
              strokeWidth={0.4}
            />
          )),
        )}

        {/* Goal marker */}
        <circle cx={hexCenter().x} cy={hexCenter().y} r={3.4} fill="#ffd65a" stroke="#2c1f77" strokeWidth={0.5} />
      </svg>
    </div>
  );
}

styleOnce('board-hex', `
  .hexboard-wrap {
    width: min(100vw - 8px, 58svh, 560px);
    margin: 0 auto;
  }
  .hexboard {
    display: block;
    width: 100%;
    height: auto;
    background: radial-gradient(circle at 50% 42%, #4f3cc0, #37289b 70%);
    border-radius: 22px;
    border: 3px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 14px 34px rgba(14, 6, 50, 0.5);
  }
`);
