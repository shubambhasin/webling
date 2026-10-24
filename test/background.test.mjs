import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadShared } from '../scripts/load-shared.mjs';

// Run background.js against an in-memory chrome.* stand-in.
function boot() {
  const store = {}, listeners = [], installs = [], opened = [];
  const chrome = {
    storage: {
      local: {
        get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, structuredClone(store[k])])),
        set: async (obj) => Object.assign(store, structuredClone(obj)),
      },
    },
    runtime: { onMessage: { addListener: (f) => listeners.push(f) }, onInstalled: { addListener: (f) => installs.push(f) } },
    tabs: { create: (t) => opened.push(t.url) },
  };
  loadShared(['shared/pet.js', 'background.js'], { chrome, structuredClone });
  const send = (msg) => new Promise((res) => listeners[0](msg, {}, res));
  return { send, store, opened, install: () => installs[0]({ reason: 'install' }) };
}

test('install creates an egg and opens the welcome page', async () => {
  const bg = boot();
  await bg.install();
  assert.equal(bg.store.pet.hatched, false);
  assert.equal(bg.opened.join(), 'popup/popup.html?welcome=1');
});

test('hatching, visiting, eating and undoing', async () => {
  const bg = boot();
  await bg.install();
  let s = await bg.send({ type: 'visit', host: 'example.com' });
  assert.equal(s.isNew, false, 'eggs do not explore');

  s = await bg.send({ type: 'hatch', name: 'Mochi', presence: false });
  assert.equal(s.pet.name, 'Mochi');
  assert.equal(s.settings.presence, false);

  assert.equal((await bg.send({ type: 'visit', host: 'www.Example.com' })).isNew, true);
  assert.equal((await bg.send({ type: 'visit', host: 'example.com' })).isNew, false, 'www. and case are ignored');

  s = await bg.send({ type: 'ate', kind: 'cookie' });
  s = await bg.send({ type: 'ate', kind: 'popup' });
  assert.equal(s.pet.stats.cookies, 1);
  assert.equal(s.pet.stats.popups, 1);
  assert.equal(s.pet.xp, 5 + 15 + 20);
  assert.equal(s.sites, 1);

  s = await bg.send({ type: 'uneat', kind: 'popup' });
  assert.equal(s.pet.stats.popups, 0);
  assert.equal(s.pet.xp, 20);
});

test('snacks have a cooldown', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Bean' });
  assert.equal((await bg.send({ type: 'snack' })).ok, true);
  const again = await bg.send({ type: 'snack' });
  assert.equal(again.ok, false);
  assert.ok(again.wait > 0);
});

test('per-site eating toggle', async () => {
  const bg = boot();
  await bg.install();
  let s = await bg.send({ type: 'siteEat', host: 'news.example', on: false });
  assert.equal(JSON.stringify(s.settings.noEat), '["news.example"]');
  s = await bg.send({ type: 'siteEat', host: 'news.example', on: true });
  assert.equal(s.settings.noEat.length, 0);
});

test('concurrent messages from several tabs are all applied', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Dot' });
  await Promise.all(Array.from({ length: 10 }, () => bg.send({ type: 'boop' })));
  assert.equal(bg.store.pet.stats.boops, 10);
});
