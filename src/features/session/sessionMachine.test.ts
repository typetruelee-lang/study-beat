import { describe, expect, it } from 'vitest';
import { endSession, pause, remainingSeconds, resume, startSession, tick, toRecord, type SessionPlan } from './sessionMachine';

const MIN = 60_000;
const focusPlan = (minutes: number): SessionPlan => ({
  mode: 'focus',
  timerKind: 'countdown',
  phases: [{ kind: 'focus', seconds: minutes * 60 }],
});

describe('sessionMachine', () => {
  it('spec example: 20m focus + 3m pause + 5m focus = 25m recorded', () => {
    let s = startSession('a', focusPlan(25), 0);
    s = pause(s, 20 * MIN, 'user');
    s = resume(s, 23 * MIN);
    // 5 more minutes → reaches exactly 25 minutes of focus and completes.
    const r = tick(s, 28 * MIN);
    expect(r.state.status).toBe('completed');
    const rec = toRecord(r.state);
    expect(rec.focusedSeconds).toBe(25 * 60);
    expect(rec.pausedSeconds).toBe(3 * 60);
    expect(rec.completed).toBe(true);
  });

  it('time away from the app is paused, counted as an interruption and not recorded', () => {
    let s = startSession('a', focusPlan(50), 0);
    s = pause(s, 10 * MIN, 'away');
    expect(s.interruptionCount).toBe(1);
    s = tick(s, 15 * MIN).state; // away 5 minutes
    s = resume(s, 15 * MIN);
    expect(s.resumeCount).toBe(1);
    s = endSession(s, 20 * MIN);
    const rec = toRecord(s);
    expect(rec.focusedSeconds).toBe(15 * 60);
    expect(rec.pausedSeconds).toBe(5 * 60);
    expect(rec.completed).toBe(false);
  });

  it('a late tick never records more than the planned focus time', () => {
    const s = startSession('a', focusPlan(25), 0);
    const r = tick(s, 40 * MIN);
    expect(toRecord(r.state).focusedSeconds).toBe(25 * 60);
    expect(r.state.endedAt).toBe(25 * MIN);
  });

  it('routine phases advance and break time is not focus time', () => {
    const s = startSession('a', {
      mode: 'focus',
      timerKind: 'countdown',
      phases: [
        { kind: 'focus', seconds: 50 * 60 },
        { kind: 'break', seconds: 10 * 60 },
        { kind: 'focus', seconds: 50 * 60 },
      ],
    }, 0);
    const r1 = tick(s, 55 * MIN);
    expect(r1.state.phaseIndex).toBe(1);
    expect(r1.events).toContainEqual(expect.objectContaining({ type: 'phaseChanged', phaseIndex: 1 }));
    expect(remainingSeconds(r1.state)).toBe(5 * 60);
    const r2 = tick(r1.state, 200 * MIN);
    expect(r2.state.status).toBe('completed');
    expect(toRecord(r2.state).focusedSeconds).toBe(100 * 60);
  });

  it('count-up runs until ended', () => {
    let s = startSession('a', { mode: 'focus', timerKind: 'countup', phases: [{ kind: 'focus', seconds: null }] }, 0);
    s = tick(s, 37 * MIN).state;
    expect(s.status).toBe('running');
    expect(remainingSeconds(s)).toBeNull();
    s = endSession(s, 37 * MIN);
    expect(toRecord(s).focusedSeconds).toBe(37 * 60);
    expect(toRecord(s).plannedSeconds).toBeNull();
  });

  it('sleep and relax sessions never add focus time', () => {
    const s = startSession('a', { mode: 'sleep', timerKind: 'countdown', phases: [{ kind: 'focus', seconds: 30 * 60 }] }, 0);
    const rec = toRecord(tick(s, 30 * MIN).state);
    expect(rec.focusedSeconds).toBe(0);
    expect(rec.activeSeconds).toBe(30 * 60);
  });
});
