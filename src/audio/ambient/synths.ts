/**
 * Procedural ambient recipes. Each builds a small node graph from cached buffers, filters and
 * slow modulation, connects it to `out`, and returns the sources so the caller can stop them.
 * All sounds are original and generated on the device (license: "Original (procedural)").
 */
import type { SynthId } from '../../sounds/types';
import {
  addEvent, burst, chirp, eventBuffer, impact, noiseBuffer, ping, smoothRandomBuffer, tone,
} from './buffers';

type Sources = AudioScheduledSourceNode[];
type Recipe = (ctx: BaseAudioContext, out: AudioNode) => Sources;

// ─── graph helpers ───────────────────────────────────────────────────────────

function loop(ctx: BaseAudioContext, buffer: AudioBuffer, dest: AudioNode | AudioParam, gain: number, sources: Sources): GainNode {
  const src = new AudioBufferSourceNode(ctx, { buffer, loop: true });
  const g = new GainNode(ctx, { gain });
  src.connect(g);
  if (dest instanceof AudioNode) g.connect(dest);
  else g.connect(dest);
  // Random start offset so two uses of the same buffer never line up.
  src.start(ctx.currentTime, Math.random() * buffer.duration);
  sources.push(src);
  return g;
}

/**
 * A noise loop that never audibly repeats: two copies of the 8 s buffer at different playback
 * rates (≈1 and ≈0.917), each rate drifting slowly by ±4%, so no stretch of texture ever replays
 * sample-for-sample. Returns one gain that controls both.
 */
function noiseBed(ctx: BaseAudioContext, color: 'white' | 'pink' | 'brown', dest: AudioNode, gain: number, sources: Sources): GainNode {
  const g = new GainNode(ctx, { gain });
  g.connect(dest);
  const buffer = noiseBuffer(ctx, color);
  for (const rate of [1, 0.917]) {
    const src = new AudioBufferSourceNode(ctx, { buffer, loop: true, playbackRate: rate });
    const half = new GainNode(ctx, { gain: Math.SQRT1_2 });
    src.connect(half).connect(g);
    wander(ctx, src.playbackRate, `rate-${color}-${rate}`, 0.04, 0.15, sources);
    src.start(ctx.currentTime, Math.random() * buffer.duration);
    sources.push(src);
  }
  return g;
}

function filt(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, Q = 0.7): BiquadFilterNode {
  return new BiquadFilterNode(ctx, { type, frequency, Q });
}

function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[0];
}

/** Drive `param` around its current value by ±depth with a smooth random signal. */
function wander(ctx: BaseAudioContext, param: AudioParam, key: string, depth: number, changesPerSecond: number, sources: Sources) {
  const src = new AudioBufferSourceNode(ctx, { buffer: smoothRandomBuffer(ctx, key, 30, changesPerSecond), loop: true });
  const g = new GainNode(ctx, { gain: depth });
  src.connect(g).connect(param);
  src.start(ctx.currentTime, Math.random() * 30);
  sources.push(src);
}

// ─── event buffers ───────────────────────────────────────────────────────────

/**
 * Rain impacts. Two layers with coprime loop lengths (7.3 s / 11.1 s) so the combined pattern
 * never audibly repeats: fine crisp patter and fewer, darker, heavier drops.
 */
const rainPatter = (ctx: BaseAudioContext, key: string, perSecond: number) =>
  eventBuffer(ctx, `patter-${key}`, 7.3, (L, R, sr, rnd) => {
    const n = Math.floor(perSecond * 7.3);
    for (let i = 0; i < n; i++) {
      const ev = impact(sr, rnd, 0.0006 + rnd() * 0.0025, 0.5 * (0.1 + 0.9 * rnd() ** 3), 0.55 + rnd() * 0.4, true);
      addEvent(L, R, Math.floor(rnd() * L.length), ev, rnd() * 1.8 - 0.9);
    }
  }, 44100);

