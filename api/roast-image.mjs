// /r/<host>/image.png: the 1200×630 link preview for a roast (see _roast.mjs).
import { C, WL, bubble, h, parse, petPng, pngResponse } from './_roast.mjs';

const { INK, MUTED, ACID } = C;

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
  return pngResponse(
    h('div', C.CARD,
      h('div', { position: 'absolute', left: 64, top: 48, flexDirection: 'column', width: W },
        h('div', { alignItems: 'center', fontFamily: 'Geist Mono', fontSize: 28, color: MUTED },
          who,
          h('div', { marginLeft: 16, padding: '2px 12px', background: ACID, color: INK, fontSize: 22 }, WL.voice.VIBES[r.vibe].label.toUpperCase())),
        h('div', { fontSize: hostSize, letterSpacing: -2, marginTop: 2 }, host)),
      h('div', { position: 'absolute', left: 64, bottom: 92, width: W, alignItems: 'flex-end', justifyContent: 'space-between' },
        { type: 'img', props: { src: pet.src, width: pet.width, height: pet.height } },
        bubble(text, bubbleW, lineSize, { marginBottom: pet.height * 0.6 })),
      h('div', { position: 'absolute', left: 64, bottom: 38, width: W, justifyContent: 'space-between', fontFamily: 'Geist Mono', fontSize: 24, color: MUTED },
        h('div', { color: ACID }, 'webling'),
        h('div', {}, 'roast any site → webling.vercel.app'))),
  );
}
