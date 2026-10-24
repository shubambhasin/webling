// Packs extension/ into dist/webling-<version>.zip for the Chrome Web Store. Run: npm run zip
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zipDir } from './zipfile.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const ext = `${root}extension`;

export function checkExtension() {
  const manifest = JSON.parse(readFileSync(`${ext}/manifest.json`, 'utf8'));
  for (const f of [...manifest.content_scripts[0].js, manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons)]) {
    if (!existsSync(`${ext}/${f}`)) throw new Error(`manifest points at a missing file: ${f}`);
  }
  return manifest;
}

export const extensionZip = () => zipDir(ext);

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = checkExtension();
  if (/presenceUrl: ''/.test(readFileSync(`${ext}/shared/config.js`, 'utf8'))) {
    console.warn('note: presenceUrl is empty in shared/config.js, so presence is off in this build');
  }
  mkdirSync(`${root}dist`, { recursive: true });
  const out = `${root}dist/webling-${manifest.version}.zip`;
  writeFileSync(out, extensionZip());
  console.log(out);
}
