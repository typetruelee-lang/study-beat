import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateSettings } from '../../app/actions';
import { useTodayFocus } from '../../app/hooks';
import { useAppState } from '../../app/store';
import { formatDuration } from '../../lib/format';
import { ClayButton, IconButton } from '../common/ClayButton';
import { clampGoal, GOAL_STEP, GoalSheet } from '../Settings/GoalSheet';
import { ProgressBar } from '../common/ProgressBar';
import { RelaxScene } from '../scenes/RelaxScene';
import { SleepScene } from '../scenes/SleepScene';
import { StudyScene } from '../scenes/StudyScene';
import './home.css';

export function Home() {
  const navigate = useNavigate();
  const { today, goal, remaining, progress, reached } = useTodayFocus();
  const timer = useAppState((s) => s.settings.focusTimer);
  const session = useAppState((s) => s.session);
  const goalMinutes = useAppState((s) => s.settings.dailyGoalMinutes);
  const [goalOpen, setGoalOpen] = useState(false);
  const nudgeGoal = (delta: number) => updateSettings({ dailyGoalMinutes: clampGoal(goalMinutes + delta) });
  const focusMin = Math.round(timer.seconds / 60);
  const ctaLabel = timer.kind === 'countup' ? '집중 시작하기' : `${focusMin}분 집중하기`;

  return (
    <div className="screen stack">
      <header className="home-header">
        <h1 className="home-title">FOCUS CLAY</h1>
        <p className="home-sub">좋은 소리로, 더 깊게 집중하세요.</p>
      </header>

      <section className="card goal-card" aria-label="오늘 목표">
        <div className="row-between">
          <span className="strong">오늘 목표</span>
          <button type="button" className="cbtn cbtn--ghost" style={{ minHeight: 40, padding: '0 8px' }} onClick={() => setGoalOpen(true)}>
            목표 바꾸기
          </button>
        </div>
        <div className="row-between">
          <div className="goal-card__nums">
            <span className="goal-card__now tabular">{formatDuration(today)}</span>
            <span className="goal-card__goal">/ {formatDuration(goal)}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <IconButton aria-label={`목표 ${GOAL_STEP}분 줄이기`} onClick={() => nudgeGoal(-GOAL_STEP)}>－</IconButton>
            <IconButton aria-label={`목표 ${GOAL_STEP}분 늘리기`} onClick={() => nudgeGoal(GOAL_STEP)}>＋</IconButton>
          </div>
        </div>
        <ProgressBar value={progress} label="오늘 목표 진행률" />
        <p className="small muted">{reached ? '오늘 목표를 채웠어요 🌳 더 하고 싶다면 이어서 집중해요.' : `목표까지 ${formatDuration(remaining)} 남았어요`}</p>
        {session?.mode === 'focus' ? (
          <ClayButton variant="primary" size="lg" block onClick={() => navigate('/focus/session')}>
            집중 화면으로 돌아가기
          </ClayButton>
        ) : (
          <ClayButton variant="primary" size="lg" block onClick={() => navigate('/focus/ready')}>
            ▶ {ctaLabel}
          </ClayButton>
        )}
      </section>

      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} />

      <h2 className="h2" style={{ marginTop: 8 }}>지금 무엇을 할까요?</h2>

      <button type="button" className="mode-card" onClick={() => navigate('/focus')}>
        <div className="mode-card__art"><StudyScene id="home-study" /></div>
        <div className="mode-card__body">
          <div>
            <p className="mode-card__kicker">오늘 공부할까?</p>
            <p className="mode-card__title">집중 / 공부</p>
            <p className="mode-card__desc">{focusMin}분 깊게 집중하기</p>
          </div>
          <span className="mode-card__go" aria-hidden="true">›</span>
        </div>
      </button>

      <button type="button" className="mode-card mode-card--sleep" onClick={() => navigate('/sleep')}>
        <div className="mode-card__art"><SleepScene id="home-sleep" /></div>
        <div className="mode-card__body">
          <div>
            <p className="mode-card__kicker">잘 준비할까?</p>
            <p className="mode-card__title">수면</p>
            <p className="mode-card__desc">편안한 밤을 준비하세요</p>
          </div>
          <span className="mode-card__go" aria-hidden="true">›</span>
        </div>
      </button>

      <button type="button" className="mode-card" onClick={() => navigate('/relax')}>
        <div className="mode-card__art"><RelaxScene id="home-relax" /></div>
        <div className="mode-card__body">
          <div>
            <p className="mode-card__kicker">잠깐 쉴까?</p>
            <p className="mode-card__title">휴식 / 명상</p>
            <p className="mode-card__desc">잠깐 멈추고 쉬어가기</p>
          </div>
          <span className="mode-card__go" aria-hidden="true">›</span>
        </div>
      </button>
    </div>
  );
}
