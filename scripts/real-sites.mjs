// Runs the real extension on real websites in headless Chrome and reports what it ate and what it missed.
//   node scripts/real-sites.mjs [out-dir] [url ...]
// Each site is loaded, given a few seconds to show its consent banner or pop-ups, then the extension's
// scripts run in an isolated world (like a content script, outside the page's own JavaScript). It notes the
// consent tools it can see on the page, waits for the pet to eat, and writes report.json plus before/after
// screenshots of every site where something was left uneaten. Consent banners depend on where you are:
// sites often show them only to visitors from the EU, so a site with nothing to eat isn't a failure.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch } from '../test/browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const [outArg, ...urlArgs] = process.argv.slice(2);
const out = outArg || `${root}real-sites-report`;
mkdirSync(out, { recursive: true });

export const SITES = [
  // the consent tools' own sites (they show their own banners)
  'https://www.onetrust.com', 'https://www.cookiebot.com/en/', 'https://www.didomi.io', 'https://usercentrics.com',
  'https://www.quantcast.com', 'https://trustarc.com', 'https://www.osano.com', 'https://www.cookieyes.com',
  'https://www.iubenda.com/en/', 'https://termly.io', 'https://complianz.io', 'https://www.consentmanager.net',
  'https://sourcepoint.com', 'https://www.cookiefirst.com',
  // news and media
  'https://www.bbc.com', 'https://www.theguardian.com/international', 'https://www.reuters.com', 'https://edition.cnn.com',
  'https://www.forbes.com', 'https://www.spiegel.de', 'https://www.lemonde.fr', 'https://elpais.com', 'https://www.corriere.it',
  'https://www.independent.co.uk', 'https://www.theverge.com', 'https://www.wired.com', 'https://techcrunch.com',
  'https://www.economist.com', 'https://www.ft.com',
  // shopping and travel
  'https://www.booking.com', 'https://www.airbnb.com', 'https://www.amazon.de', 'https://www.ebay.co.uk', 'https://www.zalando.de',
  'https://www.ikea.com/gb/en/', 'https://www.hm.com', 'https://www.asos.com', 'https://www.nike.com', 'https://www.adidas.com',
  'https://www.skyscanner.net', 'https://www.etsy.com',
  // everything else
  'https://stackoverflow.com', 'https://medium.com', 'https://www.imdb.com', 'https://www.spotify.com', 'https://www.yahoo.com',
  'https://www.bing.com', 'https://www.linkedin.com', 'https://www.reddit.com', 'https://www.twitch.tv', 'https://www.dropbox.com',
];

// Known consent tools by the element they put on the page. Checked in the page itself.
const DETECT = `(() => {
  const TOOLS = {
    OneTrust: '#onetrust-banner-sdk', Cookiebot: '#CybotCookiebotDialog', Didomi: '#didomi-host .didomi-popup-container, #didomi-notice',
    Usercentrics: '#usercentrics-root, #usercentrics-cmp-ui', Quantcast: '.qc-cmp2-container', TrustArc: '#truste-consent-track, .truste_box_overlay, #consent_blackbar',
    Sourcepoint: '[id^="sp_message_container_"]', 'Google consent': '.fc-consent-root', Osano: '.osano-cm-window', CookieYes: '.cky-consent-container',
    Complianz: '#cmplz-cookiebanner-container .cmplz-cookiebanner, .cmplz-cookiebanner', iubenda: '#iubenda-cs-banner', Termly: '[class*="termly-styles-root"], #termly-code-snippet-support',
    consentmanager: '#cmpbox', CookieFirst: '.cookiefirst-root', Borlabs: '#BorlabsCookieBox', Ketch: '#lanyard_root', 'Cookie Consent': '.cc-window',
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width * r.height > 2000 && r.bottom > 0 && r.top < innerHeight && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.1;
  };
  const found = [];
  let i = 0;
  for (const [tool, sel] of Object.entries(TOOLS)) {
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el) || found.some((f) => f.el.contains(el) || el.contains(f.el))) continue;
      found.push({ tool, el });
    }
  }
  // anything else fixed on screen that talks about cookies
  for (const el of document.querySelectorAll('body *')) {
    if (found.length > 12) break;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (!visible(el) || found.some((f) => f.el.contains(el) || el.contains(f.el))) continue;
    const text = (el.innerText || '').slice(0, 4000);
    if (/cookie|consent/i.test(text) && text.length < 6000) found.push({ tool: 'unrecognised', el });
  }
  return found.map(({ tool, el }) => {
    el.setAttribute('data-wl-probe', String(++i));
    return { probe: i, tool, tag: el.localName, id: el.id, cls: String(el.className).slice(0, 80), text: (el.innerText || '').trim().slice(0, 140) };
  });
})()`;

