// Owns the pet's saved state. Content scripts and the popup send messages here, and changes are
// applied one at a time so several open tabs never overwrite each other.
if (typeof importScripts === 'function') importScripts('shared/pet.js', 'shared/voice.js');

const M = WL.model;
// hidden: the shortcut (or popup) put the pet away everywhere. noPet: sites where it never shows up.
const DEFAULT_SETTINGS = { presence: true, eat: true, noEat: [], hidden: false, noPet: [] };
const MAX_PASSPORT = 5000;
const PAGE_AURA = new Set(['landing', 'thrown', 'poke_spam']);
const NOTICED = new Set(['doomscroll']);
const auraAt = {}, noticedAt = {};
const bump = (o, k, n = 1) => (o[k] = (o[k] || 0) + n);

async function load() {
  const s = await chrome.storage.local.get(['pet', 'settings', 'passport']);
  return {
    pet: s.pet || M.newPet(),
    settings: { ...DEFAULT_SETTINGS, ...s.settings },
    passport: s.passport || {},
  };
}

let queue = Promise.resolve();
function mutate(fn) {
  const run = queue.then(async () => {
    const s = await load();
    M.rollWeek(s.pet);
    const result = fn(s);
    const save = { pet: s.pet, settings: s.settings };
    if (s.passportChanged) save.passport = s.passport;
    await chrome.storage.local.set(save);
    return result === undefined ? view(s) : result;
  });
  queue = run.catch(() => {});
  return run;
}

const view = (s) => ({ pet: s.pet, settings: s.settings, sites: Object.keys(s.passport).length });

