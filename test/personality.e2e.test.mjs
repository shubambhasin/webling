// The pet's personality on a real page in headless Chrome: what it says and when.
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

async function page() {
  const p = await chrome.open(url);
  await p.eval('ready');
  await p.until(`globalThis.WL?.me && ['idle', 'walk', 'pose'].includes(WL.me.mode) && 1`, 8000, 'pet standing');
  await p.until('WL.brain.arrived', 5000, 'arrival remark done'); // so it can't eat into a test's quiet period
  await p.eval('WL.brain.resetCooldowns(); true');
  return p;
}

const said = (p) => p.eval('WL.brain.lastSaid || null');
const pool = (p, event) => p.eval(`WL.voice.pool(${JSON.stringify(event)}, WL.brain.vibe())`);
const bubble = (p) => p.eval(`(() => { const b = document.querySelector('webling-root').shadowRoot.querySelector('.bubble.on'); return b && b.textContent; })()`);

// A real click on the pet, once it's standing still enough to hit.
async function pokePet(p) {
  await p.until(`!['jump', 'fall'].includes(WL.me.mode)`, 4000, 'pet landed');
  await p.eval(`WL.me.mode === 'walk' && (WL.me.mode = 'idle', WL.me.think = 5); true`);
  const at = await p.eval('({ x: WL.me.sx, y: WL.me.sy - WL.me.h / 2 })');
  for (const type of ['mousePressed', 'mouseReleased']) {
    await p.send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
  }
}

test('pokes escalate: playful, then annoyed, then done with you (and it costs aura)', { skip }, async () => {
  const p = await page();
  try {
    const auraBefore = await p.eval(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.aura)`);
    const seen = [];
    for (let i = 1; i <= 10; i++) {
      await pokePet(p);
      await p.until(`WL.brain.lastSaid && WL.brain.lastSaid.n !== ${i}`, 2000);
      seen.push((await said(p)).event);
      await p.eval(`WL.brain.lastSaid.n = ${i}; true`);
    }
    assert.ok(['poke', 'hungry'].includes(seen[0]), `first poke said ${seen[0]}`);
    assert.deepEqual(seen.slice(4, 9), Array(5).fill('poke_annoyed'));
    assert.equal(seen[9], 'poke_done');
    const last = await said(p);
    assert.ok((await pool(p, 'poke_done')).map((l) => l.replace(/\{\w+\}/g, '')).includes(last.text));
    assert.equal(await bubble(p), last.text, 'shown in the speech bubble');
    await p.until(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.aura === ${auraBefore - 5})`, 3000, 'poke spam costs 5 aura');
    assert.deepEqual(p.errors, []);
  } finally {
    p.close();
  }
});

test('eating says something about the meal and earns aura', { skip }, async () => {
  const p = await page();
  try {
    const before = await p.eval(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.aura)`);
    const id = await p.eval('fx.banner()');
    await p.until(`WL.brain.lastSaid?.event === 'eat_start_cookie'`, 8000, 'spots the snack');
    await p.until(`fx.gone('${id}')`, 12000, 'banner eaten');
    const events = await p.eval('WL.brain.history.map((h) => h.event)');
    // Other things can come up mid-meal (a landing, an aura tier), but the meal gets its quip.
    const meal = events.slice(events.lastIndexOf('eat_start_cookie') + 1);
    assert.ok(meal.some((e) => ['ate_cookie', 'ate_accept_all'].includes(e)), `after the meal it said ${meal.join(', ')}`);
    await p.until(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.aura === ${before + 10})`, 3000, '+10 aura');
  } finally {
    p.close();
  }
});

test('a milestone waits for the meal quip to finish instead of talking over it', { skip }, async () => {
  const p = await page();
  try {
    await p.eval(`WL.brain.say('ate_cookie'); WL.brain.announce('tier_up', { tier: 'main character' }); true`);
    assert.equal((await said(p)).event, 'ate_cookie', 'the quip stays up');
    await p.until(`WL.brain.lastSaid.event === 'tier_up'`, 4000, 'then the milestone');
  } finally {
    p.close();
  }
});

test('getting yeeted gets a reaction', { skip }, async () => {
  const p = await page();
  try {
    await p.until(`!['jump', 'fall'].includes(WL.me.mode)`, 4000);
    await p.eval(`WL.me.mode = 'idle'; WL.me.think = 5; true`);
    const at = await p.eval('({ x: WL.me.sx, y: WL.me.sy - WL.me.h / 2 })');
    await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
    for (let i = 1; i <= 8; i++) {
      await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at.x + i * 40, y: at.y - i * 30, button: 'left' });
      await new Promise((r) => setTimeout(r, 8));
    }
    await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x + 320, y: at.y - 240, button: 'left', clickCount: 1 });
    await p.until(`['thrown', 'held'].includes(WL.brain.lastSaid?.event) && WL.brain.lastSaid.event === 'thrown'`, 3000, 'thrown line');
  } finally {
    p.close();
  }
});

test('doomscrolling gets called out', { skip }, async () => {
  const p = await page();
  try {
    await p.eval(`(async () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      for (let i = 0; i < 40; i++) {
        scrollTo(0, i % 2 ? max : 0);
        await new Promise((r) => setTimeout(r, 30));
      }
    })()`);
    await p.until(`WL.brain.lastSaid?.event === 'doomscroll'`, 3000, 'doomscroll line');
  } finally {
    p.close();
  }
});

test('arriving on a site picks a fitting take', { skip }, async () => {
  const p = await page();
  try {
    const late = await p.eval('new Date().getHours() < 5');
    const pick = (r) => p.eval(`(() => {
      const random = Math.random;
      Math.random = () => 0; // take the first option that applies
      try { WL.brain.arrive(${JSON.stringify(r)}); } finally { Math.random = random; }
      return WL.brain.lastSaid.event;
    })()`);
    const lateOr = (e) => (late ? 'time_late' : e);
    assert.equal(await pick({ isNew: true, visits: 1 }), lateOr('arrive_new'));
    assert.equal(await pick({ isNew: false, visits: 30 }), lateOr('arrive_regular'));
    assert.match(await p.eval('WL.brain.lastSaid.text'), late ? /./ : /\S/);
  } finally {
    p.close();
  }
});

test('poses render: side-eye, unimpressed, shocked and the vibe dance', { skip }, async () => {
  const p = await page();
  try {
    for (const pose of ['sideeye', 'meh', 'shock', 'dance']) {
      await p.until(`!['jump', 'fall'].includes(WL.me.mode)`, 4000);
      await p.eval(`WL.me.mode = 'idle'; WL.me.strike('${pose}', 2); true`);
      await p.until(`WL.me.clip === '${pose}'`, 1500, `${pose} shown`);
    }
    assert.deepEqual(p.errors, []);
  } finally {
    p.close();
  }
});
