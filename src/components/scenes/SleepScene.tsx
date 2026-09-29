import { ClayDefs, SceneFrame, fill } from './clay';
import { Clayling, CLAYLING_PALETTE } from './Clayling';

const P = {
  ...CLAYLING_PALETTE,
  moon: '#f8e3a0',
  cloud: '#d7dcf5',
  bed: '#8a7bd1',
  blanket: '#7fa4dc',
  pillow: '#f3f1fb',
  cat: '#f0b37e',
  star: '#fff4c4',
};

const STARS = [
  [40, 30, 0], [96, 56, 1.2], [150, 24, 2.1], [210, 46, 0.6], [318, 70, 1.7], [60, 92, 2.6], [250, 22, 3.1],
] as const;

/** 수면 — sleeping character under a blanket, clay moon, twinkling stars, a curled-up cat. */
export function SleepScene({ id = 'sleep', active = true }: { id?: string; active?: boolean }) {
  return (
    <SceneFrame label="침대에서 잠든 클레이 캐릭터와 고양이" active={active}>
      <svg viewBox="0 0 360 230" preserveAspectRatio="xMidYMid slice">
        <ClayDefs id={id} palette={P} />
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2548" />
            <stop offset="1" stopColor="#35457d" />
          </linearGradient>
          <radialGradient id={`${id}-moonglow`}>
            <stop offset="0" stopColor="#fff0b3" stopOpacity="0.45" />
            <stop offset="1" stopColor="#fff0b3" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="230" fill={`url(#${id}-sky)`} />
        {STARS.map(([x, y, d]) => (
          <circle key={`${x}-${y}`} className="anim-twinkle" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r="3" fill={fill(id, 'star')} />
        ))}
        <circle cx="286" cy="52" r="56" fill={`url(#${id}-moonglow)`} />
        <circle cx="286" cy="52" r="28" fill={fill(id, 'moon')} />
        <circle cx="300" cy="42" r="24" fill="#26325f" />
        <g className="anim-drift">
          <ellipse cx="120" cy="80" rx="34" ry="14" fill={fill(id, 'cloud')} opacity="0.85" />
          <ellipse cx="140" cy="72" rx="22" ry="14" fill={fill(id, 'cloud')} opacity="0.85" />
        </g>
        <g className="anim-drift-slow">
          <ellipse cx="230" cy="112" rx="28" ry="11" fill={fill(id, 'cloud')} opacity="0.6" />
        </g>
        {/* bed */}
        <rect x="24" y="130" width="26" height="92" rx="12" fill={fill(id, 'bed')} />
        <rect x="36" y="168" width="300" height="46" rx="18" fill={fill(id, 'bed')} />
        <ellipse cx="96" cy="160" rx="44" ry="18" fill={fill(id, 'pillow')} />
        {/* sleeping character (head on pillow) */}
        <g transform="translate(100 176) rotate(-8) scale(0.85)">
          <Clayling id={id} eyes="closed" showBody={false} />
        </g>
        {/* blanket — breathes */}
        <g className="anim-breathe-slow" style={{ transformOrigin: '220px 196px' }}>
          <path d="M112 196 q10 -38 70 -34 q90 -6 144 12 q10 16 0 30 q-110 10 -214 -8z" fill={fill(id, 'blanket')} />
          <path d="M150 170 q40 12 90 0" stroke="#9cbbe8" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>
        {/* z z */}
        <text className="anim-zzz" x="132" y="114" fill="#dfe4ff" fontSize="18" fontWeight="700">z</text>
        <text className="anim-zzz" style={{ animationDelay: '1.4s' }} x="146" y="98" fill="#dfe4ff" fontSize="14" fontWeight="700">z</text>
        {/* cat curled at the foot of the bed */}
        <g transform="translate(300 160)">
          <path className="anim-tail" d="M18 6 q18 -4 14 -22" stroke="#e29f69" strokeWidth="7" strokeLinecap="round" fill="none" style={{ transformOrigin: '18px 6px' }} />
          <ellipse cx="0" cy="4" rx="24" ry="15" fill={fill(id, 'cat')} />
          <circle cx="-16" cy="-4" r="12" fill={fill(id, 'cat')} />
          <path d="M-26 -10 l3 -12 l7 8z M-12 -14 l6 -10 l3 11z" fill="#e29f69" />
          <path d="M-22 -4 q3 2 6 0 M-14 -4 q3 2 6 0" stroke="#5a3f30" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    </SceneFrame>
  );
}
