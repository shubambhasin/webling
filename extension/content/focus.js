// Focus sessions on a page. While one runs the pet sits and keeps watch: no wandering, no unprompted
// remarks, a small timer in the corner. Open a distracting site and it calls you out (once per site per
// session). When the time is up, the tab that notices ends the session and the pet celebrates.
(() => {
  const WL = globalThis.WL;
  let timer = null, calledOut = false;

  const focus = (WL.focus = {
    on: false,

    // Called with the pet whenever it loads or changes.
    sync(pet) {
      const f = pet?.focus;
      if (!f) return stop();
      if (Date.now() >= f.end) return finish();
      if (!focus.on) {
        focus.on = true;
        timer = setInterval(tick, 1000);
        if (WL.me.mode === 'walk') WL.me.think = 0; // stop and sit now, not after this stroll
        if (Date.now() - f.start < 5000) WL.brain.say('focus_start', {}, { ms: 3000 }); // just started
      }
      tick();
      slip(f);
    },
  });

  function stop() {
    focus.on = false;
    clearInterval(timer);
    timer = null;
    WL.overlay.focusChip(null);
  }

  function tick() {
    const f = WL.state.pet.focus;
    if (!f) return stop();
    const left = f.end - Date.now();
    if (left <= 0) return finish();
    WL.overlay.focusChip(`🎯 ${Math.ceil(left / 60e3)} min`);
  }

  async function finish() {
    stop();
    const r = await WL.bg({ type: 'focusEnd' });
    if (!r?.ok || !r.done) return; // another tab or the popup got there first
    WL.brain.say('focus_done', { mins: r.mins }, { ms: 4000 });
    WL.me.happy(3);
    WL.brain.auraFx(WL.model.AURA.focus);
    WL.fx.sparkles(WL.me.sx, WL.me.sy - WL.me.h / 2, 10);
    WL.overlay.toast(`Focus done: ${r.mins} minutes${r.slips ? `, ${r.slips} slip${r.slips === 1 ? '' : 's'}` : ', no slips'}.`);
  }

  // On a distracting site during a session: say so, once per page.
  async function slip(f) {
    const host = location.hostname.replace(/^www\./, '');
    if (calledOut || !WL.shown || !WL.voice.distracting(host)) return;
    calledOut = true;
    await WL.bg({ type: 'focusSlip', host });
    setTimeout(() => {
      WL.me.strike('sideeye', 3);
      WL.brain.say('focus_slip', { host }, { ms: 3500 });
    }, 1200);
  }
})();
