// Shareable roasts: webling.vercel.app/r/<host> is a page whose link preview is a pet roasting that site,
// with the image at /r/<host>/image.png. Both are rewritten to the functions in this folder (vercel.json),
// and scripts/dev-server.mjs serves them locally. The take comes from the extension's own voice.js,
// so a link shows exactly the line the site's roast box showed.
//
// Query: v vibe · t which take (any integer, wraps) · n the pet's name · s its colour seed · g its stage.
// All optional; without them a site gets a take and colours of its own.
import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadShared } from '../scripts/load-shared.mjs';
import { image } from '../scripts/png.mjs';

export const { WL } = loadShared(['shared/config.js', 'shared/sprite.js', 'shared/pet.js', 'shared/voice.js']);
const STAGES = ['baby', 'adult', 'legend'];

const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
};

// Everything a roast needs, from a request URL. Null if the host isn't a website.
export function parse(url) {
  const q = new URL(url).searchParams;
  const host = WL.voice.hostOf(q.get('domain'));
  if (!host) return null;
  const seed = /^[a-z0-9]{1,16}$/.test(q.get('s') || '') ? q.get('s') : `r${hash(host).toString(36)}`;
  const vibe = WL.voice.VIBES[q.get('v')] ? q.get('v') : WL.voice.vibeOf({ seed });
  const t = /^-?\d{1,9}$/.test(q.get('t') || '') ? Number(q.get('t')) : hash(`${host}:${vibe}`);
  const name = WL.model.cleanName(q.get('n'));
  const stage = STAGES.includes(q.get('g')) ? q.get('g') : 'adult';
  const take = WL.voice.roast(host, vibe, t);
  const query = new URLSearchParams({ v: vibe, t: take.t, ...(name && { n: name }), s: seed, g: stage });
  return { host, vibe, name, seed, stage, ...take, query: query.toString() };
}

// The pet as a PNG data URL, with a light outline so it reads on the dark card.
export function petPng({ stage, seed, kind }, scale) {
  const rows = WL.art.rows(stage, kind ? 'sideeye' : 'happy', 0);
  const pal = WL.art.palette(seed), o = Math.max(1, Math.round(scale / 3));
  const img = image(rows[0].length * scale + 2 * o, rows.length * scale + 2 * o);
  const white = Object.fromEntries(Object.keys(pal).map((k) => [k, '#fffdf5']));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) img.art(rows, white, o + dx * o, o + dy * o, scale);
  img.art(rows, pal, o, o, scale);
  return { src: `data:image/png;base64,${img.png().toString('base64')}`, width: img.w, height: img.h };
}

export const fonts = () => [
  { name: 'Geist', data: readFileSync(new URL('./_fonts/Geist-Bold.ttf', import.meta.url)), weight: 800, style: 'normal' },
  { name: 'Geist Mono', data: readFileSync(new URL('./_fonts/GeistMono-Bold.ttf', import.meta.url)), weight: 800, style: 'normal' },
];

// ---- drawing the 1200×630 preview cards (satori lays them out, resvg makes the PNG) ----
export const C = {
  INK: '#120d1f', PAPER: '#fffdf5', TEXT: '#f4efff', MUTED: '#b6acd2', ACID: '#ffe14d', VIOLET: '#8b5cff', LINE: '#2e2547',
  CARD: {
    width: 1200, height: 630, position: 'relative', color: '#f4efff', fontFamily: 'Geist', backgroundColor: '#0d0a17',
    backgroundImage: 'radial-gradient(circle at 92% -10%, rgba(139,92,255,.45), rgba(13,10,23,0) 55%), radial-gradient(circle at -5% 85%, rgba(255,95,162,.22), rgba(13,10,23,0) 45%)',
  },
};
// An element for satori: every box is flex, as satori wants.
export const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children } });

// The pet's speech bubble, with its tail pointing down-left at the pet.
export const bubble = (text, width, fontSize, style = {}) => h('div', { position: 'relative', width, ...style },
  h('div', {
    width: width - 10, background: C.PAPER, color: C.INK, border: `6px solid ${C.INK}`, boxShadow: `10px 10px 0 ${C.VIOLET}`,
    padding: '22px 30px', fontFamily: 'Geist Mono', fontSize, lineHeight: 1.2,
  }, text),
  h('div', { position: 'absolute', left: 34, bottom: -17, width: 30, height: 30, background: C.PAPER,
    borderRight: `6px solid ${C.INK}`, borderBottom: `6px solid ${C.INK}`, transform: 'rotate(45deg)' }));

export async function pngResponse(tree) {
  const svg = await satori(tree, { width: 1200, height: 630, fonts: fonts(), loadAdditionalAsset: emoji });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(png, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable' },
  });
}

// Emoji in a line (some takes have one) are drawn as Twemoji, fetched once per emoji and kept.
const emojiCache = new Map();
async function emoji(code, segment) {
  if (code !== 'emoji') return [];
  const points = [...segment].map((c) => c.codePointAt(0).toString(16));
  const id = (segment.includes('\u200d') ? points : points.filter((p) => p !== 'fe0f')).join('-');
  if (!emojiCache.has(id)) {
    emojiCache.set(id, fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${id}.svg`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
      .then((svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
      .catch(() => (emojiCache.delete(id), '')));
  }
  return emojiCache.get(id);
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Link-preview tags for a shared page (X, WhatsApp, Slack, Discord and iMessage all read these).
export const previewMeta = ({ link, img, title, description, alt }) => `
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(link)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Webling">
  <meta property="og:url" content="${esc(link)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(img)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(alt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(img)}">`;

// A shared page (roast or Wrapped) in the site's look, with the theme switch.
export const page = ({ title, meta = '', body }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>${meta}
  <meta name="theme-color" content="#0d0a17">
  <link rel="icon" href="/ext/icons/32.png">
  <link rel="stylesheet" href="/site.css">
  <script src="/theme.js"></script>
</head>
<body>
  <header class="top">
    <a class="brand" href="/" aria-label="Webling home"><canvas class="wordmark" data-text="WEBLING" data-cell="3" aria-hidden="true"></canvas></a>
    <nav aria-label="Site"><div class="theme-switch" role="group" aria-label="Theme"></div><a class="btn small" href="/#get">Get it</a></nav>
  </header>
  <main class="roast-page">${body}
  </main>
  <script src="/wordmark.js"></script>
  <script src="/share.js"></script>
  <script src="/ext/shared/voice.js"></script>
  <script src="/roast-page.js"></script>
</body>
</html>`;