const rainHeavy = (ctx: BaseAudioContext, key: string, perSecond: number) =>
  eventBuffer(ctx, `heavy-${key}`, 11.1, (L, R, sr, rnd) => {
    const n = Math.floor(perSecond * 11.1);
    for (let i = 0; i < n; i++) {
      const ev = impact(sr, rnd, 0.005 + rnd() * 0.012, 0.35 * (0.2 + 0.8 * rnd() ** 2), 0.18 + rnd() * 0.3, false);
      addEvent(L, R, Math.floor(rnd() * L.length), ev, rnd() * 1.4 - 0.7);
    }
  });

const crackles = (ctx: BaseAudioContext) =>
  eventBuffer(ctx, 'crackle', 12, (L, R, sr, rnd) => {
    let t = 0.05;
    while (t < 11.8) {
      const cluster = rnd() < 0.2 ? 3 + Math.floor(rnd() * 5) : 1;
      for (let c = 0; c < cluster; c++) {
        const a = 0.25 + 0.75 * rnd() ** 2;
        const ev = burst(sr, rnd, 0.004 + rnd() * 0.012, a, 0.5 + rnd() * 0.4, 0.02);
        const pos = Math.floor((t + c * 0.02 * rnd()) * sr);
        if (pos + ev.length < L.length) addEvent(L, R, pos, ev, rnd() * 1.2 - 0.6);
      }
      if (rnd() < 0.05) {
        const pop = ping(sr, rnd, 180 + rnd() * 200, 0.02, 0.5, 1.2);
        const pos = Math.floor(t * sr);
        if (pos + pop.length < L.length) addEvent(L, R, pos, pop, 0);
      }
      t += 0.04 + rnd() * 0.3;
    }
  });

const birds = (ctx: BaseAudioContext, key: string, groupsPerTenSec: number, amp: number) =>
  eventBuffer(ctx, `birds-${key}`, 20, (L, R, sr, rnd) => {
    const groups = Math.floor(groupsPerTenSec * 2);
    for (let g = 0; g < groups; g++) {
      const species = Math.floor(rnd() * 3);
      const base = [3200, 2400, 4200][species];
      const count = 2 + Math.floor(rnd() * 5);
      const pan = rnd() * 1.6 - 0.8;
      const a = amp * (0.3 + 0.7 * rnd());
      let pos = Math.floor(rnd() * (L.length - sr * 1.5));
      for (let c = 0; c < count; c++) {
        const dur = species === 1 ? 0.18 : 0.06 + rnd() * 0.06;
        const f0 = base * (0.9 + rnd() * 0.2);
        const f1 = species === 2 ? f0 * 0.7 : f0 * (1.2 + rnd() * 0.4);
        const ev = chirp(sr, f0, f1, dur, a);
        addEvent(L, R, pos, ev, pan);
        pos += Math.floor((dur + 0.05 + rnd() * 0.08) * sr);
      }
    }
  });

const crickets = (ctx: BaseAudioContext) =>
  eventBuffer(ctx, 'crickets', 12, (L, R, sr, rnd) => {
    for (const [freq, pan, period] of [[4300, -0.5, 0.9], [4700, 0.6, 1.15], [3900, 0.1, 1.6]] as const) {
      let t = rnd() * period;
      while (t < 11.5) {
        for (let p = 0; p < 6; p++) {
          const ev = chirp(sr, freq, freq * 1.01, 0.018, 0.05);
          addEvent(L, R, Math.floor((t + p * 0.028) * sr), ev, pan);
        }
        t += period * (0.9 + rnd() * 0.2);
      }
    }
  });

const trainClacks = (ctx: BaseAudioContext) =>
  eventBuffer(ctx, 'train', 8.8, (L, R, sr, rnd) => {
    for (let k = 0; k < 8; k++) {
      const t = k * 1.1;
      for (const [dt, a] of [[0, 0.6], [0.16, 0.45]] as const) {
        const thump = ping(sr, rnd, 70 + rnd() * 20, 0.05, a, 0.8, 0.8);
        const click = burst(sr, rnd, 0.015, a * 0.4, 0.6, 0.05);
        const pos = Math.floor((t + dt) * sr);
        addEvent(L, R, pos, thump, -0.1);
        addEvent(L, R, pos, click, 0.1);
      }
    }
  });

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];
const note = (i: number) => PENTA[((i % 5) + 5) % 5] * 2 ** Math.floor(i / 5);

