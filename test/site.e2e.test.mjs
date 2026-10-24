// The landing page, built and served like production, driven in headless Chrome.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from '../scripts/dev-server.mjs';
import { chromePath, launch } from './browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = chromePath ? false : 'no Chrome found (set CHROME_PATH)';
let server, chrome, base;

const BANNER_GONE = `(() => { const b = document.querySelector('#onetrust-banner-sdk'); return !!b && b.style.display === 'none'; })()`;
const stats = (page) => page.eval(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.stats)`);

before(async () => {
  if (skip) return;
  execFileSync('node', ['scripts/build-site.mjs'], { cwd: root, stdio: 'ignore' });
  server = await serve(`${root}public`);
  base = `http://127.0.0.1:${server.port}`;
  chrome = await launch();
});

after(async () => {
  await chrome?.close();
  await server?.close();
});

test('first visit: a webling hatches and eats the slide-in cookie banner', { skip }, async () => {
  const page = await chrome.open(`${base}/`);
  try {
    const name = await page.until(`globalThis.WL?.me && WL.state.pet.name`, 10000, 'pet hatched');
    assert.match(await page.eval(`document.querySelector('#hello').textContent`), new RegExp(name));
    await page.until(BANNER_GONE, 15000, 'cookie banner eaten');
    assert.equal((await stats(page)).cookies, 1);
    assert.equal(await page.until(`document.querySelector('#n-cookies').textContent === '1' && '1'`, 3000, 'scoreboard'), '1');
    assert.deepEqual(page.errors, []);
  } finally {
    page.close();
  }
});

test('"Another cookie banner" brings a new banner and it gets eaten too, every time', { skip }, async () => {
  const page = await chrome.open(`${base}/`);
  try {
    await page.until(BANNER_GONE, 15000, 'first banner eaten');
    for (let i = 2; i <= 4; i++) {
      await page.click('#rebanner');
      await page.until(`!!document.querySelector('#onetrust-banner-sdk.in') && document.querySelector('#onetrust-banner-sdk').style.display !== 'none'`, 3000, `banner ${i} shown`);
      await page.until(BANNER_GONE, 12000, `banner ${i} eaten`);
    }
    assert.ok((await stats(page)).cookies >= 4);
    assert.deepEqual(page.errors, []);
  } finally {
    page.close();
  }
});

test('"Another cookie banner" pressed while the pet is still eating the first one', { skip }, async () => {
  const page = await chrome.open(`${base}/`);
  try {
    await page.until(`WL.me?.mode === 'eat'`, 15000, 'pet starts eating the first banner');
    await page.click('#rebanner');
    await page.until(BANNER_GONE, 15000, 'replacement banner eaten');
  } finally {
    page.close();
  }
});

test('regression: "Another cookie banner" shows a banner even when animation frames are throttled', { skip }, async () => {
  const page = await chrome.open(`${base}/`);
  try {
    await page.until(BANNER_GONE, 15000, 'first banner eaten');
    // What a background tab or a throttled panel does: animation frame callbacks stop arriving.
    await page.eval('window.requestAnimationFrame = () => 0; true');
    await page.click('#rebanner');
    await page.until(`(() => { const b = document.querySelector('#onetrust-banner-sdk'); return b && b.getBoundingClientRect().top < innerHeight - 20; })()`, 2000, 'banner slid into view');
  } finally {
    page.close();
  }
});

test('"Summon a pop-up": the pop-up, its backdrop and scroll lock all get eaten', { skip }, async () => {
  const page = await chrome.open(`${base}/`);
  try {
    await page.until(BANNER_GONE, 15000, 'banner eaten first');
    await page.click('#summon');
    await page.until(`!!document.querySelector('.nl-modal')`, 6000, 'pop-up appears after the countdown');
    await page.until(`document.querySelector('.nl-modal').style.display === 'none'`, 12000, 'pop-up eaten');
    assert.equal(await page.eval(`document.querySelector('.nl-backdrop').style.display`), 'none');
    assert.notEqual(await page.eval(`getComputedStyle(document.body).overflow`), 'hidden');
    assert.equal((await stats(page)).popups, 1);
  } finally {
    page.close();
  }
});

test('a returning visitor keeps their pet', { skip }, async () => {
  const first = await chrome.open(`${base}/`);
  const name = await first.until(`globalThis.WL?.me && WL.state.pet.name`, 10000, 'pet hatched');
  first.close();
  const page = await chrome.open(`${base}/`);
  try {
    await page.until(`globalThis.WL?.me`, 10000, 'pet loaded');
    assert.equal(await page.eval(`WL.state.pet.name`), name);
    assert.match(await page.eval(`document.querySelector('#hello').textContent`), /Welcome back/);
  } finally {
    page.close();
  }
});

test('the download and preview image are served', { skip }, async () => {
  for (const [path, type] of [['/webling-extension.zip', 'application/zip'], ['/og.png', 'image/png']]) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200, path);
    assert.equal(r.headers.get('content-type'), type);
  }
});
