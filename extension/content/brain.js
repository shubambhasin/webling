// The pet's personality on a page: what it notices and when it speaks up. Reactions to you (pokes,
// throws, meals) always get a line; unprompted remarks (site takes, doomscrolling, long reads,
// late nights, musings) are rationed so it's a companion, not a notification.
(() => {
  const WL = (globalThis.WL ||= {});
  const AMBIENT_GAP_MS = 35e3; // quiet time between unprompted remarks, divided by the vibe's chattiness
  const EMOTE = {
    poke_annoyed: 'sweat', poke_done: 'skull', thrown: 'exclaim', hard_landing: 'sparkle', doomscroll: 'exclaim',
    reading_long: 'skull', tab_back: 'heart', wiggle: 'question', copy: 'sparkle', grew_adult: 'sparkle',
    grew_legend: 'sparkle', tier_up: 'sparkle', booped: 'heart', time_late: 'skull', site_linkedin: 'skull',
    spat: 'sweat', hungry: 'sweat',
  };
  const host = location.hostname.replace(/^www\./, '');

  let lastAmbient = -Infinity;
  const cooldowns = {};
  let pokes = [];

  const brain = (WL.brain = {
    vibe: () => WL.voice.vibeOf(WL.state.pet),
    traits: () => WL.voice.VIBES[brain.vibe()],

    // Say a line for event now. Returns the text (or null if there's nothing to say).
    say(event, vars = {}, { ms = 2600, pet = WL.me } = {}) {
      const text = WL.voice.line(event, pet === WL.me ? brain.vibe() : WL.voice.vibeOf(pet.look), {
        name: WL.state.pet.name, host, tier: WL.model.auraTier(WL.state.pet), ...vars,
      });
      if (!text) return null;
      pet.say(text, ms);
      if (EMOTE[event]) WL.fx.emote(EMOTE[event], pet.sx + pet.w * 0.55, pet.sy - pet.h - 2);
      brain.lastSaid = { event, text };
      brain.history.push(brain.lastSaid);
      if (brain.history.length > 30) brain.history.shift();
      return text;
    },

    history: [],

    // A milestone line (tier up, growing up): waits for whatever the pet is saying to finish.
    announce(event, vars, opts) {
      setTimeout(() => brain.say(event, vars, opts), WL.me.bubble.classList.contains('on') ? 2400 : 0);
    },

    // An unprompted remark: only if it's been quiet long enough, the pet isn't busy, and this topic
    // hasn't come up within `every` ms.
    remark(event, vars, { every = 0, chance = 1 } = {}) {
      const now = performance.now(), me = WL.me;
      if (!me || me.mode === 'sleep' || me.mode === 'held' || me.busy) return null;
      if (now - lastAmbient < AMBIENT_GAP_MS / brain.traits().chatty) return null;
      if (every && now - (cooldowns[event] ?? -Infinity) < every) return null;
      if (Math.random() > chance) return null;
      lastAmbient = now;
      cooldowns[event] = now;
      return brain.say(event, vars);
    },

    // Aura the page earns or loses (landings, throws, poke spam). The background has the final say.
    async aura(reason) {
      const r = await WL.bg({ type: 'aura', reason });
      if (r?.delta) brain.auraFx(r.delta);
    },

    auraFx(delta, pet = WL.me) {
      if (!delta) return;
      WL.fx.text(`${delta > 0 ? '+' : ''}${delta} aura`, pet.sx, pet.sy - pet.h - 14, delta > 0 ? '#7c5cff' : '#e0455a');
      if (delta > 0) WL.fx.sparkles(pet.sx, pet.sy - pet.h / 2, 4);
    },

    // Things the pet itself reports (see actor.js).
    emit(pet, event, data = {}) {
      if (pet !== WL.me) return;
      const now = performance.now();
      if (event === 'poke') {
        pokes = pokes.filter((t) => now - t < 20e3);
        pokes.push(now);
        if (pokes.length >= 10) {
          brain.say('poke_done');
          if (pokes.length === 10) brain.aura('poke_spam');
          pet.strike('meh', 2.5);
        } else if (pokes.length >= 5) {
          brain.say('poke_annoyed');
          pet.strike(brain.vibe() === 'unbothered' ? 'sideeye' : 'meh', 1.5);
        } else {
          pet.hop();
          brain.say(pet.mood === 'hungry' && Math.random() < 0.5 ? 'hungry' : 'poke', {}, { ms: 1500 });
          WL.fx.heart(pet.sx, pet.sy - pet.h);
        }
      } else if (event === 'held') {
        if (now - (cooldowns.held ?? -Infinity) > 6000 && Math.random() < 0.6) {
          cooldowns.held = now;
          brain.say('held', {}, { ms: 1600 });
        }
      } else if (event === 'thrown') {
        brain.say('thrown', {}, { ms: 1400 });
        brain.aura('thrown');
      } else if (event === 'land') {
        if (data.hard) {
          brain.say('hard_landing', {}, { ms: 1800 });
          brain.aura('landing');
        } else if (data.floor) {
          brain.remark('floor', {}, { every: 120e3, chance: 0.3 });
        }
      } else if (event === 'sleep') {
        brain.say('sleep', {}, { ms: 3000 });
      } else if (event === 'wake') {
        brain.say('wake', {}, { ms: 1800 });
      } else if (event === 'pose') {
        brain.remark('ambient', {}, { chance: 0.5 });
      }
    },

    // Right after landing on a page: maybe say something about where we are.
    arrive({ isNew, visits = 0 } = {}) {
      brain.arrived = true;
      const kind = WL.voice.siteKind(host);
      const d = new Date(), hour = d.getHours(), day = d.getDay();
      const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const options = [
        [hour < 5, 'time_late', { time }, 0.6],
        [visits >= 20, 'arrive_regular', { n: visits }, 0.4],
        [kind && (isNew || visits % 6 === 0), `site_${kind}`, {}, 0.9],
        [kind, `site_${kind}`, {}, 0.25],
        [isNew, 'arrive_new', {}, 0.8],
        [visits > 1 && visits < 20, 'arrive_again', {}, 0.15],
        [day === 1 && hour < 12, 'time_monday', {}, 0.3],
        [day === 5 && hour >= 16, 'time_friday', {}, 0.3],
        [day === 0 || day === 6, 'time_weekend', {}, 0.1],
        [hour >= 5 && hour < 9, 'time_morning', {}, 0.3],
      ];
      for (const [ok, event, vars, chance] of options) {
        if (ok && Math.random() < chance) {
          lastAmbient = performance.now();
          return brain.say(event, vars, { ms: 3000 });
        }
      }
      return null;
    },

    // Watch what's happening on the page.
    start() {
      // Doomscrolling: six screens in fifteen seconds.
      let scrolled = [], lastY = scrollY;
      addEventListener('scroll', () => {
        const now = performance.now();
        scrolled.push([now, Math.abs(scrollY - lastY)]);
        lastY = scrollY;
        scrolled = scrolled.filter(([t]) => now - t < 15e3);
        if (scrolled.reduce((s, [, d]) => s + d, 0) > innerHeight * 6) {
          scrolled = [];
          brain.remark('doomscroll', {}, { every: 180e3 });
        }
      }, { passive: true });

      // A long read: once per page, after you've stuck around for a bit.
      setTimeout(() => {
        const root = document.querySelector('article, main, [role="main"]') || document.body;
        const words = (root?.innerText || '').split(/\s+/).length;
        if (words > 1800) brain.remark('reading_long', { mins: Math.round(words / 230) }, { every: Infinity });
      }, 20e3);

      // Coming back to the tab after a while.
      let hiddenAt = 0;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) return void (hiddenAt = performance.now());
        const gone = performance.now() - hiddenAt;
        if (hiddenAt && gone > 90e3 && performance.now() - (cooldowns.tab_back ?? -Infinity) > 300e3) {
          cooldowns.tab_back = performance.now();
          setTimeout(() => brain.say('tab_back', { mins: Math.max(1, Math.round(gone / 60e3)) }), 600);
        }
      });

      addEventListener('copy', () => brain.remark('copy', {}, { every: 90e3, chance: 0.7 }), { passive: true });

      // Wiggling the mouse back and forth fast.
      let turns = [], lastDx = 0;
      addEventListener('pointermove', (e) => {
        if (Math.abs(e.movementX) < 8) return;
        const now = performance.now();
        if (Math.sign(e.movementX) !== Math.sign(lastDx)) turns.push(now);
        lastDx = e.movementX;
        turns = turns.filter((t) => now - t < 1000);
        if (turns.length > 8) {
          turns = [];
          brain.remark('wiggle', {}, { every: 120e3 });
        }
      }, { passive: true });

      // Musings now and then.
      const muse = () => {
        brain.remark('ambient', {}, { chance: 0.45 });
        setTimeout(muse, 25e3 + Math.random() * 25e3);
      };
      setTimeout(muse, 30e3);
    },

    // For tests: allow the next remark right away.
    resetCooldowns() {
      lastAmbient = -Infinity;
      for (const k of Object.keys(cooldowns)) delete cooldowns[k];
      pokes = [];
    },
  });
})();
