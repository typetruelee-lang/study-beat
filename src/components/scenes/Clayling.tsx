/**
 * The FOCUS CLAY mascot: a round cream clay character with a little leaf sprout.
 * Drawn around (0,0) = centre of the body. Original design.
 */
import { fill } from './clay';

export const CLAYLING_PALETTE = {
  skin: '#fff0df',
  cheek: '#f6a79a',
  leaf: '#86c08f',
  eye: '#4a3a33',
};

export function Clayling({
  id,
  eyes = 'open',
  breathe = true,
  showBody = true,
}: {
  id: string;
  eyes?: 'open' | 'down' | 'closed';
  breathe?: boolean;
  showBody?: boolean;
}) {
  return (
    <g className={breathe ? 'anim-breathe' : undefined}>
      {showBody && <ellipse cx="0" cy="8" rx="30" ry="27" fill={fill(id, 'skin')} />}
      {/* head */}
      <circle cx="0" cy="-34" r="31" fill={fill(id, 'skin')} />
      {/* sprout */}
      <path d="M0 -64 q-2 -8 0 -12" stroke="#6aa874" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="-8" cy="-76" rx="9" ry="5" transform="rotate(-25 -8 -76)" fill={fill(id, 'leaf')} />
      <ellipse cx="8" cy="-78" rx="9" ry="5" transform="rotate(25 8 -78)" fill={fill(id, 'leaf')} />
      {/* cheeks */}
      <ellipse cx="-17" cy="-26" rx="6.5" ry="4.2" fill={CLAYLING_PALETTE.cheek} opacity="0.75" />
      <ellipse cx="17" cy="-26" rx="6.5" ry="4.2" fill={CLAYLING_PALETTE.cheek} opacity="0.75" />
      {/* eyes */}
      {eyes === 'open' && (
        <>
          <ellipse cx="-10" cy="-35" rx="3.2" ry="4" fill={CLAYLING_PALETTE.eye} />
          <ellipse cx="10" cy="-35" rx="3.2" ry="4" fill={CLAYLING_PALETTE.eye} />
          <circle cx="-9" cy="-36.5" r="1.1" fill="#fff" />
          <circle cx="11" cy="-36.5" r="1.1" fill="#fff" />
        </>
      )}
      {eyes === 'down' && (
        <>
          <ellipse cx="-10" cy="-31" rx="3" ry="2.6" fill={CLAYLING_PALETTE.eye} />
          <ellipse cx="10" cy="-31" rx="3" ry="2.6" fill={CLAYLING_PALETTE.eye} />
        </>
      )}
      {eyes === 'closed' && (
        <>
          <path d="M-15 -33 q5 5 10 0" stroke={CLAYLING_PALETTE.eye} strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M5 -33 q5 5 10 0" stroke={CLAYLING_PALETTE.eye} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* mouth */}
      <path d="M-4 -20 q4 3 8 0" stroke={CLAYLING_PALETTE.eye} strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  );
}
