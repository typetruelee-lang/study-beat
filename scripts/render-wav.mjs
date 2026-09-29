// Render procedural sounds to WAV for listening:  node scripts/render-wav.mjs <outDir> rain softRain ...
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const [outDir = 'renders', ...ids] = process.argv.slice(2);
const SECONDS = Number(process.env.SECONDS ?? 12);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ server: { port: 4191, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('http://localhost:4191/');
for (const id of ids.length ? ids : ['rain']) {
  const b64 = await page.evaluate(async ({ id, seconds }) => {
    const SR = 44100;
    const { startSynth } = await import('/src/audio/ambient/synths.ts');
    const ctx = new OfflineAudioContext(2, SR * seconds, SR);
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.linearRampToValueAtTime(0.8, 1.5); // same kind of fade-in as the app
    g.connect(ctx.destination);
    startSynth(ctx, id, g);
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1);
    const n = L.length, bytes = new DataView(new ArrayBuffer(44 + n * 4));
    const w = (o, s) => [...s].forEach((c, i) => bytes.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); bytes.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); bytes.setUint32(16, 16, true);
    bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true); bytes.setUint32(24, SR, true); bytes.setUint32(28, SR * 4, true);
    bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true); w(36, 'data'); bytes.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      bytes.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      bytes.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    let s = ''; const u = new Uint8Array(bytes.buffer);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  }, { id, seconds: SECONDS });
  writeFileSync(`${outDir}/${id}.wav`, Buffer.from(b64, 'base64'));
  console.log(`wrote ${outDir}/${id}.wav`);
}
await browser.close();
await server.close();
