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
await page.getByText('몰입각').first().waitFor();

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
check('sound keeps playing while away (only the record pauses)', s.player.playing === true, s.player);
await page.clock.fastForward('03:00');
await setVisible(true);
await page.clock.runFor(600);
await page.getByText('집중 기록이 잠시 멈췄어요').waitFor();
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
await page.getByRole('button', { name: '홈으로', exact: true }).click();
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
check('sleep keeps running when screen is off', s.session.status === 'running' && s.player.playing);
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
await page.evaluate(() => window.__fc.updateSettings((st) => ({ focusTimer: { ...st.focusTimer, kind: 'countdown', seconds: 1000, routineId: null }, autoFrequency: true })));
await page.goto('http://localhost:4182/#/focus/ready');
await page.clock.runFor(600);
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

// ── navigation: every sub-screen reaches home in one tap
const onHome = async () => (await page.evaluate(() => location.hash)) === '#/' && (await page.getByText('지금 무엇을 할까요?').isVisible());
const subRoutes = ['/focus', '/focus/ready', '/focus/result', '/sleep', '/relax', '/mixer', '/binaural', '/timer', '/settings/licenses', '/now'];
const noHome = [];
for (const r of subRoutes) {
  await page.goto(`http://localhost:4182/#${r}`);
  await page.clock.runFor(300);
  await page.locator('.screen-header').getByRole('button', { name: '홈으로', exact: true }).click();
  await page.clock.runFor(300);
  if (!(await onHome())) noHome.push(r);
}
check('every sub-screen has a one-tap home button', noHome.length === 0, noHome);

// back button returns to the previous step
await page.goto('http://localhost:4182/#/');
await page.clock.runFor(300);
await page.getByRole('button', { name: /집중 \/ 공부/ }).click();
await page.getByRole('button', { name: /타이머 설정/ }).click();
await page.getByRole('button', { name: '뒤로 가기' }).click();
await page.clock.runFor(300);
check('back returns to the previous step (timer → focus)', (await page.evaluate(() => location.hash)) === '#/focus');

// leaving a running focus session keeps it running, mini player brings you back
await page.getByRole('button', { name: '▶ 집중 시작' }).click();
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.clock.runFor(1000);
await page.getByRole('button', { name: '뒤로 가기' }).click();
await page.clock.runFor(1000);
s = await state();
check('back from focus session goes home and the session keeps running', (await onHome()) && s.session?.status === 'running');
await page.clock.fastForward('02:00');
await page.clock.runFor(600);
check('time keeps recording while on another screen', Math.round((await state()).session.focusedMs / 60000) === 2);
await page.locator('.mini').click();
await page.clock.runFor(300);
await page.getByRole('button', { name: '모드 화면' }).click();
await page.clock.runFor(300);
check('mini player → now playing → back to the focus session', (await page.evaluate(() => location.hash)) === '#/focus/session');
await page.getByRole('button', { name: '■ 종료' }).click();
await page.getByRole('button', { name: '종료하고 기록하기' }).click();
await page.clock.runFor(2000);

// ── home: adjust today's goal directly
await page.goto('http://localhost:4182/#/');
await page.clock.runFor(300);
const goal0 = (await state()).settings.dailyGoalMinutes;
await page.getByRole('button', { name: '목표 30분 늘리기' }).click();
check('home + raises the goal by 30 min', (await state()).settings.dailyGoalMinutes === goal0 + 30);
await page.getByRole('button', { name: '목표 30분 줄이기' }).click();
await page.getByRole('button', { name: '목표 바꾸기' }).click();
await page.getByRole('radio', { name: '1시간', exact: true }).click();
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '10분 늘리기' }).click();
await page.getByRole('button', { name: /1시간 30분로 저장/ }).click();
await page.clock.runFor(500);
check('goal sheet sets 1시간 30분 on the home card', (await page.locator('.goal-card').innerText()).includes('/ 1시간 30분'));
await page.reload();
await page.clock.runFor(1200);
check('goal persists after reload', (await state()).settings.dailyGoalMinutes === 90);

