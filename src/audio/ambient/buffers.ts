/**
 * Buffer builders for procedural sounds.
 *
 * Sample data is generated once per app (not per AudioContext) at fixed sample rates and kept
 * in `dataCache`, so it can be prepared ahead of time (see prewarm.ts) — even before the first
 * tap creates the AudioContext. Turning data into an AudioBuffer for a context is only a copy.
 * Event buffers run at 24 kHz to halve CPU/memory (plenty for ambient content).
 */
import { createRng } from '../../lib/rng';
import { generateNoise, makeLoopable, type NoiseColor } from '../noise/generators';

export interface SoundData {
  rate: number;
  channels: Float32Array<ArrayBuffer>[];
}

const dataCache = new Map<string, SoundData>();
const bufferCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

function data(key: string, make: () => SoundData): SoundData {
  let d = dataCache.get(key);
  if (!d) dataCache.set(key, (d = make()));
  return d;
}

function toBuffer(ctx: BaseAudioContext, key: string, d: SoundData): AudioBuffer {
  let m = bufferCache.get(ctx);
  if (!m) bufferCache.set(ctx, (m = new Map()));
  let b = m.get(key);
  if (!b) {
    b = new AudioBuffer({ length: d.channels[0].length, numberOfChannels: d.channels.length, sampleRate: d.rate });
    d.channels.forEach((c, i) => b!.copyToChannel(c, i));
    m.set(key, b);
  }
  return b;
}

/** Every generated buffer so far (for the audio checks: seams, NaN, peaks). */
export function allSoundData(): [string, SoundData][] {
  return [...dataCache.entries()];
}

export function hasSoundData(key: string): boolean {
  return dataCache.has(key);
}

const NOISE_RATE = 48000;

/** Stereo, decorrelated, seamlessly looping noise (8 s at 48 kHz). */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  const key = `noise-${color}`;
  return toBuffer(ctx, key, data(key, () => {
    const sr = NOISE_RATE;
    const fade = Math.floor(sr * 0.25);
    const len = sr * 8 + fade;
    return {
      rate: sr,
      channels: [makeLoopable(generateNoise(color, len, 11), fade), makeLoopable(generateNoise(color, len, 23), fade)],
    };
  }));
}

export type Filler = (L: Float32Array, R: Float32Array, sr: number, rnd: () => number) => void;

export function eventBuffer(ctx: BaseAudioContext, key: string, seconds: number, fill: Filler, sr = 24000): AudioBuffer {
  return toBuffer(ctx, key, data(key, () => {
    const len = Math.floor(seconds * sr);
    const L = new Float32Array(len);
    const R = new Float32Array(len);
    fill(L, R, sr, createRng(hash(key)));
    return { rate: sr, channels: [L, R] };
  }));
}

/**
 * Smooth random control signal in [-1, 1] (mono, 8 kHz, loops). Used to modulate gains and
 * filter frequencies so textures breathe without an obvious periodic LFO.
 */
