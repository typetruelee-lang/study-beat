// 앱인토스 제출 전 자동 점검:  npm run build && npm run check:toss
// Every line prints ✅ or ❌ with what to do. Exit code 1 if anything fails.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_ID = 'molip-gak';
const APP_NAME = '몰입각';
let failed = 0;
const check = (ok, label, fix) => {
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : `\n   → ${fix}`}`);
};
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const walk = (dir, re) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((f) => {
        const p = join(dir, f);
        return statSync(p).isDirectory() ? walk(p, re) : re.test(f) ? [p] : [];
      })
    : [];

console.log('앱인토스 제출 전 점검\n');

// 1. 설정
const config = read('apps-in-toss.config.ts');
check(new RegExp(`appName:\\s*'${APP_ID}'`).test(config), `앱 ID(appName)가 '${APP_ID}'`, `apps-in-toss.config.ts의 appName을 콘솔에 등록한 ID와 똑같이 맞추세요.`);
check(/navigationBar:\s*{[^}]*withBackButton:\s*true/s.test(config), '토스 내비게이션 바 사용(뒤로가기 버튼 포함)', 'apps-in-toss.config.ts에 navigationBar 설정이 있어야 해요.');

// 2. 빌드 결과
const html = read('dist/index.html');
check(html !== '', 'dist/ 빌드가 있음', '먼저 npm run build 를 실행하세요.');
const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
check(title === APP_NAME, `화면 제목(index.html title)이 '${APP_NAME}' (콘솔 앱 이름과 같아야 함)`, `지금 제목: '${title}'. 웹용 빌드(build:site)가 아니라 npm run build 로 다시 빌드하세요.`);
const viewport = html.match(/name="viewport" content="([^"]*)"/)?.[1] ?? '';
check(/user-scalable=no/.test(viewport) && /maximum-scale=1/.test(viewport), '두 손가락 확대(핀치 줌) 막힘', 'index.html viewport에 maximum-scale=1, user-scalable=no 가 있어야 해요.');

const js = walk('dist/assets', /\.js$/).map((p) => read(p)).join('\n');
check(js.length > 0 && !/\beval\(|new Function\(/.test(js), '외부 코드 실행(eval·new Function) 없음', '번들에 eval 이 들어갔어요. Claude에게 알려주세요.');
check(!/googlesyndication|adsbygoogle/.test(js), '구글 광고 코드가 토스판에 없음', '웹용 빌드가 섞였어요. npm run build 로 다시 빌드하세요.');
check(/adaptiveGrey|tds-mobile|TDSMobile/.test(js), 'TDS(토스 디자인 시스템) 포함', '@toss/tds-mobile 이 빠졌어요. npm install 후 다시 빌드하세요.');

// 3. 번들 파일
const ait = `${APP_ID}.ait`;
const aitOk = existsSync(ait);
check(aitOk, `${ait} 파일 있음`, 'npm run build 를 끝까지 실행하세요(마지막에 "앱인토스 빌드가 완료되었습니다" 가 나와야 해요).');
if (aitOk) {
  const mb = statSync(ait).size / 1024 / 1024;
  check(mb < 100, `${ait} 크기 ${mb.toFixed(1)}MB (100MB 이하)`, '파일이 너무 커요.');
  check(statSync(ait).mtimeMs >= statSync('dist/index.html').mtimeMs - 60_000, `${ait}이 최신 빌드`, 'npm run build 를 다시 실행하세요.');
}

// 4. 디자인 기준
const tokens = read('src/design/tokens.css');
const sleepBg = tokens.match(/\.theme-sleep\s*{[^}]*--bg:\s*(#[0-9a-f]{6})/i)?.[1] ?? '#000000';
const lum = ((n) => (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255)(parseInt(sleepBg.slice(1), 16));
check(lum > 0.8, `수면 화면도 밝은 색(라이트 모드) — ${sleepBg}`, '비게임 미니앱은 라이트 모드여야 해요. tokens.css의 .theme-sleep --bg 를 밝게.');

// 5. 문구
const FORBIDDEN = /치료|뇌파가|ADHD|불면증|의학적 효과|차단|잠금/;
const hits = walk('src', /\.tsx?$/)
  .filter((p) => !p.endsWith('.test.ts') && !p.endsWith('.test.tsx'))
  .flatMap((p) => read(p).split('\n').map((l, i) => [p, i + 1, l]))
  .filter(([, , l]) => FORBIDDEN.test(l) && !/^\s*(\/\/|\*)/.test(l));
check(hits.length === 0, '의료·차단 표현 없음(치료·뇌파가·ADHD·불면증·차단·잠금)', hits.map(([p, n, l]) => `${p}:${n} ${l.trim()}`).join('\n     '));

// 6. 콘솔 등록 이미지
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
for (const [name, [w, h]] of Object.entries(SIZES)) {
  const p = `store-assets/${name}`;
  const b = existsSync(p) ? readFileSync(p) : null;
  check(b && b.readUInt32BE(16) === w && b.readUInt32BE(20) === h, `이미지 ${name} (${w}×${h})`, 'node scripts/store-assets.mjs 로 다시 만드세요.');
}

console.log(failed ? `\n❌ ${failed}개 항목을 고친 뒤 다시 실행하세요.` : '\n✅ 모두 통과! 다음 단계(샌드박스 업로드)로 넘어가세요.');
process.exit(failed ? 1 : 0);
