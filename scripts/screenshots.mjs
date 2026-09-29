// Mobile screenshots of the main screens: `npm run build && node scripts/screenshots.mjs`
// Serves dist/ with `vite preview` and captures a 390×844 viewport.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? 'screenshots';
const PORT = 4179;
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('Local') && resolve());
  server.on('exit', (code) => reject(new Error(`vite preview exited (${code})`)));
});

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const routes = (process.env.ROUTES ?? '/,/focus,/focus/ready,/sleep,/relax,/library,/mixer,/binaural,/timer,/stats,/settings,/settings/licenses').split(',');
const full = process.env.FULL === '1';
for (const r of routes) {
  await page.goto(`http://localhost:${PORT}/#${r}`);
  await page.waitForTimeout(900);
  const name = r === '/' ? 'home' : r.slice(1).replace(/\//g, '-');
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
}
await browser.close();
server.removeAllListeners('exit');
server.kill();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`Saved ${routes.length} screenshots to ${OUT}/`);
