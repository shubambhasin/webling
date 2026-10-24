// Little particles drawn on the overlay: crumbs, hearts, z's. Positions are in screen coordinates.
(() => {
  const WL = (globalThis.WL ||= {});
  const HEART = ['.kk.kk.', 'kppkppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'];
  const Z = ['kkkk', '..k.', '.k..', 'kkkk'];
  const PAL = { k: '#1b1528', p: '#ff6f9c' };

  const sprite = (rows, scale) => {
    const c = document.createElement('canvas');
    c.width = rows[0].length * scale;
    c.height = rows.length * scale;
    const g = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = PAL[ch];
      g.fillRect(x * scale, y * scale, scale, scale);
    }));
    return c;
  };
  const baked = {};
  const img = (name, scale) => (baked[name + scale] ||= sprite(name === 'heart' ? HEART : Z, scale));

  const fx = (WL.fx = {
    parts: [],

    crumbs(x, y, color, n = 4) {
      for (let i = 0; i < n; i++) {
        fx.parts.push({
          kind: 'crumb', x, y, color, size: 2 + Math.floor(Math.random() * 3),
          vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 220, life: 0.9 + Math.random() * 0.5,
        });
      }
    },

    heart(x, y) {
      fx.parts.push({ kind: 'heart', x, y, vx: (Math.random() - 0.5) * 30, vy: -55, life: 1.3 });
    },

    zzz(x, y) {
      fx.parts.push({ kind: 'z', x, y, vx: 12, vy: -22, life: 1.8 });
    },

    update(dt) {
      for (const p of fx.parts) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'crumb') p.vy += 900 * dt;
      }
      fx.parts = fx.parts.filter((p) => p.life > 0 && p.y < innerHeight + 20);
    },

    draw(ctx, dpr) {
      for (const p of fx.parts) {
        ctx.globalAlpha = Math.min(1, p.life * 2);
        if (p.kind === 'crumb') {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x * dpr), Math.round(p.y * dpr), p.size * dpr, p.size * dpr);
        } else {
          const i = img(p.kind === 'heart' ? 'heart' : 'z', 2 * dpr);
          ctx.drawImage(i, Math.round(p.x * dpr - i.width / 2), Math.round(p.y * dpr - i.height));
        }
      }
      ctx.globalAlpha = 1;
    },
  });
})();
