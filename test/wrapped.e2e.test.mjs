// Webling Wrapped end to end: the popup's card for last week, its share link, and the page that link opens.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from '../scripts/dev-server.mjs';
import { chromePath, launch } from './browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = chromePath ? false : 'no Chrome found (set CHROME_PATH)';
let repo, site, chrome;

before(async () => {
  if (skip) return;
  execFileSync('node', ['scripts/build-site.mjs'], { cwd: root, stdio: 'ignore' });
  repo = await serve(root); // the dev popup
  site = await serve(`${root}public`); // the built site, where /w lives
  chrome = await launch();
});

after(async () => {
  await chrome?.close();
  await repo?.close();
  await site?.close();
});

const LAST_WEEK = { cookies: 11, popups: 8, sites: 6, boops: 0, visits: 380, late: 3, doomscrolls: 1, yeets: 4,
  kinds: { shopping: 170, social: 40 }, auraStart: 100, auraEnd: 371 };

test('the popup wraps last week, shares it as a link, and the link shows the same verdict', { skip }, async () => {
  const p = await chrome.open(`http://127.0.0.1:${repo.port}/dev/popup.html?store=wrapped`);
  try {
    await p.until(`document.querySelector('#hatch')`, 10000, 'hatch view');
    await p.eval(`(async () => {
      await chrome.runtime.sendMessage({ type: 'hatch', name: 'Mochi', vibe: 'chaotic' });
      const s = await chrome.storage.local.get('pet');
      s.pet.lastWeek = { ...${JSON.stringify(LAST_WEEK)}, start: Date.now() - 9 * 864e5 };
      s.pet.week.start = Date.now() - 2 * 864e5;
      await chrome.storage.local.set(s);
      location.reload();
    })()`).catch(() => {});
    await p.until(`document.querySelector('#wrapped-btn')`, 10000, 'home with the Wrapped button');
    const btn = await p.eval(`document.querySelector('#wrapped-btn').textContent`);
    assert.match(btn, /Last week, wrapped/);
    assert.match(btn, /new/);

    await p.eval(`document.querySelector('#wrapped-btn').click(), true`);
    await p.until(`document.querySelector('.verdict')`, 3000, 'the Wrapped view');
    assert.equal(await p.eval(`document.querySelector('.verdict').textContent`), 'add-to-cart era');
    const said = await p.eval(`document.querySelector('#said').textContent`);
    assert.ok(await p.eval(`WL.voice.pool('wrapped_add_to_cart', 'chaotic').map((l) => WL.voice.fill(l, { n: 45 })).includes(${JSON.stringify(said)})`), said);
    assert.match(await p.eval(`document.querySelector('.stats').textContent`), /\+271\s*aura/);
    await p.until(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.lastWeek.seen)`, 3000, 'marked seen');

    await p.eval(`navigator.clipboard.writeText = (t) => { window.copied = t; return Promise.resolve(); }; true`);
    await p.eval(`document.querySelector('#wrapped-share').click(), true`);
    const link = await p.until('window.copied', 2000, 'link copied');
    const url = new URL(link);
    assert.equal(url.origin + url.pathname, 'https://webling.vercel.app/w');
    assert.equal(url.searchParams.get('k'), 'shopping.170');
    assert.equal(url.searchParams.get('a'), '271');
    assert.equal(url.searchParams.get('so'), null, 'a finished week, not "so far"');
    assert.ok(![...url.searchParams.values()].some((v) => /\.(com|in|dev)$/.test(v)), 'no sites in the link');

    // the same link on the site
    const page = await chrome.open(`http://127.0.0.1:${site.port}/w${url.search}`);
    try {
      assert.match(await page.eval(`document.querySelector('meta[property="og:title"]').content`), /Mochi's week, wrapped: add-to-cart era/);
      assert.match(await page.eval(`document.querySelector('meta[property="og:description"]').content`), new RegExp(said.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await page.until(`document.querySelector('img.card').complete && document.querySelector('img.card').naturalWidth === 1200`, 10000, 'card image');
      assert.deepEqual(page.errors, []);
    } finally {
      page.close();
    }
    assert.deepEqual(p.errors, []);
  } finally {
    p.close();
  }
});

test('before a week has passed, it wraps this week so far', { skip }, async () => {
  const p = await chrome.open(`http://127.0.0.1:${repo.port}/dev/popup.html?store=wrapped-new`);
  try {
    await p.until(`document.querySelector('#hatch')`, 10000, 'hatch view');
    await p.eval(`chrome.runtime.sendMessage({ type: 'hatch', name: 'Tofu' }).then(() => location.reload())`).catch(() => {});
    await p.until(`document.querySelector('#wrapped-btn')`, 10000, 'home');
    assert.match(await p.eval(`document.querySelector('#wrapped-btn').textContent`), /This week so far/);
    await p.eval(`document.querySelector('#wrapped-btn').click(), true`);
    assert.match(await p.eval(`document.querySelector('.when').textContent`), /so far/);
    assert.equal(await p.eval(`document.querySelector('.verdict').textContent`), 'offline icon');
    await p.eval(`document.querySelector('#wrapped-back').click(), true`);
    assert.ok(await p.eval(`!!document.querySelector('#wrapped-btn')`), 'back to the pet');
  } finally {
    p.close();
  }
});