// ── screen controls during a focus session
await page.goto('http://localhost:4182/#/focus/ready');
await page.clock.runFor(300);
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.clock.runFor(1500);
const waitLoop = async () => {
  for (let i = 0; i < 80; i++) {
    await page.clock.runFor(150);
    await new Promise((r) => setTimeout(r, 100)); // offline render runs in real time
    if (await page.evaluate(() => { const d = window.__fc.audio().diagnostics(); return d.loopReady && d.loopUpToDate; })) return true;
  }
  return false;
};
check('while the app is visible, output goes straight to the speakers (most stable path)', (await page.evaluate(() => window.__fc.audio().outputRoute)) === 'direct');
check('screen-off loop of the current mix is rendered and waits muted (a file, not a MediaStream)', (await waitLoop()) && (await page.evaluate(() => { const el = window.__fc.audio().bgEl; return !!el && !el.paused && el.muted && el.src.startsWith('blob:') && !el.srcObject; })));
await setVisible(false);
await page.clock.runFor(300);
check('screen off / app hidden: the loop file takes over (unmuted), live output fades out', await page.evaluate(() => { const a = window.__fc.audio(); return a.outputRoute === 'background' && !a.bgEl.muted && !a.bgEl.paused; }));
await page.clock.runFor(600);
await new Promise((r) => setTimeout(r, 200));
check('only one copy plays: the live graph is paused while the loop file is the output', (await page.evaluate(() => window.__fc.audio().ctx.state)) === 'suspended');
await setVisible(true);
await page.clock.runFor(600);
await new Promise((r) => setTimeout(r, 200));
check('back in the app: output returns to direct, live graph running, file muted', await page.evaluate(() => { const a = window.__fc.audio(); return a.outputRoute === 'direct' && a.bgEl.muted && a.ctx.state === 'running'; }));
await page.getByRole('button', { name: '집중 계속하기' }).click();
await page.clock.runFor(300);
await page.getByRole('button', { name: '화면 설정' }).click();
await page.getByRole('slider', { name: '화면 밝기' }).fill('0.5');
await page.clock.runFor(300);
const dim = await page.getByTestId('dim-overlay').evaluate((el) => Number(el.style.opacity));
check('brightness 50% dims the app screen by half', Math.abs(dim - 0.5) < 0.01, dim);
await page.getByRole('button', { name: '검은 화면으로 두기' }).click();
await page.clock.runFor(300);
check('black screen is shown', await page.locator('.curtain').isVisible());
const f0 = (await state()).session.focusedMs;
await page.clock.fastForward('02:00');
await page.clock.runFor(1200);
s = await state();
check('focus keeps recording and sound keeps playing under the black screen', s.session.focusedMs - f0 >= 119_000 && s.player.playing, s.session.focusedMs - f0);
await page.locator('.curtain').dblclick();
await page.clock.runFor(300);
check('double tap leaves the black screen', !(await page.locator('.curtain').isVisible()));
await page.getByRole('button', { name: '화면 설정' }).click();
await page.getByRole('radio', { name: '1분' }).click();
await page.keyboard.press('Escape');
await page.clock.runFor(300);
await page.clock.fastForward('01:05');
await page.clock.runFor(600);
check('auto black screen after 1 idle minute', await page.locator('.curtain').isVisible());
await page.locator('.curtain').dblclick();
await page.getByRole('button', { name: '■ 종료' }).click();
await page.getByRole('button', { name: '종료하고 기록하기' }).click();
await page.clock.runFor(2000);

