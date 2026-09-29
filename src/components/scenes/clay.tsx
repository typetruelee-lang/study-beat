/** Helpers for the clay look: every solid shape gets a soft radial gradient (light top-left, shade bottom-right). */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import './scenes.css';

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** amt > 0 mixes toward white, amt < 0 toward black. */
export function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt > 0 ? 255 : 0;
  const a = Math.abs(amt);
  const mix = (c: number) => Math.round(c + (t - c) * a);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export type Palette = Record<string, string>;

export function ClayDefs({ id, palette }: { id: string; palette: Palette }) {
  return (
    <defs>
      {Object.entries(palette).map(([k, c]) => (
        <radialGradient key={k} id={`${id}-${k}`} cx="32%" cy="28%" r="80%">
          <stop offset="0" stopColor={shade(c, 0.42)} />
          <stop offset="0.55" stopColor={c} />
          <stop offset="1" stopColor={shade(c, -0.2)} />
        </radialGradient>
      ))}
    </defs>
  );
}

export const fill = (id: string, key: string) => `url(#${id}-${key})`;

/** Soft contact shadow under an object. */
export function Shadow({ cx, cy, rx, ry = rx * 0.22, o = 0.14 }: { cx: number; cy: number; rx: number; ry?: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`rgba(70,40,20,${o})`} />;
}

/**
 * Wrapper that pauses CSS animations when the scene is off-screen or `active` is false,
 * so idle scenes cost nothing. Only scenes at least 30% on screen animate (important in the Toss WebView).
 */
export function SceneFrame({ children, label, active = true, className = '' }: { children: ReactNode; label: string; active?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`scene ${className}`} data-paused={!active || !visible} role="img" aria-label={label}>
      {children}
    </div>
  );
}
