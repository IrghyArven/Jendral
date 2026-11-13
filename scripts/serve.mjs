// Minimal static server. ES modules do not load from file://.
//   npm start                              -> serves the source tree at http://localhost:8080/
//   DIR=dist BASE=/jenderal/ npm start     -> serves ./dist under a sub-path, like GitHub Pages project sites
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const root = resolve(repo, process.env.DIR || '.');
let base = process.env.BASE || '/';
if (!base.startsWith('/')) base = '/' + base;
if (!base.endsWith('/')) base += '/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT) || 8080;

export const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (base !== '/' && p === base.slice(0, -1)) { res.writeHead(301, { Location: base }).end(); return; }
    if (!p.startsWith(base)) { res.writeHead(404).end('Not found'); return; }
    p = '/' + p.slice(base.length);
    if (p === '/') p = '/index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root) || !/^\/(index\.html|src\/)/.test(p)) { res.writeHead(404).end('Not found'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(data);
  } catch { res.writeHead(404).end('Not found'); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, () => console.log(`JENDERAL berjalan di http://localhost:${port}${base}`));
}
