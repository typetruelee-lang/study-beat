import { useEffect, useRef } from 'react';
import { services } from '../../app/services';
import { useAppState } from '../../app/store';
import './player.css';

/**
 * Small wave under the Hz label. Uses the engine's analyser when audio runs (≈15 fps canvas,
 * sized once per resize — not per frame),
 * otherwise a cheap CSS-animated SVG sine.
 */
export function Waveform({ playing }: { playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Nothing to draw under the dark screen: stop the frame loop.
  const dark = useAppState((s) => s.curtain);
  const analyser = playing && !dark ? services.audio.getAnalyser() : null;

  useEffect(() => {
    const c = canvas.current;
    if (!analyser || !c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let last = 0;
    const color = getComputedStyle(c).color;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(c);
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 66 || document.hidden) return;
      last = t;
      const w = c.width;
      const h = c.height;
      analyser.getByteTimeDomainData(data);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 2.5 * dpr;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.beginPath();
      const step = Math.max(1, Math.floor(data.length / 64));
      for (let i = 0, x = 0; i < data.length; i += step, x++) {
        const px = (i / data.length) * w;
        const py = h / 2 + ((data[i] - 128) / 128) * h * 1.6;
        if (x === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [analyser]);

  if (analyser) return <canvas ref={canvas} className="wave" aria-hidden="true" />;
  let d = 'M0 18';
  for (let x = 0; x <= 420; x += 15) d += ` Q${x + 7.5} ${x % 30 === 0 ? 6 : 30} ${x + 15} 18`;
  return (
    <svg className="wave wave--idle" viewBox="0 0 360 36" preserveAspectRatio="none" data-paused={!playing} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity={playing ? 1 : 0.4} />
    </svg>
  );
}
