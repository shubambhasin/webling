# Releasing Webling on the Chrome Web Store

The plan for 1.0, then how every update after it works. What to paste into the dashboard is in
[listing.md](listing.md); the images are in [assets/](assets/).

## 1.0 at a glance

| Step | Who | When | Done when |
| --- | --- | --- | --- |
| 1. Prep the package, listing, images, privacy policy | in this repo | done | `npm run release` passes |
| 2. Developer account | you | once, ~10 min | dashboard opens, email verified |
| 3. Submit, with publishing held back | you | ~20 min | status "Pending review" |
| 4. Review | Google | usually 1–3 days, can be longer | status "Approved" (or a rejection email) |
| 5. Launch day: publish, switch the site, tell people | you + this repo | your pick | listed, site says "Add to Chrome" |

## 1. Prep (done)

- Version **1.0.0** in `extension/manifest.json` and `package.json`.
- Listing copy, permission justifications and privacy answers: `listing.md`.
- Five 1280×800 screenshots (eats banners, eats pop-ups, takes, focus buddy, Wrapped), the 440×280 and
  1400×560 promo tiles: `assets/` (remake with `npm run store`).
- Privacy policy live at <https://webling.vercel.app/privacy>.
- Presence (multiplayer) is off, and nothing in the listing promises it.
- No permission that shows users a warning: only `storage`, plus a keyboard shortcut. Host access comes from
  the content script on every site, which is what the review will look at hardest (see step 4).

Before submitting, run:

```bash
npm run release
```

It checks the versions match and aren't already released, the tree is committed, presence matches what the
listing says, and the unit tests pass, then writes `dist/webling-1.0.0.zip`. It uploads nothing.

## 2. Developer account (you)

1. Go to <https://chrome.google.com/webstore/devconsole> with the Google account that should own Webling.
   Use one you'll keep; moving an item between accounts later is a support request.
2. Pay the one-time $5 registration fee and accept the developer agreement.
3. Account tab: set a contact email and verify it. The publisher name shown on the listing comes from here.

## 3. Submit (you)

1. **New item** → upload `dist/webling-1.0.0.zip`.
2. Fill **Store listing**, **Privacy practices** and **Distribution** from `listing.md`, top to bottom.
3. Visibility: **Public**. (Unlisted only hides it from search; it still needs the same review.)
4. **Hold publishing:** before submitting, untick publishing automatically after review (the submit dialog
   offers it). Approval then waits for you to press Publish, so launch day is your choice, not the reviewer's.
5. Submit. You can't edit while it's in review; withdrawing puts you back in the queue.

## 4. Review (Google)

Most reviews take one to three days. Extensions that run on every site get a closer look and can take longer.
What they check, and where we stand:

| They look for | Us |
| --- | --- |
| Broad host access with a reason | Content script on http/https only; justification in `listing.md` explains the pet walks on the page and hides pop-ups locally. |
| One clear purpose | A pet that lives on pages and eats pop-ups; everything else (takes, focus, Wrapped) is the pet. |
| Claims that match the code | Multiplayer isn't mentioned; presence is off in the build. |
| No remote code | All scripts are in the package. |
| Honest data disclosure | Nothing collected; share links are user-initiated and the policy says what they carry. |

If it's rejected, the email names the policy. Fix that one thing, bump the version (e.g. 1.0.1), run
`npm run release`, upload, and reply in the dashboard explaining the change.

## 5. Launch day

1. Dashboard → **Publish**. The listing goes live shortly after.
2. Copy the listing URL (`https://chromewebstore.google.com/detail/webling/<id>`) into `storeUrl` in
   `extension/shared/config.js`, commit, push. The site's "Hatch yours" switches from the zip steps to an
   **Add to Chrome** button. (The extension itself doesn't use `storeUrl`, so this needs no new upload.)
3. Tag the release: `git tag v1.0.0 && git push origin v1.0.0`.
4. Install it from the store yourself. It's a different extension from the unpacked one, so you'll hatch a
   new pet. Uninstall the unpacked copy to avoid two pets on every page.
5. Tell people: a roast link (`webling.vercel.app/r/linkedin.com`) shows the pet in the link preview, which
   lands better than a plain store link.

## Every update after 1.0

1. Bump `version` in `extension/manifest.json` and `package.json` (1.0.0 → 1.1.0 for features, 1.0.1 for fixes).
2. `npm run release`, then upload the zip to the existing item (Package → Upload new package) and submit.
3. After approval Chrome updates everyone in the background within hours. Saved pets carry over.
4. Tag it: `git tag v1.1.0 && git push origin v1.1.0`.

Rules that keep updates painless:

- **Don't add a permission that shows a warning** (more sites, tabs, history, downloads…). Chrome turns the
  extension off for everyone until each user re-approves it, and many never do. Prefer designs like focus
  buddy's, which needed none.
- **Saves must keep loading.** Old pets lack newer fields; read missing ones as defaults (see `pet.js`).
- **There's no rollback.** A bad release is fixed by shipping a higher version. If the dashboard offers a
  partial rollout, use it for anything risky.
- **Changing what data leaves the device** (say, turning presence on) means updating the privacy policy and
  the Privacy practices tab in the same release. `store.test` fails if the policy and the build disagree.

## After launch: what to watch

- Dashboard → Ratings and reviews, and the support tab: reply to the first reviews quickly.
- GitHub issues (the listing's support link).
- Vercel → runtime errors for `/r` and `/w`, the share-link functions.
- Pop-ups it fails to eat, or eats wrongly: add a case to `classify()` in `extension/content/eater.js` and
  a test in `test/eater.e2e.test.mjs`.

## Open decisions

- **Launch date**, now that publishing waits for you.
- **Pet export / import**, so people on the unpacked version (you included) can carry their pet over to the
  store version. Worth doing before launch only if early testers have pets they care about.
- **Category**: listing.md suggests Lifestyle → Just for Fun; pick whatever the dashboard offers closest.
