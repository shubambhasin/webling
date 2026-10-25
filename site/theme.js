// Dark, light or paper. The page follows the system until you pick one, and remembers the pick. Load it in
// <head> so the page never flashes the wrong theme; any .theme-switch on the page becomes the picker.
(() => {
  const KEY = 'webling-theme', THEMES = ['dark', 'light', 'paper'], root = document.documentElement;
  const light = matchMedia('(prefers-color-scheme: light)');
  let picked = null;
  try { picked = localStorage.getItem(KEY); } catch {}
  if (THEMES.includes(picked)) root.dataset.theme = picked;

  const current = () => root.dataset.theme || (light.matches ? 'light' : 'dark');
  function show() {
    document.querySelectorAll('.theme-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.theme === current())));
    if (globalThis.drawWordmark) document.querySelectorAll('canvas.wordmark').forEach(drawWordmark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--night').trim());
  }
  function pick(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch {}
    show();
  }
  addEventListener('DOMContentLoaded', () => {
    for (const el of document.querySelectorAll('.theme-switch')) {
      const ICON = { dark: '☾', light: '☀', paper: '✎' };
      el.innerHTML = THEMES.map((t) => `<button type="button" data-theme="${t}" aria-label="${t} theme" aria-pressed="false">${ICON[t]}<span> ${t}</span></button>`).join('');
      el.onclick = (e) => e.target.closest('button') && pick(e.target.closest('button').dataset.theme);
    }
    show();
  });
  light.addEventListener('change', show);
})();
