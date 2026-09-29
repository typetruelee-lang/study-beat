// Renders the real audio graph in Chromium with OfflineAudioContext and checks the signal.
//   node scripts/audio-check.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 4180, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('http://localhost:4180/');

const results = await page.evaluate(async () => {
  const out = [];
  const check = (name, pass, detail) => out.push({ name, pass, detail });
  const SR = 48000;

  function goertzel(data, from, to, freq) {
    const k = (2 * Math.cos((2 * Math.PI * freq) / SR));
    let s1 = 0, s2 = 0;
    for (let i = from; i < to; i++) { const s = data[i] + k * s1 - s2; s2 = s1; s1 = s; }
    return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2) / (to - from);
  }
  const rms = (d, a, b) => { let s = 0; for (let i = a; i < b; i++) s += d[i] * d[i]; return Math.sqrt(s / (b - a)); };
  const maxStep = (d) => { let m = 0; for (let i = 1; i < d.length; i++) m = Math.max(m, Math.abs(d[i] - d[i - 1])); return m; };

  const { BinauralBeat } = await import('/src/audio/binaural/BinauralBeat.ts');

  // 1) 10 Hz beat: L 400 / R 410, fade-in, then change to 12 Hz at t=4s
  {
    const ctx = new OfflineAudioContext(2, SR * 7.5, SR);
    const beat = new BinauralBeat(ctx, ctx.destination, { carrier: 400, beat: 10, fadeIn: 2 });
    ctx.suspend(4).then(() => { beat.setBeat(12, 2); ctx.resume(); });
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const a = 2.5 * SR, b = 3.5 * SR;
    const l400 = goertzel(L, a, b, 400), l410 = goertzel(L, a, b, 410);
    const r410 = goertzel(R, a, b, 410), r400 = goertzel(R, a, b, 400);
    check('left ear carries 400 Hz', l400 > 20 * l410, { l400, l410 });
    check('right ear carries 410 Hz (10 Hz beat)', r410 > 20 * r400, { r410, r400 });
    const c = 6 * SR, d = 7 * SR; // 1 s window → spectral nulls at integer Hz
    check('after setBeat(12): right ear at 412 Hz', goertzel(R, c, d, 412) > 10 * goertzel(R, c, d, 410), {});
    check('left ear unchanged at 400 Hz', goertzel(L, c, d, 400) > 10 * goertzel(L, c, d, 412), {});
    const early = rms(L, 0, 0.05 * SR), steady = rms(L, 2.5 * SR, 3 * SR);
    check('fade-in starts from near silence', early < steady * 0.1, { early, steady });
    const limit = (2 * Math.PI * 415 * 0.3) / SR * 1.2;
    const stepL = maxStep(L), stepR = maxStep(R);
    check('no clicks (max sample step within a pure sine bound)', stepL < limit && stepR < limit, { stepL, stepR, limit });
  }

  // 2) stop() fades out to silence
  {
    const ctx = new OfflineAudioContext(2, SR * 4, SR);
    const beat = new BinauralBeat(ctx, ctx.destination, { carrier: 400, beat: 10, fadeIn: 0.5 });
    ctx.suspend(2).then(() => { beat.stop(1); ctx.resume(); });
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0);
    check('stop() fades to silence', rms(L, 3.2 * SR, 3.9 * SR) < 1e-4 && maxStep(L) < 0.05, { tail: rms(L, 3.2 * SR, 3.9 * SR) });
  }

  // 3) every procedural recipe renders sane levels (no NaN, no clipping, audible)
  {
    const { startSynth, SYNTH_IDS } = await import('/src/audio/ambient/synths.ts');
    for (const id of SYNTH_IDS) {
      const ctx = new OfflineAudioContext(2, SR * 4, SR);
      const t0 = performance.now();
      startSynth(ctx, id, ctx.destination);
      const build = performance.now() - t0;
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      let peak = 0, nan = false;
      for (let i = 0; i < L.length; i++) {
        if (Number.isNaN(L[i]) || Number.isNaN(R[i])) nan = true;
        peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      }
      const level = Math.max(rms(L, SR, 4 * SR), rms(R, SR, 4 * SR));
      check(`synth ${id}: rms ${level.toFixed(3)} peak ${peak.toFixed(2)} build ${build.toFixed(0)}ms`, !nan && peak < 1.5 && level > 0.01 && level < 0.6 && build < 300, { nan, peak, level, build });
    }
  }

  // 4) noise colours: white brighter than pink brighter than brown (rendered through Web Audio)
  {
    const { noiseBuffer } = await import('/src/audio/ambient/buffers.ts');
    const { brightness } = await import('/src/audio/noise/generators.ts');
    const ctx = new OfflineAudioContext(2, SR, SR);
    const [w, p, b] = ['white', 'pink', 'brown'].map((c) => brightness(noiseBuffer(ctx, c).getChannelData(0)));
    check('noise slope white > pink > brown', w > p && p > b, { w, p, b });
    const nb = noiseBuffer(ctx, 'brown').getChannelData(0);
    const seam = Math.abs(nb[0] - nb[nb.length - 1]);
    check('brown noise loop seam has no jump', seam < 0.05, { seam });
  }
  return out;
});

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  ' + JSON.stringify(r.detail)}`);
}
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