// ── ready screen from the home goal card: options, and every choice is saved
await page.goto('http://localhost:4182/#/');
await page.clock.runFor(400);
await page.locator('.goal-card').getByRole('button', { name: /집중하기/ }).click();
await page.clock.runFor(300);
await page.getByRole('radio', { name: '50분' }).click();
await page.getByRole('button', { name: '카페', exact: true }).click();
await page.getByRole('button', { name: /켜짐 · \d+Hz/ }).click(); // focus sound off
await page.clock.runFor(300);
const readyText = await page.locator('.ready').innerText();
check('ready screen: time, background sound and focus sound can be changed there', readyText.includes('50분 집중') && readyText.includes('카페') && !readyText.includes('집중 사운드'), readyText);
await page.getByRole('button', { name: /소리 섞기/ }).click();
await page.clock.runFor(300);
await page.getByRole('slider', { name: '전체 볼륨' }).fill('0.4');
await page.getByRole('button', { name: '뒤로 가기' }).click();
await page.clock.runFor(300);
check('mixer → back returns to the ready screen', (await page.evaluate(() => location.hash)) === '#/focus/ready');
await page.reload();
await page.clock.runFor(1500);
s = await state();
check(
  'choices are saved and restored after reopening (50 min, 카페, focus sound off, volume 40%)',
  s.settings.focusTimer.seconds === 3000 && s.settings.tracksByMode.focus[0].id === 'cafe_01' && s.settings.binauralOnByMode.focus === false && s.settings.masterVolume === 0.4,
  { timer: s.settings.focusTimer, tracks: s.settings.tracksByMode.focus, binaural: s.settings.binauralOnByMode, master: s.settings.masterVolume },
);
check('restored choices show on the ready screen', (await page.locator('.ready').innerText()).includes('50분 집중'));
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.clock.runFor(1200);
s = await state();
check('session starts with the chosen options', s.session?.phases[0].seconds === 3000 && s.player.tracks[0].id === 'cafe_01' && !s.player.binauralOn, { phases: s.session?.phases, tracks: s.player.tracks, binaural: s.player.binauralOn });
await page.getByRole('button', { name: /소리 바꾸기/ }).click();
await page.getByRole('dialog', { name: '소리 바꾸기' }).getByRole('button', { name: '창가의 비', exact: true }).click();
await page.clock.runFor(600);
s = await state();
check('in-session sound change applies, is saved and recording continues', s.player.tracks[0].id === 'rain_01' && s.settings.tracksByMode.focus[0].id === 'rain_01' && s.session.status === 'running');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: '■ 종료' }).click();
await page.getByRole('button', { name: '종료하고 기록하기' }).click();
await page.clock.runFor(2000);

// ── Anima-inspired additions: recipes, intensity, speaker mode, favorites
await page.goto('http://localhost:4182/#/');
await page.clock.runFor(500);
await page.getByRole('button', { name: /^카페 몰입/ }).click();
await page.clock.runFor(400);
s = await state();
check('home recipe "카페 몰입" loads its mix and opens the ready screen', (await page.evaluate(() => location.hash)) === '#/focus/ready' && s.player.tracks.map((t) => t.id).join(',') === 'cafe_01,noise_pink' && s.player.binauralOn && s.player.beat === 12, s.player);
await page.getByRole('radio', { name: /스피커용/ }).first().click();
await page.getByRole('slider', { name: '강도' }).fill('0.5');
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.clock.runFor(1200);
s = await state();
check('speaker mode plays an isochronic tone; intensity sets the beat level', (await page.evaluate(() => window.__fc.audio().beatKind())) === 'isochronic' && s.settings.busVolumes.binaural === 0.5);
await page.getByRole('button', { name: /소리 바꾸기/ }).click();
await page.getByRole('dialog', { name: '소리 바꾸기' }).getByRole('radio', { name: /이어폰용/ }).click();
await page.clock.runFor(600);
check('switching back to headphone mode swaps the tone live', (await page.evaluate(() => window.__fc.audio().beatKind())) === 'binaural');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: '■ 종료' }).click();
await page.getByRole('button', { name: '종료하고 기록하기' }).click();
await page.clock.runFor(2000);
await page.goto('http://localhost:4182/#/mixer');
await page.clock.runFor(400);
await page.getByRole('button', { name: '⭐ 이 믹스 저장' }).click();
await page.getByRole('textbox', { name: '믹스 이름' }).fill('시험기간 카페');
await page.getByRole('button', { name: '저장', exact: true }).click();
await page.clock.runFor(400);
await page.evaluate(() => window.__fc.updateSettings((st) => ({ tracksByMode: { ...st.tracksByMode, focus: [{ id: 'rain_01', volume: 0.55 }] } })));
await page.goto('http://localhost:4182/#/library');
await page.reload();
await page.clock.runFor(1200);
await page.getByRole('button', { name: /^⭐ 시험기간 카페/ }).click();
await page.clock.runFor(400);
s = await state();
check('favorite mix is saved, survives reload and loads with one tap', s.settings.favorites.length === 1 && s.player.tracks[0].id === 'cafe_01' && (await page.evaluate(() => location.hash)) === '#/focus/ready', { fav: s.settings.favorites, tracks: s.player.tracks });

