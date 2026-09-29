import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endSessionEarly, pauseSession, resumeSession } from '../../app/actions';
import { describeSession, useMainSound } from '../../app/hooks';
import { useAppState } from '../../app/store';
import { formatDuration } from '../../lib/format';
import { ClayButton } from '../common/ClayButton';
import { ScreenHeader } from '../common/ScreenHeader';
import { Sheet } from '../common/Sheet';
import { StudyScene } from '../scenes/StudyScene';
import { Waveform } from '../AudioPlayer/Waveform';
import './focus.css';

/** Minimal in-session screen: time, state, and only 일시정지 / 종료 (spec 49). */
export function FocusSession() {
  const navigate = useNavigate();
  const session = useAppState((s) => s.session);
  const lastResult = useAppState((s) => s.lastResult);
  const binauralOn = useAppState((s) => s.player.binauralOn);
  const beat = useAppState((s) => s.player.beat);
  const master = useAppState((s) => s.settings.masterVolume);
  const main = useMainSound();
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (!session || session.mode !== 'focus') navigate(lastResult ? '/focus/result' : '/', { replace: true });
  }, [session, lastResult, navigate]);

  if (!session || session.mode !== 'focus') return null;
  const view = describeSession(session);
  const running = session.status === 'running';

  return (
    <div className="screen screen--bare stack">
      {/* Leaving this screen keeps the session running; the mini player brings you back. */}
      <ScreenHeader title={view.isBreak ? '휴식 중' : '집중 중'} onBack={() => navigate('/')} />
      <div className="mode-hero mode-hero--small"><StudyScene id="focus-live" active={running} /></div>
      <div className="stack-s" style={{ marginTop: 8 }}>
        <p className="big-time big-time--xl" aria-live="off">{view.bigTime}</p>
        <p className="session-status">{view.status}</p>
        {view.sub && <p className="center muted">{view.sub}</p>}
        {binauralOn && !view.isBreak && <p className="hz-line"><b>{beat} Hz</b></p>}
        <Waveform playing={running} />
      </div>

      <div className="session-meta">
        {main && <span>{main.emoji} {main.name}</span>}
        {binauralOn && <span>🎧 집중 사운드 {beat}Hz</span>}
        <span>🔊 {Math.round(master * 100)}%</span>
      </div>

      <p className="center small faint">다른 앱을 사용하지 않고 집중을 계속해보세요.</p>

      <div className="session-controls">
        <ClayButton size="lg" onClick={() => (running ? pauseSession('user') : resumeSession())}>
          {running ? '❚❚ 일시정지' : '▶ 계속'}
        </ClayButton>
        <ClayButton size="lg" onClick={() => setConfirmEnd(true)}>■ 종료</ClayButton>
      </div>

      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} label="집중 종료 확인">
        <div className="stack center">
          <p className="h2">지금 종료할까요?</p>
          <p className="muted">지금까지 {formatDuration(session.focusedMs / 1000)}이 기록돼요.</p>
          <ClayButton
            variant="primary"
            size="lg"
            block
            onClick={async () => {
              setConfirmEnd(false);
              await endSessionEarly();
            }}
          >
            종료하고 기록하기
          </ClayButton>
          <ClayButton block onClick={() => setConfirmEnd(false)}>계속 집중하기</ClayButton>
        </div>
      </Sheet>
    </div>
  );
}
