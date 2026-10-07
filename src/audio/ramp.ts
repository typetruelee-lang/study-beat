/**
 * Click-free parameter changes. Every level/frequency change in the engine goes through here:
 * hold the current value, then ramp linearly to the target.
 */
export function rampTo(param: AudioParam, value: number, seconds: number, ctx: BaseAudioContext, delay = 0) {
  const start = ctx.currentTime + delay;
  if (typeof param.cancelAndHoldAtTime === 'function') {
    // Freezes a ramp in progress exactly where it is at `start` (reading param.value can lag a
    // render quantum or, in some engines, return the last set value → a jump).
    param.cancelAndHoldAtTime(start);
  } else {
    const current = param.value;
    param.cancelScheduledValues(start);
    param.setValueAtTime(current, start);
  }
  if (seconds <= 0) param.setValueAtTime(value, start);
  else param.linearRampToValueAtTime(value, start + seconds);
}

/** Slider position (0…1) → gain. Squared so the slider feels even to the ear. */
export function sliderToGain(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c * c;
}

/** Right-ear frequency for a binaural beat: carrier + beat (e.g. 400 + 10 = 410 Hz). */
export function rightEarFrequency(carrier: number, beat: number): number {
  return carrier + beat;
}
