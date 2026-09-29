// Builds a single self-contained HTML file (CSS + JS inlined, in-memory routing) for a
// desktop/browser preview:  node scripts/build-preview.mjs [out.html]
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? 'dist-preview/focus-clay.html';
execSync('npx vite build --outDir dist-preview/app --emptyOutDir', { stdio: 'inherit', env: { ...process.env, VITE_ROUTER: 'memory' } });
const dir = 'dist-preview/app';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'));
const js = [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)].map((m) => readFileSync(join(dir, m[1]), 'utf8'));
const page = `<title>FOCUS CLAY</title>
<style>${css.join('\n')}
html, body { background: #f6efe6; }</style>
<div id="root"></div>
<script type="module">${js.join('\n').replace(/<\/script/gi, '<\\/script')}</script>
`;
writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
