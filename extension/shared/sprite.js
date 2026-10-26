// The webling's pixel art. Every frame is a list of rows; each character is a palette key and '.' is
// transparent. Frames are assembled from parts (eyes, mouth, feet) so every clip stays consistent.
(() => {
  const WL = (globalThis.WL ||= {});

  const BODY = {
    baby: {
      top: ['....aa....', '..kkkkkk..', '.kbbbbbbk.'],
      eyes: {
        open: ['kbwkbbwkbk', 'kbkkbbkkbk'],
        closed: ['kbbbbbbbbk', 'kbkkbbkkbk'],
        happy: ['kbkkbbkkbk', 'kkbbkkbbkk'],
        side: ['kbkwbbkwbk', 'kbkwbbkwbk'],
        meh: ['kbkkbbkkbk', 'kbwkbbwkbk'],
      },
      mouth: { smile: ['kpbbkkbbpk'], open: ['kpbkddkbpk'], flat: ['kpbkkkkbpk'], o: ['kpbbddbbpk'] },
      belly: ['kbbllllbbk', '.kddddddk.'],
      feet: { a: '..k....k..', b: '.k......k.', tuck: '...k..k...' },
    },
    adult: {
      top: ['..a........a..', '.kbk......kbk.', '.kbbkkkkkkbbk.', 'kbbbbbbbbbbbbk'],
      eyes: {
        open: ['kbbwkbbbbwkbbk', 'kbbkkbbbbkkbbk'],
        closed: ['kbbbbbbbbbbbbk', 'kbbkkbbbbkkbbk'],
        happy: ['kbbkkbbbbkkbbk', 'kbkbbkbbkbbkbk'],
        side: ['kbbkwbbbbkwbbk', 'kbbkwbbbbkwbbk'],
        meh: ['kbbkkbbbbkkbbk', 'kbbwkbbbbwkbbk'],
      },
      mouth: {
        smile: ['kbpbbbkkbbbpbk', 'kbbbbbbbbbbbbk'],
        open: ['kbpbbkddkbbpbk', 'kbbbbkddkbbbbk'],
        flat: ['kbpbbkkkkbbpbk', 'kbbbbbbbbbbbbk'],
        o: ['kbpbbbkkbbbpbk', 'kbbbbbkkbbbbbk'],
      },
      belly: ['kdbbllllllbbdk', '.kdbbllllbbdk.', '..kkddddddkk..'],
      feet: { a: '...kk....kk...', b: '..kk......kk..', tuck: '....kk..kk....' },
    },
  };
  // Legends are grown-ups with a crown.
  BODY.legend = { ...BODY.adult, top: ['....g.gg.g....', '....gggggg....', ...BODY.adult.top] };

  const EGG = {
    whole: ['...kk...', '..kbbk..', '.kblbbk.', '.kbbbbk.', 'kbbllbbk', 'kblbbbbk', 'kbbbblbk', 'kdbbbbdk', '.kddddk.', '..kkkk..'],
    crack: ['...kk...', '..kbbk..', '.kbkbbk.', '.kbbkbk.', 'kbbllkbk', 'kblbbbbk', 'kbbbblbk', 'kdbbbbdk', '.kddddk.', '..kkkk..'],
  };

  // [eyes, mouth, feet] per frame.
  const CLIPS = {
    idle: { fps: 2, frames: [['open', 'smile', 'a']] },
    blink: { fps: 8, frames: [['closed', 'smile', 'a']] },
    walk: { fps: 7, frames: [['open', 'smile', 'a'], ['open', 'smile', 'b']] },
    jump: { fps: 1, frames: [['open', 'open', 'tuck']] },
    fall: { fps: 1, frames: [['open', 'open', 'tuck']] },
    eat: { fps: 9, frames: [['open', 'open', 'a'], ['happy', 'smile', 'a']] },
    happy: { fps: 6, frames: [['happy', 'open', 'a'], ['happy', 'smile', 'b']] },
    sleep: { fps: 1, frames: [['closed', 'smile', 'a']] },
    held: { fps: 5, frames: [['open', 'open', 'tuck'], ['open', 'open', 'b']] },
    sideeye: { fps: 1, frames: [['side', 'flat', 'a']] },
    meh: { fps: 1, frames: [['meh', 'flat', 'a']] },
    shock: { fps: 1, frames: [['open', 'o', 'tuck']] },
    dance: { fps: 5, frames: [['happy', 'smile', 'a'], ['happy', 'open', 'b']] },
  };

  function rows(stage, clip, i = 0) {
    if (stage === 'egg') return clip === 'crack' ? EGG.crack : EGG.whole;
    const body = BODY[stage] || BODY.baby;
    const c = CLIPS[clip] || CLIPS.idle;
    const n = c.frames.length;
    const [eyes, mouth, feet] = c.frames[((Math.trunc(i) % n) + n) % n || 0]; // any frame number, even a bad one
    return [...body.top, ...body.eyes[eyes], ...body.mouth[mouth], ...body.belly, body.feet[feet]];
  }

  const size = (stage) => {
    const r = rows(stage, 'idle');
    return [r[0].length, r.length];
  };

  // ---- colour ----
  const hash = (s) => {
    let h = 2166136261;
    for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
    return h >>> 0;
  };
  const hex = (h, s, l) => {
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };
  const hueOf = (seed) => (typeof seed === 'number' ? seed : hash(seed) % 360);
  const palette = (seed) => {
    const h = hueOf(seed);
    return {
      k: '#1b1528', w: '#ffffff', p: '#ff8fb1', g: '#ffd23f',
      b: hex(h, 0.72, 0.62), l: hex(h, 0.85, 0.83), d: hex(h, 0.55, 0.42),
      a: hex((h + 160) % 360, 0.85, 0.6),
    };
  };

  // ---- baking frames into canvases (browser only) ----
  const cache = new Map();
  function bake(stage, clip, i, seed, scale, flip = false) {
    const key = `${stage}|${clip}|${i}|${seed}|${scale}|${flip}`;
    let c = cache.get(key);
    if (c) return c;
    const r = rows(stage, clip, i), pal = palette(seed);
    const w = r[0].length;
    c = document.createElement('canvas');
    c.width = w * scale;
    c.height = r.length * scale;
    const g = c.getContext('2d');
    r.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = pal[ch];
      g.fillRect((flip ? w - 1 - x : x) * scale, y * scale, scale, scale);
    }));
    if (cache.size > 500) cache.clear();
    cache.set(key, c);
    return c;
  }

  // The same frame with a light outline around it, for dark backgrounds. Returns { img, pad }:
  // draw it pad pixels up and left of where the plain frame would go.
  function bakeHalo(stage, clip, i, seed, scale, flip = false, color = '#fffdf5') {
    const key = `halo|${stage}|${clip}|${i}|${seed}|${scale}|${flip}|${color}`;
    let h = cache.get(key);
    if (h) return h;
    const art = bake(stage, clip, i, seed, scale, flip);
    const pad = Math.max(1, Math.round(scale / 2));
    const c = document.createElement('canvas');
    c.width = art.width + pad * 2;
    c.height = art.height + pad * 2;
    const g = c.getContext('2d');
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2], [1, 0], [0, 1], [2, 1], [1, 2]]) g.drawImage(art, dx * pad, dy * pad);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(art, pad, pad);
    h = { img: c, pad };
    cache.set(key, h);
    return h;
  }

  WL.art = { BODY, EGG, CLIPS, rows, size, hueOf, palette, hex, bake, bakeHalo };
})();
