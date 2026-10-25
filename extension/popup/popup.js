// The toolbar popup (and the welcome tab, with ?welcome=1): hatch the egg, then look after the pet.
(() => {
  const M = WL.model;
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const send = (msg) => chrome.runtime.sendMessage(msg);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  if (new URLSearchParams(location.search).has('welcome')) document.body.classList.add('page');

  let state = null, host = '', stage = null;

  (async () => {
    [state] = await Promise.all([send({ type: 'state' }), findHost()]);
    render();
  })();

  async function findHost() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const u = new URL(tab.url);
      if (u.protocol === 'http:' || u.protocol === 'https:') host = u.hostname.replace(/^www\./, '');
    } catch {}
  }

  function render() {
    stage?.stop();
    if (state.pet.hatched) home();
    else hatchView();
  }

  // ---- first run ----
  function hatchView() {
    const suggestion = M.randomName();
    app.innerHTML = `
      <header><b>webling</b><span class="pill">Egg</span></header>
      <section class="hatch">
        <canvas class="stage" aria-label="Your egg"></canvas>
        <h1>Your egg is warm.</h1>
        <p>Name it and it hatches. It will live on the pages you visit, eat cookie banners and pop-ups, and grow up.</p>
        <div class="field">
          <input type="text" id="name" maxlength="16" placeholder="${esc(suggestion)}" aria-label="Name">
          <button id="dice" title="Pick a random name" aria-label="Random name">?!</button>
        </div>
        <label class="pick">Vibe
          <select id="vibe">
            <option value="">let the egg decide</option>
            ${WL.voice.VIBE_IDS.map((v) => `<option value="${v}">${esc(WL.voice.VIBES[v].label)}: ${esc(WL.voice.VIBES[v].blurb)}</option>`).join('')}
          </select>
        </label>
        <label class="check" ${WL.config.presenceUrl ? '' : 'hidden'}>
          <input type="checkbox" id="presence" checked>
          <span>Meet other weblings on the same page
            <small>Only a scrambled page ID is shared, never the address. Always off on mail, banking and sign-in pages.</small></span>
        </label>
        <button class="primary" id="hatch">Hatch</button>
      </section>`;
    stage = new Stage($('.stage'), () => ({ stage: 'egg', seed: state.pet.seed }));
    const name = $('#name');
    $('#dice').onclick = () => (name.value = M.randomName());
    name.onkeydown = (e) => e.key === 'Enter' && $('#hatch').click();
    $('#hatch').onclick = async () => {
      $('#hatch').disabled = true;
      await stage.crack();
      state = await send({ type: 'hatch', name: name.value || suggestion, presence: $('#presence').checked, vibe: $('#vibe').value });
      render();
      stage.celebrate();
      const vibe = WL.voice.VIBES[WL.voice.vibeOf(state.pet)];
      speak(null, {}, `${state.pet.name} hatched with ${vibe.label.toLowerCase()} energy ✨`);
    };
  }

  // ---- the pet's home ----
  function home() {
    const p = state.pet, now = Date.now();
    const id = M.stage(p), info = M.stageInfo(id), prog = M.progress(p);
    const full = M.fullness(p, now), mood = M.mood(p, now);
    const snackWait = p.snackAt + M.SNACK_COOLDOWN - now;
    const w = p.week;
    const vibeId = WL.voice.vibeOf(p), vibe = WL.voice.VIBES[vibeId];
    app.innerHTML = `
      <header><b>webling</b><span class="pill">${info.label}</span></header>
      <canvas class="stage" aria-label="${esc(p.name)}, click to poke"></canvas>
      <p class="said" id="said" aria-live="polite">“${esc(WL.voice.mantra(p))}” <small>today's mantra</small></p>
      <div class="name-row">
        <input type="text" id="name" value="${esc(p.name)}" maxlength="16" aria-label="Name">
        <span class="age">day ${M.ageDays(p, now)}</span>
      </div>
      <div class="vibe-row">
        <span class="tag">${esc(vibe.label)}</span><span class="blurb">${esc(vibe.blurb)}</span>
      </div>
      <div class="aura-row"><b>✦ ${(p.aura || 0).toLocaleString()} aura</b><span>${esc(M.auraTier(p))}</span></div>
      <div class="bar">
        <label>Growth <span>${prog.next ? `${p.xp - prog.cur.min} / ${prog.next.min - prog.cur.min} xp to ${prog.next.label.toLowerCase()}` : `${p.xp} xp, fully grown`}</span></label>
        <div class="track"><i style="width:${Math.round(prog.frac * 100)}%"></i></div>
      </div>
      <div class="bar">
        <label>Tummy <span>${{ full: 'Full', peckish: 'Peckish', hungry: 'Hungry! Find it a pop-up' }[mood]}</span></label>
        <div class="track food ${mood}"><i style="width:${Math.round(full)}%"></i></div>
      </div>
      <div class="stats">
        <div><b>${p.stats.cookies}</b><span>cookie banners eaten</span></div>
        <div><b>${p.stats.popups}</b><span>pop-ups eaten</span></div>
        <div><b>${state.sites}</b><span>sites explored</span></div>
        <div><b>${p.stats.boops}</b><span>weblings booped</span></div>
      </div>
      <div class="actions">
        <button id="snack" ${snackWait > 0 ? 'disabled' : ''}>${snackWait > 0 ? `Snack in ${fmtWait(snackWait)}` : 'Give a snack'}</button>
        <button id="share-btn" class="primary">Share card</button>
      </div>
      <div class="settings">
        <label class="check"><input type="checkbox" id="eat" ${state.settings.eat ? 'checked' : ''}><span>Eat cookie banners and pop-ups</span></label>
        ${host ? `<label class="check"><input type="checkbox" id="eat-here" ${state.settings.noEat.includes(host) ? '' : 'checked'} ${state.settings.eat ? '' : 'disabled'}>
          <span>…on ${esc(host)}</span></label>` : ''}
        <label class="check" ${WL.config.presenceUrl ? '' : 'hidden'}><input type="checkbox" id="presence" ${state.settings.presence ? 'checked' : ''}>
          <span>Meet other weblings<small>Shares a scrambled page ID, your pet's name and colour. Never the address.</small></span></label>
      </div>
      <p class="week">This week: ${n(w.cookies, 'cookie banner')}, ${n(w.popups, 'pop-up')}, ${n(w.sites, 'new site')}, ${n(w.boops, 'boop')}.</p>`;

    stage = new Stage($('.stage'), () => ({ stage: M.stage(state.pet), seed: state.pet.seed }), mood);
    stage.onPoke = () => speak(mood === 'hungry' && Math.random() < 0.5 ? 'hungry' : 'poke');

    $('#name').onchange = async (e) => (state = await send({ type: 'rename', name: e.target.value }));
    $('#snack').onclick = async () => {
      const r = await send({ type: 'snack' });
      state = r;
      render();
      if (r.ok) {
        stage.celebrate();
        speak('fed');
      }
    };
    $('#share-btn').onclick = openShare;
    $('#eat').onchange = async (e) => { state = await send({ type: 'settings', patch: { eat: e.target.checked } }); render(); };
    $('#presence').onchange = async (e) => (state = await send({ type: 'settings', patch: { presence: e.target.checked } }));
    const here = $('#eat-here');
    if (here) here.onchange = async (e) => (state = await send({ type: 'siteEat', host, on: e.target.checked }));
  }

  const n = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

  // Put a line from the pet's voice under the stage.
  function speak(event, vars = {}, text = null) {
    const said = $('#said');
    if (!said) return;
    said.textContent = text || WL.voice.line(event, WL.voice.vibeOf(state.pet), { name: state.pet.name, ...vars }) || '';
  }

  const fmtWait = (ms) => {
    const m = Math.ceil(ms / 60e3);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  };

  // ---- share card ----
  async function openShare() {
    const canvas = WL.card.render(state.pet, state.sites);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const url = URL.createObjectURL(blob);
    $('#card').src = url;
    $('#share').hidden = false;
    $('#download').onclick = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `webling-${(state.pet.name || 'pet').toLowerCase()}.png`;
      a.click();
    };
    $('#copy').onclick = async () => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        $('#copy').textContent = 'Copied!';
      } catch {
        $('#copy').textContent = "Couldn't copy";
      }
    };
    $('#post').onclick = () => {
      const text = `${WL.card.shareText(state.pet, state.sites)} ${WL.config.shareUrl}`;
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank');
    };
    $('#close').onclick = () => {
      $('#share').hidden = true;
      $('#copy').textContent = 'Copy image';
    };
  }

  // ---- the little room the pet walks around in ----
  class Stage {
    constructor(canvas, look, mood = 'full') {
      this.c = canvas;
      this.look = look;
      this.mood = mood;
      this.dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      this.w = canvas.clientWidth;
      this.h = canvas.clientHeight;
      canvas.width = this.w * this.dpr;
      canvas.height = this.h * this.dpr;
      this.g = canvas.getContext('2d');
      this.g.imageSmoothingEnabled = false;
      this.x = this.w / 2;
      this.y = 0;
      this.vy = 0;
      this.dir = 1;
      this.t = 0;
      this.mode = 'idle';
      this.modeT = 1;
      this.happyT = 0;
      this.crackT = -1;
      canvas.onclick = () => this.poke();
      this.raf = requestAnimationFrame((t) => this.frame(t, t));
    }

    stop() { cancelAnimationFrame(this.raf); }

    poke() {
      if (this.look().stage === 'egg') { this.wobble = 0.6; return; }
      if (this.y === 0) this.vy = -260;
      this.happyT = 1;
      this.onPoke?.();
    }

    celebrate() {
      this.happyT = 2;
      this.vy = -300;
    }

    crack() {
      this.crackT = 0;
      return new Promise((r) => setTimeout(r, 900));
    }

    frame(now, prev) {
      const dt = Math.min(0.05, (now - prev) / 1000);
      this.t += dt;
      const { stage, seed } = this.look();
      const g = this.g, d = this.dpr, scale = 5;
      g.clearRect(0, 0, this.c.width, this.c.height);
      const ground = this.h - 18;
      g.fillStyle = getComputedStyle(document.body).getPropertyValue('--line').trim();
      g.fillRect(0, ground * d, this.c.width, 2 * d);

      let clip = 'idle', angle = 0;
      if (stage === 'egg') {
        this.wobble = Math.max(0, (this.wobble || 0) - dt);
        angle = Math.sin(this.t * (this.crackT >= 0 ? 30 : 4)) * (this.crackT >= 0 ? 0.25 : 0.06 + this.wobble * 0.3);
        clip = this.crackT >= 0 ? 'crack' : 'whole';
        this.x = this.w / 2;
      } else {
        this.happyT = Math.max(0, this.happyT - dt);
        this.vy += 900 * dt;
        this.y = Math.min(0, this.y + this.vy * dt);
        if (this.y === 0) this.vy = 0;
        if ((this.modeT -= dt) <= 0) {
          this.mode = Math.random() < (this.mood === 'hungry' ? 0.6 : 0.4) ? 'idle' : 'walk';
          if (Math.random() < 0.4) this.dir *= -1;
          this.modeT = 1 + Math.random() * 2;
        }
        if (this.mode === 'walk' && this.y === 0) {
          this.x += this.dir * 28 * dt;
          if (this.x < 40 || this.x > this.w - 40) { this.dir *= -1; this.x = Math.max(40, Math.min(this.w - 40, this.x)); }
        }
        clip = this.y < 0 ? (this.happyT ? 'happy' : 'jump') : this.happyT ? 'happy' : this.mode === 'walk' ? 'walk' : (this.t % 4 < 0.15 ? 'blink' : 'idle');
      }
      const c = WL.art.CLIPS[clip] || { fps: 1, frames: [0] };
      const i = Math.floor(this.t * c.fps) % c.frames.length;
      const img = WL.art.bake(stage, clip, i, seed, scale * d, this.dir < 0);
      const bob = clip === 'idle' && Math.floor(this.t * 2) % 2 ? scale : 0;
      g.save();
      g.translate(this.x * d, (ground + this.y) * d);
      g.rotate(angle);
      g.drawImage(img, -img.width / 2, -img.height + bob * d);
      g.restore();
      this.raf = requestAnimationFrame((t) => this.frame(t, now));
    }
  }
})();
