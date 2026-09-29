import { describe, expect, it } from 'vitest';
import type { StudySession } from './sessions';
import { daySummary, favourites, focusTotals, growthStage, weekBars } from './stats';

const H = 3600;
// Wednesday 2026-09-30 15:00 local
const NOW = new Date(2026, 8, 30, 15, 0, 0).getTime();

function session(p: Partial<StudySession> & { startedAt: number }): StudySession {
  return {
    id: Math.random().toString(),
    mode: 'focus',
    endedAt: p.startedAt,
    plannedSeconds: 1500,
    activeSeconds: p.focusedSeconds ?? 0,
    focusedSeconds: 0,
    pausedSeconds: 0,
    interruptionCount: 0,
    resumeCount: 0,
    completed: true,
    ...p,
  };
}

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();

const DATA: StudySession[] = [
  session({ startedAt: at(2026, 9, 30, 9), focusedSeconds: 25 * 60, ambientSound: 'rain_01', beatFrequency: 10 }),
  session({ startedAt: at(2026, 9, 30, 11), focusedSeconds: 50 * 60, interruptionCount: 2, resumeCount: 2, ambientSound: 'rain_01', beatFrequency: 10 }),
  session({ startedAt: at(2026, 9, 29), focusedSeconds: 2 * H, ambientSound: 'cafe_01', beatFrequency: 12 }), // Tue
  session({ startedAt: at(2026, 9, 28), focusedSeconds: 1 * H }), // Mon
  session({ startedAt: at(2026, 9, 27), focusedSeconds: 3 * H }), // Sun last week, still September
  session({ startedAt: at(2026, 8, 20), focusedSeconds: 5 * H }), // August
  session({ startedAt: at(2026, 9, 30, 1), mode: 'sleep', focusedSeconds: 0, activeSeconds: 6 * H }),
];

describe('stats', () => {
  it('totals only count focus-mode recorded time', () => {
    const t = focusTotals(DATA, NOW);
    expect(t.today).toBe(75 * 60);
    expect(t.week).toBe(75 * 60 + 3 * H);
    expect(t.month).toBe(75 * 60 + 6 * H);
    expect(t.all).toBe(75 * 60 + 11 * H);
  });

  it('day summary', () => {
    const d = daySummary(DATA, NOW);
    expect(d.sessions).toBe(2);
    expect(d.averageSeconds).toBe(Math.round((75 * 60) / 2));
    expect(d.interruptions).toBe(2);
  });

  it('week bars run Monday to Sunday', () => {
    const bars = weekBars(DATA, NOW);
    expect(bars.map((b) => b.label).join('')).toBe('월화수목금토일');
    expect(bars[0].seconds).toBe(H);
    expect(bars[1].seconds).toBe(2 * H);
    expect(bars[2].isToday).toBe(true);
    expect(bars[3].isFuture).toBe(true);
  });

  it('favourites weighted by focus time', () => {
    expect(favourites(DATA)).toEqual({ sound: 'cafe_01', beat: 12 });
  });

  it('growth stage follows the daily goal', () => {
    expect(growthStage(0, 120)).toBe(0);
    expect(growthStage(5 * 60, 120)).toBe(1);
    expect(growthStage(40 * 60, 120)).toBe(2);
    expect(growthStage(90 * 60, 120)).toBe(3);
    expect(growthStage(120 * 60, 120)).toBe(4);
  });
});
