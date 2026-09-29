import { useNavigate } from 'react-router-dom';
import { startSession } from '../../app/actions';
import { bandLabel, beatLabel } from '../../app/beats';
import { useMixSummary, useTodayFocus } from '../../app/hooks';
import { useAppState } from '../../app/store';
import { formatDuration } from '../../lib/format';
import { ClayButton } from '../common/ClayButton';
import { ScreenHeader } from '../common/ScreenHeader';
import './focus.css';

/** Short confirmation before a focus session (spec 48). */
export function FocusReady() {
  const navigate = useNavigate();
  const timer = useAppState((s) => s.settings.focusTimer);
  const routine = useAppState((s) => s.routines.find((r) => r.id === s.settings.focusTimer.routineId));
  const settings = useAppState((s) => s.settings);
  const summary = useMixSummary();
  const { today, goal } = useTodayFocus();
  const beat = settings.beatByMode.focus;

  const planLabel = routine
    ? `루틴 “${routine.name}”`
    : timer.kind === 'countup'
      ? '시간 제한 없이 집중'
      : timer.kind === 'goal'
        ? `목표 ${formatDuration(timer.seconds)} 집중`
        : `${formatDuration(timer.seconds)} 집중`;

  const start = async () => {
    await startSession('focus');
    navigate('/focus/session', { replace: true });
  };

  return (
    <div className="screen screen--bare stack">
      <ScreenHeader title="집중 준비" />
      <div className="ready">
        <span style={{ fontSize: 48 }} aria-hidden="true">🎧</span>
        <p className="h1">{planLabel}</p>
        <p className="ready__line">{summary}</p>
        {settings.binauralOnByMode.focus && <p className="muted">{beat}Hz · {bandLabel(beat)} · {beatLabel(beat)}</p>}
        <div className="card card--flat" style={{ width: '100%' }}>
          <p className="small muted">오늘 목표</p>
          <p className="h2 tabular">{formatDuration(today)} / {formatDuration(goal)}</p>
        </div>
        <div className="notice" style={{ width: '100%', textAlign: 'left' }}>
          <span aria-hidden="true">📵</span>
          <span>
            집중하는 동안 다른 앱 사용을 줄여보세요.
            {settings.awayDetection && ' 앱 화면을 벗어나면 집중 기록이 잠시 멈추고, 돌아오면 이어서 할 수 있어요.'}
          </span>
        </div>
        {settings.binauralOnByMode.focus && (
          <div className="notice" style={{ width: '100%', textAlign: 'left' }}>
            <span aria-hidden="true">🎧</span>
            <span>집중 사운드는 이어폰이나 헤드폰으로 들어야 좌우 차이가 전달돼요. 기기 볼륨은 최대의 60% 이하로 맞춰 주세요.</span>
          </div>
        )}
      </div>
      <ClayButton variant="primary" size="lg" block onClick={start}>집중 시작</ClayButton>
    </div>
  );
}
