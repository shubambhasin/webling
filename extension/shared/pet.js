// Rules for a pet's life: how it grows, gets hungry and what it earns. Shared by the background,
// the popup and the content scripts so they always agree.
(() => {
  const WL = (globalThis.WL ||= {});
  const HOUR = 3600e3, DAY = 24 * HOUR, WEEK = 7 * DAY;

  const STAGES = [
    { id: 'baby', min: 0, label: 'Baby' },
    { id: 'adult', min: 120, label: 'Grown-up' },
    { id: 'legend', min: 1500, label: 'Legend' },
  ];
  const NAMES = ['Mochi', 'Pixel', 'Bean', 'Noodle', 'Tofu', 'Biscuit', 'Mango', 'Gizmo', 'Nugget', 'Boba',
    'Waffle', 'Sprout', 'Kiwi', 'Dot', 'Byte', 'Momo', 'Taco', 'Ziggy', 'Pudding', 'Crumb'];

  // A week of stats, for the popup and Webling Wrapped. visits counts every page; sites only new ones; late is
  // pages opened between midnight and 5am; kinds counts visits per kind of site (voice.js SITES). Aura gained
  // is aura at the end minus auraStart. Saves from before Wrapped lack the newer fields; read them as 0.
  const emptyWeek = (now, aura = 0) => ({
    start: now, cookies: 0, popups: 0, sites: 0, boops: 0, visits: 0, late: 0, doomscrolls: 0, yeets: 0, kinds: {}, auraStart: aura,
  });

  const model = {
    HOUR, DAY, WEEK, STAGES, NAMES,
    XP: { site: 5, cookie: 15, popup: 20, boop: 1, booped: 2 },
    // Aura: earned by being iconic, lost by being undignified. Only these reasons are accepted.
    AURA: { site: 2, cookie: 10, popup: 15, boop: 3, booped: 5, snack: 2, landing: 4, thrown: -3, poke_spam: -5, spat: -8 },
    AURA_TIERS: [
      { min: -Infinity, label: 'aura debt' },
      { min: 0, label: 'NPC' },
      { min: 50, label: 'side character' },
      { min: 250, label: 'main character' },
      { min: 1000, label: 'aura farmer' },
      { min: 3000, label: 'final boss' },
    ],
    AURA_MIN: -100,
    FOOD: { cookie: 20, popup: 30, snack: 30 },
    HUNGER_PER_HOUR: 4,
    SNACK_COOLDOWN: 3 * HOUR,

    stage(p) {
      if (!p?.hatched) return 'egg';
      let s = STAGES[0];
      for (const st of STAGES) if (p.xp >= st.min) s = st;
      return s.id;
    },
    stageInfo(id) {
      return STAGES.find((s) => s.id === id) || { id: 'egg', min: 0, label: 'Egg' };
    },
    progress(p) {
      const i = STAGES.findIndex((s) => s.id === model.stage(p));
      const cur = STAGES[Math.max(0, i)], next = STAGES[i + 1] || null;
      return { cur, next, frac: next ? (p.xp - cur.min) / (next.min - cur.min) : 1 };
    },
    fullness(p, now = Date.now()) {
      const f = p.fullness - (model.HUNGER_PER_HOUR * (now - p.fullnessAt)) / HOUR;
      return Math.max(0, Math.min(100, f));
    },
    mood(p, now) {
      const f = model.fullness(p, now);
      return f < 20 ? 'hungry' : f < 55 ? 'peckish' : 'full';
    },
    feed(p, amount, now = Date.now()) {
      p.fullness = Math.min(100, model.fullness(p, now) + amount);
      p.fullnessAt = now;
    },
    auraTier(p) {
      const a = p?.aura || 0;
      let t = model.AURA_TIERS[0];
      for (const tier of model.AURA_TIERS) if (a >= tier.min) t = tier;
      return t.label;
    },
    // Apply an aura reason to p; returns the change actually made.
    addAura(p, reason) {
      const d = model.AURA[reason];
      if (!d) return 0;
      const before = p.aura || 0;
      p.aura = Math.max(model.AURA_MIN, before + d);
      return p.aura - before;
    },
    ageDays(p, now = Date.now()) {
      return Math.max(1, Math.ceil((now - (p.hatchedAt || p.born)) / DAY));
    },
    cleanName(s) {
      return String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
    },
    randomName() {
      return NAMES[Math.floor(Math.random() * NAMES.length)];
    },
    newPet(now = Date.now()) {
      const rand = () => Math.random().toString(36).slice(2, 10);
      return {
        id: rand() + rand(),
        seed: rand(),
        name: '',
        hatched: false,
        born: now,
        hatchedAt: 0,
        xp: 0,
        aura: 0,
        fullness: 80,
        fullnessAt: now,
        snackAt: 0,
        stats: { cookies: 0, popups: 0, sites: 0, boops: 0, booped: 0 },
        week: emptyWeek(now),
        lastWeek: null,
      };
    },
    rollWeek(p, now = Date.now()) {
      if (now - p.week.start < WEEK) return false;
      p.lastWeek = { ...p.week, auraEnd: p.aura || 0 };
      p.week = emptyWeek(now, p.aura || 0);
      return true;
    },
  };

  WL.model = model;
})();
