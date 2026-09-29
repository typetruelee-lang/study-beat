/**
 * Web Audio engine (UI-independent).
 *
 *   binaural bus ───────────────────────────────┐
 *   ambient bus ─┐                              ├→ master (user volume) → fader (fade in/out)
 *   noise bus   ─┴→ carve (−6 dB at the carrier ┘     → sleepFader (scheduled timer fade)
 *                   while the binaural beat is on)    → compressor → analyser → speakers
 *
 * Every gain/frequency change is ramped (see ramp.ts); sources always start from silence.
 */
import type { SoundMeta } from '../sounds/types';
import { BinauralBeat } from './binaural/BinauralBeat';
import { createCarve, setCarve } from './carve';
import { playChime } from './chime';
import { rampTo, sliderToGain } from './ramp';
import type { AudioPort, BinauralParams, Bus } from './types';

export interface TrackSource {
  stop(fadeSeconds: number): void;
}

/** Builds a playing source for a sound, connected to `output`. Provided by the ambient module. */
export type TrackFactory = (ctx: AudioContext, meta: SoundMeta, output: AudioNode) => TrackSource;

interface Track {
  gain: GainNode;
  source: TrackSource;
}

type Ctor = typeof AudioContext;

export class WebAudioEngine implements AudioPort {
  private ctx: AudioContext | null = null;
  private buses!: Record<Bus, GainNode>;
  private master!: GainNode;
  private fader!: GainNode;
  private sleepFader!: GainNode;
  private analyser!: AnalyserNode;
  private carve!: BiquadFilterNode;
  private carrier = 400;
  private binaural: BinauralBeat | null = null;
  private tracks = new Map<string, Track>();
  private busLevels: Record<Bus, number> = { binaural: 0.35, ambient: 0.8, noise: 0.6 };
  private masterLevel = 0.6;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private chimeUntil = 0;

  constructor(private trackFactory: TrackFactory | null = null) {}

  setTrackFactory(f: TrackFactory) {
    this.trackFactory = f;
  }

