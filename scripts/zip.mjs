// Packs extension/ into dist/webling-<version>.zip for the Chrome Web Store. Run: npm run zip
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(`${root}extension/manifest.json`, 'utf8'));

for (const f of [...manifest.content_scripts[0].js, manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons)]) {
  if (!existsSync(`${root}extension/${f}`)) throw new Error(`manifest points at a missing file: ${f}`);
}
if (/localhost/.test(readFileSync(`${root}extension/shared/config.js`, 'utf8'))) {
  console.warn('warning: shared/config.js still points presence at localhost');
}

mkdirSync(`${root}dist`, { recursive: true });
const out = `${root}dist/webling-${manifest.version}.zip`;
rmSync(out, { force: true });
execFileSync('zip', ['-qr', out, '.', '-x', '.*'], { cwd: `${root}extension`, stdio: 'inherit' });
console.log(out);
