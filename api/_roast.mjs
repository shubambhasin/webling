// Shareable roasts: webling.vercel.app/r/<host> is a page whose link preview is a pet roasting that site,
// with the image at /r/<host>/image.png. Both are rewritten to the functions in this folder (vercel.json),
// and scripts/dev-server.mjs serves them locally. The take comes from the extension's own voice.js,
// so a link shows exactly the line the site's roast box showed.
//
// Query: v vibe · t which take (any integer, wraps) · n the pet's name · s its colour seed · g its stage.
// All optional; without them a site gets a take and colours of its own.
import { readFileSync } from 'node:fs';
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

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
