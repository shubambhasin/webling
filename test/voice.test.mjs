import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadShared } from '../scripts/load-shared.mjs';

const { WL } = loadShared(['shared/config.js', 'shared/sprite.js', 'shared/pet.js', 'shared/voice.js']);
const { voice: V, model: M } = WL;
const VARS = { name: 'Mochi', host: 'example.com', n: 23, mins: 14, time: '3:12 AM', other: 'Bean', tier: 'main character' };

// Every event the code asks for (grep for say('…') / remark('…') when adding new ones).
const USED = ['ambient', 'poke', 'poke_annoyed', 'poke_done', 'held', 'thrown', 'hard_landing', 'floor', 'sleep', 'wake',
  'hungry', 'fed', 'eat_start_cookie', 'eat_start_popup', 'ate_cookie', 'ate_popup', 'ate_accept_all', 'ate_discount',
  'ate_newsletter', 'spat', 'grew_adult', 'grew_legend', 'tier_up', 'arrive_new', 'arrive_again', 'arrive_regular',
  'time_late', 'time_morning', 'time_monday', 'time_friday', 'time_weekend', 'doomscroll', 'reading_long', 'tab_back',
  'copy', 'wiggle', 'unhide', 'ghost_join', 'crowd', 'booped', 'boop_sent', 'ghost_hi',
  ...Object.keys(V.SITES).map((k) => `site_${k}`)];

// Words that have no place in a pet's mouth.
const BANNED = /\b(fuck|shit|bitch|damn|hell|crap|ass|sex|kill|die|dead|suicide|unalive|stupid|idiot|dumb|ugly|fat|hate)\b/i;

test('every event the pet uses has lines for every vibe', () => {
  for (const event of USED) {
    for (const vibe of V.VIBE_IDS) {
      assert.ok(V.pool(event, vibe).length > 0, `${event} has no lines for ${vibe}`);
    }
  }
});

test('every event named in the code exists (so nothing silently says nothing)', () => {
  const files = ['content/brain.js', 'content/eater.js', 'content/presence.js', 'content/main.js', 'content/actor.js', 'popup/popup.js'];
  const named = new Set();
  for (const f of files) {
    const src = readFileSync(new URL(`../extension/${f}`, import.meta.url), 'utf8');
    for (const [, args] of src.matchAll(/\b(?:say|remark|speak|line)\(([^;]*?)(?:,\s*\{|\))/g)) {
      for (const [, name] of args.matchAll(/(?<!===\s*)'([a-z]+(?:_[a-z]+)*)'/g)) named.add(name); // not `x === 'y'`
    }
    for (const [, name] of src.matchAll(/return '((?:ate|eat)_[a-z_]+)'/g)) named.add(name);
  }
  assert.ok(named.size > 20, `only found ${named.size} events; is the scan broken?`);
  for (const name of named) assert.ok(V.LINES[name], `code says '${name}' but there are no lines for it`);
});

test('the busy events have plenty of variety', () => {
  for (const event of ['ambient', 'poke', 'poke_annoyed', 'ate_cookie', 'ate_popup', 'arrive_new', 'doomscroll']) {
    assert.ok(new Set(V.pool(event, 'online')).size >= 5, `${event} needs more lines`);
  }
  for (const vibe of V.VIBE_IDS) {
    assert.ok((V.LINES.ambient[vibe] || []).length >= 5, `${vibe} needs its own musings`);
  }
});

test('every line fills its placeholders, fits in a bubble and stays PG', () => {
  const all = Object.values(V.LINES).flatMap((byVibe) => Object.values(byVibe).flat());
  assert.ok(all.length > 250, `only ${all.length} lines`);
  for (const line of [...all, ...V.MANTRAS]) {
    const filled = V.fill(line, VARS);
    assert.doesNotMatch(filled, /\{\w*\}/, `unfilled placeholder in "${line}"`);
    assert.ok(filled.length <= 60, `too long for a bubble (${filled.length}): "${filled}"`);
    assert.doesNotMatch(filled, BANNED, `not PG: "${filled}"`);
  }
});

test('each pet gets a stable vibe, and every vibe turns up', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const v = V.vibeOf({ seed: `s${i}` });
    assert.equal(V.vibeOf({ seed: `s${i}` }), v);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [...V.VIBE_IDS].sort());
  assert.equal(V.vibeOf({ seed: 'x', vibe: 'dramatic' }), 'dramatic', 'a stored vibe wins');
  assert.ok(V.VIBE_IDS.includes(V.vibeOf({ seed: 'x', vibe: 'not-a-vibe' })));
});

test('sites are recognised by domain and subdomain, and nothing else', () => {
  const cases = {
    'www.linkedin.com': 'linkedin', 'in.linkedin.com': 'linkedin', 'github.com': 'dev', 'gist.github.com': 'dev',
    'amazon.in': 'shopping', 'www.amazon.co.uk': 'shopping', 'en.wikipedia.org': 'wiki', 'mail.google.com': 'mail',
    'www.google.com': 'search', 'claude.ai': 'ai', 'www.itilite.com': 'travel', 'x.com': 'social',
    'old.reddit.com': 'reddit', 'developer.mozilla.org': 'dev',
    'example.com': null, 'notlinkedin.com': null, 'linkedin.com.evil.io': null, '': null,
  };
  for (const [host, kind] of Object.entries(cases)) assert.equal(V.siteKind(host), kind, host);
});

test('lines do not repeat back to back', () => {
  let last = null;
  for (let i = 0; i < 200; i++) {
    const l = V.line('poke', 'chaotic', VARS);
    assert.notEqual(l, last);
    last = l;
  }
  assert.equal(V.line('nope', 'chaotic'), null);
  assert.equal(V.line('ate_accept_all', 'wholesome', VARS) !== null, true, 'small pools still work');
});

