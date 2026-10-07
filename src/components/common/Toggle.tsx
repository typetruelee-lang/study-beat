import type { ReactNode } from 'react';
import { Switch as TdsSwitch } from '@toss/tds-mobile';
import { USE_TDS } from '../../app/skin';
import './common.css';

export function ToggleRow({ title, description, checked, onChange }: { title: string; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row" onClick={() => onChange(!checked)}>
      <div className="toggle-row__text">
        <span className="strong">{title}</span>
        {description && <span className="small muted">{description}</span>}
      </div>
      {!USE_TDS ? (
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
      ) : (
        // Toss build: TDS switch (its label wraps a checkbox input that does the toggling).
        <span onClick={(e) => e.stopPropagation()}>
          <TdsSwitch checked={checked} aria-label={title} onChange={(_, v) => onChange(v)} />
        </span>
      )}
    </div>
  );
}
