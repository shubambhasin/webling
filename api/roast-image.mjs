// /r/<host>/image.png: the 1200×630 link preview for a roast (see _roast.mjs).
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { WL, fonts, parse, petPng } from './_roast.mjs';

const INK = '#120d1f', PAPER = '#fffdf5', TEXT = '#f4efff', MUTED = '#b6acd2', ACID = '#ffe14d', VIOLET = '#8b5cff';
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children } });

export async function GET(request) {
  const r = parse(request.url);
  if (!r) return Response.redirect(new URL('/og.png', request.url), 302);
  const pet = petPng(r, r.stage === 'baby' ? 16 : 13);
  const who = r.name ? `${r.name}'s take on` : 'a webling’s take on';
  const host = r.host.length > 40 ? `${r.host.slice(0, 39)}…` : r.host, text = r.text.replaceAll(r.host, host);
  const hostSize = host.length > 22 ? Math.round(1500 / host.length) : 68;
  const lineSize = text.length > 30 ? 44 : 54;

  // 1200×630 with 64px sides: a header, the pet and its speech bubble, a footer
  const W = 1200 - 128, bubbleW = W - pet.width - 40;
  const svg = await satori(
    h('div', {
      width: 1200, height: 630, position: 'relative', color: TEXT, fontFamily: 'Geist', backgroundColor: '#0d0a17',
      backgroundImage: 'radial-gradient(circle at 92% -10%, rgba(139,92,255,.45), rgba(13,10,23,0) 55%), radial-gradient(circle at -5% 85%, rgba(255,95,162,.22), rgba(13,10,23,0) 45%)',
    },
      h('div', { position: 'absolute', left: 64, top: 48, flexDirection: 'column', width: W },
        h('div', { alignItems: 'center', fontFamily: 'Geist Mono', fontSize: 28, color: MUTED },
          who,
          h('div', { marginLeft: 16, padding: '2px 12px', background: ACID, color: INK, fontSize: 22 }, WL.voice.VIBES[r.vibe].label.toUpperCase())),
        h('div', { fontSize: hostSize, letterSpacing: -2, marginTop: 2 }, host)),
      h('div', { position: 'absolute', left: 64, bottom: 92, width: W, alignItems: 'flex-end', justifyContent: 'space-between' },
        { type: 'img', props: { src: pet.src, width: pet.width, height: pet.height } },
        h('div', { position: 'relative', width: bubbleW, marginBottom: pet.height * 0.6 },
          h('div', {
            width: bubbleW - 10, background: PAPER, color: INK, border: `6px solid ${INK}`, boxShadow: `10px 10px 0 ${VIOLET}`,
            padding: '22px 30px', fontFamily: 'Geist Mono', fontSize: lineSize, lineHeight: 1.2,
          }, text),
          // the tail, pointing down at the pet
          h('div', { position: 'absolute', left: 34, bottom: -17, width: 30, height: 30, background: PAPER,
            borderRight: `6px solid ${INK}`, borderBottom: `6px solid ${INK}`, transform: 'rotate(45deg)' }))),
      h('div', { position: 'absolute', left: 64, bottom: 38, width: W, justifyContent: 'space-between', fontFamily: 'Geist Mono', fontSize: 24, color: MUTED },
        h('div', { color: ACID }, 'webling'),
        h('div', {}, 'roast any site → webling.vercel.app'))),
    { width: 1200, height: 630, fonts: fonts(), loadAdditionalAsset: emoji },
  );
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
