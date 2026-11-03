// Lanternfall — bosses: 10 unique encounters with phases, telegraphs and custom art
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const T = LF.T, R = LF.R, TAU = Math.PI * 2;

  class Boss {
    constructor(G, id) {
      this.id = id; this.def = LF.BOSSES[id]; this.hp = this.maxHp = this.def.hp;
      const rd = G.room; this.AL = 2 * T + 8; this.AR = (rd.W - 2) * T - 8; this.FY = rd.G0 * T; this.MID = (this.AL + this.AR) / 2;
      this.phase = 1; this.act = null; this.at = 0; this.fired = new Set(); this.last = null; this.face = -1;
      this.flash = 0; this.dead = false; this.dying = 0; this.active = false; this.t = 0; this.vx = 0; this.vy = 0; this.onGround = false;
      this.idleT = 1.2; this.minions = []; this.hidden = false; this.inv = 0; this.speed = 1; this.alpha = 1;
    }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    when(tm) { if (!this.fired.has(tm) && this.at >= tm) { this.fired.add(tm); return true; } return false; }
    start(a) { this.act = a; this.at = 0; this.fired.clear(); this.last = a; }
    pick(list) { const opts = list.filter(a => a !== this.last); return R.pick(opts.length ? opts : list); }
    hit(G, x, y, w, h, dmg = 1) { G.bossHits.push({ x, y, w, h, dmg }); }
    warn(G, x, y, w, h, dur, col = '#ff5a3a') { G.warnings.push({ x, y, w, h, t: dur, max: dur, col }); }
    shot(G, x, y, vx, vy, o = {}) { G.projectiles.push(new LF.Projectile(x, y, vx, vy, Object.assign({ owner: 'enemy', dmg: 1 }, o))); }
    toward(G) { return G.player.cx < this.cx ? -1 : 1; }
    ground(G, dt, grav = 2400) {
      this.vy = Math.min(this.vy + grav * dt, 1400);
      const r = LF.moveBody(G, this, this.vx * dt, this.vy * dt);
      if (r.hy > 0) { if (!this.onGround && this.vy > 400) this.onLand && this.onLand(G); this.onGround = true; this.vy = 0; } else if (r.hy === 0) this.onGround = false;
      if (r.hy < 0) this.vy = 0;
      this.x = LF.clamp(this.x, this.AL, this.AR - this.w);
      return r;
    }
    wave(G, x, dir, spd = 360, dmg = 1, col = '#ffd27a') { G.projectiles.push(new LF.Projectile(x, this.FY - 14, dir * spd, 0, { owner: 'enemy', dmg, kind: 'wave', r: 13, life: 3, col, ground: true })); }
    rocks(G, n, col = '#8a8070') { for (let i = 0; i < n; i++) { const x = R.range(this.AL + 30, this.AR - 30); this.warn(G, x - 14, this.FY - 300, 28, 300, 0.7, 'rgba(255,255,255,0.25)'); setTimeoutG(G, 0.7 + i * 0.12, () => this.shot(G, x, 3 * T, 0, 200, { grav: 1400, r: 12, kind: 'rock', col, life: 3 })); } }
    hurt(G, dmg, dirX, kind) {
      if (!this.active || this.dying || this.hidden || this.inv > 0) return false;
      if (this.block && this.block(G, dirX, kind)) return 'block';
      this.hp -= dmg; this.flash = 0.1;
      G.hitFx(this.cx + R.range(-20, 20), this.cy + R.range(-20, 20), dirX, '#fff');
      const pr = this.hp / this.maxHp;
      if (this.phases) for (let i = 0; i < this.phases.length; i++) if (this.phase === i + 1 && pr <= this.phases[i]) { this.phase = i + 2; this.onPhase && this.onPhase(G, this.phase); G.shake(8, 0.4); G.sfx('roar'); }
      if (this.hp <= 0) { this.hp = 0; this.dying = 0.001; this.act = null; G.bossDying(this); }
      return true;
    }
    boxes() { return this.hidden ? [] : [{ x: this.x, y: this.y, w: this.w, h: this.h }]; }
    contact() { return this.hidden || this.dying ? [] : [{ x: this.x + 8, y: this.y + 8, w: this.w - 16, h: this.h - 12 }]; }
    update(G, dt) {
      this.t += dt; this.flash -= dt; this.inv -= dt;
      for (const m of this.minions) m.update && m.update(G, dt);
      this.minions = this.minions.filter(m => !m.dead);
      if (this.dying) { this.dying += dt; this.vx *= 0.9; if (this.dyingUpdate) this.dyingUpdate(G, dt); if (Math.random() < 0.6) G.burst(this.cx + R.range(-this.w / 2, this.w / 2), this.cy + R.range(-this.h / 2, this.h / 2), 3, { col: '#fff', spd: 200, life: 0.6, size: 3, glow: true }); return; }
      if (!this.active) { this.idle && this.idle(G, dt); return; }
      this.at += dt * this.speed;
      if (!this.act) { this.idleT -= dt * this.speed; this.idle && this.idle(G, dt); if (this.idleT <= 0) { this.choose(G); } }
      else if (this.acts[this.act].call(this, G, dt, this.at)) { this.act = null; this.idleT = this.restT ? this.restT() : 0.7; }
    }
  }
  // tiny game-time timer helper (pauses with the game)
  function setTimeoutG(G, t, fn) { G.timers.push({ t, fn }); }
  LF.setTimeoutG = setTimeoutG;

  // ===================================================================== 1. Hollow Warden
  class Warden extends Boss {
    constructor(G) { super(G, 'warden'); this.w = 70; this.h = 96; this.x = this.MID + 200; this.y = this.FY - this.h; this.phases = [0.5]; }
    restT() { return this.phase === 1 ? 0.75 : 0.45; }
    choose(G) { this.face = this.toward(G); this.start(this.pick(this.phase === 1 ? ['charge', 'slam', 'leap', 'slam'] : ['charge', 'slam', 'leap', 'triple'])); }
    onPhase(G) { this.speed = 1.22; G.burst(this.cx, this.cy, 40, { col: '#8c96b0', spd: 300, life: 1, size: 5, grav: 700 }); }
    idle(G, dt) { this.vx = LF.approach(this.vx, 0, 2000 * dt); this.ground(G, dt); }
    onLand(G) { G.shake(8, 0.2); G.sfx('slam'); G.dust(this.cx, this.FY, 14); if (this.act === 'leap') { this.wave(G, this.cx - 40, -1, 340); this.wave(G, this.cx + 40, 1, 340); } }
  }
  Warden.prototype.acts = {
    charge(G, dt, t) {
      if (t < 0.6) { this.vx = 0; this.face = this.toward(G); this.pose = 'brace'; this.ground(G, dt); return false; }
      if (this.when(0.6)) { G.sfx('dash'); }
      this.pose = 'charge'; this.vx = this.face * 640;
      const r = this.ground(G, dt);
      this.hit(G, this.face > 0 ? this.x + this.w - 10 : this.x - 10, this.y + 20, 30, this.h - 20, 1);
      if (Math.random() < 0.5) G.dust(this.cx - this.face * 30, this.FY, 2);
      if (this.x <= this.AL + 1 || this.x + this.w >= this.AR - 1 || t > 2.4) {
        if (!this.fired.has('wall')) { this.fired.add('wall'); G.shake(10, 0.3); G.sfx('slam'); if (this.phase > 1) this.rocks(G, 4); this.vx = -this.face * 120; this.vy = -300; this.stunT = t; }
        this.pose = 'stun'; this.vx *= 0.9;
        return t - this.stunT > 0.7;
      }
      return false;
    },
    slam(G, dt, t) {
      if (t < 0.5) { this.face = this.toward(G); this.vx = this.face * 120; this.pose = 'walk'; }
      else if (t < 1.05) { this.vx = 0; this.pose = 'raise'; }
      else { this.pose = 'smash'; this.vx = 0; }
      if (this.when(1.05)) {
        G.shake(12, 0.3); G.sfx('slam'); G.dust(this.cx + this.face * 70, this.FY, 16);
        this.wave(G, this.cx + this.face * 80, this.face, 380); if (this.phase > 1) { this.wave(G, this.cx - this.face * 40, -this.face, 300); this.rocks(G, 3); }
      }
      if (t > 1.05 && t < 1.2) this.hit(G, this.face > 0 ? this.x + this.w : this.x - 110, this.FY - 70, 110, 70, 1);
      if (this.phase > 1 && this.when(1.45)) { G.shake(8, 0.2); this.wave(G, this.cx + this.face * 80, this.face, 460); }
      this.ground(G, dt);
      return t > 1.7;
    },
    leap(G, dt, t) {
      if (t < 0.35) { this.vx = 0; this.pose = 'crouch'; this.ground(G, dt); return false; }
      if (this.when(0.35)) { const tx = LF.clamp(G.player.cx, this.AL + 60, this.AR - 60); this.vy = -980; this.vx = (tx - this.cx) / 0.8; this.onGround = false; G.sfx('jump'); }
      this.pose = 'air';
      this.ground(G, dt, 2450);
      return t > 0.5 && this.onGround && t > 1.25;
    },
    triple(G, dt, t) {
      const k = Math.floor(t / 0.42);
      if (k < 3) {
        const lt = t - k * 0.42;
        if (lt < 0.2) { this.face = this.toward(G); this.vx = 0; this.pose = 'raise'; }
        else { this.pose = 'swing' + (k % 2); this.vx = this.face * 360; if (lt < 0.32) this.hit(G, this.face > 0 ? this.x + this.w - 10 : this.x - 90, this.y + 10, 100, this.h - 10, 1); }
        if (this.when(k * 0.42 + 0.2)) G.sfx('slash2');
      } else { this.vx = 0; this.pose = 'idle'; }
      this.ground(G, dt);
      return t > 1.6;
    },
  };
  Warden.prototype.draw = function (c, G) {
    const x = this.cx, y = this.y + this.h, f = this.face, t = this.t, p = this.pose || 'idle';
    c.save(); c.translate(x, y); c.scale(f, 1);
    const bob = p === 'walk' ? Math.sin(t * 10) * 3 : Math.sin(t * 2) * 1.5, crouch = p === 'crouch' || p === 'brace' ? 10 : 0;
    // legs
    c.fillStyle = '#1c1f2a';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 14, -30 + crouch); c.lineTo(s * 22 + (p === 'walk' ? Math.sin(t * 10 + s) * 8 : 0), 0); c.lineTo(s * 10, 0); c.closePath(); c.fill(); }
    // body (carapace)
    c.translate(0, -48 + bob + crouch);
    const g = c.createLinearGradient(0, -50, 0, 30); g.addColorStop(0, '#5e6a86'); g.addColorStop(1, '#262b3a');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 34, 40, 0, 0, TAU); c.fill();
    c.strokeStyle = '#11131a'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(180,195,230,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -38); c.lineTo(0, 36); c.stroke();
    // head (horned helm)
    c.fillStyle = '#2b3042'; c.beginPath(); c.ellipse(14, -44, 18, 16, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#c9d2ea'; c.beginPath(); c.moveTo(4, -56); c.quadraticCurveTo(-10, -86, 6, -96); c.quadraticCurveTo(0, -76, 14, -58); c.fill();
    const eye = this.phase > 1 ? '#ff7a5a' : '#ffd27a';
    c.fillStyle = eye; c.shadowColor = eye; c.shadowBlur = 12; c.beginPath(); c.ellipse(22, -44, 4, 3, 0, 0, TAU); c.fill(); c.shadowBlur = 0;
    // halberd
    c.save();
    const ang = p === 'raise' ? -2.2 : p === 'smash' ? 0.6 : p === 'swing0' ? 0.3 : p === 'swing1' ? -0.9 : p === 'charge' ? 1.3 : -0.4 + Math.sin(t * 2) * 0.05;
    c.translate(26, -4); c.rotate(ang);
    c.fillStyle = '#4a3a2a'; c.fillRect(-3, -10, 6, 110);
    c.fillStyle = '#b9c2d8'; c.beginPath(); c.moveTo(0, 96); c.quadraticCurveTo(34, 104, 30, 132); c.quadraticCurveTo(10, 116, -4, 112); c.closePath(); c.fill();
    c.strokeStyle = '#2a2f3d'; c.lineWidth = 2; c.stroke();
    c.restore();
    // shield (phase 1)
    if (this.phase === 1) {
      c.fillStyle = '#7c87a2'; c.strokeStyle = '#1a1d27'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(18, -24); c.quadraticCurveTo(48, -20, 46, 10); c.quadraticCurveTo(40, 36, 20, 44); c.quadraticCurveTo(10, 10, 18, -24); c.fill(); c.stroke();
      c.fillStyle = '#c9d2ea'; c.beginPath(); c.arc(32, 8, 5, 0, TAU); c.fill();
    }
    c.restore();
  };

  // ===================================================================== 2. Mother Bramble
  class Bramble extends Boss {
    constructor(G) { super(G, 'bramble'); this.w = 120; this.h = 170; this.x = this.MID - 60; this.y = this.FY - this.h; this.phases = [0.6, 0.3]; this.open = 0; }
    restT() { return [0, 0.9, 0.7, 0.45][this.phase]; }
    choose(G) { const l = ['thorns', 'seeds', 'whip']; if (this.phase >= 2 && this.minions.length < 2) l.push('sprout'); if (this.phase >= 3) l.push('spores', 'spores'); this.start(this.pick(l)); }
    onPhase(G, p) { if (p === 3) this.speed = 1.2; }
    idle(G, dt) { this.open = LF.lerp(this.open, this.phase >= 3 ? 1 : 0, dt * 2); }
    contact() { return this.dying ? [] : [{ x: this.cx - 34, y: this.y + 40, w: 68, h: this.h - 40 }]; }
  }
  Bramble.prototype.acts = {
    thorns(G, dt, t) {
      const n = this.phase >= 2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const t0 = i * 0.45;
        if (this.when(t0)) { this['tx' + i] = LF.clamp(G.player.cx, this.AL + 20, this.AR - 20); this.warn(G, this['tx' + i] - 22, this.FY - 8, 44, 8, 0.6, '#c4f582'); G.sfx('step'); }
        if (this.when(t0 + 0.6)) { G.sfx('break'); G.dust(this['tx' + i], this.FY, 6); }
        if (t > t0 + 0.6 && t < t0 + 1.0) { this.hit(G, this['tx' + i] - 20, this.FY - 130, 40, 130, 1); this.spikes = this.spikes || {}; this.spikes[i] = { x: this['tx' + i], k: Math.min(1, (t - t0 - 0.6) * 8) }; }
        else if (this.spikes && this.spikes[i] && t > t0 + 1.0) delete this.spikes[i];
      }
      return t > n * 0.45 + 1.1;
    },
    seeds(G, dt, t) {
      if (this.when(0.5)) { G.sfx('shot'); for (let i = 0; i < 6; i++) { const tx = G.player.cx + R.range(-220, 220), tt = R.range(0.9, 1.3); this.shot(G, this.cx, this.y + 30, (tx - this.cx) / tt, (this.FY - this.y - 30 - 0.5 * 900 * tt * tt) / tt, { grav: 900, r: 9, kind: 'seed', col: '#c4f582', life: 3 }); } }
      if (this.phase >= 2 && this.when(1.2)) { for (let i = 0; i < 4; i++) { const tt = R.range(0.8, 1.2), tx = R.range(this.AL, this.AR); this.shot(G, this.cx, this.y + 30, (tx - this.cx) / tt, (this.FY - this.y - 0.5 * 900 * tt * tt) / tt, { grav: 900, r: 9, kind: 'seed', col: '#c4f582', life: 3 }); } }
      return t > 1.6;
    },
    whip(G, dt, t) {
      if (this.when(0)) { this.wdir = this.toward(G); const x0 = this.wdir > 0 ? this.cx : this.AL, x1 = this.wdir > 0 ? this.AR : this.cx; this.warn(G, x0, this.FY - 50, x1 - x0, 50, 0.7, '#86ba5c'); }
      if (t > 0.7 && t < 1.05) { const k = (t - 0.7) / 0.35, x0 = this.wdir > 0 ? this.cx : this.cx - (this.cx - this.AL) * k, x1 = this.wdir > 0 ? this.cx + (this.AR - this.cx) * k : this.cx; this.hit(G, x0, this.FY - 46, x1 - x0, 46, 1); this.whipK = k; }
      else this.whipK = 0;
      if (this.when(0.7)) G.sfx('slash2');
      if (this.phase >= 2 && t > 1.05 && !this.fired.has('w2')) { this.fired.add('w2'); this.wdir *= -1; this.at = 0.35; this.fired.delete(0.7); const x0 = this.wdir > 0 ? this.cx : this.AL, x1 = this.wdir > 0 ? this.AR : this.cx; this.warn(G, x0, this.FY - 50, x1 - x0, 50, 0.35, '#86ba5c'); return false; }
      return t > 1.3;
    },
    sprout(G, dt, t) {
      if (this.when(0.4)) { for (const s of [-1, 1]) { const e = new LF.Enemy('thornling', this.cx + s * 110, this.FY, { summoned: true, noDrop: true }); G.enemies.push(e); G.burst(e.cx, e.cy, 12, { col: '#86ba5c', spd: 160, life: 0.5, size: 3 }); } G.sfx('break'); }
      return t > 1;
    },
    spores(G, dt, t) {
      for (let k = 0; k < 3; k++) if (this.when(0.3 + k * 0.5)) { const n = 10, o = k * 0.3; for (let i = 0; i < n; i++) { const a = o + i / n * TAU; this.shot(G, this.cx, this.y + 40, Math.cos(a) * 200, Math.sin(a) * 200, { r: 8, kind: 'spore', col: '#e6c8ff', life: 2.5 }); } G.sfx('boom'); }
      return t > 1.8;
    },
  };
  Bramble.prototype.draw = function (c, G) {
    const x = this.cx, y = this.FY, t = this.t;
    c.save(); c.translate(x, y);
    // roots
    c.strokeStyle = '#2b3a1e'; c.lineWidth = 10; c.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 8, -10); c.quadraticCurveTo(i * 30, -4, i * 50 + Math.sin(t + i) * 4, 2); c.stroke(); }
    // stem
    const sw = Math.sin(t * 1.2) * 6;
    const g = c.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#2a3d1c'); g.addColorStop(0.5, '#4f6e2e'); g.addColorStop(1, '#22311a');
    c.fillStyle = g; c.beginPath(); c.moveTo(-34, 0); c.quadraticCurveTo(-26 + sw, -80, -20 + sw, -120); c.lineTo(20 + sw, -120); c.quadraticCurveTo(26 + sw, -80, 34, 0); c.fill();
    // thorns on stem
    c.fillStyle = '#d6b25a';
    for (let i = 0; i < 6; i++) { const yy = -15 - i * 18, s = i % 2 ? 1 : -1; c.beginPath(); c.moveTo(s * 26 + sw * (i / 6), yy); c.lineTo(s * 44 + sw * (i / 6), yy - 6); c.lineTo(s * 24 + sw * (i / 6), yy - 10); c.fill(); }
    // leaves
    c.fillStyle = '#3f5b37';
    for (const s of [-1, 1]) { c.save(); c.translate(s * 20 + sw, -70); c.rotate(s * (0.9 + Math.sin(t * 1.5 + s) * 0.1)); c.beginPath(); c.ellipse(0, -30, 18, 40, 0, 0, TAU); c.fill(); c.restore(); }
    // bulb
    c.translate(sw, -150);
    const o = this.open;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + t * 0.2;
      c.save(); c.rotate(a); c.fillStyle = i % 2 ? '#6a2a3a' : '#7d3346';
      c.beginPath(); c.ellipse(0, -18 - o * 18, 20, 34 + o * 8, 0, 0, TAU); c.fill(); c.restore();
    }
    const core = this.phase >= 3 ? '#ffd0f0' : '#e6c8ff';
    c.fillStyle = core; c.shadowColor = core; c.shadowBlur = 20 + o * 20; c.beginPath(); c.arc(0, 0, 14 + o * 10 + Math.sin(t * 5) * 2, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.restore();
    // erupting thorns & whip
    if (this.spikes) for (const k in this.spikes) { const s = this.spikes[k]; c.fillStyle = '#d6b25a'; c.strokeStyle = '#3a2a10'; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x - 20, this.FY); c.lineTo(s.x - 4, this.FY - 130 * s.k); c.lineTo(s.x + 6, this.FY - 90 * s.k); c.lineTo(s.x + 20, this.FY); c.fill(); c.stroke(); }
    if (this.whipK > 0) {
      const d = this.wdir, ex = d > 0 ? this.cx + (this.AR - this.cx) * this.whipK : this.cx - (this.cx - this.AL) * this.whipK;
      c.strokeStyle = '#4f6e2e'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(this.cx, this.FY - 30); c.quadraticCurveTo((this.cx + ex) / 2, this.FY - 50, ex, this.FY - 22); c.stroke();
      c.strokeStyle = '#d6b25a'; c.lineWidth = 3; c.setLineDash([6, 10]); c.stroke(); c.setLineDash([]);
    }
  };

  // ===================================================================== 3. Stone Archivist
  class Archivist extends Boss {
    constructor(G) { super(G, 'archivist'); this.w = 64; this.h = 96; this.x = this.MID + 150; this.y = this.FY - 260; this.phases = [0.5]; this.tx = this.x; this.ty = this.y; }
    restT() { return this.phase === 1 ? 0.8 : 0.5; }
    choose(G) { const l = ['pages', 'tome', 'runes', 'blink']; if (this.phase > 1 && this.minions.length === 0) l.push('split'); this.start(this.pick(l)); }
    onPhase(G) { this.speed = 1.15; this.start('split'); }
    idle(G, dt) { this.x = LF.lerp(this.x, this.tx, dt * 2); this.y = LF.lerp(this.y, this.ty + Math.sin(this.t * 2) * 10, dt * 2); this.face = this.toward(G); }
    boxes() { const b = super.boxes(); return b; }
  }
  Archivist.prototype.acts = {
    blink(G, dt, t) {
      this.alpha = t < 0.3 ? 1 - t / 0.3 : t < 0.6 ? 0 : Math.min(1, (t - 0.6) / 0.3);
      this.hidden = t > 0.2 && t < 0.7;
      if (this.when(0.3)) { this.tx = this.x = R.range(this.AL + 40, this.AR - 100); this.ty = this.y = this.FY - R.range(170, 300); G.sfx('zap'); }
      return t > 0.9;
    },
    pages(G, dt, t) {
      this.idle(G, dt);
      const n = this.phase > 1 ? 8 : 6;
      for (let i = 0; i < n; i++) if (this.when(0.3 + i * 0.12)) { const a = -Math.PI / 2 + (i - n / 2) * 0.4; this.shot(G, this.cx, this.cy, Math.cos(a) * 200, Math.sin(a) * 200, { r: 8, kind: 'page', homing: 1.4, col: '#f4ead0', life: 3.5 }); G.sfx('slash'); }
      return t > 1.8;
    },
    tome(G, dt, t) {
      this.idle(G, dt);
      const n = this.phase > 1 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        if (this.when(i * 0.7)) { this['tx' + i] = LF.clamp(G.player.cx, this.AL + 50, this.AR - 50); this.warn(G, this['tx' + i] - 45, this.FY - 340, 90, 340, 0.8, 'rgba(220,200,150,0.25)'); }
        if (this.when(i * 0.7 + 0.8)) this.shot(G, this['tx' + i], 3 * T + 10, 0, 300, { grav: 1800, r: 40, kind: 'tome', col: '#7a6a52', life: 2, dmg: 1, noWall: false });
      }
      return t > n * 0.7 + 1.4;
    },
    runes(G, dt, t) {
      this.idle(G, dt);
      if (this.when(0.1)) { this.rx = []; const n = this.phase > 1 ? 5 : 3; for (let i = 0; i < n; i++) { const x = i === 0 ? G.player.cx : R.range(this.AL + 40, this.AR - 40); this.rx.push(x); this.warn(G, x - 40, this.FY - 10, 80, 10, 0.9, '#74e4d4'); } G.sfx('zap'); }
      if (t > 1.0 && t < 1.35) { for (const x of this.rx) this.hit(G, x - 34, this.FY - 220, 68, 220, 1); this.pillar = (t - 1.0) / 0.35; } else this.pillar = 0;
      if (this.when(1.0)) { G.sfx('boom'); G.shake(6, 0.2); }
      return t > 1.6;
    },
    split(G, dt, t) {
      if (this.when(0.3)) {
        const clone = { x: this.AL + 80, y: this.FY - 240, w: 64, h: 96, hp: 1, t: 0, cool: 1.5, dead: false, clone: true, boss: this,
          get cx() { return this.x + 32; }, get cy() { return this.y + 48; },
          update(G, dt) { this.t += dt; this.cool -= dt; this.y += Math.sin(this.t * 2) * 0.5; if (this.cool <= 0) { this.cool = 2.4; for (let i = 0; i < 3; i++) { const a = Math.atan2(G.player.cy - this.cy, G.player.cx - this.cx) + (i - 1) * 0.3; G.projectiles.push(new LF.Projectile(this.cx, this.cy, Math.cos(a) * 190, Math.sin(a) * 190, { owner: 'enemy', r: 7, kind: 'page', col: '#cfc6b0', life: 3 })); } } },
          hurt(G) { this.dead = true; G.sfx('break'); G.burst(this.cx, this.cy, 30, { col: '#7a6a52', spd: 260, life: 0.8, size: 4, grav: 600 }); return true; } };
        clone.x = this.x < this.MID ? this.AR - 140 : this.AL + 80;
        this.minions.push(clone); G.sfx('zap');
      }
      return t > 0.8;
    },
  };
  Archivist.prototype.draw = function (c, G) {
    const drawOne = (x, y, t, alpha, clone) => {
      c.save(); c.globalAlpha = alpha * (clone ? 0.65 : 1); c.translate(x, y);
      // robe of stone
      const g = c.createLinearGradient(0, -48, 0, 48); g.addColorStop(0, '#8a7a60'); g.addColorStop(1, '#3a3127');
      c.fillStyle = g; c.beginPath(); c.moveTo(-26, -20); c.quadraticCurveTo(-36, 30, -20 + Math.sin(t * 3) * 4, 52); c.lineTo(20 + Math.sin(t * 3 + 1) * 4, 52); c.quadraticCurveTo(36, 30, 26, -20); c.closePath(); c.fill();
      c.strokeStyle = '#211b14'; c.lineWidth = 3; c.stroke();
      // cracks
      c.strokeStyle = 'rgba(116,228,212,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-10, -10); c.lineTo(-4, 8); c.lineTo(-12, 26); c.moveTo(12, 0); c.lineTo(6, 20); c.stroke();
      // head: hooded with single eye
      c.fillStyle = '#5a4c3a'; c.beginPath(); c.arc(0, -32, 22, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#16110c'; c.beginPath(); c.ellipse(0, -28, 14, 12, 0, 0, TAU); c.fill();
      c.fillStyle = '#74e4d4'; c.shadowColor = '#74e4d4'; c.shadowBlur = 14; c.beginPath(); c.arc(0, -28, 4 + Math.sin(t * 4), 0, TAU); c.fill(); c.shadowBlur = 0;
      // floating books
      for (let i = 0; i < 3; i++) { const a = t * 1.2 + i * TAU / 3, bx = Math.cos(a) * 46, by = Math.sin(a) * 16 - 4; c.fillStyle = ['#7a3a2a', '#2a4a6a', '#5a5a2a'][i]; c.fillRect(bx - 9, by - 6, 18, 12); c.fillStyle = '#f4ead0'; c.fillRect(bx - 7, by - 4, 14, 2); }
      c.restore();
    };
    drawOne(this.cx, this.cy, this.t, this.alpha, false);
    for (const m of this.minions) if (m.clone) drawOne(m.cx, m.cy, m.t, 1, true);
    if (this.pillar > 0 && this.rx) for (const x of this.rx) { const a = 1 - this.pillar; c.fillStyle = `rgba(116,228,212,${0.6 * a + 0.2})`; c.fillRect(x - 30, this.FY - 220, 60, 220); c.fillStyle = `rgba(255,255,255,${0.6 * a})`; c.fillRect(x - 10, this.FY - 220, 20, 220); }
  };
  Archivist.prototype.boxes = function () { const b = this.hidden ? [] : [{ x: this.x, y: this.y, w: this.w, h: this.h }]; return b; };

  // ===================================================================== 4. Glasswyrm
  class Wyrm extends Boss {
    constructor(G) {
      super(G, 'wyrm'); this.w = 60; this.h = 60; this.x = this.MID; this.y = this.FY + 200; this.phases = [0.5]; this.hidden = true;
      this.trail = []; this.nseg = 14; for (let i = 0; i < 200; i++) this.trail.push({ x: this.cx, y: this.cy });
    }
    restT() { return this.phase === 1 ? 0.6 : 0.35; }
    choose(G) { const l = ['arc', 'arc', 'wall', 'shards']; if (this.phase > 1) l.push('beam'); this.start(this.pick(l)); }
    onPhase(G) { this.speed = 1.2; }
    segs() { const out = []; for (let i = 1; i <= this.nseg; i++) { const p = this.trail[Math.min(this.trail.length - 1, i * 5)]; out.push(p); } return out; }
    boxes() { const b = []; if (this.cy < this.FY + 20) b.push({ x: this.x, y: this.y, w: this.w, h: this.h }); for (const s of this.segs()) if (s.y < this.FY + 10) b.push({ x: s.x - 20, y: s.y - 20, w: 40, h: 40 }); return b; }
    contact() { return this.dying ? [] : this.boxes(); }
    update(G, dt) { super.update(G, dt); this.trail.unshift({ x: this.cx, y: this.cy }); if (this.trail.length > 200) this.trail.pop(); this.hidden = this.cy > this.FY + 30 && this.segs().every(s => s.y > this.FY + 20); }
    path(G, dt, x0, y0, x1, y1, h, dur, t) { const k = LF.clamp(t / dur, 0, 1); this.x = LF.lerp(x0, x1, k) - this.w / 2; this.y = LF.lerp(y0, y1, k) - h * Math.sin(k * Math.PI) - this.h / 2; this.dirA = Math.atan2(y1 - y0 - h * Math.PI * Math.cos(k * Math.PI), x1 - x0); }
  }
  Wyrm.prototype.acts = {
    arc(G, dt, t) {
      if (this.when(0)) { this.s = G.player.cx < this.MID ? 1 : -1; this.x0 = this.s > 0 ? this.AL + 60 : this.AR - 60; this.x1 = this.MID + this.s * R.range(100, 300); this.warn(G, this.x0 - 40, this.FY - 10, 80, 10, 0.7, '#83f2ff'); G.sfx('break'); G.shake(4, 0.5); this.x = this.x0 - 30; this.y = this.FY + 120; }
      if (t < 0.7) { if (Math.random() < 0.5) G.particle(this.x0 + R.range(-30, 30), this.FY, { vx: R.range(-60, 60), vy: -R.range(100, 300), life: 0.6, col: '#b9a2ff', size: 3, grav: 900 }); return false; }
      const dur = this.phase > 1 ? 1.4 : 1.7;
      this.path(G, dt, this.x0, this.FY + 120, this.x1 + this.s * 260, this.FY + 160, 520, dur, t - 0.7);
      if (this.when(0.75)) { G.sfx('roar'); G.dust(this.x0, this.FY, 14); }
      if (this.phase > 1 && this.when(1.2)) this.rocks(G, 3, '#b9a2ff');
      return t > 0.7 + dur + 0.5;
    },
    wall(G, dt, t) {
      if (this.when(0)) { this.s = R() < 0.5 ? 1 : -1; this.wy = LF.clamp(G.player.cy, this.FY - 200, this.FY - 40); this.warn(G, this.AL, this.wy - 32, this.AR - this.AL, 64, 0.8, 'rgba(131,242,255,0.5)'); G.sfx('break'); }
      if (t < 0.8) { this.x = (this.s > 0 ? this.AL - 300 : this.AR + 300); this.y = this.FY + 200; return false; }
      const k = (t - 0.8) / 1.1; const xs = this.s > 0 ? this.AL - 100 : this.AR + 100, xe = this.s > 0 ? this.AR + 500 : this.AL - 500;
      this.x = LF.lerp(xs, xe, k) - this.w / 2; this.y = this.wy - this.h / 2; this.dirA = this.s > 0 ? 0 : Math.PI;
      if (this.when(0.85)) { G.sfx('roar'); G.shake(6, 0.3); }
      return t > 2.2;
    },
    shards(G, dt, t) {
      if (this.when(0)) { this.sx = LF.clamp(G.player.cx + R.range(-120, 120), this.AL + 80, this.AR - 80); this.warn(G, this.sx - 40, this.FY - 10, 80, 10, 0.6, '#83f2ff'); }
      const rise = LF.clamp((t - 0.6) / 0.3, 0, 1) - LF.clamp((t - 2.0) / 0.3, 0, 1);
      this.x = this.sx - this.w / 2; this.y = this.FY + 60 - rise * 160; this.dirA = -Math.PI / 2;
      for (let k = 0; k < 3; k++) if (this.when(0.95 + k * 0.35)) { G.sfx('shot'); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.28 + R.range(-0.05, 0.05); this.shot(G, this.cx, this.y, Math.cos(a) * 520, Math.sin(a) * 620, { grav: 900, r: 8, kind: 'shard', col: '#83f2ff', life: 3 }); } }
      return t > 2.4;
    },
    beam(G, dt, t) {
      if (this.when(0)) { this.sx = R() < 0.5 ? this.AL + 120 : this.AR - 120; }
      const rise = LF.clamp((t - 0.3) / 0.3, 0, 1) - LF.clamp((t - 3.0) / 0.3, 0, 1);
      this.x = this.sx - this.w / 2; this.y = this.FY + 60 - rise * 220;
      const a0 = this.sx < this.MID ? -0.2 : Math.PI + 0.2, a1 = this.sx < this.MID ? -1.3 : Math.PI + 1.3;
      if (t > 0.6 && t < 1.4) { this.beamA = a0; this.beamCharge = (t - 0.6) / 0.8; this.beamOn = false; }
      else if (t >= 1.4 && t < 2.8) { const k = (t - 1.4) / 1.4; this.beamA = LF.lerp(a0, a1, k); this.beamOn = true; this.beamCharge = 1;
        const L = 1400; for (let s = 40; s < L; s += 40) { const bx = this.cx + Math.cos(this.beamA) * s, by = this.y + 10 + Math.sin(this.beamA) * s; this.hit(G, bx - 14, by - 14, 28, 28, 1); }
        if (Math.random() < 0.5) G.shake(2, 0.05);
      } else { this.beamOn = false; this.beamCharge = 0; }
      this.dirA = this.beamA || -Math.PI / 2;
      if (this.when(1.4)) G.sfx('zap');
      return t > 3.3;
    },
  };
  Wyrm.prototype.draw = function (c, G) {
    const segs = this.segs();
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i], r = 26 - i * 1.1;
      c.save(); c.translate(s.x, s.y);
      c.fillStyle = i % 2 ? '#4c4080' : '#5d50a0'; c.strokeStyle = '#1a1430'; c.lineWidth = 3;
      c.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + i; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(131,242,255,0.7)'; c.beginPath(); c.moveTo(-4, -r); c.lineTo(0, -r - 14 + i * 0.5); c.lineTo(4, -r); c.fill();
      c.restore();
    }
    c.save(); c.translate(this.cx, this.cy); c.rotate(this.dirA || 0);
    c.fillStyle = '#6d5fc0'; c.strokeStyle = '#1a1430'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(44, 0); c.lineTo(10, -30); c.lineTo(-24, -24); c.lineTo(-30, 0); c.lineTo(-24, 24); c.lineTo(10, 30); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#b9a2ff'; c.beginPath(); c.moveTo(-10, -24); c.lineTo(-30, -52); c.lineTo(0, -28); c.fill(); c.beginPath(); c.moveTo(-10, 24); c.lineTo(-30, 52); c.lineTo(0, 28); c.fill();
    const eyc = this.phase > 1 ? '#ff9ef0' : '#83f2ff'; c.fillStyle = eyc; c.shadowColor = eyc; c.shadowBlur = 16; c.beginPath(); c.arc(16, -10, 5, 0, TAU); c.arc(16, 10, 5, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.restore();
    if (this.beamCharge > 0) {
      const bx = this.cx, by = this.y + 10, a = this.beamA;
      c.save(); c.globalCompositeOperation = 'lighter';
      if (this.beamOn) { c.strokeStyle = 'rgba(131,242,255,0.5)'; c.lineWidth = 34; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * 1500, by + Math.sin(a) * 1500); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 10; c.stroke(); }
      else { c.strokeStyle = `rgba(131,242,255,${0.2 + this.beamCharge * 0.3})`; c.lineWidth = 2; c.setLineDash([10, 10]); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * 1500, by + Math.sin(a) * 1500); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, 8 * this.beamCharge, 0, TAU); c.fill(); }
      c.restore();
    }
  };

  // ===================================================================== 5. Bellwright
  class Bellwright extends Boss {
    constructor(G) { super(G, 'bellwright'); this.w = 110; this.h = 140; this.x = this.MID + 150; this.y = this.FY - this.h; this.phases = [0.5]; this.ring = 0; }
    restT() { return this.phase === 1 ? 0.8 : 0.5; }
    choose(G) { const l = ['toll', 'hammer', 'hop']; if (this.phase > 1) { l.push('pulse'); if (this.minions.length === 0 && G.enemies.filter(e => e.summoned).length < 2) l.push('drones'); } this.start(this.pick(l)); }
    onPhase(G) { this.speed = 1.2; G.sfx('bell', 0.7); }
    idle(G, dt) { this.vx = LF.approach(this.vx, 0, 1500 * dt); this.face = this.toward(G); this.ground(G, dt); this.ring = Math.max(0, this.ring - dt); }
    onLand(G) { G.shake(10, 0.25); G.sfx('slam'); G.dust(this.cx, this.FY, 16); if (this.act === 'hop') { this.wave(G, this.cx - 50, -1, 330, 1, '#ffd27a'); this.wave(G, this.cx + 50, 1, 330, 1, '#ffd27a'); } }
  }
  Bellwright.prototype.acts = {
    toll(G, dt, t) {
      this.vx = 0; this.ground(G, dt);
      const n = this.phase > 1 ? 3 : 2;
      for (let i = 0; i < n; i++) if (this.when(0.5 + i * 0.75)) { this.ring = 0.4; G.sfx('bell', 1 + i * 0.12); G.shake(5, 0.2); this.wave(G, this.cx - 60, -1, 300 + i * 40, 1, '#ffd27a'); this.wave(G, this.cx + 60, 1, 300 + i * 40, 1, '#ffd27a'); }
      return t > 0.6 + n * 0.75;
    },
    hammer(G, dt, t) {
      if (t < 0.8) { this.face = this.toward(G); this.vx = this.face * 170; this.pose = 'walk'; }
      else if (t < 1.25) { this.vx = 0; this.pose = 'raise'; }
      else { this.vx = 0; this.pose = 'smash'; }
      if (this.when(1.25)) { G.shake(12, 0.3); G.sfx('slam'); G.dust(this.cx + this.face * 90, this.FY, 16); for (let i = 0; i < 4; i++) this.shot(G, this.cx + this.face * 90, this.FY - 10, this.face * R.range(100, 350), -R.range(300, 600), { grav: 1300, r: 7, kind: 'rock', col: '#aab9da', life: 2 }); }
      if (t > 1.25 && t < 1.4) this.hit(G, this.face > 0 ? this.x + this.w - 20 : this.x - 120, this.FY - 90, 140, 90, 1);
      this.ground(G, dt);
      return t > 1.8;
    },
    hop(G, dt, t) {
      const n = this.phase > 1 ? 2 : 1;
      const k = Math.floor(t / 1.2); if (k >= n) { this.vx = 0; this.ground(G, dt); return t > n * 1.2 + 0.3; }
      const lt = t - k * 1.2;
      if (lt < 0.3) { this.vx = 0; this.pose = 'crouch'; }
      if (this.when(k * 1.2 + 0.3)) { const tx = LF.clamp(G.player.cx, this.AL + 60, this.AR - 60); this.vy = -1050; this.vx = (tx - this.cx) / 0.86; this.onGround = false; G.sfx('jump'); }
      this.ground(G, dt, 2450);
      if (this.onGround && lt > 0.5) this.vx = 0;
      return false;
    },
    drones(G, dt, t) {
      this.vx = 0; this.ground(G, dt);
      if (this.when(0.4)) { for (const s of [-1, 1]) { const e = new LF.Enemy('belldrone', this.cx + s * 80, this.y - 30, { summoned: true, noDrop: true }); G.enemies.push(e); } G.sfx('bell', 2); }
      return t > 1;
    },
    pulse(G, dt, t) {
      this.vx = 0; this.ground(G, dt);
      for (let k = 0; k < 3; k++) if (this.when(0.4 + k * 0.45)) { this.ring = 0.3; G.sfx('bell', 1.5); const n = 10; for (let i = 0; i < n; i++) { const a = i / n * TAU + k * 0.3; this.shot(G, this.cx, this.y + 40, Math.cos(a) * 240, Math.sin(a) * 240, { r: 7, kind: 'note', col: '#ffd27a', life: 3 }); } }
      return t > 1.8;
    },
  };
  Bellwright.prototype.draw = function (c, G) {
    const x = this.cx, y = this.y + this.h, f = this.face, t = this.t, p = this.pose || 'idle';
    c.save(); c.translate(x, y);
    const walk = p === 'walk' ? Math.sin(t * 8) : 0, crouch = p === 'crouch' ? 12 : 0;
    // legs (clockwork)
    c.strokeStyle = '#3e4864'; c.lineWidth = 8; c.lineCap = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 30, -40 + crouch); c.lineTo(s * 44 + walk * s * 10, -18); c.lineTo(s * 34 + walk * s * 14, 0); c.stroke(); }
    c.translate(0, -60 + crouch);
    // bell body
    const shake = this.ring > 0 ? Math.sin(t * 90) * 4 * this.ring : 0;
    c.rotate(shake * 0.02);
    const g = c.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, '#5a4520'); g.addColorStop(0.4, '#d8b060'); g.addColorStop(0.6, '#f4d48a'); g.addColorStop(1, '#5a4520');
    c.fillStyle = g; c.strokeStyle = '#2a1e0c'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-58, 10); c.quadraticCurveTo(-50, -20, -40, -50); c.quadraticCurveTo(-30, -84, 0, -86); c.quadraticCurveTo(30, -84, 40, -50); c.quadraticCurveTo(50, -20, 58, 10); c.quadraticCurveTo(0, 22, -58, 10); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(42,30,12,0.6)'; c.beginPath(); c.moveTo(-50, -10); c.quadraticCurveTo(0, 0, 50, -10); c.stroke();
    if (this.phase > 1) { c.strokeStyle = '#1a1208'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, -80); c.lineTo(0, -50); c.lineTo(14, -30); c.lineTo(4, 0); c.stroke(); }
    // face plate & eyes
    c.fillStyle = '#2a1e0c'; c.beginPath(); c.ellipse(f * 6, -40, 22, 14, 0, 0, TAU); c.fill();
    const ec = this.phase > 1 ? '#ff8c4c' : '#ffd27a'; c.fillStyle = ec; c.shadowColor = ec; c.shadowBlur = 12;
    c.beginPath(); c.arc(f * 6 - 8, -40, 4, 0, TAU); c.arc(f * 6 + 8, -40, 4, 0, TAU); c.fill(); c.shadowBlur = 0;
    // top handle + gears
    c.strokeStyle = '#8a7040'; c.lineWidth = 6; c.beginPath(); c.arc(0, -92, 12, Math.PI, 0); c.stroke();
    c.save(); c.translate(-38, -60); c.rotate(t * 2); c.strokeStyle = '#8a7040'; c.lineWidth = 3; for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.beginPath(); c.moveTo(6, 0); c.lineTo(12, 0); c.stroke(); } c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.stroke(); c.restore();
    // clapper
    c.fillStyle = '#3a2a10'; c.beginPath(); c.arc(shake * 3, 16, 12, 0, TAU); c.fill();
    // hammer arm
    c.save(); c.translate(f * 50, -30); c.scale(f, 1);
    const ang = p === 'raise' ? -2.4 : p === 'smash' ? 0.9 : 0.2 + Math.sin(t * 2) * 0.1;
    c.rotate(ang); c.fillStyle = '#4a3a2a'; c.fillRect(-4, 0, 8, 80); c.fillStyle = '#8a8fa8'; c.strokeStyle = '#1a1d27'; c.fillRect(-22, 74, 44, 30); c.strokeRect(-22, 74, 44, 30);
    c.restore();
    c.restore();
  };

  // ===================================================================== 6. Eelmother
  class Eelmother extends Boss {
    constructor(G) {
      super(G, 'eelmother'); this.w = 70; this.h = 70; this.x = this.MID; this.y = this.FY + 200; this.phases = [0.5]; this.hidden = true;
      this.trail = []; for (let i = 0; i < 160; i++) this.trail.push({ x: this.cx, y: this.cy });
    }
    restT() { return this.phase === 1 ? 0.7 : 0.4; }
    choose(G) { const l = ['lunge', 'jets', 'tail', 'lunge']; if (this.phase > 1 && G.enemies.filter(e => e.summoned).length < 3) l.push('brood'); this.start(this.pick(l)); }
    onPhase(G) { this.speed = 1.2; }
    segs() { const o = []; for (let i = 1; i <= 12; i++) o.push(this.trail[Math.min(this.trail.length - 1, i * 6)]); return o; }
    boxes() { const vis = this.cy < this.FY + 10 && this.cx > this.AL - 40 && this.cx < this.AR + 40; return vis ? [{ x: this.x, y: this.y, w: this.w, h: this.h }] : []; }
    contact() { if (this.dying) return []; const b = this.boxes(); for (const s of this.segs()) if (s.y < this.FY + 6 && s.x > this.AL - 20 && s.x < this.AR + 20) b.push({ x: s.x - 18, y: s.y - 18, w: 36, h: 36 }); return b; }
    update(G, dt) { super.update(G, dt); this.trail.unshift({ x: this.cx, y: this.cy }); if (this.trail.length > 160) this.trail.pop(); this.hidden = this.boxes().length === 0; }
  }
  Eelmother.prototype.acts = {
    lunge(G, dt, t) {
      const n = this.phase > 1 ? 2 : 1;
      const k = Math.floor(t / 1.6); if (k >= n) return true;
      const lt = t - k * 1.6;
      if (this.when(k * 1.6)) { this.s = R() < 0.5 ? 1 : -1; this.ly = LF.clamp(G.player.cy + R.range(-30, 30), this.FY - 170, this.FY - 30); this.warn(G, this.s > 0 ? this.AL : this.AR - 60, this.ly - 35, 60, 70, 0.6, 'rgba(165,255,255,0.5)'); G.sfx('splash'); }
      if (lt < 0.6) { this.x = (this.s > 0 ? this.AL - 400 : this.AR + 400); this.y = this.ly - 35; return false; }
      const kk = (lt - 0.6) / 0.9, xs = this.s > 0 ? this.AL - 200 : this.AR + 200, xe = this.s > 0 ? this.AR + 600 : this.AL - 600;
      this.x = LF.lerp(xs, xe, kk) - this.w / 2; this.y = this.ly - this.h / 2 + Math.sin(kk * 12) * 10; this.dirA = this.s > 0 ? 0 : Math.PI;
      if (this.when(k * 1.6 + 0.62)) G.sfx('roar');
      return false;
    },
    jets(G, dt, t) {
      const rise = LF.clamp((t - 0.5) / 0.3, 0, 1) - LF.clamp((t - 2.3) / 0.3, 0, 1);
      if (this.when(0)) { this.sx = LF.clamp(G.player.cx + R.range(-200, 200), this.AL + 100, this.AR - 100); this.warn(G, this.sx - 40, this.FY - 10, 80, 10, 0.5, '#a5ffff'); }
      this.x = this.sx - this.w / 2; this.y = this.FY + 40 - rise * 180; this.dirA = -Math.PI / 2;
      for (let k = 0; k < 3; k++) if (this.when(0.9 + k * 0.4)) { G.sfx('splash'); for (let i = 0; i < 5; i++) { const tx = G.player.cx + (i - 2) * 70, tt = 1.0; this.shot(G, this.cx, this.y, (tx - this.cx) / tt, (this.FY - this.y - 0.5 * 1000 * tt * tt) / tt, { grav: 1000, r: 9, kind: 'glob', col: '#a5ffff', life: 3 }); } }
      return t > 2.7;
    },
    tail(G, dt, t) {
      const n = this.phase > 1 ? 4 : 3;
      this.x = this.MID; this.y = this.FY + 300;
      for (let i = 0; i < n; i++) {
        if (this.when(i * 0.55)) { this['tx' + i] = G.player.cx; this.warn(G, G.player.cx - 30, this.FY - 8, 60, 8, 0.55, '#a5ffff'); }
        if (t > i * 0.55 + 0.55 && t < i * 0.55 + 0.95) { this.hit(G, this['tx' + i] - 26, this.FY - 150, 52, 150, 1); this.geys = this.geys || {}; this.geys[i] = { x: this['tx' + i], k: Math.min(1, (t - i * 0.55 - 0.55) * 6) }; }
        else if (this.geys && this.geys[i]) delete this.geys[i];
        if (this.when(i * 0.55 + 0.55)) G.sfx('splash');
      }
      return t > n * 0.55 + 1;
    },
    brood(G, dt, t) {
      if (this.when(0.3)) { for (let i = 0; i < 2; i++) { const e = new LF.Enemy('gloomjelly', R.range(this.AL + 100, this.AR - 100), this.FY - 200, { summoned: true, noDrop: true }); G.enemies.push(e); } G.sfx('splash'); }
      return t > 0.8;
    },
  };
  Eelmother.prototype.draw = function (c, G) {
    const segs = this.segs();
    c.save();
    c.beginPath(); c.rect(this.AL - 64, -2000, this.AR - this.AL + 128, this.FY + 2000 + 4); c.clip();
    c.lineCap = 'round';
    for (let i = segs.length - 1; i >= 0; i--) { const s = segs[i]; const r = 30 - i * 1.6; c.fillStyle = i % 3 === 0 ? '#2a5a60' : '#1f4a50'; c.beginPath(); c.arc(s.x, s.y, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(165,255,255,0.35)'; c.beginPath(); c.arc(s.x, s.y - r * 0.4, r * 0.3, 0, TAU); c.fill(); }
    c.translate(this.cx, this.cy); c.rotate(this.dirA || 0);
    c.fillStyle = '#2f6a70'; c.strokeStyle = '#0a1c1e'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, 0, 46, 32, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#0a1c1e'; c.beginPath(); c.moveTo(46, 0); c.lineTo(14, -10); c.lineTo(14, 10); c.fill();
    c.fillStyle = '#e8ffff'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(18 + i * 7, -6); c.lineTo(21 + i * 7, 2); c.lineTo(24 + i * 7, -6); c.fill(); }
    // frills
    c.fillStyle = 'rgba(165,255,255,0.4)'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-10, s * 28); c.quadraticCurveTo(-30, s * 60, -46, s * 30); c.fill(); }
    const ec = this.phase > 1 ? '#ff7aa0' : '#a5ffff'; c.fillStyle = ec; c.shadowColor = ec; c.shadowBlur = 14; c.beginPath(); c.arc(12, -14, 5, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.restore();
    if (this.geys) for (const k in this.geys) { const s = this.geys[k]; const h = 150 * s.k; const g = c.createLinearGradient(0, this.FY - h, 0, this.FY); g.addColorStop(0, 'rgba(230,255,255,0.9)'); g.addColorStop(1, 'rgba(60,160,170,0.6)'); c.fillStyle = g; c.beginPath(); c.moveTo(s.x - 24, this.FY); c.quadraticCurveTo(s.x - 30, this.FY - h * 0.6, s.x, this.FY - h); c.quadraticCurveTo(s.x + 30, this.FY - h * 0.6, s.x + 24, this.FY); c.fill(); }
  };

  // ===================================================================== 7. Forge Tyrant Vulk
  class Tyrant extends Boss {
    constructor(G) { super(G, 'tyrant'); this.w = 100; this.h = 130; this.x = this.MID + 150; this.y = this.FY - this.h; this.phases = [0.5]; this.lavaT = 0; }
    restT() { return this.phase === 1 ? 0.75 : 0.45; }
    choose(G) { const l = ['hammer', 'fire', 'charge']; if (this.phase > 1) l.push('quake'); this.start(this.pick(l)); }
    onPhase(G) { this.speed = 1.2; this.start('quake'); }
    idle(G, dt) { this.vx = LF.approach(this.vx, 0, 1500 * dt); this.face = this.toward(G); this.ground(G, dt); }
    update(G, dt) {
      super.update(G, dt);
      if (this.lavaT > 0 && !this.dying) { this.lavaT -= dt; const w = 6 * T; this.hit(G, this.AL - 8, this.FY - 22, w, 22, 1); this.hit(G, this.AR - w + 8, this.FY - 22, w, 22, 1); if (Math.random() < 0.6) { G.particle(R.range(this.AL, this.AL + w), this.FY - 10, { vx: 0, vy: -R.range(60, 200), life: 0.6, col: '#ffb243', size: 3, glow: true, grav: 300 }); G.particle(R.range(this.AR - w, this.AR), this.FY - 10, { vx: 0, vy: -R.range(60, 200), life: 0.6, col: '#ffb243', size: 3, glow: true, grav: 300 }); } }
    }
    onLand(G) { G.shake(12, 0.3); G.sfx('slam'); G.dust(this.cx, this.FY, 18); }
  }
  Tyrant.prototype.acts = {
    hammer(G, dt, t) {
      if (t < 0.6) { this.face = this.toward(G); this.vx = this.face * 150; this.pose = 'walk'; }
      else if (t < 1.1) { this.vx = 0; this.pose = 'raise'; }
      else this.pose = 'smash';
      if (this.when(1.1)) { G.shake(14, 0.35); G.sfx('boom'); G.dust(this.cx + this.face * 80, this.FY, 18); }
      if (t > 1.1 && t < 1.25) this.hit(G, this.face > 0 ? this.x + this.w - 20 : this.x - 110, this.FY - 90, 130, 90, 2);
      const n = this.phase > 1 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const gx = this.cx + this.face * (150 + i * 110);
        if (this.when(1.15 + i * 0.18)) this.warn(G, gx - 28, this.FY - 8, 56, 8, 0.4, '#ffb243');
        if (t > 1.55 + i * 0.18 && t < 1.95 + i * 0.18 && gx > this.AL && gx < this.AR) { this.hit(G, gx - 24, this.FY - 160, 48, 160, 1); if (Math.random() < 0.8) G.particle(gx + R.range(-16, 16), this.FY - R.range(0, 160), { vx: R.range(-30, 30), vy: -R.range(100, 300), life: 0.5, col: R() < 0.5 ? '#ff6a1a' : '#ffd36a', size: R.range(3, 6), glow: true }); }
        if (this.when(1.55 + i * 0.18)) G.sfx('spell');
      }
      this.ground(G, dt);
      return t > 2.4 + n * 0.18;
    },
    fire(G, dt, t) {
      this.vx = 0; this.ground(G, dt); this.face = this.toward(G); this.pose = 'throw';
      const n = this.phase > 1 ? 5 : 3;
      for (let i = 0; i < n; i++) if (this.when(0.4 + i * 0.3)) { const tx = G.player.cx + R.range(-80, 80), tt = 0.9; this.shot(G, this.cx, this.y + 20, (tx - this.cx) / tt, (this.FY - this.y - 20 - 0.5 * 1000 * tt * tt) / tt, { grav: 1000, r: 12, kind: 'fireball', col: '#ff8c4c', life: 3 }); G.sfx('spell'); }
      return t > 0.6 + n * 0.3;
    },
    charge(G, dt, t) {
      if (t < 0.5) { this.vx = 0; this.face = this.toward(G); this.pose = 'brace'; this.ground(G, dt); return false; }
      this.pose = 'charge'; this.vx = this.face * 560; this.ground(G, dt);
      this.hit(G, this.face > 0 ? this.x + this.w - 20 : this.x - 10, this.y + 30, 30, this.h - 30, 2);
      if (Math.random() < 0.7) G.spawnFlame(this.cx - this.face * 40, this.FY - 2, 'enemy', 1.5);
      if (this.x <= this.AL + 2 || this.x + this.w >= this.AR - 2 || t > 2.5) { if (!this.fired.has('w')) { this.fired.add('w'); this.wt = t; G.shake(12, 0.3); G.sfx('slam'); this.rocks(G, this.phase > 1 ? 5 : 3, '#5f3527'); } this.vx = 0; return t - this.wt > 0.8; }
      return false;
    },
    quake(G, dt, t) {
      if (this.when(0.1)) { this.vy = -900; this.vx = (this.MID - this.cx) / 0.7; this.onGround = false; this.pose = 'air'; }
      this.ground(G, dt, 2500);
      if (t > 0.4 && this.onGround && !this.fired.has('l')) { this.fired.add('l'); this.vx = 0; this.lavaT = 3.2; G.sfx('boom'); this.rocks(G, 4, '#5f3527'); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) this.shot(G, this.cx, this.y + 20, s * (150 + i * 90), -500 - i * 60, { grav: 1000, r: 10, kind: 'fireball', col: '#ff8c4c', life: 3 }); }
      return t > 2.2;
    },
  };
  Tyrant.prototype.draw = function (c, G) {
    const x = this.cx, y = this.y + this.h, f = this.face, t = this.t, p = this.pose || 'idle';
    c.save(); c.translate(x, y); c.scale(f, 1);
    const walk = p === 'walk' ? Math.sin(t * 7) : 0, crouch = p === 'brace' ? 10 : 0;
    c.fillStyle = '#2c1b17';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 18, -40); c.lineTo(s * 34 + walk * s * 8, 0); c.lineTo(s * 8 + walk * s * 4, 0); c.closePath(); c.fill(); }
    c.translate(0, -70 + crouch);
    // molten body
    const g = c.createRadialGradient(0, 0, 10, 0, 0, 70); g.addColorStop(0, '#ff9a3a'); g.addColorStop(0.35, '#a83a10'); g.addColorStop(1, '#2c1b17');
    c.fillStyle = g; c.beginPath(); c.moveTo(-48, 40); c.quadraticCurveTo(-64, -10, -40, -52); c.quadraticCurveTo(0, -70, 40, -52); c.quadraticCurveTo(64, -10, 48, 40); c.closePath(); c.fill();
    c.strokeStyle = '#140a08'; c.lineWidth = 4; c.stroke();
    // cracks glowing
    c.strokeStyle = '#ffd36a'; c.lineWidth = 2; c.shadowColor = '#ff8c4c'; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(-20, -40); c.lineTo(-8, -10); c.lineTo(-24, 20); c.moveTo(18, -30); c.lineTo(8, 6); c.lineTo(22, 30); c.stroke(); c.shadowBlur = 0;
    // head
    c.fillStyle = '#3a2420'; c.beginPath(); c.moveTo(-22, -52); c.lineTo(-18, -82); c.lineTo(18, -82); c.lineTo(22, -52); c.fill(); c.stroke();
    c.fillStyle = '#ffd36a'; c.shadowColor = '#ff8c4c'; c.shadowBlur = 14; c.fillRect(-12, -72, 24, 6); c.shadowBlur = 0;
    // horns
    c.fillStyle = '#1a0e0a'; c.beginPath(); c.moveTo(-18, -78); c.quadraticCurveTo(-40, -90, -34, -110); c.quadraticCurveTo(-28, -92, -10, -82); c.fill(); c.beginPath(); c.moveTo(18, -78); c.quadraticCurveTo(40, -90, 34, -110); c.quadraticCurveTo(28, -92, 10, -82); c.fill();
    // hammer arm
    c.save(); c.translate(44, -30);
    const ang = p === 'raise' ? -2.6 : p === 'smash' ? 0.9 : p === 'throw' ? -1.2 + Math.sin(t * 10) * 0.4 : 0.3 + Math.sin(t * 2) * 0.1;
    c.rotate(ang); c.fillStyle = '#3a2420'; c.fillRect(-6, 0, 12, 90);
    c.fillStyle = '#5f3527'; c.strokeStyle = '#140a08'; c.lineWidth = 3; c.beginPath(); c.rect(-30, 82, 60, 40); c.fill(); c.stroke();
    c.fillStyle = '#ff8c4c'; c.fillRect(-26, 112, 52, 6);
    c.restore();
    c.restore();
    if (this.lavaT > 0) {
      const w = 6 * T, a = Math.min(1, this.lavaT);
      for (const x0 of [this.AL - 8, this.AR - w + 8]) { const g2 = c.createLinearGradient(0, this.FY - 24, 0, this.FY); g2.addColorStop(0, `rgba(255,210,100,${a})`); g2.addColorStop(1, `rgba(200,60,10,${a})`); c.fillStyle = g2; c.beginPath(); c.moveTo(x0, this.FY); for (let i = 0; i <= 12; i++) c.lineTo(x0 + w * i / 12, this.FY - 18 - Math.sin(this.t * 5 + i) * 5); c.lineTo(x0 + w, this.FY); c.fill(); }
    }
  };

  // ===================================================================== 8. Veiled Oracle
  class Oracle extends Boss {
    constructor(G) { super(G, 'oracle'); this.w = 84; this.h = 84; this.x = this.MID - 42; this.y = this.FY - 300; this.phases = [0.55, 0.25]; this.tx = this.x; this.ty = this.y; this.orbs = []; }
    restT() { return [0, 0.8, 0.55, 0.4][this.phase]; }
    choose(G) { const l = ['beam', 'orbs', 'blink', 'phantoms']; if (this.phase >= 2) l.push('spiral'); this.start(this.pick(l)); }
    onPhase(G, p) { this.speed = p === 2 ? 1.15 : 1.3; G.darkBoost = p === 2 ? 0.25 : 0.4; }
    idle(G, dt) { this.x = LF.lerp(this.x, this.tx, dt * 2); this.y = LF.lerp(this.y, this.ty + Math.sin(this.t * 1.5) * 12, dt * 2); }
  }
  Oracle.prototype.acts = {
    blink(G, dt, t) {
      this.alpha = t < 0.3 ? 1 - t / 0.3 : t < 0.6 ? 0 : Math.min(1, (t - 0.6) / 0.3); this.hidden = t > 0.2 && t < 0.7;
      if (this.when(0.3)) { this.tx = this.x = R.range(this.AL + 60, this.AR - 140); this.ty = this.y = this.FY - R.range(220, 330); G.sfx('veil'); }
      return t > 0.9;
    },
    beam(G, dt, t) {
      this.idle(G, dt);
      if (this.when(0)) { const a = Math.atan2(G.player.cy - this.cy, G.player.cx - this.cx); this.a0 = a - 0.9; this.a1 = a + 0.9; if (R() < 0.5) [this.a0, this.a1] = [this.a1, this.a0]; }
      if (t < 0.9) { this.beamA = this.a0; this.beamCharge = t / 0.9; this.beamOn = false; }
      else if (t < 2.3) { this.beamA = LF.lerp(this.a0, this.a1, (t - 0.9) / 1.4); this.beamOn = true; for (let s = 50; s < 1400; s += 36) this.hit(G, this.cx + Math.cos(this.beamA) * s - 14, this.cy + Math.sin(this.beamA) * s - 14, 28, 28, 1); }
      else { this.beamOn = false; this.beamCharge = 0; }
      if (this.when(0.9)) G.sfx('zap');
      return t > 2.6;
    },
    orbs(G, dt, t) {
      this.idle(G, dt);
      const n = this.phase >= 2 ? 8 : 6;
      if (this.when(0)) { this.orbs = []; for (let i = 0; i < n; i++) this.orbs.push({ a: i / n * TAU, alive: true }); }
      for (const o of this.orbs) o.a += dt * 3;
      for (let i = 0; i < n; i++) if (this.when(1 + i * 0.22)) { const o = this.orbs[i]; if (!o) continue; o.alive = false; const ox = this.cx + Math.cos(o.a) * 70, oy = this.cy + Math.sin(o.a) * 70, a = Math.atan2(G.player.cy - oy, G.player.cx - ox); this.shot(G, ox, oy, Math.cos(a) * 380, Math.sin(a) * 380, { r: 9, kind: 'orb', col: '#ffa3f2', life: 3 }); G.sfx('shot'); }
      if (t > 1 + n * 0.22) this.orbs = [];
      return t > 1.4 + n * 0.22;
    },
    phantoms(G, dt, t) {
      this.idle(G, dt);
      if (this.when(0.2)) { this.ph = []; for (const s of [-1, 1]) this.ph.push({ x: G.player.cx + s * 300, y: G.player.cy - 20, vx: 0, vy: 0, s }); G.sfx('veil'); }
      if (this.ph) for (const p of this.ph) {
        if (t < 0.9) { p.x = LF.lerp(p.x, G.player.cx + p.s * 260, dt * 3); p.y = LF.lerp(p.y, G.player.cy - 10, dt * 3); }
        else { if (!p.go) { p.go = true; p.vx = -p.s * 900; } p.x += p.vx * dt; this.hit(G, p.x - 14, p.y - 20, 28, 40, 1); }
      }
      if (this.when(0.9)) G.sfx('dash');
      if (t > 1.8) { this.ph = null; return true; }
      return false;
    },
    spiral(G, dt, t) {
      this.idle(G, dt);
      if (t < 2.4 && Math.floor(t * 12) !== Math.floor((t - dt) * 12)) { const k = Math.floor(t * 12); for (let j = 0; j < 3; j++) { const a = k * 0.35 + j * TAU / 3; this.shot(G, this.cx, this.cy, Math.cos(a) * 220, Math.sin(a) * 220, { r: 7, kind: 'orb', col: '#ff9ef0', life: 3 }); } if (k % 3 === 0) G.sfx('shot'); }
      return t > 2.8;
    },
  };
  Oracle.prototype.draw = function (c, G) {
    const x = this.cx, y = this.cy, t = this.t;
    c.save(); c.globalAlpha = this.alpha;
    // veils
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU + t * 0.3; c.fillStyle = i % 2 ? 'rgba(93,75,112,0.75)' : 'rgba(140,100,170,0.6)';
      c.beginPath(); c.moveTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30);
      c.quadraticCurveTo(x + Math.cos(a + 0.4) * 90, y + Math.sin(a + 0.4) * 90 + 30, x + Math.cos(a + 0.2) * 70 + Math.sin(t * 2 + i) * 10, y + 90 + Math.sin(t * 3 + i) * 10);
      c.quadraticCurveTo(x + Math.cos(a - 0.2) * 60, y + 40, x + Math.cos(a) * 30, y + Math.sin(a) * 30); c.fill();
    }
    // eye
    const g = c.createRadialGradient(x, y, 4, x, y, 44); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#f4e8ff'); g.addColorStop(1, '#8a6aa0');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 44, 34, 0, 0, TAU); c.fill(); c.strokeStyle = '#2c2236'; c.lineWidth = 4; c.stroke();
    const p = G.player, a = Math.atan2(p.cy - y, p.cx - x);
    const ic = this.phase >= 3 ? '#ff3a6a' : '#ebcb7e';
    c.fillStyle = ic; c.beginPath(); c.arc(x + Math.cos(a) * 14, y + Math.sin(a) * 10, 15, 0, TAU); c.fill();
    c.fillStyle = '#120a18'; c.beginPath(); c.ellipse(x + Math.cos(a) * 16, y + Math.sin(a) * 11, 4, 11, 0, 0, TAU); c.fill();
    // lids
    const blink = (Math.sin(t * 0.7) > 0.97) ? 1 : 0;
    c.fillStyle = '#3d2f4a'; c.beginPath(); c.ellipse(x, y - 34 + blink * 30, 50, 18, 0, 0, Math.PI); c.fill();
    // halo
    c.strokeStyle = 'rgba(235,203,126,0.7)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 60 + Math.sin(t * 2) * 3, 0, TAU); c.stroke();
    c.restore();
    for (const o of this.orbs) if (o.alive) { c.fillStyle = '#ffa3f2'; c.shadowColor = '#ffa3f2'; c.shadowBlur = 12; c.beginPath(); c.arc(x + Math.cos(o.a) * 70, y + Math.sin(o.a) * 70, 8, 0, TAU); c.fill(); c.shadowBlur = 0; }
    if (this.ph) for (const ph of this.ph) { c.save(); c.globalAlpha = 0.7; c.fillStyle = '#1a1024'; c.beginPath(); c.ellipse(ph.x, ph.y, 14, 22, 0, 0, TAU); c.fill(); c.fillStyle = '#ffa3f2'; c.beginPath(); c.arc(ph.x, ph.y - 18, 9, 0, TAU); c.fill(); c.restore(); }
    if (this.beamCharge > 0) {
      c.save(); c.globalCompositeOperation = 'lighter'; const a2 = this.beamA;
      if (this.beamOn) { c.strokeStyle = 'rgba(255,163,242,0.45)'; c.lineWidth = 34; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a2) * 1500, y + Math.sin(a2) * 1500); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 9; c.stroke(); }
      else { c.strokeStyle = `rgba(255,163,242,${0.2 + this.beamCharge * 0.4})`; c.lineWidth = 2; c.setLineDash([8, 10]); c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a2) * 1500, y + Math.sin(a2) * 1500); c.stroke(); c.setLineDash([]); }
      c.restore();
    }
  };

  // ===================================================================== 9. Gloam Knight
  class GloamKnight extends Boss {
    constructor(G) { super(G, 'gloamknight'); this.w = 32; this.h = 56; this.x = this.MID + 200; this.y = this.FY - this.h; this.phases = [0.6, 0.25]; this.ghosts = []; }
    restT() { return [0, 0.55, 0.4, 0.3][this.phase]; }
    choose(G) { const l = ['dashslash', 'aerial', 'bolts', 'guard', 'dashslash']; if (this.phase >= 3) l.push('nova'); this.start(this.pick(l)); }
    onPhase(G, p) { this.speed = p === 2 ? 1.15 : 1.3; G.sfx('roar'); }
    idle(G, dt) { this.face = this.toward(G); const d = G.player.cx - this.cx; this.vx = LF.approach(this.vx, Math.abs(d) > 220 ? Math.sign(d) * 160 : Math.abs(d) < 120 ? -Math.sign(d) * 140 : 0, 1200 * dt); this.ground(G, dt); this.pose = Math.abs(this.vx) > 20 ? 'run' : 'idle'; }
    block(G, dirX, kind) {
      if (this.act === 'guard' && this.at < 1.0) { G.sfx('clank'); G.spark(this.cx, this.cy, '#c47dff'); this.countered = true; return true; }
      return false;
    }
    update(G, dt) { super.update(G, dt); for (const g of this.ghosts) { g.t -= dt; if (g.t <= 0 && !g.done) { g.done = true; g.go = 0.22; } if (g.go > 0) { g.go -= dt; g.x += g.dir * 1100 * dt; this.hit(G, g.x - 20, g.y - 50, 40, 50, 1); } } this.ghosts = this.ghosts.filter(g => !g.done || g.go > 0); }
    onLand(G) { if (this.act === 'aerial') { G.shake(10, 0.25); G.sfx('slam'); this.wave(G, this.cx - 20, -1, 420, 1, '#c47dff'); this.wave(G, this.cx + 20, 1, 420, 1, '#c47dff'); } }
  }
  GloamKnight.prototype.acts = {
    dashslash(G, dt, t) {
      if (t < 0.32) { this.vx = 0; this.face = this.toward(G); this.pose = 'ready'; this.ground(G, dt); return false; }
      if (this.when(0.32)) { G.sfx('dash'); if (this.phase >= 2) this.ghosts.push({ x: this.cx, y: this.y + this.h, dir: this.face, t: 0.45 }); }
      if (t < 0.58) { this.vx = this.face * 900; this.pose = 'slash'; this.hit(G, this.face > 0 ? this.x : this.x - 50, this.y, this.w + 50, this.h, 1); if (Math.random() < 0.8) G.particle(this.cx, this.cy + R.range(-20, 20), { vx: -this.face * 80, vy: 0, life: 0.35, col: '#2a2040', size: 4 }); }
      else { this.vx = LF.approach(this.vx, 0, 4000 * dt); this.pose = 'idle'; }
      this.ground(G, dt);
      return t > 0.95;
    },
    aerial(G, dt, t) {
      if (this.when(0.15)) { this.vy = -1150; this.vx = (G.player.cx - this.cx) / 0.5; this.onGround = false; G.sfx('djump'); this.pose = 'air'; }
      if (t < 0.6) { this.ground(G, dt, 2300); return false; }
      if (t < 0.85) { this.vx = 0; this.vy = 0; this.pose = 'plunge'; this.x = LF.lerp(this.x, G.player.cx - this.w / 2, dt * 8); return false; }
      this.vy = 1700; this.vx = 0; this.pose = 'plunge'; this.ground(G, dt, 0); this.hit(G, this.x - 6, this.y, this.w + 12, this.h + 10, 1);
      return this.onGround && t > 1.0 || t > 2.2;
    },
    bolts(G, dt, t) {
      this.vx = 0; this.ground(G, dt); this.face = this.toward(G); this.pose = 'cast';
      const n = this.phase >= 2 ? 4 : 3;
      for (let i = 0; i < n; i++) if (this.when(0.35 + i * 0.25)) { this.shot(G, this.cx + this.face * 20, this.cy - 6, this.face * 520, (i - (n - 1) / 2) * 60, { r: 10, kind: 'shadow', col: '#c47dff', life: 2.5 }); G.sfx('spell'); }
      return t > 0.6 + n * 0.25;
    },
    guard(G, dt, t) {
      this.vx = 0; this.ground(G, dt); this.pose = 'guard';
      if (t < 0.05) this.countered = false;
      if (this.countered && !this.fired.has('c')) { this.fired.add('c'); this.at = 1.0; this.face = this.toward(G); G.sfx('slash2'); }
      if (this.fired.has('c') && t > 1.0 && t < 1.25) { this.pose = 'slash'; this.vx = this.face * 600; this.hit(G, this.face > 0 ? this.x : this.x - 70, this.y - 10, this.w + 70, this.h + 10, 1); }
      return t > (this.fired.has('c') ? 1.5 : 1.1);
    },
    nova(G, dt, t) {
      this.vx = 0; this.ground(G, dt); this.pose = 'cast';
      if (this.when(0.1)) { this.blinkTo = LF.clamp(G.player.cx + R.pick([-1, 1]) * 180, this.AL + 30, this.AR - 60); G.sfx('veil'); }
      if (this.when(0.35)) this.x = this.blinkTo;
      if (this.when(0.8)) { G.sfx('nova'); G.shake(10, 0.3); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; this.shot(G, this.cx, this.cy, Math.cos(a) * 300, Math.sin(a) * 300, { r: 9, kind: 'shadow', col: '#c47dff', life: 2 }); } }
      if (t > 0.8 && t < 1.1) this.hit(G, this.cx - 70, this.cy - 70, 140, 140, 2);
      return t > 1.5;
    },
  };
  GloamKnight.prototype.draw = function (c, G) {
    const drawK = (x, y, f, pose, alpha, t) => {
      c.save(); c.globalAlpha = alpha; c.translate(x, y); c.scale(f, 1);
      // tattered cloak
      c.fillStyle = '#100c18'; c.beginPath(); c.moveTo(-6, -40); c.quadraticCurveTo(-30, -10, -26 + Math.sin(t * 6) * 4, 0); c.lineTo(-14, -4); c.lineTo(-8, 0); c.lineTo(10, -2); c.quadraticCurveTo(12, -24, 6, -40); c.fill();
      // body
      c.fillStyle = '#221d33'; c.beginPath(); c.ellipse(0, -22, 11, 18, 0, 0, TAU); c.fill();
      // head — dark lantern, violet unlit flame
      c.fillStyle = '#2d2542'; c.strokeStyle = '#0a0812'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, -46, 12, 13, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#c47dff'; c.shadowColor = '#c47dff'; c.shadowBlur = 14; c.beginPath(); c.moveTo(0, -64 - Math.sin(t * 9) * 3); c.quadraticCurveTo(7, -52, 0, -48); c.quadraticCurveTo(-7, -52, 0, -64 - Math.sin(t * 9) * 3); c.fill(); c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.fillRect(2, -47, 5, 3); c.fillRect(-6, -47, 4, 3);
      // blade
      c.save(); const ang = pose === 'slash' ? 1.3 : pose === 'plunge' ? 1.57 : pose === 'guard' ? -1.2 : pose === 'ready' ? -0.6 : 0.5;
      c.translate(8, -26); c.rotate(ang); c.strokeStyle = '#c9c0e0'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(40, 0); c.stroke(); c.strokeStyle = '#c47dff'; c.lineWidth = 1; c.stroke(); c.restore();
      c.restore();
    };
    for (const g of this.ghosts) drawK(g.x, g.y, g.dir, g.go > 0 ? 'slash' : 'ready', 0.4, this.t);
    drawK(this.cx, this.y + this.h, this.face, this.pose, 1, this.t);
    if (this.pose === 'slash') { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(196,125,255,0.7)'; c.lineWidth = 6; c.beginPath(); c.arc(this.cx, this.cy, 50, this.face > 0 ? -1 : Math.PI - 1, this.face > 0 ? 1 : Math.PI + 1); c.stroke(); c.restore(); }
  };

  // ===================================================================== 10. Ysolde, the Unlit
  class Ysolde extends Boss {
    constructor(G) { super(G, 'ysolde'); this.w = 140; this.h = 130; this.x = this.MID - 70; this.y = this.FY - 380; this.phases = [0.66, 0.33]; this.tx = this.x; this.ty = this.y; this.gloomW = 0; }
    restT() { return [0, 0.8, 0.55, 0.35][this.phase]; }
    choose(G) { const l = ['gust', 'swarm', 'dive', 'pillars']; if (this.phase >= 2) l.push('rain'); if (this.phase >= 3) l.push('pillars', 'dive'); this.start(this.pick(l)); }
    onPhase(G, p) { this.speed = p === 2 ? 1.12 : 1.28; G.sfx('roar'); if (p === 3) this.gloomW = 1; }
    idle(G, dt) { this.tx = LF.clamp(G.player.cx - this.w / 2 + Math.sin(this.t * 0.6) * 200, this.AL, this.AR - this.w); this.x = LF.lerp(this.x, this.tx, dt * 1.2); this.y = LF.lerp(this.y, this.ty + Math.sin(this.t * 1.3) * 18, dt * 2); }
    update(G, dt) {
      super.update(G, dt);
      if (this.gloomW > 0 && !this.dying) { const w = 3 * T + Math.sin(this.t * 0.8) * 20; this.hit(G, this.AL - 20, 0, w, this.FY, 1); this.hit(G, this.AR - w + 20, 0, w, this.FY, 1); }
    }
  }
  Ysolde.prototype.acts = {
    gust(G, dt, t) {
      this.idle(G, dt);
      if (t > 0.5 && t < 2.3) { const dir = G.player.cx < this.cx ? -1 : 1; G.player.x += dir * 190 * dt; if (Math.random() < 0.6) G.particle(this.cx + dir * R.range(0, 300), R.range(this.y, this.FY), { vx: dir * 500, vy: 0, life: 0.5, col: 'rgba(255,240,200,0.5)', size: 2 }); this.flap = 1; }
      for (let i = 0; i < 5; i++) if (this.when(0.6 + i * 0.35)) { for (let j = -1; j <= 1; j++) { const a = Math.atan2(G.player.cy - this.cy, G.player.cx - this.cx) + j * 0.25; this.shot(G, this.cx, this.cy, Math.cos(a) * 320, Math.sin(a) * 320, { r: 7, kind: 'feather', col: '#fff3c4', life: 3 }); } G.sfx('djump'); }
      if (this.when(0.5)) G.sfx('dash');
      return t > 2.5;
    },
    swarm(G, dt, t) {
      this.idle(G, dt);
      const n = this.phase >= 2 ? 8 : 6;
      for (let i = 0; i < n; i++) if (this.when(0.3 + i * 0.15)) { const a = R.range(0, TAU); this.shot(G, this.cx, this.cy, Math.cos(a) * 160, Math.sin(a) * 160, { r: 9, kind: 'moth', homing: 2.2, col: '#c47dff', life: 4 }); }
      if (this.when(0.3)) G.sfx('veil');
      return t > 1.8;
    },
    dive(G, dt, t) {
      if (this.when(0)) { this.s = G.player.cx < this.MID ? 1 : -1; this.dx0 = this.s > 0 ? this.AR - this.w : this.AL; }
      if (t < 0.6) { this.x = LF.lerp(this.x, this.dx0, dt * 5); this.y = LF.lerp(this.y, this.FY - 360, dt * 5); return false; }
      if (this.when(0.6)) { G.sfx('roar'); }
      const k = LF.clamp((t - 0.6) / 1.1, 0, 1), x0 = this.dx0, x1 = this.s > 0 ? this.AL : this.AR - this.w;
      this.x = LF.lerp(x0, x1, k); this.y = this.FY - 360 + Math.sin(k * Math.PI) * 300;
      this.hit(G, this.x + 20, this.y + 20, this.w - 40, this.h - 30, 2);
      if (k >= 1) { this.tx = this.x; this.ty = this.FY - 380; return t > 2.0; }
      return false;
    },
    pillars(G, dt, t) {
      this.idle(G, dt);
      if (this.when(0.1)) { this.px = []; const n = this.phase >= 3 ? 6 : 4; for (let i = 0; i < n; i++) this.px.push(i === 0 ? G.player.cx : R.range(this.AL + 40, this.AR - 40)); for (const x of this.px) this.warn(G, x - 36, 0, 72, this.FY, 0.9, 'rgba(255,243,196,0.25)'); G.sfx('charge'); }
      if (t > 1.0 && t < 1.45) { for (const x of this.px) this.hit(G, x - 30, 0, 60, this.FY, 1); this.pk = (t - 1.0) / 0.45; } else this.pk = 0;
      if (this.when(1.0)) { G.sfx('boom'); G.shake(8, 0.3); }
      return t > 1.7;
    },
    rain(G, dt, t) {
      this.idle(G, dt);
      for (let i = 0; i < 12; i++) if (this.when(0.2 + i * 0.12)) { const x = R.range(this.AL + 20, this.AR - 20); this.shot(G, x, 3 * T, 0, 120, { grav: 500, r: 10, kind: 'shadow', col: '#8a5aff', life: 4 }); }
      return t > 2;
    },
  };
  Ysolde.prototype.draw = function (c, G) {
    const x = this.cx, y = this.cy, t = this.t, flap = Math.sin(t * (this.act === 'gust' ? 14 : 4));
    c.save(); c.translate(x, y);
    // wings (4)
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, 1); c.rotate(-0.2 + flap * 0.15);
      const g = c.createLinearGradient(0, -100, 180, 60); g.addColorStop(0, this.phase >= 3 ? '#2a1a40' : '#6f5b31'); g.addColorStop(0.6, this.phase >= 2 ? '#3a2a50' : '#c9a25a'); g.addColorStop(1, '#1a1020');
      c.fillStyle = g; c.strokeStyle = '#120a10'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(10, -10); c.quadraticCurveTo(80, -150, 190, -90); c.quadraticCurveTo(170, -20, 120, 0); c.quadraticCurveTo(80, 10, 10, 10); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(10, 10); c.quadraticCurveTo(110, 40, 140, 110); c.quadraticCurveTo(70, 100, 10, 30); c.fill(); c.stroke();
      // eye spots
      c.fillStyle = this.phase >= 2 ? '#c47dff' : '#fff3c4'; c.beginPath(); c.arc(120, -60, 16, 0, TAU); c.fill(); c.fillStyle = '#120a10'; c.beginPath(); c.arc(120, -60, 7, 0, TAU); c.fill();
      c.restore();
    }
    // body
    c.fillStyle = '#3a2e20'; c.beginPath(); c.ellipse(0, 20, 26, 60, 0, 0, TAU); c.fill();
    for (let i = 0; i < 5; i++) { c.strokeStyle = 'rgba(255,226,140,0.3)'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 10 + i * 16, 22, 5, 0, 0, Math.PI); c.stroke(); }
    // inner flame (flickers with phase)
    const fl = this.phase === 1 ? '#fff3c4' : this.phase === 2 ? '#ffb35a' : '#c47dff';
    c.fillStyle = fl; c.shadowColor = fl; c.shadowBlur = 30; c.globalAlpha = 0.7 + Math.sin(t * 13) * 0.2; c.beginPath(); c.arc(0, 20, 12, 0, TAU); c.fill(); c.globalAlpha = 1; c.shadowBlur = 0;
    // head & crown
    c.fillStyle = '#2a2016'; c.beginPath(); c.arc(0, -46, 22, 0, TAU); c.fill();
    c.strokeStyle = '#d9c08a'; c.lineWidth = 3; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 8, -64); c.quadraticCurveTo(s * 30, -110, s * 56, -100 + Math.sin(t * 2) * 4); c.stroke(); }
    c.fillStyle = '#ffe28c'; c.beginPath(); c.moveTo(-14, -64); c.lineTo(-8, -80); c.lineTo(0, -68); c.lineTo(8, -80); c.lineTo(14, -64); c.fill();
    c.fillStyle = this.phase >= 3 ? '#ff5a8a' : '#fff'; c.beginPath(); c.arc(-8, -46, 5, 0, TAU); c.arc(8, -46, 5, 0, TAU); c.fill();
    c.restore();
    if (this.pk > 0 && this.px) for (const px of this.px) { const a = 1 - this.pk; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,243,196,${0.5 * a + 0.2})`; c.fillRect(px - 30, 0, 60, this.FY); c.fillStyle = `rgba(255,255,255,${0.7 * a})`; c.fillRect(px - 8, 0, 16, this.FY); c.restore(); }
    if (this.gloomW > 0) { const w = 3 * T + Math.sin(this.t * 0.8) * 20; for (const [x0, dir] of [[this.AL - 20, 1], [this.AR + 20, -1]]) { const g = c.createLinearGradient(x0, 0, x0 + dir * w, 0); g.addColorStop(0, 'rgba(20,6,30,0.95)'); g.addColorStop(1, 'rgba(90,40,140,0)'); c.fillStyle = g; c.fillRect(Math.min(x0, x0 + dir * w), 0, w, this.FY); } }
  };

  LF.BOSS_CLASSES = { warden: Warden, bramble: Bramble, archivist: Archivist, wyrm: Wyrm, bellwright: Bellwright, eelmother: Eelmother, tyrant: Tyrant, oracle: Oracle, gloamknight: GloamKnight, ysolde: Ysolde };
})();
