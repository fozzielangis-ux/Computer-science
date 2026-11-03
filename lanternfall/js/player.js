// Lanternfall — the Wick (player): movement, combat, abilities
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const T = LF.T, TL = LF.TILE;
  const K = LF.PK = {
    RUN: 290, ACC_G: 3400, ACC_A: 2500, DEC_G: 4000, GRAV: 2600, GRAV_FALL: 3000, MAXFALL: 920,
    JUMP: 820, DJUMP: 740, WALLJ_X: 360, WALLJ_Y: 780, DASH_V: 820, DASH_T: 0.17, DASH_CD: 0.42,
    CLIMB: 160, SLIDE: 130, COYOTE: 0.1, BUFFER: 0.13, BOOST: 1100,
  };

  class Player {
    constructor(x, y) {
      this.w = 20; this.h = 40; this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.face = 1;
      this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false; this.airJumps = 1; this.airDash = 1;
      this.dashT = 0; this.dashCD = 0; this.dashDir = 1; this.veiling = false;
      this.wall = 0; this.wallLock = 0; this.climbing = false; this.wallGrace = 0;
      this.atkT = 0; this.atkCD = 0; this.combo = 0; this.comboT = 0; this.atkDir = 'side'; this.swing = 0; this.atkHits = new Set();
      this.chargeT = 0; this.charged = false; this.cleaveT = 0;
      this.slam = false; this.castCD = 0; this.castT = 0; this.focusT = 0; this.focusing = false;
      this.hurtT = 0; this.inv = 0; this.recoilT = 0; this.dropT = 0;
      this.dead = false; this.inWater = false; this.waterKind = 0; this.sitting = false; this.frozen = 0;
      this.runT = 0; this.squash = 1; this.landT = 0; this.blink = 0; this.trailT = 0;
      this.cape = []; for (let i = 0; i < 6; i++) this.cape.push({ x: x + 10, y: y + 14 + i * 4, px: x + 10, py: y + 14 + i * 4 });
      this.safe = { x, y }; this.safeT = 0;
      this.stepT = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get bottom() { return this.y + this.h; }

    // ---------------------------------------------------------- collision
    solidAt(G, tx, ty, forY, prevBottom) {
      const v = G.room.tile(tx, ty);
      switch (v) {
        case TL.E: case TL.WATER: case TL.GLOOM: case TL.LAVA: case TL.SPK: return false;
        case TL.P: return forY > 0 && this.dropT <= 0 && prevBottom <= ty * T + 0.5;
        case TL.VE: return !(this.veiling && this.dashT > 0);
        case TL.CU: return !G.room.crumbled(tx, ty) && forY > 0 && this.dropT <= 0 && prevBottom <= ty * T + 0.5;
        default: return true;
      }
    }
    collides(G, forY, prevBottom) {
      const x0 = Math.floor(this.x / T), x1 = Math.floor((this.x + this.w - 0.01) / T);
      const y0 = Math.floor(this.y / T), y1 = Math.floor((this.y + this.h - 0.01) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const v = G.room.tile(tx, ty);
        if (v === TL.P || v === TL.CU) { if (forY > 0 && ty === y1 && this.solidAt(G, tx, ty, forY, prevBottom)) return { tx, ty }; continue; }
        if (this.solidAt(G, tx, ty, forY, prevBottom)) return { tx, ty };
      }
      return null;
    }
    moveX(G, dx) {
      const steps = Math.ceil(Math.abs(dx) / 10) || 1, s = dx / steps;
      for (let i = 0; i < steps; i++) {
        this.x += s;
        const c = this.collides(G, 0, this.bottom);
        if (c) { this.x = s > 0 ? c.tx * T - this.w : (c.tx + 1) * T; return s > 0 ? 1 : -1; }
      }
      return 0;
    }
    moveY(G, dy) {
      const steps = Math.ceil(Math.abs(dy) / 10) || 1, s = dy / steps;
      for (let i = 0; i < steps; i++) {
        const pb = this.bottom; this.y += s;
        const c = this.collides(G, s, pb);
        if (c) { this.y = s > 0 ? c.ty * T - this.h : (c.ty + 1) * T; return s > 0 ? 1 : -1; }
      }
      return 0;
    }
    groundCheck(G) {
      const pb = this.bottom; this.y += 1; const c = this.collides(G, 1, pb); this.y -= 1; return c;
    }
    wallAt(G, side) {
      const tx = Math.floor((side > 0 ? this.x + this.w + 1 : this.x - 1) / T);
      let n = 0;
      for (let ty = Math.floor((this.y + 6) / T); ty <= Math.floor((this.y + this.h - 6) / T); ty++) {
        const v = G.room.tile(tx, ty);
        if (v === TL.S || v === TL.BR || v === TL.SL || v === TL.CR || v === TL.SE || v === TL.KY) n++;
        if (v === TL.TH) return -1;
      }
      return n > 0 ? 1 : 0;
    }

    // ---------------------------------------------------------- update
    update(G, dt) {
      const I = G.input, st = G.stats;
      if (this.dead) return;
      if (this.frozen > 0) { this.frozen -= dt; this.vx = 0; this.vy = 0; this.updateCape(dt); return; }
      const ctl = this.hurtT <= 0 && !G.lockInput;
      const L = ctl && I.held('left'), R = ctl && I.held('right'), U = ctl && I.held('up'), D = ctl && I.held('down');
      let dir = (R ? 1 : 0) - (L ? 1 : 0);
      if (this.wallLock > 0) { this.wallLock -= dt; dir = 0; }
      this.hurtT -= dt; this.inv -= dt; this.dashCD -= dt; this.castCD -= dt; this.atkCD -= dt; this.comboT -= dt;
      this.coyote -= dt; this.jumpBuf -= dt; this.recoilT -= dt; this.dropT -= dt; this.landT -= dt; this.castT -= dt; this.cleaveT -= dt;
      if (ctl && I.hit('jump')) this.jumpBuf = K.BUFFER;

      // sitting on a bench
      if (this.sitting) {
        this.vx = 0; this.vy = 0; this.updateCape(dt);
        if (ctl && (I.hit('jump') || L || R || I.hit('down'))) { this.sitting = false; this.jumpBuf = 0; G.standUp(); }
        return;
      }

      // water
      const midTile = G.room.tile(Math.floor(this.cx / T), Math.floor((this.y + this.h * 0.45) / T));
      const wasWater = this.inWater;
      this.inWater = midTile === TL.WATER || (midTile === TL.GLOOM && G.has('pearl'));
      if (this.inWater !== wasWater && Math.abs(this.vy) > 100) { G.splash(this.cx, this.y + this.h * 0.4); }

      // focus (heal)
      const canFocus = ctl && I.held('heal') && this.onGround && !this.atkT && this.dashT <= 0 && G.save.hp < G.maxHp() && G.save.energy >= 33;
      if (canFocus && dir === 0) {
        if (!this.focusing) { this.focusing = true; this.focusT = 0; G.sfx('focus'); }
        this.focusT += dt;
        if (this.focusT >= st.focusTime) {
          this.focusT = 0; G.save.energy -= 33; G.heal(st.focusHeal); G.sfx('heal');
          G.burst(this.cx, this.cy, 24, { col: '#ffe9b0', spd: 160, life: 0.7, size: 3, glow: true });
        } else if (Math.random() < 0.6) G.particle(this.cx + LF.R.range(-30, 30), this.cy + LF.R.range(-10, 30), { vx: 0, vy: -70, life: 0.6, col: '#ffd890', size: 2, glow: true, toward: this });
        this.vx = LF.approach(this.vx, 0, K.DEC_G * dt);
        this.physics(G, dt, 0); this.updateCape(dt); return;
      } else if (this.focusing) { this.focusing = false; this.focusT = 0; }

      // dashing
      if (this.dashT > 0) {
        this.dashT -= dt;
        this.vx = this.dashDir * K.DASH_V; this.vy = 0;
        if (Math.random() < 0.9) G.particle(this.cx - this.dashDir * 10, this.cy + LF.R.range(-12, 12), { vx: -this.dashDir * 60, vy: 0, life: 0.3, col: this.veiling ? '#d8b8ff' : '#2a2433', size: LF.R.range(2, 4), alpha: 0.7 });
        if (G.charm('ember_trail') && (this.trailT -= dt) <= 0) { this.trailT = 0.035; G.spawnFlame(this.cx, this.bottom - 6, 'player'); }
        const hit = this.moveX(G, this.vx * dt);
        if (hit) this.dashT = 0;
        if (this.dashT <= 0) { this.vx = this.dashDir * K.RUN * 0.8; this.veiling = false; }
        this.groundState(G);
        this.updateCape(dt); return;
      }

      // slam
      if (this.slam) {
        this.vx = 0; this.vy = 1500;
        G.particle(this.cx + LF.R.range(-8, 8), this.y, { vx: 0, vy: -100, life: 0.25, col: '#cfc6b8', size: 3 });
        const prevY = this.y;
        const hit = this.moveY(G, this.vy * dt);
        if (hit > 0) {
          // break slam floors beneath
          const ty = Math.floor((this.bottom + 2) / T);
          let broke = false;
          for (let tx = Math.floor((this.x - 20) / T); tx <= Math.floor((this.x + this.w + 20) / T); tx++) {
            const v = G.room.tile(tx, ty);
            if (v === TL.SL || v === TL.BR) { G.breakCluster(tx, ty); broke = true; }
          }
          if (broke) { this.y = prevY; G.shake(10, 0.3); return; }
          this.slam = false; this.vy = 0; this.inv = Math.max(this.inv, 0.15);
          G.slamImpact(this.cx, this.bottom, st.dmg * 2.2);
        } else if (this.inWater) this.slam = false;
        this.updateCape(dt); return;
      }

      // horizontal
      let maxV = K.RUN * st.speed * (this.chargeT > 0.15 ? 0.55 : 1) * (this.inWater ? 0.72 : 1);
      if (this.recoilT > 0) { /* keep recoil velocity */ }
      else if (dir !== 0) {
        const acc = this.onGround ? K.ACC_G : K.ACC_A;
        this.vx = LF.approach(this.vx, dir * maxV, acc * dt);
        if (!this.atkT || this.atkDir !== 'side') this.face = dir;
      } else this.vx = LF.approach(this.vx, 0, (this.onGround ? K.DEC_G : K.ACC_A * 0.9) * dt);

      // walls (with the claws, holding up against a wall starts a climb from the ground)
      if (G.has('claws') && this.onGround && U && dir !== 0 && this.wallAt(G, dir) > 0 && !this.inWater) { this.onGround = false; this.vy = -K.CLIMB; this.y -= 2; this.wallGrace = 0.12; this.lastWall = dir; }
      this.wall = 0;
      if (G.has('claws') && !this.onGround && !this.inWater) {
        for (const s of [-1, 1]) {
          const w = this.wallAt(G, s);
          if (w > 0 && (dir === s || (this.wallGrace > 0 && this.lastWall === s))) { this.wall = s; }
        }
      }
      if (this.wall) {
        this.wallGrace = 0.12; this.lastWall = this.wall; this.airDash = 1; this.airJumps = 1; this.face = -this.wall;
        if (U) { this.vy = -K.CLIMB; this.climbing = true; }
        else if (D) { this.vy = Math.min(this.vy + K.GRAV * dt, 420); this.climbing = false; }
        else { this.vy = Math.min(this.vy + K.GRAV * dt, K.SLIDE); this.climbing = false; }
        if (Math.random() < 0.2 && this.vy > 50) G.particle(this.wall > 0 ? this.x + this.w : this.x, this.y + 10, { vx: 0, vy: 30, life: 0.3, col: '#8d8778', size: 2 });
      } else {
        if (this.climbing) { this.climbing = false; if (U && this.lastWall) { this.vy = -360; this.vx = this.lastWall * 160; } }
        this.wallGrace -= dt;
      }

      // jump
      if (this.jumpBuf > 0) {
        if (this.inWater) {
          this.jumpBuf = 0;
          const surface = G.room.tile(Math.floor(this.cx / T), Math.floor((this.y - 4) / T));
          this.vy = (surface === TL.WATER || surface === TL.GLOOM) ? -340 : -K.JUMP * 0.85;
          G.sfx('splash');
        } else if (this.onGround || this.coyote > 0) {
          this.vy = -K.JUMP; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false; this.squash = 1.25;
          G.sfx('jump'); G.dust(this.cx, this.bottom, 6);
        } else if (this.wall || this.wallGrace > 0 && G.has('claws') && this.lastWall) {
          const s = this.wall || this.lastWall;
          this.vy = -K.WALLJ_Y; this.vx = -s * K.WALLJ_X; this.wallLock = 0.13; this.face = -s; this.wall = 0; this.wallGrace = 0;
          this.jumpBuf = 0; this.jumpCut = false; G.sfx('jump'); G.dust(s > 0 ? this.x + this.w : this.x, this.cy, 6);
        } else if (G.has('wings') && this.airJumps > 0) {
          this.airJumps--; this.vy = -K.DJUMP; this.jumpBuf = 0; this.jumpCut = false; G.sfx('djump');
          G.wingFx(this);
        }
      }
      if (this.vy < 0 && !this.jumpCut && ctl && !I.held('jump') && !this.inWater && this.recoilT <= 0) { this.vy *= 0.45; this.jumpCut = true; }

      // dash / slam trigger
      if (ctl && I.hit('dash') && G.has('dash')) {
        if (D && !this.onGround && G.has('slam') && !this.inWater) { this.slam = true; this.atkT = 0; G.sfx('dash'); this.updateCape(dt); return; }
        if (this.dashCD <= 0 && (this.onGround || this.airDash > 0 || this.wall)) {
          this.dashT = K.DASH_T; this.dashCD = K.DASH_CD * (G.charm('moonlit') ? 0.5 : 1);
          this.dashDir = this.wall ? -this.wall : (dir || this.face); this.face = this.dashDir;
          if (!this.onGround && !this.wall) this.airDash--;
          this.veiling = G.has('veil'); this.atkT = 0; this.chargeT = 0;
          G.sfx(this.veiling ? 'veil' : 'dash');
          this.wall = 0; this.updateCape(dt); return;
        }
      }

      // attack
      if (ctl && I.hit('attack') && this.atkCD <= 0) {
        this.swing++; this.atkHits.clear();
        if (U) this.atkDir = 'up';
        else if (D && !this.onGround) this.atkDir = 'down';
        else this.atkDir = 'side';
        if (this.wall) { this.atkDir = 'side'; this.face = -this.wall; }
        this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0;
        this.comboT = 0.5;
        this.atkT = 0.22 * st.atkSpeed; this.atkCD = 0.30 * st.atkSpeed;
        G.sfx(this.combo === 2 ? 'slash2' : 'slash');
        this.chargeT = 0.001;
      }
      if (this.atkT > 0) {
        this.atkT -= dt;
        const total = 0.22 * st.atkSpeed, el = total - this.atkT;
        if (el > 0.02 && el < 0.15) G.playerAttack(this, this.attackBox(st), this.atkDir, this.combo === 2 ? 1.25 : 1);
        if (this.atkT <= 0) this.atkT = 0;
      }
      // charge (Lumen Cleave)
      if (this.chargeT > 0) {
        if (ctl && I.held('attack') && G.has('charge')) {
          const before = this.chargeT; this.chargeT += dt;
          if (before < 0.75 && this.chargeT >= 0.75) { G.sfx('charge'); this.charged = true; }
          if (this.chargeT > 0.25 && Math.random() < 0.5) G.particle(this.cx + this.face * 18 + LF.R.range(-20, 20), this.cy + LF.R.range(-20, 20), { vx: 0, vy: 0, life: 0.3, col: this.charged ? '#ffffff' : '#ffe2a0', size: 2, glow: true, toward: this });
        } else {
          if (this.charged) { this.cleaveT = 0.25; this.swing++; this.atkHits.clear(); G.sfx('cleave'); G.shake(6, 0.15); }
          this.chargeT = 0; this.charged = false;
        }
      }
      if (this.cleaveT > 0) {
        G.playerAttack(this, { x: this.cx - 95, y: this.cy - 50, w: 190, h: 90 }, 'cleave', 2.6);
      }

      // spells
      if (ctl && I.hit('spell') && this.castCD <= 0) {
        if (U && G.has('nova') && G.save.energy >= 33) {
          G.save.energy -= 33; this.castCD = 0.45; this.castT = 0.3; G.castNova(this); this.vy = Math.min(this.vy, 0) * 0.3;
        } else if (G.has('bolt') && G.save.energy >= 33) {
          G.save.energy -= 33; this.castCD = 0.42; this.castT = 0.22; G.castBolt(this);
          if (!G.charm('steady')) { this.vx = -this.face * 200; this.recoilT = 0.08; }
        } else if (G.has('bolt')) G.sfx('uiNo');
      }

      // vertical physics
      let g = this.vy < 0 ? K.GRAV : K.GRAV_FALL;
      if (this.castT > 0 && this.vy > 0) g *= 0.3;
      let maxFall = K.MAXFALL;
      if (this.inWater) { g = 520; maxFall = 220; if (U) this.vy = LF.approach(this.vy, -160, 900 * dt); if (D) maxFall = 360; }
      if (G.charm('featherfall') && ctl && I.held('jump') && this.vy > 0 && !this.inWater) maxFall = 150;
      if (!this.wall) this.vy = Math.min(this.vy + g * dt, maxFall);
      this.physics(G, dt, dir);
      this.updateCape(dt);
      this.blink = Math.max(0, this.blink - dt);
    }

    physics(G, dt, dir) {
      const hx = this.moveX(G, this.vx * dt);
      if (hx) {
        if (this.recoilT <= 0) this.vx = 0;
        // swimming: pushing against a low lip at the surface hops you out
        if (this.inWater && dir === hx) { const tx = Math.floor((hx > 0 ? this.x + this.w + 2 : this.x - 2) / T), ty = Math.floor((this.y - 2) / T); if (G.room.tile(tx, ty) === TL.E && G.room.tile(tx, ty - 1) === TL.E) this.vy = Math.min(this.vy, -560); }
      }
      // drop through one-way
      if (this.onGround && G.input.held('down') && G.input.hit('jump') && this.standingOnPlatform(G)) { this.dropT = 0.2; this.jumpBuf = 0; this.vy = 60; }
      const vyBefore = this.vy;
      const hy = this.moveY(G, this.vy * dt);
      if (hy > 0) {
        if (!this.onGround && vyBefore > 500) { this.squash = 0.7; G.sfx('land'); G.dust(this.cx, this.bottom, vyBefore > 800 ? 10 : 5); this.landT = 0.12; }
        this.vy = 0;
      } else if (hy < 0) { this.vy = Math.max(this.vy, 0) + 30; }
      this.groundState(G);
      // footsteps
      if (this.onGround && Math.abs(this.vx) > 60) { this.runT += dt * Math.abs(this.vx) / 30; if ((this.stepT -= dt) <= 0) { this.stepT = 0.24; G.sfx('step'); } } else this.runT = 0;
      this.squash = LF.lerp(this.squash, 1, Math.min(1, dt * 12));
    }
    standingOnPlatform(G) {
      const ty = Math.floor((this.bottom + 1) / T);
      for (let tx = Math.floor(this.x / T); tx <= Math.floor((this.x + this.w - 1) / T); tx++) {
        const v = G.room.tile(tx, ty); if (v !== TL.P && v !== TL.E) return false;
      }
      return true;
    }
    groundState(G) {
      const was = this.onGround;
      const c = this.vy >= 0 ? this.groundCheck(G) : null;
      this.onGround = !!c;
      if (this.onGround) {
        this.coyote = K.COYOTE; this.airDash = 1; this.airJumps = 1; this.slam = false;
        const v = G.room.tile(c.tx, c.ty);
        if (v === TL.CU) G.room.stepCrumble(c.tx, c.ty);
        // safe ground tracking for hazard respawns
        if ((v === TL.S || v === TL.P) && !this.inWater && this.hurtT <= 0) {
          let ok = true;
          for (let tx = c.tx - 1; tx <= c.tx + 1; tx++) for (let ty = c.ty - 2; ty <= c.ty + 1; ty++) { const w = G.room.tile(tx, ty); if (w === TL.SPK || w === TL.LAVA || w === TL.GLOOM || w === TL.TH) ok = false; }
          const xx = Math.floor(this.x / T), xx2 = Math.floor((this.x + this.w) / T);
          if (G.room.tile(xx, c.ty) === TL.E || G.room.tile(xx2, c.ty) === TL.E) ok = false;
          if (ok) { this.safe.x = this.x; this.safe.y = this.y; }
        }
      }
      if (was && !this.onGround && this.vy >= 0) this.coyote = K.COYOTE;
    }

    attackBox(st) {
      const r = st.range;
      if (this.atkDir === 'up') { const w = 56, h = 74 * r; return { x: this.cx - w / 2, y: this.y - h + 8, w, h }; }
      if (this.atkDir === 'down') { const w = 56, h = 70 * r; return { x: this.cx - w / 2, y: this.bottom - 8, w, h }; }
      const w = 74 * r, h = 50;
      return { x: this.face > 0 ? this.x + this.w - 4 : this.x + 4 - w, y: this.y - 6, w, h };
    }

    updateCape(dt) {
      // verlet chain anchored at the neck
      const ax = this.cx - this.face * 3, ay = this.y + 15;
      const c = this.cape;
      c[0].x = ax; c[0].y = ay;
      for (let i = 1; i < c.length; i++) {
        const p = c[i];
        const vx = (p.x - p.px) * 0.86, vy = (p.y - p.py) * 0.86;
        p.px = p.x; p.py = p.y;
        p.x += vx - this.face * 14 * dt; p.y += vy + 260 * dt * dt * 60 * 0.02;
        if (this.inWater) p.y -= 3 * dt * 60 * 0.1;
      }
      for (let k = 0; k < 3; k++) for (let i = 1; i < c.length; i++) {
        const a = c[i - 1], b = c[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, seg = 5;
        const f = (d - seg) / d; b.x -= dx * f; b.y -= dy * f;
      }
    }
  }
  LF.Player = Player;
})();
