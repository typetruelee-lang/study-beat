/**
 * FOCUS CLAY sound engine — standalone build for any web page.
 *
 *   <script src="focus-clay-engine.js"></script>
 *   <script>
 *     const fc = FocusClay.create();
 *     button.onclick = () => fc.play({ beat: 10, sounds: [{ id: 'rain_01' }] }); // must start from a tap
 *   </script>
 *
 * It is the same engine the app uses (src/audio): binaural beat with true L/R split, procedural
 * ambient sounds and noise, ramped changes, fade in/out, sleep timer fade on the audio clock.
 * No React, no app state, no storage.
 */
import { WebAudioEngine } from '../audio/AudioEngine';
import { createTrack } from '../audio/ambient/createTrack';
import { prewarmSounds } from '../audio/prewarm';
import type { Bus } from '../audio/types';
import { BANDS, BEAT_PRESETS, bandOf, CARRIER_OPTIONS } from '../app/beats';
import { getSound, SOUNDS } from '../sounds/catalog';

export interface SoundChoice {
  id: string;
  /** 0…1, defaults to the sound's own default volume. */
  volume?: number;
}

export interface PlayOptions {
  /** Binaural beat frequency in Hz (e.g. 10). `null` or omitted = no binaural beat. */
  beat?: number | null;
  /** Left-ear carrier in Hz (default 400; 400–500 is heard best). */
  carrier?: number;
  /** Background sounds / noise to play (ids from `FocusClay.sounds`). */
  sounds?: SoundChoice[];
  /** Master volume 0…1 (default 0.6). */
  volume?: number;
  /** Bus volumes 0…1: binaural beat, ambient sounds, noise. */
  binauralVolume?: number;
  ambientVolume?: number;
  noiseVolume?: number;
  /** Fade-in seconds (default 2). */
  fadeIn?: number;
}

/** One player = one audio graph. Create it once per page. */
export class FocusClayPlayer {
  private engine = new WebAudioEngine(createTrack);
  private beat: number | null = null;
  private carrier = 400;
  private isPlaying = false;
  private sleepStop: ReturnType<typeof setTimeout> | null = null;
  private onVisibility = () => this.engine.setAppHidden(document.visibilityState === 'hidden');

  constructor() {
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Start (or update) playback. Call it from a click/tap — browsers only allow audio after one. */
  async play(options: PlayOptions = {}): Promise<void> {
    const e = this.engine;
    await e.unlock();
    if (options.volume !== undefined) e.setMasterVolume(options.volume);
    else if (!this.isPlaying) e.setMasterVolume(0.6);
    if (options.binauralVolume !== undefined) e.setBusVolume('binaural', options.binauralVolume);
    if (options.ambientVolume !== undefined) e.setBusVolume('ambient', options.ambientVolume);
    if (options.noiseVolume !== undefined) e.setBusVolume('noise', options.noiseVolume);
    if (options.carrier !== undefined) this.setCarrier(options.carrier);
    if ('beat' in options) this.setBinaural(options.beat ?? null);
    if (options.sounds) this.setSounds(options.sounds);
    if (!this.isPlaying) e.fadeIn(options.fadeIn ?? 2);
    this.isPlaying = true;
  }

  /** Fade out and stop everything. */
  async stop(fadeSeconds = 1.2): Promise<void> {
    this.cancelSleepTimer();
    this.isPlaying = false;
    this.beat = null;
    await this.engine.stopAll(fadeSeconds);
  }

  /** Turn the binaural beat on at `hz`, change it (smooth glide), or turn it off with `null`. */
  setBinaural(hz: number | null) {
    if (hz === null) {
      if (this.beat !== null) this.engine.stopBinauralBeat();
      this.beat = null;
      return;
    }
    if (this.beat === null || !this.engine.isBinauralOn()) this.engine.startBinauralBeat({ beat: hz, carrier: this.carrier });
    else this.engine.setBeatFrequency(hz);
    this.beat = hz;
  }

  /** Change the beat frequency, gliding over `rampSeconds` (default 2). */
  setBeat(hz: number, rampSeconds = 2) {
    if (this.beat === null) return this.setBinaural(hz);
    this.beat = hz;
    this.engine.setBeatFrequency(hz, rampSeconds);
  }

  setCarrier(hz: number) {
    this.carrier = hz;
    this.engine.setCarrierFrequency(hz);
  }

  /** Replace the whole set of background sounds. */
  setSounds(sounds: SoundChoice[]) {
    const wanted = new Map(sounds.map((s) => [s.id, s.volume]));
    for (const id of this.engine.activeTrackIds()) if (!wanted.has(id)) this.engine.stopTrack(id);
    for (const [id, volume] of wanted) this.addSound(id, volume);
  }

  addSound(id: string, volume?: number) {
    const meta = getSound(id);
    if (!meta) throw new Error(`Unknown FOCUS CLAY sound: ${id}`);
    if (this.engine.activeTrackIds().includes(id)) this.engine.setTrackVolume(id, volume ?? meta.volume);
    else this.engine.playTrack(meta, volume ?? meta.volume);
  }

  removeSound(id: string) {
    this.engine.stopTrack(id);
  }

  setSoundVolume(id: string, volume: number) {
    this.engine.setTrackVolume(id, volume);
  }

  /** Master volume 0…1. */
  setVolume(volume: number) {
    this.engine.setMasterVolume(volume);
  }

  setBusVolume(bus: Bus, volume: number) {
    this.engine.setBusVolume(bus, volume);
  }

  /** Fade out over the last `fadeSeconds` and stop after `seconds`. Scheduled on the audio clock. */
  sleepTimer(seconds: number, fadeSeconds = 20) {
    this.cancelSleepTimer();
    const fade = Math.min(fadeSeconds, seconds);
    this.engine.scheduleFadeOut(Math.max(0, seconds - fade), fade);
    this.sleepStop = setTimeout(() => void this.stop(0.2), seconds * 1000 + 200);
  }

  cancelSleepTimer() {
    if (this.sleepStop) clearTimeout(this.sleepStop);
    this.sleepStop = null;
    this.engine.cancelScheduledFadeOut();
  }

  /** Prepare sounds in idle time so starting them later never stutters. */
  prewarm(ids: string[]) {
    prewarmSounds(ids);
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get state() {
    return { playing: this.isPlaying, beat: this.beat, carrier: this.carrier, sounds: this.engine.activeTrackIds() };
  }

  /** AnalyserNode of the output (for visualisations), or null before playback. */
  get analyser(): AnalyserNode | null {
    return this.engine.getAnalyser();
  }

  /** Stop and detach page listeners. */
  async destroy() {
    await this.stop(0.3);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

export function create(): FocusClayPlayer {
  return new FocusClayPlayer();
}

/** Every available sound (id, name, category, default volume, licence). */
export const sounds = SOUNDS.map(({ id, name, emoji, category, bus, volume, license, useCases }) => ({
  id, name, emoji, category, kind: bus, volume, useCases, license,
}));

/** Beat presets with their EEG frequency band (IFCN 2020 naming). */
export const presets = BEAT_PRESETS.map((p) => ({ ...p, band: bandOf(p.hz), bandName: BANDS[bandOf(p.hz)].name }));

export const carriers = [...CARRIER_OPTIONS];

export const version = '0.4.0';
