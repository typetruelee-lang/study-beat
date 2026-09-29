import type { ReactNode } from 'react';
import './common.css';

export function ToggleRow({ title, description, checked, onChange }: { title: string; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!checked)}>
      <div className="toggle-row__text">
        <span className="strong">{title}</span>
        {description && <span className="small muted">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className="toggle"
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      />
    </div>
  );
}