const handlers = {
  state: () => mutate(() => {}),

  // vibe is optional: one of the five, or anything else to let the egg decide (from its seed).
  hatch: ({ name, presence, vibe }) => mutate((s) => {
    if (!s.pet.hatched) {
      s.pet.hatched = true;
      s.pet.hatchedAt = Date.now();
    }
    s.pet.name = M.cleanName(name) || s.pet.name || M.randomName();
    if (WL.voice.VIBES[vibe]) s.pet.vibe = vibe;
    s.settings.presence = presence !== false;
  }),

  // Change vibe later (the site's vibe check can do this).
  setVibe: ({ vibe }) => mutate((s) => {
    if (WL.voice.VIBES[vibe]) s.pet.vibe = vibe;
  }),

  rename: ({ name }) => mutate((s) => {
    s.pet.name = M.cleanName(name) || s.pet.name;
  }),

  // Returns { isNew, visits } so the pet can tell a first visit from a site you live on.
  visit: ({ host }) => mutate((s) => {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (!s.pet.hatched || !host) return { isNew: false, visits: 0 };
    const w = s.pet.week, kind = WL.voice.siteKind(host);
    bump(w, 'visits');
    if (new Date().getHours() < 5) bump(w, 'late');
    if (kind) bump((w.kinds ||= {}), kind);
    let entry = s.passport[host];
    if (typeof entry === 'number') entry = { t: entry, n: 1 }; // saves from before visit counts
    if (entry) {
      entry.n++;
      s.passport[host] = entry;
      s.passportChanged = true;
      return { isNew: false, visits: entry.n };
    }
    if (Object.keys(s.passport).length < MAX_PASSPORT) {
      s.passport[host] = { t: Date.now(), n: 1 };
      s.passportChanged = true;
    }
    s.pet.xp += M.XP.site;
    M.addAura(s.pet, 'site');
    s.pet.stats.sites++;
    s.pet.week.sites++;
    return { isNew: true, visits: 1 };
  }),

  ate: ({ kind }) => mutate((s) => {
    const k = kind === 'cookie' ? 'cookie' : 'popup';
    s.pet.xp += M.XP[k];
    M.addAura(s.pet, k);
    s.pet.stats[k === 'cookie' ? 'cookies' : 'popups']++;
    s.pet.week[k === 'cookie' ? 'cookies' : 'popups']++;
    M.feed(s.pet, M.FOOD[k]);
  }),

  // Undo after eating: give back what the meal earned, and spitting food out is not a good look.
  uneat: ({ kind }) => mutate((s) => {
    const k = kind === 'cookie' ? 'cookie' : 'popup';
    const stat = k === 'cookie' ? 'cookies' : 'popups';
    s.pet.xp = Math.max(0, s.pet.xp - M.XP[k]);
    s.pet.aura = Math.max(M.AURA_MIN, (s.pet.aura || 0) - M.AURA[k]);
    M.addAura(s.pet, 'spat');
    s.pet.stats[stat] = Math.max(0, s.pet.stats[stat] - 1);
    s.pet.week[stat] = Math.max(0, s.pet.week[stat] - 1);
  }),

  boop: () => mutate((s) => {
    s.pet.xp += M.XP.boop;
    M.addAura(s.pet, 'boop');
    s.pet.stats.boops++;
    s.pet.week.boops++;
  }),

  booped: () => mutate((s) => {
    s.pet.xp += M.XP.booped;
    M.addAura(s.pet, 'booped');
    s.pet.stats.booped++;
  }),

  // Aura the page itself reports (landings, throws, poke spam), at most once per reason per 8s.
  aura: ({ reason }) => {
    if (!PAGE_AURA.has(reason)) return { delta: 0 };
    const now = Date.now();
    if (now - (auraAt[reason] || 0) < 8000) return { delta: 0 };
    auraAt[reason] = now;
    return mutate((s) => {
      if (reason === 'thrown') bump(s.pet.week, 'yeets');
      return { delta: M.addAura(s.pet, reason), ...view(s) };
    });
  },

  // The popup opened last week's Wrapped, so it stops being "new".
  wrappedSeen: () => mutate((s) => {
    if (s.pet.lastWeek) s.pet.lastWeek.seen = true;
  }),

  // Things the page noticed that Wrapped counts (doomscrolling), at most once a minute each.
  noticed: ({ what }) => {
    if (!NOTICED.has(what) || Date.now() - (noticedAt[what] || 0) < 60e3) return { ok: false };
    noticedAt[what] = Date.now();
    return mutate((s) => {
      bump(s.pet.week, `${what}s`);
      return { ok: true };
    });
  },

  // Focus sessions. pet.focus is { start, end, mins, slips: [hosts] } while one runs. Ending it on or after its
  // end time finishes it (aura, xp, counted for Wrapped); ending it sooner just stops it. Whichever tab or
  // popup notices the time is up ends it; the rest see focus go back to null.
  focusStart: ({ mins }) => mutate((s) => {
    if (!s.pet.hatched || !M.FOCUS_MINS.includes(mins)) return { ok: false, ...view(s) };
    const now = Date.now();
    if (!s.pet.focus || s.pet.focus.end <= now) s.pet.focus = { start: now, end: now + mins * 60e3, mins, slips: [] };
    return { ok: true, ...view(s) };
  }),

  focusEnd: () => mutate((s) => {
    const f = s.pet.focus;
    if (!f) return { ok: false, ...view(s) };
    s.pet.focus = null;
    const done = Date.now() >= f.end - 1000;
    if (done) {
      s.pet.xp += M.FOCUS_XP;
      M.addAura(s.pet, 'focus');
      bump(s.pet.stats, 'focus');
      bump(s.pet.week, 'focus');
    }
    return { ok: true, done, mins: f.mins, slips: f.slips.length, ...view(s) };
  }),

  // A distracting site opened during a session: counted once per site.
  focusSlip: ({ host }) => mutate((s) => {
    const f = s.pet.focus;
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (!f || Date.now() >= f.end || !WL.voice.distracting(host) || f.slips.includes(host)) return { ok: false };
    f.slips.push(host);
    bump(s.pet.week, 'slips');
    return { ok: true, count: f.slips.length };
  }),

  snack: () => mutate((s) => {
    const wait = s.pet.snackAt + M.SNACK_COOLDOWN - Date.now();
    if (wait > 0) return { ok: false, wait, ...view(s) };
    M.feed(s.pet, M.FOOD.snack);
    M.addAura(s.pet, 'snack');
    s.pet.snackAt = Date.now();
    return { ok: true, ...view(s) };
  }),

  settings: ({ patch }) => mutate((s) => {
    for (const k of ['presence', 'eat', 'hidden']) if (k in (patch || {})) s.settings[k] = !!patch[k];
  }),

  // Per-site switches: eating on this site, and the pet on this site at all.
  siteEat: ({ host, on }) => mutate((s) => siteList(s, 'noEat', host, on)),
  sitePet: ({ host, on }) => mutate((s) => siteList(s, 'noPet', host, on)),
};

function siteList(s, key, host, on) {
  const list = new Set(s.settings[key]);
  if (on) list.delete(host);
  else list.add(host);
  s.settings[key] = [...list].slice(-500);
}

// The keyboard shortcut (Alt+Shift+W unless the user changed it): put the pet away, or bring it back.
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'toggle-pet') mutate((s) => { s.settings.hidden = !s.settings.hidden; });
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const h = handlers[msg?.type];
  if (!h) return false;
  Promise.resolve(h(msg, sender)).then(reply, (e) => reply({ error: String(e) }));
  return true;
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await mutate(() => {});
  if (reason === 'install') chrome.tabs.create({ url: 'popup/popup.html?welcome=1' });
});
