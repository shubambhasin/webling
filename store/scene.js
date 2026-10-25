// Store screenshots: runs the real extension on a mock page, like the dev harness, with a pet made to
// order. ?preset= picks the pet (see PRESETS); ?store= keeps its saved state apart from other frames.
// Pages that load this are popups when they have an #app element, web pages otherwise.
(async () => {
  const q = new URLSearchParams(location.search);
  const DAY = 864e5;
  const PRESETS = {
    egg: null, // not hatched yet
    mochi: { name: 'Mochi', vibe: 'chaotic', seed: 'mochi7', xp: 260, aura: 312, days: 12, sites: 48, fullness: 72,
      stats: { cookies: 37, popups: 21 } },
    legend: { name: 'Mochi', vibe: 'chaotic', seed: 'mochi7', xp: 1820, aura: 3140, days: 94, sites: 412, fullness: 88,
      stats: { cookies: 613, popups: 388 } },
  };
  const preset = q.has('preset') ? PRESETS[q.get('preset')] : PRESETS.mochi;

  const load = (src) => new Promise((ok, fail) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = ok;
    el.onerror = fail;
    document.body.appendChild(el);
  });
  const ext = '../extension/';
  await load('../dev/chrome-shim.js');
  for (const f of ['shared/config.js', 'shared/sprite.js', 'shared/pet.js', 'shared/voice.js', 'background.js']) await load(ext + f);
  if (q.has('halo')) WL.config.halo = true;

  await devInstall();
  const send = (msg) => chrome.runtime.sendMessage(msg);
  if (preset && !(await send({ type: 'state' })).pet.hatched) {
    await send({ type: 'hatch', name: preset.name, presence: false, vibe: preset.vibe });
    const s = await chrome.storage.local.get(['pet', 'passport']);
    const now = Date.now();
    Object.assign(s.pet, {
      seed: preset.seed, xp: preset.xp, aura: preset.aura, fullness: preset.fullness, fullnessAt: now,
      born: now - preset.days * DAY, hatchedAt: now - preset.days * DAY, stats: { ...s.pet.stats, ...preset.stats },
    });
    // this page counts as a site it already knows, so it doesn't celebrate a new one in the picture
    s.passport = Object.fromEntries([location.hostname, ...Array.from({ length: preset.sites - 1 }, (_, i) => `site-${i}.example`)]
      .map((host) => [host, { t: now, n: 3 }]));
    await chrome.storage.local.set(s);
  }

  if (document.getElementById('app')) {
    for (const f of ['popup/card.js', 'popup/popup.js']) await load(ext + f);
  } else {
    const manifest = await (await fetch(`${ext}manifest.json`)).json();
    for (const f of manifest.content_scripts[0].js) if (!f.startsWith('shared/')) await load(ext + f);
  }
  document.documentElement.dataset.ready = '1';
})();
