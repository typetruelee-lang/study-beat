import { ClayDefs, Shadow, fill } from './clay';

const P = { pot: '#e59a6f', soil: '#8a5a3c', leaf: '#86c08f', leafDark: '#6aa874', trunk: '#a8704b', fruit: '#f28c6a', seed: '#c98a5c' };
const LABELS = ['씨앗', '새싹', '어린 나무', '나무', '큰 나무'] as const;

/** Clay tree that grows with today's recorded focus time. stage 0…4 */
export function GrowthTree({ stage, id = 'tree', size = 140 }: { stage: 0 | 1 | 2 | 3 | 4; id?: string; size?: number }) {
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label={`오늘의 클레이 나무: ${LABELS[stage]}`}>
      <ClayDefs id={id} palette={P} />
      <Shadow cx={70} cy={130} rx={38} o={0.12} />
      <g className="tree-grow" key={stage}>
        {stage === 0 && <ellipse cx="70" cy="100" rx="9" ry="6" fill={fill(id, 'seed')} />}
        {stage === 1 && (
          <>
            <path d="M70 104 V86" stroke="#6aa874" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="62" cy="84" rx="9" ry="5" transform="rotate(-25 62 84)" fill={fill(id, 'leaf')} />
            <ellipse cx="78" cy="82" rx="9" ry="5" transform="rotate(25 78 82)" fill={fill(id, 'leaf')} />
          </>
        )}
        {stage >= 2 && (
          <rect x={stage >= 3 ? 64 : 66} y={stage === 2 ? 72 : 60} width={stage >= 3 ? 12 : 8} height={stage === 2 ? 34 : 46} rx="4" fill={fill(id, 'trunk')} />
        )}
        {stage === 2 && (
          <>
            <circle cx="70" cy="64" r="18" fill={fill(id, 'leaf')} />
            <circle cx="58" cy="72" r="10" fill={fill(id, 'leafDark')} />
          </>
        )}
        {stage >= 3 && (
          <>
            <circle cx="70" cy={stage === 4 ? 44 : 52} r={stage === 4 ? 32 : 26} fill={fill(id, 'leaf')} />
            <circle cx="48" cy={stage === 4 ? 60 : 64} r={stage === 4 ? 20 : 15} fill={fill(id, 'leafDark')} />
            <circle cx="92" cy={stage === 4 ? 60 : 64} r={stage === 4 ? 20 : 15} fill={fill(id, 'leafDark')} />
          </>
        )}
        {stage === 4 && (
          <>
            <circle cx="60" cy="38" r="5" fill={fill(id, 'fruit')} />
            <circle cx="84" cy="48" r="5" fill={fill(id, 'fruit')} />
            <circle cx="96" cy="62" r="4.5" fill={fill(id, 'fruit')} />
          </>
        )}
      </g>
      <path d="M44 104 h52 l-6 26 h-40z" fill={fill(id, 'pot')} />
      <ellipse cx="70" cy="104" rx="26" ry="5" fill={fill(id, 'soil')} />
    </svg>
  );
}

export const GROWTH_LABELS = LABELS;
