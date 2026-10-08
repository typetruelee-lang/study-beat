/**
 * Web Audio engine (UI-independent).
 *
 *   binaural bus ───────────────────────────────┐
 *   ambient bus ─┐                              ├→ master (user volume) → fader (fade in/out)
 *   noise bus   ─┴→ carve (−6 dB at the carrier ┘     → sleepFader (scheduled timer fade)
 *                   while the binaural beat is on)    → compressor → analyser → output
 *
 * Output: while the app is visible the mix goes straight to the context's destination (the
 * audio thread's own, most stable path). For screen-off playback the same mix is also rendered
 * offline into a 30 s seamless loop and played by an ordinary <audio> element (see
 * backgroundTrack.ts for why a file and not a MediaStream). The element starts inside the first tap
 * and keeps playing muted; when the app is hidden it is unmuted and the live output fades out, and
 * the other way round when the app is visible again.
 *
 * Every gain/frequency change is ramped (see ramp.ts); sources always start from silence.
 */
import type { SoundMeta } from '../sounds/types';
import { BinauralBeat } from './binaural/BinauralBeat';
import { IsochronicTone } from './binaural/IsochronicTone';
import { buildLoop, encodeWav, LOOP_SECONDS, PREROLL_SECONDS, RENDER_RATE, silentWav, XFADE_SECONDS, type Stereo } from './backgroundTrack';
import { LoopStream, streamSupported } from './backgroundStream';
import { createCarve, setCarve } from './carve';
import { playChime } from './chime';
import { rampTo, sliderToGain } from './ramp';
import type { AudioDiagnostics, AudioPort, BeatKind, BinauralParams, Bus } from './types';

export interface TrackSource {
  stop(fadeSeconds: number): void;
}

/** Builds a playing source for a sound, connected to `output`. Provided by the ambient module. */
export type TrackFactory = (ctx: BaseAudioContext, meta: SoundMeta, output: AudioNode) => TrackSource;

interface Track {
  gain: GainNode;
  source: TrackSource;
  volume: number;
  meta: SoundMeta;
}

type Ctor = typeof AudioContext;
/** Lets checks render the whole engine offline: `new WebAudioEngine(createTrack, () => new OfflineAudioContext(...))`. */
export type ContextFactory = () => BaseAudioContext;

/** Wait this long after the last mix change before rendering the screen-off loop. */
const RENDER_DEBOUNCE_MS = 1000;
const MAX_EVENTS = 40;

export class WebAudioEngine implements AudioPort {
  private ctx: BaseAudioContext | null = null;
  private buses!: Record<Bus, GainNode>;
  private master!: GainNode;
  private fader!: GainNode;
  private sleepFader!: GainNode;
  private analyser!: AnalyserNode;
  private carve!: BiquadFilterNode;
  private carrier = 400;
  private beatHz = 10;
  private binaural: BinauralBeat | IsochronicTone | null = null;
  private kind: BeatKind = 'binaural';
  private tracks = new Map<string, Track>();
  private busLevels: Record<Bus, number> = { binaural: 0.35, ambient: 0.8, noise: 0.6 };
  private masterLevel = 0.6;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private chimeUntil = 0;
  /** +1 on every start (unlock/fadeIn): a pending stop/suspend only acts if nothing started since. */
  private playGen = 0;
  /** Sound is meant to be audible (fadeIn → true, fadeOut → false). */
  private soundOn = false;
  /** The OS paused the loop element while it was the output: fall back to live output. */
  private bgBlocked = false;
  private suspendRouteTimer: ReturnType<typeof setTimeout> | null = null;
  private directOut!: GainNode;

