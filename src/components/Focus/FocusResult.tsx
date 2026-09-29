import { useNavigate } from 'react-router-dom';
import { dismissResult, startSession } from '../../app/actions';
import { useTodayFocus } from '../../app/hooks';
import { useAppState } from '../../app/store';
import { formatDuration } from '../../lib/format';
import { growthStage } from '../../storage/stats';
import { ClayButton } from '../common/ClayButton';
import { ScreenHeader } from '../common/ScreenHeader';
import { GrowthTree } from '../scenes/GrowthTree';
import './focus.css';

/** Session result (spec 50). Neutral wording — never framed as failure or judgement. */
export function FocusResult() {
  const navigate = useNavigate();
  const result = useAppState((s) => s.lastResult);
  const goalMinutes = useAppState((s) => s.settings.dailyGoalMinutes);
  const breakSeconds = useAppState((s) => s.settings.focusTimer.breakSeconds);
  const { today, remaining, reached } = useTodayFocus();

  if (!result) {
    return (
      <div className="screen screen--bare stack center">
        <ScreenHeader title="집중 결과" onBack={() => navigate('/', { replace: true })} />
        <p className="h2">기록할 집중시간이 없어요</p>
        <p className="muted">1분 이상 집중하면 기록돼요.</p>
        <ClayButton variant="primary" block onClick={() => navigate('/', { replace: true })}>홈으로</ClayButton>
      </div>
    );
  }

  const goHome = () => {
    dismissResult();
    navigate('/', { replace: true });
  };
  const before = growthStage(today - result.focusedSeconds, goalMinutes);
  const after = growthStage(today, goalMinutes);

  return (
    <div className="screen screen--bare stack center">
      <ScreenHeader title="집중 결과" onBack={goHome} onHome={goHome} />
      <div className="stack-s">
        <span className="result-emoji" aria-hidden="true">{result.completed ? '🎉' : '👏'}</span>
        <p className="h1">{result.completed ? '집중 완료!' : '수고했어요'}</p>
      </div>
      <p className="big-time">{formatDuration(result.focusedSeconds)}</p>
      <div className="card stack-s">
        <p className="muted">오늘 기록된 집중시간</p>
        <p className="h1 tabular">{formatDuration(today)}</p>
        <p className="muted">{reached ? '오늘 목표를 채웠어요!' : `목표까지 ${formatDuration(remaining)} 남음`}</p>
      </div>
      <div className="stack-s" style={{ alignItems: 'center' }}>
        <GrowthTree stage={after} id="result-tree" />
        <p className="strong">{after > before ? '🌱 클레이 나무가 조금 자랐어요' : '🌱 오늘의 클레이 나무'}</p>
      </div>
      {(result.interruptionCount > 0 || result.pausedSeconds > 0) && (
        <p className="small muted">
          집중 이탈 {result.interruptionCount}회 · 다시 집중 {result.resumeCount}회
          {result.pausedSeconds >= 60 && ` · 일시정지 ${formatDuration(result.pausedSeconds)}`}
        </p>
      )}
      <div className="session-controls">
        <ClayButton
          size="lg"
          onClick={async () => {
            dismissResult();
            await startSession('relax', { seconds: breakSeconds });
            navigate('/relax', { replace: true });
          }}
        >
          {Math.round(breakSeconds / 60)}분 휴식
        </ClayButton>
        <ClayButton
          variant="primary"
          size="lg"
          onClick={() => {
            dismissResult();
            navigate('/focus/ready', { replace: true });
          }}
        >
          다시 집중
        </ClayButton>
      </div>
      <ClayButton variant="ghost" onClick={goHome}>홈으로 가기</ClayButton>
    </div>
  );
}
