// Real-time start-up check under a slow CPU: plays each mode in Chromium (4× CPU slowdown, like a
// mid-range phone) and watches for audio rendering falling behind the wall clock and for long
// main-thread tasks.   node scripts/soak.mjs   (SOAK_SECONDS=60 per mode by default)
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const SECONDS = Number(process.env.SOAK_SECONDS ?? 60);
const server = await createServer({ server: { port: 4184, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});

let failed = 0;
for (const [mode, route] of [['focus', '/focus/ready'], ['sleep', '/sleep'], ['relax', '/relax']]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:4184/#${route}`);
  await page.getByText('몰입각').or(page.getByRole('heading')).first().waitFor();
  await page.evaluate((m) => window.__fc.updateSettings((s) => ({ binauralOnByMode: { ...s.binauralOnByMode, [m]: true } })), mode);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__soak = { long: [] };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__soak.long.push({ at: e.startTime, ms: e.duration }))).observe({ type: 'longtask', buffered: false });
  });
  await page.getByRole('button', { name: mode === 'focus' ? '집중 시작' : '▶ 재생', exact: true }).click();
  const t0 = await page.evaluate(() => performance.now());
  const samples = [];
  for (let s = 0; s < SECONDS; s += 2) {
    await page.waitForTimeout(2000);
    samples.push(await page.evaluate(() => { const ctx = window.__fc.audio().ctx; const ts = ctx.getOutputTimestamp(); return { ctx: ts.contextTime, perf: ts.performanceTime, state: ctx.state, beat: window.__fc.audio().isBinauralOn() }; }));
  }
  // Audio clock vs wall clock between samples: a rendering stall shows as the audio clock lagging.
  let worst = 1;
  for (let i = 1; i < samples.length; i++) {
    const dc = samples[i].ctx - samples[i - 1].ctx, dp = (samples[i].perf - samples[i - 1].perf) / 1000;
    if (dp > 0.5) worst = Math.min(worst, dc / dp);
  }
  const long = await page.evaluate((start) => window.__soak.long.filter((l) => l.at > start + 3000), t0);
  const longest = Math.max(0, ...long.map((l) => l.ms));
  const beatAlways = samples.every((s) => s.beat && s.state === 'running');
  const pass = worst > 0.97 && longest < 250 && beatAlways && errors.length === 0;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${mode}: ${SECONDS}s at 4× slower CPU — audio clock ≥ ${(worst * 100).toFixed(1)}% of real time, ` +
    `long tasks after start ${long.length} (longest ${longest.toFixed(0)} ms), beat on throughout ${beatAlways}${errors.length ? ' errors ' + errors.join('; ') : ''}`);
  await page.close();
}
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