// ── The beat holds until the set time, screen on or off (25 min focus, sped up with the fake clock)
await page.evaluate(() => window.__fc.updateSettings((st) => ({ awayDetection: false, autoFrequency: false, focusTimer: { ...st.focusTimer, kind: 'countdown', seconds: 25 * 60, routineId: null } })));
await page.goto('http://localhost:4182/#/focus/ready');
await page.clock.runFor(400);
await page.getByRole('button', { name: '집중 시작', exact: true }).click();
await page.clock.runFor(1500);
await waitLoop();
const beatState = () => page.evaluate(() => { const a = window.__fc.audio(); const d = a.diagnostics(); return { on: a.isBinauralOn(), hz: d.beat?.hz, tracks: a.activeTrackIds().length, route: a.outputRoute }; });
const seen = [];
for (let m = 1; m <= 24; m++) {
  if (m === 3) await setVisible(false); // screen off for 15 minutes
  if (m === 18) await setVisible(true);
  await page.clock.runFor(60_000);
  seen.push(await beatState());
}
const lastMinute = seen.at(-1);
check('25 min focus: beat stays on at 10 Hz with the sounds every minute (screen off 3–18 min)', seen.every((b) => b.on && b.hz === 10 && b.tracks > 0), seen.filter((b) => !b.on || b.hz !== 10));
check('screen-off minutes play from the loop file, screen-on minutes from the live output', seen.slice(2, 17).every((b) => b.route === 'background') && lastMinute.route === 'direct', seen.map((b) => b.route));
await page.clock.runFor(70_000);
s = await state();
check('at the set time the session ends and the loop element stops', !s.session && (await page.evaluate(() => window.__fc.audio().bgEl.paused)), { session: s.session?.status });

// ── Stop, then start again right away (within the stop fade): nothing is torn down afterwards
await page.goto('http://localhost:4182/#/mixer');
await page.clock.runFor(400);
await page.evaluate(() => window.__fc.play());
await page.clock.runFor(2500);
await page.evaluate(() => { void window.__fc.stopPlayback(); setTimeout(() => void window.__fc.play(), 300); });
await page.clock.runFor(4000);
check('stop then play within the fade: beat and sounds keep playing', await page.evaluate(() => { const a = window.__fc.audio(); return a.isBinauralOn() && a.activeTrackIds().length > 0 && window.__fc.getState().player.playing; }));
await page.evaluate(() => window.__fc.stopPlayback());
await page.clock.runFor(2000);

// ── Watchdog: if the beat goes missing mid-session it comes back within ~2 s
await page.evaluate(() => window.__fc.startSession('focus'));
await page.clock.runFor(2000);
await page.evaluate(() => window.__fc.audio().stopBinauralBeat(0.05));
await page.clock.runFor(2600);
check('watchdog restores a missing beat during a session', await page.evaluate(() => { const a = window.__fc.audio(); return a.isBinauralOn() && a.diagnostics().recoveries >= 1; }));
await page.goto('http://localhost:4182/#/settings/audio');
await page.clock.runFor(1200);
check('소리 진단 screen shows the route and the recovery', (await page.getByText('직접 출력').count()) > 0 && (await page.getByText(/자동 복구: 비트/).count()) > 0);
await page.evaluate(() => window.__fc.endSessionEarly());
await page.clock.runFor(2000);

// ── Apps in Toss review rules that a browser can check
await page.goto('http://localhost:4182/#/sleep');
await page.clock.runFor(600);
const sleepBg = await page.evaluate(() => getComputedStyle(document.querySelector('.app-root')).backgroundColor);
const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
check('sleep screen is light (non-game mini-apps must use light mode)', lum(sleepBg) > 0.8, sleepBg);
const viewport = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
check('pinch zoom is off', /user-scalable=no/.test(viewport) && /maximum-scale=1/.test(viewport), viewport);
await page.goto('http://localhost:4182/sleep');
await page.clock.runFor(800);
check('deep link path /sleep opens the sleep screen', (await page.evaluate(() => location.hash)) === '#/sleep', await page.evaluate(() => location.href));
check('page title is the app name', (await page.title()) === '몰입각', await page.title());

check('no page errors', errors.length === 0, errors);
await browser.close();
await server.close();
process.exit(failed ? 1 : 0);
