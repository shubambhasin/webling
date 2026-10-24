// Renders the grown-up webling into the extension's PNG icons. Run: npm run icons
import { writeFileSync } from 'node:fs';
import { loadShared } from './load-shared.mjs';
import { image } from './png.mjs';

const { WL } = loadShared();
const ICON_HUE = 262;
const pal = WL.art.palette(ICON_HUE);
const art = WL.art.rows('adult', 'idle');

for (const size of [16, 32, 48, 128]) {
  const w = art[0].length, h = art.length;
  const scale = Math.max(1, Math.floor(size / Math.max(w, h)));
  const img = image(size, size);
  img.art(art, pal, Math.floor((size - w * scale) / 2), Math.floor((size - h * scale) / 2), scale);
  writeFileSync(new URL(`../extension/icons/${size}.png`, import.meta.url), img.png());
  console.log(`icons/${size}.png`);
}
