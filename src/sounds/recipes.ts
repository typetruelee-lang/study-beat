import type { UseCase } from './types';

/**
 * Curated one-tap soundscapes: a background sound paired with a beat preset (Anima-style
 * "beat + rain / ocean / forest"). Pure tones alone tire the ear; a bed makes them easy to keep on.
 */
export interface Recipe {
  id: string;
  mode: UseCase;
  name: string;
  desc: string;
  /** null = no beat. */
  beat: number | null;
  tracks: { id: string; volume: number }[];
  /** Focus-sound (beat) intensity 0…1 → binaural bus level. */
  intensity: number;
  /** Two colours for the cover art (aura gradient / clay tint). */
  colors: [string, string];
}

export const RECIPES: readonly Recipe[] = [
  { id: 'focus-rain', mode: 'focus', name: '빗속 집중', desc: '보슬비 + 10Hz', beat: 10, tracks: [{ id: 'rain_01', volume: 0.55 }], intensity: 0.35, colors: ['#5b8def', '#23395d'] },
  { id: 'focus-waves', mode: 'focus', name: '파도 몰입', desc: '파도 + 핑크 노이즈 + 12Hz', beat: 12, tracks: [{ id: 'waves_01', volume: 0.5 }, { id: 'noise_pink', volume: 0.25 }], intensity: 0.3, colors: ['#5fb3c9', '#1d3b4a'] },
  { id: 'focus-deep', mode: 'focus', name: '밤 도시 딥워크', desc: '밤의 도시 + 브라운 노이즈 + 14Hz', beat: 14, tracks: [{ id: 'city_night_01', volume: 0.5 }, { id: 'noise_brown', volume: 0.3 }], intensity: 0.3, colors: ['#7a86c9', '#1f2340'] },
  { id: 'focus-fire', mode: 'focus', name: '장작불 공부', desc: '장작불 + 10Hz', beat: 10, tracks: [{ id: 'fire_01', volume: 0.55 }], intensity: 0.35, colors: ['#f08a4b', '#4a1f1a'] },
  { id: 'focus-forest', mode: 'focus', name: '새벽 숲 워밍업', desc: '숲 + 새소리 + 8Hz', beat: 8, tracks: [{ id: 'forest_01', volume: 0.55 }, { id: 'birds_01', volume: 0.35 }], intensity: 0.3, colors: ['#5fb38a', '#1d3b34'] },
  { id: 'focus-noise', mode: 'focus', name: '노이즈 집중', desc: '브라운 노이즈만 · 비트 없음', beat: null, tracks: [{ id: 'noise_brown', volume: 0.5 }], intensity: 0.35, colors: ['#9a8f86', '#2b2a33'] },
  { id: 'sleep-rain', mode: 'sleep', name: '잔잔한 밤비', desc: '잔잔한 비 + 브라운 노이즈 + 2Hz', beat: 2, tracks: [{ id: 'soft_rain_01', volume: 0.5 }, { id: 'noise_brown', volume: 0.18 }], intensity: 0.25, colors: ['#5368c9', '#141a3d'] },
  { id: 'sleep-ocean', mode: 'sleep', name: '밤바다', desc: '밤바다 파도 + 2Hz', beat: 2, tracks: [{ id: 'sleep_waves_01', volume: 0.55 }], intensity: 0.25, colors: ['#3f86b8', '#0e1f3a'] },
  { id: 'sleep-forest', mode: 'sleep', name: '밤의 숲', desc: '밤의 숲 + 4Hz', beat: 4, tracks: [{ id: 'night_forest_01', volume: 0.55 }], intensity: 0.25, colors: ['#4f7a6a', '#0f1d22'] },
  { id: 'relax-forest', mode: 'relax', name: '숲 명상', desc: '숲 + 6Hz', beat: 6, tracks: [{ id: 'forest_01', volume: 0.55 }], intensity: 0.3, colors: ['#7cc49a', '#22413a'] },
  { id: 'relax-wind', mode: 'relax', name: '산바람 호흡', desc: '산바람 + 잔잔한 앰비언트 + 6Hz', beat: 6, tracks: [{ id: 'mountain_wind_01', volume: 0.5 }, { id: 'calm_pad_01', volume: 0.35 }], intensity: 0.3, colors: ['#e7a07a', '#5b3e64'] },
];

export const recipesFor = (mode: UseCase) => RECIPES.filter((r) => r.mode === mode);
