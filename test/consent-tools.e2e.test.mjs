// Banners built the way the big consent tools build them (see fx.cmp in fixtures/eater.html), found by
// running the extension on real sites (scripts/real-sites.mjs). Each was missed before the fix it tests.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { serve } from '../scripts/dev-server.mjs';
import { chromePath, launch } from './browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = chromePath ? false : 'no Chrome found (set CHROME_PATH)';
let server, chrome, url;

before(async () => {
  if (skip) return;
  server = await serve(root);
  url = `http://127.0.0.1:${server.port}/test/fixtures/eater.html`;
  chrome = await launch();
});

after(async () => {
  await chrome?.close();
  await server?.close();
});

async function eats(kind) {
  const p = await chrome.open(url);
  try {
    await p.eval('ready');
    await p.until('globalThis.WL?.me && 1', 8000, 'pet loaded');
    const id = await p.eval(`fx.cmp('${kind}')`);
    await p.until(`fx.gone('${id}')`, 20000, `${kind} banner eaten`);
    assert.equal(await p.eval(`WL.eater.meals.at(-1).kind`), 'cookie');
    return p;
  } catch (e) {
    p.close();
    throw e;
  }
}

test('a banner with its own tabs and a long hidden vendor list (like Cookiebot)', { skip }, async () => {
  (await eats('cookiebot')).close();
});

test('a banner drawn inside a shadow root (like Usercentrics)', { skip }, async () => {
  (await eats('shadow')).close();
});

test('a banner drawn inside a frame (like Sourcepoint and TrustArc)', { skip }, async () => {
  (await eats('frame')).close();
});

test('a banner inside a page-sized fixed wrapper: the banner goes, the page stays', { skip }, async () => {
  const p = await eats('wrapped');
  try {
    assert.equal(await p.eval(`fx.shown('app-shell')`), true, 'the page itself is untouched');
    assert.equal(await p.eval(`WL.eater.meals.length`), 1);
  } finally {
    p.close();
  }
});

test('a cookie wall in Italian (like Corriere della Sera)', { skip }, async () => {
  (await eats('italian')).close();
});

test('a banner with scrambled class names that says "we may place cookies" (like CookieFirst)', { skip }, async () => {
  (await eats('scrambled')).close();
});

test('a banner inside an empty fixed wrapper (like TrustArc)', { skip }, async () => {
  (await eats('collapsed')).close();
});

async function leavesAlone(kind) {
  const p = await chrome.open(url);
  try {
    await p.eval('ready');
    await p.until('globalThis.WL?.me && 1', 8000, 'pet loaded');
    const id = await p.eval(`fx.cmp('${kind}')`);
    await new Promise((r) => setTimeout(r, 6000));
    assert.equal(await p.eval(`fx.shown('${id}')`), true);
    assert.equal(await p.eval('WL.eater.meals.length'), 0);
  } finally {
    p.close();
  }
}

test('a chat button asking for cookies is left alone', { skip }, () => leavesAlone('chat'));

test('a fixed site header full of cookie-consent links is left alone (regression, termly.io)', { skip }, () => leavesAlone('header'));
