// When the webling gets out of the way: full screen, a big playing video, the shortcut, and per-site hiding.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAYER_SHOWN = `document.querySelector('webling-root').style.display !== 'none'`;
const settings = (p, patch) => p.eval(`chrome.runtime.sendMessage({ type: 'settings', patch: ${JSON.stringify(patch)} }).then(() => true)`);

async function page() {
  const p = await chrome.open(url);
  await p.eval('ready');
  await p.until(`globalThis.WL?.me && WL.brain.arrived && 1`, 10000, 'pet loaded');
  return p;
}

test('full screen: the pet steps aside, and nothing gets eaten behind it', { skip }, async () => {
  const p = await page();
  try {
    // requestFullscreen needs a user gesture
    await p.send('Runtime.evaluate', { expression: `document.querySelector('article').requestFullscreen()`, userGesture: true, awaitPromise: true });
    await p.until(`!!document.fullscreenElement`, 3000, 'full screen');
    await p.until(`!(${LAYER_SHOWN}) && !WL.shown`, 3000, 'pet hidden');
    const id = await p.eval(`fx.banner()`);
    await sleep(3000);
    assert.equal(await p.eval(`fx.shown('${id}')`), true, 'banner left alone while full screen');
    await p.eval(`document.exitFullscreen().then(() => true)`);
    await p.until(LAYER_SHOWN, 3000, 'pet back');
    await p.until(`fx.gone('${id}')`, 15000, 'and eats it once back');
  } finally {
    p.close();
  }
});

test('a playing video covering most of the window hides the pet; pausing brings it back', { skip }, async () => {
  const p = await page();
  try {
    await p.eval(`(async () => {
      const c = document.createElement('canvas');
      c.getContext('2d').fillRect(0, 0, 10, 10);
      const v = document.createElement('video');
      v.id = 'vid';
      v.muted = true;
      v.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:5;background:#000';
      v.srcObject = c.captureStream();
      document.body.appendChild(v);
      await v.play();
      return true;
    })()`);
    await p.until(`!(${LAYER_SHOWN})`, 3000, 'hidden behind the big video');
    await p.eval(`document.getElementById('vid').pause(), true`);
    await p.until(LAYER_SHOWN, 3000, 'back when paused');
    // a small playing video doesn't count
    await p.eval(`(async () => { const v = document.getElementById('vid'); v.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:120px'; await v.play(); return true; })()`);
    await sleep(2500);
    assert.equal(await p.eval(LAYER_SHOWN), true, 'a small video is fine');
  } finally {
    p.close();
  }
});

test('put away (the shortcut or the popup): gone everywhere until brought back, and it says hi', { skip }, async () => {
  const p = await page();
  try {
    await settings(p, { hidden: true });
    await p.until(`!(${LAYER_SHOWN})`, 3000, 'put away');
    const id = await p.eval(`fx.banner()`);
    await sleep(3000);
    assert.equal(await p.eval(`fx.shown('${id}')`), true, 'no eating while put away');
    await settings(p, { hidden: false });
    await p.until(LAYER_SHOWN, 3000, 'back');
    await p.until(`WL.brain.lastSaid?.event === 'unhide' || WL.brain.history.some((h) => h.event === 'unhide')`, 3000, 'says it is back');
    await p.until(`fx.gone('${id}')`, 15000, 'eats again');
  } finally {
    await settings(p, { hidden: false });
    p.close();
  }
});

test('switched off on one site: never shows up there, still shows up elsewhere', { skip }, async () => {
  const p = await page();
  try {
    await p.eval(`chrome.runtime.sendMessage({ type: 'sitePet', host: location.hostname, on: false }).then(() => true)`);
    await p.until(`!(${LAYER_SHOWN})`, 3000, 'off here');
    await p.eval(`location.reload(), true`).catch(() => {});
    await sleep(500);
    await p.eval('ready');
    await p.until(`globalThis.WL?.me && 1`, 10000, 'loaded again');
    await sleep(300);
    assert.equal(await p.eval(LAYER_SHOWN), false, 'still off after a reload');
    const s = await p.eval(`chrome.runtime.sendMessage({ type: 'sitePet', host: location.hostname, on: true }).then((s) => s.settings.noPet)`);
    assert.deepEqual(s, []);
    await p.until(LAYER_SHOWN, 3000, 'back on');
  } finally {
    p.close();
  }
});
