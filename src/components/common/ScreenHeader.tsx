import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconButton } from './ClayButton';
import './common.css';

export function ScreenHeader({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  // 'default' = first entry of this router's history → nowhere to go back to.
  const canGoBack = location.key !== 'default';
  return (
    <header className="screen-header">
      <IconButton flat aria-label="뒤로 가기" onClick={onBack ?? (() => (canGoBack ? navigate(-1) : navigate('/')))}>
        ‹
      </IconButton>
      <h1 className="screen-header__title">{title}</h1>
      <div>{right}</div>
    </header>
  );
}
