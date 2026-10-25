// A webling on the page: yours, or a visitor's ghost. It walks along lines of text, jumps between
// them, falls to the bottom of the screen, and can be grabbed and thrown.
// Position (x, y) is the middle of its feet, in page coordinates, or in screen coordinates while
// `vp` is set (while it is busy with something fixed to the screen, like a cookie banner).
(() => {
  const WL = (globalThis.WL ||= {});
  const G = 1500; // gravity, px/s²
  const PX = 3; // CSS pixels per art pixel

  class Pet {
    constructor(look, { ghost = false } = {}) {
      this.look = look; // { name, seed, stage }
      this.ghost = ghost;
      this.x = this.y = this.vx = this.vy = 0;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.mode = 'fall';
      this.on = null;
      this.vp = false;
      this.clipT = 0;
      this.think = 0;
      this.away = 0;
      this.happyT = 0;
      this.blinkT = 2 + Math.random() * 3;
      this.mood = 'full';
      this.onPoke = null;
      this.hit = WL.overlay.el('div', 'hit');
      this.bubble = WL.overlay.el('div', ghost ? 'bubble ghost' : 'bubble');
      this.bindPointer();
      this.spawn();
    }

    get w() { return WL.art.size(this.look.stage)[0] * PX; }
    get h() { return WL.art.size(this.look.stage)[1] * PX; }
    get vibe() { return WL.voice.vibeOf(this.look); }
    get traits() { return WL.voice.VIBES[this.vibe]; }
    get speed() { return (this.look.stage === 'baby' ? 30 : 40) * (this.mood === 'hungry' ? 0.6 : 1) * this.traits.speed; }
    get grounded() { return ['walk', 'idle', 'sleep', 'pose'].includes(this.mode); }
    get busy() { return this.mode === 'tween' || this.mode === 'eat'; }

    // Drop in from the top of the screen.
    spawn() {
      this.vp = false;
      this.x = scrollX + innerWidth * (0.15 + Math.random() * 0.7);
      this.y = scrollY - 10;
      this.vx = (Math.random() - 0.5) * 80;
      this.vy = 0;
      this.mode = 'fall';
      this.on = null;
      this.away = 0;
    }

    update(dt) {
      this.happyT = Math.max(0, this.happyT - dt);
      if (this.mode === 'held') return this.animate(dt);
      if (this.mode === 'tween') this.tweenStep(dt);
      else if (this.mode !== 'eat') {
        this.keepInView(dt);
        if (this.mode === 'fall' || this.mode === 'jump') this.fly(dt);
        else this.walk(dt);
      }
      this.animate(dt);
    }

    keepInView(dt) {
      const sx = this.x - scrollX, sy = this.y - scrollY;
      const out = sy < -60 || sy - this.h > innerHeight + 60 || sx < -60 || sx > innerWidth + 60;
      if (out && (this.away += dt) > 0.6) this.spawn();
      else if (!out) this.away = 0;
    }

    fly(dt) {
      const y0 = this.y;
      this.vy += G * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const left = scrollX + this.w / 2, right = scrollX + innerWidth - this.w / 2;
      if (this.x < left) { this.x = left; this.vx = Math.abs(this.vx) * 0.4; }
      if (this.x > right) { this.x = right; this.vx = -Math.abs(this.vx) * 0.4; }
      if (this.vy > 0) {
        const p = WL.world.landing(this.x, y0, this.y);
        if (p) this.land(p);
      }
    }

    land(p) {
      const hard = this.vy > 1100;
      this.on = p;
      this.y = p === 'floor' ? WL.world.floor() : p.y;
      this.vx = this.vy = 0;
      this.mode = 'idle';
      this.think = 0.4 + Math.random();
      if (hard) this.strike('shock', 0.5);
      this.emit('land', { hard, floor: p === 'floor' });
    }

    walk(dt) {
      let p = this.on;
      if (p !== 'floor' && !WL.world.platforms.includes(p)) {
        p = this.on = WL.world.rematch(p, this.x);
        if (!p) return this.drop();
        this.y = p.y;
      }
      if (p === 'floor') this.y = WL.world.floor();
      if (this.mode === 'sleep') {
        if (performance.now() - WL.input.lastMove < 1500) {
          this.mode = 'idle';
          this.happy(1);
          this.emit('wake');
        } else if (Math.random() < dt * 0.5) WL.fx.zzz(this.sx + this.w * 0.3, this.sy - this.h);
        return;
      }
      if (this.mode === 'pose' && this.pose === 'dance' && (this.danceT = (this.danceT || 0) + dt) > 0.35) {
        this.danceT = 0;
        this.dir *= -1;
      }
      if ((this.think -= dt) <= 0) this.decide();
      if (this.mode !== 'walk') return;
      const x1 = p === 'floor' ? scrollX + this.w / 2 : p.x1 + 4;
      const x2 = p === 'floor' ? scrollX + innerWidth - this.w / 2 : p.x2 - 4;
      this.x += this.dir * this.speed * dt;
      if (this.x < x1 || this.x > x2) {
        this.x = Math.max(x1, Math.min(x2, this.x));
        const r = Math.random();
        if (p === 'floor' || r < 0.4) this.dir *= -1;
        else if (r < 0.8 ? !this.jumpSomewhere() : true) this.drop(this.dir * this.speed);
      }
    }

    decide() {
      if (!this.ghost && performance.now() - WL.input.lastMove > 45e3) {
        this.mode = 'sleep';
        this.emit('sleep');
        return;
      }
      // Now and then, strike a pose in character: side-eye, unimpressed, or a little dance.
      const idle = this.traits.idle;
      const p = Math.random() * 4;
      let acc = 0;
      for (const pose of ['sideeye', 'meh', 'dance']) {
        if (p < (acc += idle[pose])) {
          this.strike(pose, pose === 'dance' ? 2 + Math.random() * 1.5 : 1.5 + Math.random() * 1.5);
          return this.emit('pose', { pose });
        }
      }
      const r = Math.random();
      const rest = this.mood === 'hungry' ? 0.45 : 0.25;
      const jump = this.vibe === 'chaotic' ? 0.4 : 0.2;
      if (r < rest) {
        this.mode = 'idle';
        this.think = 1 + Math.random() * 2.5;
      } else if (r < rest + jump && this.jumpSomewhere()) {
        // in the air
      } else {
        this.mode = 'walk';
        if (Math.random() < 0.3) this.dir *= -1;
        this.think = 1.5 + Math.random() * 3;
      }
    }

    jumpSomewhere() {
      const options = WL.world.near(this.x, this.y, this.on);
      if (!options.length) return false;
      const p = options[Math.floor(Math.random() * options.length)];
      const tx = Math.max(p.x1 + 8, Math.min(p.x2 - 8, this.x + (Math.random() - 0.5) * 120));
      this.jumpTo(tx, p.y);
      return true;
    }

    jumpTo(tx, ty) {
      const t = Math.max(0.35, Math.min(0.75, Math.hypot(tx - this.x, ty - this.y) / 320));
      this.vx = (tx - this.x) / t;
      this.vy = (ty - this.y - 0.5 * G * t * t) / t;
      this.dir = Math.sign(this.vx) || this.dir;
      this.mode = 'jump';
      this.on = null;
    }

    drop(vx = 0) {
      this.mode = 'fall';
      this.on = null;
      this.vx = vx;
      this.vy = 0;
    }

    hop() {
      if (this.busy || this.mode === 'held') return;
      this.mode = 'jump';
      this.on = null;
      this.vy = -420;
      this.vx = 0;
      this.happy(1.2);
    }

    happy(s) { this.happyT = Math.max(this.happyT, s); }

    // Hold a pose (sideeye, meh, shock, dance) for a while, if standing somewhere.
    strike(pose, secs) {
      if (!this.grounded && this.mode !== 'jump' && this.mode !== 'fall') return;
      if (this.grounded) this.mode = 'pose';
      this.pose = pose;
      this.poseT = secs;
      this.think = secs;
    }

    // Tell the brain (personality) something happened. Ghosts keep their thoughts to themselves.
    emit(event, data) {
      if (!this.ghost) WL.brain?.emit(this, event, data);
    }

    // ---- moving to a point on screen (used by the eater) ----
    tweenTo(sx, sy, secs = 0.55) {
      if (!this.vp) { this.x -= scrollX; this.y -= scrollY; this.vp = true; }
      this.tw = { x0: this.x, y0: this.y, x1: sx, y1: sy, k: 0, secs };
      this.dir = sx >= this.x ? 1 : -1;
      this.mode = 'tween';
      this.hit.classList.add('off');
      return new Promise((res) => (this.tw.done = res));
    }

    tweenStep(dt) {
      const tw = this.tw;
      tw.k = Math.min(1, tw.k + dt / tw.secs);
      const e = tw.k * (2 - tw.k);
      this.x = tw.x0 + (tw.x1 - tw.x0) * e;
      this.y = tw.y0 + (tw.y1 - tw.y0) * e - Math.sin(Math.PI * tw.k) * 90;
      if (tw.k >= 1) { this.mode = 'eat'; tw.done(); }
    }

    // Back to page coordinates after a job on screen.
    release() {
      if (this.vp) { this.x += scrollX; this.y += scrollY; this.vp = false; }
      this.hit.classList.remove('off');
      this.mode = 'jump';
      this.on = null;
      this.vx = this.dir * 60;
      this.vy = -300;
      this.happy(1.6);
    }

    // ---- drawing ----
    get sx() { return this.vp ? this.x : this.x - scrollX; }
    get sy() { return this.vp ? this.y : this.y - scrollY; }

    animate(dt) {
      let clip;
      if (this.mode === 'eat') clip = 'eat';
      else if (this.mode === 'held') clip = 'held';
      else if (this.mode === 'tween' || this.mode === 'jump') clip = this.happyT > 0 ? 'happy' : 'jump';
      else if (this.mode === 'fall') clip = 'fall';
      else if (this.mode === 'sleep') clip = 'sleep';
      else if (this.mode === 'pose') clip = this.pose;
      else if (this.happyT > 0) clip = 'happy';
      else if (this.mode === 'walk') clip = 'walk';
      else {
        this.blinkT -= dt;
        if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 4;
        clip = this.blinkT < 0.15 ? 'blink' : 'idle';
      }
      if (clip !== this.clip) { this.clip = clip; this.clipT = 0; }
      this.clipT += dt;
    }

    draw(ctx, dpr) {
      const c = WL.art.CLIPS[this.clip] || WL.art.CLIPS.idle;
      const frame = Math.floor(this.clipT * c.fps) % c.frames.length;
      let img = WL.art.bake(this.look.stage, this.clip, frame, this.look.seed, PX * dpr, this.dir < 0), pad = 0;
      if (WL.config.halo) ({ img, pad } = WL.art.bakeHalo(this.look.stage, this.clip, frame, this.look.seed, PX * dpr, this.dir < 0));
      const bob = this.clip === 'idle' && Math.floor(this.clipT * 2) % 2 ? PX
        : this.clip === 'dance' && frame === 1 ? -PX * 2 : 0;
      const left = this.sx - this.w / 2, top = this.sy - this.h;
      ctx.globalAlpha = this.ghost ? 0.88 : 1;
      ctx.drawImage(img, Math.round(left * dpr) - pad, Math.round((top + bob) * dpr) - pad);
      ctx.globalAlpha = 1;
      this.hit.style.width = this.w + 'px';
      this.hit.style.height = this.h + 'px';
      this.hit.style.transform = `translate(${left}px, ${top}px)`;
      if (this.bubble.classList.contains('on')) {
        const half = this.bubble.offsetWidth / 2 + 4;
        const bx = Math.max(half, Math.min(innerWidth - half, this.sx));
        const by = Math.max(this.bubble.offsetHeight + 4, top - 6);
        this.bubble.style.transform = `translate(${bx}px, ${by}px) translate(-50%, -100%)`;
      }
    }

    say(text, ms = 2200) {
      this.bubble.textContent = text;
      this.bubble.classList.add('on');
      clearTimeout(this.sayTimer);
      this.sayTimer = setTimeout(() => this.bubble.classList.remove('on'), ms);
    }

    // Ghosts get booped; your own pet reacts in character (see brain.js).
    poke() {
      if (this.onPoke) {
        this.hop();
        WL.fx.heart(this.sx, this.sy - this.h);
        this.onPoke(this);
      } else {
        this.emit('poke');
      }
    }

    // ---- grab, throw and poke ----
    bindPointer() {
      let down = null, samples = [];
      // Forget a press in progress (the pet is about to be busy, so it mustn't become a drag).
      this.cancelPress = () => {
        if (!down) return;
        if (this.hit.hasPointerCapture(down.id)) this.hit.releasePointerCapture(down.id);
        down = null;
        this.hit.classList.remove('held');
      };
      this.hit.addEventListener('pointerenter', () => {
        if (this.ghost && !this.bubble.classList.contains('on')) this.say(this.look.name || 'a webling', 1200);
      });
      this.hit.addEventListener('pointerdown', (e) => {
        if (this.busy) return;
        e.preventDefault();
        e.stopPropagation();
        this.hit.setPointerCapture(e.pointerId);
        down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
        samples = [];
      });
      this.hit.addEventListener('pointermove', (e) => {
        if (!down || this.busy) return;
        if (this.mode !== 'held' && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
          this.mode = 'held';
          this.on = null;
          this.vp = false;
          this.hit.classList.add('held');
          this.emit('held');
        }
        if (this.mode !== 'held') return;
        this.x = e.clientX + scrollX;
        this.y = e.clientY + scrollY + this.h / 2;
        samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (samples.length > 5) samples.shift();
      });
      const up = (e) => {
        if (!down) return;
        down = null;
        if (this.mode === 'held') {
          this.hit.classList.remove('held');
          const a = samples[0], b = samples[samples.length - 1];
          const dt = a && b && b.t > a.t ? (b.t - a.t) / 1000 : 1;
          const clamp = (v) => Math.max(-1800, Math.min(1800, v));
          this.vx = a ? clamp((b.x - a.x) / dt) : 0;
          this.vy = a ? clamp((b.y - a.y) / dt) : 0;
          this.mode = 'fall';
          if (Math.hypot(this.vx, this.vy) > 900) this.emit('thrown');
        } else if (e.type === 'pointerup') {
          this.poke();
        }
      };
      this.hit.addEventListener('pointerup', up);
      this.hit.addEventListener('pointercancel', up);
    }

    destroy() {
      this.hit.remove();
      this.bubble.remove();
      clearTimeout(this.sayTimer);
    }
  }

  WL.Pet = Pet;
})();
