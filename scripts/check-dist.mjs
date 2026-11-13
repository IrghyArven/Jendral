// Verifies the production build is safe for a GitHub Pages sub-path (https://user.github.io/repo/):
// no root-absolute URLs, and every relative import/link/script resolves to a file inside dist/.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';

const dist = resolve('dist');
const problems = [];
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}
const exists = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

const files = await walk(dist);
for (const f of files) {
  const rel = relative(dist, f);
  if (!/\.(html|js|css)$/.test(f)) continue;
  const text = await readFile(f, 'utf8');
  const refs = [];
  if (f.endsWith('.html')) for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) refs.push(m[1]);
  if (f.endsWith('.js')) for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) refs.push(m[1]);
  if (f.endsWith('.css')) for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)/g)) refs.push(m[1]);
  for (const r of refs) {
    if (/^(data:|https?:|#|mailto:)/.test(r)) continue;
    if (r.startsWith('/')) { problems.push(`${rel}: path absolut "${r}" akan rusak di sub-path GitHub Pages`); continue; }
    if (!(await exists(resolve(dirname(f), r.split(/[?#]/)[0])))) problems.push(`${rel}: referensi "${r}" tidak ditemukan di dist/`);
  }
}
if (!(await exists(join(dist, 'index.html')))) problems.push('dist/index.html tidak ada');
if (!(await exists(join(dist, '.nojekyll')))) problems.push('dist/.nojekyll tidak ada');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`dist OK: ${files.length} berkas, semua referensi relatif dan valid`);
