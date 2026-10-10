import { useEffect, useRef, useState } from 'react';
import { closeCurtain, openCurtain } from '../../app/actions';
import { describeSession } from '../../app/hooks';
import { useAppState } from '../../app/store';
import './screen.css';

/** How long the clock and the slider stay up after a touch. */
const SHOW_MS = 5000;
/** Share of the track the knob must travel to come back. */
const SLIDE_DONE = 0.85;

/**
 * Dark screen ("어둡게 두기"): looks like the screen is off, while the app stays in front so sound
 * keeps playing and a focus session keeps recording — a phone that really turns its screen off can
 * stop the sound. Neither the web nor the Apps in Toss SDK can change the device brightness, so the
 * screen is simply black (OLED pixels off). Touches only show the clock; coming back takes a
 * deliberate slide, so a phone in a pocket or under a hand stays dark.
 */
export function ScreenCurtain() {
  const open = useAppState((s) => s.curtain);
  const session = useAppState((s) => s.session);
  const playing = useAppState((s) => s.player.playing);
  const [now, setNow] = useState(() => new Date());
  const [poke, setPoke] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPoke((p) => p + 1);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCurtain();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Each touch shows the clock and slider again, then the screen goes fully black.
  useEffect(() => {
    if (!open || !poke) return;
    setShow(true);
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    const hide = setTimeout(() => setShow(false), SHOW_MS);
    return () => {
      clearInterval(clock);
      clearTimeout(hide);
    };
  }, [open, poke]);

  if (!open) return null;
  const view = session ? describeSession(session) : null;
  const status = view ? `${view.status} · ${view.bigTime}` : playing ? '소리 재생 중' : '정지됨';
  // Move the clock a little every minute (avoids burn-in on OLED screens).
  const top = 24 + ((now.getMinutes() * 7) % 36);
  const touch = () => setPoke((p) => p + 1);

  return (
    <div className="curtain" role="dialog" aria-label="어둡게 두기. 밀어서 돌아가요" onPointerDown={touch}>
      <div className="curtain__info" style={{ top: `${top}%`, opacity: show ? 1 : 0 }} aria-hidden={!show}>
        <span className="curtain__clock">{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <span className="curtain__status">{status}</span>
      </div>
      <div className="curtain__bottom" style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }}>
        <SlideToReturn onMove={touch} onDone={closeCurtain} />
        <span className="curtain__hint">화면을 만져도 그대로예요</span>
      </div>
      <button type="button" className="sr-only" onClick={closeCurtain}>돌아가기</button>
    </div>
  );
}

function SlideToReturn({ onMove, onDone }: { onMove: () => void; onDone: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: number; max: number } | null>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const xRef = useRef(0);
  const move = (v: number) => {
    xRef.current = v;
    setX(v);
  };
  const release = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && xRef.current >= d.max * SLIDE_DONE) onDone();
    else move(0);
  };

  return (
    <div className="slide" ref={track}>
      <span className="slide__label" style={{ opacity: 1 - x / 160 }}>밀어서 돌아가기</span>
      <span
        className="slide__knob"
        aria-hidden="true"
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : undefined }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          const max = (track.current?.clientWidth ?? 0) - e.currentTarget.offsetWidth - 8;
          drag.current = { from: e.clientX - xRef.current, max };
          setDragging(true);
          onMove();
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          move(Math.max(0, Math.min(d.max, e.clientX - d.from)));
          onMove();
        }}
        onPointerUp={release}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          move(0);
        }}
      >
        ›
      </span>
    </div>
  );
}

/** Go dark after N idle minutes while something is playing (the display is kept on until then). */
export function useAutoDark() {
  const minutes = useAppState((s) => s.settings.autoDarkMinutes);
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
