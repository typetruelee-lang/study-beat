// Renders the real audio graph in Chromium with OfflineAudioContext and checks the signal.
//   node scripts/audio-check.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 4180, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
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

  // 2a) isochronic tone: one carrier in both ears, pulsing at the beat rate, click-free
  {
    const { IsochronicTone } = await import('/src/audio/binaural/IsochronicTone.ts');
    for (const beatHz of [6, 10, 14]) {
      const ctx = new OfflineAudioContext(2, SR * 4, SR);
      new IsochronicTone(ctx, ctx.destination, { carrier: 400, beat: beatHz, fadeIn: 0.3 });
      const L = (await ctx.startRendering()).getChannelData(0);
      const hop = SR / 1000, env = [];
      for (let i = SR; i + hop < 3 * SR; i += hop) { let q = 0; for (let j = 0; j < hop; j++) q += L[i + j] ** 2; env.push(Math.sqrt(q / hop)); }
      const m = env.reduce((a, x) => a + x, 0) / env.length;
      const e = env.map((x) => x - m);
      const g = (f) => { const k = 2 * Math.cos((2 * Math.PI * f) / 1000); let s1 = 0, s2 = 0; for (const x of e) { const t = x + k * s1 - s2; s2 = s1; s1 = t; } return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2); };
      const depth = Math.max(...env) / Math.max(1e-6, Math.min(...env));
      check(`isochronic ${beatHz} Hz: envelope pulses at ${beatHz} Hz (depth ${depth.toFixed(0)}×), carrier 400 Hz`, g(beatHz) > 5 * g(beatHz * 0.6) && depth > 10 && goertzel(L, SR, 3 * SR, 400) > 0.02 && maxStep(L) < 0.06, { depth });
    }
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
      // 처마 밑 빗소리: soft rain + occasional drips (the drips are pitched, so less flat than plain rain)
      rain: { bass: 35, hiMin: 3, hiMax: 25, flat: 0.35 },
      softRain: { bass: 35, hiMin: 5, hiMax: 30, flat: 0.5 },
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

  // 3b') 계곡물: smooth flowing water — no sharp pops or bubbles (low crest factor, no isolated peaks)
  {
    const { startSynth } = await import('/src/audio/ambient/synths.ts');
    const ctx = new OfflineAudioContext(2, SR * 20, SR);
    startSynth(ctx, 'stream', ctx.destination);
    const d = (await ctx.startRendering()).getChannelData(0);
    let peak = 0, sq = 0, n = 0;
    for (let i = 2 * SR; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); sq += d[i] * d[i]; n++; }
    const crest = peak / Math.sqrt(sq / n);
    // 5 ms windows: a bubble/pop is a window far louder than its neighbours
    const w = SR / 200, e = [];
    for (let i = 2 * SR; i + w < d.length; i += w) { let q = 0; for (let j = 0; j < w; j++) q += d[i + j] ** 2; e.push(Math.sqrt(q / w)); }
    let pops = 0;
    for (let i = 10; i < e.length - 10; i++) { let m = 0; for (let j = i - 10; j <= i + 10; j++) if (j !== i) m += e[j]; if (e[i] > 2.5 * (m / 20)) pops++; }
    check(`stream (계곡물): crest ${crest.toFixed(1)}, pops ${pops} in 18 s — smooth flow, no bubbles`, crest < 6 && pops <= 2, { crest, pops });
  }

  // 3b) START-UP, every mode: the beat settles within 3 s and then holds steady (no dips/pumping)
  for (const [mode, beat] of [['focus', 10], ['sleep', 2], ['relax', 6]]) {
    const [L, R] = await renderEngine(20, (e) => {
      e.startBinauralBeat({ beat, carrier: 400 });
      for (const t of DEFAULT_TRACKS[mode]) e.playTrack(SOUNDS.find((x) => x.id === t.id), t.volume);
    });
    const lv = [], rv = [];
    for (let t = 3; t < 20; t++) { lv.push(goertzel(L, t * SR, (t + 1) * SR, 400)); rv.push(goertzel(R, t * SR, (t + 1) * SR, 400 + beat)); }
    const spread = (v) => 20 * Math.log10(Math.max(...v) / Math.min(...v));
    const sl = spread(lv), sr = spread(rv);
    check(`start-up ${mode}: beat level steady from 3 s to 20 s (L ±${sl.toFixed(2)} dB, R ±${sr.toFixed(2)} dB)`, sl < 1 && sr < 1, { lv, rv });
  }

  // 3c) SCREEN-OFF LOOP FILE: every mode's default mix and every recipe, rendered as the app does
  {
    const { RECIPES } = await import('/src/sounds/recipes.ts');
    const { encodeWav, LOOP_SECONDS } = await import('/src/audio/backgroundTrack.ts');
    const mixes = [
      ...[['focus', 10], ['sleep', 2], ['relax', 6]].map(([mode, beat]) => ({ name: `default ${mode}`, beat, tracks: DEFAULT_TRACKS[mode], intensity: 0.35 })),
      ...RECIPES.map((r) => ({ name: r.id, beat: r.beat, tracks: r.tracks, intensity: r.intensity })),
    ];
    const g = (d, sr, a, b, f) => {
      const k = 2 * Math.cos((2 * Math.PI * f) / sr);
      let s1 = 0, s2 = 0;
      for (let i = a; i < b; i++) { const v = d[i] + k * s1 - s2; s2 = s1; s1 = v; }
      return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2) / (b - a);
    };
    const bad = [];
    let checked = 0;
    for (const m of mixes) {
      const e = new WebAudioEngine(createTrack, () => new OfflineAudioContext(2, SR, SR));
      e.setBusVolume('binaural', m.intensity);
      if (m.beat !== null) e.startBinauralBeat({ beat: m.beat, carrier: 400 });
      for (const t of m.tracks) e.playTrack(SOUNDS.find((x) => x.id === t.id), t.volume);
      const loop = await e.renderLoopAudio();
      const { left: L, right: R, sampleRate: sr } = loop;
      const n = L.length;
      const problems = [];
      if (n !== LOOP_SECONDS * sr) problems.push('length');
      let peak = 0, nan = false, maxStep = 0;
      for (let i = 0; i < n; i++) {
        if (Number.isNaN(L[i]) || Number.isNaN(R[i])) nan = true;
        peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
        if (i) maxStep = Math.max(maxStep, Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1]));
      }
      const seam = Math.max(Math.abs(L[0] - L[n - 1]), Math.abs(R[0] - R[n - 1]));
      if (nan || peak >= 1) problems.push(`peak ${peak.toFixed(2)}`);
      if (seam > maxStep * 1.05 + 1e-4) problems.push(`seam ${seam.toFixed(4)} > step ${maxStep.toFixed(4)}`);
      if (m.beat !== null) {
        const rHz = 400 + m.beat;
        // Stereo kept: each ear has its own tone (a mono path would put both in both ears).
        const lOwn = g(L, sr, 5 * sr, 6 * sr, 400), lOther = g(L, sr, 5 * sr, 6 * sr, rHz);
        const rOwn = g(R, sr, 5 * sr, 6 * sr, rHz), rOther = g(R, sr, 5 * sr, 6 * sr, 400);
        if (!(lOwn > 10 * lOther && rOwn > 10 * rOther)) problems.push(`stereo L ${(lOwn / lOther).toFixed(1)}× R ${(rOwn / rOther).toFixed(1)}×`);
        // Beat level steady across the whole loop, including the seam second.
        const lv = [];
        for (let t = 0; t < LOOP_SECONDS; t++) lv.push(g(L, sr, t * sr, (t + 1) * sr, 400));
        const spread = 20 * Math.log10(Math.max(...lv) / Math.min(...lv));
        if (spread > 1) problems.push(`beat level ±${spread.toFixed(2)} dB`);
        // Across the seam: last half second + first half second as one continuous tone.
        const half = sr / 2, joined = new Float32Array(sr);
        joined.set(L.subarray(n - half), 0); joined.set(L.subarray(0, half), half);
        const across = g(joined, sr, 0, sr, 400), inside = g(L, sr, 10 * sr, 11 * sr, 400);
        if (Math.abs(20 * Math.log10(across / inside)) > 1) problems.push(`seam tone ${(20 * Math.log10(across / inside)).toFixed(2)} dB`);
      }
      // The WAV file itself decodes back to the same stereo signal.
      const wav = encodeWav(loop);
      const dec = await new OfflineAudioContext(2, 1, sr).decodeAudioData(wav.slice(0));
      if (dec.numberOfChannels !== 2 || dec.length !== n) problems.push(`wav ${dec.numberOfChannels}ch ${dec.length}`);
      else if (m.beat !== null && !(g(dec.getChannelData(1), sr, 5 * sr, 6 * sr, 400 + m.beat) > 10 * g(dec.getChannelData(1), sr, 5 * sr, 6 * sr, 400))) problems.push('wav right ear');
      if (problems.length) bad.push({ mix: m.name, problems });
      checked++;
    }
    check(`screen-off loop file: ${checked} mixes — stereo per ear, steady beat, seamless 30 s loop, valid WAV`, bad.length === 0, bad);
  }

  // 3d) SCREEN-OFF STREAM: FLAC frames decode sample-exactly, and the stream repeats without the
  //     ≈0.1 s pause that <audio loop> leaves at every repeat (recorded from the element itself).
  {
    const { flacFile, LoopStream, streamSupported } = await import('/src/audio/backgroundStream.ts');
    const { encodeWav } = await import('/src/audio/backgroundTrack.ts');
    const sr = 32000, n = sr * 2;
    const tone = { left: new Float32Array(n), right: new Float32Array(n), sampleRate: sr };
    for (let i = 0; i < n; i++) { tone.left[i] = Math.sin(2 * Math.PI * 400 * i / sr) * 0.4; tone.right[i] = Math.sin(2 * Math.PI * 410 * i / sr) * 0.4; }
    const dec = await new OfflineAudioContext(2, 1, sr).decodeAudioData(flacFile(tone).buffer);
    let maxErr = 0;
    for (const [c, src] of [[0, tone.left], [1, tone.right]]) { const d = dec.getChannelData(c); for (let i = 0; i < n; i++) maxErr = Math.max(maxErr, Math.abs(d[i] - Math.round(src[i] * 0x7fff) / 0x8000)); }
    check(`stream encoding: FLAC frames decode back to the same stereo samples (max error ${maxErr.toExponential(1)})`, dec.length === n && dec.numberOfChannels === 2 && maxErr < 1e-4, { length: dec.length, maxErr });

    const record = async (setup) => {
      const el = new Audio();
      const cleanup = setup(el);
      await el.play();
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(el.captureStream());
      const proc = ctx.createScriptProcessor(1024, 2, 2);
      const L = [], R = [];
      proc.onaudioprocess = (e) => { L.push(Float32Array.from(e.inputBuffer.getChannelData(0))); R.push(Float32Array.from(e.inputBuffer.getChannelData(1))); };
      src.connect(proc); proc.connect(ctx.destination);
      await new Promise((r) => setTimeout(r, 7000));
      el.pause(); cleanup?.(); await ctx.close();
      const join = (fs) => { const a = new Float32Array(fs.reduce((x, f) => x + f.length, 0)); let o = 0; for (const f of fs) { a.set(f, o); o += f.length; } return a; };
      const l = join(L), r = join(R), rate = ctx.sampleRate;
      // Ignore the first 0.5 s after the signal appears: the capture itself warms up there.
      const gaps = []; let run = 0, first = -1;
      for (let i = 0; i < l.length; i++) { const a = Math.abs(l[i]); if (a > 0.05 && first < 0) first = i; if (first < 0 || i < first + rate / 2) continue; if (a < 0.01) run++; else { if (run > rate * 0.002) gaps.push(Math.round(run / rate * 1000)); run = 0; } }
      const g = (d, f, a, b) => { const k = 2 * Math.cos(2 * Math.PI * f / rate); let s1 = 0, s2 = 0; for (let i = a; i < b; i++) { const v = d[i] + k * s1 - s2; s2 = s1; s1 = v; } return Math.sqrt(s1 * s1 + s2 * s2 - k * s1 * s2) / (b - a); };
      // Each ear's own tone vs the other ear's (a mono path gives ≈1×), as the median over
      // half-second windows: the captureStream + ScriptProcessor recording itself is a little rough.
      const med = (v) => v.sort((x, y) => x - y)[Math.floor(v.length / 2)];
      const lrs = [], rrs = [];
      for (let t = first / rate + 0.5; t + 0.5 < l.length / rate; t += 0.5) {
        const a = Math.floor(t * rate), b = Math.floor((t + 0.5) * rate);
        lrs.push(g(l, 400, a, b) / g(l, 410, a, b));
        rrs.push(g(r, 410, a, b) / g(r, 400, a, b));
      }
      const lr = med(lrs), rr = med(rrs);
      return { gaps, lr: Math.round(lr), rr: Math.round(rr), stereo: lr > 10 && rr > 10 };
    };
    const wav = await record((el) => { el.loop = true; el.src = URL.createObjectURL(new Blob([encodeWav(tone)], { type: 'audio/wav' })); });
    check(`<audio loop> WAV (old way) pauses at every repeat: ${wav.gaps.length} gaps of ${wav.gaps.join('/')} ms in 7 s`, wav.gaps.length >= 2, wav);
    if (streamSupported()) {
      let s;
      const st = await record((el) => { s = new LoopStream(el, tone); el.src = s.url; return () => s.dispose(); });
      check(`gapless stream: ${st.gaps.length} gaps in 7 s (3 repeats of a 2 s loop), each ear keeps its own tone (L ${st.lr}× · R ${st.rr}×)`, st.gaps.length === 0 && st.stereo, st);
    } else {
      check('gapless stream supported in this browser (MSE audio/mp4 flac)', false, {});
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