const padBuffer = (ctx: BaseAudioContext, key: 'calm' | 'lullaby') =>
  eventBuffer(ctx, `pad-${key}`, 32, (L, R, sr, rnd) => {
    const chords = key === 'calm' ? [[-5, -3, 0, 2], [-4, -2, 1, 3], [-6, -3, -1, 2], [-5, -2, 0, 4]] : [[-5, -2, 0], [-4, -1, 1], [-6, -3, 0], [-5, -3, -1]];
    chords.forEach((ch, ci) => {
      for (const n of ch) {
        const f = note(n) / (key === 'calm' ? 2 : 1);
        const ev = tone(sr, f, 10.5, 0.05, 3, 4, 0.2);
        // wrap: the last chord's release continues into the start → seamless loop
        addEvent(L, R, Math.floor(ci * 8 * sr), ev, rnd() * 0.8 - 0.4);
      }
    });
    if (key === 'lullaby') {
      let t = 1;
      let idx = 5;
      while (t < 30) {
        idx += [-2, -1, 1, 2][Math.floor(rnd() * 4)];
        idx = Math.max(3, Math.min(11, idx));
        addEvent(L, R, Math.floor(t * sr), tone(sr, note(idx), 1.6, 0.035, 0.01, 1.5, 0.35), rnd() * 0.6 - 0.3);
        t += [0.8, 1.2, 1.6, 2.4][Math.floor(rnd() * 4)];
      }
    }
  }, 22050);

// ─── recipes ─────────────────────────────────────────────────────────────────

const plainNoise = (color: 'white' | 'pink' | 'brown'): Recipe => (ctx, out) => {
  const s: Sources = [];
  loop(ctx, noiseBuffer(ctx, color), out, 1, s);
  return s;
};

interface RainOpts {
  key: string;
  /** Upper edge of the hiss / heavy drops. */
  lp: number;
  hiss: number;
  body: number;
  patter: number;
  /** Level of the fine patter layer (default 1). */
  patterGain?: number;
  heavy: number;
}

/** An event loop played twice at drifting rates (≈1 and ≈0.93) so its pattern never replays. */
function eventBed(ctx: BaseAudioContext, buffer: AudioBuffer, dest: AudioNode, gain: number, sources: Sources): GainNode {
  const g = new GainNode(ctx, { gain });
  g.connect(dest);
  for (const rate of [1, 0.93]) {
    const src = new AudioBufferSourceNode(ctx, { buffer, loop: true, playbackRate: rate });
    src.connect(g);
    wander(ctx, src.playbackRate, `rate-ev-${rate}`, 0.04, 0.15, sources);
    src.start(ctx.currentTime, Math.random() * buffer.duration);
    sources.push(src);
  }
  return g;
}

/** Steady hiss + light low body + two impact layers; intensity drifts slowly. */
function rainLayers(ctx: BaseAudioContext, dest: AudioNode, s: Sources, o: RainOpts) {
  const out = new GainNode(ctx, { gain: 1.4 }); // match the loudness of the other sounds
  out.connect(dest);
  const hiss = noiseBed(ctx, 'pink', chain(filt(ctx, 'highpass', 600), filt(ctx, 'lowpass', o.lp), out), o.hiss, s);
  wander(ctx, hiss.gain, `rain-hiss-${o.key}`, o.hiss * 0.25, 0.15, s);
  noiseBed(ctx, 'brown', chain(filt(ctx, 'lowpass', 220), out), o.body, s);
  // Each bed plays its buffer twice, so buffers hold half the target density.
  eventBed(ctx, rainPatter(ctx, o.key, o.patter / 2), chain(filt(ctx, 'highpass', 1400), filt(ctx, 'lowpass', Math.min(16000, o.lp * 1.6)), out), o.patterGain ?? 1, s);
  const heavy = eventBed(ctx, rainHeavy(ctx, o.key, o.heavy / 2), chain(filt(ctx, 'highpass', 250), filt(ctx, 'lowpass', o.lp), out), 0.9, s);
  wander(ctx, heavy.gain, `rain-heavy-${o.key}`, 0.35, 0.07, s);
}

