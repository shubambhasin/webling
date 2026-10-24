// Loads the extension's classic shared scripts into a sandbox so Node tools and tests can use them.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../extension/', import.meta.url);

export function loadShared(files = ['shared/config.js', 'shared/sprite.js', 'shared/pet.js'], extra = {}) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, Promise, Date, Math, ...extra });
  ctx.globalThis = ctx;
  for (const f of files) vm.runInContext(readFileSync(new URL(f, root), 'utf8'), ctx, { filename: f });
  return ctx;
}
