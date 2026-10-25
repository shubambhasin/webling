// Starts everything on a page: loads the pet, runs the animation loop and reacts to saved changes.
(() => {
  const WL = globalThis.WL;
  if (window.top !== window || WL.booted) return;
  WL.booted = true;

  // lastInteract starts at -Infinity ("never"); 0 would read as a click when the page loaded.
  WL.input = { lastMove: performance.now(), lastInteract: -Infinity };
  const moved = () => (WL.input.lastMove = performance.now());
  addEventListener('pointermove', moved, { passive: true, capture: true });
  addEventListener('scroll', moved, { passive: true, capture: true });
  for (const t of ['pointerdown', 'keydown']) {
    addEventListener(t, () => (WL.input.lastInteract = moved()), { passive: true, capture: true });
  }

  WL.bg = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

  let started = false;
  const host = location.hostname.replace(/^www\./, '');

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.pet) onPet(changes.pet.newValue);
    if (changes.settings && started) onSettings(changes.settings.newValue);
  });

  WL.bg({ type: 'state' }).then((state) => state?.pet?.hatched && start(state));

  function start(state) {
    if (started || !document.body) return;
    started = true;
    WL.state = state;
    WL.myLook = () => ({ name: WL.state.pet.name, seed: WL.state.pet.seed, stage: WL.model.stage(WL.state.pet) });

    WL.overlay.mount();
    WL.world.start();
    WL.pets = new Set();
    WL.me = new WL.Pet(WL.myLook());
    WL.me.mood = WL.model.mood(state.pet);
    WL.pets.add(WL.me);
    requestAnimationFrame(loop);

    WL.brain.start();
    WL.bg({ type: 'visit', host }).then((r) => {
      setTimeout(() => {
        WL.brain.arrive(r || {});
        if (r?.isNew) WL.brain.auraFx(WL.model.AURA.site);
      }, 1800);
    });
    onSettings(state.settings);
    setInterval(tick, 60e3);
  }

  function onPet(pet) {
    if (!pet) return;
    if (!started) return pet.hatched && WL.bg({ type: 'state' }).then(start);
    const old = WL.state.pet;
    const before = WL.myLook();
    WL.state.pet = pet;
    const after = WL.myLook();
    WL.me.look = after;
    WL.me.mood = WL.model.mood(pet);
    if (after.stage !== before.stage) {
      WL.brain.announce(after.stage === 'legend' ? 'grew_legend' : 'grew_adult', {}, { ms: 3200 });
      WL.me.happy(2.5);
      WL.fx.sparkles(WL.me.sx, WL.me.sy - WL.me.h / 2, 8);
      for (let i = 0; i < 5; i++) setTimeout(() => WL.fx.heart(WL.me.sx + (i - 2) * 10, WL.me.sy - WL.me.h), i * 120);
    } else if (WL.model.auraTier(pet) !== WL.model.auraTier(old) && (pet.aura || 0) > (old.aura || 0)) {
      WL.brain.announce('tier_up', { tier: WL.model.auraTier(pet) }, { ms: 3000 });
      WL.fx.sparkles(WL.me.sx, WL.me.sy - WL.me.h / 2, 8);
    } else if (pet.snackAt > old.snackAt) {
      WL.brain.say('fed');
      WL.me.happy(1.5);
    }
    if (after.name !== before.name || after.stage !== before.stage) WL.presence.updateLook();
  }

  function onSettings(s) {
    WL.state.settings = s;
    if (s.eat && !s.noEat.includes(host)) WL.eater.start();
    else WL.eater.stop();
    if (s.presence) WL.presence.start();
    else WL.presence.stop();
  }

  // Once a minute: get hungrier, and say so now and then.
  function tick() {
    WL.me.mood = WL.model.mood(WL.state.pet);
    if (WL.me.mood === 'hungry') WL.brain.remark('hungry', {}, { every: 240e3 });
  }

  // Main-character aura and up is visible: a sparkle now and then.
  const AURA_GLOW = WL.model.AURA_TIERS.find((t) => t.label === 'main character').min;

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const { ctx, canvas, dpr } = WL.overlay;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if ((WL.state.pet.aura || 0) >= AURA_GLOW && Math.random() < dt * 0.7) {
      WL.fx.emote('sparkle', WL.me.sx + (Math.random() - 0.5) * WL.me.w * 1.4, WL.me.sy - Math.random() * WL.me.h);
    }
    for (const p of WL.pets) {
      p.update(dt);
      if (p !== WL.me) p.draw(ctx, dpr);
    }
    WL.me.draw(ctx, dpr); // yours on top
    WL.fx.update(dt);
    WL.fx.draw(ctx, dpr);
    requestAnimationFrame(loop);
  }
})();
