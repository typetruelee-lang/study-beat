export type SoundCategory = 'nature' | 'cafe' | 'sleep' | 'noise' | 'meditation';
export type SoundBus = 'ambient' | 'noise';
export type UseCase = 'focus' | 'sleep' | 'relax';

/** Procedural recipes implemented in src/audio/ambient/synths.ts */
export type SynthId =
  | 'white' | 'pink' | 'brown'
  | 'rain' | 'softRain'
  | 'waves' | 'slowWaves'
  | 'wind' | 'mountainWind'
  | 'forest' | 'birds' | 'nightForest'
  | 'stream' | 'fire'
  | 'train' | 'cityNight'
  | 'deepRumble'
  | 'calmPad' | 'lullaby';

/** Visual used by <SoundThumb>. */
export type ThumbId =
  | 'rain' | 'waves' | 'forest' | 'wind' | 'birds' | 'stream' | 'fire'
  | 'cafe' | 'library' | 'train' | 'city' | 'noise' | 'moon' | 'fan' | 'pad' | 'lake';

export interface SoundLicense {
  /** e.g. "Original (procedural)", "CC0 1.0", "Pixabay Content License" */
  name: string;
  /** May this sound be used in a commercial service? Must be checked before release. */
  commercialUse: boolean;
  attributionRequired: boolean;
  attribution?: string;
  url?: string;
}

export interface SoundMeta {
  id: string;
  name: string;
  emoji: string;
  category: SoundCategory;
  /** Which bus in the mixer this sound plays on. Noise colours share one bus. */
  bus: SoundBus;
  /** Modes where this sound is recommended. */
  useCases: UseCase[];
  loop: boolean;
  /** Default track volume 0…1 */
  volume: number;
  /**
   * "synth": generated in real time by the Web Audio engine.
   * "file": decoded from `file` (relative to the app root, e.g. "sounds/nature/rain_01.mp3").
   * A file sound may also list `synth` as a fallback while the file is missing.
   */
  source: 'synth' | 'file';
  synth?: SynthId;
  file?: string;
  thumb: ThumbId;
  license: SoundLicense;
}

export const PROCEDURAL_LICENSE: SoundLicense = {
  name: 'Original (procedural)',
  commercialUse: true,
  attributionRequired: false,
};

export const CATEGORY_LABELS: Record<SoundCategory, string> = {
  nature: '자연',
  cafe: '공간',
  sleep: '수면',
  noise: 'Noise',
  meditation: '명상',
};
