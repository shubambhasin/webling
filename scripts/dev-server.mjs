// Serves the repo for the dev harness: http://localhost:5180/dev/
// Pass a folder to serve that instead, e.g. the built site: node scripts/dev-server.mjs public
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Shareable roasts are functions on Vercel (rewrites in vercel.json); the same handlers run here.
const ROUTES = [[/^\/r\/([^/]+)\/image\.png$/, 'roast-image'], [/^\/r\/([^/]+)\/?$/, 'roast']];

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  for (const [re, name] of ROUTES) {
    const m = url.pathname.match(re);
    if (!m) continue;
    const { GET } = await import(`../api/${name}.mjs`);
    const fn = new URL(`/api/${name}${url.search}`, url);
    fn.searchParams.set('domain', decodeURIComponent(m[1]));
    const r = await GET(new Request(fn));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return true;
  }
  return false;
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.zip': 'application/zip' };

// Serve `root` on `port` (0 picks a free one). Resolves to { port, close }.
export function serve(root, port = 0) {
  const server = createServer(async (req, res) => {
    if (await route(req, res)) return;
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    port: server.address().port,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
  })));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL(process.argv[2] ? `../${process.argv[2]}/` : '..', import.meta.url));
  const { port } = await serve(root, Number(process.env.PORT) || 5180);
  console.log(`serving ${root} on http://localhost:${port}/`);
}
