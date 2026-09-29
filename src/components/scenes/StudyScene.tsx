import { ClayDefs, Shadow, SceneFrame, fill } from './clay';
import { Clayling, CLAYLING_PALETTE } from './Clayling';

const P = {
  ...CLAYLING_PALETTE,
  wood: '#c98a5c',
  woodDark: '#a86d45',
  book1: '#e9794f',
  book2: '#8fbf98',
  book3: '#9cc7e4',
  paper: '#fffaf0',
  lamp: '#f6d27a',
  laptop: '#b9c3cf',
  tree: '#8cc58f',
  pot: '#e59a6f',
  frame: '#fff4e6',
};

/** 집중 / 공부 — clay character studying at a desk in a warm afternoon room. */
export function StudyScene({ id = 'study', active = true }: { id?: string; active?: boolean }) {
  return (
    <SceneFrame label="책상에서 공부하는 클레이 캐릭터" active={active}>
      <svg viewBox="0 0 360 230" preserveAspectRatio="xMidYMid slice">
        <ClayDefs id={id} palette={P} />
        <defs>
          <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde9d2" />
            <stop offset="1" stopColor="#f8d6b4" />
          </linearGradient>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bfe2f3" />
            <stop offset="1" stopColor="#fbe7c9" />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" stopColor="#fff3b8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#fff3b8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="360" height="230" fill={`url(#${id}-wall)`} />
        {/* window */}
        <rect x="26" y="22" width="112" height="92" rx="18" fill={fill(id, 'frame')} />
        <rect x="36" y="32" width="92" height="72" rx="12" fill={`url(#${id}-sky)`} />
        <g className="anim-sway" style={{ transformOrigin: '70px 104px' }}>
          <circle cx="62" cy="70" r="20" fill={fill(id, 'tree')} />
          <circle cx="84" cy="62" r="16" fill={fill(id, 'tree')} />
          <circle cx="98" cy="80" r="14" fill={fill(id, 'tree')} />
        </g>
        <rect x="80" y="32" width="5" height="72" fill="#fff4e6" />
        <rect x="36" y="66" width="92" height="5" fill="#fff4e6" />
        {/* shelf plant */}
        <rect x="286" y="36" width="44" height="30" rx="10" fill={fill(id, 'pot')} />
        <ellipse cx="300" cy="32" rx="10" ry="14" transform="rotate(-20 300 32)" fill={fill(id, 'tree')} />
        <ellipse cx="316" cy="30" rx="10" ry="15" transform="rotate(18 316 30)" fill={fill(id, 'tree')} />
        {/* lamp glow */}
        <circle className="anim-flicker" cx="272" cy="118" r="70" fill={`url(#${id}-glow)`} />
        {/* character */}
        <g transform="translate(180 132)">
          <Clayling id={id} eyes="down" />
        </g>
        {/* desk */}
        <Shadow cx={180} cy={222} rx={150} o={0.12} />
        <rect x="30" y="150" width="300" height="24" rx="12" fill={fill(id, 'wood')} />
        <rect x="52" y="170" width="16" height="52" rx="7" fill={fill(id, 'woodDark')} />
        <rect x="292" y="170" width="16" height="52" rx="7" fill={fill(id, 'woodDark')} />
        {/* books */}
        <rect x="46" y="134" width="56" height="12" rx="5" fill={fill(id, 'book1')} />
        <rect x="50" y="122" width="50" height="12" rx="5" fill={fill(id, 'book2')} />
        <rect x="44" y="110" width="54" height="12" rx="5" fill={fill(id, 'book3')} />
        {/* open book with turning page */}
        <path d="M140 150 q20 -12 40 -4 q20 -8 40 4 z" fill={fill(id, 'paper')} />
        <path className="anim-page" d="M180 146 q16 -8 36 2 l-2 2 q-18 -7 -34 -2z" fill="#f3e6d2" />
        {/* hands + pencil */}
        <g className="anim-write">
          <rect x="196" y="126" width="5" height="26" rx="2" transform="rotate(35 198 139)" fill={fill(id, 'lamp')} />
          <circle cx="198" cy="146" r="9" fill={fill(id, 'skin')} />
        </g>
        <circle cx="160" cy="147" r="9" fill={fill(id, 'skin')} />
        {/* lamp */}
        <ellipse cx="272" cy="148" rx="20" ry="6" fill={fill(id, 'woodDark')} />
        <path d="M272 146 L262 108" stroke="#a86d45" strokeWidth="6" strokeLinecap="round" />
        <path d="M244 98 q18 -26 40 -4 z" fill={fill(id, 'lamp')} />
        {/* mug */}
        <rect x="110" y="128" width="20" height="22" rx="6" fill={fill(id, 'book3')} />
        <path d="M130 134 q8 4 0 10" stroke="#8fb7d4" strokeWidth="4" fill="none" />
      </svg>
    </SceneFrame>
  );
}
