import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { prewarmMode, selectMode } from '../../app/actions';
import { bandLabel, beatLabel } from '../../app/beats';
import { useMixSummary } from '../../app/hooks';
import { useAppState } from '../../app/store';
import { formatClock } from '../../lib/format';
import { ClayButton } from '../common/ClayButton';
import { ScreenHeader } from '../common/ScreenHeader';
import { StudyScene } from '../scenes/StudyScene';
import { Waveform } from '../AudioPlayer/Waveform';
import { FocusOptions } from './FocusOptions';
import './focus.css';

export function FocusSetup() {
  const navigate = useNavigate();
  const timer = useAppState((s) => s.settings.focusTimer);
  const routines = useAppState((s) => s.routines);
  const binauralOn = useAppState((s) => s.player.binauralOn);
  const beat = useAppState((s) => s.player.beat);
  const playing = useAppState((s) => s.player.playing);
  const session = useAppState((s) => s.session);
  const summary = useMixSummary();
  useEffect(() => {
    selectMode('focus');
    prewarmMode('focus');
  }, []);

  const routine = routines.find((r) => r.id === timer.routineId);
  const big = timer.kind === 'countup' ? '00:00' : formatClock(routine ? routine.phases[0].seconds : timer.seconds);

  return (
    <div className="screen stack">
      <ScreenHeader title="집중 / 공부" />
      <div className="mode-hero"><StudyScene id="focus-hero" /></div>

      <div className="stack-s" style={{ marginTop: 4 }}>
        <p className="big-time">{big}</p>
        <p className="sound-line">{summary}</p>
        {binauralOn && (
          <p className="hz-line"><b>{beat} Hz</b> · {bandLabel(beat)} · {beatLabel(beat)}</p>
        )}
        <Waveform playing={playing} />
      </div>

      <FocusOptions />

      <div className="sticky-cta">
        {session?.mode === 'focus' ? (
          <ClayButton variant="primary" size="lg" block onClick={() => navigate('/focus/session')}>집중 화면으로 돌아가기</ClayButton>
        ) : (
          <ClayButton variant="primary" size="lg" block onClick={() => navigate('/focus/ready')}>▶ 집중 시작</ClayButton>
        )}
      </div>
    </div>
  );
}
