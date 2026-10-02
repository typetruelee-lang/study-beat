import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endSessionEarly, pauseSession, resumeSession } from '../../app/actions';
import { describeSession, useMainSound } from '../../app/hooks';
import { useAppState } from '../../app/store';
import { formatDuration } from '../../lib/format';
import { ClayButton } from '../common/ClayButton';
import { ScreenHeader } from '../common/ScreenHeader';
import { Ring } from '../common/Ring';
import { ScreenControlsButton } from '../Screen/ScreenControls';
import { Sheet } from '../common/Sheet';
import { StudyScene } from '../scenes/StudyScene';
import { Waveform } from '../AudioPlayer/Waveform';
import { FocusSoundOptions } from './FocusOptions';
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
  const [soundOpen, setSoundOpen] = useState(false);

  useEffect(() => {
    if (!session || session.mode !== 'focus') navigate(lastResult ? '/focus/result' : '/', { replace: true });
  }, [session, lastResult, navigate]);

  if (!session || session.mode !== 'focus') return null;
  const view = describeSession(session);
  const phase = session.phases[session.phaseIndex];
  const ringValue = phase.seconds ? session.phaseElapsedMs / 1000 / phase.seconds : (session.phaseElapsedMs / 1000 / 3600) % 1;
  const running = session.status === 'running';

  return (
    <div className="screen screen--bare stack">
      {/* Leaving this screen keeps the session running; the mini player brings you back. */}
      <ScreenHeader title={view.isBreak ? '휴식 중' : '집중 중'} onBack={() => navigate('/')} right={<ScreenControlsButton mode="focus" />} />
      <div className="mode-hero mode-hero--small"><StudyScene id="focus-live" active={running} /></div>
      <div className="session-ring">
        <Ring value={ringValue} size={248} stroke={9} label="이번 집중 진행률">
          <p className="big-time" aria-live="off">{view.bigTime}</p>
          <p className="session-status">{view.status}</p>
          {binauralOn && !view.isBreak && <p className="hz-line"><b>{beat} Hz</b></p>}
        </Ring>
      </div>
      {view.sub && <p className="center muted">{view.sub}</p>}
      <Waveform playing={running} />

      <div className="session-meta">
        {main && <span>{main.emoji} {main.name}</span>}
        {binauralOn && <span>🎧 집중 사운드 {beat}Hz</span>}
        <span>🔊 {Math.round(master * 100)}%</span>
        <ClayButton variant="ghost" onClick={() => setSoundOpen(true)}>🎚 소리 바꾸기</ClayButton>
      </div>

      <Sheet open={soundOpen} onClose={() => setSoundOpen(false)} label="소리 바꾸기">
        <div className="stack">
          <p className="h2">소리 바꾸기</p>
          <p className="small muted">바꾼 소리는 바로 적용되고 다음 집중에도 그대로 쓰여요. 집중 기록은 계속돼요.</p>
          <FocusSoundOptions />
        </div>
      </Sheet>

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
