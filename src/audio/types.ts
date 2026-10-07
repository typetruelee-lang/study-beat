import type { SoundMeta } from '../sounds/types';

export type Bus = 'binaural' | 'ambient' | 'noise';

export interface BinauralParams {
  /** Beat (difference) frequency in Hz, e.g. 10 */
  beat: number;
  /** Left-ear carrier in Hz, e.g. 400 → right ear 410 */
  carrier: number;
  /**
   * 'binaural' (default): different tone per ear, needs headphones.
   * 'isochronic': one pulsing tone, works on speakers.
   */
  kind?: BeatKind;
}

export type BeatKind = 'binaural' | 'isochronic';

/**
 * Everything the UI may ask of the sound engine. The UI never touches Web Audio nodes directly.
 * All level changes are ramped — no call here produces a click or a sudden loud start.
 */
export interface AudioPort {
  /** Create/resume the AudioContext. Must be called from a user gesture (tap). */
  unlock(): Promise<void>;
  startBinauralBeat(p: BinauralParams): void;
  stopBinauralBeat(): void;
  setBeatFrequency(hz: number, rampSeconds?: number): void;
  setCarrierFrequency(hz: number): void;
  setBusVolume(bus: Bus, volume: number): void;
  setMasterVolume(volume: number): void;
  playTrack(meta: SoundMeta, volume: number): void;
  stopTrack(id: string): void;
  setTrackVolume(id: string, volume: number): void;
  activeTrackIds(): string[];
  isBinauralOn(): boolean;
  /** Which kind of beat is playing, or null. */
  beatKind(): BeatKind | null;
  /** Raise the master level from silence. */
  fadeIn(seconds: number): void;
  /** Lower the master level to silence; resolves when done. */
  fadeOut(seconds: number): Promise<void>;
  /** Fade out and tear down every source. */
  stopAll(fadeSeconds: number): Promise<void>;
  /** Pause output (fade, then suspend the context to save battery). */
  suspend(fadeSeconds: number): Promise<void>;
  resume(fadeSeconds: number): Promise<void>;
  /**
   * Schedule a fade-out on the audio clock so it still happens if JS timers are throttled
   * (e.g. the screen turns off during a sleep timer).
   */
  scheduleFadeOut(startInSeconds: number, fadeSeconds: number): void;
  cancelScheduledFadeOut(): void;
  playChime(kind: 'bell' | 'beep'): void;
  /**
   * Screen-off playback: keep a rendered loop of the current mix ready in an ordinary <audio>
   * element and hand the sound to it while the app is hidden (see backgroundTrack.ts).
   */
  setBackgroundOutput(enabled: boolean): void;
  /** The app went to the background / came back (switches the output route). */
  setAppHidden(hidden: boolean): void;
  /** Resume output if the OS suspended it while the app was hidden. */
  ensureRunning(): Promise<void>;
  /** For the small waveform visual; null when audio is not running. */
  getAnalyser(): AnalyserNode | null;
  /** State and recent events for the 소리 진단 screen. */
  diagnostics(): AudioDiagnostics;
  /** Record that the app had to restore the sound (shown in diagnostics). */
  noteRecovery(what: string): void;
}

export interface AudioDiagnostics {
  route: 'direct' | 'background';
  contextState: AudioContextState | 'none';
  sampleRate: number;
  backgroundOutput: boolean;
  loopReady: boolean;
  loopUpToDate: boolean;
  loopPlaying: boolean;
  lastRenderMs: number;
  lastRenderAt: number;
  beat: { hz: number; carrier: number; kind: BeatKind } | null;
  tracks: string[];
  recoveries: number;
  events: { at: number; msg: string }[];
}

/** No-op engine (tests, or environments without Web Audio). */
export class SilentAudioPort implements AudioPort {
  private tracks = new Set<string>();
  private binaural = false;
  async unlock() {}
  startBinauralBeat() { this.binaural = true; }
  stopBinauralBeat() { this.binaural = false; }
  setBeatFrequency() {}
  setCarrierFrequency() {}
  setBusVolume() {}
  setMasterVolume() {}
  playTrack(meta: SoundMeta) { this.tracks.add(meta.id); }
  stopTrack(id: string) { this.tracks.delete(id); }
  setTrackVolume() {}
  activeTrackIds() { return [...this.tracks]; }
  isBinauralOn() { return this.binaural; }
  beatKind() { return this.binaural ? ('binaural' as const) : null; }
  fadeIn() {}
  async fadeOut() {}
  async stopAll() { this.tracks.clear(); this.binaural = false; }
  async suspend() {}
  async resume() {}
  scheduleFadeOut() {}
  cancelScheduledFadeOut() {}
  playChime() {}
  setBackgroundOutput() {}
  setAppHidden() {}
  async ensureRunning() {}
  getAnalyser() { return null; }
  diagnostics(): AudioDiagnostics {
    return { route: 'direct', contextState: 'none', sampleRate: 0, backgroundOutput: false, loopReady: false, loopUpToDate: true, loopPlaying: false, lastRenderMs: 0, lastRenderAt: 0, beat: null, tracks: [...this.tracks], recoveries: 0, events: [] };
  }
  noteRecovery() {}
}
