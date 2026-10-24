// Drives a headless Chrome over the DevTools protocol, with no dependencies (Node's own WebSocket).
// Set CHROME_PATH to use a different browser binary.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export const chromePath = CANDIDATES.find((p) => existsSync(p)) || null;

export async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'webling-chrome-'));
  const proc = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1200,800',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let err = '';
    proc.stderr.on('data', (d) => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) resolve(m[1]);
    });
    proc.on('exit', (code) => reject(new Error(`Chrome exited (${code}): ${err}`)));
  });
  const httpBase = wsUrl.replace(/^ws:/, 'http:').replace(/\/devtools\/.*$/, '');

  return {
    // Open a new tab at url; resolves once it has loaded.
    async open(url) {
      const target = await (await fetch(`${httpBase}/json/new?about:blank`, { method: 'PUT' })).json();
      const page = await connect(target.webSocketDebuggerUrl);
      await page.send('Page.enable');
      await page.send('Runtime.enable');
      const loaded = page.waitFor('Page.loadEventFired', 15000);
      await page.send('Page.navigate', { url });
      await loaded;
      page.id = target.id;
      return page;
    },
    async close() {
      proc.kill('SIGKILL');
      await new Promise((r) => proc.once('exit', r));
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map(), listeners = [];
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    } else if (m.method) {
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      for (const l of [...listeners]) l(m);
    }
  };
  const page = {
    errors,
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    }),
    waitFor: (method, ms = 10000) => new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), ms);
      const l = (m) => {
        if (m.method !== method) return;
        listeners.splice(listeners.indexOf(l), 1);
        clearTimeout(t);
        resolve(m.params);
      };
      listeners.push(l);
    }),
    // Evaluate an expression in the page (awaits promises) and return its JSON value.
    async eval(expression) {
      const r = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    // Poll an expression until it's truthy; returns its value, or throws after ms.
    async until(expression, ms = 10000, what = expression) {
      const t0 = Date.now();
      for (;;) {
        const v = await page.eval(expression);
        if (v) return v;
        if (Date.now() - t0 > ms) throw new Error(`timed out after ${ms}ms waiting for: ${what}`);
        await new Promise((r) => setTimeout(r, 100));
      }
    },
    // A real mouse click at the centre of the element matching selector, scrolled into view.
    // Throws if something else (an overlay, the pet) is on top of that point, like a user would hit.
    async click(selector) {
      const box = await page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
        const top = document.elementFromPoint(x, y);
        return { x, y, covered: el.contains(top) ? null : (top?.localName || 'nothing') + (top?.id ? '#' + top.id : '') };
      })()`);
      if (box.covered) throw new Error(`${selector} is covered by ${box.covered}`);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await page.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
      }
    },
    close: () => ws.close(),
  };
  return page;
}
