import type { ReactNode } from 'react';
import './common.css';

export function Chip({ selected, onClick, children, label }: { selected?: boolean; onClick?: () => void; children: ReactNode; label?: string }) {
  return (
    <button type="button" className="chip" aria-pressed={selected ?? false} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function ChipGroup<T extends string | number | null>({
  options,
  value,
  onChange,
  scroll,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  scroll?: boolean;
  label: string;
}) {
  return (
    <div className={`chips ${scroll ? 'chips--scroll' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="chip"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
