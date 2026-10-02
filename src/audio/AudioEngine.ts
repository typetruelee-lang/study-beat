/**
 * Web Audio engine (UI-independent).
 *
 *   binaural bus ───────────────────────────────┐
 *   ambient bus ─┐                              ├→ master (user volume) → fader (fade in/out)
 *   noise bus   ─┴→ carve (−6 dB at the carrier ┘     → sleepFader (scheduled timer fade)
 *                   while the binaural beat is on)    → compressor → analyser → output
 *
 * Output: while the app is visible the mix goes straight to the context's destination (the
 * audio thread's own, most stable path). A hidden <audio> element fed by a MediaStream is started
 * inside the first tap and kept ready; only when the app is hidden (screen off / another app) does
 * the mix crossfade onto it, because mobile WebViews are more willing to keep media elements
 * playing in the background. It crossfades back when the app is visible again.
 *
 * Every gain/frequency change is ramped (see ramp.ts); sources always start from silence.
 */
import type { SoundMeta } from '../sounds/types';
import { BinauralBeat } from './binaural/BinauralBeat';
import { IsochronicTone } from './binaural/IsochronicTone';
import { createCarve, setCarve } from './carve';
import { playChime } from './chime';
import { rampTo, sliderToGain } from './ramp';
import type { AudioPort, BeatKind, BinauralParams, Bus } from './types';

export interface TrackSource {
  stop(fadeSeconds: number): void;
}

/** Builds a playing source for a sound, connected to `output`. Provided by the ambient module. */
export type TrackFactory = (ctx: BaseAudioContext, meta: SoundMeta, output: AudioNode) => TrackSource;

interface Track {
  gain: GainNode;
  source: TrackSource;
  volume: number;
}

type Ctor = typeof AudioContext;
/** Lets checks render the whole engine offline: `new WebAudioEngine(createTrack, () => new OfflineAudioContext(...))`. */
export type ContextFactory = () => BaseAudioContext;

export class WebAudioEngine implements AudioPort {
  private ctx: BaseAudioContext | null = null;
  private buses!: Record<Bus, GainNode>;
  private master!: GainNode;
  private fader!: GainNode;
  private sleepFader!: GainNode;
  private analyser!: AnalyserNode;
  private carve!: BiquadFilterNode;
  private carrier = 400;
  private binaural: BinauralBeat | IsochronicTone | null = null;
  private kind: BeatKind = 'binaural';
  private tracks = new Map<string, Track>();
  private busLevels: Record<Bus, number> = { binaural: 0.35, ambient: 0.8, noise: 0.6 };
  private masterLevel = 0.6;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private chimeUntil = 0;
  private backgroundOutput = true;
  private route: 'direct' | 'stream' = 'direct';
  private streamReady = false;
  private hidden = false;
  private directOut!: GainNode;
  private streamOut: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private mediaEl: HTMLAudioElement | null = null;

  constructor(
    private trackFactory: TrackFactory | null = null,
    private contextFactory: ContextFactory | null = null,
  ) {}

  setTrackFactory(f: TrackFactory) {
    this.trackFactory = f;
  }

