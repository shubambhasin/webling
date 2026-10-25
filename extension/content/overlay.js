// One fixed layer above the page: a canvas for pixels plus a small DOM layer for hit boxes,
// speech bubbles and toasts. It lives in a closed shadow root so page styles can't reach it.
(() => {
  const WL = (globalThis.WL ||= {});

  const CSS = `
    :host { all: initial; }
    canvas { position: fixed; left: 0; top: 0; pointer-events: none; image-rendering: pixelated; }
    .ui { position: fixed; inset: 0; pointer-events: none; font: 600 12px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #1b1528; }
    .hit { position: absolute; left: 0; top: 0; pointer-events: auto; cursor: grab; touch-action: none; }
    .hit.off { pointer-events: none; }
    .hit.held { cursor: grabbing; }
    .bubble { position: absolute; left: 0; top: 0; width: max-content; max-width: 230px; text-align: center; background: #fffdf5; border: 2px solid #1b1528;
      padding: 3px 7px; box-shadow: 2px 2px 0 #1b1528; opacity: 0; transition: opacity .15s; }
    .bubble.on { opacity: 1; }
    .bubble.ghost { background: #efeaff; font-weight: 500; }
    .chip, .toast { position: fixed; pointer-events: auto; background: #1b1528; color: #fffdf5; border: 2px solid #1b1528;
      box-shadow: 2px 2px 0 rgba(0,0,0,.25); padding: 5px 9px; display: flex; gap: 8px; align-items: center; }
    .chip { right: 12px; bottom: 12px; opacity: .92; cursor: default; }
    .chip.focus { bottom: auto; top: 12px; pointer-events: none; padding: 3px 8px; font-size: 11px; opacity: .85; }
    .chip i { width: 7px; height: 7px; background: #7dff9b; display: inline-block; }
    .toast { left: 12px; bottom: 12px; transform: translateY(12px); opacity: 0; transition: .18s; }
    .toast.on { transform: none; opacity: 1; }
    .toast button { all: unset; cursor: pointer; color: #c9b8ff; text-decoration: underline; }
    [hidden] { display: none !important; }
  `;

  const ov = (WL.overlay = {
    mount() {
      const host = document.createElement('webling-root');
      host.style.cssText = 'all:initial;position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
      // Open only in the dev harness, so tests can reach inside.
      const root = host.attachShadow({ mode: globalThis.devInstall ? 'open' : 'closed' });
      root.innerHTML = `<style>${CSS}</style><canvas></canvas><div class="ui"></div>`;
      ov.host = host;
      ov.canvas = root.querySelector('canvas');
      ov.ctx = ov.canvas.getContext('2d');
      ov.ui = root.querySelector('.ui');
      document.documentElement.appendChild(host);
      ov.resize();
      addEventListener('resize', ov.resize, { passive: true });
      // Some pages rebuild <html>'s children; put the layer back if it gets removed.
      new MutationObserver(() => {
        if (!host.isConnected) document.documentElement.appendChild(host);
      }).observe(document.documentElement, { childList: true });
    },

    // Hide the whole layer (pet, bubbles, toasts) or bring it back.
    show(on) {
      ov.host.style.display = on ? '' : 'none';
    },

    resize() {
      const d = (ov.dpr = Math.min(Math.max(1, Math.round(devicePixelRatio || 1)), 3));
      ov.canvas.width = innerWidth * d;
      ov.canvas.height = innerHeight * d;
      ov.canvas.style.width = innerWidth + 'px';
      ov.canvas.style.height = innerHeight + 'px';
      ov.ctx.imageSmoothingEnabled = false;
    },

    el(tag, cls, parent = ov.ui) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      parent.appendChild(e);
      return e;
    },

    // A short message bottom-left, with an optional action button.
    toast(text, action, onAction, ms = 6000) {
      ov.toastEl ||= ov.el('div', 'toast');
      const t = ov.toastEl;
      t.replaceChildren(document.createTextNode(text));
      if (action) {
        const b = document.createElement('button');
        b.textContent = action;
        b.onclick = () => {
          t.classList.remove('on');
          onAction();
        };
        t.appendChild(b);
      }
      requestAnimationFrame(() => t.classList.add('on'));
      const hide = () => {
        clearTimeout(ov.toastTimer);
        ov.toastTimer = setTimeout(() => t.classList.remove('on'), ms);
      };
      t.onpointerenter = () => clearTimeout(ov.toastTimer);
      t.onpointerleave = hide;
      hide();
    },

    // The focus timer, small, top-right, never in the way of clicks. null removes it.
    focusChip(text) {
      ov.focusEl ||= ov.el('div', 'chip focus');
      ov.focusEl.hidden = !text;
      ov.focusEl.textContent = text || '';
    },

    // "N weblings here" in the bottom-right corner.
    chip(count) {
      ov.chipEl ||= ov.el('div', 'chip');
      ov.chipEl.hidden = count < 2;
      ov.chipEl.innerHTML = `<i></i>${count} weblings here`;
    },
  });
})();
