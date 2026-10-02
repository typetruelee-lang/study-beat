import { rampTo } from '../ramp';

/** Level of the tone before the bus gain (one tone in both ears, so a little below the binaural pair). */
const TONE_LEVEL = 0.24;

/**
 * Isochronic tone: one carrier tone switched on and off `beat` times per second with soft edges.
 * Unlike a binaural beat it does not need headphones (the pulsing is in the sound itself), so it
 * works on a phone speaker. Same interface as BinauralBeat.
 */
export class IsochronicTone {
  private tone: OscillatorNode;
  private pulse: OscillatorNode;
  private gate: GainNode;
  private out: GainNode;
  private carrier: number;
  private beat: number;
  private stopped = false;

  constructor(private ctx: BaseAudioContext, destination: AudioNode, opts: { carrier: number; beat: number; fadeIn?: number }) {
    this.carrier = opts.carrier;
    this.beat = opts.beat;
    this.tone = new OscillatorNode(ctx, { type: 'sine', frequency: this.carrier });
    // Rounded square wave (odd harmonics 1, 3, 5 with gentle roll-off): pulses without clicks.
    const real = new Float32Array([0, 0, 0, 0, 0, 0]);
    const imag = new Float32Array([0, 1, 0, 0.22, 0, 0.06]);
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    this.pulse = new OscillatorNode(ctx, { frequency: this.beat });
    this.pulse.setPeriodicWave(wave);
    // gate.gain = 0.5 + 0.5 · pulse  → swings between ~0 and 1
    this.gate = new GainNode(ctx, { gain: 0.5 });
    const depth = new GainNode(ctx, { gain: 0.5 });
    this.pulse.connect(depth).connect(this.gate.gain);
    this.out = new GainNode(ctx, { gain: 0 });
    this.tone.connect(this.gate).connect(this.out).connect(destination);
    const t = ctx.currentTime;
    this.tone.start(t);
    this.pulse.start(t);
    rampTo(this.out.gain, TONE_LEVEL, opts.fadeIn ?? 2, ctx);
  }

  setBeat(beat: number, rampSeconds = 2) {
    if (beat === this.beat) return;
    this.beat = beat;
    rampTo(this.pulse.frequency, beat, rampSeconds, this.ctx);
  }

  setCarrier(carrier: number, rampSeconds = 2) {
    if (carrier === this.carrier) return;
    this.carrier = carrier;
    rampTo(this.tone.frequency, carrier, rampSeconds, this.ctx);
  }

  stop(fadeSeconds = 1.5) {
    if (this.stopped) return;
    this.stopped = true;
    rampTo(this.out.gain, 0, fadeSeconds, this.ctx);
    const end = this.ctx.currentTime + fadeSeconds + 0.05;
    this.tone.stop(end);
    this.pulse.stop(end);
    this.tone.onended = () => this.out.disconnect();
  }
}
