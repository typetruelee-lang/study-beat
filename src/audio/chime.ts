/** Gentle end-of-timer sounds, synthesised (no loud alarms). Returns the time the sound ends. */
export function playChime(ctx: BaseAudioContext, destination: AudioNode, kind: 'bell' | 'beep'): number {
  const t0 = ctx.currentTime + 0.05;
  if (kind === 'beep') {
    for (const [i, f] of [[0, 880], [1, 1175]] as const) {
      const osc = new OscillatorNode(ctx, { type: 'sine', frequency: f });
      const g = new GainNode(ctx, { gain: 0 });
      const s = t0 + i * 0.22;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.12, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
      osc.connect(g).connect(destination);
      osc.start(s);
      osc.stop(s + 0.2);
    }
    return t0 + 0.5;
  }
  // Soft bell: inharmonic partials with long exponential decay.
  const partials: [number, number, number][] = [
    [528, 0.1, 3.2],
    [528 * 2.0, 0.045, 2.2],
    [528 * 2.76, 0.03, 1.6],
    [528 * 5.4, 0.012, 0.9],
  ];
  for (const [f, amp, decay] of partials) {
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: f });
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(g).connect(destination);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
  return t0 + 3.3;
}