export function smoothRandomBuffer(ctx: BaseAudioContext, key: string, seconds: number, changesPerSecond: number): AudioBuffer {
  const k = `smooth-${key}-${seconds}`;
  return toBuffer(ctx, k, data(k, () => {
    const sr = 8000;
    const fade = sr * 2;
    const len = Math.floor(seconds * sr) + fade;
    const rnd = createRng(hash(key));
    const out = new Float32Array(len);
    const step = Math.max(1, Math.floor(sr / changesPerSecond));
    let a = rnd() * 2 - 1;
    let b = rnd() * 2 - 1;
    for (let i = 0; i < len; i++) {
      const t = (i % step) / step;
      if (i % step === 0 && i > 0) {
        a = b;
        b = rnd() * 2 - 1;
      }
      const sm = t * t * (3 - 2 * t); // smoothstep
      out[i] = a + (b - a) * sm;
    }
    return { rate: sr, channels: [makeLoopable(out, fade)] };
  }));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ─── event painters ──────────────────────────────────────────────────────────

/**
 * Add a mono event at `start` with a pan in [-1, 1] (equal power).
 * A tail running past the end wraps to the start, so looped buffers never cut an event off.
 */
export function addEvent(L: Float32Array, R: Float32Array, start: number, samples: Float32Array, pan: number) {
  const a = Math.cos(((pan + 1) * Math.PI) / 4);
  const b = Math.sin(((pan + 1) * Math.PI) / 4);
  const len = L.length;
  for (let i = 0; i < samples.length; i++) {
    const j = (start + i) % len;
    L[j] += samples[i] * a;
    R[j] += samples[i] * b;
  }
}

/** Decaying sine "ping" (+ optional noise click), e.g. a raindrop or cup clink. */
export function ping(sr: number, rnd: () => number, freq: number, decaySec: number, amp: number, noise = 0.3, glide = 1): Float32Array {
  const len = Math.floor(decaySec * 5 * sr);
  const out = new Float32Array(len);
  const decay = Math.exp(-1 / (decaySec * sr));
  const noiseDecay = Math.exp(-1 / (decaySec * 0.3 * sr));
  const attack = sr * 0.0015;
  const glideEnd = decaySec * 3 * sr;
  let env = amp;
  let nEnv = noise;
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const f = glide === 1 ? freq : freq * (1 + (glide - 1) * Math.min(1, i / glideEnd));
    phase += (2 * Math.PI * f) / sr;
    const a = i < attack ? i / attack : 1;
    out[i] = a * env * (Math.sin(phase) + nEnv * (rnd() * 2 - 1));
    env *= decay;
    nEnv *= noiseDecay;
  }
  return out;
}

/**
 * Rain-drop impact: a very short noise burst with an instant attack and exponential decay.
 * `brightness` (0–1) is a one-pole low-pass coefficient; `crisp` differentiates the result
 * (high-pass tilt) for the fine "tick" of small drops. No pitch — real drops are noisy.
 */
export function impact(sr: number, rnd: () => number, seconds: number, amp: number, brightness: number, crisp: boolean): Float32Array {
  const len = Math.max(2, Math.floor(seconds * sr));
  const out = new Float32Array(len);
  const decay = Math.exp(-1 / (len / 4));
  const attack = Math.max(1, Math.floor(sr * 0.0003));
  let env = amp;
  let y = 0;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    y += brightness * (rnd() * 2 - 1 - y);
    const v = crisp ? y - prev : y;
    prev = y;
    out[i] = v * env * (i < attack ? i / attack : 1);
    env *= decay;
  }
  return out;
}

/** Filtered noise burst with a smooth envelope (page flip, crackle, rumble). */
export function burst(sr: number, rnd: () => number, seconds: number, amp: number, smoothing: number, attack = 0.1): Float32Array {
  const len = Math.floor(seconds * sr);
  const out = new Float32Array(len);
  let y = 0;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const env = t < attack ? t / attack : Math.pow(1 - (t - attack) / (1 - attack), 2);
    y += smoothing * ((rnd() * 2 - 1) - y);
    out[i] = amp * env * y;
  }
  return out;
}

/** Short bird-like chirp: sine sweep with a sine envelope. */
export function chirp(sr: number, f0: number, f1: number, seconds: number, amp: number): Float32Array {
  const len = Math.floor(seconds * sr);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const f = f0 + (f1 - f0) * t;
    phase += (2 * Math.PI * f) / sr;
    out[i] = amp * Math.sin(Math.PI * t) ** 2 * Math.sin(phase);
  }
  return out;
}

/** Soft sine tone with slow attack/release and a touch of 2nd harmonic (pad / music box). */
export function tone(sr: number, freq: number, seconds: number, amp: number, attack: number, release: number, harmonic = 0.25): Float32Array {
  const len = Math.floor(seconds * sr);
  const out = new Float32Array(len);
  // Sine by rotation (two multiplies per sample instead of Math.sin): fast enough for 30 s pads.
  const w = (2 * Math.PI * freq) / sr;
  const cw = Math.cos(w), sw = Math.sin(w);
  let s1 = 0, c1 = 1;
  const attackN = attack * sr, releaseN = release * sr;
  for (let i = 0; i < len; i++) {
    const env = Math.max(0, Math.min(1, i / attackN, (len - i) / releaseN));
    out[i] = amp * env * (s1 + harmonic * 2 * s1 * c1); // sin(2x) = 2 sin x cos x
    const ns = s1 * cw + c1 * sw;
    c1 = c1 * cw - s1 * sw;
    s1 = ns;
  }
  return out;
}
