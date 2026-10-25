// /r/<host>: a shared roast. Link previews (X, WhatsApp, Slack, Discord, iMessage) show the image; people
// who open it see the same card, can roast a site of their own, or go get a webling. See _roast.mjs.
import { WL, esc, parse } from './_roast.mjs';

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
  const meta = `
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(link)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Webling">
  <meta property="og:url" content="${esc(link)}">
  <meta property="og:title" content="${esc(`“${r.text}”`)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(img)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(`A pixel pet saying “${r.text}” about ${r.host}`)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(`“${r.text}”`)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(img)}">`;
  const body = `
    <p class="sub">${esc(who)} <b>${esc(vibe.toLowerCase())}</b> take on <b>${esc(r.host)}</b></p>
    <img class="card" src="${esc(img)}" width="1200" height="630" alt="${esc(`A pixel pet saying “${r.text}” about ${r.host}`)}">
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

const form = (vibe) => `
    <form class="roast" id="roast" data-vibe="${esc(vibe)}">
      <label for="roast-input">Any site. Any vibe. No mercy.</label>
      <div class="row">
        <input id="roast-input" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="yourportfolio.dev">
        <button class="btn small" type="submit">Roast</button>
      </div>
      <p class="fine" id="roast-error" hidden>that's not a website bestie</p>
    </form>`;

const page = ({ title, meta = '', body }) => `<!doctype html>
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
