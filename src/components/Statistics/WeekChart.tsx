import { useState } from 'react';
import { formatDuration, formatDurationShort } from '../../lib/format';
import type { WeekBar } from '../../storage/stats';
import './stats.css';

const W = 320;
const H = 150;
const BASE = 122;
const BAR = 22;

/**
 * 7-day column chart (Mon–Sun). Single series → one hue, no legend.
 * Tap/hover a day for its value; a hidden table gives screen readers the numbers.
 */
export function WeekChart({ bars }: { bars: WeekBar[] }) {
  const today = bars.findIndex((b) => b.isToday);
  const [sel, setSel] = useState<number>(today >= 0 ? today : 0);
  const max = Math.max(3600, ...bars.map((b) => b.seconds));
  const slot = W / 7;
  const s = bars[sel];

  return (
    <figure className="week-chart">
      <p className="week-chart__readout" aria-live="polite">
        <span className="strong">{s.label}요일{s.isToday ? ' (오늘)' : ''}</span> {formatDuration(s.seconds)}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="이번 주 요일별 기록된 집중시간">
        <line x1="0" x2={W} y1={BASE} y2={BASE} className="week-chart__axis" />
        {bars.map((b, i) => {
          const h = b.seconds > 0 ? Math.max(4, (b.seconds / max) * (BASE - 16)) : 0;
          const x = i * slot + (slot - BAR) / 2;
          const y = BASE - h;
          const r = Math.min(4, h);
          return (
            <g key={b.label} onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} style={{ cursor: 'pointer' }}>
              <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
              {h > 0 && (
                <path
                  className={`week-chart__bar ${i === sel ? 'is-sel' : ''}`}
                  d={`M${x} ${BASE} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + BAR - r} Q${x + BAR} ${y} ${x + BAR} ${y + r} V${BASE} Z`}
                />
              )}
              {i === sel && h > 0 && (
                <text x={x + BAR / 2} y={y - 6} textAnchor="middle" className="week-chart__value">{formatDurationShort(b.seconds)}</text>
              )}
              <text x={x + BAR / 2} y={H - 8} textAnchor="middle" className={`week-chart__label ${b.isToday ? 'is-today' : ''}`}>{b.label}</text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>요일별 기록된 집중시간</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.label}><th scope="row">{b.label}</th><td>{formatDuration(b.seconds)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
