import { useEffect, type ReactNode } from 'react';
import { BottomSheet } from '@toss/tds-mobile';
import { IS_WEB_SKIN } from '../../app/skin';
import './common.css';

/** Bottom sheet. Toss build: TDS BottomSheet. Web build: the skin's own sheet. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose?: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!IS_WEB_SKIN) {
    return (
      <BottomSheet open={open} onDimmerClick={onClose} aria-label={label}>
        <div className="tds-sheet-body">{children}</div>
      </BottomSheet>
    );
  }
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
