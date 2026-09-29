import { useSyncExternalStore } from 'react';
import type { UseCase } from '../sounds/types';
import type { SessionState } from '../features/session/sessionMachine';
import type { Routine } from '../storage/routines';
import type { StudySession } from '../storage/sessions';
import { DEFAULT_SETTINGS, type Settings, type TrackSetting } from '../storage/settings';

export interface PlayerState {
  /** Which mode's mix is loaded. */
  mode: UseCase;
  playing: boolean;
  tracks: TrackSetting[];
  binauralOn: boolean;
  beat: number;
}

export interface AppState {
  ready: boolean;
  settings: Settings;
  sessions: StudySession[];
  routines: Routine[];
  player: PlayerState;
  session: SessionState | null;
  /** Id of the most recently saved focus session (for the result screen). */
  lastResult: StudySession | null;
  /** Black screen (screen "off" while the app keeps playing and recording). */
  curtain: boolean;
}

export function playerFor(settings: Settings, mode: UseCase, playing = false): PlayerState {
  return {
    mode,
    playing,
    tracks: settings.tracksByMode[mode].map((t) => ({ ...t })),
    binauralOn: settings.binauralOnByMode[mode],
    beat: settings.beatByMode[mode],
  };
}

let state: AppState = {
  ready: false,
  settings: DEFAULT_SETTINGS,
  sessions: [],
  routines: [],
  player: playerFor(DEFAULT_SETTINGS, 'focus'),
  session: null,
  lastResult: null,
  curtain: false,
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const patch = typeof update === 'function' ? update(state) : update;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/** Test helper. */
export function resetState(next: AppState) {
  state = next;
  listeners.forEach((l) => l());
}