  static isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext);
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const C: Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
    const ctx = new C({ latencyHint: 'playback' });
    this.ctx = ctx;
    const comp = new DynamicsCompressorNode(ctx, { threshold: -10, knee: 8, ratio: 4, attack: 0.01, release: 0.25 });
    this.analyser = new AnalyserNode(ctx, { fftSize: 1024, smoothingTimeConstant: 0.6 });
    this.sleepFader = new GainNode(ctx, { gain: 1 });
    this.fader = new GainNode(ctx, { gain: 0 });
    this.master = new GainNode(ctx, { gain: sliderToGain(this.masterLevel) });
    this.master.connect(this.fader).connect(this.sleepFader).connect(comp).connect(this.analyser).connect(ctx.destination);
    this.buses = {
      binaural: new GainNode(ctx, { gain: sliderToGain(this.busLevels.binaural) }),
      ambient: new GainNode(ctx, { gain: sliderToGain(this.busLevels.ambient) }),
      noise: new GainNode(ctx, { gain: sliderToGain(this.busLevels.noise) }),
    };
    this.carve = createCarve(ctx, this.carrier);
    this.carve.connect(this.master);
    this.buses.binaural.connect(this.master);
    this.buses.ambient.connect(this.carve);
    this.buses.noise.connect(this.carve);
    return ctx;
  }

  async unlock() {
    const ctx = this.ensure();
    this.cancelPendingSuspend();
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* resumed on next gesture */
      }
    }
    // iOS WebKit: a silent buffer started inside the gesture fully unlocks output.
    const src = new AudioBufferSourceNode(ctx, { buffer: ctx.createBuffer(1, 1, ctx.sampleRate) });
    src.connect(ctx.destination);
    src.start();
  }

  startBinauralBeat({ beat, carrier }: BinauralParams) {
    const ctx = this.ensure();
    this.binaural?.stop(1);
    this.binaural = new BinauralBeat(ctx, this.buses.binaural, { beat, carrier, fadeIn: 2.5 });
    this.carrier = carrier;
    setCarve(this.carve, ctx, true, carrier);
  }

  stopBinauralBeat(fadeSeconds = 1.5) {
    this.binaural?.stop(fadeSeconds);
    this.binaural = null;
    if (this.ctx) setCarve(this.carve, this.ctx, false, this.carrier);
  }

  isBinauralOn() {
    return this.binaural !== null;
  }

  setBeatFrequency(hz: number, rampSeconds = 2) {
    this.binaural?.setBeat(hz, rampSeconds);
  }

  setCarrierFrequency(hz: number) {
    this.carrier = hz;
    this.binaural?.setCarrier(hz, 2);
    if (this.ctx) setCarve(this.carve, this.ctx, this.binaural !== null, hz, 2);
  }

  setBusVolume(bus: Bus, volume: number) {
    this.busLevels[bus] = volume;
    if (this.ctx) rampTo(this.buses[bus].gain, sliderToGain(volume), 0.15, this.ctx);
  }

  setMasterVolume(volume: number) {
    this.masterLevel = volume;
    if (this.ctx) rampTo(this.master.gain, sliderToGain(volume), 0.15, this.ctx);
  }

  playTrack(meta: SoundMeta, volume: number) {
    if (this.tracks.has(meta.id) || !this.trackFactory) return;
    const ctx = this.ensure();
    const gain = new GainNode(ctx, { gain: 0 });
    gain.connect(this.buses[meta.bus]);
    const source = this.trackFactory(ctx, meta, gain);
    rampTo(gain.gain, sliderToGain(volume), 2, ctx);
    this.tracks.set(meta.id, { gain, source });
  }

  stopTrack(id: string, fadeSeconds = 1.5) {
    const t = this.tracks.get(id);
    if (!t || !this.ctx) return;
    this.tracks.delete(id);
    rampTo(t.gain.gain, 0, fadeSeconds, this.ctx);
    t.source.stop(fadeSeconds);
    setTimeout(() => t.gain.disconnect(), (fadeSeconds + 0.3) * 1000);
  }

  setTrackVolume(id: string, volume: number) {
    const t = this.tracks.get(id);
    if (t && this.ctx) rampTo(t.gain.gain, sliderToGain(volume), 0.15, this.ctx);
  }

  activeTrackIds() {
    return [...this.tracks.keys()];
  }

  fadeIn(seconds: number) {
    const ctx = this.ensure();
    this.cancelPendingSuspend();
    rampTo(this.fader.gain, 1, seconds, ctx);
  }

  fadeOut(seconds: number): Promise<void> {
    if (!this.ctx) return Promise.resolve();
    rampTo(this.fader.gain, 0, seconds, this.ctx);
    return new Promise((r) => setTimeout(r, seconds * 1000 + 50));
  }

  async stopAll(fadeSeconds: number) {
    if (!this.ctx) return;
    await this.fadeOut(fadeSeconds);
    // Something may have started again during the fade (e.g. a new session).
    if (this.fader.gain.value > 0.001 && this.ctx.state === 'running') return;
    this.stopBinauralBeat(0.05);
    for (const id of [...this.tracks.keys()]) this.stopTrack(id, 0.05);
    this.suspendWhenIdle();
  }

  async suspend(fadeSeconds: number) {
    if (!this.ctx) return;
    await this.fadeOut(fadeSeconds);
    this.suspendWhenIdle();
  }

  async resume(fadeSeconds: number) {
    await this.unlock();
    this.fadeIn(fadeSeconds);
  }

  /** Suspend the context once nothing audible is left (saves battery), after any chime. */
  private suspendWhenIdle() {
    const ctx = this.ctx;
    if (!ctx) return;
    this.cancelPendingSuspend();
    const wait = Math.max(0, this.chimeUntil - ctx.currentTime) + 0.3;
    this.suspendTimer = setTimeout(() => {
      if (this.fader.gain.value < 0.001) void ctx.suspend();
    }, wait * 1000);
  }

  private cancelPendingSuspend() {
    if (this.suspendTimer) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
  }

  scheduleFadeOut(startInSeconds: number, fadeSeconds: number) {
    const ctx = this.ensure();
    const p = this.sleepFader.gain;
    const now = ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(1, now);
    p.setValueAtTime(1, now + startInSeconds);
    p.linearRampToValueAtTime(0, now + startInSeconds + fadeSeconds);
  }

  cancelScheduledFadeOut() {
    if (!this.ctx) return;
    rampTo(this.sleepFader.gain, 1, 0.5, this.ctx);
  }

  playChime(kind: 'bell' | 'beep') {
    const ctx = this.ensure();
    this.cancelPendingSuspend();
    void ctx.resume();
    // Bypasses the faders so it is heard even while the mix fades out.
    this.chimeUntil = playChime(ctx, this.analyser, kind);
    if (this.fader.gain.value < 0.001) this.suspendWhenIdle();
  }

  getAnalyser() {
    return this.ctx && this.ctx.state === 'running' ? this.analyser : null;
  }
}
