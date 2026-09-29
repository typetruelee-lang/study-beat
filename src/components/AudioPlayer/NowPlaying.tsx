import { useNavigate } from 'react-router-dom';
import { endSessionEarly, pauseSession, play, resumeSession, stopPlayback } from '../../app/actions';
import { bandLabel, beatLabel } from '../../app/beats';
import { describeSession } from '../../app/hooks';
import { getState, useAppState } from '../../app/store';
import { getSound } from '../../sounds/catalog';
import { ClayButton } from '../common/ClayButton';
import { ScreenHeader } from '../common/ScreenHeader';
import { ScreenControlsButton } from '../Screen/ScreenControls';
import { RelaxScene } from '../scenes/RelaxScene';
import { SleepScene } from '../scenes/SleepScene';
import { StudyScene } from '../scenes/StudyScene';
import { SoundThumb } from '../scenes/SoundThumb';
import { Waveform } from './Waveform';
import '../Focus/focus.css';

const MODE_ROUTE = { focus: '/focus', sleep: '/sleep', relax: '/relax' } as const;
const MODE_LABEL = { focus: '집중 / 공부', sleep: '수면', relax: '휴식 / 명상' } as const;

export function NowPlaying() {
  const navigate = useNavigate();
  const player = useAppState((s) => s.player);
  const session = useAppState((s) => s.session);
  const view = session ? describeSession(session) : null;
  const running = session ? session.status === 'running' : player.playing;
  const Scene = player.mode === 'sleep' ? SleepScene : player.mode === 'relax' ? RelaxScene : StudyScene;

  return (
    <div className="screen screen--bare stack">
      <ScreenHeader title="현재 재생" right={<ScreenControlsButton mode={player.mode} />} />
      <div className="mode-hero mode-hero--small"><Scene id="now-scene" active={running} /></div>
      <p className="center strong muted">{MODE_LABEL[player.mode]}</p>
      {view && (
        <div className="stack-s">
          <p className="big-time">{view.bigTime}</p>
          <p className="session-status">{view.status}</p>
        </div>
      )}
      <Waveform playing={running} />

      <section className="card list" style={{ padding: '4px 20px' }} aria-label="재생 중인 소리">
        {player.binauralOn && (
          <div className="list-item" style={{ cursor: 'default' }}>
            <span className="strong">🎧 집중 사운드</span>
            <span className="muted">{player.beat}Hz · {bandLabel(player.beat)} · {beatLabel(player.beat)}</span>
          </div>
        )}
        {player.tracks.map((t) => {
          const s = getSound(t.id);
          if (!s) return null;
          return (
            <div key={t.id} className="list-item" style={{ cursor: 'default' }}>
              <span className="row"><SoundThumb thumb={s.thumb} id={`np-${s.id}`} size={36} /><span className="strong">{s.name}</span></span>
              <span className="muted tabular">{Math.round(t.volume * 100)}%</span>
            </div>
          );
        })}
      </section>

      <div className="session-controls">
        <ClayButton
          size="lg"
          variant="primary"
          onClick={() => {
            if (session) void (running ? pauseSession('user') : resumeSession());
            else void (player.playing ? stopPlayback() : play());
          }}
        >
          {running ? '❚❚ 일시정지' : '▶ 재생'}
        </ClayButton>
        {session && (
          <ClayButton
            size="lg"
            onClick={async () => {
              await endSessionEarly();
              if (getState().lastResult) navigate('/focus/result', { replace: true });
            }}
          >
            ■ 종료
          </ClayButton>
        )}
      </div>
      <div className="link-row">
        <ClayButton onClick={() => navigate('/mixer')}>🎚 소리 섞기</ClayButton>
        <ClayButton onClick={() => navigate(session?.mode === 'focus' ? '/focus/session' : MODE_ROUTE[player.mode])}>모드 화면</ClayButton>
      </div>
    </div>
  );
}
