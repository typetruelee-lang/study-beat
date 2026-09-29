import { describe, expect, it } from 'vitest';
import { rightEarFrequency, sliderToGain } from './ramp';

describe('binaural frequency math', () => {
  it.each([
    [4, 404],
    [6, 406],
    [8, 408],
    [10, 410],
    [12, 412],
    [14, 414],
  ])('%iHz beat → L 400Hz / R %iHz', (beat, right) => {
    expect(rightEarFrequency(400, beat)).toBe(right);
  });

  it('slider to gain is monotonic and bounded', () => {
    expect(sliderToGain(0)).toBe(0);
    expect(sliderToGain(1)).toBe(1);
    expect(sliderToGain(0.5)).toBeCloseTo(0.25);
    expect(sliderToGain(2)).toBe(1);
  });
});
