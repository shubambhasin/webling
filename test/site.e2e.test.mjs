// The landing page, built and served like production, driven in headless Chrome.
// WEBLING_URL=https://webling.vercel.app runs the same checks against a deployed site instead.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { serve } from '../scripts/dev-server.mjs';
import { chromePath, launch } from './browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const skip = chromePath ? false : 'no Chrome found (set CHROME_PATH)';
let server, chrome, base;

const SNACKS_UP = `[...document.querySelectorAll('[data-snack]')].filter((s) => s.isConnected && getComputedStyle(s).display !== 'none').length`;
const stats = (page) => page.eval(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.stats)`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  if (skip) return;
  if (process.env.WEBLING_URL) {
    base = process.env.WEBLING_URL.replace(/\/$/, '');
  } else {
    execFileSync('node', ['scripts/build-site.mjs'], { cwd: root, stdio: 'ignore' });
    server = await serve(`${root}public`);
    base = `http://127.0.0.1:${server.port}`;
  }
  chrome = await launch();
});

after(async () => {
  await chrome?.close();
  await server?.close();
});

// A page with pop-up hell already cleared (by the pet, or by nuking it when we're not testing that).
async function calmPage() {
  const p = await chrome.open(`${base}/`);
  await p.until('globalThis.WL?.me && 1', 10000, 'pet loaded');
  await p.until(`document.querySelectorAll('[data-snack]').length >= 4`, 5000, 'pop-up hell');
  await p.click('#nuke');
  await p.until(`${SNACKS_UP} === 0 && document.querySelector('#hell-status').hidden`, 3000, 'nuked');
  return p;
}

test('first visit: the page buries itself in pop-ups and the new pet eats its way out', { skip }, async () => {
  const p = await chrome.open(`${base}/`);
  try {
    const name = await p.until(`globalThis.WL?.me && WL.state.pet.name`, 10000, 'pet hatched');
    await p.until(`${SNACKS_UP} === 4`, 5000, 'four snacks: cookie banner, newsletter, notifications, sale');
    assert.equal(await p.eval(`document.querySelector('#hell-status').hidden`), false, 'status bar up');
    await p.until(`document.querySelector('#hell-status').hidden`, 45000, 'pop-up hell cleared by the pet');
    assert.equal(await p.eval(SNACKS_UP), 0);
    assert.match(await p.eval(`document.querySelector('#hello').textContent`), new RegExp(`${name} cleared pop-up hell in [\\d.]+s`));
    const s = await stats(p);
    assert.equal(s.cookies, 1);
    assert.equal(s.popups, 3);
    assert.equal(await p.eval(`document.querySelector('#pet-eaten').textContent`), '4', 'hero card counts the snacks');
    assert.notEqual(await p.eval(`getComputedStyle(document.body).overflow`), 'hidden', 'scrolling unlocked');
    assert.deepEqual(p.errors, []);
  } finally {
    p.close();
  }
});

test('"nuke them" clears pop-up hell at once', { skip }, async () => {
  const p = await calmPage();
  try {
    assert.equal(await p.eval(`document.querySelectorAll('.snack-backdrop').length`), 0);
    await p.until(`/nuked pop-up hell/.test(document.querySelector('#hello').textContent)`, 3000, 'owns up to the nuke');
  } finally {
    p.close();
  }
});

test('"Summon more chaos" brings a banner and a pop-up, and both get eaten, every time', { skip }, async () => {
  const p = await calmPage();
  try {
    for (let round = 1; round <= 2; round++) {
      await p.click('#more-chaos');
      await p.until(`${SNACKS_UP} >= 1`, 2000, `round ${round}: banner arrives`);
      await p.until(`document.querySelector('.snack-win') && ${SNACKS_UP} === 0`, 25000, `round ${round}: both eaten`);
    }
    assert.deepEqual(p.errors, []);
  } finally {
    p.close();
  }
});

test('regression: summoned banners slide in even when animation frames are throttled', { skip }, async () => {
  const p = await calmPage();
  try {
    await p.eval('window.requestAnimationFrame = () => 0; true');
    await p.click('#more-chaos');
    await p.until(`(() => { const b = [...document.querySelectorAll('.snack-cookie')].pop(); return b && b.getBoundingClientRect().top < innerHeight - 20; })()`, 2000, 'banner slid into view');
  } finally {
    p.close();
  }
});

