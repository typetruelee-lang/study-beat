import { rampTo } from './ramp';

/**
 * Spectral carving: a gentle peaking cut at the binaural carrier on the ambient/noise path,
 * so low-heavy noise (brown, pink, rain body) does not mask the carrier tones.
 * 0 dB (transparent) while the binaural beat is off.
 */
export const CARVE_DB = -6;
export const CARVE_Q = 1.4;

export function createCarve(ctx: BaseAudioContext, carrier: number): BiquadFilterNode {
  return new BiquadFilterNode(ctx, { type: 'peaking', frequency: carrier, Q: CARVE_Q, gain: 0 });
}

export function setCarve(filter: BiquadFilterNode, ctx: BaseAudioContext, on: boolean, carrier: number, seconds = 1.5) {
  rampTo(filter.frequency, carrier, seconds, ctx);
  rampTo(filter.gain, on ? CARVE_DB : 0, seconds, ctx);
}