// In the extension's world: what became of each probed element, and everything it ate.
const STATUS = `(() => {
  const hidden = (el) => { for (let e = el; e; e = e.parentElement) if (e.style.getPropertyValue('display') === 'none' && e.style.getPropertyPriority('display') === 'important') return true; return false; };
  const desc = (el) => el ? \`\${el.localName}\${el.id ? '#' + el.id : ''}\${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''}\` : null;
  const probes = [...document.querySelectorAll('[data-wl-probe]')].map((el) => {
    const root = WL.eater.rootOf(el);
    const inMeal = WL.eater.meals.some((m) => m.el.contains(el) || el.contains(m.el));
    return { probe: +el.dataset.wlProbe, eaten: hidden(el) || inMeal, root: desc(root), kind: root ? WL.eater.classify(root) : null,
      selfKind: WL.eater.classify(el), textLen: (el.innerText || '').length, shadow: !!el.shadowRoot, iframe: !!el.querySelector('iframe') };
  });
  const meals = WL.eater.meals.map((m) => ({ kind: m.kind, el: desc(m.el), text: (m.el.innerText || '').trim().slice(0, 100) }));
  return { started: !!WL.me, probes, meals, busy: WL.me?.busy };
})()`;

export const bundle = () => {
  const ext = (f) => readFileSync(`${root}extension/${f}`, 'utf8');
  const manifest = JSON.parse(ext('manifest.json'));
  return [
    readFileSync(`${root}dev/chrome-shim.js`, 'utf8'),
    ...['shared/config.js', 'shared/sprite.js', 'shared/pet.js', 'shared/voice.js', 'background.js'].map(ext),
    ...manifest.content_scripts[0].js.filter((f) => !f.startsWith('shared/')).map(ext),
    `devInstall().then(() => chrome.runtime.sendMessage({ type: 'hatch', name: 'Tester', presence: false })).then(() => true)`,
  ].join('\n;\n');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (u) => new URL(u).hostname.replace(/^www\./, '');

async function visit(chrome, url) {
  const page = await chrome.open('about:blank');
  const result = { url, site: slug(url) };
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const loaded = page.waitFor('Page.loadEventFired', 30000).catch(() => {});
    const nav = await page.send('Page.navigate', { url });
    if (nav.errorText) throw new Error(nav.errorText);
    await loaded;
    await sleep(6000); // consent tools load late
    result.found = await page.eval(DETECT);
    const shot = async (name) => {
      const { data } = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
      return { name, data };
    };
    const before = await shot('before');

    const { frameTree } = await page.send('Page.getFrameTree');
    const { executionContextId: contextId } = await page.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'webling' });
    const inExt = async (expression) => {
      const r = await page.send('Runtime.evaluate', { expression, contextId, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const t0 = Date.now();
    await inExt(bundle());
    let status;
    for (;;) {
      await sleep(1000);
      status = await inExt(STATUS);
      const waiting = status.probes.some((p) => !p.eaten && (p.kind || p.selfKind));
      if ((!waiting && !status.busy && Date.now() - t0 > 12000) || Date.now() - t0 > 40000) break;
    }
    Object.assign(result, status, { seconds: Math.round((Date.now() - t0) / 1000) });
    result.missed = status.probes.filter((p) => !p.eaten).length;
    if (result.missed || status.meals.length) {
      const after = await shot('after');
      for (const s of [before, after]) writeFileSync(`${out}/${result.site}-${s.name}.jpg`, Buffer.from(s.data, 'base64'));
    }
  } catch (e) {
    result.error = String(e.message || e).slice(0, 200);
  } finally {
    page.close();
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const urls = urlArgs.length ? urlArgs : SITES;
  const workers = 4, results = [];
  let i = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    const chrome = await launch();
    try {
      while (i < urls.length) {
        const url = urls[i++];
        const r = await visit(chrome, url);
        results.push(r);
        const found = (r.found || []).map((f) => f.tool).join(', ') || 'no banner seen';
        console.log(`${r.error ? '!' : r.missed ? '✗' : '✓'} ${r.site.padEnd(24)} ${found}${r.missed ? `  (${r.missed} missed)` : ''}${r.meals?.length ? `  ate ${r.meals.length}` : ''}${r.error ? `  ${r.error}` : ''}`);
      }
    } finally {
      await chrome.close();
    }
  }));
  results.sort((a, b) => a.site.localeCompare(b.site));
  writeFileSync(`${out}/report.json`, JSON.stringify(results, null, 2));
  const withBanner = results.filter((r) => r.found?.length);
  console.log(`\n${results.length} sites, ${withBanner.length} showed something, ${withBanner.filter((r) => !r.missed).length} fully eaten, ${results.filter((r) => r.error).length} errors. Report: ${out}/report.json`);
  process.exit(0); // a stray Chrome child shouldn't keep the run alive
}
