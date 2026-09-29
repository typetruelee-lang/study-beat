import { addDays, startOfDay, startOfMonth, startOfWeek, WEEKDAY_LABELS } from '../lib/date';
import type { StudySession } from './sessions';

/** Only Focus-mode sessions contribute to recorded focus (study) time. */
export const isFocus = (s: StudySession) => s.mode === 'focus';

function sumFocus(sessions: StudySession[], from: number, to = Infinity): number {
  let total = 0;
  for (const s of sessions) {
    if (isFocus(s) && s.startedAt >= from && s.startedAt < to) total += s.focusedSeconds;
  }
  return total;
}

export interface FocusTotals {
  today: number;
  week: number;
  month: number;
  all: number;
}

export function focusTotals(sessions: StudySession[], now: number): FocusTotals {
  return {
    today: sumFocus(sessions, startOfDay(now).getTime()),
    week: sumFocus(sessions, startOfWeek(now).getTime()),
    month: sumFocus(sessions, startOfMonth(now).getTime()),
    all: sumFocus(sessions, -Infinity),
  };
}

export interface DaySummary {
  sessions: number;
  focusedSeconds: number;
  averageSeconds: number;
  interruptions: number;
  resumes: number;
}

/** Sessions shorter than a minute are kept in totals but not counted as a "session". */
const MIN_SESSION_SECONDS = 60;

export function daySummary(sessions: StudySession[], now: number): DaySummary {
  const from = startOfDay(now).getTime();
  const to = addDays(startOfDay(now), 1).getTime();
  const today = sessions.filter((s) => isFocus(s) && s.startedAt >= from && s.startedAt < to);
  const counted = today.filter((s) => s.focusedSeconds >= MIN_SESSION_SECONDS);
  const focusedSeconds = today.reduce((a, s) => a + s.focusedSeconds, 0);
  return {
    sessions: counted.length,
    focusedSeconds,
    averageSeconds: counted.length ? Math.round(counted.reduce((a, s) => a + s.focusedSeconds, 0) / counted.length) : 0,
    interruptions: today.reduce((a, s) => a + s.interruptionCount, 0),
    resumes: today.reduce((a, s) => a + s.resumeCount, 0),
  };
}

export interface WeekBar {
  label: (typeof WEEKDAY_LABELS)[number];
  date: Date;
  seconds: number;
  isToday: boolean;
  isFuture: boolean;
}

/** Monday → Sunday of the current week. */
export function weekBars(sessions: StudySession[], now: number): WeekBar[] {
  const monday = startOfWeek(now);
  const todayStart = startOfDay(now).getTime();
  return WEEKDAY_LABELS.map((label, i) => {
    const date = addDays(monday, i);
    const from = date.getTime();
    const to = addDays(date, 1).getTime();
    return {
      label,
      date,
      seconds: sumFocus(sessions, from, to),
      isToday: from === todayStart,
      isFuture: from > todayStart,
    };
  });
}

/** Weighted by focus time so a long session matters more than a quick try. */
export function favourites(sessions: StudySession[]): { sound: string | null; beat: number | null } {
  const focus = sessions.filter(isFocus);
  const soundTime = new Map<string, number>();
  const beatTime = new Map<number, number>();
  for (const s of focus) {
    if (s.ambientSound) soundTime.set(s.ambientSound, (soundTime.get(s.ambientSound) ?? 0) + s.focusedSeconds);
    if (s.beatFrequency) beatTime.set(s.beatFrequency, (beatTime.get(s.beatFrequency) ?? 0) + s.focusedSeconds);
  }
  const top = <K,>(m: Map<K, number>): K | null =>
    m.size === 0 ? null : [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { sound: top(soundTime), beat: top(beatTime) };
}

export function otherTotals(sessions: StudySession[]): { sleepSessions: number; relaxSeconds: number } {
  return {
    sleepSessions: sessions.filter((s) => s.mode === 'sleep' && s.activeSeconds >= MIN_SESSION_SECONDS).length,
    relaxSeconds: sessions.filter((s) => s.mode === 'relax').reduce((a, s) => a + s.activeSeconds, 0),
  };
}

/**
 * Growth stage for the clay tree, based on today's recorded focus vs the daily goal.
 * 0 seed · 1 sprout · 2 sapling · 3 tree · 4 big tree (goal reached)
 */
export function growthStage(todaySeconds: number, goalMinutes: number): 0 | 1 | 2 | 3 | 4 {
  const goal = Math.max(1, goalMinutes * 60);
  const r = todaySeconds / goal;
  if (r >= 1) return 4;
  if (r >= 0.6) return 3;
  if (r >= 0.3) return 2;
  if (todaySeconds >= 60) return 1;
  return 0;
}
