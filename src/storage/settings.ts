import { DEFAULT_TRACKS } from '../sounds/catalog';
import type { UseCase } from '../sounds/types';
import { readJson, type KeyValueStore } from './KeyValueStore';

export type TimerKind = 'countdown' | 'countup' | 'goal';
export type EndSound = 'bell' | 'beep' | 'vibrate' | 'nature' | 'autoBreak';

export interface TrackSetting {
  id: string;
  volume: number;
}

export interface Settings {
  version: 1;
  lastMode: UseCase;
  /** Beat frequency (Hz) per mode — right ear = carrier + beat. */
  beatByMode: Record<UseCase, number>;
  binauralOnByMode: Record<UseCase, boolean>;
  carrierHz: number;
  busVolumes: { binaural: number; ambient: number; noise: number };
  masterVolume: number;
  tracksByMode: Record<UseCase, TrackSetting[]>;
  focusTimer: {
    kind: TimerKind;
    /** Focus length for countdown, or the target for "goal". */
    seconds: number;
    breakSeconds: number;
    /** Selected saved routine; null = single focus block. */
    routineId: string | null;
  };
  /** null = 무제한 */
  sleepMinutes: number | null;
  relaxMinutes: number;
  dailyGoalMinutes: number;
  awayDetection: boolean;
  keepScreenOn: boolean;
  endSound: EndSound;
  autoFrequency: boolean;
  headphoneTipDismissed: boolean;
  /** Stop decorative animations (battery / motion sensitivity). */
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  lastMode: 'focus',
  beatByMode: { focus: 10, sleep: 2, relax: 6 },
  binauralOnByMode: { focus: true, sleep: false, relax: false },
  carrierHz: 400,
  busVolumes: { binaural: 0.35, ambient: 0.8, noise: 0.6 },
  // WHO safe listening: keep device output at or below ~60% of maximum.
  masterVolume: 0.6,
  tracksByMode: DEFAULT_TRACKS,
  focusTimer: { kind: 'countdown', seconds: 25 * 60, breakSeconds: 5 * 60, routineId: null },
  sleepMinutes: 30,
  relaxMinutes: 10,
  dailyGoalMinutes: 120,
  awayDetection: true,
  keepScreenOn: true,
  endSound: 'bell',
  autoFrequency: false,
  headphoneTipDismissed: false,
  reduceMotion: false,
};

const KEY = 'focusclay.settings.v1';

export class SettingsRepository {
  constructor(private kv: KeyValueStore) {}

  async load(): Promise<Settings> {
    const saved = await readJson<Partial<Settings>>(this.kv, KEY);
    return mergeSettings(saved);
  }

  async save(settings: Settings): Promise<void> {
    await this.kv.set(KEY, JSON.stringify(settings));
  }
}

/** Shallow-merge nested groups so new fields get defaults after an app update. */
export function mergeSettings(saved: Partial<Settings> | null): Settings {
  if (!saved) return structuredClone(DEFAULT_SETTINGS);
  const d = DEFAULT_SETTINGS;
  return {
    ...d,
    ...saved,
    version: 1,
    beatByMode: { ...d.beatByMode, ...saved.beatByMode },
    binauralOnByMode: { ...d.binauralOnByMode, ...saved.binauralOnByMode },
    busVolumes: { ...d.busVolumes, ...saved.busVolumes },
    tracksByMode: { ...d.tracksByMode, ...saved.tracksByMode },
    focusTimer: { ...d.focusTimer, ...saved.focusTimer },
  };
}