  // ── screen-off loop
  private backgroundOutput = true;
  private hidden = false;
  private route: 'direct' | 'background' = 'direct';
  private bgEl: HTMLAudioElement | null = null;
  private bgUrl: string | null = null;
  private bgStream: LoopStream | null = null;
  private hiddenCheck: ReturnType<typeof setTimeout> | null = null;
  /** Frame source for the "really hidden?" check (replaceable in checks). */
  requestFrame: (cb: () => void) => void = (cb) => requestAnimationFrame(cb);
  private mixVersion = 0;
  private renderedVersion = -1;
  private hasLoop = false;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private rendering = false;
  private lastRenderMs = 0;
  private lastRenderAt = 0;
  private bgFade: { start: number; seconds: number } | null = null;
  private bgFadeTimer: ReturnType<typeof setInterval> | null = null;
  private events: { at: number; msg: string }[] = [];
  private recoveries = 0;

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
    if (isLive(ctx)) ctx.onstatechange = () => this.log(`오디오 상태: ${ctx.state}`);
    return ctx;
  }

  async unlock() {
    const ctx = this.ensure();
    this.playGen++;
    this.cancelPendingSuspend();
    // Start the screen-off element synchronously inside the tap (media play() needs the gesture).
    this.startBackgroundElement();
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
  }

  // ─── screen-off loop ───────────────────────────────────────────────────────

  setBackgroundOutput(enabled: boolean) {
    this.backgroundOutput = enabled;
    if (!this.ctx) return;
    if (enabled) {
      this.startBackgroundElement();
      this.markMixChanged();
    } else {
      this.bgEl?.pause();
    }
    this.applyRoute();
  }

  /** Called when the app is hidden/visible: hand the sound to the loop element / take it back. */
  setAppHidden(hidden: boolean) {
    this.hidden = hidden;
    this.log(hidden ? '화면 꺼짐/다른 앱' : '앱으로 돌아옴');
    if (this.hiddenCheck) clearTimeout(this.hiddenCheck);
    this.hiddenCheck = null;
    if (hidden && typeof requestAnimationFrame === 'function') {
      // Some in-app browsers report "hidden" while the page is on screen. A hidden page draws no
      // frames; if frames keep coming, the page is visible and the live output stays.
      let frames = 0;
      const count = () => {
        frames++;
        if (this.hidden && frames < 30) this.requestFrame(count);
      };
      this.requestFrame(count);
      this.hiddenCheck = setTimeout(() => {
        this.hiddenCheck = null;
        if (this.hidden && frames >= 10) {
          this.log('숨김 신호 무시 (화면이 계속 그려짐)');
          this.hidden = false;
          this.applyRoute();
        }
      }, 800);
    }
    if (!this.ctx) return;
    if (!hidden && this.renderedVersion !== this.mixVersion) this.scheduleRender();
    this.applyRoute();
  }

  private startBackgroundElement() {
    const ctx = this.ctx;
    if (!ctx || !this.backgroundOutput || !isLive(ctx) || typeof Audio === 'undefined') return;
    if (!this.bgEl) {
      const el = new Audio();
      el.setAttribute('playsinline', '');
      el.loop = true;
      el.muted = true;
      el.volume = 0; // also silent where `muted` is ignored
      el.preload = 'auto';
      el.src = this.blobUrl(silentWav());
      for (const ev of ['pause', 'stalled', 'waiting', 'error', 'ended'] as const) {
        el.addEventListener(ev, () => this.log(`배경 음원: ${ev}`));
      }
      // Paused by the system while it carries the sound → go back to the live output.
      el.addEventListener('pause', () => {
        if (this.route === 'background' && this.soundOn) {
          this.bgBlocked = true;
          this.applyRoute();
        }
      });
      el.addEventListener('playing', () => (this.bgBlocked = false));
      this.bgEl = el;
    }
    // Muted while visible; starting it inside the tap lets it be unmuted later without one.
    void this.playElement();
  }

  private blobUrl(wav: ArrayBuffer) {
    const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    if (this.bgUrl) URL.revokeObjectURL(this.bgUrl);
    this.bgUrl = url;
    return url;
  }

  /**
   * Put a rendered loop on the element: an endless gapless stream where supported (MSE + FLAC),
   * otherwise a WAV file with `loop` (which pauses ≈0.1 s at every repeat).
   */
  private setLoopSource(el: HTMLAudioElement, loop: Stereo) {
    this.bgStream?.dispose();
    this.bgStream = null;
    if (streamSupported()) {
      const stream = new LoopStream(el, loop, (m) => this.log(m));
      this.bgStream = stream;
      el.loop = false;
      el.src = stream.url;
    } else {
      el.loop = true;
      el.src = this.blobUrl(encodeWav(loop));
    }
  }

  private async playElement() {
    const el = this.bgEl;
    if (!el || !el.paused) return;
    try {
      await el.play();
    } catch {
      this.log('배경 음원 재생 거부(다음 탭에서 다시 시도)');
    }
  }

  /** Something audible in the mix changed: re-render the loop once changes settle. */
  private markMixChanged() {
    if (!this.ctx || !isLive(this.ctx)) return; // offline renders never render loops themselves
    this.mixVersion++;
    if (this.backgroundOutput && !this.hidden) this.scheduleRender();
  }

  private scheduleRender() {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => void this.renderLoop(), RENDER_DEBOUNCE_MS);
  }

  private async renderLoop() {
    this.renderTimer = null;
    if (this.rendering) return this.scheduleRender();
    if (!this.bgEl || !this.backgroundOutput || this.hidden) return;
    const version = this.mixVersion;
    if (this.tracks.size === 0 && !this.binaural) return;
    this.rendering = true;
    const t0 = performance.now();
    try {
      const loop = await this.renderLoopAudio();
      if (version !== this.mixVersion) return this.scheduleRender(); // changed meanwhile
      const el = this.bgEl;
      const wasPlaying = !el.paused;
      this.setLoopSource(el, loop);
      this.renderedVersion = version;
      this.hasLoop = true;
      this.lastRenderMs = Math.round(performance.now() - t0);
      this.lastRenderAt = Date.now();
      this.log(`배경 음원 준비 (${this.lastRenderMs}ms, ${this.bgStream ? '이음매 없는 스트림' : 'WAV 반복'})`);
      if (wasPlaying || this.audible()) await this.playElement();
      this.applyRoute();
    } catch (e) {
      this.log(`배경 음원을 만들지 못함: ${String(e)}`);
    } finally {
      this.rendering = false;
    }
  }

  /** The current mix as a seamless 30 s stereo loop (also used by checks). */
  async renderLoopAudio(): Promise<Stereo> {
    const length = Math.round((PREROLL_SECONDS + LOOP_SECONDS + XFADE_SECONDS) * RENDER_RATE);
    const renderOne = async (part: 'tone' | 'bed'): Promise<Stereo | null> => {
      if (part === 'tone' && !this.binaural) return null;
      if (part === 'bed' && this.tracks.size === 0) return null;
      let off!: OfflineAudioContext;
      const e = new WebAudioEngine(this.trackFactory, () => (off = new OfflineAudioContext(2, length, RENDER_RATE)));
      e.masterLevel = this.masterLevel;
      e.busLevels = { ...this.busLevels, ...(part === 'tone' ? { ambient: 0, noise: 0 } : { binaural: 0 }) };
      e.carrier = this.carrier;
      e.ensure();
      // The bed render keeps the beat (silent) so the carrier carve matches the live mix.
      if (this.binaural) e.startBinauralBeat({ beat: this.beatHz, carrier: this.carrier, kind: this.kind });
      if (part === 'bed') for (const t of this.tracks.values()) e.playTrack(t.meta, t.volume);
      e.fadeIn(0.5);
      const buf = await off.startRendering();
      return { left: buf.getChannelData(0), right: buf.getChannelData(1), sampleRate: buf.sampleRate };
    };
    const tone = await renderOne('tone');
    const bed = await renderOne('bed');
    return buildLoop(tone, bed);
  }

  /** Mix is supposed to be audible (started and not faded/suspended). */
  private audible() {
    return !!this.ctx && this.soundOn;
  }

  /**
   * Exactly one copy of the mix is ever audible. While the loop file plays, the live graph is
   * silenced and then suspended: two copies of the same tone on two slightly different clocks
   * drift in and out of phase and the beat cancels itself every few minutes.
   */
  private applyRoute() {
    const ctx = this.ctx;
    if (!ctx) return;
    const useBg = this.backgroundOutput && this.hidden && this.hasLoop && !!this.bgEl && !this.bgBlocked && this.audible();
    const next = useBg ? 'background' : 'direct';
    const changed = next !== this.route;
    if (changed) this.log(`출력 경로: ${next === 'background' ? '배경 음원' : '직접'}`);
    this.route = next;
    if (this.suspendRouteTimer) clearTimeout(this.suspendRouteTimer);
    this.suspendRouteTimer = null;
    const el = this.bgEl;
    const t = ctx.currentTime;
    if (useBg && el) {
      if (this.renderedVersion !== this.mixVersion) this.log('배경 음원이 최신 믹스보다 이전 버전');
      this.directOut.gain.setTargetAtTime(0, t, 0.05);
      this.applyBgFade();
      el.muted = false;
      void this.playElement();
      if (isLive(ctx)) {
        // Live output faded out → stop the live graph entirely while the file plays.
        this.suspendRouteTimer = setTimeout(() => {
          if (this.route === 'background' && ctx.state === 'running') {
            void ctx.suspend();
            this.log('실시간 출력 쉬는 중 (배경 음원만 재생)');
          }
        }, 400);
      }
      return;
    }
    if (el) {
      el.muted = true;
      el.volume = 0;
    }
    if (!this.soundOn && ctx.state === 'suspended') {
      // Stopped while the live graph was paused: never let its old level come back.
      this.fader.gain.cancelScheduledValues(t);
      this.fader.gain.setValueAtTime(0, t);
    }
    if (changed && isLive(ctx) && ctx.state === 'suspended' && this.soundOn) {
      this.directOut.gain.cancelScheduledValues(t);
      this.directOut.gain.setValueAtTime(0, t);
      void ctx.resume().then(() => this.directOut.gain.setTargetAtTime(1, ctx.currentTime, 0.05));
      return;
    }
    this.directOut.gain.setTargetAtTime(1, t, 0.05);
  }

  /** Mirror the scheduled sleep fade on the loop element while it is the output (JS timer). */
  private applyBgFade() {
    const el = this.bgEl;
    if (!el) return;
    const tick = () => {
      if (!this.bgFade) return void (el.volume = 1);
      const into = (performance.now() - this.bgFade.start) / 1000;
      el.volume = Math.max(0, Math.min(1, 1 - into / this.bgFade.seconds));
    };
    tick();
    if (this.bgFadeTimer) clearInterval(this.bgFadeTimer);
    this.bgFadeTimer = this.bgFade ? setInterval(tick, 1000) : null;
  }

  /** Current effective output route (for diagnostics and tests). */
  get outputRoute() {
    return this.route;
  }

  /** Whether a rendered loop is ready to take over when hidden. */
  get backgroundReady() {
    return this.hasLoop && !!this.bgEl && !this.bgEl.paused;
  }

  async ensureRunning() {
    const ctx = this.ctx;
    if (!ctx || !this.audible() || !isLive(ctx)) return;
    if (this.route === 'background') return void (await this.playElement());
    if (ctx.state !== 'running') {
      this.log('오디오가 멈춰 있어 다시 시작');
      try {
        await ctx.resume();
      } catch {
        /* needs a tap */
      }
    }
    if (this.backgroundOutput) await this.playElement();
  }

  // ─── diagnostics ───────────────────────────────────────────────────────────

  private log(msg: string) {
    this.events.push({ at: Date.now(), msg });
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }

  noteRecovery(what: string) {
    this.recoveries++;
    this.log(`자동 복구: ${what}`);
  }

  diagnostics(): AudioDiagnostics {
    const ctx = this.ctx;
    return {
      route: this.route,
      contextState: ctx && isLive(ctx) ? ctx.state : 'none',
      sampleRate: ctx?.sampleRate ?? 0,
      backgroundOutput: this.backgroundOutput,
      loopReady: this.hasLoop,
      loopUpToDate: this.renderedVersion === this.mixVersion,
      loopPlaying: !!this.bgEl && !this.bgEl.paused,
      loopKind: this.hasLoop ? (this.bgStream ? 'stream' : 'wav') : null,
      streamAhead: this.bgStream ? Math.round(this.bgStream.ahead) : 0,
      lastRenderMs: this.lastRenderMs,
      lastRenderAt: this.lastRenderAt,
      beat: this.binaural ? { hz: this.beatHz, carrier: this.carrier, kind: this.kind } : null,
      tracks: [...this.tracks.keys()],
      recoveries: this.recoveries,
      events: [...this.events],
    };
  }

  // ─── sources ───────────────────────────────────────────────────────────────

  startBinauralBeat({ beat, carrier, kind = 'binaural' }: BinauralParams) {
    const ctx = this.ensure();
    this.binaural?.stop(1);
    const Beat = kind === 'isochronic' ? IsochronicTone : BinauralBeat;
    this.binaural = new Beat(ctx, this.buses.binaural, { beat, carrier, fadeIn: 2.5 });
    this.kind = kind;
    this.carrier = carrier;
    this.beatHz = beat;
    setCarve(this.carve, ctx, true, carrier);
    this.markMixChanged();
  }

  stopBinauralBeat(fadeSeconds = 1.5) {
    this.binaural?.stop(fadeSeconds);
    this.binaural = null;
    if (this.ctx) setCarve(this.carve, this.ctx, false, this.carrier);
    this.markMixChanged();
  }

  isBinauralOn() {
    return this.binaural !== null;
  }

  beatKind() {
    return this.binaural ? this.kind : null;
  }

  setBeatFrequency(hz: number, rampSeconds = 2) {
    if (!this.binaural || hz === this.beatHz) return;
    this.beatHz = hz;
    this.binaural.setBeat(hz, rampSeconds);
    this.markMixChanged();
  }

  setCarrierFrequency(hz: number) {
    if (this.carrier === hz) return;
    this.carrier = hz;
    this.binaural?.setCarrier(hz, 2);
    if (this.ctx) setCarve(this.carve, this.ctx, this.binaural !== null, hz, 2);
    this.markMixChanged();
  }

  setBusVolume(bus: Bus, volume: number) {
    if (this.busLevels[bus] === volume) return; // unchanged: never restart a running ramp
    this.busLevels[bus] = volume;
    if (this.ctx) rampTo(this.buses[bus].gain, sliderToGain(volume), 0.15, this.ctx);
    this.markMixChanged();
  }

  setMasterVolume(volume: number) {
    if (this.masterLevel === volume) return;
    this.masterLevel = volume;
    if (this.ctx) rampTo(this.master.gain, sliderToGain(volume), 0.15, this.ctx);
    this.markMixChanged();
  }

  playTrack(meta: SoundMeta, volume: number) {
    if (this.tracks.has(meta.id) || !this.trackFactory) return;
    const ctx = this.ensure();
    const gain = new GainNode(ctx, { gain: 0 });
    gain.connect(this.buses[meta.bus]);
    const source = this.trackFactory(ctx, meta, gain);
    rampTo(gain.gain, sliderToGain(volume), 2, ctx);
    this.tracks.set(meta.id, { gain, source, volume, meta });
    this.markMixChanged();
  }

  stopTrack(id: string, fadeSeconds = 1.5) {
    const t = this.tracks.get(id);
    if (!t || !this.ctx) return;
    this.tracks.delete(id);
    rampTo(t.gain.gain, 0, fadeSeconds, this.ctx);
    t.source.stop(fadeSeconds);
    setTimeout(() => t.gain.disconnect(), (fadeSeconds + 0.3) * 1000);
    this.markMixChanged();
  }

  setTrackVolume(id: string, volume: number) {
    const t = this.tracks.get(id);
    if (!t || !this.ctx || t.volume === volume) return;
    t.volume = volume;
    rampTo(t.gain.gain, sliderToGain(volume), 0.15, this.ctx);
    this.markMixChanged();
  }

  activeTrackIds() {
    return [...this.tracks.keys()];
  }

  // ─── level / lifecycle ─────────────────────────────────────────────────────

  fadeIn(seconds: number) {
    const ctx = this.ensure();
    this.playGen++;
    this.soundOn = true;
    this.cancelPendingSuspend();
    rampTo(this.fader.gain, 1, seconds, ctx);
    if (isLive(ctx)) {
      void this.playElement();
      if (this.renderedVersion !== this.mixVersion && !this.hidden && this.backgroundOutput) this.scheduleRender();
    }
  }

  fadeOut(seconds: number): Promise<void> {
    if (!this.ctx) return Promise.resolve();
    this.soundOn = false;
    if (this.route === 'background') this.fadeElement(seconds); // the route switches after the fade
    rampTo(this.fader.gain, 0, seconds, this.ctx);
    return new Promise((r) => setTimeout(r, seconds * 1000 + 50));
  }

  private fadeElement(seconds: number) {
    this.bgFade = { start: performance.now(), seconds };
    this.applyBgFade();
  }

  async stopAll(fadeSeconds: number) {
    if (!this.ctx) return;
    const gen = this.playGen;
    await this.fadeOut(fadeSeconds);
    // Something may have started again during the fade (e.g. a new session).
    if (gen !== this.playGen) return;
    this.stopBinauralBeat(0.05);
    for (const id of [...this.tracks.keys()]) this.stopTrack(id, 0.05);
    this.stopElement();
    this.suspendWhenIdle();
  }

  async suspend(fadeSeconds: number) {
    if (!this.ctx) return;
    const gen = this.playGen;
    await this.fadeOut(fadeSeconds);
    if (gen !== this.playGen) return;
    this.stopElement();
    this.suspendWhenIdle();
  }

  private stopElement() {
    this.bgEl?.pause();
    this.bgFade = null;
    if (this.bgFadeTimer) clearInterval(this.bgFadeTimer);
    this.bgFadeTimer = null;
    this.applyRoute();
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
    const gen = this.playGen;
    const wait = Math.max(0, this.chimeUntil - ctx.currentTime) + 0.3;
    this.suspendTimer = setTimeout(() => {
      if (gen === this.playGen && this.fader.gain.value < 0.001 && isLive(ctx)) void ctx.suspend();
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
    // Same fade for the screen-off loop (driven by a timer while it is the output).
    this.bgFade = { start: performance.now() + startInSeconds * 1000, seconds: fadeSeconds };
    if (this.route === 'background') this.applyBgFade();
  }

  cancelScheduledFadeOut() {
    if (!this.ctx) return;
    rampTo(this.sleepFader.gain, 1, 0.5, this.ctx);
    this.bgFade = null;
    if (this.bgFadeTimer) clearInterval(this.bgFadeTimer);
    this.bgFadeTimer = null;
    if (this.bgEl && this.route === 'background') this.bgEl.volume = 1;
  }

  playChime(kind: 'bell' | 'beep') {
    const ctx = this.ensure();
    this.cancelPendingSuspend();
    if (isLive(ctx)) void ctx.resume();
    // Bypasses the faders so it is heard even while the mix fades out.
    // While the loop file is the output the live mix is muted; the chime goes straight out.
    this.chimeUntil = playChime(ctx, this.route === 'background' ? ctx.destination : this.analyser, kind);
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
