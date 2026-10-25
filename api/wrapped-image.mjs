// /w/image.png?…: the 1200×630 preview for a shared Webling Wrapped (see _wrapped.mjs).
import { C, bubble, h, petPng, pngResponse } from './_roast.mjs';
import { parseWrapped, tiles } from './_wrapped.mjs';

export function GET(request) {
  const r = parseWrapped(request.url);
  const pet = petPng(r, r.stage === 'baby' ? 11 : 9);
  const verdictSize = r.label.length > 16 ? 70 : 88;
  const bubbleW = 660 - pet.width - 30;
  return pngResponse(
    h('div', C.CARD,
      // left: whose week, the verdict, the pet roasting it
      h('div', { position: 'absolute', left: 64, top: 46, flexDirection: 'column', width: 680 },
        h('div', { alignItems: 'center', fontFamily: 'Geist Mono', fontSize: 26, color: C.MUTED },
          `${r.name.toLowerCase()}'s week, wrapped`,
          h('div', { marginLeft: 14, padding: '2px 10px', background: C.ACID, color: C.INK, fontSize: 20 }, r.when)),
        h('div', { fontFamily: 'Geist Mono', fontSize: 22, color: C.MUTED, marginTop: 26 }, 'THE VERDICT'),
        h('div', { fontSize: verdictSize, lineHeight: 1, letterSpacing: -3, color: C.ACID, marginTop: 6 }, r.label)),
      h('div', { position: 'absolute', left: 64, bottom: 96, width: 660, alignItems: 'flex-end', justifyContent: 'space-between' },
        { type: 'img', props: { src: pet.src, width: pet.width, height: pet.height } },
        bubble(r.text, bubbleW, r.text.length > 26 ? 30 : 36, { marginBottom: pet.height * 0.55 })),
      // right: the numbers
      h('div', { position: 'absolute', right: 64, top: 52, width: 384, flexDirection: 'column' },
        ...[0, 2, 4].map((row) => h('div', { justifyContent: 'space-between', marginBottom: 12 },
          ...tiles(r).slice(row, row + 2).map(([value, label], j) => tile(value, label, row + j === 0))))),
      h('div', { position: 'absolute', left: 64, bottom: 38, width: 1072, justifyContent: 'space-between', fontFamily: 'Geist Mono', fontSize: 24, color: C.MUTED },
        h('div', { color: C.ACID }, 'webling wrapped'),
        h('div', {}, 'get yours → webling.vercel.app'))),
  );
}

function tile(value, label, star) {
  return h('div', {
    width: 186, height: 118, padding: '14px 18px', flexDirection: 'column', justifyContent: 'space-between',
    background: star ? C.ACID : 'rgba(255,255,255,.05)', color: star ? C.INK : C.TEXT, border: `3px solid ${star ? C.ACID : C.LINE}`,
  },
    h('div', { fontSize: 46, lineHeight: 1, letterSpacing: -1 }, String(value)),
    h('div', { fontFamily: 'Geist Mono', fontSize: 18, color: star ? C.INK : C.MUTED }, label));
}
