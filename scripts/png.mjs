// A tiny PNG encoder for drawing pixel art in Node (icons, the social preview image).
import { deflateSync } from 'node:zlib';

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
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

// An RGBA image you can fill rects into and encode.
export function image(w, h) {
  const px = Buffer.alloc(w * h * 4);
  return {
    w, h,
    rect(x, y, rw, rh, hex) {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      for (let yy = Math.max(0, y); yy < Math.min(h, y + rh); yy++) {
        for (let xx = Math.max(0, x); xx < Math.min(w, x + rw); xx++) {
          const i = (yy * w + xx) * 4;
          px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
        }
      }
    },
    // Draw art rows (palette keys, '.' transparent) with its top-left at (x, y).
    art(rows, pal, x, y, scale) {
      rows.forEach((row, ry) => [...row].forEach((ch, rx) => {
        if (ch !== '.') this.rect(x + rx * scale, y + ry * scale, scale, scale, pal[ch]);
      }));
    },
    png() {
      const raw = Buffer.alloc((w * 4 + 1) * h);
      for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(w, 0);
      ihdr.writeUInt32BE(h, 4);
      ihdr[8] = 8; ihdr[9] = 6;
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
      ]);
    },
  };
}
