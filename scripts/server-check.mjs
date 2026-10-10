// Checks the production web server: app + engine demo + headers.
//   npm run build:site && node scripts/server-check.mjs
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { request } from 'node:http';

const PORT = 4210;
const base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server/index.mjs'], { env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' }, stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('몰입각') && resolve());
  server.on('exit', (c) => reject(new Error(`server exited ${c}`)));
});

let failed = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + JSON.stringify(detail)}`);
};
const head = (path, gzip = true) =>
  new Promise((r) => request({ host: '127.0.0.1', port: PORT, path, method: 'GET', headers: gzip ? { 'Accept-Encoding': 'gzip' } : {} }, (res) => { res.resume(); r({ status: res.statusCode, h: res.headers }); }).end());

// headers
const root = await head('/');
check('/ serves the app HTML, revalidated', root.status === 200 && root.h['content-type'].startsWith('text/html') && root.h['cache-control'] === 'no-cache');
const html = await (await fetch(`${base}/`)).text();
const asset = html.match(/assets\/index-[\w-]+\.js/)[0];
const a = await head('/' + asset);
check('hashed assets: JS type, gzip, cached for a year', a.status === 200 && a.h['content-type'].startsWith('text/javascript') && a.h['content-encoding'] === 'gzip' && a.h['cache-control'].includes('immutable'), a.h);
const eng = await head('/engine/focus-clay-engine.js');
check('engine script served', eng.status === 200 && eng.h['content-type'].startsWith('text/javascript'));
check('/engine redirects to /engine/', (await head('/engine')).status === 301);
check('paths outside dist are refused', (await head('/../package.json')).status !== 200 && (await head('/%2e%2e/package.json')).status !== 200);
check('missing files with an extension → 404', (await head('/nope.js')).status === 404);
check('nosniff header present', root.h['x-content-type-options'] === 'nosniff');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// app
await page.goto(`${base}/`);
await page.getByText('지금 무엇을 할까요?').waitFor();
await page.locator('.goal-card').getByRole('button', { name: /집중하기/ }).click();
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.waitForURL(/#\/focus\/session/);
check('app runs from the server: focus session starts', /\d\d:\d\d/.test(await page.locator('.big-time').innerText()));

// engine demo
await page.goto(`${base}/engine/`);
await page.getByRole('button', { name: '▶ 재생' }).click();
await page.waitForTimeout(2500);
const level = () => page.evaluate(() => { const a = window.focusClayDemo.analyser; if (!a) return 0; const d = new Float32Array(2048); a.getFloatTimeDomainData(d); return Math.max(...d.map(Math.abs)); });
let st = await page.evaluate(() => window.focusClayDemo.state);
check('engine demo plays (10 Hz + rain, signal present)', st.playing && st.beat === 10 && st.sounds.includes('rain_01') && (await level()) > 0.005, { st });
await page.getByLabel('비트 주파수').selectOption('12');
await page.locator('[data-id="noise_pink"]').check();
await page.waitForTimeout(500);
st = await page.evaluate(() => window.focusClayDemo.state);
check('engine demo: change beat and add a noise live', st.beat === 12 && st.sounds.includes('noise_pink'), st);
await page.getByRole('button', { name: '■ 정지' }).click();
await page.waitForTimeout(2000);
check('engine demo: stop fades to silence', !(await page.evaluate(() => window.focusClayDemo.playing)) && (await level()) < 0.001);
const api = await page.evaluate(() => ({ sounds: FocusClay.sounds.length, presets: FocusClay.presets.map((p) => p.hz).join(','), v: FocusClay.version }));
check(`engine API exposes ${api.sounds} sounds and presets ${api.presets}`, api.sounds === 18 && api.presets === '2,4,6,8,10,12,14,18,40', api);

check('no page errors', errors.length === 0, errors);
await browser.close();
server.removeAllListeners('exit');
server.kill();
process.exit(failed ? 1 : 0);
