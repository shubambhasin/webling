// Renders the grown-up webling into the extension's PNG icons. Run: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { loadShared } from './load-shared.mjs';

const { WL } = loadShared();
const ICON_HUE = 262;
const pal = WL.art.palette(ICON_HUE);
const art = WL.art.rows('adult', 'idle');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size) {
  const w = art[0].length, h = art.length;
  const scale = Math.max(1, Math.floor(size / Math.max(w, h)));
  const ox = Math.floor((size - w * scale) / 2), oy = Math.floor((size - h * scale) / 2);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = art[Math.floor((y - oy) / scale)]?.[Math.floor((x - ox) / scale)];
      if (!ch || ch === '.' || x < ox || y < oy) continue;
      const hex = pal[ch];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = parseInt(hex.slice(1, 3), 16);
      raw[i + 1] = parseInt(hex.slice(3, 5), 16);
      raw[i + 2] = parseInt(hex.slice(5, 7), 16);
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(new URL(`../extension/icons/${size}.png`, import.meta.url), png(size));
  console.log(`icons/${size}.png`);
}
