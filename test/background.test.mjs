import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadShared } from '../scripts/load-shared.mjs';

// Run background.js against an in-memory chrome.* stand-in.
function boot(extra = {}) {
  const store = {}, listeners = [], installs = [], opened = [], commands = [];
  const chrome = {
    storage: {
      local: {
        get: async (keys) => Object.fromEntries([].concat(keys).filter((k) => k in store).map((k) => [k, structuredClone(store[k])])),
        set: async (obj) => Object.assign(store, structuredClone(obj)),
      },
    },
    runtime: { onMessage: { addListener: (f) => listeners.push(f) }, onInstalled: { addListener: (f) => installs.push(f) } },
    tabs: { create: (t) => opened.push(t.url) },
    commands: { onCommand: { addListener: (f) => commands.push(f) } },
  };
  loadShared(['shared/pet.js', 'shared/voice.js', 'background.js'], { chrome, structuredClone, ...extra });
  const send = (msg) => new Promise((res) => listeners[0](msg, {}, res));
  return { send, store, opened, install: () => installs[0]({ reason: 'install' }), command: (c) => commands[0](c) };
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

test('visits are counted per site, and old saves without counts still work', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Mochi' });
  bg.store.passport = { 'old.example': 1700000000000 }; // a save from before visit counts
  let r = await bg.send({ type: 'visit', host: 'old.example' });
  assert.equal(r.isNew, false);
  assert.equal(r.visits, 2);
  r = await bg.send({ type: 'visit', host: 'new.example' });
  assert.equal(r.isNew, true);
  assert.equal(r.visits, 1);
  for (let i = 0; i < 3; i++) r = await bg.send({ type: 'visit', host: 'new.example' });
  assert.equal(r.visits, 4);
  assert.equal(bg.store.pet.stats.sites, 1, 'only new sites count as explored');
});

test('aura: meals and boops earn it, spitting food out costs it', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Mochi' });
  let s = await bg.send({ type: 'ate', kind: 'popup' });
  assert.equal(s.pet.aura, 15);
  s = await bg.send({ type: 'boop' });
  assert.equal(s.pet.aura, 18);
  s = await bg.send({ type: 'uneat', kind: 'popup' });
  assert.equal(s.pet.aura, 18 - 15 - 8);
});

test('aura the page reports: only known reasons, at most once per 8s each', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Mochi' });
  assert.equal((await bg.send({ type: 'aura', reason: 'landing' })).delta, 4);
  assert.equal((await bg.send({ type: 'aura', reason: 'landing' })).delta, 0, 'rate limited');
  assert.equal((await bg.send({ type: 'aura', reason: 'thrown' })).delta, -3);
  assert.equal((await bg.send({ type: 'aura', reason: 'popup' })).delta, 0, 'meals only count through "ate"');
  assert.equal((await bg.send({ type: 'aura', reason: 'free_aura_pls' })).delta, 0);
  assert.equal(bg.store.pet.aura, 1);
});

test('a vibe can be picked at hatching or changed later; anything else lets the egg decide', async () => {
  const bg = boot();
  await bg.install();
  let s = await bg.send({ type: 'hatch', name: 'Mochi', vibe: 'not-a-vibe' });
  assert.equal(s.pet.vibe, undefined, 'unknown vibes are ignored');
  s = await bg.send({ type: 'setVibe', vibe: 'dramatic' });
  assert.equal(s.pet.vibe, 'dramatic');
  s = await bg.send({ type: 'setVibe', vibe: '<script>' });
  assert.equal(s.pet.vibe, 'dramatic');

  const bg2 = boot();
  await bg2.install();
  s = await bg2.send({ type: 'hatch', name: 'Bean', vibe: 'wholesome' });
  assert.equal(s.pet.vibe, 'wholesome');
});

test('the week counts pages, late nights, kinds of site, doomscrolls and yeets (for Wrapped)', async () => {
  class Night extends Date { getHours() { return 3; } }
  const bg = boot({ Date: Night });
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Owl' });
  for (const host of ['linkedin.com', 'www.linkedin.com', 'amazon.in', 'my-blog.dev']) await bg.send({ type: 'visit', host });
  assert.equal((await bg.send({ type: 'noticed', what: 'doomscroll' })).ok, true);
  assert.equal((await bg.send({ type: 'noticed', what: 'doomscroll' })).ok, false, 'once a minute');
  assert.equal((await bg.send({ type: 'noticed', what: 'anything' })).ok, false);
  await bg.send({ type: 'aura', reason: 'thrown' });
  const w = bg.store.pet.week;
  assert.equal(w.visits, 4);
  assert.equal(w.sites, 3);
  assert.equal(w.late, 4, 'all at 3am');
  assert.deepEqual({ ...w.kinds }, { linkedin: 2, shopping: 1 });
  assert.equal(w.doomscrolls, 1);
  assert.equal(w.yeets, 1);
});

