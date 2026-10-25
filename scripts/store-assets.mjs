// Makes the Chrome Web Store images in store/assets/ by running the real extension in headless Chrome:
//   screenshot-1..5.png   1280×800  (a mock page in store/, framed by store/shot.html?n=1..5, both at 2x)
//   promo-small.png        440×280  (store/tile.html?size=small)
//   promo-marquee.png     1400×560  (store/tile.html?size=marquee)
// The store wants 24-bit PNGs, so the alpha channel Chrome's screenshots carry is dropped.
import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { serve } from './dev-server.mjs';
import { chromePath, launch } from '../test/browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}store/assets`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Each screenshot: the mock page to capture first (top-level, at the size it fills in the frame, since the
// extension skips iframes) and how to catch it at its best moment. Shot 5 is drawn by shot.html alone.
const BROWSER = { width: 580, height: 258 }, POPUP = { width: 340, height: 376 };
const SHOTS = {
  1: { page: 'article.html', size: BROWSER, stage: async (page) => { // mid-chomp on the cookie banner
    await page.until(`document.getElementById('onetrust-banner-sdk')?.style.clipPath`, 20000, 'banner being eaten');
    await sleep(550);
    await page.eval(`WL.me.say('accept all? i decline all', 5000), 1`);
  } },
  2: { page: 'shop.html', size: BROWSER, stage: async (page) => { // just ate the pop-up: the roast and the undo toast
    await page.until(`document.querySelector('.nl-modal')?.style.display === 'none'`, 20000, 'pop-up eaten');
    await page.until(`WL.me.grounded`, 5000, 'pet landed');
    await sleep(1500); // let the "+15 aura" float away; the undo toast stays up for 6s
    await page.eval(`WL.me.say('a discount? the audacity', 5000), 1`);
    await sleep(200);
  } },
  3: { page: 'feed.html?halo', size: BROWSER, stage: async (page) => { // a take, with side-eye, on a post
    await page.until(`WL.me && 1`, 10000, 'pet loaded');
    await sleep(2500);
    // drop it onto the second post
    await page.eval(`(() => { const r = document.querySelectorAll('.post p')[1].getBoundingClientRect();
      Object.assign(WL.me, { x: scrollX + r.left + 250, y: scrollY + r.top - 30, vx: 0, vy: 0, mode: 'fall', on: null }); return 1; })()`);
    await page.until(`WL.me.grounded`, 5000, 'pet landed on the post');
    await page.eval(`(WL.me.strike('sideeye', 6), WL.me.say("it's 3:07am. go to sleep bestie", 5000), 1)`);
    await sleep(400);
  } },
  4: { page: 'popup.html', size: POPUP, stage: async (page) => {
    await page.until(`document.querySelector('.aura-row')`, 10000, 'popup home');
    await sleep(1200);
  } },
  5: {},
};

// Re-encode a PNG (8-bit RGB or RGBA, not interlaced) as 24-bit RGB.
function dropAlpha(png) {
  let p = 8, w, h, type;
  const idat = [];
  while (p < png.length) {
    const len = png.readUInt32BE(p), kind = png.toString('ascii', p + 4, p + 8), data = png.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; }
    if (kind === 'IDAT') idat.push(data);
    p += len + 12;
  }
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * h), rgb = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[y * stride + i - bpp] : 0, b = y ? px[(y - 1) * stride + i] : 0;
      const c = i >= bpp && y ? px[(y - 1) * stride + i - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + i] = (line[i] + pred) & 255;
    }
    for (let x = 0; x < w; x++) px.copy(rgb, y * (w * 3 + 1) + 1 + x * 3, y * stride + x * bpp, y * stride + x * bpp + 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const chunk = (kind, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length);
    head.write(kind, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
    return Buffer.concat([head, data, crc]);
  };
  return Buffer.concat([png.subarray(0, 8), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rgb)), chunk('IEND', Buffer.alloc(0))]);
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Open url at width×height (CSS px) and device scale `scale`, run stage(page), and return a PNG.
async function snap(chrome, url, { width, height }, scale, stage) {
  const page = await chrome.open('about:blank');
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
    const loaded = page.waitFor('Page.loadEventFired', 15000);
    await page.send('Page.navigate', { url });
    await loaded;
    await stage(page);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    if (page.errors.length) console.warn(`${url}: page errors`, page.errors);
    return Buffer.from(data, 'base64');
  } finally {
    page.close();
  }
}

if (!chromePath) throw new Error('no Chrome found (set CHROME_PATH)');
mkdirSync(out, { recursive: true });
const server = await serve(root);
const chrome = await launch();
const base = `http://127.0.0.1:${server.port}/store`;
const only = process.argv[2]; // e.g. `3` or `promo-small` to redo one image
const save = (file, png) => {
  writeFileSync(`${out}/${file}`, dropAlpha(png));
  console.log(`wrote store/assets/${file}`);
};
try {
  for (const [n, shot] of Object.entries(SHOTS)) {
    if (only && only !== n) continue;
    const inner = shot.page && (await snap(chrome, `${base}/${shot.page}`, shot.size, 2, shot.stage));
    save(`screenshot-${n}.png`, await snap(chrome, `${base}/shot.html?n=${n}`, { width: 640, height: 400 }, 2, async (page) => {
      if (inner) await page.eval(`(async () => { const img = document.getElementById('page'); img.src = 'data:image/png;base64,${inner.toString('base64')}'; await img.decode(); return 1; })()`);
      else await page.until('document.documentElement.dataset.ready', 10000, 'shot drawn');
    }));
  }
  for (const [size, width, height] of [['small', 440, 280], ['marquee', 1400, 560]]) {
    if (only && only !== `promo-${size}`) continue;
    save(`promo-${size}.png`, await snap(chrome, `${base}/tile.html?size=${size}`, { width, height }, 1,
      (page) => page.until('document.documentElement.dataset.ready', 10000, 'tile drawn')));
  }
} finally {
  await chrome.close();
  await server.close();
}