  static isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext);
  }

  private ensure(): BaseAudioContext {
    if (this.ctx) return this.ctx;
    let ctx: BaseAudioContext;
    if (this.contextFactory) ctx = this.contextFactory();
    else {
      const C: Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: Ctor }).webkitAudioContext;
      ctx = new C({ latencyHint: 'playback' });
    }
    this.ctx = ctx;
    const comp = new DynamicsCompressorNode(ctx, { threshold: -10, knee: 8, ratio: 4, attack: 0.01, release: 0.25 });
    this.analyser = new AnalyserNode(ctx, { fftSize: 1024, smoothingTimeConstant: 0.6 });
    this.sleepFader = new GainNode(ctx, { gain: 1 });
    this.fader = new GainNode(ctx, { gain: 0 });
    this.master = new GainNode(ctx, { gain: sliderToGain(this.masterLevel) });
    this.master.connect(this.fader).connect(this.sleepFader).connect(comp).connect(this.analyser);
    this.directOut = new GainNode(ctx, { gain: 1 });
    this.analyser.connect(this.directOut).connect(ctx.destination);
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
    // Start the output route synchronously inside the tap (media play() needs the gesture).
    const routed = this.prepareStream();
    if (ctx.state !== 'running' && isLive(ctx)) {
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
    await routed;
  }

  setBackgroundOutput(enabled: boolean) {
    this.backgroundOutput = enabled;
    if (!this.ctx) return;
    if (enabled) void this.prepareStream();
    this.applyRouteGains();
  }

  /** Called when the app is hidden/visible: move the mix onto / off the media element. */
  setAppHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!this.ctx) return;
    if (hidden && this.streamReady) void this.mediaEl?.play().catch(() => {});
    this.applyRouteGains();
  }

  /**
   * Start the media element inside a tap (play() needs the gesture) so it is ready for later.
   * While visible it carries silence; the mix only moves onto it when the app is hidden.
   */
  private async prepareStream(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.backgroundOutput || !isLive(ctx) || typeof Audio === 'undefined') return;
    if (!this.mediaEl) {
      this.streamDest = ctx.createMediaStreamDestination();
      this.streamOut = new GainNode(ctx, { gain: 0 });
      this.analyser.connect(this.streamOut).connect(this.streamDest);
      const el = new Audio();
      el.setAttribute('playsinline', '');
      el.srcObject = this.streamDest.stream;
      this.mediaEl = el;
    }
    try {
      await this.mediaEl.play();
      this.streamReady = true;
    } catch {
      this.streamReady = false; // autoplay refused: stay on direct output
    }
    this.applyRouteGains();
  }

  private applyRouteGains() {
    const ctx = this.ctx;
    if (!ctx) return;
    const useStream = this.streamReady && this.backgroundOutput && this.hidden;
    this.route = useStream ? 'stream' : 'direct';
    const t = ctx.currentTime;
    this.directOut.gain.setTargetAtTime(useStream ? 0 : 1, t, 0.06);
    this.streamOut?.gain.setTargetAtTime(useStream ? 1 : 0, t, 0.06);
  }

  /** Current effective output route (for diagnostics and tests). */
  get outputRoute() {
    return this.route;
  }

  /** Whether the media element is playing and ready to take over when hidden. */
  get backgroundReady() {
    return this.streamReady;
  }

  async ensureRunning() {
    const ctx = this.ctx;
    if (!ctx || this.fader.gain.value < 0.001 || !isLive(ctx)) return;
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* needs a tap */
      }
    }
    if (this.streamReady) await this.mediaEl?.play().catch(() => {});
  }

  startBinauralBeat({ beat, carrier, kind = 'binaural' }: BinauralParams) {
    const ctx = this.ensure();
    this.binaural?.stop(1);
    const Beat = kind === 'isochronic' ? IsochronicTone : BinauralBeat;
    this.binaural = new Beat(ctx, this.buses.binaural, { beat, carrier, fadeIn: 2.5 });
    this.kind = kind;
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

  beatKind() {
    return this.binaural ? this.kind : null;
  }

  setBeatFrequency(hz: number, rampSeconds = 2) {
    this.binaural?.setBeat(hz, rampSeconds);
  }

  setCarrierFrequency(hz: number) {
    if (this.carrier === hz) return;
    this.carrier = hz;
    this.binaural?.setCarrier(hz, 2);
    if (this.ctx) setCarve(this.carve, this.ctx, this.binaural !== null, hz, 2);
  }

  setBusVolume(bus: Bus, volume: number) {
    if (this.busLevels[bus] === volume) return; // unchanged: never restart a running ramp
    this.busLevels[bus] = volume;
    if (this.ctx) rampTo(this.buses[bus].gain, sliderToGain(volume), 0.15, this.ctx);
  }

  setMasterVolume(volume: number) {
    if (this.masterLevel === volume) return;
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
    this.tracks.set(meta.id, { gain, source, volume });
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
    if (!t || !this.ctx || t.volume === volume) return;
    t.volume = volume;
    rampTo(t.gain.gain, sliderToGain(volume), 0.15, this.ctx);
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
      if (this.fader.gain.value < 0.001 && isLive(ctx)) {
        void ctx.suspend();
        this.mediaEl?.pause();
      }
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
    if (isLive(ctx)) void ctx.resume();
    // Bypasses the faders so it is heard even while the mix fades out.
    this.chimeUntil = playChime(ctx, this.analyser, kind);
    if (this.fader.gain.value < 0.001) this.suspendWhenIdle();
  }

  getAnalyser() {
    return this.ctx && this.ctx.state === 'running' ? this.analyser : null;
  }
}

/** A real-time context (not an OfflineAudioContext used by checks). */
function isLive(ctx: BaseAudioContext): ctx is AudioContext {
  return typeof AudioContext !== 'undefined' && ctx instanceof AudioContext;
}
