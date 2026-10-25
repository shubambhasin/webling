# Webling

A tiny pixel pet that lives on the internet. Hatch one, and it follows you to every site: it walks
along the lines of text, hops between paragraphs, eats cookie banners and pop-ups, grows up, and
meets the weblings of other people reading the same page.

Chrome extension (Manifest V3, no build step) plus a small WebSocket presence server.

**Live demo: <https://webling.vercel.app>.** A webling hatches on the page and eats its cookie banner.

## Try it

Download the extension from the site (or use this repo's `extension/` folder), then in Chrome:
`chrome://extensions` → Developer mode → **Load unpacked** → pick the folder. The welcome tab opens;
name your egg and hatch it. Open any article.

Meeting other weblings needs the presence server. Run it locally and point `presenceUrl` in
`extension/shared/config.js` at `ws://localhost:8787`:

```bash
cd server && npm install && cd ..
```

```bash
npm run server
```

## Develop without reloading the extension

```bash
npm run dev
```

Open <http://localhost:5180/dev/>. The harness runs the real background, content and popup scripts
in one page with a `chrome.*` stand-in (`dev/chrome-shim.js`), on a test article with a cookie banner
and a newsletter pop-up. Open it in two tabs to see presence. `/dev/popup.html` is the popup.
Add `?timers` to drive animation from timers (for automated checks in background tabs).

## Tests

```bash
npm test
```

- `npm run test:unit`: the art, life rules, the voice, background state handling, the store kit, shareable
  roasts (the page and its preview image) and the presence server (seconds). Run `npm install` first:
  the roast images need satori and resvg. `voice.test` checks every event the code names has lines for every vibe, every line fits
  a bubble, fills its placeholders and stays PG, and that site detection can't be fooled by lookalike
  domains.
- `npm run test:e2e`: real headless Chrome, driven over the DevTools protocol with no dependencies
  (`test/browser.mjs`). `eater.e2e` covers what gets eaten and what doesn't, undo, per-site off, and
  regressions: pages that never stop changing, banners arriving mid-meal or hidden when their turn
  comes, dragging the pet mid-leap, and stalled meals. `site.e2e` builds the landing page and clicks
  through it like a visitor, including "Another cookie banner" while animation frames are throttled.
  `personality.e2e` pokes, yeets and doomscrolls at a real pet and checks what it says back.
  Uses your installed Chrome; set `CHROME_PATH` for another one. Skipped when none is found.

## What's where

| | |
| --- | --- |
| `extension/shared/sprite.js` | the pet's pixel art (built from eye/mouth/feet parts), colours from a seed, frame baking |
| `extension/shared/pet.js` | life rules: stages, xp, aura and its tiers, hunger, weekly stats |
| `extension/shared/voice.js` | the five vibes, 300+ lines by event and vibe, site detection, daily mantras |
| `extension/content/brain.js` | the personality on a page: what it notices, when it speaks, aura moments |
| `extension/background.js` | owns saved state; applies messages one at a time so tabs never clobber each other |
| `extension/content/world.js` | finds platforms: the top of every visible text line, plus the screen bottom |
| `extension/content/actor.js` | the pet: walk, jump, fall, sleep, drag and throw, poke |
| `extension/content/eater.js` | finds cookie banners and promo modals and eats them (with undo) |
| `extension/content/presence.js` | other people's weblings on the same page, and boops |
| `extension/popup/` | hatching, the pet's home, settings, the share card |
| `api/` | shareable roasts: the `/r/<site>` page and its preview image (Vercel functions) |
| `server/` | presence relay; stores nothing |
| `store/` | the Chrome Web Store kit: listing copy and privacy answers, images, and the mock pages they're shot on |

## How the pieces behave

**Vibe.** Every egg hatches with one of five vibes, picked from its seed: Unbothered, Chaotic,
Dramatic, Wholesome or Chronically online. It sets how the pet talks (its own lines are twice as
likely as the shared ones), how fast it moves, how chatty it is, and its idle moves (side-eye,
unimpressed, a little dance).

**What it notices.** Which kind of site you're on (19 kinds, 125 domains, from LinkedIn to shopping to GitHub),
first visits versus sites you're on all the time, late nights and Mondays, doomscrolling (six screens
in fifteen seconds), long reads, coming back to the tab, copying, mouse wiggling, pokes (playful →
annoyed → "we're no longer mutuals"), being held and thrown, sticking a landing. Reactions to you
always get a line. Unprompted remarks get at most one per ~35s (divided by the vibe's chattiness),
with longer cooldowns per topic, and never while it's asleep, busy or being held. To add lines, edit
`LINES` in `voice.js`; `voice.test` will tell you if one is too long or names a missing event.

**Aura.** Earned by being iconic: new site +2, cookie banner +10, pop-up +15, boop +3, being booped
+5, snack +2, sticking a landing +4. Lost by being undignified: getting thrown −3, poke spam −5,
spitting food out −8. Tiers: aura debt, NPC, side character (50), main character (250, it starts to
sparkle), aura farmer (1000), final boss (3000). The page can only report landings, throws and poke
spam, each at most once per 8s; everything else is awarded by the background.

**Growth.** New site +5 xp, cookie banner +15, pop-up +20, boop +1, being booped +2.
Baby → Grown-up at 120 xp → Legend (with a crown) at 1500. Each pet's colour comes from its seed.

**Hunger.** The tummy drains 4% an hour. Meals refill it (cookie banner +20, pop-up +30), and you can
give a snack every 3 hours. A hungry pet is slower and says so. It never dies, because guilt makes
people uninstall.

**Eating.** Only cosmetic: the element is clipped away behind the pet's mouth, then hidden with inline
styles. Backdrops and scroll locks that came with a pop-up are undone too. Nothing is clicked, so a
consent banner is left unanswered (sites treat that as no consent). A modal that appears within 3s of
your click is treated as one you asked for and is left alone. Every meal has **Spit it out**, and
eating can be switched off globally or per site.

**Presence.** The room is SHA-256 of the page's origin and path, so the server never sees a URL,
query string or title. The only other thing shared is the pet's name, colour seed and stage. Other
pets aren't position-synced: each visitor's pet is simulated locally on your copy of the page.
Presence is skipped in incognito, on pages with a password field, and on mail, docs, banking,
payment and sign-in hosts. Pets connect only while the tab is visible.

## The site

`site/` is the landing page at <https://webling.vercel.app>, themed "the internet at 3am". It runs the
real extension on itself: every visitor hatches a pet, the page buries itself in pop-up hell (cookie
banner, newsletter, notifications, a flash sale) and the pet eats its way out. Then: "It has takes"
(pick a place or roast any domain, in any vibe), a three-question vibe check whose result can become
your pet's vibe and be shared, and the aura ladder. Reduced motion skips the chaos.

**Shareable roasts.** Every take on a website in the roast box has a "Share this roast" button. The link,
`/r/<site>?v=<vibe>&t=<take>&n=<name>&s=<seed>&g=<stage>`, is a page whose link preview (X, WhatsApp, Slack,
Discord, iMessage) is your pet saying that exact take about that site: a 1200×630 PNG drawn by
`api/roast-image.mjs` with satori and resvg, from the extension's own `voice.js` and pixel art. Every query
parameter is optional, so `/r/linkedin.com` works on its own. People who open the link can roast their own
site from there. `vercel.json` rewrites `/r/*` to the functions in `api/`; the local dev server runs the
same handlers, so `npm run build:site && node scripts/dev-server.mjs public` serves them too.

**Themes.** Dark (the original), light and paper. The site follows the system setting until you pick one in
the header, and remembers the pick (`site/theme.js`). Colours are tokens at the top of `site/site.css`.

`npm run build:site` assembles it into
`public/`: the page, the extension's scripts (so the page runs the real extension on itself), the
extension zip and a generated `og.png`. Vercel runs the same build (see `vercel.json`) on every push:
`main` deploys to production, other branches get preview URLs. To preview the build locally:

```bash
npm run build:site && node scripts/dev-server.mjs public
```

## Publishing to the Chrome Web Store

Everything the dashboard asks for is in [`store/listing.md`](store/listing.md): the description, category,
permission justifications, privacy-practices answers and a pre-submit checklist. The privacy policy is
`site/privacy.html`, live at <https://webling.vercel.app/privacy>.

- `npm run zip` writes `dist/webling-<version>.zip` and notes when presence is off.
- `npm run store` remakes `store/assets/` (five 1280×800 screenshots, the 440×280 and 1400×560 promo tiles)
  by running the real extension on the mock pages in `store/` in headless Chrome. `npm run store 3` redoes
  one. `store.test` checks the sizes, and that the listing and privacy policy still match the manifest
  and whether presence is on.
- Presence: deploy `server/` to a host with WebSockets (Fly, Render, Railway; not Vercel) behind TLS and set
  `presenceUrl` in `extension/shared/config.js` to the `wss://` address. Until then presence is off, which is
  what the listing and policy say. Turning it on means updating both (the test will remind you).

## Known gaps

- Check that page CSPs never block the content script's WebSocket on strict sites. If one does, move
  the socket into the service worker and relay to tabs over a port.
- Pop-up detection is heuristic, so expect false negatives on unusual sites before false positives. Add
  cases to `classify()` in `eater.js` as you find them.
- Platforms are text-line tops, not real glyph outlines; images and buttons aren't platforms yet.
- The presence server is single-process with in-memory rooms. For scale, move rooms to Cloudflare
  Durable Objects (one object per room hash) or shard by room.

## Next for growth

- GIF capture of your pet doing something on a famous site (the TikTok/X loop).
- Egg mixing: an invite link where your egg and a friend's make a new pet.
- Weekly "webling wrapped" card from the `lastWeek` stats that are already being kept.
- The web-only funnel: paste any URL and set pets loose on a screenshot of it.
