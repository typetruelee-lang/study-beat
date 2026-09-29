/** Pure noise generators (no Web Audio) so they can be unit-tested. */
import { createRng } from '../../lib/rng';

export type NoiseColor = 'white' | 'pink' | 'brown';

export function generateNoise(color: NoiseColor, length: number, seed = 1): Float32Array<ArrayBuffer> {
  const rnd = createRng(seed);
  const out = new Float32Array(length);
  if (color === 'white') {
    for (let i = 0; i < length; i++) out[i] = rnd() * 2 - 1;
  } else if (color === 'pink') {
    // Paul Kellet's refined pink filter (−3 dB/octave).
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = rnd() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else {
    // Brown: leaky integrator of white noise (−6 dB/octave).
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02;
      out[i] = last;
    }
  }
  removeDc(out);
  normalizeRms(out, 0.2);
  return out;
}

export function removeDc(data: Float32Array) {
  let mean = 0;
  for (let i = 0; i < data.length; i++) mean += data[i];
  mean /= data.length || 1;
  for (let i = 0; i < data.length; i++) data[i] -= mean;
}

export function normalizeRms(data: Float32Array, target: number) {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i] * data[i];
  const rms = Math.sqrt(s / (data.length || 1));
  if (rms > 0) {
    const k = target / rms;
    for (let i = 0; i < data.length; i++) data[i] *= k;
  }
}

/**
 * Make a buffer loop seamlessly: the last `fade` samples are cross-faded (equal power)
 * into the first ones, and the buffer is shortened by `fade` — so end → start has no jump.
 */
export function makeLoopable(data: Float32Array<ArrayBuffer>, fade: number): Float32Array<ArrayBuffer> {
  const n = data.length - fade;
  const out = data.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    const a = Math.cos((t * Math.PI) / 2); // tail weight
    const b = Math.sin((t * Math.PI) / 2); // head weight
    out[i] = data[n + i] * a + data[i] * b;
  }
  return out;
}

/** Ratio of high-frequency energy (first difference) to total energy — spectral "tilt". */
export function brightness(data: Float32Array): number {
  let e = 0, d = 0;
  for (let i = 1; i < data.length; i++) {
    e += data[i] * data[i];
    const diff = data[i] - data[i - 1];
    d += diff * diff;
  }
  return d / e;
}
