import type { SoundMeta } from '../sounds/types';

export type Bus = 'binaural' | 'ambient' | 'noise';

export interface BinauralParams {
  /** Beat (difference) frequency in Hz, e.g. 10 */
  beat: number;
  /** Left-ear carrier in Hz, e.g. 400 → right ear 410 */
  carrier: number;
}

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
   * Play through a media element (MediaStream) instead of straight to the speakers, so mobile
   * WebViews may keep playing with the screen off. Falls back to direct output if it cannot start.
   */
  setBackgroundOutput(enabled: boolean): void;
  /** The app went to the background / came back (switches the output route). */
  setAppHidden(hidden: boolean): void;
  /** Resume output if the OS suspended it while the app was hidden. */
  ensureRunning(): Promise<void>;
  /** For the small waveform visual; null when audio is not running. */
  getAnalyser(): AnalyserNode | null;
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
}
