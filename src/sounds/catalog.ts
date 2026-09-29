import type { SoundCategory, SoundMeta, UseCase } from './types';
import nature from './nature/index.json';
import cafe from './cafe/index.json';
import sleep from './sleep/index.json';
import noise from './noise/index.json';
import meditation from './meditation/index.json';

export const SOUNDS: readonly SoundMeta[] = [
  ...(nature as SoundMeta[]),
  ...(cafe as SoundMeta[]),
  ...(noise as SoundMeta[]),
  ...(sleep as SoundMeta[]),
  ...(meditation as SoundMeta[]),
];

const byId = new Map(SOUNDS.map((s) => [s.id, s]));

export function getSound(id: string): SoundMeta | undefined {
  return byId.get(id);
}

export function soundsByCategory(category: SoundCategory | 'all'): SoundMeta[] {
  return category === 'all' ? [...SOUNDS] : SOUNDS.filter((s) => s.category === category);
}

export function soundsFor(useCase: UseCase): SoundMeta[] {
  return SOUNDS.filter((s) => s.useCases.includes(useCase));
}

/** Short picks shown directly on each mode screen (most useful first). */
export const QUICK_PICKS: Record<UseCase, string[]> = {
  focus: ['rain_01', 'cafe_01', 'library_01', 'fire_01', 'waves_01', 'noise_pink'],
  sleep: ['soft_rain_01', 'sleep_waves_01', 'night_forest_01', 'wind_01', 'fan_01', 'noise_brown', 'noise_pink', 'lullaby_01'],
  relax: ['forest_01', 'mountain_wind_01', 'lake_01', 'birds_01', 'calm_pad_01'],
};

/** Default mix per mode (first run). */
export const DEFAULT_TRACKS: Record<UseCase, { id: string; volume: number }[]> = {
  focus: [{ id: 'rain_01', volume: 0.55 }],
  sleep: [{ id: 'soft_rain_01', volume: 0.5 }, { id: 'noise_brown', volume: 0.18 }],
  relax: [{ id: 'forest_01', volume: 0.55 }],
};
