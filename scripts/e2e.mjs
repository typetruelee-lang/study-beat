// End-to-end check of the core loop in Chromium (mobile viewport, fake clock).
//   node scripts/e2e.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 4182, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

let failed = 0;
const check = (name, pass, detail = '') => {
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${pass ? '' : '  ' + JSON.stringify(detail)}`);
};
const state = () => page.evaluate(() => window.__fc.getState());
const setVisible = (visible) =>
  page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { value: v ? 'visible' : 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: !v, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);

await page.clock.install({ time: new Date(2026, 8, 30, 14, 0, 0) });
await page.goto('http://localhost:4182/');
await page.clock.runFor(1000);
await page.getByText('FOCUS CLAY').first().waitFor();

// ── Home → focus in two taps
let taps = 0;
await page.getByRole('button', { name: /25분 집중하기/ }).click(); taps++;
await page.getByRole('button', { name: '집중 시작', exact: true }).click(); taps++;
await page.waitForURL(/#\/focus\/session/);
check('home → focus session in 2 taps', taps === 2);
await page.clock.runFor(1500);
let s = await state();
check('session running in focus mode', s.session?.status === 'running' && s.session.mode === 'focus', s.session?.status);
check('player playing with rain + binaural 10 Hz', s.player.playing && s.player.binauralOn && s.player.beat === 10 && s.player.tracks[0].id === 'rain_01', s.player);
const ctxState = await page.evaluate(() => (window.AudioContext ? 'ok' : 'none'));
check('Web Audio available', ctxState === 'ok');
check('big timer shows ~25:00', /2[45]:\d\d/.test(await page.locator('.big-time').innerText()));

// ── 10 minutes of focus, then leave the app for 3 minutes
await page.clock.fastForward('10:00');
await page.clock.runFor(600);
await setVisible(false);
await page.clock.runFor(500);
s = await state();
check('leaving the app pauses the session (집중 이탈 감지)', s.session.status === 'paused' && s.session.pauseReason === 'away' && s.session.interruptionCount === 1, s.session);
await page.clock.fastForward('03:00');
await setVisible(true);
await page.clock.runFor(600);
await page.getByText('집중 세션이 잠시 멈췄어요').waitFor();
check('return shows the continue sheet', true);
await page.getByRole('button', { name: '집중 계속하기' }).click();
await page.clock.runFor(600);
s = await state();
check('continue resumes running', s.session.status === 'running' && s.session.resumeCount === 1);
const focusedMin = Math.round(s.session.focusedMs / 60000);
check('away time not counted (~10 min recorded so far)', focusedMin === 10, focusedMin);

// ── finish the remaining 15 minutes
await page.clock.fastForward('15:05');
await page.clock.runFor(1500);
await page.waitForURL(/#\/focus\/result/);
await page.getByText('집중 완료!').waitFor();
s = await state();
const rec = s.sessions.at(-1);
check('record: 25 min focus, 3 min paused, 1 interruption', rec.focusedSeconds === 1500 && rec.pausedSeconds >= 180 && rec.interruptionCount === 1 && rec.completed, rec);
check('record stored locally', (await page.evaluate(() => JSON.parse(localStorage.getItem('focusclay.sessions.v1')).length)) === 1);
check('result shows today total', (await page.locator('.card').first().innerText()).includes('25분'));
await page.clock.runFor(4000);
s = await state();
check('audio stopped after completion', !s.player.playing && !s.session, s.player);

// ── stats + home reflect the record
await page.getByRole('button', { name: '홈으로' }).click();
await page.clock.runFor(300);
check('home goal card shows 25분', (await page.locator('.goal-card').innerText()).includes('25분'));
await page.getByRole('link', { name: /기록/ }).click();
await page.clock.runFor(300);
const statsText = await page.locator('.screen').innerText();
check('stats: today 25분 and 1 session', statsText.includes('25분') && statsText.includes('1회'));
check('stats never uses judgemental words', !/실패|집중력 부족/.test(statsText));

// ── sleep: play, timer runs out, audio stops, not counted as focus
await page.goto('http://localhost:4182/#/sleep');
await page.clock.runFor(300);
await page.getByRole('radio', { name: '15분' }).click();
await page.getByRole('button', { name: '▶ 재생' }).click();
await page.clock.runFor(1000);
s = await state();
check('sleep session running', s.session?.mode === 'sleep' && s.player.playing);
await setVisible(false);
await page.clock.runFor(500);
s = await state();
check('sleep keeps running when screen is off', s.session.status === 'running');
await page.clock.fastForward('15:05');
await setVisible(true);
await page.clock.runFor(3000);
s = await state();
check('sleep timer ends and stops audio', !s.session && !s.player.playing, s.session);
check('sleep time not counted as focus', s.sessions.filter((x) => x.mode === 'focus').reduce((a, x) => a + x.focusedSeconds, 0) === 1500);

// ── custom timer (시·분·초) and count-up
await page.goto('http://localhost:4182/#/timer');
await page.clock.runFor(300);
await page.getByRole('textbox', { name: '시간', exact: true }).fill('1');
await page.getByRole('textbox', { name: '분', exact: true }).fill('12');
await page.getByRole('button', { name: /1:12:00로 설정/ }).click();
await page.goto('http://localhost:4182/#/focus');
await page.clock.runFor(300);
check('custom 72-minute timer shows on focus screen', (await page.locator('.big-time').innerText()) === '1:12:00');
await page.goto('http://localhost:4182/#/timer');
await page.clock.runFor(300);
await page.getByRole('radio', { name: '카운트업' }).click();
await page.goto('http://localhost:4182/#/focus');
await page.clock.runFor(300);
check('count-up starts from 00:00', (await page.locator('.big-time').innerText()) === '00:00');

// ── WebView closed mid-session: recorded time up to the last snapshot is kept
await page.getByRole('button', { name: '▶ 집중 시작' }).click();
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.clock.runFor(1000);
for (let i = 0; i < 20; i++) await page.clock.runFor(15_500); // ~5 min, snapshots every 15 s
await page.reload();
await page.clock.runFor(1200);
s = await state();
const recovered = s.sessions.at(-1);
check('interrupted session recovered after reload (~5 min kept)', recovered.mode === 'focus' && !recovered.completed && recovered.focusedSeconds >= 270 && recovered.focusedSeconds <= 320, recovered);
check('settings persist across reload (count-up kept)', s.settings.focusTimer.kind === 'countup');

// ── auto frequency: 8 Hz at start → base → base+2 → base
await page.evaluate(() => {
  const k = 'focusclay.settings.v1';
  const st = JSON.parse(localStorage.getItem(k));
  st.focusTimer = { ...st.focusTimer, kind: 'countdown', seconds: 1000, routineId: null };
  st.autoFrequency = true;
  localStorage.setItem(k, JSON.stringify(st));
});
await page.goto('http://localhost:4182/#/focus/ready');
await page.reload();
await page.clock.runFor(1200);
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.clock.runFor(1000);
const beats = [(await state()).player.beat];
for (const sec of [300, 400]) { await page.clock.fastForward(sec * 1000); await page.clock.runFor(600); beats.push((await state()).player.beat); }
await page.clock.fastForward(250_000); await page.clock.runFor(600); beats.push((await state()).player.beat);
check('auto frequency follows 8 → 10 → 12 → 10 Hz', beats.join(',') === '8,10,12,10', beats);
await page.clock.fastForward(60_000); await page.clock.runFor(2000);

// ── delete records
await page.goto('http://localhost:4182/#/settings');
await page.clock.runFor(300);
await page.getByRole('button', { name: '집중 기록 삭제' }).click();
await page.getByRole('button', { name: '삭제하기' }).click();
await page.clock.runFor(300);
s = await state();
check('records deleted (state + storage)', s.sessions.length === 0 && (await page.evaluate(() => localStorage.getItem('focusclay.sessions.v1'))) === null);

check('no page errors', errors.length === 0, errors);
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
