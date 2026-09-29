import type { CSSProperties, ReactNode } from 'react';
import './common.css';

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v) => `${Math.round(v * 100)}%`,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const text = typeof label === 'string' ? label : undefined;
  return (
    <label className="slider">
      <span className="slider__label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={text}
        aria-valuetext={format(value)}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider__value">{format(value)}</span>
    </label>
  );
}
