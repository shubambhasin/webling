// The share card: a 1200×630 image (the size X, LinkedIn and Discord previews use).
(() => {
  const WL = (globalThis.WL ||= {});
  const W = 1200, H = 630;
  const INK = '#1b1528', PAPER = '#fffdf5';

  function render(pet, sites) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const pal = WL.art.palette(pet.seed);
    const stage = WL.model.stage(pet);

    // background: ink with a faint pixel grid and a glow in the pet's colour
    g.fillStyle = INK;
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(300, 330, 20, 300, 330, 420);
    glow.addColorStop(0, pal.d + 'aa');
    glow.addColorStop(1, INK + '00');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < W; x += 20) for (let y = 0; y < H; y += 20) g.fillRect(x, y, 2, 2);

    // the pet, big, on a little ground line
    const scale = stage === 'baby' ? 26 : 20;
    const art = WL.art.bake(stage, 'idle', 0, pet.seed, scale);
    const px = 300 - art.width / 2, py = 470 - art.height;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(px + scale, 470, art.width - scale * 2, scale);
    // a light outline so the dark linework reads on the dark card
    const halo = document.createElement('canvas');
    halo.width = art.width;
    halo.height = art.height;
    const hg = halo.getContext('2d');
    hg.drawImage(art, 0, 0);
    hg.globalCompositeOperation = 'source-in';
    hg.fillStyle = PAPER;
    hg.fillRect(0, 0, halo.width, halo.height);
    const o = Math.round(scale * 0.35);
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) g.drawImage(halo, px + dx, py + dy);
    g.drawImage(art, px, py);
    g.fillStyle = pal.l;
    g.fillRect(120, 470 + scale * 1.5, 360, 6);

    // words
    const x = 600;
    const name = (pet.name || 'Webling').toUpperCase();
    g.fillStyle = PAPER;
    g.font = `800 ${fit(g, name, 540, 88)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    g.fillText(name, x, 170);
    g.font = '500 26px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillStyle = pal.l;
    const info = WL.model.stageInfo(stage);
    const vibe = WL.voice.VIBES[WL.voice.vibeOf(pet)];
    g.fillText(`${info.label.toLowerCase()} · ${vibe.label.toLowerCase()} · day ${WL.model.ageDays(pet)}`, x, 214);

    const rows = [
      [pet.aura || 0, `aura · ${WL.model.auraTier(pet)}`],
      [pet.stats.cookies, pet.stats.cookies === 1 ? 'cookie banner eaten' : 'cookie banners eaten'],
      [pet.stats.popups, pet.stats.popups === 1 ? 'pop-up devoured' : 'pop-ups devoured'],
      [sites, sites === 1 ? 'site explored' : 'sites explored'],
    ];
    rows.forEach(([n, label], i) => {
      const y = 300 + i * 66;
      g.fillStyle = pal.b;
      g.fillRect(x, y - 30, 10, 34);
      g.fillStyle = PAPER;
      g.font = '800 44px ui-monospace, SFMono-Regular, Menlo, monospace';
      const num = n.toLocaleString();
      g.fillText(num, x + 28, y);
      const nw = g.measureText(num).width;
      g.font = '500 26px ui-monospace, SFMono-Regular, Menlo, monospace';
      g.fillStyle = 'rgba(255,253,245,0.75)';
      g.fillText(label, x + 44 + nw, y);
    });

    // its mantra, under the pet
    const quote = `“${WL.voice.mantra(pet)}”`;
    g.textAlign = 'center';
    g.fillStyle = PAPER;
    g.font = `700 ${fit(g, quote, 500, 26, 500)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    g.fillText(quote, 300, 560);
    g.textAlign = 'start';

    g.fillStyle = 'rgba(255,253,245,0.5)';
    g.font = '500 22px ui-monospace, SFMono-Regular, Menlo, monospace';
    g.fillText('hatch your own webling →', x, 590);
    g.fillStyle = pal.a;
    g.fillText('webling', W - 140, 590);
    return c;
  }

  function fit(g, text, max, size, weight = 800) {
    for (; size > 14; size -= 2) {
      g.font = `${weight} ${size}px ui-monospace, monospace`;
      if (g.measureText(text).width <= max) break;
    }
    return size;
  }

  function shareText(pet, sites) {
    const s = pet.stats;
    const bits = [];
    if (s.cookies) bits.push(`${s.cookies} cookie banner${s.cookies === 1 ? '' : 's'}`);
    if (s.popups) bits.push(`${s.popups} pop-up${s.popups === 1 ? '' : 's'}`);
    const ate = bits.length ? `has eaten ${bits.join(' and ')}` : 'is out exploring';
    const vibe = WL.voice.VIBES[WL.voice.vibeOf(pet)].label.toLowerCase();
    return `My ${vibe} webling ${pet.name} ${ate} across ${sites} site${sites === 1 ? '' : 's'}. Aura: ${WL.model.auraTier(pet)}. Hatch yours:`;
  }

  WL.card = { render, shareText };
})();
