// Owns the pet's saved state. Content scripts and the popup send messages here, and changes are
// applied one at a time so several open tabs never overwrite each other.
if (typeof importScripts === 'function') importScripts('shared/pet.js');

const M = WL.model;
const DEFAULT_SETTINGS = { presence: true, eat: true, noEat: [] };
const MAX_PASSPORT = 5000;

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

  visit: ({ host }) => mutate((s) => {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (!s.pet.hatched || !host || s.passport[host]) return { isNew: false };
    if (Object.keys(s.passport).length < MAX_PASSPORT) {
      s.passport[host] = Date.now();
      s.passportChanged = true;
    }
    s.pet.xp += M.XP.site;
    s.pet.stats.sites++;
    s.pet.week.sites++;
    return { isNew: true };
  }),

  ate: ({ kind }) => mutate((s) => {
    const k = kind === 'cookie' ? 'cookie' : 'popup';
    s.pet.xp += M.XP[k];
    s.pet.stats[k === 'cookie' ? 'cookies' : 'popups']++;
    s.pet.week[k === 'cookie' ? 'cookies' : 'popups']++;
    M.feed(s.pet, M.FOOD[k]);
  }),

  // Undo after eating: give back what the meal earned.
  uneat: ({ kind }) => mutate((s) => {
    const k = kind === 'cookie' ? 'cookie' : 'popup';
    const stat = k === 'cookie' ? 'cookies' : 'popups';
    s.pet.xp = Math.max(0, s.pet.xp - M.XP[k]);
    s.pet.stats[stat] = Math.max(0, s.pet.stats[stat] - 1);
    s.pet.week[stat] = Math.max(0, s.pet.week[stat] - 1);
  }),

  boop: () => mutate((s) => {
    s.pet.xp += M.XP.boop;
    s.pet.stats.boops++;
    s.pet.week.boops++;
  }),

  booped: () => mutate((s) => {
    s.pet.xp += M.XP.booped;
    s.pet.stats.booped++;
  }),

  snack: () => mutate((s) => {
    const wait = s.pet.snackAt + M.SNACK_COOLDOWN - Date.now();
    if (wait > 0) return { ok: false, wait, ...view(s) };
    M.feed(s.pet, M.FOOD.snack);
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
