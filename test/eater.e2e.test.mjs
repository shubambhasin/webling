// What the pet eats and what it leaves alone, on a fixture page in headless Chrome. The fixture
// runs the real background and content scripts against the dev chrome.* stand-in.
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

// A fresh fixture page with the pet loaded. Waits past the eater's start-up scans when asked, so a
// test proves the later triggers (DOM changes, periodic rescans) work on their own.
async function page({ settle = false } = {}) {
  const p = await chrome.open(url);
  await p.eval('ready');
  await p.until('globalThis.WL?.me && WL.me.mode !== "fall" && 1', 8000, 'pet landed');
  if (settle) await new Promise((r) => setTimeout(r, 5500));
  p.stats = () => p.eval('fx.stats()');
  return p;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('eats a cookie banner, and leaves the fixed nav and sidebar alone', { skip }, async () => {
  const p = await page();
  try {
    const before = await p.stats();
    const id = await p.eval('fx.banner()');
    await p.until(`fx.gone('${id}')`, 12000, 'banner eaten');
    assert.equal((await p.stats()).cookies, before.cookies + 1);
    assert.ok(await p.eval(`getComputedStyle(document.querySelector('.site-nav')).display !== 'none'`), 'nav kept');
    assert.ok(await p.eval(`getComputedStyle(document.querySelector('.sidebar')).display !== 'none'`), 'sidebar with "Subscribe" kept');
    assert.deepEqual(p.errors, []);
  } finally {
    p.close();
  }
});

test('eats a promo modal with its backdrop, and unlocks scrolling', { skip }, async () => {
  const p = await page();
  try {
    const before = await p.stats();
    const id = await p.eval('fx.modal()');
    await p.until(`fx.gone('${id}')`, 12000, 'modal eaten');
    assert.ok(await p.eval(`fx.gone('${id}-backdrop')`), 'backdrop hidden');
    assert.notEqual(await p.eval('getComputedStyle(document.body).overflow'), 'hidden');
    assert.equal((await p.stats()).popups, before.popups + 1);
  } finally {
    p.close();
  }
});

test('leaves alone a modal that opens right after a click (the user asked for it)', { skip }, async () => {
  const p = await page();
  try {
    await p.click('article p');
    const id = await p.eval('fx.modal()');
    await sleep(7000);
    assert.ok(await p.eval(`fx.shown('${id}')`), 'modal still open');
  } finally {
    p.close();
  }
});

test('"Spit it out" puts the banner back and takes back the reward', { skip }, async () => {
  const p = await page();
  try {
    const before = await p.stats();
    const id = await p.eval('fx.banner()');
    await p.until(`fx.gone('${id}')`, 12000, 'banner eaten');
    await p.until(`fx.toast()?.classList.contains('on')`, 2000, 'toast shown');
    await p.eval(`fx.toast().querySelector('button').click()`);
    await p.until(`fx.shown('${id}')`, 2000, 'banner restored');
    assert.equal(await p.eval(`document.getElementById('${id}').style.clipPath`), '');
    assert.equal((await p.stats()).cookies, before.cookies);
    await sleep(4000);
    assert.ok(await p.eval(`fx.shown('${id}')`), 'a spat-out banner is not eaten again');
  } finally {
    p.close();
  }
});

test('does not eat on a site switched off in the popup', { skip }, async () => {
  const p = await page();
  try {
    await p.eval(`chrome.runtime.sendMessage({ type: 'siteEat', host: location.hostname, on: false })`);
    const id = await p.eval('fx.banner()');
    await sleep(6000);
    assert.ok(await p.eval(`fx.shown('${id}')`), 'banner left alone');
  } finally {
    await p.eval(`chrome.runtime.sendMessage({ type: 'siteEat', host: location.hostname, on: true })`);
    p.close();
  }
});

// ---- regressions for "Another cookie banner does nothing" ----

test('regression: a page that never stops changing still gets scanned', { skip }, async () => {
  const p = await page({ settle: true });
  try {
    await p.eval('fx.churn(150)');
    const id = await p.eval('fx.banner()');
    await p.until(`fx.gone('${id}')`, 12000, 'banner eaten despite constant DOM changes');
  } finally {
    p.close();
  }
});

test('regression: a banner that shows up mid-meal is eaten next', { skip }, async () => {
  const p = await page();
  try {
    const a = await p.eval('fx.banner()');
    await p.until(`WL.me.mode === 'eat'`, 8000, 'eating the first');
    const b = await p.eval(`fx.banner('We use cookies too. Cookie settings.')`);
    await p.until(`fx.gone('${a}') && fx.gone('${b}')`, 20000, 'both eaten');
  } finally {
    p.close();
  }
});

test('regression: a banner hidden when its turn came is eaten once it is back', { skip }, async () => {
  const p = await page();
  try {
    const a = await p.eval('fx.banner()');
    await p.until(`WL.me.mode === 'eat'`, 8000, 'eating the first');
    const b = await p.eval(`fx.banner('Second cookie banner, cookie policy here.')`);
    await sleep(1300); // long enough for a rescan to queue it
    await p.eval(`document.getElementById('${b}').style.visibility = 'hidden'`);
    await p.until(`fx.gone('${a}') && !['tween', 'eat'].includes(WL.me.mode)`, 12000, 'first meal done');
    await sleep(1500); // its turn passes while hidden
    await p.eval(`document.getElementById('${b}').style.visibility = ''`);
    await p.until(`fx.gone('${b}')`, 12000, 'second banner eaten after reappearing');
  } finally {
    p.close();
  }
});

test('a meal that stalls is abandoned after 15s, and eating carries on', { skip }, async () => {
  const p = await page();
  try {
    // Make the next leap hang forever, as any unforeseen stall would.
    await p.eval(`WL.me._tweenTo = WL.me.tweenTo; WL.me.tweenTo = () => new Promise(() => {}); true`);
    const stuck = await p.eval('fx.banner()');
    await p.until(`!fx.shown('${stuck}') || WL.me.tweenTo !== WL.me._tweenTo`, 3000);
    await sleep(2500);
    await p.eval(`WL.me.tweenTo = WL.me._tweenTo; document.getElementById('${stuck}').remove(); true`);
    const next = await p.eval('fx.banner()');
    await p.until(`fx.gone('${next}')`, 25000, 'next banner eaten once the stalled meal is abandoned');
    assert.ok(!['tween', 'eat'].includes(await p.eval('WL.me.mode')), 'pet back to normal');
  } finally {
    p.close();
  }
});

test('regression: dragging the pet as it leaps for a banner cannot jam the eater', { skip }, async () => {
  const p = await page();
  try {
    const at = await p.eval('({ x: WL.me.sx, y: WL.me.sy - WL.me.h / 2 })');
    await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
    const id = await p.eval('fx.banner()');
    await p.until(`WL.me.mode === 'tween'`, 8000, 'pet leaps');
    for (let i = 1; i <= 6; i++) {
      await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x + i * 15, y: at.y + i * 10, button: 'left' });
    }
    await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x + 90, y: at.y + 60, button: 'left', clickCount: 1 });
    await p.until(`fx.gone('${id}')`, 15000, 'banner still eaten');
    const next = await p.eval('fx.banner()');
    await p.until(`fx.gone('${next}')`, 15000, 'and the eater keeps working afterwards');
  } finally {
    p.close();
  }
});
