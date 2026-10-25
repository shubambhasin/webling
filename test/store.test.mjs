// The Chrome Web Store kit in store/: images at the sizes the store accepts, and copy that agrees with
// the manifest and with what the extension actually does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(`${root}${p}`, 'utf8');
const manifest = JSON.parse(read('extension/manifest.json'));
const listing = read('store/listing.md');

const ASSETS = {
  'screenshot-1.png': [1280, 800], 'screenshot-2.png': [1280, 800], 'screenshot-3.png': [1280, 800],
  'screenshot-4.png': [1280, 800], 'screenshot-5.png': [1280, 800],
  'promo-small.png': [440, 280], 'promo-marquee.png': [1400, 560],
};

test('store images: right sizes, 24-bit PNG without alpha, all named in the listing', () => {
  for (const [file, [w, h]] of Object.entries(ASSETS)) {
    const path = `${root}store/assets/${file}`;
    assert.ok(existsSync(path), `${file} missing: run npm run store`);
    const png = readFileSync(path);
    assert.equal(png.toString('ascii', 12, 16), 'IHDR', file);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [w, h], `${file} size`);
    assert.equal(png[24], 8, `${file} bit depth`);
    assert.equal(png[25], 2, `${file} must be RGB with no alpha channel`);
    assert.ok(listing.includes(file.replace(/-[2-5]\.png$/, '-1.png')), `${file} not in listing.md`);
  }
});

test('the summary fits the store and the listing quotes the real one', () => {
  assert.ok(manifest.description.length <= 132, `${manifest.description.length} chars`);
  assert.ok(listing.includes(manifest.description), 'listing.md summary is out of date with the manifest');
  assert.ok(listing.includes(`webling-${manifest.version}.zip`), 'listing.md names the wrong package version');
});

test('the description fits and the justifications cover every permission', () => {
  const description = listing.match(/\*\*Description\*\*[\s\S]*?```\n([\s\S]*?)```/)[1];
  assert.ok(description.length <= 16000);
  assert.ok(description.includes('https://webling.vercel.app'));
  for (const p of manifest.permissions) assert.ok(listing.includes(`| \`${p}\` |`), `no justification for ${p}`);
  assert.ok(listing.includes('Host permission'), 'no justification for host access');
  assert.ok(listing.includes('https://webling.vercel.app/privacy'));
});

test('the privacy policy says presence is off only while it is', () => {
  const policy = read('site/privacy.html');
  const presenceOn = !/presenceUrl: ''/.test(read('extension/shared/config.js'));
  assert.equal(policy.includes('<strong>switched off</strong>'), !presenceOn,
    'presenceUrl changed: update site/privacy.html and the "If presence is on" answers in store/listing.md');
});

test('the store link, once set, is a Chrome Web Store listing', () => {
  const url = read('extension/shared/config.js').match(/storeUrl: '([^']*)'/)[1];
  assert.ok(url === '' || /^https:\/\/chromewebstore\.google\.com\/detail\/[\w-]+\/[a-p]{32}$/.test(url), url);
});