test('takes: each place gets a take in the chosen vibe', { skip }, async () => {
  const p = await calmPage();
  try {
    const inPool = (event, vibe) => p.eval(`WL.voice.pool('${event}', '${vibe}').includes(document.querySelector('#take-text').textContent)`);
    const myVibe = await p.eval('WL.voice.vibeOf(WL.state.pet)');
    await p.click('#take-chips button'); // LinkedIn
    assert.ok(await inPool('site_linkedin', myVibe), 'LinkedIn take in my vibe');
    await p.click('#vibe-chips button[data-vibe="dramatic"]');
    assert.ok(await inPool('site_linkedin', 'dramatic'), 'same place, dramatic vibe');
    assert.equal(await p.eval(`document.querySelector('#vibe-chips [aria-pressed="true"]').dataset.vibe`), 'dramatic');
  } finally {
    p.close();
  }
});

test('roast any site: recognises domains, and tells you when it is not one', { skip }, async () => {
  const p = await calmPage();
  try {
    const roast = async (text) => {
      await p.eval(`document.querySelector('#roast-input').value = ${JSON.stringify(text)}; document.querySelector('#roast button').click(); true`);
      return p.eval(`document.querySelector('#take-text').textContent`);
    };
    const vibe = await p.eval(`document.querySelector('#vibe-chips [aria-pressed="true"]').dataset.vibe`);
    const shopping = await roast('https://www.amazon.in/some/product?id=1');
    assert.ok(await p.eval(`WL.voice.pool('site_shopping', '${vibe}').includes(${JSON.stringify(shopping)})`), shopping);
    const fresh = await roast('my-cool-blog.dev');
    assert.ok(await p.eval(`WL.voice.pool('arrive_new', '${vibe}').map((l) => WL.voice.fill(l, { host: 'my-cool-blog.dev' })).includes(${JSON.stringify(fresh)})`), fresh);
    assert.equal(await roast('lol'), "that's not a website bestie");
  } finally {
    p.close();
  }
});

test('a roast can be shared: the link shows the same take, with a preview image', { skip }, async () => {
  const p = await calmPage();
  try {
    await p.eval(`document.querySelector('#roast-input').value = 'https://www.linkedin.com/in/me'; document.querySelector('#roast button').click(); true`);
    assert.equal(await p.eval(`document.querySelector('#share-row').hidden`), false, 'share button shows for a site');
    const take = await p.eval(`document.querySelector('#take-text').textContent`);
    const href = await p.eval(`document.querySelector('#roast-link').href`);
    const q = new URL(href).searchParams;
    assert.equal(new URL(href).pathname, '/r/linkedin.com');
    assert.equal(q.get('n'), await p.eval('WL.state.pet.name'));
    assert.equal(q.get('v'), await p.eval(`document.querySelector('#vibe-chips [aria-pressed="true"]').dataset.vibe`));

    // Share copies the link (stubbed clipboard: headless Chrome has none to give)
    await p.eval(`navigator.clipboard.writeText = (t) => { window.copied = t; return Promise.resolve(); }; true`);
    await p.click('#share-roast');
    assert.equal(await p.until('window.copied', 2000, 'link copied'), href);
    assert.match(await p.eval(`document.querySelector('#share-roast').textContent`), /copied/);

    // A moment that isn't a website has nothing to share
    await p.click('#take-chips button:nth-child(7)'); // 3:07 AM
    assert.equal(await p.eval(`document.querySelector('#share-row').hidden`), true);

    const page = await chrome.open(href);
    try {
      assert.equal(await page.eval(`document.querySelector('meta[property="og:title"]').content`), `“${take}”`);
      const img = await page.eval(`document.querySelector('meta[property="og:image"]').content`);
      assert.match(img, /\/r\/linkedin\.com\/image\.png\?/);
      const r = await fetch(img);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('content-type'), 'image/png');
      await page.until(`document.querySelector('img.card').complete && document.querySelector('img.card').naturalWidth === 1200`, 10000, 'card shown on the page');
      // and roast another from there
      await page.eval(`document.querySelector('#roast-input').value = 'my-blog.dev'; document.querySelector('#roast button').click(); true`);
      await page.until(`location.pathname === '/r/my-blog.dev'`, 10000, 'went to the new roast');
      assert.deepEqual(page.errors, []);
    } finally {
      page.close();
    }
  } finally {
    p.close();
  }
});

