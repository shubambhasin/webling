// What the pet can stand on: the top of every visible line of text, plus the bottom of the screen.
// Platforms are in page coordinates, so they stay put when the page scrolls.
(() => {
  const WL = (globalThis.WL ||= {});
  const SKIP = 'script,style,noscript,textarea,input,select,option,svg,canvas,[contenteditable=""],[contenteditable="true"],[aria-hidden="true"],webling-root';
  const MAX_NODES = 3000, MAX_PLATFORMS = 500;

  const world = (WL.world = {
    platforms: [],

    start() {
      world.scan();
      setInterval(world.scan, 1500);
      let t;
      addEventListener('scroll', () => {
        clearTimeout(t);
        t = setTimeout(world.scan, 150);
      }, { passive: true, capture: true });
      addEventListener('resize', world.scan, { passive: true });
    },

    floor: () => scrollY + innerHeight - 1,

    scan() {
      if (!document.body) return;
      const top = scrollY - innerHeight * 0.5, bottom = scrollY + innerHeight * 1.5;
      const fixedCache = new Map();
      const rects = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.nodeValue.trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
      });
      const range = document.createRange();
      let n, seen = 0;
      while ((n = walker.nextNode()) && seen++ < MAX_NODES) {
        const el = n.parentElement;
        if (!el || el.closest(SKIP) || inFixed(el, fixedCache)) continue;
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          const y = r.top + scrollY;
          if (r.width < 24 || r.height < 9 || r.height > 140 || y < top || y > bottom) continue;
          if (r.right < 0 || r.left > innerWidth) continue;
          rects.push({ x1: r.left + scrollX, x2: r.right + scrollX, y: Math.round(y) });
        }
      }
      world.platforms = merge(rects).slice(0, MAX_PLATFORMS);
    },

    // The first platform the pet's feet cross while moving down from y0 to y1.
    landing(x, y0, y1) {
      let best = null;
      for (const p of world.platforms) {
        if (p.y >= y0 && p.y <= y1 && x >= p.x1 - 2 && x <= p.x2 + 2 && (!best || p.y < best.y)) best = p;
      }
      if (best) return best;
      return y1 >= world.floor() ? 'floor' : null;
    },

    // After a rescan, find the platform the pet was standing on (text can move).
    rematch(p, x) {
      if (p === 'floor') return p;
      return world.platforms.find((q) => Math.abs(q.y - p.y) < 4 && x >= q.x1 - 4 && x <= q.x2 + 4) || null;
    },

    // Platforms worth jumping to from (x, y).
    near(x, y, current) {
      const vx1 = scrollX + 20, vx2 = scrollX + innerWidth - 20, vy1 = scrollY + 40, vy2 = scrollY + innerHeight;
      return world.platforms.filter((p) => {
        if (p === current || p.y < vy1 || p.y > vy2 || p.x2 < vx1 || p.x1 > vx2) return false;
        const dx = x < p.x1 ? p.x1 - x : x > p.x2 ? x - p.x2 : 0;
        return dx < 260 && p.y - y > -170 && p.y - y < 260 && Math.abs(p.y - y) > 6;
      });
    },
  });

  // Text inside fixed headers moves with the screen, not the page, so the pet can't stand on it.
  function inFixed(el, cache) {
    const chain = [];
    let e = el, res = false;
    while (e && e !== document.body) {
      if (cache.has(e)) { res = cache.get(e); break; }
      chain.push(e);
      if (e.offsetParent === null && getComputedStyle(e).position === 'fixed') { res = true; break; }
      e = e.offsetParent || e.parentElement;
    }
    for (const c of chain) cache.set(c, res);
    return res;
  }

  // Join rects on the same line that touch, so a sentence becomes one long platform.
  function merge(rects) {
    rects.sort((a, b) => a.y - b.y || a.x1 - b.x1);
    const out = [];
    for (const r of rects) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.y - r.y) <= 3 && r.x1 <= last.x2 + 14) last.x2 = Math.max(last.x2, r.x2);
      else out.push({ ...r });
    }
    return out.filter((p) => p.x2 - p.x1 >= 30);
  }
})();
