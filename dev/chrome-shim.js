// Just enough of the chrome.* extension API to run the background, popup and content scripts in
// one ordinary page, for development without reloading the extension. Not shipped.
(() => {
  const KEY = 'webling-dev-storage';
  const read = () => JSON.parse(localStorage.getItem(KEY) || '{}');
  const changed = [], messages = [], installed = [];
  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  globalThis.chrome = {
    storage: {
      local: {
        async get(keys) {
          const all = read(), out = {};
          for (const k of [].concat(keys)) if (k in all) out[k] = clone(all[k]);
          return out;
        },
        async set(obj) {
          const all = read(), changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { oldValue: all[k], newValue: clone(v) };
            all[k] = clone(v);
          }
          localStorage.setItem(KEY, JSON.stringify(all));
          setTimeout(() => changed.forEach((fn) => fn(clone(changes), 'local')));
        },
      },
      onChanged: { addListener: (fn) => changed.push(fn) },
    },
    runtime: {
      onMessage: { addListener: (fn) => messages.push(fn) },
      onInstalled: { addListener: (fn) => installed.push(fn) },
      sendMessage: (msg) => new Promise((resolve) => {
        const m = clone(msg);
        for (const fn of messages) if (fn(m, { tab: {} }, (r) => resolve(clone(r)))) return;
        resolve(undefined);
      }),
    },
    tabs: {
      create: ({ url }) => console.info('[shim] would open tab', url),
      query: async () => [{ url: location.href }],
    },
    extension: { inIncognitoContext: false },
  };

  // ?timers drives animation from timers, for automated checks in a background tab where
  // requestAnimationFrame is paused.
  if (new URLSearchParams(location.search).has('timers')) {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  // Call after background.js has loaded.
  globalThis.devInstall = () => Promise.all(installed.map((fn) => fn({ reason: read().pet ? 'update' : 'install' })));
  globalThis.devReset = () => { localStorage.removeItem(KEY); location.reload(); };
})();