const RECIPES: Record<SynthId, Recipe> = {
  white: plainNoise('white'),
  pink: plainNoise('pink'),
  brown: plainNoise('brown'),

  // 보슬비: fine, light drizzle — a soft airy hiss and many tiny quiet drops, almost no heavy ones.
  rain: (ctx, out) => {
    const s: Sources = [];
    rainLayers(ctx, out, s, { key: 'drizzle', lp: 4500, hiss: 0.4, body: 0.1, patter: 110, patterGain: 0.45, heavy: 1 });
    return s;
  },
  softRain: (ctx, out) => {
    const s: Sources = [];
    rainLayers(ctx, out, s, { key: 'soft', lp: 5500, hiss: 0.45, body: 0.16, patter: 60, heavy: 8 });
    return s;
  },

  waves: (ctx, out) => {
    const s: Sources = [];
    const lp = filt(ctx, 'lowpass', 900);
    const g = loop(ctx, noiseBuffer(ctx, 'pink'), chain(lp, out), 0.55, s);
    wander(ctx, g.gain, 'waves-gain', 0.45, 0.12, s);
    wander(ctx, lp.frequency, 'waves-freq', 600, 0.12, s);
    loop(ctx, noiseBuffer(ctx, 'brown'), chain(filt(ctx, 'lowpass', 200), out), 0.4, s);
    return s;
  },
  slowWaves: (ctx, out) => {
    const s: Sources = [];
    const lp = filt(ctx, 'lowpass', 650);
    const g = loop(ctx, noiseBuffer(ctx, 'pink'), chain(lp, out), 0.5, s);
    wander(ctx, g.gain, 'swaves-gain', 0.42, 0.08, s);
    wander(ctx, lp.frequency, 'swaves-freq', 400, 0.08, s);
    loop(ctx, noiseBuffer(ctx, 'brown'), chain(filt(ctx, 'lowpass', 160), out), 0.45, s);
    return s;
  },

  wind: (ctx, out) => {
    const s: Sources = [];
    const bp = filt(ctx, 'bandpass', 600, 1.1);
    const g = loop(ctx, noiseBuffer(ctx, 'pink'), chain(bp, out), 0.9, s);
    wander(ctx, bp.frequency, 'wind-f', 380, 0.2, s);
    wander(ctx, g.gain, 'wind-g', 0.5, 0.15, s);
    loop(ctx, noiseBuffer(ctx, 'brown'), chain(filt(ctx, 'lowpass', 180), out), 0.35, s);
    return s;
  },
  mountainWind: (ctx, out) => {
    const s: Sources = [];
    const bp = filt(ctx, 'bandpass', 420, 1.6);
    const g = loop(ctx, noiseBuffer(ctx, 'pink'), chain(bp, out), 0.9, s);
    wander(ctx, bp.frequency, 'mwind-f', 260, 0.1, s);
    wander(ctx, g.gain, 'mwind-g', 0.55, 0.1, s);
    return s;
  },

  forest: (ctx, out) => {
    const s: Sources = [];
    const bp = filt(ctx, 'bandpass', 900, 0.6);
    const g = loop(ctx, noiseBuffer(ctx, 'pink'), chain(bp, out), 0.35, s);
    wander(ctx, g.gain, 'forest-leaves', 0.2, 0.25, s);
    loop(ctx, birds(ctx, 'forest', 3, 0.12), out, 1, s);
    return s;
  },
  birds: (ctx, out) => {
    const s: Sources = [];
    loop(ctx, noiseBuffer(ctx, 'pink'), chain(filt(ctx, 'lowpass', 1200), out), 0.12, s);
    loop(ctx, birds(ctx, 'dawn', 7, 0.16), out, 1, s);
    return s;
  },
  nightForest: (ctx, out) => {
    const s: Sources = [];
    const g = loop(ctx, noiseBuffer(ctx, 'pink'), chain(filt(ctx, 'lowpass', 700), out), 0.18, s);
    wander(ctx, g.gain, 'night-air', 0.1, 0.1, s);
    loop(ctx, crickets(ctx), out, 0.9, s);
    return s;
  },

  fire: (ctx, out) => {
    const s: Sources = [];
    const g = loop(ctx, noiseBuffer(ctx, 'brown'), chain(filt(ctx, 'lowpass', 450), out), 0.7, s);
    wander(ctx, g.gain, 'fire-roar', 0.3, 0.8, s);
    loop(ctx, crackles(ctx), chain(filt(ctx, 'highpass', 900), out), 0.8, s);
    return s;
  },

  train: (ctx, out) => {
    const s: Sources = [];
    const g = loop(ctx, noiseBuffer(ctx, 'brown'), chain(filt(ctx, 'lowpass', 260), out), 0.75, s);
    wander(ctx, g.gain, 'train-rumble', 0.15, 0.3, s);
    loop(ctx, noiseBuffer(ctx, 'pink'), chain(filt(ctx, 'bandpass', 900, 0.8), out), 0.08, s);
    loop(ctx, trainClacks(ctx), chain(filt(ctx, 'lowpass', 1500), out), 0.9, s);
    return s;
  },
  cityNight: (ctx, out) => {
    const s: Sources = [];
    const lp = filt(ctx, 'lowpass', 600);
    const g = loop(ctx, noiseBuffer(ctx, 'brown'), chain(lp, out), 0.6, s);
    wander(ctx, g.gain, 'city-traffic', 0.35, 0.12, s);
    wander(ctx, lp.frequency, 'city-f', 300, 0.12, s);
    loop(ctx, noiseBuffer(ctx, 'pink'), chain(filt(ctx, 'lowpass', 1500), out), 0.05, s);
    return s;
  },
  deepRumble: (ctx, out) => {
    const s: Sources = [];
    loop(ctx, noiseBuffer(ctx, 'brown'), chain(filt(ctx, 'lowpass', 130), out), 1.4, s);
    return s;
  },

  calmPad: (ctx, out) => {
    const s: Sources = [];
    loop(ctx, padBuffer(ctx, 'calm'), chain(filt(ctx, 'lowpass', 2400), out), 1.6, s);
    loop(ctx, noiseBuffer(ctx, 'pink'), chain(filt(ctx, 'lowpass', 500), out), 0.05, s);
    return s;
  },
  lullaby: (ctx, out) => {
    const s: Sources = [];
    loop(ctx, padBuffer(ctx, 'lullaby'), chain(filt(ctx, 'lowpass', 3000), out), 1.6, s);
    return s;
  },
};

