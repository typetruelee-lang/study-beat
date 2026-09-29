import { useNavigate } from 'react-router-dom';
import { pauseSession, play, resumeSession, stopPlayback } from '../../app/actions';
import { describeSession, useMainSound } from '../../app/hooks';
import { useAppState } from '../../app/store';
import './player.css';

/** Always-visible compact player: [🌧 비] [10Hz] [23:41] [⏸] — tap opens Now Playing. */
export function MiniPlayer({ aboveTabs }: { aboveTabs: boolean }) {
  const navigate = useNavigate();
  const playing = useAppState((s) => s.player.playing);
  const session = useAppState((s) => s.session);
  const binauralOn = useAppState((s) => s.player.binauralOn);
  const beat = useAppState((s) => s.player.beat);
  const main = useMainSound();
  if (!playing && !session) return null;

  const view = session ? describeSession(session) : null;
  const toggle = () => {
    if (session) return session.status === 'running' ? pauseSession('user') : resumeSession();
    return playing ? stopPlayback() : play();
  };
  const isRunning = session ? session.status === 'running' : playing;

  return (
    <div className={`mini ${aboveTabs ? 'mini--above-tabs' : ''}`} onClick={() => navigate('/now')} role="region" aria-label="현재 재생">
      <div className="mini__main">
        <span aria-hidden="true" style={{ fontSize: 22 }}>{main?.emoji ?? '🎧'}</span>
        <span className="mini__name">{main?.name ?? '집중 사운드'}</span>
        {binauralOn && <span className="mini__tag">{beat}Hz</span>}
      </div>
      {view && <span className="mini__time" aria-label={`남은 시간 ${view.bigTime}`}>{view.bigTime}</span>}
      <button
        type="button"
        className="mini__btn"
        aria-label={isRunning ? '일시정지' : '재생'}
        onClick={(e) => {
          e.stopPropagation();
          void toggle();
        }}
      >
        {isRunning ? '❚❚' : '▶'}
      </button>
    </div>
  );
}