test('a week rolls into lastWeek with the aura it gained; opening Wrapped marks it seen', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Bean' });
  await bg.send({ type: 'ate', kind: 'popup' }); // +15 aura
  bg.store.pet.week.start -= 8 * 864e5;
  const s = await bg.send({ type: 'state' });
  assert.equal(s.pet.lastWeek.popups, 1);
  assert.equal(s.pet.lastWeek.auraEnd - s.pet.lastWeek.auraStart, 15);
  assert.equal(s.pet.week.popups, 0);
  assert.equal(s.pet.week.auraStart, s.pet.aura);
  assert.equal(s.pet.lastWeek.seen, undefined);
  assert.equal((await bg.send({ type: 'wrappedSeen' })).pet.lastWeek.seen, true);
});

test('weeks saved before Wrapped (no visits, kinds or aura) still roll and count', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Old' });
  bg.store.pet.week = { start: Date.now(), cookies: 2, popups: 0, sites: 1, boops: 0 };
  await bg.send({ type: 'visit', host: 'reddit.com' });
  assert.equal(bg.store.pet.week.visits, 1);
  assert.equal(bg.store.pet.week.kinds.reddit, 1);
});

test('the shortcut puts the pet away and brings it back; pets can be switched off per site', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Shy' });
  assert.equal((await bg.send({ type: 'state' })).settings.hidden, false);
  bg.command('toggle-pet');
  assert.equal((await bg.send({ type: 'state' })).settings.hidden, true);
  bg.command('toggle-pet');
  bg.command('something-else');
  assert.equal((await bg.send({ type: 'state' })).settings.hidden, false);
  assert.equal((await bg.send({ type: 'settings', patch: { hidden: 1 } })).settings.hidden, true, 'the popup switch too');
  let s = await bg.send({ type: 'sitePet', host: 'docs.example.com', on: false });
  assert.deepEqual([...s.settings.noPet], ['docs.example.com']);
  s = await bg.send({ type: 'sitePet', host: 'docs.example.com', on: true });
  assert.deepEqual([...s.settings.noPet], []);
  assert.deepEqual([...s.settings.noEat], [], 'eating switches are separate');
});

test('focus sessions: start, slips once per distracting site, quit early or finish for aura', async () => {
  const bg = boot();
  await bg.install();
  await bg.send({ type: 'hatch', name: 'Monk' });
  assert.equal((await bg.send({ type: 'focusStart', mins: 7 })).ok, false, 'only the offered lengths');
  let s = await bg.send({ type: 'focusStart', mins: 25 });
  assert.equal(s.pet.focus.mins, 25);
  assert.equal((await bg.send({ type: 'focusSlip', host: 'www.youtube.com' })).count, 1);
  assert.equal((await bg.send({ type: 'focusSlip', host: 'youtube.com' })).ok, false, 'once per site');
  assert.equal((await bg.send({ type: 'focusSlip', host: 'docs.python.org' })).ok, false, 'work sites are fine');
  assert.equal((await bg.send({ type: 'focusSlip', host: 'reddit.com' })).count, 2);

  s = await bg.send({ type: 'focusEnd' });
  assert.equal(s.done, false, 'quit early');
  assert.equal(s.pet.focus, null);
  assert.equal(s.pet.stats.focus, undefined);

  await bg.send({ type: 'focusStart', mins: 50 });
  bg.store.pet.focus.end = Date.now() - 10;
  const aura = bg.store.pet.aura;
  s = await bg.send({ type: 'focusEnd' });
  assert.equal(s.done, true);
  assert.equal(s.pet.aura - aura, 20);
  assert.equal(s.pet.stats.focus, 1);
  assert.equal(s.pet.week.focus, 1);
  assert.equal(s.pet.week.slips, 2);
  assert.equal((await bg.send({ type: 'focusEnd' })).ok, false, 'only one tab gets to finish it');
});
