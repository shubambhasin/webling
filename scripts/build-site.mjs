// Builds the landing page into public/ (what Vercel serves):
//   site/*                      → public/
//   extension scripts + shim    → public/ext/   (the page runs the real extension on itself)
//   the packed extension        → public/webling-extension.zip
//   a social preview image      → public/og.png
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadShared } from './load-shared.mjs';
import { image } from './png.mjs';
import { checkExtension, extensionZip } from './zip.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}public`;

checkExtension();
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/ext`, { recursive: true });

cpSync(`${root}site`, out, { recursive: true });
for (const p of ['manifest.json', 'background.js', 'shared', 'content', 'icons']) {
  cpSync(`${root}extension/${p}`, `${out}/ext/${p}`, { recursive: true });
}
cpSync(`${root}dev/chrome-shim.js`, `${out}/ext/chrome-shim.js`);
writeFileSync(`${out}/webling-extension.zip`, extensionZip());

// og.png: a row of weblings on the ink background, 1200×630.
const { WL } = loadShared();
const og = image(1200, 630);
og.rect(0, 0, 1200, 630, '#1b1528');
for (let x = 0; x < 1200; x += 30) for (let y = 0; y < 630; y += 30) og.rect(x, y, 2, 2, '#2a2238');
const lineup = [['juniper', 'baby'], ['mochi7', 'adult'], ['bean', 'legend'], ['k0', 'adult'], ['tofu', 'baby']];
const scale = 13, ground = 470;
lineup.forEach(([seed, stage], i) => {
  const rows = WL.art.rows(stage, i === 2 ? 'happy' : 'idle', i === 2 ? 1 : 0);
  const x = Math.round(120 + i * 240 - (rows[0].length * scale) / 2);
  og.art(rows, WL.art.palette(seed), x, ground - rows.length * scale, scale);
});
og.rect(80, ground + 10, 1040, 6, '#7c5cff');
writeFileSync(`${out}/og.png`, og.png());

console.log('built public/');