test('themes: follows the system until you pick dark, light or paper, then remembers', { skip }, async () => {
  const p = await chrome.open('about:blank');
  const bg = () => p.eval('getComputedStyle(document.documentElement).backgroundColor');
  const pressed = () => p.eval(`document.querySelector('.theme-switch [aria-pressed="true"]').dataset.theme`);
  try {
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await p.send('Page.navigate', { url: `${base}/` });
    await p.until(`document.querySelector('.theme-switch button')`, 10000, 'theme switch');
    await p.eval(`localStorage.removeItem('webling-theme'), true`);
    await p.send('Page.reload');
    await p.until(`document.querySelector('.theme-switch button')`, 10000, 'theme switch');
    assert.equal(await p.eval('document.documentElement.dataset.theme ?? null'), null);
    assert.equal(await bg(), 'rgb(247, 245, 255)', 'light system → light page');
    assert.equal(await pressed(), 'light');

    await p.eval(`document.querySelector('.theme-switch [data-theme="paper"]').click(), true`);
    assert.equal(await bg(), 'rgb(245, 237, 214)');
    await p.send('Page.reload');
    await p.until(`document.querySelector('.theme-switch button')`, 10000, 'theme switch');
    assert.equal(await p.eval('document.documentElement.dataset.theme'), 'paper', 'remembered');
    assert.equal(await pressed(), 'paper');

    await p.eval(`document.querySelector('.theme-switch [data-theme="dark"]').click(), true`);
    assert.equal(await bg(), 'rgb(13, 10, 23)', 'dark even on a light system');
    await p.eval(`localStorage.removeItem('webling-theme'), true`);
  } finally {
    p.close();
  }
});

test('vibe check: three answers give a vibe, and it can become your pet’s vibe', { skip }, async () => {
  const p = await calmPage();
  try {
    for (let i = 0; i < 3; i++) await p.eval(`document.querySelector('#quiz .answers button[data-vibe="wholesome"]').click(); true`);
    assert.equal(await p.eval(`document.querySelector('#quiz').dataset.result`), 'wholesome');
    assert.match(await p.eval(`document.querySelector('#share-vibe').href`), /^https:\/\/x\.com\/intent\/post\?text=I%20got%20Wholesome/);
    await p.click('#adopt');
    await p.until(`chrome.runtime.sendMessage({ type: 'state' }).then((s) => s.pet.vibe === 'wholesome')`, 3000, 'saved');
    assert.equal(await p.eval(`document.querySelector('#pet-vibe').textContent`), 'Wholesome');
    await p.eval(`document.querySelector('#retake').click(); true`);
    assert.match(await p.eval(`document.querySelector('#quiz .step').textContent`), /question 1 of 3/);
  } finally {
    p.close();
  }
});

test('the aura ladder marks where your pet is', { skip }, async () => {
  const p = await calmPage();
  try {
    assert.equal(await p.eval(`document.querySelectorAll('#ladder li').length`), 6);
    const tier = await p.eval('WL.model.auraTier(WL.state.pet)');
    assert.equal(await p.eval(`document.querySelector('#ladder li.here b').textContent`), tier);
  } finally {
    p.close();
  }
});

test('reduced motion: no pop-up hell, just the page', { skip }, async () => {
  const p = await chrome.open('about:blank');
  try {
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await p.send('Page.navigate', { url: `${base}/` });
    await p.until('globalThis.WL?.me && 1', 10000, 'pet loaded');
    await sleep(1500);
    assert.equal(await p.eval(`document.querySelectorAll('[data-snack]').length`), 0);
    assert.equal(await p.eval(`document.querySelector('#hell-status').hidden`), true);
  } finally {
    p.close();
  }
});

test('a returning visitor keeps their pet', { skip }, async () => {
  const first = await chrome.open(`${base}/`);
  const name = await first.until(`globalThis.WL?.me && WL.state.pet.name`, 10000, 'pet hatched');
  first.close();
  const p = await chrome.open(`${base}/`);
  try {
    await p.until(`globalThis.WL?.me`, 10000, 'pet loaded');
    assert.equal(await p.eval(`WL.state.pet.name`), name);
    assert.match(await p.eval(`document.querySelector('#hello').textContent`), /Welcome back/);
  } finally {
    p.close();
  }
});

test('the download, preview image and privacy policy are served', { skip }, async () => {
  for (const [path, type] of [['/webling-extension.zip', 'application/zip'], ['/og.png', 'image/png'], ['/privacy.html', 'text/html'], ['/r/lol', 'text/html']]) {
    const r = await fetch(base + path);
    assert.equal(r.status, path === '/r/lol' ? 404 : 200, path);
    assert.ok(r.headers.get('content-type').startsWith(type), `${path}: ${r.headers.get('content-type')}`);
  }
});
