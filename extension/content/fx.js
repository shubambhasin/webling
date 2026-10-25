// Little particles drawn on the overlay: crumbs, hearts, z's, emotes and floating text like
// "+15 aura". Positions are in screen coordinates.
(() => {
  const WL = (globalThis.WL ||= {});
  const ART = {
    heart: ['.kk.kk.', 'kppkppk', 'kpppppk', '.kpppk.', '..kpk..', '...k...'],
    z: ['kkkk', '..k.', '.k..', 'kkkk'],
    skull: ['.kkkkk.', 'kwwwwwk', 'kwkwkwk', 'kwwwwwk', '.kwkwk.', '..kkk..'],
    sparkle: ['...k...', '..kyk..', 'kkyyykk', '..kyk..', '...k...'],
    sweat: ['..k..', '.kbk.', 'kbbbk', 'kbbbk', '.kkk.'],
    exclaim: ['kkk', 'kyk', 'kyk', 'kkk', '...', 'kkk', 'kyk', 'kkk'],
    question: ['.kkk.', 'k...k', '...k.', '..k..', '.....', '..k..'],
  };
  const PAL = { k: '#1b1528', p: '#ff6f9c', w: '#fffdf5', y: '#ffd23f', b: '#6ec8ff' };

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
  const img = (name, scale) => (baked[name + scale] ||= sprite(ART[name], scale));

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

    // A pixel emote that pops up above something: skull, sparkle, sweat, exclaim, question, heart.
    emote(kind, x, y) {
      if (!ART[kind]) return;
      fx.parts.push({ kind, x, y, vx: 0, vy: -26, life: 1.4, pop: 0 });
    },

    // A burst of sparkles around a point (aura moments).
    sparkles(x, y, n = 5) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        fx.parts.push({ kind: 'sparkle', x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 10, vx: Math.cos(a) * 40, vy: Math.sin(a) * 30 - 30, life: 0.9 });
      }
    },

    // Floating text, like "+15 aura".
    text(str, x, y, color = '#7c5cff') {
      fx.parts.push({ kind: 'text', str, color, x, y, vx: 0, vy: -32, life: 1.6 });
    },

    update(dt) {
      for (const p of fx.parts) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'crumb') p.vy += 900 * dt;
        if ('pop' in p) p.pop = Math.min(1, p.pop + dt * 6);
      }
      fx.parts = fx.parts.filter((p) => p.life > 0 && p.y < innerHeight + 20);
    },

    draw(ctx, dpr) {
      for (const p of fx.parts) {
        ctx.globalAlpha = Math.min(1, p.life * 2);
        if (p.kind === 'crumb') {
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x * dpr), Math.round(p.y * dpr), p.size * dpr, p.size * dpr);
        } else if (p.kind === 'text') {
          ctx.font = `800 ${12 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3 * dpr;
          ctx.strokeStyle = '#fffdf5';
          ctx.strokeText(p.str, p.x * dpr, p.y * dpr);
          ctx.fillStyle = p.color;
          ctx.fillText(p.str, p.x * dpr, p.y * dpr);
          ctx.textAlign = 'start';
        } else {
          const big = p.kind === 'heart' || p.kind === 'z' || p.kind === 'sparkle' ? 2 : 3;
          const scale = 'pop' in p && p.pop < 1 ? Math.max(1, Math.round(big * p.pop)) : big;
          const i = img(p.kind, scale * dpr);
          ctx.drawImage(i, Math.round(p.x * dpr - i.width / 2), Math.round(p.y * dpr - i.height));
        }
      }
      ctx.globalAlpha = 1;
    },
  });
})();
