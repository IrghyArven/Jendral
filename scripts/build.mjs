// Prepares the static site into ./dist (used by the GitHub Pages workflow).
import { cp, rm, mkdir, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('src', 'dist/src', { recursive: true });
await writeFile('dist/.nojekyll', '');
console.log('dist/ siap');
