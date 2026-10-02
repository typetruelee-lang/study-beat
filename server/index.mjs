// FOCUS CLAY web server — no dependencies (Node ≥ 18).
//   npm run build:site && npm run serve      → http://localhost:8080/ (app), /engine/ (engine + demo)
// Serves dist/ as static files with correct types, gzip, and cache headers:
// hashed assets are immutable for a year, HTML is always revalidated.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt']);

/** Map a URL path to a file inside dist/, never outside it. */
function resolveFile(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  const full = resolve(ROOT, '.' + normalize('/' + p));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  if (existsSync(full) && statSync(full).isDirectory()) {
    const index = join(full, 'index.html');
    return existsSync(index) ? index : null;
  }
  return existsSync(full) ? full : null;
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const url = req.url ?? '/';
  if (url === '/engine') {
    res.writeHead(301, { Location: '/engine/' }).end();
    return;
  }
  // Unknown paths fall back to the app (it uses hash routing, so this is only a safety net).
  const file = resolveFile(url) ?? (extname(url.split('?')[0]) ? null : join(ROOT, 'index.html'));
  if (!file || !existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  const ext = extname(file);
  const hashed = /[.-][A-Za-z0-9_-]{8,}\.(js|css|mjs)$/.test(file) && file.includes(`${sep}assets${sep}`);
  const headers = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    Vary: 'Accept-Encoding',
  };
  const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (gzip) headers['Content-Encoding'] = 'gzip';
  else headers['Content-Length'] = statSync(file).size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(file);
  stream.on('error', () => res.destroy());
  (gzip ? stream.pipe(createGzip()) : stream).pipe(res);
});

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error('dist/ is missing — run `npm run build:site` first.');
  process.exit(1);
}
server.listen(PORT, HOST, () => {
  console.log(`FOCUS CLAY: http://localhost:${PORT}/  ·  engine demo: http://localhost:${PORT}/engine/`);
});
