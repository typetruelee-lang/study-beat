import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from './ClayButton';
import './common.css';

export function ScreenHeader({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <header className="screen-header">
      <IconButton flat aria-label="뒤로 가기" onClick={onBack ?? (() => (window.history.length > 1 ? navigate(-1) : navigate('/')))}>
        ‹
      </IconButton>
      <h1 className="screen-header__title">{title}</h1>
      <div>{right}</div>
    </header>
  );
}
