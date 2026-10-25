// /r/<host>: a shared roast. Link previews (X, WhatsApp, Slack, Discord, iMessage) show the image; people
// who open it see the same card, can roast a site of their own, or go get a webling. See _roast.mjs.
import { WL, esc, page, parse, previewMeta } from './_roast.mjs';

export function GET(request) {
  const origin = new URL(request.url).origin;
  const r = parse(request.url);
  if (!r) {
    return new Response(page({ title: 'Not a website', body: `<h1>that's not a website bestie</h1>
      <p class="sub">Roast links look like <code>/r/linkedin.com</code>.</p>${form('')}` }), {
      status: 404, headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  const link = `${origin}/r/${r.host}?${r.query}`;
  const img = `${origin}/r/${r.host}/image.png?${r.query}`;
  const who = r.name ? `${r.name}'s` : 'A webling’s';
  const vibe = WL.voice.VIBES[r.vibe].label;
  const title = `${who} take on ${r.host}: “${r.text}”`;
  const description = `${who} ${vibe.toLowerCase()} take on ${r.host}. Roast any site, or get a pixel pet that eats pop-ups.`;
  const alt = `A pixel pet saying “${r.text}” about ${r.host}`;
  const meta = previewMeta({ link, img, title: `“${r.text}”`, description, alt });
  const body = `
    <p class="sub">${esc(who)} <b>${esc(vibe.toLowerCase())}</b> take on <b>${esc(r.host)}</b></p>
    <img class="card" src="${esc(img)}" width="1200" height="630" alt="${esc(alt)}">
    <div class="acts">
      <button class="btn primary" id="share" type="button" data-url="${esc(link)}" data-text="${esc(`“${r.text}” on ${r.host}`)}">Share this roast</button>
      <a class="btn ghost" href="/#get">Get your own webling</a>
    </div>
    <h2>Now roast yours.</h2>
    ${form(r.vibe)}`;
  return new Response(page({ title, meta, body }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=86400' },
  });
}

export const form = (vibe) => `
    <form class="roast" id="roast" data-vibe="${esc(vibe)}">
      <label for="roast-input">Any site. Any vibe. No mercy.</label>
      <div class="row">
        <input id="roast-input" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="yourportfolio.dev">
        <button class="btn small" type="submit">Roast</button>
      </div>
      <p class="fine" id="roast-error" hidden>that's not a website bestie</p>
    </form>`;
