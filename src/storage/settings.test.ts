import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, type FavoriteMix } from './settings';

const fav = (tracks: { id: string; volume: number }[], binauralOn = false): FavoriteMix => ({
  id: 'f', name: '내 믹스', mode: 'focus', beat: 10, binauralOn, tracks, intensity: 0.3, createdAt: 0,
});

describe('mergeSettings with retired sounds', () => {
  it('drops removed sounds from saved mixes and falls back to the default when a mix empties', () => {
    const s = mergeSettings({
      tracksByMode: {
        focus: [{ id: 'cafe_01', volume: 0.5 }, { id: 'noise_pink', volume: 0.3 }],
        sleep: [{ id: 'fan_01', volume: 0.5 }],
        relax: [{ id: 'forest_01', volume: 0.4 }],
      },
    });
    expect(s.tracksByMode.focus).toEqual([{ id: 'noise_pink', volume: 0.3 }]);
    expect(s.tracksByMode.sleep).toEqual(DEFAULT_SETTINGS.tracksByMode.sleep);
    expect(s.tracksByMode.relax).toEqual([{ id: 'forest_01', volume: 0.4 }]);
  });

  it('cleans 내 믹스 the same way and removes mixes left with nothing to play', () => {
    const s = mergeSettings({
      favorites: [
        fav([{ id: 'library_01', volume: 0.5 }, { id: 'rain_01', volume: 0.5 }]),
        fav([{ id: 'lake_01', volume: 0.5 }]),
        fav([{ id: 'thunder_01', volume: 0.5 }], true),
      ],
    });
    expect(s.favorites.map((f) => f.tracks)).toEqual([[{ id: 'rain_01', volume: 0.5 }], []]);
  });
});
