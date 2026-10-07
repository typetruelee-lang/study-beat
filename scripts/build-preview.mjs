// Builds a single self-contained HTML file (CSS + JS inlined, in-memory routing) for a
// desktop/browser preview:  node scripts/build-preview.mjs [out.html] [mode]
// mode: omitted = Toss clay skin, `web` = web aura skin (.env.web)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist-preview/focus-clay.html';
const mode = process.argv[3];
execSync(`npx vite build --outDir dist-preview/app --emptyOutDir${mode ? ` --mode ${mode}` : ''}`, { stdio: 'inherit', env: { ...process.env, VITE_ROUTER: 'memory', VITE_TDS: 'off' } });
const dir = 'dist-preview/app';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'));
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'));
const page = `<title>${mode === 'web' ? '몰입각 Web' : '몰입각'}</title>
<style>${css.join('\n')}
html, body { background: ${mode === 'web' ? '#07080f' : '#f5f2ee'}; }</style>
<div id="root"></div>
<script>
  // Show start-up errors on screen (a blank preview on a phone has no console to look at).
  const showError = (msg) => { const d = document.createElement('pre'); d.style.cssText = 'white-space:pre-wrap;padding:16px;margin:16px;background:#fff3f0;color:#7a1f00;font:13px/1.4 monospace;border-radius:12px'; d.textContent = '미리보기 오류: ' + msg; document.body.prepend(d); };
  addEventListener('error', (e) => showError(e.message + (e.filename ? ' @' + e.lineno + ':' + e.colno : '')));
  addEventListener('unhandledrejection', (e) => showError(String(e.reason && (e.reason.stack || e.reason))));
  setTimeout(() => { if (!document.getElementById('root').children.length) showError('6초가 지나도 화면이 그려지지 않았어요.'); }, 6000);
</script>
<script type="module">${js.join('\n').replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
