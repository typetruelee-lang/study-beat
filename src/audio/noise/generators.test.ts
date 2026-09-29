import { describe, expect, it } from 'vitest';
import { brightness, generateNoise, makeLoopable } from './generators';

describe('noise generators', () => {
  const N = 48000;
  const white = generateNoise('white', N, 3);
  const pink = generateNoise('pink', N, 3);
  const brown = generateNoise('brown', N, 3);

  it('white > pink > brown in brightness (spectral slope)', () => {
    expect(brightness(white)).toBeGreaterThan(1.8); // ≈2 for white noise
    expect(brightness(pink)).toBeLessThan(brightness(white) * 0.6);
    expect(brightness(brown)).toBeLessThan(brightness(pink) * 0.2);
  });

  it('is normalised and has no DC offset', () => {
    for (const d of [white, pink, brown]) {
      let s = 0, m = 0;
      for (const v of d) { s += v * v; m += v; }
      expect(Math.sqrt(s / d.length)).toBeCloseTo(0.2, 2);
      expect(Math.abs(m / d.length)).toBeLessThan(1e-3);
    }
  });

  it('loop seam is continuous for brown noise', () => {
    const loop = makeLoopable(brown, 2400);
    const seam = Math.abs(loop[0] - loop[loop.length - 1]);
    let typical = 0;
    for (let i = 1; i < loop.length; i++) typical = Math.max(typical, Math.abs(loop[i] - loop[i - 1]));
    expect(seam).toBeLessThanOrEqual(typical);
  });

  it('is deterministic for a seed', () => {
    expect(generateNoise('pink', 100, 7)).toEqual(generateNoise('pink', 100, 7));
  });
});
