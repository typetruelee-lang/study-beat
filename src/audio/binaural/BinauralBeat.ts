import { rampTo, rightEarFrequency } from '../ramp';

/** Level of each ear's sine before the bus gain — deliberately soft. */
const TONE_LEVEL = 0.28;

/**
 * Binaural beat: two sine oscillators hard-split to the left and right channels with a
 * ChannelMergerNode (no panning law, no crosstalk). Left = carrier, right = carrier + beat.
 */
export class BinauralBeat {
  private left: OscillatorNode;
  private right: OscillatorNode;
  private merger: ChannelMergerNode;
  private out: GainNode;
  private carrier: number;
  private beat: number;
  private stopped = false;

  constructor(private ctx: BaseAudioContext, destination: AudioNode, opts: { carrier: number; beat: number; fadeIn?: number }) {
    this.carrier = opts.carrier;
    this.beat = opts.beat;
    this.left = new OscillatorNode(ctx, { type: 'sine', frequency: this.carrier });
    this.right = new OscillatorNode(ctx, { type: 'sine', frequency: rightEarFrequency(this.carrier, this.beat) });
    this.merger = new ChannelMergerNode(ctx, { numberOfInputs: 2 });
    this.out = new GainNode(ctx, { gain: 0 });
    this.left.connect(this.merger, 0, 0);
    this.right.connect(this.merger, 0, 1);
    this.merger.connect(this.out).connect(destination);
    const t = ctx.currentTime;
    this.left.start(t);
    this.right.start(t);
    rampTo(this.out.gain, TONE_LEVEL, opts.fadeIn ?? 2, ctx);
  }

  get frequencies() {
    return { left: this.carrier, right: rightEarFrequency(this.carrier, this.beat), beat: this.beat };
  }

  setBeat(beat: number, rampSeconds = 2) {
    this.beat = beat;
    rampTo(this.right.frequency, rightEarFrequency(this.carrier, beat), rampSeconds, this.ctx);
  }

  setCarrier(carrier: number, rampSeconds = 2) {
    this.carrier = carrier;
    rampTo(this.left.frequency, carrier, rampSeconds, this.ctx);
    rampTo(this.right.frequency, rightEarFrequency(carrier, this.beat), rampSeconds, this.ctx);
  }

  stop(fadeSeconds = 1.5) {
    if (this.stopped) return;
    this.stopped = true;
    rampTo(this.out.gain, 0, fadeSeconds, this.ctx);
    const end = this.ctx.currentTime + fadeSeconds + 0.05;
    this.left.stop(end);
    this.right.stop(end);
    this.right.onended = () => this.out.disconnect();
  }
}
