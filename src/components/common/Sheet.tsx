import { useEffect, type ReactNode } from 'react';
import './common.css';

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose?: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet__grab" />
        {children}
      </div>
    </>
  );
}
