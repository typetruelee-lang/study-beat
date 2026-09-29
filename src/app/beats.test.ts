import { describe, expect, it } from 'vitest';
import { rightEarFrequency } from '../audio/ramp';
import { BEAT_PRESETS, bandOf, CARRIER_OPTIONS } from './beats';

describe('beat presets vs EEG bands (IFCN 2020)', () => {
  it.each([
    [0.5, 'delta'], [2, 'delta'], [3.9, 'delta'],
    [4, 'theta'], [6, 'theta'], [7.9, 'theta'],
    [8, 'alpha'], [10, 'alpha'], [12, 'alpha'], [13, 'alpha'],
    [14, 'beta'], [18, 'beta'], [30, 'beta'],
    [31, 'gamma'], [40, 'gamma'],
  ])('%s Hz is %s', (hz, band) => {
    expect(bandOf(hz)).toBe(band);
  });

  it('covers delta, theta, alpha, beta and gamma', () => {
    expect(new Set(BEAT_PRESETS.map((p) => bandOf(p.hz)))).toEqual(new Set(['delta', 'theta', 'alpha', 'beta', 'gamma']));
  });

  it('presets are ordered and unique', () => {
    const hz = BEAT_PRESETS.map((p) => p.hz);
    expect([...hz].sort((a, b) => a - b)).toEqual(hz);
    expect(new Set(hz).size).toBe(hz.length);
  });

  it('every preset stays inside binaural-beat hearing limits (both ears ≤ 1000 Hz)', () => {
    for (const c of CARRIER_OPTIONS) for (const p of BEAT_PRESETS) expect(rightEarFrequency(c, p.hz)).toBeLessThanOrEqual(1000);
  });

  it('beats above ~30 Hz carry a caution note', () => {
    for (const p of BEAT_PRESETS) if (p.hz > 30) expect(p.note).toBeTruthy();
  });
});
