// Other people's weblings on the same page. The server only ever sees a SHA-256 of the page's
// origin + path (never the URL, query or title) and each pet's name, colour seed and stage.
// Ghosts aren't position-synced: each visitor's pet is simulated locally on your copy of the page,
// so the server only relays who's here and boops.
(() => {
  const WL = (globalThis.WL ||= {});
  // Private places: mail, docs, money, sign-in pages. No presence there, ever.
  const DENY_HOSTS = /(^|\.)(mail\.google\.com|accounts\.google\.com|docs\.google\.com|drive\.google\.com|calendar\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com|proton\.me|icloud\.com|paypal\.com|stripe\.com|venmo\.com|wise\.com|chase\.com|wellsfargo\.com|bankofamerica\.com|hdfcbank\.com|icicibank\.com|onlinesbi\.sbi|axisbank\.com|kotak\.com)$/i;
  const DENY_SUB = /^(login|auth|account|accounts|signin|sso|secure|bank|banking|checkout|pay|billing|admin)\./i;
  const DENY = { test: (h) => DENY_HOSTS.test(h) || DENY_SUB.test(h) };

  let ws = null, room = null, me = null, count = 0, retry = 0, on = false, path = '';
  let hideTimer = null, retryTimer = null;
  const ghosts = new Map(); // id → { peer, pet, boopAt }

  const presence = (WL.presence = {
    allowedHere() {
      if (!crypto?.subtle || chrome.extension?.inIncognitoContext) return false;
      if (DENY.test(location.hostname)) return false;
      return !document.querySelector('input[type=password]');
    },

    async start() {
      if (on || !presence.allowedHere()) return;
      on = true;
      await join();
      document.addEventListener('visibilitychange', onVisibility);
      // Single-page apps change pages without reloading.
      presence.pathTimer = setInterval(() => {
        if (location.pathname !== path) join();
      }, 2000);
    },

    stop() {
      on = false;
      clearInterval(presence.pathTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      disconnect();
    },

    updateLook() {
      send({ t: 'look', pet: WL.myLook() });
    },
  });

  async function join() {
    path = location.pathname;
    const bytes = new TextEncoder().encode(location.origin + location.pathname);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    room = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
    disconnect();
    connect();
  }

  function connect() {
    if (!on || document.hidden) return;
    clearTimeout(retryTimer);
    let sock;
    try {
      sock = ws = new WebSocket(WL.config.presenceUrl);
    } catch {
      return;
    }
    sock.onopen = () => {
      retry = 0;
      send({ t: 'join', room, pet: WL.myLook() });
    };
    sock.onmessage = (e) => {
      try {
        handle(JSON.parse(e.data));
      } catch {}
    };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      clearGhosts();
      if (on && !document.hidden) retryTimer = setTimeout(connect, Math.min(60e3, 1500 * 2 ** retry++));
    };
  }

  function disconnect() {
    clearTimeout(retryTimer);
    const sock = ws;
    ws = null;
    sock?.close();
    clearGhosts();
  }

  const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

  function onVisibility() {
    clearTimeout(hideTimer);
    if (document.hidden) hideTimer = setTimeout(disconnect, 30e3);
    else if (!ws) connect();
  }

  function handle(m) {
    if (m.t === 'roster') {
      me = m.you;
      count = m.count;
      for (const peer of m.peers) addGhost(peer, false);
    } else if (m.t === 'join') {
      count = m.count;
      addGhost(m.peer, true);
    } else if (m.t === 'leave') {
      count = m.count;
      removeGhost(m.id);
    } else if (m.t === 'look') {
      const g = ghosts.get(m.id);
      if (g) g.pet.look = m.pet;
    } else if (m.t === 'emote') {
      onEmote(m);
    }
    WL.overlay.chip(count);
  }

  function addGhost(peer, greet) {
    if (!peer || peer.id === me || ghosts.has(peer.id) || ghosts.size >= WL.config.maxGhosts) return;
    const pet = new WL.Pet(peer.pet, { ghost: true });
    const g = { peer, pet, boopAt: 0 };
    pet.onPoke = () => boop(g);
    ghosts.set(peer.id, g);
    WL.pets.add(pet);
    if (greet) setTimeout(() => pet.say('hi!', 1500), 900);
  }

  function removeGhost(id) {
    const g = ghosts.get(id);
    if (!g) return;
    g.pet.say('bye!', 900);
    setTimeout(() => {
      g.pet.destroy();
      WL.pets.delete(g.pet);
    }, 900);
    ghosts.delete(id);
  }

  function clearGhosts() {
    for (const g of ghosts.values()) {
      g.pet.destroy();
      WL.pets.delete(g.pet);
    }
    ghosts.clear();
    count = 0;
    WL.overlay.chip?.(0);
  }

  function boop(g) {
    const now = performance.now();
    if (now - g.boopAt < 1200) return;
    g.boopAt = now;
    send({ t: 'emote', to: g.peer.id, kind: 'boop' });
    g.pet.say(`you booped ${g.pet.look.name || 'them'}`, 1300);
    WL.bg({ type: 'boop' });
  }

  function onEmote(m) {
    if (m.kind !== 'boop') return;
    const from = ghosts.get(m.from);
    if (m.to === me) {
      WL.me.hop();
      WL.fx.heart(WL.me.sx, WL.me.sy - WL.me.h);
      WL.me.say(`${m.name || 'someone'} booped you!`, 2000);
      if (from) from.pet.happy(1.2);
      WL.bg({ type: 'booped' });
    } else {
      const to = ghosts.get(m.to);
      to?.pet.hop();
      if (to) WL.fx.heart(to.pet.sx, to.pet.sy - to.pet.h);
    }
  }
})();
