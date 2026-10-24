// The landing page runs the real extension on itself: background and content scripts against the
// chrome.* stand-in, so every visitor hatches a webling right here.
(async () => {
  const $ = (s) => document.querySelector(s);
  const send = (msg) => chrome.runtime.sendMessage(msg);

  drawLineup();

  await devInstall();
  let state = await send({ type: 'state' });
  const returning = state.pet.hatched;
  if (!returning) state = await send({ type: 'hatch', name: WL.model.randomName(), presence: false });
  $('#hello').textContent = returning
    ? `Welcome back, ${state.pet.name}. It's on this page somewhere.`
    : `Meet ${state.pet.name}. It just hatched on this page. Look around.`;
  showScore(state.pet);
  chrome.storage.onChanged.addListener((c) => c.pet && showScore(c.pet.newValue));

  const manifest = await (await fetch('/ext/manifest.json')).json();
  for (const f of manifest.content_scripts[0].js) {
    if (f.startsWith('shared/')) continue; // loaded by the page already
    await new Promise((ok, fail) => {
      const el = document.createElement('script');
      el.src = `/ext/${f}`;
      el.onload = ok;
      el.onerror = fail;
      document.body.appendChild(el);
    });
  }

  // ---- snacks ----
  setTimeout(addBanner, 1500);
  $('#rebanner').onclick = addBanner;
  $('#summon').onclick = () => {
    // A pop-up that appears right after a click looks requested, and weblings leave those alone.
    // Real nag screens wait a few seconds, so this one does too.
    const btn = $('#summon');
    btn.disabled = true;
    let n = 3;
    const tick = () => {
      if (n === 0) {
        $('#countdown').textContent = '';
        btn.disabled = false;
        return addPopup();
      }
      $('#countdown').textContent = `a pop-up interrupts you in ${n}…`;
      n--;
      setTimeout(tick, 1100);
    };
    tick();
  };

  function addBanner() {
    document.querySelector('#onetrust-banner-sdk')?.remove();
    const b = document.createElement('div');
    b.id = 'onetrust-banner-sdk';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Cookie banner');
    b.innerHTML = '<p>We use cookies to personalise content and ads. (We don\'t, actually. This banner is a snack.)</p>'
      + '<button class="yes">Accept all</button><button>Reject</button>';
    b.querySelectorAll('button').forEach((x) => (x.onclick = () => b.remove()));
    document.body.appendChild(b);
    // Reading layout commits the off-screen start position, so the slide-in plays without waiting
    // for an animation frame (those can stall in background or throttled tabs).
    b.getBoundingClientRect();
    b.classList.add('in');
  }

  function addPopup() {
    const back = document.createElement('div');
    back.className = 'nl-backdrop';
    const modal = document.createElement('div');
    modal.className = 'nl-modal';
    modal.setAttribute('role', 'dialog');
    modal.innerHTML = '<button class="x" aria-label="Close">×</button><h3>Wait! Don\'t miss a thing.</h3>'
      + '<p>Subscribe to our newsletter and get 10% off your first order.</p>'
      + '<input placeholder="you@example.com" aria-label="Email"> <button>Join</button>';
    const close = () => {
      back.remove();
      modal.remove();
      document.body.style.overflow = '';
    };
    modal.querySelector('.x').onclick = close;
    back.onclick = close;
    document.body.append(back, modal);
    document.body.style.overflow = 'hidden';
  }

  function showScore(pet) {
    if (!pet) return;
    $('#n-cookies').textContent = pet.stats.cookies;
    $('#n-popups').textContent = pet.stats.popups;
    $('#n-xp').textContent = pet.xp;
  }

  // ---- the row of weblings in the hero ----
  function drawLineup() {
    const c = $('#lineup');
    const pets = [
      ['juniper', 'baby'], ['mochi7', 'adult'], ['bean', 'legend'], ['k0', 'adult'],
      ['tofu', 'baby'], ['zig', 'adult'], ['pud', 'baby'],
    ];
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = (t) => {
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, c.width, c.height);
      const shown = w < 560 ? pets.slice(0, 5) : pets;
      const scale = Math.max(3, Math.floor(Math.min(h / 16, w / shown.length / 18)));
      const slot = w / shown.length;
      shown.forEach(([seed, stage], i) => {
        const hop = still ? 0 : Math.max(0, Math.sin(t / 380 - i * 0.9)) ** 8 * 14;
        const blink = !still && Math.floor(t / 100 + i * 17) % 47 === 0;
        const img = WL.art.bake(stage, hop > 2 ? 'happy' : blink ? 'blink' : 'idle', 0, seed, scale * dpr, i % 2 === 1);
        const x = slot * i + slot / 2 - img.width / dpr / 2;
        const y = h - 8 - img.height / dpr - hop;
        g.drawImage(img, Math.round(x * dpr), Math.round(y * dpr));
      });
      g.fillStyle = '#1b1528';
      g.fillRect(0, (h - 6) * dpr, c.width, 2 * dpr);
      if (!still) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
})();
