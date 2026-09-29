import { getSound } from '../sounds/catalog';
import { formatClock, formatDuration } from '../lib/format';
import { currentPhase, phaseElapsedSeconds, remainingSeconds, type SessionState } from '../features/session/sessionMachine';
import { focusTotals } from '../storage/stats';
import { useAppState } from './store';

export function useTodayFocus() {
  const sessions = useAppState((s) => s.sessions);
  const goalMinutes = useAppState((s) => s.settings.dailyGoalMinutes);
  const live = useAppState((s) => (s.session?.mode === 'focus' ? Math.floor(s.session.focusedMs / 1000) : 0));
  const today = focusTotals(sessions, Date.now()).today + live;
  const goal = goalMinutes * 60;
  return { today, goal, remaining: Math.max(0, goal - today), progress: goal ? today / goal : 0, reached: today >= goal };
}

export interface SessionView {
  bigTime: string;
  status: string;
  sub?: string;
  isBreak: boolean;
}

export function describeSession(s: SessionState): SessionView {
  const phase = currentPhase(s);
  const isBreak = phase.kind === 'break';
  const left = remainingSeconds(s);
  const elapsed = phaseElapsedSeconds(s);
  const statusLabel =
    s.status === 'paused' ? '일시정지' : isBreak ? '휴식 중' : s.mode === 'focus' ? '집중 중' : s.mode === 'sleep' ? '수면 사운드 재생 중' : '휴식 중';

  if (s.timerKind === 'goal' && left !== null && !isBreak) {
    return { bigTime: formatClock(elapsed), status: statusLabel, sub: `목표까지 ${formatDuration(left + 59)} 남음`, isBreak };
  }
  if (left === null) {
    return { bigTime: formatClock(elapsed), status: statusLabel, sub: s.mode === 'sleep' ? '타이머 없음' : '카운트업', isBreak };
  }
  const sub = s.phases.length > 1 ? `${s.phaseIndex + 1} / ${s.phases.length} 단계` : undefined;
  return { bigTime: formatClock(left), status: statusLabel, sub, isBreak };
}

/** Main ambient sound of the current mix (for labels like "🌧 창가의 비"). */
export function useMainSound() {
  const tracks = useAppState((s) => s.player.tracks);
  const main = tracks.map((t) => getSound(t.id)).find((m) => m?.bus === 'ambient') ?? getSound(tracks[0]?.id ?? '');
  return main;
}

/** "🌧 창가의 비 + 집중 사운드" style summary — the user-facing name comes first, Hz second. */
export function useMixSummary() {
  const tracks = useAppState((s) => s.player.tracks);
  const binauralOn = useAppState((s) => s.player.binauralOn);
  const metas = tracks.map((t) => getSound(t.id)).filter((m) => m !== undefined);
  const main = metas.find((m) => m.bus === 'ambient');
  const noise = metas.find((m) => m.bus === 'noise');
  const extra = metas.filter((m) => m.bus === 'ambient').length - (main ? 1 : 0);
  const parts = [
    main ? `${main.emoji} ${main.name}${extra > 0 ? ` 외 ${extra}` : ''}` : null,
    noise ? noise.name : null,
    binauralOn ? '집중 사운드' : null,
  ].filter(Boolean);
  return parts.join(' + ') || '소리를 골라주세요';
}
