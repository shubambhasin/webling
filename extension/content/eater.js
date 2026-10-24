// Finds cookie banners and promo pop-ups, then has the pet eat them: it jumps onto the overlay and
// chews across it while the element is clipped away behind its mouth. Everything is undoable.
//
// Only cosmetic: elements are hidden with inline styles, nothing is clicked and no requests are blocked.
// Hiding a consent banner without answering it leaves the site's default (usually: no consent given).
(() => {
  const WL = (globalThis.WL ||= {});

  const CONSENT_ID = /cookie|consent|gdpr|ccpa|onetrust|cookiebot|didomi|usercentrics|truste|qc-cmp|osano|iubenda|termly|cookieyes|cky-|cmplz|privacy-?banner|cc-window|cc-banner/i;
  const CONSENT_TEXT = /cookie|consent|tracking technolog|your privacy|privacy (choices|preferences|settings)/i;
  const AGREE = /accept|agree|allow|got it|reject|decline|\bok\b|okay|i understand|manage (options|preferences|settings)/i;
  const PROMO = /subscribe|newsletter|sign up for|join (our|the)|get \d+% off|\d+% off|discount code|don.t miss|stay (in the loop|updated|in touch)|enable notifications|turn on notifications|get the app|open in (the )?app|before you go|exclusive offer|unlock|free shipping/i;
  const LOOKUP = [
    '[id*="cookie" i]', '[class*="cookie" i]', '[id*="consent" i]', '[class*="consent" i]', '[id*="gdpr" i]',
    '#onetrust-banner-sdk', '#CybotCookiebotDialog', '#usercentrics-root', '#didomi-host', '.qc-cmp2-container',
    '[aria-label*="cookie" i]', '[aria-label*="newsletter" i]', '[role="dialog"]', '[aria-modal="true"]',
  ].join(',');
  const USER_OPENED_MS = 3000; // a modal that shows up this soon after a click was probably asked for
  const SCAN_AFTER_CHANGE_MS = 700; // at most one rescan this long after the page changes
  const SAFETY_SCAN_MS = 3000; // and a rescan this often regardless, for anything the observer missed
  const MEAL_TIMEOUT_MS = 15000; // a meal that hasn't finished by now is abandoned so eating can't jam

  // eaten: started eating (never again, even if spat out). queued: waiting for its turn; dropped
  // again if it can't be eaten when the turn comes, so a later scan can pick it back up.
  const eaten = new WeakSet(), queued = new WeakSet(), userOpened = new WeakSet();
  let enabled = false, busy = false, observer = null, scanTimer = null, safetyTimer = null;
  const queue = [];

  const eater = (WL.eater = {
    start() {
      if (enabled) return;
      enabled = true;
      for (const ms of [800, 2200]) setTimeout(eater.scan, ms);
      safetyTimer = setInterval(() => document.hidden || eater.scan(), SAFETY_SCAN_MS);
      // Throttled, not debounced: a page that never stops changing must still get rescanned.
      observer = new MutationObserver(() => {
        scanTimer ||= setTimeout(() => {
          scanTimer = null;
          eater.scan();
        }, SCAN_AFTER_CHANGE_MS);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
    },

    stop() {
      enabled = false;
      observer?.disconnect();
      clearInterval(safetyTimer);
      clearTimeout(scanTimer);
      scanTimer = null;
      for (const job of queue.splice(0)) queued.delete(job.el);
    },

    scan() {
      if (!enabled || !document.body) return;
      const roots = new Set();
      for (const el of [...document.querySelectorAll(LOOKUP)].slice(0, 80)) {
        const r = overlayRoot(el);
        if (r) roots.add(r);
      }
      // Whatever sits on top of the screen at a few points (bottom bars, centred modals, top bars).
      for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.97], [0.25, 0.95], [0.75, 0.95], [0.5, 0.04], [0.5, 0.3], [0.5, 0.7]]) {
        for (const el of document.elementsFromPoint(innerWidth * fx, innerHeight * fy).slice(0, 4)) {
          const r = overlayRoot(el);
          if (r) roots.add(r);
        }
      }
      const recent = performance.now() - WL.input.lastInteract < USER_OPENED_MS;
      for (const el of roots) {
        if (eaten.has(el) || queued.has(el) || userOpened.has(el)) continue;
        const kind = classify(el);
        if (!kind) continue;
        if (kind === 'popup' && recent) { userOpened.add(el); continue; }
        queued.add(el);
        queue.push({ el, kind });
      }
      next();
    },
  });

  // The outermost fixed or sticky ancestor of el (that's the thing covering the page).
  function overlayRoot(el) {
    let root = null;
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      if (e.localName === 'webling-root') return null;
      const pos = getComputedStyle(e).position;
      if (pos === 'fixed' || pos === 'sticky') root = e;
    }
    return root;
  }

  function classify(el) {
    const r = el.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    if (r.width * r.height < 4000 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1) return null;
    if (/^(nav|header|footer|video|audio)$/.test(el.localName) || el.getAttribute('role') === 'navigation') return null;
    if (el.querySelector('input[type=password], video, [role="navigation"], nav')) return null;
    if (el.getElementsByTagName('*').length > 800) return null;
    const text = (el.innerText || '').slice(0, 4000);
    if (text.length > 3500 || text.length < 8) return null;

    const ident = `${el.id} ${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('aria-label') || ''}`;
    const consentish = CONSENT_ID.test(ident) || el.querySelector('[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i]');
    if (CONSENT_TEXT.test(text) && (consentish || /we use cookies|this (web)?site uses cookies/i.test(text)) && (AGREE.test(text) || el.querySelector('button'))) {
      return 'cookie';
    }

    const cover = (r.width * r.height) / (vw * vh);
    const centred = Math.abs(r.left + r.width / 2 - vw / 2) < vw * 0.2;
    if (!PROMO.test(text) || text.length > 1500) return null;
    const modalish = el.matches('[role="dialog"],[aria-modal="true"],dialog') || !backdrops(el).next().done;
    if ((centred && (cover > 0.12 || (cover > 0.02 && modalish))) || cover > 0.85) return 'popup';
    return null;
  }

  async function next() {
    if (busy || !enabled || !WL.me) return;
    const job = queue.shift();
    if (!job) return;
    queued.delete(job.el);
    if (!job.el.isConnected || !classify(job.el)) return next();
    busy = true;
    eaten.add(job.el);
    const meal = { aborted: false };
    const watchdog = visibleTimeout(MEAL_TIMEOUT_MS);
    try {
      await Promise.race([eat(job.el, job.kind, meal), watchdog.promise]);
    } catch {
      // Whatever stalled it, stop the meal where it is and get the pet back to normal.
      meal.aborted = true;
      WL.me.release();
    } finally {
      watchdog.cancel();
      busy = false;
      setTimeout(next, 700);
    }
  }

  // Rejects after ms of time with the tab visible (hidden tabs pause animation, which isn't a stall).
  function visibleTimeout(ms) {
    let timer;
    const promise = new Promise((_, fail) => {
      let left = ms;
      timer = setInterval(() => {
        if (!document.hidden && (left -= 250) <= 0) fail(new Error('meal timed out'));
      }, 250);
    });
    promise.catch(() => {});
    return { promise, cancel: () => clearInterval(timer) };
  }

  async function eat(el, kind, meal) {
    const pet = WL.me;
    while (pet.mode === 'held') await wait(200);
    if (meal.aborted) return;
    pet.cancelPress(); // a press that started before the leap must not turn into a drag mid-meal
    const r = el.getBoundingClientRect();
    const fromLeft = pet.sx < r.left + r.width / 2;
    const y = Math.max(r.top, pet.h + 6);
    const x0 = fromLeft ? Math.max(r.left + 6, pet.w / 2) : Math.min(r.right - 6, innerWidth - pet.w / 2);
    const x1 = fromLeft ? Math.min(r.right, innerWidth - pet.w / 2) : Math.max(r.left, pet.w / 2);
    pet.say(kind === 'cookie' ? 'ooh, a cookie' : 'ooh, snack', 1400);
    await pet.tweenTo(x0, y);
    if (meal.aborted) return;
    pet.dir = fromLeft ? 1 : -1;

    const saved = saveStyles(el, ['clip-path', 'display']);
    const color = colorOf(el);
    const secs = Math.max(1.2, Math.min(2.6, r.width / 450));
    await animate(secs, (k) => {
      if (meal.aborted) return false;
      const cut = k * r.width;
      el.style.setProperty('clip-path', bite(r.width, r.height, cut, fromLeft), 'important');
      pet.x = x0 + (x1 - x0) * k;
      if (Math.random() < 0.6) WL.fx.crumbs(pet.x + pet.dir * pet.w * 0.35, y - pet.h * 0.45, color, 1);
    });
    if (meal.aborted) return restoreStyles(saved); // don't leave it half-eaten
    el.style.setProperty('display', 'none', 'important');

    // Backdrops and scroll locks that came with a pop-up.
    const extras = kind === 'popup' || coversScreen(r) ? [...backdrops(el)] : [];
    const extraSaved = extras.map((b) => {
      const s = saveStyles(b, ['display']);
      b.style.setProperty('display', 'none', 'important');
      return s;
    });
    const scrollSaved = extras.length || kind === 'popup' || coversScreen(r) ? unlockScroll() : [];

    pet.release();
    pet.say(kind === 'cookie' ? 'nom! cookie banner' : 'nom! pop-up gone', 2000);
    WL.fx.heart(pet.sx, pet.sy - pet.h);
    WL.bg({ type: 'ate', kind });
    WL.overlay.toast(`${pet.look.name || 'Your webling'} ate a ${kind === 'cookie' ? 'cookie banner' : 'pop-up'}.`, 'Spit it out', () => {
      restoreStyles(saved);
      extraSaved.forEach(restoreStyles);
      scrollSaved.forEach(restoreStyles);
      WL.bg({ type: 'uneat', kind });
      pet.say('fine… ptooey', 1600);
    });
  }

  // A clip-path that keeps the uneaten part, with a bitten (zig-zag) edge.
  function bite(w, h, cut, fromLeft) {
    const pts = [];
    const teeth = Math.max(2, Math.round(h / 12));
    const edge = (x) => (fromLeft ? x : w - x);
    pts.push(`${edge(cut)}px 0px`, `${edge(w)}px 0px`, `${edge(w)}px ${h}px`, `${edge(cut)}px ${h}px`);
    for (let i = teeth - 1; i > 0; i--) pts.push(`${edge(cut + (i % 2 ? 10 : 0))}px ${(h * i) / teeth}px`);
    return `polygon(${pts.join(',')})`;
  }

  function* backdrops(eaten) {
    for (const el of document.body.querySelectorAll('body > *, body > * > *')) {
      if (el === eaten || el.localName === 'webling-root' || el.contains(eaten)) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' || cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (coversScreen(r) && (el.innerText || '').trim().length < 30) yield el;
    }
  }

  function unlockScroll() {
    const out = [];
    for (const el of [document.documentElement, document.body]) {
      const cs = getComputedStyle(el);
      if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
        out.push(saveStyles(el, ['overflow', 'overflow-y']));
        el.style.setProperty('overflow', 'auto', 'important');
        el.style.setProperty('overflow-y', 'auto', 'important');
      }
    }
    return out;
  }

  const coversScreen = (r) => r.width * r.height > innerWidth * innerHeight * 0.85;

  function saveStyles(el, props) {
    return { el, props: props.map((p) => [p, el.style.getPropertyValue(p), el.style.getPropertyPriority(p)]) };
  }
  function restoreStyles({ el, props }) {
    for (const [p, v, prio] of props) {
      if (v) el.style.setProperty(p, v, prio);
      else el.style.removeProperty(p);
    }
  }

  function colorOf(el) {
    for (const e of [el, ...el.querySelectorAll('*')].slice(0, 30)) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return '#d9d4c7';
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Calls fn(k) each frame with k going 0 → 1 over secs; fn returning false stops early.
  const animate = (secs, fn) => new Promise((done) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / (secs * 1000));
      if (fn(k) === false || k >= 1) return done();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
})();
