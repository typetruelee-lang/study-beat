/**
 * Pure session/timer state machine. No timers, no DOM — the caller passes `now` (ms).
 *
 *   running ⇄ paused → completed | ended
 *
 * Only time spent `running` inside a `focus` phase of a Focus-mode session is added to
 * `focusedMs`. Paused time (by the user, or automatically when the app goes to the
 * background) is tracked separately in `pausedMs` and never counts as focus time.
 */
import type { UseCase } from '../../sounds/types';
import type { StudySession } from '../../storage/sessions';
import type { RoutinePhase } from '../../storage/routines';
import type { TimerKind } from '../../storage/settings';

export type SessionStatus = 'running' | 'paused' | 'completed' | 'ended';
export type PauseReason = 'user' | 'away';

export interface PlanPhase {
  kind: RoutinePhase['kind'];
  /** null = open-ended (count-up, or unlimited sleep). */
  seconds: number | null;
}

export interface SessionPlan {
  mode: UseCase;
  timerKind: TimerKind;
  phases: PlanPhase[];
  beatFrequency?: number;
  ambientSound?: string;
}

export interface SessionState {
  id: string;
  mode: UseCase;
  timerKind: TimerKind;
  phases: PlanPhase[];
  phaseIndex: number;
  phaseElapsedMs: number;
  activeMs: number;
  focusedMs: number;
  pausedMs: number;
  interruptionCount: number;
  resumeCount: number;
  status: SessionStatus;
  pauseReason: PauseReason | null;
  startedAt: number;
  lastTickAt: number;
  endedAt: number | null;
  beatFrequency?: number;
  ambientSound?: string;
}

export type SessionEvent =
  | { type: 'phaseChanged'; phaseIndex: number; phase: PlanPhase }
  | { type: 'completed' };

export function startSession(id: string, plan: SessionPlan, now: number): SessionState {
  if (plan.phases.length === 0) throw new Error('Session needs at least one phase');
  return {
    id,
    mode: plan.mode,
    timerKind: plan.timerKind,
    phases: plan.phases,
    phaseIndex: 0,
    phaseElapsedMs: 0,
    activeMs: 0,
    focusedMs: 0,
    pausedMs: 0,
    interruptionCount: 0,
    resumeCount: 0,
    status: 'running',
    pauseReason: null,
    startedAt: now,
    lastTickAt: now,
    endedAt: null,
    beatFrequency: plan.beatFrequency,
    ambientSound: plan.ambientSound,
  };
}

function countsAsFocus(s: SessionState, phase: PlanPhase): boolean {
  return s.mode === 'focus' && phase.kind === 'focus';
}

/** Advance the clock to `now`. Handles large gaps (throttled timers) across phase boundaries. */
export function tick(state: SessionState, now: number): { state: SessionState; events: SessionEvent[] } {
  const events: SessionEvent[] = [];
  if (state.status === 'completed' || state.status === 'ended') return { state, events };

  const s: SessionState = { ...state };
  let delta = Math.max(0, now - s.lastTickAt);
  s.lastTickAt = now;

  if (s.status === 'paused') {
    s.pausedMs += delta;
    return { state: s, events };
  }

  while (delta > 0) {
    const phase = s.phases[s.phaseIndex];
    const limitMs = phase.seconds === null ? Infinity : phase.seconds * 1000;
    const step = Math.min(delta, limitMs - s.phaseElapsedMs);
    s.phaseElapsedMs += step;
    s.activeMs += step;
    if (countsAsFocus(s, phase)) s.focusedMs += step;
    delta -= step;

    if (s.phaseElapsedMs >= limitMs) {
      if (s.phaseIndex < s.phases.length - 1) {
        s.phaseIndex += 1;
        s.phaseElapsedMs = 0;
        events.push({ type: 'phaseChanged', phaseIndex: s.phaseIndex, phase: s.phases[s.phaseIndex] });
      } else {
        s.status = 'completed';
        // End time is the exact boundary, not the (possibly late) tick time.
        s.endedAt = now - delta;
        events.push({ type: 'completed' });
        break;
      }
    }
  }
  return { state: s, events };
}

export function pause(state: SessionState, now: number, reason: PauseReason): SessionState {
  const { state: s } = tick(state, now);
  if (s.status !== 'running') return s;
  return {
    ...s,
    status: 'paused',
    pauseReason: reason,
    interruptionCount: reason === 'away' ? s.interruptionCount + 1 : s.interruptionCount,
  };
}

export function resume(state: SessionState, now: number): SessionState {
  const { state: s } = tick(state, now);
  if (s.status !== 'paused') return s;
  return {
    ...s,
    status: 'running',
    resumeCount: s.pauseReason === 'away' ? s.resumeCount + 1 : s.resumeCount,
    pauseReason: null,
  };
}

/** Stop early (user pressed 종료). */
export function endSession(state: SessionState, now: number): SessionState {
  const { state: s } = tick(state, now);
  if (s.status === 'completed' || s.status === 'ended') return s;
  return { ...s, status: 'ended', endedAt: now };
}

export function currentPhase(s: SessionState): PlanPhase {
  return s.phases[s.phaseIndex];
}

/** Seconds left in the current phase, or null when open-ended. */
export function remainingSeconds(s: SessionState): number | null {
  const p = currentPhase(s);
  if (p.seconds === null) return null;
  return Math.max(0, Math.ceil((p.seconds * 1000 - s.phaseElapsedMs) / 1000));
}

export function phaseElapsedSeconds(s: SessionState): number {
  return Math.floor(s.phaseElapsedMs / 1000);
}

export function plannedSeconds(s: SessionState): number | null {
  let total = 0;
  for (const p of s.phases) {
    if (p.seconds === null) return null;
    total += p.seconds;
  }
  return total;
}

export function toRecord(s: SessionState): StudySession {
  return {
    id: s.id,
    mode: s.mode,
    startedAt: s.startedAt,
    endedAt: s.endedAt ?? s.lastTickAt,
    plannedSeconds: plannedSeconds(s),
    activeSeconds: Math.round(s.activeMs / 1000),
    focusedSeconds: Math.round(s.focusedMs / 1000),
    pausedSeconds: Math.round(s.pausedMs / 1000),
    interruptionCount: s.interruptionCount,
    resumeCount: s.resumeCount,
    completed: s.status === 'completed',
    beatFrequency: s.beatFrequency,
    ambientSound: s.ambientSound,
  };
}
