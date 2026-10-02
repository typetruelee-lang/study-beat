import type { UseCase } from '../../sounds/types';
import { SceneFrame } from './clay';
import './aura.css';

const PALETTE: Record<UseCase, [string, string, string]> = {
  focus: ['#8f7bff', '#4fb3ff', '#ff8a6b'],
  sleep: ['#4b5bd6', '#7a4fd6', '#1f8fbf'],
  relax: ['#3fc8a0', '#ffb07a', '#7a8cff'],
};
const LABEL: Record<UseCase, string> = { focus: '집중', sleep: '수면', relax: '휴식' };

/** Web-skin artwork: slowly drifting light orbs and sound rings (no images, GPU-cheap). */
export function AuraArt({ mode, active = true }: { mode: UseCase; active?: boolean }) {
  const [a, b, c] = PALETTE[mode];
  return (
    <SceneFrame label={`${LABEL[mode]} 분위기의 빛 이미지`} active={active} className="aura">
      <div className="aura__bg" />
      <div className="aura__orb aura__orb--1" style={{ background: `radial-gradient(circle, ${a} 0%, transparent 65%)` }} />
      <div className="aura__orb aura__orb--2" style={{ background: `radial-gradient(circle, ${b} 0%, transparent 65%)` }} />
      <div className="aura__orb aura__orb--3" style={{ background: `radial-gradient(circle, ${c} 0%, transparent 65%)` }} />
      <div className="aura__rings" aria-hidden="true">
        <span /><span /><span />
      </div>
    </SceneFrame>
  );
}
