import { ClayDefs, SceneFrame, Shadow, fill } from './clay';
import { Clayling, CLAYLING_PALETTE } from './Clayling';

const P = {
  ...CLAYLING_PALETTE,
  sun: '#ffc978',
  hill1: '#9fcf96',
  hill2: '#7fb784',
  tree: '#6fae78',
  trunk: '#a8704b',
  rock: '#c9b8a8',
  cloud: '#fff1e6',
  bunny: '#fbf6f0',
  cushion: '#b3a5de',
};

/** 휴식 / 명상 — meditating character by a lake at sunset. */
export function RelaxScene({ id = 'relax', active = true }: { id?: string; active?: boolean }) {
  return (
    <SceneFrame label="노을 진 호숫가에서 명상하는 클레이 캐릭터" active={active}>
      <svg viewBox="0 0 360 230" preserveAspectRatio="xMidYMid slice">
        <ClayDefs id={id} palette={P} />
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7b9a3" />
            <stop offset="0.55" stopColor="#fcd5a8" />
            <stop offset="1" stopColor="#fde7c4" />
          </linearGradient>
          <linearGradient id={`${id}-lake`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fc9e0" />
            <stop offset="1" stopColor="#7eb0d0" />
          </linearGradient>
        </defs>
        <rect width="360" height="230" fill={`url(#${id}-sky)`} />
        <circle cx="250" cy="104" r="34" fill={fill(id, 'sun')} />
        <g className="anim-drift">
          <ellipse cx="80" cy="46" rx="32" ry="12" fill={fill(id, 'cloud')} />
          <ellipse cx="100" cy="38" rx="20" ry="12" fill={fill(id, 'cloud')} />
        </g>
        <g className="anim-drift-slow">
          <ellipse cx="300" cy="30" rx="24" ry="9" fill={fill(id, 'cloud')} opacity="0.9" />
        </g>
        <path d="M0 128 q70 -44 150 -8 q60 -34 120 -10 q50 -14 90 6 V230 H0z" fill={fill(id, 'hill2')} />
        <path d="M0 150 q90 -30 180 -4 q100 -26 180 0 V230 H0z" fill={fill(id, 'hill1')} />
        {/* lake */}
        <ellipse cx="250" cy="188" rx="120" ry="30" fill={`url(#${id}-lake)`} />
        <ellipse className="anim-ripple" cx="250" cy="188" rx="40" ry="8" fill="none" stroke="#e8f4fb" strokeWidth="2" />
        <ellipse className="anim-ripple" style={{ animationDelay: '2s' }} cx="280" cy="194" rx="30" ry="6" fill="none" stroke="#e8f4fb" strokeWidth="2" />
        {/* tree */}
        <rect x="42" y="112" width="12" height="50" rx="5" fill={fill(id, 'trunk')} />
        <g className="anim-sway" style={{ transformOrigin: '48px 150px' }}>
          <circle cx="48" cy="100" r="30" fill={fill(id, 'tree')} />
          <circle cx="28" cy="116" r="18" fill={fill(id, 'tree')} />
          <circle cx="70" cy="114" r="18" fill={fill(id, 'tree')} />
        </g>
        {/* character on a cushion */}
        <Shadow cx={140} cy={204} rx={50} o={0.12} />
        <ellipse cx="140" cy="194" rx="46" ry="14" fill={fill(id, 'cushion')} />
        <g transform="translate(140 164)">
          <ellipse cx="-24" cy="24" rx="20" ry="9" fill={fill(id, 'skin')} />
          <ellipse cx="24" cy="24" rx="20" ry="9" fill={fill(id, 'skin')} />
          <Clayling id={id} eyes="closed" />
          <circle cx="-30" cy="16" r="8" fill={fill(id, 'skin')} />
          <circle cx="30" cy="16" r="8" fill={fill(id, 'skin')} />
        </g>
        {/* bunny friend */}
        <g transform="translate(80 196)">
          <ellipse cx="0" cy="0" rx="13" ry="10" fill={fill(id, 'bunny')} />
          <circle cx="10" cy="-8" r="8" fill={fill(id, 'bunny')} />
          <ellipse cx="8" cy="-22" rx="3" ry="9" fill={fill(id, 'bunny')} />
          <ellipse cx="14" cy="-21" rx="3" ry="9" fill={fill(id, 'bunny')} />
          <circle cx="13" cy="-9" r="1.4" fill="#4a3a33" />
        </g>
      </svg>
    </SceneFrame>
  );
}
