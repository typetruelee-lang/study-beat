import type { ThumbId } from '../../sounds/types';
import { ClayDefs, fill } from './clay';

const BG: Record<ThumbId, string> = {
  rain: '#cfe2f1', waves: '#cde9f0', forest: '#d8ecd4', wind: '#e4efe0', birds: '#f7ecd0', stream: '#d4eceb',
  fire: '#f8dcc8', cafe: '#f1e0cf', library: '#efe3d2', train: '#e2e0ef', city: '#2f3a64', noise: '#ece6f5',
  moon: '#2b3765', fan: '#e2edf2', pad: '#ece2f6', lake: '#d9e9f3',
};

const P = {
  cloud: '#f7f9fc', drop: '#7fb2dd', wave: '#79b9d6', sand: '#f2d6a2', tree: '#79b983', trunk: '#a8704b',
  roof: '#e9794f', wall: '#f6e3c8', leaf: '#9ccf9a', bird: '#f3b467', water: '#8cc6d3', flame: '#f39a4f',
  flame2: '#f7cf6a', log: '#a8704b', cup: '#fff7ee', table: '#c98a5c', book1: '#e9794f', book2: '#8fbf98',
  book3: '#9cc7e4', train: '#e9794f', window: '#fff1c9', building: '#4a5a8c', moon: '#f8e3a0', fan: '#b8cbd6',
  noteA: '#b3a5de', noteB: '#f5b6c8',
};

// Only the gradients each thumbnail uses are emitted (keeps the library DOM light).
const USED: Record<ThumbId, (keyof typeof P)[]> = {
  rain: ['cloud', 'drop'], waves: ['sand', 'wave'], lake: ['water', 'flame2'], forest: ['tree', 'wall', 'roof'],
  wind: ['leaf'], birds: ['bird'], stream: ['water'], fire: ['log', 'flame', 'flame2'], cafe: ['table', 'cup'],
  library: ['book1', 'book2', 'book3'], train: ['train', 'window'], city: ['moon', 'building'], noise: [],
  moon: ['moon'], fan: ['cloud', 'fan'], pad: ['noteA', 'noteB'],
};

