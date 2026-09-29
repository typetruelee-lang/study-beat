import './common.css';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div className={`progress__bar ${pct >= 100 ? 'progress__bar--done' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
