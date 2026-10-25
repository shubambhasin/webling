// Shareable roasts (api/): the page link previews read, and the preview image.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET as page } from '../api/roast.mjs';
import { GET as picture } from '../api/roast-image.mjs';
import { WL } from '../api/_roast.mjs';

const get = (fn, query) => fn(new Request(`https://webling.example/api/x?${query}`));
const unescape = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
const meta = (html, prop) => unescape(html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`))?.[1] ?? '');

test('a roast page carries the take, and previews point at its image', async () => {
  const r = await get(page, 'domain=www.LinkedIn.com&v=dramatic&t=3&n=Mochi&s=abc123&g=legend');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/html/);
  const html = await r.text();
  const take = WL.voice.roast('linkedin.com', 'dramatic', 3);
  const q = `v=dramatic&t=${take.t}&n=Mochi&s=abc123&g=legend`;
  assert.equal(meta(html, 'og:image'), `https://webling.example/r/linkedin.com/image.png?${q}`);
  assert.equal(meta(html, 'og:url'), `https://webling.example/r/linkedin.com?${q}`);
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.ok(unescape(html).includes(take.text), 'the take is on the page');
});

test('names and junk in the link are cleaned and escaped', async () => {
  const html = await (await get(page, `domain=github.com&n=${encodeURIComponent('<img src=x onerror=alert(1)>"')}&s=NOT_VALID!&g=boss&v=evil&t=x`)).text();
  assert.ok(!html.includes('<img src=x'), 'no markup from the name');
  const og = meta(html, 'og:image');
  assert.match(og, /[?&]g=adult/, 'unknown stage → adult');
  assert.match(og, /[?&]s=r[a-z0-9]+/, 'bad seed → one made from the host');
  assert.ok(WL.voice.VIBE_IDS.includes(new URL(og).searchParams.get('v')));
});

test('a link without a website gets a friendly 404', async () => {
  const r = await get(page, 'domain=lol');
  assert.equal(r.status, 404);
  assert.match(await r.text(), /not a website bestie/);
});

test('the preview image is a 1200×630 PNG, cached for good', async () => {
  const r = await get(picture, 'domain=linkedin.com&v=chaotic&t=1&n=Mochi&s=mochi7&g=adult');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.match(r.headers.get('cache-control'), /immutable/);
  const png = Buffer.from(await r.arrayBuffer());
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});

test('a preview for something that is not a website falls back to the site image', async () => {
  const r = await get(picture, 'domain=nope');
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /\/og\.png$/);
});

// ---- Webling Wrapped (/w) ----
import { GET as wrappedPage } from '../api/wrapped.mjs';
import { GET as wrappedPicture } from '../api/wrapped-image.mjs';
import { parseWrapped, tiles } from '../api/_wrapped.mjs';

const WEEK = 'n=Mochi&s=mochi7&g=adult&v=dramatic&t=4&d=2026-10-18&e=2026-10-25&c=23&p=12&x=9&vi=412&l=17&ds=3&y=2&a=286&k=social.140';

test('a shared week reads back to the same verdict and take the popup showed', () => {
  const r = parseWrapped(`https://webling.example/w?${WEEK}`);
  const take = WL.voice.wrapped({ cookies: 23, popups: 12, sites: 9, visits: 412, late: 17, doomscrolls: 3, yeets: 2, kinds: { social: 140 } }, 'dramatic', 4);
  assert.equal(r.verdict, 'night_owl');
  assert.equal(r.text, take.text);
  assert.equal(r.when, 'Oct 18 – Oct 25');
  assert.equal(r.aura, 286);
  assert.deepEqual(tiles(r)[0], [17, 'after midnight'], 'the number behind the verdict comes first');
});

test('a shared week survives junk: numbers are clamped, unknown kinds dropped, defaults filled', () => {
  const r = parseWrapped('https://webling.example/w?n=%3Cb%3E&c=-5&p=abc&vi=10&k=shopping.999999&a=lots&g=boss&so=1&d=nope');
  assert.equal(r.w.cookies, 0);
  assert.equal(r.w.popups, 0);
  assert.equal(r.w.kinds.shopping, 10, 'a kind cannot have more visits than the week');
  assert.equal(r.aura, null);
  assert.equal(r.stage, 'adult');
  assert.equal(r.name, 'b', 'markup characters are stripped from names');
  assert.equal(r.when, 'this week');
  assert.equal(parseWrapped('https://webling.example/w?k=evil.3&vi=50').top, null);
});

test('the Wrapped page previews its card, and the card is a 1200×630 PNG', async () => {
  const html = await (await get(wrappedPage, WEEK)).text();
  assert.equal(meta(html, 'og:image'), `https://webling.example/w/image.png?${WEEK}`);
  assert.match(meta(html, 'og:title'), /Mochi's week, wrapped: 3am menace/);
  const r = await get(wrappedPicture, WEEK);
  assert.equal(r.headers.get('content-type'), 'image/png');
  const png = Buffer.from(await r.arrayBuffer());
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});
