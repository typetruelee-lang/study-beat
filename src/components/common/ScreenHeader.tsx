import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconButton } from './ClayButton';
import './common.css';

/**
 * Sub-screen header: back (‹) on the left, home (⌂) on the right, so every screen has a
 * one-tap way home however deep it is.
 */
export function ScreenHeader({
  title,
  right,
  onBack,
  onHome,
  showHome = true,
}: {
  title?: string;
  right?: ReactNode;
  onBack?: () => void;
  onHome?: () => void;
  showHome?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  // 'default' = first entry of this router's history → nowhere to go back to.
  const canGoBack = location.key !== 'default';
  const goHome = onHome ?? (() => navigate('/'));
  return (
    <header className="screen-header">
      <IconButton flat aria-label="뒤로 가기" onClick={onBack ?? (() => (canGoBack ? navigate(-1) : navigate('/')))}>
        ‹
      </IconButton>
      <h1 className="screen-header__title">{title}</h1>
      <div className="screen-header__right">
        {right}
        {showHome && location.pathname !== '/' && (
          <IconButton flat aria-label="홈으로" onClick={goHome}>
            <HomeIcon />
          </IconButton>
        )}
      </div>
    </header>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
