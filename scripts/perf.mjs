// What the extension costs on heavy pages: main-thread time per second with and without it, how long its
// scans take, and whether it still finds text to stand on far down a long page.
//   node scripts/perf.mjs [url ...]
import { launch } from '../test/browser.mjs';
import { bundle } from './real-sites.mjs';

const PAGES = [
  'https://en.wikipedia.org/wiki/United_States', // very long article
  'https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population', // a big table
  'https://news.ycombinator.com/item?id=1', // small, for comparison
  'https://github.com/torvalds/linux/blob/master/MAINTAINERS', // a huge file view
  'https://www.theverge.com', // a busy media page
];
const WINDOW_S = 15;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measure(chrome, url) {
  const page = await chrome.open('about:blank');
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false });
    await page.send('Performance.enable');
    const loaded = page.waitFor('Page.loadEventFired', 30000).catch(() => {});
    await page.send('Page.navigate', { url });
    await loaded;
    await sleep(5000);
    const busy = async () => {
      const { metrics } = await page.send('Performance.getMetrics');
      const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
      return m.TaskDuration; // seconds of main-thread work so far
    };
    const over = async () => {
      const a = await busy();
      await sleep(WINDOW_S * 1000);
      return ((await busy()) - a) * 1000 / WINDOW_S; // ms of main-thread work per second
    };
    const without = await over();

    const { frameTree } = await page.send('Page.getFrameTree');
    const { executionContextId: contextId } = await page.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'webling' });
    const inExt = async (expression) => (await page.send('Runtime.evaluate', { expression, contextId, awaitPromise: true, returnByValue: true })).result.value;
    await inExt(bundle());
    await sleep(5000);
    const withPet = await over();
    const scans = await inExt(`(() => {
      const time = (fn) => { const t = performance.now(); for (let i = 0; i < 5; i++) fn(); return +((performance.now() - t) / 5).toFixed(1); };
      const world = time(WL.world.scan), eater = time(WL.eater.scan);
      const textNodes = (() => { let n = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); while (w.nextNode()) n++; return n; })();
      const top = WL.world.platforms.length;
      scrollTo({ top: document.documentElement.scrollHeight * 0.8, behavior: 'instant' });
      WL.world.scan();
      const deep = WL.world.platforms.filter((p) => p.y > scrollY && p.y < scrollY + innerHeight).length;
      return { world, eater, textNodes, platformsTop: top, platformsInViewDeep: deep };
    })()`);
    return { url, without: +without.toFixed(1), withPet: +withPet.toFixed(1), added: +(withPet - without).toFixed(1), ...scans };
  } finally {
    page.close();
  }
}

const chrome = await launch();
try {
  for (const url of process.argv.slice(2).length ? process.argv.slice(2) : PAGES) {
    try {
      console.log(JSON.stringify(await measure(chrome, url)));
    } catch (e) {
      console.log(JSON.stringify({ url, error: String(e.message || e) }));
    }
  }
} finally {
  await chrome.close();
  process.exit(0);
}
