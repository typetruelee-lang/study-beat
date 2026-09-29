import type { UseCase } from '../sounds/types';
import { readJson, type KeyValueStore } from './KeyValueStore';

/**
 * One finished (or ended early) session.
 *
 * `focusedSeconds` is the time recorded while a Focus session was actively running
 * (paused time and time away from the app are excluded). It is what FOCUS CLAY shows as
 * "기록된 집중시간" — a record of the session, not proof of studying.
 * (Spec name: actualStudySeconds.)
 */
export interface StudySession {
  id: string;
  mode: UseCase;
  startedAt: number;
  endedAt: number;
  plannedSeconds: number | null;
  /** Running time in any mode (sleep/relax use this). */
  activeSeconds: number;
  /** Focus mode only; 0 for sleep / relax and for break phases. */
  focusedSeconds: number;
  pausedSeconds: number;
  interruptionCount: number;
  resumeCount: number;
  completed: boolean;
  beatFrequency?: number;
  ambientSound?: string;
}

export interface SessionRepository {
  list(): Promise<StudySession[]>;
  add(session: StudySession): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'focusclay.sessions.v1';

export class LocalSessionRepository implements SessionRepository {
  constructor(private kv: KeyValueStore) {}

  async list(): Promise<StudySession[]> {
    return (await readJson<StudySession[]>(this.kv, KEY)) ?? [];
  }

  async add(session: StudySession): Promise<void> {
    const all = await this.list();
    all.push(session);
    await this.kv.set(KEY, JSON.stringify(all));
  }

  async clear(): Promise<void> {
    await this.kv.remove(KEY);
  }
}
