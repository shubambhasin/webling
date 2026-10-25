// Owns the pet's saved state. Content scripts and the popup send messages here, and changes are
// applied one at a time so several open tabs never overwrite each other.
if (typeof importScripts === 'function') importScripts('shared/pet.js');

const M = WL.model;
const DEFAULT_SETTINGS = { presence: true, eat: true, noEat: [] };
const MAX_PASSPORT = 5000;
const PAGE_AURA = new Set(['landing', 'thrown', 'poke_spam']);
const auraAt = {};

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

  hatch: ({ name, presence }) => mutate((s) => {
    if (!s.pet.hatched) {
      s.pet.hatched = true;
      s.pet.hatchedAt = Date.now();
    }
    s.pet.name = M.cleanName(name) || s.pet.name || M.randomName();
    s.settings.presence = presence !== false;
  }),

  rename: ({ name }) => mutate((s) => {
    s.pet.name = M.cleanName(name) || s.pet.name;
  }),

  // Returns { isNew, visits } so the pet can tell a first visit from a site you live on.
  visit: ({ host }) => mutate((s) => {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (!s.pet.hatched || !host) return { isNew: false, visits: 0 };
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
    return mutate((s) => ({ delta: M.addAura(s.pet, reason), ...view(s) }));
  },

  snack: () => mutate((s) => {
    const wait = s.pet.snackAt + M.SNACK_COOLDOWN - Date.now();
    if (wait > 0) return { ok: false, wait, ...view(s) };
    M.feed(s.pet, M.FOOD.snack);
    M.addAura(s.pet, 'snack');
    s.pet.snackAt = Date.now();
    return { ok: true, ...view(s) };
  }),

  settings: ({ patch }) => mutate((s) => {
    for (const k of ['presence', 'eat']) if (k in (patch || {})) s.settings[k] = !!patch[k];
  }),

  siteEat: ({ host, on }) => mutate((s) => {
    const list = new Set(s.settings.noEat);
    if (on) list.delete(host);
    else list.add(host);
    s.settings.noEat = [...list].slice(-500);
  }),
};

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
