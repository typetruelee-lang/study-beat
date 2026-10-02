import { GrowthTree } from '../components/scenes/GrowthTree';
import '../components/AudioPlayer/player.css';

export function Splash() {
  return (
    <div className="splash" role="status" aria-label="몰입각 불러오는 중">
      <div className="splash__inner">
        <GrowthTree stage={1} id="splash-tree" size={96} />
        <p className="splash__logo">몰입각</p>
        <p className="muted small">좋은 소리로, 더 깊게 집중하세요.</p>
      </div>
    </div>
  );
}
