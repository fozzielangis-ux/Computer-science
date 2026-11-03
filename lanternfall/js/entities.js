// Lanternfall — enemies, projectiles, hazards, pickups, shade, interactables
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const T = LF.T, TL = LF.TILE, R = LF.R;

  // generic AABB vs tile movement for non-player bodies
  LF.solidForBody = function (G, tx, ty, dy, prevBottom) {
    const v = G.room.tile(tx, ty);
    if (v === TL.E || v === TL.WATER || v === TL.GLOOM || v === TL.LAVA || v === TL.SPK) return false;
    if (v === TL.P || v === TL.CU) return dy > 0 && prevBottom <= ty * T + 0.5;
    return true;
  };
  LF.moveBody = function (G, b, dx, dy) {
    let hx = 0, hy = 0;
    const test = (fy, pb) => {
      const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T), y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const v = G.room.tile(tx, ty);
        if ((v === TL.P || v === TL.CU) && ty !== y1) continue;
        if (LF.solidForBody(G, tx, ty, fy, pb)) return { tx, ty };
      }
      return null;
    };
    let n = Math.ceil(Math.abs(dx) / 10) || 1;
    for (let i = 0; i < n; i++) { b.x += dx / n; const c = test(0, b.y + b.h); if (c) { b.x = dx > 0 ? c.tx * T - b.w : (c.tx + 1) * T; hx = Math.sign(dx); break; } }
    n = Math.ceil(Math.abs(dy) / 10) || 1;
    for (let i = 0; i < n; i++) { const pb = b.y + b.h; b.y += dy / n; const c = test(dy, pb); if (c) { b.y = dy > 0 ? c.ty * T - b.h : (c.ty + 1) * T; hy = Math.sign(dy); break; } }
    return { hx, hy };
  };
  const solidT = (G, tx, ty) => { const v = G.room.tile(tx, ty); return !(v === TL.E || v === TL.WATER || v === TL.GLOOM || v === TL.LAVA || v === TL.SPK); };
  const hazardT = (G, tx, ty) => { const v = G.room.tile(tx, ty); return v === TL.SPK || v === TL.LAVA || v === TL.GLOOM; };

  // ---------------------------------------------------------------- Enemy
  class Enemy {
    constructor(type, x, y, opts = {}) {
      const d = this.def = LF.ENEMIES[type]; this.type = type;
      this.w = d.w; this.h = d.h; this.x = x - d.w / 2;
      const airborne = ['flyer', 'diver', 'shooterfly', 'ghost', 'teleporter', 'exploder'].includes(d.ai);
      this.y = airborne ? y - d.h / 2 : y - d.h;
      this.homeX = this.x; this.homeY = this.y; this.air = airborne && d.ai !== 'exploder' || d.ai === 'exploder';
      this.hp = this.maxHp = d.hp; this.vx = 0; this.vy = 0; this.face = R() < 0.5 ? -1 : 1;
      this.state = 'idle'; this.t = R.range(0, 1.5); this.flash = 0; this.dead = false; this.onGround = false;
      this.hidden = d.ai === 'ambusher'; this.alpha = 1; this.anim = R() * 10; this.knock = 0; this.cool = R.range(0.5, 2);
      this.spawnIdx = opts.idx; this.noDrop = !!opts.noDrop; this.summoned = !!opts.summoned;
      this.inv = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    groundAhead(G, dir) {
      const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / T), ty = Math.floor((this.y + this.h + 2) / T);
      return solidT(G, tx, ty) && !hazardT(G, tx, ty - 1);
    }
    wallAhead(G, dir) {
      const tx = Math.floor((dir > 0 ? this.x + this.w + 2 : this.x - 2) / T);
      for (let ty = Math.floor(this.y / T); ty <= Math.floor((this.y + this.h - 2) / T); ty++) if (solidT(G, tx, ty) || hazardT(G, tx, ty)) return true;
      return false;
    }
    physics(G, dt, grav = true) {
      if (grav) this.vy = Math.min(this.vy + 2200 * dt, 900);
      const kx = this.knock; this.knock = LF.approach(this.knock, 0, 1600 * dt);
      const r = LF.moveBody(G, this, (this.vx + kx) * dt, this.vy * dt);
      if (r.hy > 0) { this.onGround = true; this.vy = 0; } else if (r.hy < 0) { this.vy = 0; } else if (grav) this.onGround = false;
      if (r.hx) this.knock = 0;
      // fell into hazard / out of room
      if (this.y > G.room.H * T + 100) this.die(G, true);
      return r;
    }
    toward(G) { return G.player.cx < this.cx ? -1 : 1; }
    distP(G) { return LF.dist(this.cx, this.cy, G.player.cx, G.player.cy); }
    sees(G, range, vert = 80) { const p = G.player; return Math.abs(p.cx - this.cx) < range && Math.abs(p.cy - this.cy) < vert && !p.dead; }
    shoot(G, vx, vy, opts = {}) { G.projectiles.push(new Projectile(this.cx + (opts.ox || 0), this.cy + (opts.oy || 0), vx, vy, Object.assign({ owner: 'enemy', dmg: this.def.dmg, col: this.def.col2 }, opts))); }
    aimShot(G, spd, opts = {}) { const p = G.player, a = Math.atan2(p.cy - this.cy, p.cx - this.cx) + (opts.spread || 0); this.shoot(G, Math.cos(a) * spd, Math.sin(a) * spd, opts); }

    update(G, dt) {
      const d = this.def; this.anim += dt; this.flash -= dt; this.t -= dt; this.cool -= dt; this.inv -= dt;
      const ai = AI[d.ai] || AI.walker;
      ai.call(this, G, dt, d);
    }
    hurt(G, dmg, dirX, kind) {
      if (this.dead || this.inv > 0) return false;
      const d = this.def;
      if (this.hidden || this.state === 'faded') return false;
      if (d.ai === 'shell' && this.state === 'shell' && kind !== 'cleave' && kind !== 'spell') { G.sfx('clank'); G.spark(this.cx, this.cy, '#fff'); return 'block'; }
      if (d.ai === 'guard' && kind === 'side' && Math.sign(-dirX) === this.face && this.state !== 'lunge') { G.sfx('clank'); G.spark(this.cx + this.face * this.w / 2, this.cy, '#fff'); return 'block'; }
      this.hp -= dmg; this.flash = 0.12; this.inv = 0.05;
      if (!['turret', 'heavy', 'ambusher'].includes(d.ai)) this.knock = dirX * (kind === 'cleave' ? 520 : 300);
      if (d.ai === 'shell' && this.state !== 'shell') { this.state = 'shell'; this.t = 1.6; }
      G.hitFx(this.cx, this.cy, dirX, d.col2);
      if (this.hp <= 0) this.die(G);
      return true;
    }
    die(G, silent) {
      if (this.dead) return; this.dead = true;
      if (silent) return;
      G.sfx('kill'); G.shake(3, 0.1);
      G.burst(this.cx, this.cy, 18, { col: this.def.col, spd: 260, life: 0.7, size: 4, grav: 600 });
      G.burst(this.cx, this.cy, 10, { col: this.def.col2, spd: 180, life: 0.5, size: 2, glow: true });
      if (!this.noDrop) G.dropGlim(this.cx, this.cy, this.def.glim);
      G.onEnemyKilled(this);
      if (this.def.ai === 'exploder') AI.burstSpores.call(this, G);
    }
    contactBox() {
      if (this.hidden || this.state === 'faded') return null;
      return { x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 };
    }
  }

  const AI = {
    walker(G, dt, d) {
      if (this.onGround || this.vy === 0) {
        if (this.wallAhead(G, this.face) || !this.groundAhead(G, this.face)) this.face *= -1;
      }
      this.vx = this.face * d.spd;
      if (d.trail && (this.cool -= dt) < -0.35) { this.cool = 0; G.spawnFlame(this.cx - this.face * this.w / 2, this.y + this.h - 4, 'enemy', 2.2); }
      this.physics(G, dt);
    },
    runner(G, dt, d) {
      if (this.sees(G, 280, 70)) {
        this.face = this.toward(G);
        if (this.onGround && this.wallAhead(G, this.face)) this.vx = 0;
        else if (this.onGround && !this.groundAhead(G, this.face)) { this.vx = 0; }
        else this.vx = LF.approach(this.vx, this.face * d.spd, 900 * dt);
        if (this.onGround && this.cool <= 0 && Math.abs(G.player.cx - this.cx) < 150) { this.vy = -560; this.vx = this.face * d.spd * 1.3; this.cool = 1.6; this.onGround = false; }
      } else {
        if (this.onGround && (this.wallAhead(G, this.face) || !this.groundAhead(G, this.face))) this.face *= -1;
        this.vx = this.face * d.spd * 0.35;
      }
      this.physics(G, dt);
    },
    guard(G, dt, d) {
      const near = this.sees(G, 320, 90);
      if (this.state === 'windup') { this.vx = 0; if (this.t <= 0) { this.state = 'lunge'; this.t = 0.28; G.sfx('dash'); } }
      else if (this.state === 'lunge') { this.vx = this.face * 400; if (this.t <= 0 || this.wallAhead(G, this.face) || !this.groundAhead(G, this.face)) { this.state = 'idle'; this.t = 0.6; this.cool = 2.2; } }
      else {
        if (near) { this.face = this.toward(G); this.vx = this.face * d.spd * 0.6; if (!this.groundAhead(G, this.face) || this.wallAhead(G, this.face)) this.vx = 0; }
        else { if (this.wallAhead(G, this.face) || !this.groundAhead(G, this.face)) this.face *= -1; this.vx = this.face * d.spd * 0.5; }
        if (near && this.cool <= 0 && Math.abs(G.player.cx - this.cx) < 170) { this.state = 'windup'; this.t = 0.38; }
        if (d.leaps && near && this.onGround && this.cool <= -1 && R() < 0.02) { this.vy = -640; this.vx = this.face * 220; this.cool = 1.5; }
      }
      this.physics(G, dt);
    },
    charger(G, dt, d) {
      if (this.state === 'windup') { this.vx = 0; this.shakeX = Math.sin(this.anim * 60) * 2; if (this.t <= 0) { this.state = 'charge'; this.t = 1.1; G.sfx('dash'); } }
      else if (this.state === 'charge') {
        this.vx = this.face * d.spd * 5.5; this.shakeX = 0;
        if (Math.random() < 0.5) G.dust(this.cx - this.face * this.w / 2, this.y + this.h, 1);
        if (this.t <= 0 || this.wallAhead(G, this.face) || !this.groundAhead(G, this.face)) { this.state = 'stun'; this.t = 0.7; this.vx = 0; if (this.wallAhead(G, this.face)) G.shake(3, 0.1); }
      } else if (this.state === 'stun') { this.vx = 0; if (this.t <= 0) { this.state = 'idle'; this.cool = 1; } }
      else {
        if (this.onGround && (this.wallAhead(G, this.face) || !this.groundAhead(G, this.face))) this.face *= -1;
        this.vx = this.face * d.spd;
        if (this.cool <= 0 && this.sees(G, 330, 50)) { this.face = this.toward(G); if (this.groundAhead(G, this.face)) { this.state = 'windup'; this.t = 0.45; } }
      }
      this.physics(G, dt);
    },
    hopper(G, dt, d) {
      if (this.onGround) {
        this.vx = LF.approach(this.vx, 0, 2000 * dt);
        if (this.t <= 0) {
          const near = this.sees(G, 420, 200);
          this.face = near ? this.toward(G) : (R() < 0.5 ? -1 : 1);
          if (this.wallAhead(G, this.face)) this.face *= -1;
          this.vy = -R.range(420, 640); this.vx = this.face * d.spd * R.range(0.7, 1.2); this.onGround = false;
          this.t = R.range(0.6, 1.4);
        }
      }
      const r = this.physics(G, dt);
      if (r.hy > 0 && this.def.style === 'frog') G.dust(this.cx, this.y + this.h, 3);
    },
    flyer(G, dt, d) {
      const near = this.distP(G) < 330;
      let tx = this.homeX + Math.sin(this.anim * 0.8) * 50, ty = this.homeY + Math.sin(this.anim * 1.7) * 20;
      if (near) { tx = G.player.cx - this.w / 2; ty = G.player.cy - this.h / 2 - 10; }
      const sp = near ? d.spd : d.spd * 0.6;
      this.vx = LF.approach(this.vx, LF.clamp((tx - this.x) * 2, -sp, sp), 300 * dt);
      this.vy = LF.approach(this.vy, LF.clamp((ty - this.y) * 2, -sp, sp) + Math.sin(this.anim * 4) * 30, 300 * dt);
      this.face = this.vx < 0 ? -1 : 1;
      this.physics(G, dt, false);
    },
    diver(G, dt, d) {
      if (this.state === 'windup') { this.vx *= 0.9; this.vy = -40; if (this.t <= 0) { this.state = 'dive'; this.t = 0.85; const a = Math.atan2(G.player.cy - this.cy, G.player.cx - this.cx); this.vx = Math.cos(a) * d.spd * 4.2; this.vy = Math.sin(a) * d.spd * 4.2; G.sfx('dash'); } }
      else if (this.state === 'dive') { const r = this.physics(G, dt, false); if (this.t <= 0 || r.hx || r.hy) { this.state = 'return'; this.t = 2; } return; }
      else if (this.state === 'return') {
        this.vx = LF.clamp((this.homeX - this.x) * 2, -d.spd, d.spd); this.vy = LF.clamp((this.homeY - this.y) * 2, -d.spd, d.spd);
        if (Math.abs(this.homeX - this.x) < 10 && Math.abs(this.homeY - this.y) < 10 || this.t <= 0) { this.state = 'idle'; this.cool = 1.2; }
      } else {
        this.vx = Math.sin(this.anim * 1.3) * 30; this.vy = Math.sin(this.anim * 2.1) * 25;
        if (this.cool <= 0 && this.distP(G) < 300) { this.state = 'windup'; this.t = 0.42; this.face = this.toward(G); }
      }
      this.face = this.vx < -5 ? -1 : this.vx > 5 ? 1 : this.face;
      this.physics(G, dt, false);
    },
    shooterfly(G, dt, d) {
      const p = G.player, dx = this.cx - p.cx, dy = this.cy - p.cy, dd = Math.hypot(dx, dy) || 1;
      let tx = this.homeX, ty = this.homeY;
      if (dd < 450) { const want = 210; tx = p.cx + dx / dd * want - this.w / 2; ty = p.cy - 100 + Math.sin(this.anim) * 30; }
      this.vx = LF.approach(this.vx, LF.clamp((tx - this.x) * 1.5, -d.spd, d.spd), 260 * dt);
      this.vy = LF.approach(this.vy, LF.clamp((ty - this.y) * 1.5, -d.spd, d.spd), 260 * dt);
      this.face = this.toward(G);
      if (dd < 420 && this.cool <= 0) { this.cool = 2.0; this.aimShot(G, 270, { r: 7, kind: 'orb' }); G.sfx('shot'); }
      this.physics(G, dt, false);
    },
    turret(G, dt, d) {
      this.face = this.toward(G); this.vx = 0;
      if (this.distP(G) < 560 && this.cool <= 0) {
        this.cool = d.rate; this.fireT = 0.25;
        if (d.shot === 'aim') { this.aimShot(G, 300, { r: 7, kind: 'orb', oy: -8 }); }
        else if (d.shot === 'burst') { for (let i = -2; i <= 2; i++) this.aimShot(G, 240, { r: 6, kind: 'orb', spread: i * 0.22 }); }
        else { const p = G.player, tt = 1.0, gr = 900; const vx = (p.cx - this.cx) / tt, vy = (p.cy - this.cy - 0.5 * gr * tt * tt) / tt; this.shoot(G, vx, vy, { r: 8, grav: gr, kind: 'glob', oy: -10 }); }
        G.sfx('shot');
      }
      this.fireT = (this.fireT || 0) - dt;
      this.physics(G, dt);
    },
    teleporter(G, dt, d) {
      if (this.state === 'idle') {
        this.alpha = Math.min(1, this.alpha + dt * 3); this.vx = 0; this.vy = Math.sin(this.anim * 3) * 20;
        if (this.t <= 0) { this.state = 'cast'; this.t = 0.5; }
      } else if (this.state === 'cast') {
        if (this.t <= 0) { for (let i = -1; i <= 1; i++) this.aimShot(G, 250, { r: 6, kind: 'glyph', spread: i * 0.25 }); G.sfx('zap'); this.state = 'fade'; this.t = 0.4; }
      } else if (this.state === 'fade') { this.alpha = Math.max(0, this.t / 0.4); if (this.t <= 0) { this.state = 'faded'; this.t = 0.5; } }
      else if (this.state === 'faded') {
        if (this.t <= 0) {
          for (let k = 0; k < 20; k++) {
            const nx = G.player.cx + R.range(-280, 280), ny = G.player.cy + R.range(-200, 40);
            const tx = Math.floor(nx / T), ty = Math.floor(ny / T);
            if (Math.abs(nx - G.player.cx) > 120 && !solidT(G, tx, ty) && !solidT(G, tx + 1, ty) && !solidT(G, tx, ty + 1) && tx > 1 && tx < G.room.W - 2 && ty > 1 && ty < G.room.H - 2) { this.x = nx - this.w / 2; this.y = ny - this.h / 2; break; }
          }
          this.state = 'idle'; this.t = 1.3; this.alpha = 0;
        }
      }
      this.physics(G, dt, false);
    },
    heavy(G, dt, d) {
      if (this.state === 'windup') { this.vx = 0; if (this.t <= 0) { this.state = 'smash'; this.t = 0.5; G.shake(8, 0.25); G.sfx('slam');
        for (const s of [-1, 1]) G.projectiles.push(new Projectile(this.cx + s * this.w / 2, this.y + this.h - 14, s * 330, 0, { owner: 'enemy', dmg: d.dmg, kind: 'wave', r: 12, life: 1.4, col: d.col2, ground: true }));
        G.dust(this.cx, this.y + this.h, 14); } }
      else if (this.state === 'smash') { if (this.t <= 0) { this.state = 'idle'; this.cool = 2.2; } }
      else {
        if (this.sees(G, 300, 90)) this.face = this.toward(G);
        if (this.wallAhead(G, this.face) || !this.groundAhead(G, this.face)) { this.face *= -1; }
        this.vx = this.face * d.spd;
        if (this.cool <= 0 && this.sees(G, 150, 80)) { this.state = 'windup'; this.t = 0.6; }
      }
      this.physics(G, dt);
    },
    shell(G, dt, d) {
      if (this.state === 'shell') { this.vx = 0; if (this.t <= 0) { this.state = 'idle'; this.t = 1.6; this.cool = 1.6; } }
      else {
        if (this.wallAhead(G, this.face) || !this.groundAhead(G, this.face)) this.face *= -1;
        this.vx = this.face * d.spd;
        if (this.cool <= 0 && this.sees(G, 140, 60)) { this.state = 'shell'; this.t = 1.8; G.sfx('clank'); }
      }
      this.physics(G, dt);
    },
    ghost(G, dt, d) {
      const p = G.player; this.t -= 0;
      if (this.state === 'faded') { this.alpha = Math.max(0, this.alpha - dt * 3); if (this.t <= 0) { this.state = 'idle'; this.t = R.range(3, 5); this.x = p.cx + R.pick([-1, 1]) * R.range(160, 260); this.y = p.cy - R.range(40, 140); } }
      else {
        this.alpha = Math.min(0.9, this.alpha + dt * 2);
        const a = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        this.vx = LF.approach(this.vx, Math.cos(a) * d.spd, 120 * dt); this.vy = LF.approach(this.vy, Math.sin(a) * d.spd + Math.sin(this.anim * 3) * 20, 120 * dt);
        this.x += this.vx * dt + this.knock * dt; this.y += this.vy * dt; this.knock = LF.approach(this.knock, 0, 1600 * dt);
        this.face = this.vx < 0 ? -1 : 1;
        if (this.t <= 0 && this.distP(G) > 80) { this.state = 'faded'; this.t = 1.0; }
      }
    },
    exploder(G, dt, d) {
      const p = G.player;
      if (this.state === 'swell') { this.vx *= 0.9; this.vy *= 0.9; this.swell = 1 - this.t / 0.7; if (this.t <= 0) { this.die(G); } }
      else {
        const near = this.distP(G) < 360;
        const tx = near ? p.cx : this.homeX + Math.sin(this.anim) * 40, ty = near ? p.cy - 10 : this.homeY + Math.sin(this.anim * 1.4) * 20;
        const a = Math.atan2(ty - this.cy, tx - this.cx);
        this.vx = LF.approach(this.vx, Math.cos(a) * d.spd, 200 * dt); this.vy = LF.approach(this.vy, Math.sin(a) * d.spd, 200 * dt);
        if (this.distP(G) < 75) { this.state = 'swell'; this.t = 0.7; }
      }
      this.physics(G, dt, false);
    },
    burstSpores(G) {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; G.projectiles.push(new Projectile(this.cx, this.cy, Math.cos(a) * 220, Math.sin(a) * 220, { owner: 'enemy', dmg: 1, r: 7, kind: 'spore', life: 0.9, col: this.def.col2 })); }
      G.sfx('boom'); G.burst(this.cx, this.cy, 30, { col: this.def.col2, spd: 240, life: 0.8, size: 3, glow: true });
    },
    ambusher(G, dt, d) {
      if (this.state === 'idle') {
        this.hidden = true; if (Math.random() < 0.05) G.particle(this.cx + R.range(-15, 15), this.y + this.h, { vx: 0, vy: -40, life: 0.4, col: '#554', size: 2 });
        if (this.cool <= 0 && this.sees(G, 110, 90)) { this.state = 'emerge'; this.t = 0.35; G.sfx('break'); G.shake(4, 0.2); }
      } else if (this.state === 'emerge') { this.hidden = false; this.rise = 1 - this.t / 0.35; if (this.t <= 0) { this.state = 'bite'; this.t = 0.5; G.dust(this.cx, this.y + this.h, 10); } }
      else if (this.state === 'bite') { this.rise = 1; if (this.t <= 0) { this.state = 'out'; this.t = 1.4; } }
      else if (this.state === 'out') { if (this.t <= 0) { this.state = 'idle'; this.cool = 2.0; this.rise = 0; } }
      this.vx = 0; this.physics(G, dt);
    },
    caster(G, dt, d) {
      if (this.state === 'cast') { this.vx = 0; if (this.t <= 0) {
        this.state = 'idle'; this.cool = 2.6;
        for (let i = 0; i < 2; i++) { this.aimShot(G, 170, { r: 9, kind: 'orb', homing: 1.6, life: 3, spread: (i - 0.5) * 0.6, oy: -10 }); }
        G.sfx('zap');
      } }
      else {
        if (this.wallAhead(G, this.face) || !this.groundAhead(G, this.face)) this.face *= -1;
        this.vx = this.face * d.spd;
        if (this.cool <= 0 && this.sees(G, 380, 160)) { this.state = 'cast'; this.t = 0.6; this.face = this.toward(G); }
      }
      this.physics(G, dt);
    },
  };
  LF.Enemy = Enemy; LF.AI = AI;

  // ---------------------------------------------------------------- Projectiles
  class Projectile {
    constructor(x, y, vx, vy, o = {}) {
      this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.r = o.r || 6; this.dmg = o.dmg || 1; this.owner = o.owner || 'enemy';
      this.life = o.life || 4; this.grav = o.grav || 0; this.kind = o.kind || 'orb'; this.col = o.col || '#fff'; this.pierce = !!o.pierce;
      this.homing = o.homing || 0; this.hits = new Set(); this.dead = false; this.ground = !!o.ground; this.t = 0; this.breaks = o.breaks; this.noWall = !!o.noWall;
    }
    update(G, dt) {
      this.t += dt; this.life -= dt; if (this.life <= 0) { this.dead = true; return; }
      if (this.homing && this.owner === 'enemy') {
        const a = Math.atan2(G.player.cy - this.y, G.player.cx - this.x), sp = Math.hypot(this.vx, this.vy);
        const cur = Math.atan2(this.vy, this.vx); let da = a - cur; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const na = cur + LF.clamp(da, -this.homing * dt, this.homing * dt); this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
      this.vy += this.grav * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      const tx = Math.floor(this.x / T), ty = Math.floor(this.y / T);
      if (this.ground) {
        const below = G.room.tile(tx, Math.floor((this.y + 20) / T));
        if (below === TL.E || LF.isLiquid(below)) { this.dead = true; }
        if (Math.random() < 0.6) G.particle(this.x, this.y + 10, { vx: R.range(-40, 40), vy: -R.range(60, 160), life: 0.4, col: this.col, size: 3, grav: 400 });
      }
      const v = G.room.tile(tx, ty);
      if (!this.noWall && v !== TL.E && v !== TL.P && !LF.isLiquid(v) && v !== TL.SPK && !(v === TL.VE)) {
        if (this.breaks === 'seal' && v === TL.SE) G.breakCluster(tx, ty);
        this.dead = true; G.spark(this.x, this.y, this.col); if (this.owner === 'player') G.sfx('hit', 1.5);
      }
      if (this.owner === 'player' && Math.random() < 0.9) G.particle(this.x, this.y, { vx: -this.vx * 0.1 + R.range(-30, 30), vy: R.range(-30, 30), life: 0.35, col: R() < 0.5 ? '#ffb347' : '#fff1b0', size: R.range(2, 5), glow: true });
      if (this.x < -50 || this.y < -200 || this.x > G.room.W * T + 50 || this.y > G.room.H * T + 50) this.dead = true;
    }
  }
  LF.Projectile = Projectile;

  // ---------------------------------------------------------------- Flames (damaging areas)
  class Flame {
    constructor(x, y, owner, life = 1.2) { this.x = x; this.y = y; this.w = 22; this.h = 24; this.owner = owner; this.life = this.max = life; this.dead = false; this.hits = new Set(); this.tick = 0; }
    update(G, dt) {
      this.life -= dt; if (this.life <= 0) this.dead = true; this.tick -= dt;
      if (this.tick <= 0) { this.tick = 0.35; this.hits.clear(); }
      if (Math.random() < 0.5) G.particle(this.x + R.range(-8, 8), this.y, { vx: R.range(-10, 10), vy: -R.range(40, 100), life: 0.4, col: R() < 0.5 ? '#ff8c3a' : '#ffd36a', size: R.range(2, 4), glow: true });
    }
    box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  }
  LF.Flame = Flame;

  // ---------------------------------------------------------------- Glimmer coins
  class Glim {
    constructor(x, y, v) { this.x = x; this.y = y; this.v = v; this.vx = R.range(-160, 160); this.vy = -R.range(250, 480); this.w = 10; this.h = 10; this.dead = false; this.t = 0; this.spin = R() * 6; }
    update(G, dt) {
      this.t += dt; this.spin += dt * 8;
      const p = G.player, mag = G.charm('magpie') ? 320 : 70, dx = p.cx - this.x, dy = p.cy - this.y, d = Math.hypot(dx, dy);
      if (this.t > 0.35 && d < mag) { this.vx = LF.lerp(this.vx, dx / d * 520, dt * 6); this.vy = LF.lerp(this.vy, dy / d * 520, dt * 6); this.x += this.vx * dt; this.y += this.vy * dt; }
      else {
        this.vy = Math.min(this.vy + 1600 * dt, 700);
        const b = { x: this.x - 5, y: this.y - 5, w: 10, h: 10 };
        const r = LF.moveBody(G, b, this.vx * dt, this.vy * dt); this.x = b.x + 5; this.y = b.y + 5;
        if (r.hy > 0) { this.vy = Math.abs(this.vy) > 120 ? -this.vy * 0.35 : 0; this.vx *= 0.6; if (Math.abs(this.vy) > 40) G.sfx('coin'); }
        if (r.hx) this.vx *= -0.5;
      }
      if (d < 26 && this.t > 0.25) { this.dead = true; G.addGlim(this.v); G.sfx('coin'); G.particle(this.x, this.y, { vx: 0, vy: -40, life: 0.4, col: '#fff6c8', size: 3, glow: true }); }
      if (this.t > 40) this.dead = true;
    }
  }
  LF.Glim = Glim;

  // ---------------------------------------------------------------- World items
  class Item {
    constructor(it) { Object.assign(this, it); this.at = R() * 6; this.dead = false; this.w = 28; this.h = 28; }
    update(G, dt) {
      this.at += dt;
      const p = G.player;
      if (Math.abs(p.cx - this.x) < 26 && Math.abs(p.cy - this.y) < 34) { this.dead = true; G.collectItem(this); }
      if (Math.random() < 0.15) G.particle(this.x + R.range(-10, 10), this.y + R.range(-10, 10), { vx: 0, vy: -30, life: 0.8, col: '#fff3c4', size: 2, glow: true });
    }
  }
  LF.Item = Item;

  // ---------------------------------------------------------------- Shade (death marker)
  class Shade {
    constructor(x, y, amount) { this.x = x; this.y = y; this.w = 26; this.h = 36; this.amount = amount; this.hp = 3; this.dead = false; this.t = 0; this.flash = 0; this.vx = 0; this.vy = 0; this.inv = 0; this.cool = 2; this.face = 1; }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    update(G, dt) {
      this.t += dt; this.flash -= dt; this.inv -= dt; this.cool -= dt;
      const p = G.player, d = LF.dist(this.cx, this.cy, p.cx, p.cy);
      if (d < 420) {
        const a = Math.atan2(p.cy - this.cy, p.cx - this.cx), sp = this.cool < 0 && this.cool > -0.5 ? 420 : 70;
        if (this.cool < -0.5) this.cool = 2.2;
        this.vx = LF.approach(this.vx, Math.cos(a) * sp, 900 * dt); this.vy = LF.approach(this.vy, Math.sin(a) * sp, 900 * dt);
      } else { this.vx *= 0.95; this.vy = Math.sin(this.t * 2) * 20; }
      this.face = this.vx < 0 ? -1 : 1;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (Math.random() < 0.4) G.particle(this.cx + R.range(-10, 10), this.cy + R.range(-10, 14), { vx: 0, vy: -30, life: 0.7, col: '#2a2236', size: 4, alpha: 0.6 });
    }
    hurt(G, dmg, dirX) {
      if (this.inv > 0) return false;
      this.hp--; this.flash = 0.15; this.inv = 0.25; this.vx = dirX * 300; G.hitFx(this.cx, this.cy, dirX, '#a99cff');
      if (this.hp <= 0) { this.dead = true; G.recoverShade(this); }
      return true;
    }
    contactBox() { return { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 8 }; }
  }
  LF.Shade = Shade;

  // ---------------------------------------------------------------- Companion wisp (Spirit Kin charm)
  class Kin {
    constructor(p) { this.x = p.cx; this.y = p.y - 20; this.t = 0; this.cool = 1; }
    update(G, dt) {
      const p = G.player; this.t += dt; this.cool -= dt;
      const tx = p.cx - p.face * 28 + Math.sin(this.t * 2) * 8, ty = p.y - 18 + Math.sin(this.t * 3) * 6;
      this.x = LF.lerp(this.x, tx, dt * 5); this.y = LF.lerp(this.y, ty, dt * 5);
      if (this.cool <= 0) {
        let best = null, bd = 380;
        for (const e of G.enemies) { if (e.dead || e.hidden || e.state === 'faded') continue; const d = LF.dist(this.x, this.y, e.cx, e.cy); if (d < bd) { bd = d; best = e; } }
        if (G.boss && !G.boss.dead && G.boss.active) { const d = LF.dist(this.x, this.y, G.boss.cx, G.boss.cy); if (d < bd) best = G.boss; }
        if (best) { const a = Math.atan2(best.cy - this.y, best.cx - this.x); G.projectiles.push(new Projectile(this.x, this.y, Math.cos(a) * 520, Math.sin(a) * 520, { owner: 'player', dmg: 4, r: 4, kind: 'spark', life: 1, col: '#bff' })); this.cool = 1.1; }
        else this.cool = 0.3;
      }
    }
  }
  LF.Kin = Kin;
})();
