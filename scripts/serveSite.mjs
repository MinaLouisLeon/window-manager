// Serves site/ (built by `npm run site:build`) on http://localhost:4173 for a local look at the
// registry site. Node built-ins only, no dependency. Port: PORT=5000 npm run site
//
// Usage: node scripts/serveSite.mjs

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** The file for a URL path: folders serve their index.html; null outside site/ or missing. */
async function resolveFile(urlPath) {
  let path;
  try {
    path = resolve(root, `.${decodeURIComponent(urlPath)}`);
  } catch {
    return null;
  }
  if (path !== root && !path.startsWith(root + sep)) return null;
  try {
    const info = await stat(path);
    if (info.isFile()) return path;
    if (info.isDirectory()) {
      const index = join(path, 'index.html');
      if ((await stat(index)).isFile()) return index;
    }
  } catch {
    // Missing: 404 below.
  }
  return null;
}

try {
  await stat(join(root, 'index.html'));
} catch {
  console.error('serveSite: site/index.html is missing. Run `npm run site:build` first.');
  process.exit(1);
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  // Folders without a trailing slash: redirect, so relative links on the page resolve.
  const file = await resolveFile(pathname);
  if (
    file?.endsWith(`${sep}index.html`) &&
    !pathname.endsWith('/') &&
    !pathname.endsWith('.html')
  ) {
    response.writeHead(301, { location: `${pathname}/` }).end();
    return;
  }
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  response.writeHead(200, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`Registry site: http://localhost:${port}/  (Ctrl+C to stop)`);
});
