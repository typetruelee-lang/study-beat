import { useAppState } from '../../app/store';
import { useTodayFocus } from '../../app/hooks';
import { getSound } from '../../sounds/catalog';
import { formatDuration } from '../../lib/format';
import { daySummary, favourites, focusTotals, growthStage, otherTotals, weekBars } from '../../storage/stats';
import { ProgressBar } from '../common/ProgressBar';
import { GROWTH_LABELS, GrowthTree } from '../scenes/GrowthTree';
import { WeekChart } from './WeekChart';
import './stats.css';

export function Statistics() {
  const sessions = useAppState((s) => s.sessions);
  const goalMinutes = useAppState((s) => s.settings.dailyGoalMinutes);
  const { today, goal, remaining, progress, reached } = useTodayFocus();
  const now = Date.now();
  const totals = focusTotals(sessions, now);
  const day = daySummary(sessions, now);
  const fav = favourites(sessions);
  const other = otherTotals(sessions);
  const stage = growthStage(today, goalMinutes);
  const favSound = fav.sound ? getSound(fav.sound) : null;

  return (
    <div className="screen stack">
      <header style={{ paddingTop: 8 }} className="stack-s">
        <h1 className="h1">기록</h1>
        <p className="small muted">FOCUS CLAY 집중 세션에서 기록된 시간이에요. 일시정지하거나 앱을 벗어난 시간은 빠져요.</p>
      </header>

      <section className="card stack-s" aria-label="오늘">
        <div className="today-row">
          <GrowthTree stage={stage} id="stats-tree" size={112} />
          <div className="stack-s" style={{ gap: 2 }}>
            <p className="small muted">오늘 기록된 집중시간</p>
            <p className="h1 tabular">{formatDuration(today)}</p>
            <p className="small muted">🌱 {GROWTH_LABELS[stage]}</p>
          </div>
        </div>
        <ProgressBar value={progress} label="오늘 목표 진행률" />
        <div className="row-between small">
          <span className="muted">목표 {formatDuration(goal)}</span>
          <span className="strong">{reached ? '목표 달성!' : `${formatDuration(remaining)} 남음`} · {Math.min(999, Math.round(progress * 100))}%</span>
        </div>
        <div className="kv small"><span className="muted">집중 세션</span><span className="strong">{day.sessions}회</span></div>
        <div className="kv small"><span className="muted">평균 세션</span><span className="strong">{formatDuration(day.averageSeconds)}</span></div>
        {(day.interruptions > 0 || day.resumes > 0) && (
          <div className="kv small"><span className="muted">집중 이탈 / 다시 집중</span><span className="strong">{day.interruptions}회 / {day.resumes}회</span></div>
        )}
      </section>

      <section className="card stack-s" aria-label="이번 주">
        <div className="row-between">
          <h2 className="h2">이번 주</h2>
          <span className="strong tabular">{formatDuration(totals.week)}</span>
        </div>
        <WeekChart bars={weekBars(sessions, now)} />
      </section>

      <section className="totals" aria-label="누적 집중시간">
        {[
          ['오늘', totals.today],
          ['이번 주', totals.week],
          ['이번 달', totals.month],
          ['전체', totals.all],
        ].map(([label, v]) => (
          <div key={label} className="total-tile">
            <span className="small muted">{label}</span>
            <span className="total-tile__value">{formatDuration(v as number)}</span>
          </div>
        ))}
      </section>

      <section className="card stack-s" aria-label="자주 쓴 사운드">
        <h2 className="h2">자주 함께한 소리</h2>
        <div className="kv"><span className="muted">사운드</span><span className="strong">{favSound ? `${favSound.emoji} ${favSound.name}` : '아직 없어요'}</span></div>
        <div className="kv"><span className="muted">집중 사운드</span><span className="strong">{fav.beat ? `${fav.beat}Hz` : '아직 없어요'}</span></div>
        <div className="kv"><span className="muted">수면 세션</span><span className="strong">{other.sleepSessions}회</span></div>
        <div className="kv"><span className="muted">휴식·명상 시간</span><span className="strong">{formatDuration(other.relaxSeconds)}</span></div>
        <p className="tiny faint">수면·휴식 시간은 집중시간에 포함되지 않아요.</p>
      </section>
    </div>
  );
}
