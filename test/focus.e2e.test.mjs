// Focus sessions in headless Chrome: the pet keeps watch on the page, calls out slips, celebrates the end;
// the popup starts, counts down and quits sessions.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { serve } from '../scripts/dev-server.mjs';
import { chromePath, launch } from './browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = chromePath ? false : 'no Chrome found (set CHROME_PATH)';
let server, chrome, base;

before(async () => {
  if (skip) return;
  server = await serve(root);
  base = `http://127.0.0.1:${server.port}`;
  chrome = await launch();
});

after(async () => {
  await chrome?.close();
  await server?.close();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chip = `(() => { const c = document.querySelector('webling-root').shadowRoot.querySelector('.chip.focus'); return c && !c.hidden ? c.textContent : null; })()`;

async function page() {
  const p = await chrome.open(`${base}/test/fixtures/eater.html`);
  await p.eval('ready');
  await p.until(`globalThis.WL?.me && WL.brain.arrived && 1`, 10000, 'pet loaded');
  await p.eval(`chrome.runtime.sendMessage({ type: 'focusEnd' }).then(() => true)`); // nothing left over
  return p;
}

test('on a page: the pet keeps watch quietly, then celebrates when the time is up', { skip }, async () => {
  const p = await page();
  try {
    await p.eval(`chrome.runtime.sendMessage({ type: 'focusStart', mins: 25 }).then(() => true)`);
    await p.until('WL.focus.on', 3000, 'focus on');
    await p.until(`WL.me.mode !== 'walk'`, 3000, 'stops walking');
    assert.equal(await p.until(chip, 2000, 'timer chip'), '🎯 25 min');
    await p.until(`WL.brain.history.some((h) => h.event === 'focus_start')`, 2000, 'says it is on guard');
    await p.eval('WL.brain.resetCooldowns(); true');
    assert.equal(await p.eval(`WL.brain.remark('ambient')`), null, 'no unprompted remarks');
    // keeping watch: no wandering
    const walked = await p.eval(`new Promise((done) => { let w = false; const t = setInterval(() => w ||= WL.me.mode === 'walk', 100);
      setTimeout(() => { clearInterval(t); done(w); }, 6000); })`);
    assert.equal(walked, false, 'sat still');

    // fast-forward: the session ends in a second
    await p.eval(`(async () => { const s = await chrome.storage.local.get('pet'); s.pet.focus.end = Date.now() + 1000; await chrome.storage.local.set(s); return true; })()`);
    await p.until(`WL.brain.history.some((h) => h.event === 'focus_done')`, 5000, 'celebrates');
    assert.equal(await p.eval('WL.focus.on'), false);
    assert.equal(await p.eval(chip), null, 'timer gone');
    assert.match(await p.eval(`fx.toast().textContent`), /Focus done: 25 minutes/);
    const s = await p.eval(`chrome.runtime.sendMessage({ type: 'state' })`);
    assert.equal(s.pet.stats.focus, 1);
    assert.equal(s.pet.focus, null);
  } finally {
    p.close();
  }
});

test('opening a distracting site during a session gets called out, once', { skip }, async () => {
  const p = await chrome.open(`${base}/test/fixtures/eater.html`);
  try {
    // this test page plays the part of a video site
    await p.eval(`ready.then(() => { WL.voice.distracting = () => 'video'; return true; })`);
    await p.until(`globalThis.WL?.me && WL.brain.arrived && 1`, 10000, 'pet loaded');
    await p.eval(`chrome.runtime.sendMessage({ type: 'focusEnd' }).then(() => true)`);
    await p.eval(`chrome.runtime.sendMessage({ type: 'focusStart', mins: 25 }).then(() => true)`);
    await p.until(`WL.brain.history.some((h) => h.event === 'focus_slip')`, 5000, 'called out');
    const f = await p.eval(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.focus)`);
    assert.deepEqual(f.slips, ['127.0.0.1']);
    await p.eval(`chrome.runtime.sendMessage({ type: 'focusEnd' }).then(() => true)`);
    await p.until('!WL.focus.on', 3000, 'off after quitting');
  } finally {
    p.close();
  }
});

test('the popup starts a session, counts down, and quits early', { skip }, async () => {
  const p = await chrome.open(`${base}/dev/popup.html?store=focus`);
  try {
    await p.until(`document.querySelector('#hatch')`, 10000, 'hatch view');
    await p.eval(`chrome.runtime.sendMessage({ type: 'hatch', name: 'Zen' }).then(() => location.reload())`).catch(() => {});
    await p.until(`document.querySelector('[data-focus="25"]')`, 10000, 'focus buttons');
    await p.eval(`document.querySelector('[data-focus="25"]').click(), true`);
    await p.until(`document.querySelector('.focus-row.on')`, 3000, 'session on');
    const t1 = await p.eval(`document.querySelector('#focus-left').textContent`);
    assert.match(t1, /^2[45]:\d\d$/);
    await sleep(1600);
    assert.notEqual(await p.eval(`document.querySelector('#focus-left').textContent`), t1, 'counting down');
    const start = await p.eval(`document.querySelector('#said').textContent`);
    assert.ok(await p.eval(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => WL.voice.pool('focus_start', WL.voice.vibeOf(s.pet)).includes(${JSON.stringify(start)}))`), start);
    await p.eval(`document.querySelector('#focus-stop').click(), true`);
    await p.until(`document.querySelector('[data-focus="25"]')`, 3000, 'back to the start buttons');
    const said = await p.eval(`document.querySelector('#said').textContent`);
    assert.ok(await p.eval(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => WL.voice.pool('focus_quit', WL.voice.vibeOf(s.pet)).includes(${JSON.stringify(said)}))`), said);
    assert.deepEqual(p.errors, []);
  } finally {
    p.close();
  }
});
