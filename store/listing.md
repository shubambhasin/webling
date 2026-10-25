# Chrome Web Store listing

Copy and paste for the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
field by field. The images are in `store/assets/` (regenerate them with `npm run store`), and the package
comes from `npm run zip` (`dist/webling-<version>.zip`).

Written for launching **with presence off** (`presenceUrl: ''` in `extension/shared/config.js`). If presence is
on when you submit, use the "If presence is on" answers further down instead, and update the privacy
policy first.

---

## Package

| | |
| --- | --- |
| Upload | `dist/webling-0.1.0.zip` from `npm run zip` |
| Name | Webling (from the manifest) |
| Summary | From the manifest's `description` (132 characters max): *A tiny pixel pet that lives on your web pages. It eats cookie banners and pop-ups, and has opinions about your tabs.* |

## Store listing tab

**Description** (paste as is; the store keeps line breaks, not Markdown):

```
The internet is a mess. Your webling eats it.

Webling is a tiny pixel pet that lives on every page you visit. It walks along the lines of text, hops between paragraphs, and when a cookie banner or pop-up shows up, it jumps on and eats it. Crumbs and all.

🍪 EATS COOKIE BANNERS AND POP-UPS
Cookie banners, newsletter traps, "turn on notifications?", flash sales and paywall nags get chomped off your screen, usually with a roast on the side ("accept all? i decline all"). Nothing is clicked: the banner is just hidden, so you never accept anything by accident. Wanted that one? Press "Spit it out" and it comes back.

💬 IT HAS TAKES
Your webling knows when you're on LinkedIn, shopping at midnight, doomscrolling at 3am or back on the same site for the fifth time today, and it will say something about it. 300+ lines across 60 situations, never the same one twice in a row.

✨ FIVE VIBES
Unbothered, Chaotic, Dramatic, Wholesome or Chronically online. Each vibe talks, moves and side-eyes differently. Pick one when you hatch, or let the egg decide.

🌱 IT GROWS UP AND FARMS AURA
Every meal and every new site helps it grow from baby to grown-up to legend (with a crown). Being iconic earns aura; getting yeeted across the screen costs it. Climb from NPC to main character to final boss.

🫶 A PET THAT WON'T GUILT-TRIP YOU
It gets hungry, you can give it snacks, and it falls asleep if you leave it alone. It never dies. Poke it, pick it up, throw it.

📸 SHARE CARD
Your webling's colours, stats and today's mantra on a card made for posting.

🔒 PRIVATE BY DESIGN
• Everything stays on your device: your pet, your settings and the count of sites you've explored.
• No accounts, no analytics, no ads, no tracking.
• It never reads or sends what you type, and it never clicks anything on a page.
• Turn eating off everywhere, or just on sites where you want the pop-ups.

Try it before installing: https://webling.vercel.app
Open source: https://github.com/shubambhasin/webling
```

| Field | Value |
| --- | --- |
| Category | Lifestyle → Just for Fun (fallback if that's not offered: Entertainment) |
| Language | English |
| Store icon | `extension/icons/128.png` |
| Screenshots | `store/assets/screenshot-1.png` … `screenshot-5.png` (1280×800, in that order) |
| Small promo tile | `store/assets/promo-small.png` (440×280) |
| Marquee promo tile | `store/assets/promo-marquee.png` (1400×560; optional, but needed to be featured) |
| Official URL | none, unless you verify a domain in Search Console |
| Homepage URL | https://webling.vercel.app |
| Support URL | https://github.com/shubambhasin/webling/issues |
| Mature content | No |

## Privacy practices tab

**Single purpose description:**

```
Webling is a virtual pet that lives on the web pages you visit. It walks on the page, reacts to what kind of site you're on, and eats (hides) cookie banners and pop-ups that cover the page, with an undo for every one.
```

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| `storage` | `Saves the pet (name, colours, growth, aura, hunger, stats), the user's settings, and the list of hostnames it has visited, so it can show "sites explored" and greet sites it knows. Stored locally with chrome.storage.local; never sent anywhere.` |
| Host permission (content script on `http://*/*` and `https://*/*`) | `The pet is drawn on top of every page the user visits. It needs the page's layout to stand and walk on lines of text, and to find cookie banners and pop-ups that cover the page so it can hide them. It reads only element positions, styles and the visible text of overlays, all on the device. Nothing from the page is collected or transmitted.` |

**Are you using remote code?** No, I am not using remote code.
(Every script is in the package; there is no `eval`, no remote script tags, and no WebAssembly.)

**Data usage: what user data do you plan to collect?** Tick nothing. With presence off, the extension
makes no network requests at all; everything it keeps stays in `chrome.storage.local`. (The store counts
data as collected only when it leaves the device.)

**Certify all three:**

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://webling.vercel.app/privacy

### If presence is on

Presence sends, while a tab is visible and the user has it switched on: a SHA-256 hash of the page's
origin and path (the room), and the pet's name, colour seed and stage. Then:

- Data usage: tick **Web history** (the room hash is derived from the page address) and **Personally
  identifiable information** only if you treat pet names as such (they're user-chosen display names; the
  conservative answer is to tick it).
- Add `wss://<your server>` to the description's privacy section, and to the privacy policy's "Meeting other
  weblings" section.

## Distribution tab

| | |
| --- | --- |
| Visibility | Public (or Unlisted for a soft launch, shared by link) |
| Regions | All regions |
| Pricing | Free |

## Before you press Submit

- [ ] `npm test` passes.
- [ ] `presenceUrl` is what you mean it to be (`npm run zip` says whether presence is on).
- [ ] `version` in `extension/manifest.json` is higher than the last upload (each upload needs a new one).
- [ ] https://webling.vercel.app/privacy is live and matches the answers above.
- [ ] One-time: the developer account ($5 registration fee) and verified contact email.

Review usually takes a few days. Broad host access is the most likely thing a reviewer asks about; the
justification above answers it, and the source is public if they want to look.
