// Images for the Apps in Toss console (icon, thumbnails, screenshots) → store-assets/
//   npm run build:web && node scripts/store-assets.mjs
// Serves dist/ (the Toss build) with `vite preview`, captures app screens and lays out promo images.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const OUT = 'store-assets';
const PORT = 4183;
const URL = `http://localhost:${PORT}/`;
mkdirSync(OUT, { recursive: true });

// Sizes from the console guide / community reports. Thumbnails: the guide says 1100×800 but
// uploads have been reported to expect 1932×828, so both are made.
const SIZES = {
  'icon-600.png': [600, 600],
  'thumbnail-1932x828.png': [1932, 828],
  'thumbnail-1100x800.png': [1100, 800],
  'screenshot-1-home.png': [636, 1048],
  'screenshot-2-focus.png': [636, 1048],
  'screenshot-3-sleep.png': [636, 1048],
  'screenshot-4-stats.png': [636, 1048],
  'screenshot-landscape-1504x741.png': [1504, 741],
};

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('Local') && resolve());
  server.on('exit', (code) => reject(new Error(`vite preview exited (${code})`)));
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});

// ── 1. icon
const iconSvg = readFileSync(`${OUT}/src/icon.svg`, 'utf8');
const iconUri = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;
{
  const p = await browser.newPage({ viewport: { width: 600, height: 600 } });
  await p.setContent(`<body style="margin:0">${iconSvg}</body>`);
  await p.screenshot({ path: `${OUT}/icon-600.png` });
  await p.close();
}

// ── 2. app screenshots (318×524 CSS px @2x = 636×1048)
const shots = {};
{
  const p = await browser.newPage({ viewport: { width: 318, height: 524 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL);
  await p.evaluate(() => {
    // A sample week so the home ring and the stats screen have something to show.
    const day = 86400000, now = Date.now(), dow = (new Date().getDay() + 6) % 7;
    const mins = [80, 130, 45, 180, 90, 120, 75];
    const sessions = [];
    for (let d = 0; d <= dow; d++) {
      const start = now - (dow - d) * day - 3 * 3600000;
      sessions.push({ id: 's' + d, mode: 'focus', startedAt: start, endedAt: start + mins[d] * 60000, plannedSeconds: 3000, activeSeconds: mins[d] * 60, focusedSeconds: mins[d] * 60, pausedSeconds: 0, interruptionCount: 0, resumeCount: 0, completed: true, beatFrequency: 10, ambientSound: 'rain_01' });
    }
    localStorage.setItem('focusclay.sessions.v1', JSON.stringify(sessions));
  });
  // Inside Toss the app's own ‹ button is hidden (the native navigation bar has back) — match that.
  const tossLook = () => p.addStyleTag({ content: '.screen-header > :first-child { visibility: hidden; }' });
  const shot = async (name, route) => {
    if (route != null) {
      await p.goto(`${URL}#${route}`);
      await p.reload();
    }
    await tossLook();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `${OUT}/${name}` });
    shots[name] = `data:image/png;base64,${readFileSync(`${OUT}/${name}`).toString('base64')}`;
  };
  await shot('screenshot-1-home.png', '/');
  await shot('screenshot-3-sleep.png', '/sleep');
  await shot('screenshot-4-stats.png', '/stats');
  await p.goto(`${URL}#/focus/ready`);
  await p.reload();
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: '집중 시작', exact: true }).click();
  await p.waitForTimeout(3500);
  await shot('screenshot-2-focus.png', null);
  await p.close();
}

// ── 3. promo layouts
const promo = (w, h, phones) => {
  // Phone height that fits both the frame height and the width left after the copy column.
  const gap = Math.round(h * 0.03);
  const room = w * (1 - 0.3 - 0.12 - 0.04) - gap * (phones.length - 1);
  const ph = Math.round(Math.min(h * 0.84, (room / phones.length) * (1048 / 636)));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${w}px; height: ${h}px; overflow: hidden; font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif;
    background: radial-gradient(70% 90% at 0% 0%, #fff4ea 0%, transparent 60%), linear-gradient(135deg, #f7ede4, #f1dccd);
    display: flex; align-items: center; gap: ${Math.round(w * 0.04)}px; padding: 0 ${Math.round(w * 0.06)}px; color: #1f1b18; }
  .copy { flex: 0 0 ${Math.round(w * 0.3)}px; white-space: nowrap; display: flex; flex-direction: column; gap: ${Math.round(h * 0.03)}px; }
  .icon { width: ${Math.round(h * 0.2)}px; height: ${Math.round(h * 0.2)}px; border-radius: 24%; box-shadow: 0 12px 30px rgba(120,50,20,.25); }
  h1 { font-size: ${Math.round(Math.min(h * 0.14, w * 0.075))}px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
  p { font-size: ${Math.round(Math.min(h * 0.042, w * 0.021))}px; font-weight: 700; color: #6b5a50; line-height: 1.35; }
  .phones { flex: 1; justify-content: center; display: flex; gap: ${gap}px; align-items: center; }
  .phone { height: ${ph}px; border-radius: ${Math.round(h * 0.04)}px; border: ${Math.round(h * 0.012)}px solid #1f1b18;
    box-shadow: 0 20px 50px rgba(60,30,10,.25); background: #fff; }
</style></head><body>
  <div class="copy">
    <img class="icon" src="${iconUri}">
    <h1>몰입각</h1>
    <p>공부할 때 틀어두는 집중 사운드<br>빗소리·계곡물 + 타이머 + 기록</p>
  </div>
  <div class="phones">${phones.map((n) => `<img class="phone" src="${shots[n]}">`).join('')}</div>
</body></html>`;
};

for (const [name, phones] of [
  ['thumbnail-1932x828.png', ['screenshot-1-home.png', 'screenshot-2-focus.png', 'screenshot-3-sleep.png']],
  ['thumbnail-1100x800.png', ['screenshot-1-home.png', 'screenshot-2-focus.png']],
  ['screenshot-landscape-1504x741.png', ['screenshot-1-home.png', 'screenshot-2-focus.png', 'screenshot-4-stats.png']],
]) {
  const [w, h] = SIZES[name];
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.setContent(promo(w, h, phones));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/${name}` });
  await p.close();
}

await browser.close();
server.removeAllListeners('exit');
server.kill();

// ── 4. size check (PNG header: width/height at bytes 16–23)
let bad = 0;
for (const [name, [w, h]] of Object.entries(SIZES)) {
  const b = readFileSync(`${OUT}/${name}`);
  const ok = b.readUInt32BE(16) === w && b.readUInt32BE(20) === h;
  if (!ok) bad++;
  console.log(`${ok ? '✅' : '❌'} ${name}  ${b.readUInt32BE(16)}×${b.readUInt32BE(20)} (필요: ${w}×${h})`);
}
process.exit(bad ? 1 : 0);
