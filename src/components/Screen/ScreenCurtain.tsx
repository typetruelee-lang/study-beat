import { useEffect, useRef, useState } from 'react';
import { closeCurtain, openCurtain } from '../../app/actions';
import { describeSession } from '../../app/hooks';
import { useAppState } from '../../app/store';
import './screen.css';

const LONG_PRESS_MS = 600;

/**
 * Black screen: looks like the screen is off, while the app stays in front so sound keeps
 * playing and a focus session keeps recording. Double-tap or long-press to come back.
 */
export function ScreenCurtain() {
  const open = useAppState((s) => s.curtain);
  const session = useAppState((s) => s.session);
  const playing = useAppState((s) => s.player.playing);
  const [now, setNow] = useState(() => new Date());
  const [hint, setHint] = useState(true);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (!open) return;
    setHint(true);
    const clock = setInterval(() => setNow(new Date()), 15_000);
    const hideHint = setTimeout(() => setHint(false), 4000);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCurtain();
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(clock);
      clearTimeout(hideHint);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!open) return null;
  const view = session ? describeSession(session) : null;
  const status = view ? `${view.status} · ${view.bigTime}` : playing ? '재생 중' : '정지됨';
  // Move the dim clock a little every minute (avoids burn-in on OLED screens).
  const top = 30 + ((now.getMinutes() * 7) % 40);

  return (
    <div
      className="curtain"
      role="dialog"
      aria-label="검은 화면. 두 번 탭하거나 길게 누르면 돌아가요"
      onPointerDown={() => {
        setHint(true);
        press.current = setTimeout(closeCurtain, LONG_PRESS_MS);
        const t = Date.now();
        if (t - lastTap.current < 350) closeCurtain();
        lastTap.current = t;
      }}
      onPointerUp={() => press.current && clearTimeout(press.current)}
      onPointerLeave={() => press.current && clearTimeout(press.current)}
    >
      <div className="curtain__info" style={{ top: `${top}%` }}>
        <span className="curtain__clock">{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span className="curtain__status">{status}</span>
        <span className="curtain__hint" style={{ opacity: hint ? 1 : 0 }}>두 번 탭하거나 길게 누르면 돌아가요</span>
      </div>
    </div>
  );
}

/** Enter the black screen after N idle minutes while something is playing. */
export function useAutoCurtain() {
  const minutes = useAppState((s) => s.settings.autoCurtainMinutes);
  const active = useAppState((s) => s.player.playing || s.session?.status === 'running');
  const open = useAppState((s) => s.curtain);
  useEffect(() => {
    if (!minutes || !active || open) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => !document.hidden && openCurtain(), minutes * 60_000);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [minutes, active, open]);
}
