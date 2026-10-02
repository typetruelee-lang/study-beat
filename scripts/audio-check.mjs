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

  // 2b) δ 2 Hz and γ 40 Hz presets: exact per-ear frequencies
  for (const beatHz of [2, 40]) {
    const ctx = new OfflineAudioContext(2, SR * 4, SR);
    new BinauralBeat(ctx, ctx.destination, { carrier: 400, beat: beatHz, fadeIn: 0.5 });
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const a = 2 * SR, b = 4 * SR; // 2 s window → nulls every 0.5 Hz
    const rHz = 400 + beatHz;
    check(`${beatHz} Hz beat: L 400 Hz / R ${rHz} Hz`, goertzel(L, a, b, 400) > 20 * goertzel(L, a, b, rHz) && goertzel(R, a, b, rHz) > 20 * goertzel(R, a, b, 400), {});
  }

  // 2c) carve filter cuts ~6 dB at the carrier and leaves other frequencies alone
  {
    const { createCarve, setCarve } = await import('/src/audio/carve.ts');
    const { noiseBuffer } = await import('/src/audio/ambient/buffers.ts');
    const render = async (carveOn) => {
      const ctx = new OfflineAudioContext(1, SR * 4, SR);
      const src = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx, 'pink'), loop: true });
      const f = createCarve(ctx, 400);
      setCarve(f, ctx, carveOn, 400, 0);
      src.connect(f).connect(ctx.destination);
      src.start(0, 0);
      return (await ctx.startRendering()).getChannelData(0);
    };
    const on = await render(true), off = await render(false);
    const bandPower = (d, lo, hi) => { let p = 0; for (let f = lo; f <= hi; f += 1) p += goertzel(d, SR, 4 * SR, f) ** 2; return p; };
    const atCarrier = 10 * Math.log10(bandPower(on, 395, 405) / bandPower(off, 395, 405));
    const far = 10 * Math.log10(bandPower(on, 1995, 2005) / bandPower(off, 1995, 2005));
    check(`carve: ${atCarrier.toFixed(1)} dB at 400 Hz, ${far.toFixed(1)} dB at 2 kHz`, atCarrier < -4.5 && atCarrier > -7.5 && Math.abs(far) < 1, { atCarrier, far });
  }

  // 3) every procedural recipe: loudness at its normalised target, no NaN/clipping, cheap to build
  {
    const { startSynth, SYNTH_IDS, TARGET_DB } = await import('/src/audio/ambient/synths.ts');
    for (const id of SYNTH_IDS) {
      const ctx = new OfflineAudioContext(2, SR * 16, SR);
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
      const db = 20 * Math.log10(Math.sqrt((rms(L, 2 * SR, L.length) ** 2 + rms(R, 2 * SR, R.length) ** 2) / 2));
      const target = TARGET_DB(id);
      check(`synth ${id}: ${db.toFixed(1)} dBFS (target ${target}) peak ${peak.toFixed(2)} build ${build.toFixed(0)}ms`, !nan && peak < 1.5 && Math.abs(db - target) <= 2.5 && build < 300, { nan, peak, db, build });
    }
  }

  // 3a) FULL ENGINE, every sound: real start sequence (track fade-in 2 s + master fade-in),
  //     buses, carve, compressor. Checks: starts from silence, no dropouts, no clipping, sane level.
  const { WebAudioEngine } = await import('/src/audio/AudioEngine.ts');
  const { createTrack } = await import('/src/audio/ambient/createTrack.ts');
  const { SOUNDS, DEFAULT_TRACKS } = await import('/src/sounds/catalog.ts');
  const { TARGET_DB } = await import('/src/audio/ambient/synths.ts');
  const renderEngine = async (seconds, setup) => {
    const ctx = new OfflineAudioContext(2, SR * seconds, SR);
    const e = new WebAudioEngine(createTrack, () => ctx);
    await e.unlock();
    setup(e);
    e.fadeIn(2);
    const buf = await ctx.startRendering();
    return [buf.getChannelData(0), buf.getChannelData(1)];
  };
  const dropouts = (L, R, from) => {
    let run = 0, n = 0;
    for (let i = from; i < L.length; i++) {
      if (Math.abs(L[i]) < 1e-5 && Math.abs(R[i]) < 1e-5) { run++; if (run === 240) n++; } else run = 0;
    }
    return n; // silent gaps ≥ 5 ms
  };
  const audit = (L, R) => {
    let peak = 0, nan = false;
    for (let i = 0; i < L.length; i++) { if (Number.isNaN(L[i]) || Number.isNaN(R[i])) nan = true; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
    const start = Math.max(rms(L, 0, 0.05 * SR), rms(R, 0, 0.05 * SR));
    const steady = Math.max(rms(L, 3 * SR, L.length), rms(R, 3 * SR, R.length));
    return { peak, nan, start, steady, gaps: dropouts(L, R, 2.5 * SR) };
  };
  {
    const bad = [];
    const levels = [];
    for (const meta of SOUNDS) {
      const [L, R] = await renderEngine(14, (e) => e.playTrack(meta, meta.volume));
      const a = audit(L, R);
      // Compare after removing each sound's intended offset (sparse/bright sounds sit lower on purpose).
      const db = 20 * Math.log10(a.steady) - (TARGET_DB(meta.synth) + 16);
      levels.push({ id: meta.id, bus: meta.bus, db });
      const ok = !a.nan && a.peak < 1 && a.gaps === 0 && a.start < a.steady * 0.05 && db > -60;
      if (!ok) bad.push({ id: meta.id, ...a });
    }
    check(`engine: all ${SOUNDS.length} sounds start from silence, no gaps, no clipping, audible`, bad.length === 0, bad);
    // At default settings, sounds of the same kind play at a similar level.
    for (const [bus, tol] of [['ambient', 4], ['noise', 3]]) {
      const g = levels.filter((l) => l.bus === bus).sort((a, b) => a.db - b.db);
      const med = g[Math.floor(g.length / 2)].db;
      const off = g.filter((l) => Math.abs(l.db - med) > tol);
      check(`engine: ${bus} sounds balanced at default volume (offset-corrected median ${med.toFixed(1)} dBFS, all within ±${tol} dB; range ${g[0].db.toFixed(1)}…${g.at(-1).db.toFixed(1)})`, off.length === 0, off);
    }
  }
  for (const [mode, beat] of [['focus', 10], ['sleep', 2], ['relax', 6]]) {
    const [L, R] = await renderEngine(10, (e) => {
      e.startBinauralBeat({ beat, carrier: 400 });
      for (const t of DEFAULT_TRACKS[mode]) e.playTrack(SOUNDS.find((x) => x.id === t.id), t.volume);
    });
    const a = audit(L, R);
    const a0 = 6 * SR, a1 = 10 * SR; // 4 s window
    const lTone = goertzel(L, a0, a1, 400), lSide = (goertzel(L, a0, a1, 395) + goertzel(L, a0, a1, 405)) / 2;
    const rTone = goertzel(R, a0, a1, 400 + beat), rSide = (goertzel(R, a0, a1, 395 + beat) + goertzel(R, a0, a1, 405 + beat)) / 2;
    check(`engine: ${mode} mix + ${beat} Hz beat — L 400 Hz ${ (lTone / lSide).toFixed(0) }× / R ${400 + beat} Hz ${(rTone / rSide).toFixed(0)}× above the bed, peak ${a.peak.toFixed(2)}, gaps ${a.gaps}`,
      !a.nan && a.peak < 1 && a.gaps === 0 && a.start < a.steady * 0.05 && lTone > 3 * lSide && rTone > 3 * rSide, a);
  }

  // 3a') every generated buffer loops seamlessly (wrap step no larger than the buffer's own steps)
  {
    const { allSoundData } = await import('/src/audio/ambient/buffers.ts');
    const bad = [];
    for (const [key, d] of allSoundData()) {
      for (const c of d.channels) {
        let maxStep = 0, nan = false, peak = 0;
        for (let i = 1; i < c.length; i++) { const st = Math.abs(c[i] - c[i - 1]); if (st > maxStep) maxStep = st; if (Number.isNaN(c[i])) nan = true; peak = Math.max(peak, Math.abs(c[i])); }
        const seam = Math.abs(c[0] - c[c.length - 1]);
        if (nan || seam > maxStep * 1.05 + 1e-6 || peak > 4) bad.push({ key, seam, maxStep, peak, nan });
      }
    }
    check(`all ${allSoundData().length} generated buffers: seamless loop joins, no NaN`, bad.length === 0, bad);
  }

  // 3a'') every preset × every carrier: exact per-ear frequency, no crosstalk; switching is click-free
  {
    const { BEAT_PRESETS, CARRIER_OPTIONS } = await import('/src/app/beats.ts');
    const bad = [];
    for (const carrier of CARRIER_OPTIONS) for (const { hz } of BEAT_PRESETS) {
      const ctx = new OfflineAudioContext(2, SR * 3, SR);
      new BinauralBeat(ctx, ctx.destination, { carrier, beat: hz, fadeIn: 0.3 });
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      const a = 1 * SR, b = 3 * SR; // 2 s → nulls every 0.5 Hz
      const lOk = goertzel(L, a, b, carrier) > 20 * goertzel(L, a, b, carrier + hz);
      const rOk = goertzel(R, a, b, carrier + hz) > 20 * goertzel(R, a, b, carrier);
      if (!lOk || !rOk) bad.push({ carrier, hz });
    }
    check(`binaural: all ${BEAT_PRESETS.length} presets × ${CARRIER_OPTIONS.length} carriers exact per ear (≥ 26 dB separation)`, bad.length === 0, bad);
    const jumps = [];
    for (const [from, to] of [[10, 12], [2, 40], [40, 2], [8, 18]]) {
      const ctx = new OfflineAudioContext(2, SR * 5, SR);
      const bb = new BinauralBeat(ctx, ctx.destination, { carrier: 400, beat: from, fadeIn: 0.5 });
      ctx.suspend(2).then(() => { bb.setBeat(to, 2); bb.setBeat(to); ctx.resume(); }); // second call is redundant: must not restart
      const buf = await ctx.startRendering();
      const limit = ((2 * Math.PI * 445 * 0.3) / SR) * 1.2;
      const st = Math.max(maxStep(buf.getChannelData(0)), maxStep(buf.getChannelData(1)));
      if (st > limit) jumps.push({ from, to, st, limit });
    }
    check('binaural: preset switches glide without clicks', jumps.length === 0, jumps);
  }

  // 3b) rain character: not boomy, not muffled, noise-like (no pitched pings), no audible loop
  {
    const { startSynth } = await import('/src/audio/ambient/synths.ts');
    const N = 8192;
    const fft = (re, im) => { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } } for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s2 = Math.sin(a * k); const h = i + k + len / 2; const vr = re[h] * c - im[h] * s2, vi = re[h] * s2 + im[h] * c; re[h] = re[i + k] - vr; im[h] = im[i + k] - vi; re[i + k] += vr; im[i + k] += vi; } } };
    const targets = {
      rain: { bass: 20, hiMin: 12, hiMax: 30, flat: 0.8 },
      softRain: { bass: 35, hiMin: 5, hiMax: 30, flat: 0.5 },
      windowRain: { bass: 30, hiMin: 6, hiMax: 30, flat: 0.5 },
    };
    for (const [id, t] of Object.entries(targets)) {
      const ctx = new OfflineAudioContext(2, SR * 26, SR);
      startSynth(ctx, id, ctx.destination);
      const d = (await ctx.startRendering()).getChannelData(0);
      const spec = new Float64Array(N / 2);
      for (let off = SR; off + N < d.length; off += N) {
        const re = new Float64Array(N), im = new Float64Array(N);
        for (let i = 0; i < N; i++) re[i] = d[off + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
        fft(re, im);
        for (let k = 0; k < N / 2; k++) spec[k] += re[k] ** 2 + im[k] ** 2;
      }
      const bin = (f) => Math.round((f / SR) * N);
      const band = (lo, hi) => { let x = 0; for (let k = bin(lo); k < bin(hi); k++) x += spec[k]; return x; };
      const tot = band(20, 20000);
      const bass = (100 * band(20, 250)) / tot, hi = (100 * band(4000, 20000)) / tot;
      let lg = 0, ar = 0, n = 0;
      for (let k = bin(1000); k < bin(8000); k++) { lg += Math.log(spec[k] + 1e-20); ar += spec[k]; n++; }
      const flat = Math.exp(lg / n) / (ar / n);
      // loop repetition: 10 ms RMS envelope autocorrelation at every layer's loop length
      const hop = SR / 100, env = [];
      for (let i = SR; i + hop < d.length; i += hop) { let q = 0; for (let j = 0; j < hop; j++) q += d[i + j] ** 2; env.push(Math.sqrt(q / hop)); }
      // Detrend with a 0.5 s moving average so slow, intended intensity drift is ignored and only
      // fine-texture repetition (a loop replaying) is measured.
      const e = env.map((x, i) => { let a = 0, c = 0; for (let j = Math.max(0, i - 25); j < Math.min(env.length, i + 25); j++) { a += env[j]; c++; } return x - a / c; });
      const ac = (lag) => { let a = 0, q = 0; for (let i = 0; i + lag < e.length; i++) { a += e[i] * e[i + lag]; q += e[i] ** 2; } return a / q; };
      const rep = Math.max(ac(600), ac(679), ac(730), ac(785), ac(800), ac(872), ac(1110), ac(1194));
      const pass = bass < t.bass && hi >= t.hiMin && hi <= t.hiMax && flat >= t.flat && rep < 0.1;
      check(`rain ${id}: bass ${bass.toFixed(1)}% · 4k+ ${hi.toFixed(1)}% · flatness ${flat.toFixed(2)} · loop repeat ${rep.toFixed(2)}`, pass, { t });
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