test("a vibe's own lines come up more than shared ones would", () => {
  const own = new Set(V.LINES.ambient.dramatic);
  let hits = 0;
  for (let i = 0; i < 600; i++) if (own.has(V.line('ambient', 'dramatic'))) hits++;
  const fair = V.LINES.ambient.dramatic.length / (V.LINES.ambient.all.length + V.LINES.ambient.dramatic.length);
  assert.ok(hits / 600 > fair, `${hits}/600 own lines`);
});

test('the mantra changes by day and stays put within a day', () => {
  const pet = { seed: 'abc' };
  const d1 = new Date(2026, 9, 25, 9), d1b = new Date(2026, 9, 25, 23);
  assert.equal(V.mantra(pet, d1), V.mantra(pet, d1b));
  const week = new Set(Array.from({ length: 7 }, (_, i) => V.mantra(pet, new Date(2026, 9, 25 + i))));
  assert.ok(week.size >= 3, 'a week of mantras should not be all the same');
});

test('aura tiers and changes', () => {
  const p = M.newPet();
  assert.equal(p.aura, 0);
  assert.equal(M.auraTier(p), 'NPC');
  assert.equal(M.addAura(p, 'popup'), 15);
  assert.equal(M.addAura(p, 'made-up'), 0);
  p.aura = 250;
  assert.equal(M.auraTier(p), 'main character');
  p.aura = 3000;
  assert.equal(M.auraTier(p), 'final boss');
  p.aura = -95;
  assert.equal(M.addAura(p, 'spat'), -5, 'aura bottoms out');
  assert.equal(M.auraTier(p), 'aura debt');
  assert.equal(M.auraTier({}), 'NPC', 'pets from before aura existed');
});

test('hostOf finds the website in whatever was typed, and rejects what is not one', () => {
  const { hostOf } = WL.voice;
  assert.equal(hostOf('https://WWW.LinkedIn.com/in/someone?x=1'), 'linkedin.com');
  assert.equal(hostOf('  amazon.in:443/cart '), 'amazon.in');
  assert.equal(hostOf('my-blog.dev'), 'my-blog.dev');
  for (const bad of ['lol', '', null, 'http://', 'a b.com', '<script>.com', 'x.c', `${'a'.repeat(250)}.com`]) {
    assert.equal(hostOf(bad), null, String(bad));
  }
});

test('a roast is the same take for the same host, vibe and number, and every number works', () => {
  const r = WL.voice.roast('linkedin.com', 'dramatic', 3);
  assert.equal(r.event, 'site_linkedin');
  assert.deepEqual(WL.voice.roast('www.linkedin.com', 'dramatic', 3), r);
  const n = new Set(WL.voice.pool('site_linkedin', 'dramatic')).size;
  assert.equal(WL.voice.roast('linkedin.com', 'dramatic', 3 + n * 7).text, r.text, 'wraps');
  assert.equal(WL.voice.roast('linkedin.com', 'dramatic', -1).t, n - 1, 'negative numbers wrap too');
  const fresh = WL.voice.roast('my-blog.dev', 'chaotic', 0);
  assert.equal(fresh.event, 'arrive_new');
  assert.ok(!/[{}]/.test(fresh.text), fresh.text);
  for (const kind of [...Object.keys(WL.voice.SITES), null]) {
    for (const vibe of WL.voice.VIBE_IDS) {
      const host = kind ? WL.voice.SITES[kind][0] : 'unknown-site.example';
      assert.ok(WL.voice.roast(host, vibe, 0).text, `${kind} ${vibe}`);
    }
  }
});

test('Wrapped: each kind of week gets its verdict, and the take is stable', () => {
  const week = (o) => ({ visits: 200, cookies: 0, popups: 0, sites: 0, late: 0, doomscrolls: 0, kinds: {}, ...o });
  const verdict = (o) => V.wrapped(week(o), 'chaotic').verdict;
  assert.equal(verdict({ visits: 3 }), 'touch_grass');
  assert.equal(verdict({ late: 12 }), 'night_owl');
  assert.equal(verdict({ doomscrolls: 6 }), 'doomscroller');
  assert.equal(verdict({ cookies: 20, popups: 15 }), 'pop_up_predator');
  assert.equal(verdict({ kinds: { shopping: 90, social: 10 } }), 'add_to_cart');
  assert.equal(verdict({ kinds: { linkedin: 80 } }), 'thought_leader');
  assert.equal(verdict({ kinds: { search: 150 } }), 'lowkey', 'search is everyone, not a personality');
  assert.equal(verdict({ kinds: { shopping: 30 } }), 'lowkey', 'under a third is not an era');
  assert.equal(verdict({ sites: 25 }), 'explorer');
  assert.equal(verdict({}), 'lowkey');
  assert.equal(V.wrapped({}, 'online').verdict, 'touch_grass', 'an empty or old week works');

  const r = V.wrapped(week({ late: 17 }), 'dramatic', 5);
  assert.deepEqual(V.wrapped(week({ late: 17 }), 'dramatic', 5), r);
  assert.equal(r.n, 17);
  assert.equal(r.label, V.VERDICTS.night_owl);
  const top = V.wrapped(week({ kinds: { shopping: 90 } }), 'chaotic');
  assert.deepEqual({ ...top.top }, { kind: 'shopping', share: 45 });
  for (const id of Object.keys(V.VERDICTS)) {
    for (const vibe of V.VIBE_IDS) assert.ok(V.pool(`wrapped_${id}`, vibe).length, `wrapped_${id} ${vibe}`);
  }
});