/**
 * Loudness normalisation. RAW_DB is each recipe's measured output (RMS, dBFS); every sound is
 * brought to TARGET_DB so switching sounds keeps a similar level at the same slider position.
 * Sparse/bright textures (birds, crickets), the forest bed and white noise sit a little lower because they are
 * perceived as louder than their RMS suggests. `npm run test:audio` re-measures and fails when a
 * recipe drifts more than 2.5 dB (single 16 s render; slow modulation varies ±2 dB) from its target — update RAW_DB after changing a recipe.
 */
const RAW_DB: Record<SynthId, number> = {
  white: -14.0, pink: -14.0, brown: -14.0,
  rain: -22.2, softRain: -21.2,
  waves: -18.2, slowWaves: -18.3,
  wind: -22.0, mountainWind: -23.7,
  forest: -30.2, birds: -30.6, nightForest: -28.1,
  fire: -17.7,
  train: -17.1, cityNight: -17.6,
  deepRumble: -12.9,
  calmPad: -22.6, lullaby: -23.7,
};
export const TARGET_DB = (id: SynthId): number =>
  id === 'birds' || id === 'nightForest' ? -19 : id === 'white' ? -18 : id === 'forest' ? -17 : -16;

export function startSynth(ctx: BaseAudioContext, id: SynthId, out: AudioNode): Sources {
  const level = new GainNode(ctx, { gain: 10 ** ((TARGET_DB(id) - RAW_DB[id]) / 20) });
  level.connect(out);
  return RECIPES[id](ctx, level);
}

export const SYNTH_IDS = Object.keys(RECIPES) as SynthId[];
