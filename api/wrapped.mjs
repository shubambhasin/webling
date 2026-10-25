// /w?…: a shared Webling Wrapped (see _wrapped.mjs). Link previews show the week's card; people who open
// it see the card, can roast a site, or go get a webling of their own.
import { WL, esc, page, previewMeta } from './_roast.mjs';
import { parseWrapped } from './_wrapped.mjs';
import { form } from './roast.mjs';

export function GET(request) {
  const origin = new URL(request.url).origin;
  const r = parseWrapped(request.url);
  const link = `${origin}/w?${r.query}`, img = `${origin}/w/image.png?${r.query}`;
  const title = `${r.name}'s week, wrapped: ${r.label}`;
  const description = `“${r.text}” ${r.name}, a ${WL.voice.VIBES[r.vibe].label.toLowerCase()} webling, on its human's week online.`;
  const alt = `${r.name}'s Webling Wrapped: ${r.label}. “${r.text}”`;
  const body = `
    <p class="sub"><b>${esc(r.name)}</b>'s week, wrapped · ${esc(r.when)}</p>
    <img class="card" src="${esc(img)}" width="1200" height="630" alt="${esc(alt)}">
    <div class="acts">
      <button class="btn primary" id="share" type="button" data-url="${esc(link)}" data-text="${esc(`my week, wrapped: ${r.label}`)}">Share this week</button>
      <a class="btn ghost" href="/#get">Get your own (and your own Wrapped)</a>
    </div>
    <h2>Meanwhile, roast a site.</h2>
    ${form(r.vibe)}`;
  return new Response(page({ title, meta: previewMeta({ link, img, title, description, alt }), body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=86400' },
  });
}
