import { useLocation } from 'react-router-dom';
import { useAppState } from '../../app/store';
import type { UseCase } from '../../sounds/types';
import './screen.css';

/** Which mode's screen settings apply here: the screen's own mode, else what is playing. */
export function useScreenMode(): UseCase | null {
  const { pathname } = useLocation();
  const sessionMode = useAppState((s) => s.session?.mode ?? null);
  const playing = useAppState((s) => s.player.playing);
  const playerMode = useAppState((s) => s.player.mode);
  if (pathname.startsWith('/focus')) return 'focus';
  if (pathname.startsWith('/sleep')) return 'sleep';
  if (pathname.startsWith('/relax')) return 'relax';
  if (sessionMode) return sessionMode;
  return playing || pathname === '/now' ? playerMode : null;
}

/**
 * In-app brightness: a black layer over the app. Neither the Apps in Toss SDK nor the web can
 * change the device brightness, so this dims the app's own screen instead.
 */
export function DimOverlay() {
  const mode = useScreenMode();
  const dim = useAppState((s) => (mode ? s.settings.dimByMode[mode] : 0));
  if (!mode || dim <= 0) return null;
  return <div className="dim-overlay" style={{ opacity: dim }} aria-hidden="true" data-testid="dim-overlay" />;
}