/** Small clay thumbnail for a sound (64×64). */
export function SoundThumb({ thumb, id, size = 56 }: { thumb: ThumbId; id: string; size?: number }) {
  const f = (k: keyof typeof P) => fill(id, k);
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ borderRadius: 18, flex: 'none' }}>
      <ClayDefs id={id} palette={Object.fromEntries(USED[thumb].map((k) => [k, P[k]]))} />
      <rect width="64" height="64" rx="18" fill={BG[thumb]} />
      {thumb === 'rain' && (
        <>
          <ellipse cx="30" cy="24" rx="16" ry="9" fill={f('cloud')} />
          <circle cx="38" cy="20" r="9" fill={f('cloud')} />
          {[18, 28, 38, 46].map((x, i) => <ellipse key={x} cx={x} cy={40 + (i % 2) * 6} rx="2.6" ry="4" fill={f('drop')} />)}
        </>
      )}
      {(thumb === 'waves' || thumb === 'lake') && (
        <>
          {thumb === 'waves' && <path d="M0 48 h64 v16 h-64z" fill={f('sand')} />}
          <path d="M0 36 q8 -8 16 0 t16 0 t16 0 t16 0 v14 h-64z" fill={f(thumb === 'lake' ? 'water' : 'wave')} />
          <path d="M4 34 q6 -5 12 0" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          {thumb === 'lake' && <circle cx="46" cy="18" r="7" fill={f('flame2')} />}
        </>
      )}
      {thumb === 'forest' && (
        <>
          <circle cx="20" cy="28" r="12" fill={f('tree')} />
          <circle cx="46" cy="24" r="13" fill={f('tree')} />
          <rect x="24" y="36" width="18" height="14" rx="3" fill={f('wall')} />
          <path d="M22 38 l11 -10 l11 10z" fill={f('roof')} />
        </>
      )}
      {thumb === 'wind' && (
        <>
          <path d="M10 26 h30 q8 0 8 -6" stroke="#8fbf98" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M14 38 h36 q6 0 6 6" stroke="#8fbf98" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="44" cy="30" rx="6" ry="3.5" transform="rotate(-30 44 30)" fill={f('leaf')} />
        </>
      )}
      {thumb === 'birds' && (
        <>
          <path d="M8 46 q24 -8 48 0" stroke="#a8704b" strokeWidth="4" strokeLinecap="round" fill="none" />
          <ellipse cx="32" cy="34" rx="11" ry="9" fill={f('bird')} />
          <circle cx="40" cy="28" r="6" fill={f('bird')} />
          <path d="M45 28 l5 1 l-5 2z" fill="#e9794f" />
        </>
      )}
      {thumb === 'stream' && (
        <>
          <path d="M20 0 q-10 20 6 32 q16 12 4 32 h16 q10 -20 -6 -32 q-14 -12 -4 -32z" fill={f('water')} />
          <ellipse cx="14" cy="44" rx="7" ry="5" fill="#c9b8a8" />
          <ellipse cx="52" cy="22" rx="6" ry="4" fill="#c9b8a8" />
        </>
      )}
      {thumb === 'fire' && (
        <>
          <rect x="14" y="44" width="36" height="7" rx="3.5" transform="rotate(-12 32 47)" fill={f('log')} />
          <rect x="14" y="44" width="36" height="7" rx="3.5" transform="rotate(12 32 47)" fill={f('log')} />
          <path d="M32 14 q14 14 8 26 q-8 8 -16 0 q-6 -12 8 -26z" fill={f('flame')} />
          <path d="M32 26 q7 7 4 13 q-4 4 -8 0 q-3 -6 4 -13z" fill={f('flame2')} />
        </>
      )}
      {thumb === 'cafe' && (
        <>
          <rect x="10" y="42" width="44" height="7" rx="3.5" fill={f('table')} />
          <rect x="22" y="26" width="18" height="16" rx="5" fill={f('cup')} />
          <path d="M40 30 q7 3 0 9" stroke="#e9d9c6" strokeWidth="3" fill="none" />
          <path d="M28 20 q-3 -4 0 -8 M34 20 q-3 -4 0 -8" stroke="#c9b8a8" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {thumb === 'library' && (
        <>
          <rect x="12" y="18" width="10" height="32" rx="3" fill={f('book1')} />
          <rect x="24" y="22" width="10" height="28" rx="3" fill={f('book2')} />
          <rect x="36" y="16" width="10" height="34" rx="3" transform="rotate(8 41 33)" fill={f('book3')} />
        </>
      )}
      {thumb === 'train' && (
        <>
          <rect x="10" y="20" width="44" height="26" rx="10" fill={f('train')} />
          <rect x="16" y="25" width="12" height="10" rx="3" fill={f('window')} />
          <rect x="34" y="25" width="12" height="10" rx="3" fill={f('window')} />
          <circle cx="20" cy="48" r="5" fill="#5a4a42" />
          <circle cx="44" cy="48" r="5" fill="#5a4a42" />
        </>
      )}
      {thumb === 'city' && (
        <>
          <circle cx="48" cy="14" r="6" fill={f('moon')} />
          <rect x="8" y="28" width="14" height="30" rx="3" fill={f('building')} />
          <rect x="24" y="20" width="16" height="38" rx="3" fill={f('building')} />
          <rect x="42" y="32" width="14" height="26" rx="3" fill={f('building')} />
          {[[12, 34], [28, 26], [32, 36], [46, 38], [28, 46]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="4" height="4" rx="1" fill="#ffe28a" />)}
        </>
      )}
      {thumb === 'noise' && (
        <path d="M8 32 q4 -12 8 0 t8 0 t8 0 t8 0 t8 0 t8 0" stroke="#9a8bd0" strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
      {thumb === 'moon' && (
        <>
          <circle cx="32" cy="30" r="14" fill={f('moon')} />
          <circle cx="39" cy="25" r="12" fill="#2b3765" />
          <circle cx="14" cy="16" r="2" fill="#fff4c4" />
          <circle cx="50" cy="46" r="2" fill="#fff4c4" />
        </>
      )}
      {thumb === 'fan' && (
        <>
          <circle cx="32" cy="28" r="18" fill={f('cloud')} />
          {[0, 120, 240].map((a) => <ellipse key={a} cx="32" cy="18" rx="5" ry="9" transform={`rotate(${a} 32 28)`} fill={f('fan')} />)}
          <rect x="29" y="44" width="6" height="12" rx="3" fill={f('fan')} />
        </>
      )}
      {thumb === 'pad' && (
        <>
          <circle cx="24" cy="40" r="7" fill={f('noteA')} />
          <rect x="29" y="16" width="4" height="25" rx="2" fill={f('noteA')} />
          <circle cx="42" cy="36" r="6" fill={f('noteB')} />
          <rect x="46" y="14" width="4" height="23" rx="2" fill={f('noteB')} />
        </>
      )}
    </svg>
  );
}
