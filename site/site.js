// The landing page runs the real extension on itself (background and content scripts against the
// chrome.* stand-in), so every visitor hatches a webling here, and the page buries itself in
// pop-ups for it to eat.
(async () => {
  const $ = (s) => document.querySelector(s);
  const send = (msg) => chrome.runtime.sendMessage(msg);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  document.querySelectorAll('canvas.wordmark').forEach(drawWordmark);

  let state, pet;
  const vibeOf = () => WL.voice.vibeOf(pet);
  const vibe = () => WL.voice.VIBES[vibeOf()];


  // ---- the pet card in the hero ----
  function showPet() {
    $('#pet-name').textContent = pet.name;
    $('#pet-vibe').textContent = vibe().label;
    $('#pet-aura').textContent = (pet.aura || 0).toLocaleString();
    $('#pet-tier').textContent = WL.model.auraTier(pet);
    $('#pet-eaten').textContent = pet.stats.cookies + pet.stats.popups;
    const c = $('#pet-face'), g = c.getContext('2d');
    const stage = WL.model.stage(pet);
    const { img } = WL.art.bakeHalo(stage, 'idle', 0, pet.seed, stage === 'baby' ? 4 : 3);
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img, Math.round((c.width - img.width) / 2), Math.round((c.height - img.height) / 2));
  }

  // ---- pop-up hell ----
  const SNACKS = {
    newsletter: { x: '44%', y: '44%', r: '-2deg', title: 'Newsletter.exe',
      body: '<h4>Wait! Don\'t go!</h4><p>Subscribe to our newsletter and never miss a thing. Ever. We mean it.</p><input placeholder="you@email.com" aria-label="Email"> <div class="acts"><button>Subscribe</button></div>' },
    notify: { x: '57%', y: '29%', r: '1.5deg', title: 'Notifications',
      body: '<h4>Turn on notifications?</h4><p>Get alerts about things you don\'t care about, at 3am.</p><div class="acts"><button>Allow</button><button>Maybe later (never)</button></div>' },
    sale: { x: '52%', y: '64%', r: '-1deg', title: 'SALE!!!', cls: 'sale',
      body: '<h4>FLASH SALE</h4><p>50% off things you were not shopping for. Ends in 00:09:59.</p><div class="acts"><button>Claim discount</button></div>' },
    paywall: { x: '47%', y: '52%', r: '2deg', title: 'Premium',
      body: '<h4>You\'ve read 1 of 1 free articles</h4><p>Unlock unlimited access for the price of a coffee a day.</p><div class="acts"><button>Unlock now</button></div>' },
  };
  let snackN = 0;

  function addCookie() {
    document.querySelectorAll('.snack-cookie').forEach((b) => b.style.display === 'none' && b.remove());
    const b = document.createElement('div');
    b.className = 'snack-cookie';
    b.id = `snack-${++snackN}`;
    b.dataset.snack = 'cookie';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Cookie banner');
    b.innerHTML = '<p><b>We value your privacy</b> (we don\'t). We use cookies to personalise ads and sell your vibes. Read our cookie policy.</p>'
      + '<button>Accept all</button><button>Reject all</button><button>Manage 437 partners</button>';
    b.querySelectorAll('button').forEach((x) => (x.onclick = () => b.remove()));
    document.body.appendChild(b);
    b.getBoundingClientRect(); // commit the start position so the slide-in plays without an animation frame
    b.classList.add('in');
    return b.id;
  }

  function addWindow(kind, { backdrop = true } = {}) {
    const s = SNACKS[kind];
    if (backdrop && !document.querySelector('.snack-backdrop:not([style*="none"])')) {
      const bd = document.createElement('div');
      bd.className = 'snack-backdrop';
      document.body.appendChild(bd);
    }
    const w = document.createElement('div');
    w.className = `snack-win ${s.cls || ''}`;
    w.id = `snack-${++snackN}`;
    w.dataset.snack = kind;
    w.setAttribute('role', 'dialog');
    w.style.cssText = `--x:${s.x};--y:${s.y};--r:${s.r}`;
    w.innerHTML = `<div class="bar"><span>${s.title}</span><button aria-label="Close">×</button></div><div class="body">${s.body}</div>`;
    w.querySelector('.bar button').onclick = () => {
      w.remove();
      if (!snacksLeft()) clearBackdrops();
    };
    document.body.appendChild(w);
    document.body.style.overflow = 'hidden';
    return w.id;
  }

  const isUp = (el) => el.isConnected && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';
  const snacksLeft = () => [...document.querySelectorAll('[data-snack]')].filter(isUp).length;
  function clearBackdrops() {
    document.querySelectorAll('.snack-backdrop').forEach((b) => b.remove());
    document.body.style.overflow = '';
  }

  let hellStart = 0, hellTimer = null;
  function buryPage() {
    hellStart = performance.now();
    const order = [['cookie'], ['newsletter'], ['notify'], ['sale']];
    order.forEach(([kind], i) => setTimeout(() => (kind === 'cookie' ? addCookie() : addWindow(kind)), 250 + i * 260));
    $('#hell-status').hidden = false;
    hellTimer = setInterval(() => {
      const left = snacksLeft();
      $('#hell-left').textContent = left;
      if (left === 0 && performance.now() - hellStart > 1500) {
        clearInterval(hellTimer);
        clearBackdrops();
        $('#hell-status').hidden = true;
        const secs = ((performance.now() - hellStart) / 1000).toFixed(1);
        $('#hello').textContent = `${pet.name} cleared pop-up hell in ${secs}s. The internet could never.`;
      }
    }, 300);
  }

  function nuke() {
    document.querySelectorAll('[data-snack]').forEach((s) => s.remove());
    clearBackdrops();
  }

  function moreChaos() {
    const btn = $('#more-chaos');
    addCookie();
    // A pop-up right after a click looks requested, and weblings leave those alone. Real nags wait.
    btn.disabled = true;
    const kinds = Object.keys(SNACKS);
    let n = 3;
    const tick = () => {
      if (n === 0) {
        btn.disabled = false;
        btn.textContent = 'Summon more chaos';
        return addWindow(kinds[Math.floor(Math.random() * kinds.length)]);
      }
      btn.textContent = `pop-up incoming in ${n}…`;
      n--;
      setTimeout(tick, 1100);
    };
    tick();
  }

  // ---- takes ----
  const PLACES = [
    ['LinkedIn', 'site_linkedin', {}, 'sideeye'], ['Amazon', 'site_shopping', {}, 'happy'], ['Reddit', 'site_reddit', {}, 'sideeye'],
    ['GitHub', 'site_dev', {}, 'meh'], ['YouTube', 'site_video', {}, 'happy'], ['ChatGPT', 'site_ai', {}, 'sideeye'],
    ['3:07 AM', 'time_late', { time: '3:07 AM' }, 'shock'], ['Doomscrolling', 'doomscroll', {}, 'shock'],
    ['Monday', 'time_monday', {}, 'meh'], ['A pop-up', 'ate_popup', {}, 'eat'],
  ];
  let takeVibe = null, lastTake = null, stageClip = 'idle', stageT = 0;

  function setupTakes() {
    takeVibe = vibeOf();
    const chips = $('#take-chips');
    for (const p of PLACES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p[0];
      b.setAttribute('aria-pressed', 'false');
      b.onclick = () => {
        chips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        take(p);
      };
      chips.appendChild(b);
    }
    const vchips = $('#vibe-chips');
    for (const id of WL.voice.VIBE_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.vibe = id;
      b.textContent = WL.voice.VIBES[id].label;
      b.setAttribute('aria-pressed', String(id === takeVibe));
      b.onclick = () => {
        takeVibe = id;
        vchips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        if (lastTake) take(lastTake);
      };
      vchips.appendChild(b);
    }
    $('#roast').onsubmit = (e) => {
      e.preventDefault();
      const host = $('#roast-input').value.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/^www\./, '');
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return say("that's not a website bestie", 'meh');
      const kind = WL.voice.siteKind(host);
      take(['', kind ? `site_${kind}` : 'arrive_new', { host }, kind ? 'sideeye' : 'happy']);
    };
    animateStage();
  }

  function take(p) {
    lastTake = p;
    const [, event, vars, clip] = p;
    say(WL.voice.line(event, takeVibe, { name: pet.name, ...vars }), clip);
  }

  function say(text, clip = 'happy') {
    $('#take-text').textContent = text;
    stageClip = clip;
    stageT = 0;
  }

  function animateStage() {
    const c = $('#take-stage');
    const draw = (now) => {
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, c.width, c.height);
      const stage = WL.model.stage(pet);
      const [aw, ah] = WL.art.size(stage);
      const scale = Math.floor(Math.min(w / aw, h / ah) * dpr * 0.9);
      const def = WL.art.CLIPS[stageClip] || WL.art.CLIPS.idle;
      const frame = Math.floor(now / 1000 * def.fps) % def.frames.length;
      const { img, pad } = WL.art.bakeHalo(stage, stageClip, frame, pet.seed, scale, false);
      const bob = still ? 0 : Math.round(Math.sin(now / 300) * dpr * 2);
      g.drawImage(img, Math.round((c.width - img.width) / 2), c.height - img.height + pad - bob);
      if (!still) requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    if (still) setInterval(() => requestAnimationFrame(draw), 500);
  }

  // ---- vibe check ----
  const QUESTIONS = [
    ['A cookie banner appears. You:', [
      ['ignore it. not my problem', 'unbothered'], ['click every button to see what happens', 'chaotic'],
      ['feel personally attacked', 'dramatic'], ['accept all so the website feels loved', 'wholesome'],
      ['screenshot it for the group chat', 'online']]],
    ["It's 3am. You are:", [
      ['asleep, obviously', 'unbothered'], ['47 tabs deep with no plan', 'chaotic'],
      ['writing a monologue in the notes app', 'dramatic'], ["texting a friend 'get some rest'", 'wholesome'],
      ['doomscrolling. what else', 'online']]],
    ['How do you leave a party?', [
      ['irish exit, no notes', 'unbothered'], ['on a scooter, somehow', 'chaotic'], ['with a speech', 'dramatic'],
      ['after hugging everyone twice', 'wholesome'], ['you were never there, you were on your phone', 'online']]],
  ];
  let quizStep = 0, tally = {};

  function setupQuiz() {
    quizStep = 0;
    tally = {};
    renderQuestion();
  }

  function renderQuestion() {
    const [q, answers] = QUESTIONS[quizStep];
    const box = $('#quiz');
    box.innerHTML = `<p class="step">question ${quizStep + 1} of ${QUESTIONS.length}</p><h3>${esc(q)}</h3><div class="answers"></div>`;
    const list = box.querySelector('.answers');
    // shuffled, so the vibes aren't always in the same slot
    for (const [text, v] of [...answers].sort(() => Math.random() - 0.5)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.vibe = v;
      b.textContent = text;
      b.onclick = () => {
        tally[v] = (tally[v] || 0) + 1;
        if (++quizStep < QUESTIONS.length) renderQuestion();
        else renderResult();
      };
      list.appendChild(b);
    }
  }

  function renderResult() {
    const best = Math.max(...Object.values(tally));
    const tied = Object.keys(tally).filter((v) => tally[v] === best);
    const id = tied[Math.floor(Math.random() * tied.length)];
    const v = WL.voice.VIBES[id];
    const box = $('#quiz');
    box.dataset.result = id;
    box.innerHTML = `<div class="result"><canvas width="168" height="144" aria-hidden="true"></canvas><div>
      <p class="step">your vibe</p><p class="label">${esc(v.label)}</p><p>${esc(v.blurb)}.</p>
      <p class="quote">“${esc(WL.voice.LINES.ambient[id][0])}”</p>
      <div class="row"><button class="btn primary" type="button" id="adopt">Make it ${esc(pet.name)}'s vibe</button>
      <a class="btn small" id="share-vibe" target="_blank" rel="noopener">Share</a>
      <button class="btn ghost small" type="button" id="retake">Retake</button></div></div></div>`;
    const { img } = WL.art.bakeHalo('adult', id === 'unbothered' ? 'sideeye' : id === 'dramatic' ? 'shock' : 'happy', 0, pet.seed, 11);
    box.querySelector('canvas').getContext('2d').drawImage(img, 0, 0);
    const text = `I got ${v.label} on the webling vibe check: ${v.blurb}. what's yours?`;
    box.querySelector('#share-vibe').href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${location.origin}/#vibe-check`)}`;
    box.querySelector('#retake').onclick = setupQuiz;
    box.querySelector('#adopt').onclick = async () => {
      state = await send({ type: 'setVibe', vibe: id });
      pet = state.pet;
      showPet();
      box.querySelector('#adopt').textContent = 'Done. New vibe who dis';
      box.querySelector('#adopt').disabled = true;
      takeVibe = id;
      document.querySelectorAll('#vibe-chips button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vibe === id)));
      if (WL.me) {
        WL.me.say(`${v.label.toLowerCase()} era unlocked`, 2600);
        WL.fx.sparkles(WL.me.sx, WL.me.sy - WL.me.h / 2, 8);
      }
    };
  }

  // ---- aura ladder ----
  function drawLadder() {
    const list = $('#ladder');
    const tiers = WL.model.AURA_TIERS;
    const here = WL.model.auraTier(pet);
    const stages = ['baby', 'baby', 'adult', 'adult', 'adult', 'legend'];
    list.innerHTML = '';
    tiers.forEach((t, i) => {
      const li = document.createElement('li');
      if (t.label === here) li.className = 'here';
      const scale = 3 + i;
      const { img: art } = WL.art.bakeHalo(stages[i], i === 0 ? 'meh' : i === 5 ? 'happy' : 'idle', 0, `${pet.seed}`, scale);
      const c = document.createElement('canvas');
      c.width = art.width;
      c.height = art.height;
      c.style.width = `${Math.min(art.width, 104)}px`;
      c.getContext('2d').drawImage(art, 0, 0);
      li.appendChild(c);
      li.insertAdjacentHTML('beforeend', `<b>${esc(t.label)}</b>${t.min === -Infinity ? 'below 0' : `${t.min.toLocaleString()}+`}`);
      list.appendChild(li);
    });
  }

  // ---- pixel lettering ----
  function drawWordmark(c) {
    const FONT = {
      W: ['1...1', '1...1', '1...1', '1.1.1', '1.1.1', '1.1.1', '.1.1.'],
      E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
      B: ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'],
      L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
      I: ['111', '.1.', '.1.', '.1.', '.1.', '.1.', '111'],
      N: ['1...1', '11..1', '11..1', '1.1.1', '1..11', '1..11', '1...1'],
      G: ['.111.', '1...1', '1....', '1.111', '1...1', '1...1', '.111.'],
    };
    const text = c.dataset.text, cell = Number(c.dataset.cell), dpr = Math.max(1, Math.round(devicePixelRatio || 1));
    const glyphs = [...text].map((ch) => FONT[ch]);
    const cols = glyphs.reduce((s, g) => s + g[0].length + 1, 0);
    c.width = (cols + 1) * cell * dpr;
    c.height = 8 * cell * dpr;
    c.style.width = `${(cols + 1) * cell}px`;
    const g = c.getContext('2d');
    const paint = (dx, dy, color) => {
      g.fillStyle = color;
      let x = 0;
      for (const glyph of glyphs) {
        glyph.forEach((row, y) => [...row].forEach((on, i) => {
          if (on === '1') g.fillRect(Math.round((x + i + dx) * cell * dpr), Math.round((y + dy) * cell * dpr), cell * dpr, cell * dpr);
        }));
        x += glyph[0].length + 1;
      }
    };
    paint(0.5, 0.5, '#ff5fa2');
    paint(0, 0, '#f4efff');
  }

  // ---- hatch, bury the page, let the pet loose ----
  async function main() {
    await devInstall();
    state = await send({ type: 'state' });
    const returning = state.pet.hatched;
    if (!returning) state = await send({ type: 'hatch', name: WL.model.randomName(), presence: false });
    pet = state.pet;
    $('#hello').textContent = returning
      ? `Welcome back. ${pet.name} is loose on this page again. Poke it. Yeet it.`
      : `That's ${pet.name}. It just hatched. ${vibe().label} energy. It's loose on this page: poke it, yeet it.`;
    showPet();
    chrome.storage.onChanged.addListener((c) => {
      if (!c.pet?.newValue) return;
      pet = c.pet.newValue;
      showPet();
      drawLadder();
    });

    // Bury the page before the pet arrives, then let it loose.
    if (!still) buryPage();
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

    setupTakes();
    setupQuiz();
    drawLadder();
    $('#more-chaos').onclick = moreChaos;
    $('#nuke').onclick = nuke;
  }

  main();
})();
