// Main-thread cost of the idle UI (animations only, no audio): `npm run build && node scripts/perf.mjs`
// Reports TaskDuration per second of wall time (≈ main-thread utilisation) and JS heap.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const PORT = 4183;
const SECONDS = Number(process.env.SECONDS ?? 8);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('Local') && resolve());
  server.on('exit', (code) => reject(new Error(`vite preview exited (${code})`)));
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

const scenarios = [
  ['home (top)', '/', null],
  ['home (scrolled to cards)', '/', 900],
  ['focus setup', '/focus', null],
  ['sleep', '/sleep', null],
  ['stats', '/stats', null],
  ['focus session (audio on)', '/focus/ready', 'start'],
];
if (process.env.REDUCE === '1') {
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(() => localStorage.setItem('focusclay.settings.v1', JSON.stringify({ reduceMotion: true })));
}
const rows = [];
for (const [name, route, scroll] of scenarios) {
  await page.goto(`http://localhost:${PORT}/#${route}`);
  await page.reload();
  await page.waitForTimeout(1500);
  if (scroll === 'start') {
    await page.getByRole('button', { name: '집중 시작', exact: true }).click();
    await page.waitForTimeout(3000);
  } else if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.waitForTimeout(500);
  const a = await metric();
  await page.waitForTimeout(SECONDS * 1000);
  const b = await metric();
  rows.push({
    scenario: name,
    'main thread %': (((b.TaskDuration - a.TaskDuration) / SECONDS) * 100).toFixed(1),
    'style+layout ms/s': ((((b.RecalcStyleDuration - a.RecalcStyleDuration) + (b.LayoutDuration - a.LayoutDuration)) / SECONDS) * 1000).toFixed(1),
    'script ms/s': (((b.ScriptDuration - a.ScriptDuration) / SECONDS) * 1000).toFixed(1),
    'heap MB': (b.JSHeapUsedSize / 1048576).toFixed(1),
    nodes: b.Nodes,
  });
}
console.table(rows);
await browser.close();
server.removeAllListeners('exit');
server.kill();
