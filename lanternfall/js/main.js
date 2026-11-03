// Lanternfall — main: game state, rooms, combat resolution, saves, loop
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const T = LF.T, TL = LF.TILE, VW = LF.VW, VH = LF.VH, CW = LF.CW, CH = LF.CH, R = LF.R;
  const RN = LF.Render;

  // ================================================================ settings
  const SET_KEY = 'lanternfall_settings';
  LF.settings = Object.assign({ master: 0.8, music: 0.6, sfx: 0.8, shake: true, preset: 'arrows', timer: false, fps: false }, (() => { try { return JSON.parse(localStorage.getItem(SET_KEY)) || {}; } catch (e) { return {}; } })());
  LF.saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(LF.settings)); } catch (e) { } };
  LF.applySettings = () => { const s = LF.settings; LF.audio.setVol('master', s.master); LF.audio.setVol('music', s.music); LF.audio.setVol('sfx', s.sfx); LF.input.setPreset(s.preset); };

  // ================================================================ saves
  const slotKey = (n) => 'lanternfall_slot_' + n;
  LF.newSave = (slot) => ({
    v: 1, slot, created: Date.now(), time: 0, room: 'h_cliff', bench: null,
    hp: 5, masks: 5, shards: 0, vfrags: 0, energy: 0, glim: 0,
    abilities: [], charms: [], equipped: [], notches: 3, nail: 0, ore: 0,
    wisps: 0, wispsHome: 0, wispRewards: [], bosses: [], items: [], broken: {}, maps: [], pins: [], visited: [], seenBoss: [],
    flags: {}, shade: null, kills: {}, lore: [], bought: [], deaths: 0, completed: false, regions: [],
  });
  LF.loadSlot = (n) => { try { const s = JSON.parse(localStorage.getItem(slotKey(n))); return s && s.v ? s : null; } catch (e) { return null; } };
  LF.writeSlot = (S) => { try { localStorage.setItem(slotKey(S.slot), JSON.stringify(S)); return true; } catch (e) { return false; } };
  LF.deleteSlot = (n) => { try { localStorage.removeItem(slotKey(n)); } catch (e) { } };
  LF.completion = (S) => {
    const total = { items: 0 }; let got = 0, all = 0;
    for (const r of LF.world.list) { const rd = LF.getRoomData(r.id); for (const it of rd.items) { all++; if (S.items.includes(it.key)) got++; } }
    const pct = (got / all) * 50 + (S.bosses.length / 10) * 30 + Math.min(1, S.visited.length / LF.world.list.length) * 10 + (S.wispsHome / 24) * 5 + (S.nail / 4) * 5;
    return Math.round(pct);
  };

  // ================================================================ room runtime
  class Room {
    constructor(def, S) {
      this.def = def; this.rd = LF.getRoomData(def.id); LF.prepSolver(def, this.rd);
      this.W = this.rd.W; this.H = this.rd.H; this.G0 = this.rd.G0;
      this.tiles = new Uint8Array(this.rd.tiles);
      const broken = S.broken[def.id] || [];
      if (broken.length) for (let i = 0; i < this.tiles.length; i++) if (broken.includes(this.rd.cluster[i])) this.tiles[i] = TL.E;
      this.crumbles = new Map(); this.dynLights = []; this.locked = null;
      RN.renderRoom(this);
    }
    tile(x, y) {
      x = x < 0 ? 0 : x >= this.W ? this.W - 1 : x; y = y < 0 ? 0 : y >= this.H ? this.H - 1 : y;
      const v = this.tiles[y * this.W + x];
      if (v === TL.CU && this.crumbled(x, y)) return TL.E;
      return v;
    }
    crumbleState(x, y) { return this.crumbles.get(y * this.W + x) || { t: 0, gone: 0 }; }
    crumbled(x, y) { const c = this.crumbles.get(y * this.W + x); return !!(c && c.gone > 0); }
    stepCrumble(x, y) { const k = y * this.W + x; if (!this.crumbles.has(k)) this.crumbles.set(k, { t: 0.5, gone: 0 }); }
    update(dt, G) {
      for (const [k, c] of this.crumbles) {
        if (c.t > 0) { c.t -= dt; if (c.t <= 0) { c.gone = 3; G.sfx('break'); const x = k % this.W, y = (k / this.W) | 0; G.burst(x * T + 16, y * T + 6, 8, { col: '#8a8070', spd: 120, life: 0.6, size: 3, grav: 800 }); } }
        else if (c.gone > 0) { c.gone -= dt; if (c.gone <= 0) this.crumbles.delete(k); }
      }
      this.dynLights.length = 0;
    }
    lockDoors() {
      if (this.locked) return; this.locked = [];
      for (const dr of this.rd.doorRects) for (let y = dr.y0; y <= dr.y1; y++) for (let x = dr.x0; x <= dr.x1; x++) { const k = y * this.W + x; this.locked.push([k, this.tiles[k]]); this.tiles[k] = TL.S; }
      RN.renderRoom(this);
    }
    unlockDoors() { if (!this.locked) return; for (const [k, v] of this.locked) this.tiles[k] = v; this.locked = null; RN.renderRoom(this); }
  }
  LF.Room = Room;

  // ================================================================ the game
  const G = LF.G = {
    time: 0, state: 'title', S: null, room: null, player: null, enemies: [], projectiles: [], flames: [], glims: [], items: [], particles: [],
    warnings: [], bossHits: [], timers: [], zones: [], boss: null, shade: null, kin: null, killed: new Set(), cam: { x: 0, y: 0 },
    shakeT: 0, shakeA: 0, hitstop: 0, flashT: 0, flashCol: '#fff', fade: 0, lockInput: false, darkBoost: 0, prompt: null, playTime: 0,
    get save() { return this.S; }, get input() { return LF.input; },
    stats: {}, slowmo: 1,
  };
  LF.G = G;

  // ---------------------------------------------------------------- helpers used by entities
  G.has = (a) => !!G.S && G.S.abilities.includes(a);
  G.charm = (id) => !!G.S && G.S.equipped.includes(id);
  G.maxHp = () => G.S.masks + (G.charm('hearthstone') ? 2 : 0);
  G.maxEnergy = () => 99 + Math.floor(G.S.vfrags / 3) * 33;
  G.notchesUsed = () => G.S.equipped.reduce((a, id) => a + LF.CHARMS[id].cost, 0);
  G.calcStats = () => {
    const c = G.charm, S = G.S;
    let dmg = LF.NAIL[S.nail].dmg * (c('ironbite') ? 1.35 : 1);
    if (c('oathbound') && S.hp === 1) dmg *= 2;
    G.stats = {
      speed: 1 + (c('quickstep') ? 0.18 : 0), dmg, range: 1 + (c('longthorn') ? 0.3 : 0), atkSpeed: c('swift_needle') ? 0.7 : 1,
      focusTime: c('deep_focus') ? (c('patient') ? 0.8 : 1.3) : (c('patient') ? 0.5 : 0.85), focusHeal: c('deep_focus') ? 2 : 1,
      spellDmg: (18 + S.bosses.length * 1.5) * (c('kindled') ? 1.5 : 1), energyGain: 11 * (c('soulcatcher') ? 1.6 : 1),
    };
  };
  G.sfx = (n, p) => LF.audio.play(n, p);
  G.shake = (a, t) => { if (!LF.settings.shake) return; G.shakeA = Math.max(G.shakeA, a); G.shakeT = Math.max(G.shakeT, t); };
  G.particle = (x, y, o) => { if (G.particles.length > 1100) return; G.particles.push({ x, y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.5, max: o.life || 0.5, col: o.col || '#fff', size: o.size || 2, glow: !!o.glow, grav: o.grav || 0, alpha: o.alpha || 1, toward: o.toward }); };
  G.burst = (x, y, n, o) => { for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, s = (o.spd || 200) * (0.3 + R() * 0.7); G.particle(x, y, Object.assign({}, o, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - (o.up || 0), life: (o.life || 0.5) * (0.6 + R() * 0.6), size: (o.size || 2) * (0.6 + R() * 0.8) })); } };
  G.dust = (x, y, n) => { for (let i = 0; i < n; i++) G.particle(x + R.range(-10, 10), y - 2, { vx: R.range(-90, 90), vy: -R.range(20, 90), life: R.range(0.3, 0.6), col: 'rgba(200,190,170,0.6)', size: R.range(2, 5), grav: 200 }); };
  G.spark = (x, y, col) => { G.burst(x, y, 8, { col: col || '#fff', spd: 260, life: 0.25, size: 2, glow: true }); };
  G.hitFx = (x, y, dir, col) => { G.burst(x, y, 10, { col: col || '#fff', spd: 320, life: 0.3, size: 2.5, glow: true }); G.particle(x, y, { vx: 0, vy: 0, life: 0.12, col: '#fff', size: 18, glow: true }); G.sfx('hit'); };
  G.splash = (x, y) => { G.sfx('splash'); for (let i = 0; i < 10; i++) G.particle(x + R.range(-12, 12), y, { vx: R.range(-120, 120), vy: -R.range(100, 300), life: 0.5, col: 'rgba(170,230,240,0.8)', size: 3, grav: 900 }); };
  G.wingFx = (p) => { for (const s of [-1, 1]) for (let i = 0; i < 8; i++) G.particle(p.cx + s * R.range(6, 26), p.cy + R.range(-6, 10), { vx: s * R.range(40, 140), vy: R.range(40, 140), life: 0.45, col: '#e8e0ff', size: 2.5, glow: true }); };
  G.spawnFlame = (x, y, owner, life) => { if (G.flames.length < 80) G.flames.push(new LF.Flame(x, y, owner, life || 1.2)); };
  G.dropGlim = (x, y, amount) => {
    let v = Math.round(amount * (G.charm('magpie') ? 1.25 : 1) * (G.charm('gambler') ? 2 : 1));
    const big = Math.floor(v / 10), small = v - big * 10;
    for (let i = 0; i < big; i++) G.glims.push(new LF.Glim(x, y, 10));
    for (let i = 0; i < small; i++) G.glims.push(new LF.Glim(x, y, 1));
  };
  G.addGlim = (v) => { G.S.glim = Math.min(99999, G.S.glim + v); G.glimPop = 1; };
  G.timer = (t, fn) => G.timers.push({ t, fn });

  // ---------------------------------------------------------------- combat
  G.playerAttack = (p, box, dir, mult) => {
    const dmg = G.stats.dmg * mult, kind = dir === 'cleave' ? 'cleave' : dir;
    let hitSomething = false, blocked = false;
    const tryHit = (target, bx) => {
      const key = target; if (p.atkHits.has(key)) return;
      if (!LF.overlap(box, bx)) return;
      p.atkHits.add(key);
      const r = target.hurt(G, dmg, p.face * (dir === 'up' || dir === 'down' ? 0.3 : 1) || p.face, kind);
      if (r === 'block') blocked = true; else if (r) { hitSomething = true; if (!(target instanceof LF.Shade)) G.S.energy = Math.min(G.maxEnergy(), G.S.energy + G.stats.energyGain * (kind === 'cleave' ? 1.5 : 1)); }
    };
    for (const e of G.enemies) if (!e.dead) { const cb = e.contactBox() || (e.hidden ? null : e); if (cb) tryHit(e, { x: e.x, y: e.y, w: e.w, h: e.h }); }
    if (G.boss && G.boss.active && !G.boss.dying) { for (const b of G.boss.boxes()) { if (LF.overlap(box, b) && !p.atkHits.has(G.boss)) { tryHit(G.boss, b); } } for (const m of G.boss.minions) if (m.hurt && !m.dead) tryHit(m, { x: m.x, y: m.y, w: m.w, h: m.h }); }
    if (G.shade && !G.shade.dead) tryHit(G.shade, G.shade.contactBox());
    // breakables & pogo off hazards
    const x0 = Math.floor(box.x / T), x1 = Math.floor((box.x + box.w) / T), y0 = Math.floor(box.y / T), y1 = Math.floor((box.y + box.h) / T);
    let hazPogo = false;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const v = G.room.tile(tx, ty);
      if (v === TL.BR) { G.breakCluster(tx, ty); hitSomething = true; }
      else if (v === TL.CR && kind === 'cleave') { G.breakCluster(tx, ty); }
      else if (v === TL.CR && !p.atkHits.has('cr')) { p.atkHits.add('cr'); G.sfx('clank'); G.spark(tx * T + 16, ty * T + 16, '#83f2ff'); G.notifyOnce('crystal_hint', 'The crystal shrugs off your blade.', 'A greater, shining blow might cleave it.'); }
      else if (v === TL.SE && !p.atkHits.has('se')) { p.atkHits.add('se'); G.sfx('clank'); G.notifyOnce('seal_hint', 'A seal of hard red wax.', 'Fire would melt it.'); }
      else if ((v === TL.SPK || v === TL.TH) && dir === 'down') hazPogo = true;
    }
    if (blocked) { G.sfx('clank'); if (!G.charm('steady')) { p.vx = -p.face * 300; p.recoilT = 0.12; } G.hitstop = Math.max(G.hitstop, 0.05); }
    if ((hitSomething || hazPogo) && !p.atkHits.has('_recoil')) {
      p.atkHits.add('_recoil');
      if (hitSomething) { G.hitstop = Math.max(G.hitstop, 0.055); G.shake(3, 0.08); }
      if (dir === 'down') { p.vy = -700; p.airDash = 1; p.airJumps = 1; p.jumpCut = true; p.slam = false; p.recoilT = 0.05; if (hazPogo) G.sfx('clank'); }
      else if (dir === 'side' && !G.charm('steady')) { p.vx = -p.face * 210; p.recoilT = 0.08; }
    }
  };
  G.castBolt = (p) => {
    G.sfx('spell');
    const angs = G.charm('twin_flame') ? [0, -0.2, 0.2] : [0];
    for (const a of angs) G.projectiles.push(new LF.Projectile(p.cx + p.face * 18, p.cy - 4, Math.cos(a) * p.face * 950, Math.sin(a) * 950, { owner: 'player', dmg: G.stats.spellDmg * (a ? 0.6 : 1), r: 14, kind: 'bolt', pierce: true, life: 1.4, breaks: 'seal', col: '#ffb347' }));
    G.shake(3, 0.1);
  };
  G.castNova = (p) => {
    G.sfx('nova'); G.shake(7, 0.25);
    G.zones.push({ x: p.cx - 50, y: p.bottom - 230, w: 100, h: 240, t: 0.36, tick: 0, dmg: G.stats.spellDmg * 1.4, hits: new Set() });
    for (let i = 0; i < 60; i++) G.particle(p.cx + R.range(-40, 40), p.bottom - R.range(0, 230), { vx: R.range(-30, 30), vy: -R.range(200, 500), life: R.range(0.3, 0.6), col: R() < 0.5 ? '#ffb347' : '#fff1b0', size: R.range(3, 7), glow: true });
  };
  G.slamImpact = (x, y, dmg) => {
    G.sfx('slam'); G.shake(12, 0.3); G.dust(x, y, 18);
    for (let i = 0; i < 16; i++) G.particle(x, y - 4, { vx: (i < 8 ? -1 : 1) * R.range(100, 420), vy: -R.range(30, 200), life: 0.5, col: '#e8dcc0', size: 3, glow: true });
    const box = { x: x - 130, y: y - 80, w: 260, h: 90 };
    for (const e of G.enemies) if (!e.dead && LF.overlap(box, e)) e.hurt(G, dmg, LF.sign(e.cx - x) || 1, 'slam');
    if (G.boss && G.boss.active) for (const b of G.boss.boxes()) if (LF.overlap(box, b)) { G.boss.hurt(G, dmg, 1, 'slam'); break; }
  };
  G.breakCluster = (tx, ty) => {
    const rd = G.room.rd, k = ty * rd.W + tx, id = rd.cluster[k];
    if (id === undefined || id < 0) return;
    const v = G.room.tiles[k]; if (v === TL.E) return;
    let n = 0;
    for (let i = 0; i < G.room.tiles.length; i++) if (rd.cluster[i] === id && G.room.tiles[i] !== TL.E) {
      G.room.tiles[i] = TL.E; n++;
      const x = (i % rd.W) * T + 16, y = ((i / rd.W) | 0) * T + 16;
      const col = v === TL.CR ? '#83f2ff' : v === TL.SE ? '#d86a3a' : v === TL.KY ? '#ffe28c' : LF.REGIONS[G.room.def.region].rockHi;
      G.burst(x, y, 6, { col, spd: 240, life: 0.8, size: 4, grav: 900 });
    }
    const S = G.S; (S.broken[G.room.def.id] = S.broken[G.room.def.id] || []).push(id);
    G.sfx(v === TL.KY ? 'door' : 'break'); G.shake(6, 0.2);
    RN.renderRoom(G.room);
    if (v === TL.BR && G.room.def.doors.some(d => d.secretRoom)) {
      const near = G.room.rd.doorRects.some(dr => dr.d.secretRoom && tx >= dr.x0 && tx <= dr.x1 && ty >= dr.y0 && ty <= dr.y1);
      if (near) { G.sfx('item'); G.toast('A hidden passage!', ''); }
    }
    G.autosave();
  };
  G.hurtPlayer = (dmg, fromX) => {
    const p = G.player;
    if (p.dead || p.inv > 0 || (p.dashT > 0 && p.veiling) || G.state !== 'play' || p.frozen > 0) return false;
    dmg += G.charm('gambler') ? 1 : 0;
    G.S.hp -= dmg;
    p.inv = 1.3 * (G.charm('crystal_guard') ? 1.6 : 1);
    p.focusing = false; p.atkT = 0; p.chargeT = 0; p.charged = false; p.slam = false; p.dashT = 0; p.sitting = false;
    if (!G.charm('steady')) { const d = fromX < p.cx ? 1 : -1; p.vx = d * 340; p.vy = -400; p.hurtT = 0.22; p.recoilT = 0.2; }
    G.hitstop = 0.14; G.shake(10, 0.3); G.flashT = 0.15; G.flashCol = 'rgba(255,255,255,0.6)'; G.sfx('hurt');
    G.burst(p.cx, p.cy, 16, { col: '#1a1420', spd: 300, life: 0.6, size: 4 });
    if (G.charm('thorn_mantle')) { G.burst(p.cx, p.cy, 20, { col: '#d6b25a', spd: 400, life: 0.4, size: 3 }); const box = { x: p.cx - 120, y: p.cy - 90, w: 240, h: 180 }; for (const e of G.enemies) if (!e.dead && LF.overlap(box, e)) e.hurt(G, G.stats.dmg * 1.2, LF.sign(e.cx - p.cx) || 1, 'spell'); if (G.boss && G.boss.active) for (const b of G.boss.boxes()) if (LF.overlap(box, b)) { G.boss.hurt(G, G.stats.dmg * 1.2, 1, 'spell'); break; } }
    if (G.charm('wicks_lament')) G.S.energy = Math.min(G.maxEnergy(), G.S.energy + 20);
    G.calcStats();
    if (G.S.hp <= 0) { G.S.hp = 0; G.playerDie(); }
    return true;
  };
  G.hazardHit = () => {
    const p = G.player; if (p.dead || p.frozen > 0) return;
    G.S.hp -= 1 + (G.charm('gambler') ? 1 : 0); G.sfx('hurt'); G.shake(10, 0.3); G.flashT = 0.2; G.flashCol = 'rgba(255,255,255,0.5)';
    G.burst(p.cx, p.cy, 18, { col: '#1a1420', spd: 300, life: 0.6, size: 4 });
    p.slam = false; p.dashT = 0; p.atkT = 0; p.focusing = false;
    if (G.S.hp <= 0) { G.S.hp = 0; G.playerDie(); return; }
    p.frozen = 0.55; G.fadeTo = 1;
    G.timer(0.35, () => { p.x = p.safe.x; p.y = p.safe.y; p.vx = 0; p.vy = 0; p.inv = 1.0; G.snapCam(); G.fadeTo = 0; });
    G.calcStats();
  };
  G.playerDie = () => {
    const p = G.player; if (p.dead) return;
    p.dead = true; p.deathAnim = 0; G.S.deaths++; G.sfx('death'); G.hitstop = 0.3;
    LF.audio.stopMusic();
    G.burst(p.cx, p.cy, 50, { col: '#1a1420', spd: 260, life: 1.4, size: 5 });
    G.burst(p.cx, p.cy, 30, { col: '#ffb347', spd: 200, life: 1.2, size: 3, glow: true });
    const S = G.S;
    if (S.glim > 0 && !(G.room.rd.arena && false)) S.shade = { room: G.room.def.id, x: p.x, y: Math.min(p.y, (G.room.G0 - 3) * T), amount: S.glim };
    else S.shade = S.shade && S.glim === 0 ? S.shade : null;
    if (S.glim > 0) S.glim = 0;
    G.timer(2.2, () => G.respawn());
  };
  G.respawn = () => {
    const S = G.S;
    S.hp = G.maxHp(); S.energy = 0; G.killed.clear(); G.darkBoost = 0;
    const benchRoom = S.bench || 'h_cliff';
    G.enterRoom(benchRoom, 'bench');
    G.fade = 1; G.fadeTo = 0;
    G.writeSave();
  };
  G.onEnemyKilled = (e) => {
    if (e.spawnIdx !== undefined) G.killed.add(G.room.def.id + ':' + e.spawnIdx);
    G.S.kills[e.type] = (G.S.kills[e.type] || 0) + 1;
  };
  G.recoverShade = (sh) => {
    G.addGlim(sh.amount); G.S.shade = null; G.sfx('ability');
    G.burst(sh.cx, sh.cy, 40, { col: '#a99cff', spd: 300, life: 1, size: 4, glow: true });
    G.toast('Your glimmer is restored', '+' + sh.amount);
    G.autosave();
  };

  // ---------------------------------------------------------------- items & rewards
  G.toast = (title, sub) => { LF.UI.toast(title, sub); };
  G.notifyOnce = (k, a, b) => { if (G.S.flags['n_' + k]) return; G.S.flags['n_' + k] = 1; G.toast(a, b); };
  G.giveCharm = (id) => { if (!G.S.charms.includes(id)) { G.S.charms.push(id); G.sfx('item'); LF.UI.itemCard('charm', id); G.writeSave(); } };
  G.collectItem = (it) => {
    const S = G.S;
    if (it.key && !S.items.includes(it.key)) S.items.push(it.key);
    G.sfx(it.t === 'wisp' ? 'wisp' : 'item');
    G.burst(it.x, it.y, 24, { col: '#fff3c4', spd: 220, life: 0.8, size: 3, glow: true });
    switch (it.t) {
      case 'mask': S.shards++; if (S.shards % 4 === 0) { S.masks++; S.hp = G.maxHp(); LF.UI.itemCard('maskFull'); } else LF.UI.itemCard('mask', S.shards % 4); break;
      case 'vessel': S.vfrags++; if (S.vfrags % 3 === 0) LF.UI.itemCard('vesselFull'); else LF.UI.itemCard('vessel', S.vfrags % 3); break;
      case 'notch': S.notches++; LF.UI.itemCard('notch'); break;
      case 'ore': S.ore++; LF.UI.itemCard('ore'); break;
      case 'charm': if (!S.charms.includes(it.id)) S.charms.push(it.id); LF.UI.itemCard('charm', it.id); break;
      case 'wisp': S.wisps++; G.toast('Lost Wisp found', `${S.wisps} following you. ${S.wispsHome} home of 24. Bring them to Grandmother Lumen.`); break;
      case 'glim': G.addGlim(it.v || 50); G.toast('Glimmer cache', '+' + (it.v || 50)); break;
      case 'ability': if (!S.abilities.includes(it.id)) S.abilities.push(it.id); LF.UI.abilityCard(it.id); G.sfx('ability'); break;
    }
    G.calcStats(); G.writeSave();
  };
  G.grantWispRewards = () => {
    const S = G.S, out = [];
    for (const r of LF.WISP_REWARDS) {
      const k = 'w' + r.n; if (S.wispsHome < r.n || S.wispRewards.includes(k)) continue;
      S.wispRewards.push(k);
      if (r.t === 'glim') { G.addGlim(r.v); out.push(r.v + ' glimmer'); }
      if (r.t === 'mask') { S.shards++; if (S.shards % 4 === 0) { S.masks++; S.hp = G.maxHp(); } out.push('a Mask Shard'); }
      if (r.t === 'vessel') { S.vfrags++; out.push('a Vessel Fragment'); }
      if (r.t === 'ore') { S.ore++; out.push('Pale Ore'); }
      if (r.t === 'notch') { S.notches++; out.push('a Charm Notch'); }
      if (r.t === 'charm') { if (!S.charms.includes(r.id)) S.charms.push(r.id); out.push('the charm ' + LF.CHARMS[r.id].name); }
    }
    if (out.length) G.sfx('item');
    G.calcStats(); G.writeSave();
    return out;
  };
  G.buyMap = (reg) => {
    const p = LF.MAP_PRICES[reg];
    if (G.S.glim < p) { G.sfx('uiNo'); return 'You don\'t have enough glimmer.'; }
    G.S.glim -= p; G.S.maps.push(reg); G.sfx('uiOk'); G.writeSave();
    return 'Splendid! Mind the edges, they\'re still wet.';
  };

  // ---------------------------------------------------------------- bosses
  G.bossDying = (b) => {
    G.slowmo = 0.25; G.timer(0.15, () => { G.slowmo = 1; });
    G.sfx('roar'); G.shake(14, 1.2); G.flashT = 0.3; G.flashCol = 'rgba(255,255,255,0.7)';
    for (const e of G.enemies) if (e.summoned) e.die(G, true);
    G.projectiles = G.projectiles.filter(p => p.owner === 'player');
    G.timer(2.4, () => G.onBossDefeated(b));
  };
  G.onBossDefeated = (b) => {
    const S = G.S; b.dead = true;
    if (!S.bosses.includes(b.id)) S.bosses.push(b.id);
    G.sfx('boom'); G.burst(b.cx, b.cy, 120, { col: '#fff3c4', spd: 500, life: 1.6, size: 4, glow: true });
    G.boss = null; G.darkBoost = 0;
    const rew = LF.BOSSES[b.id].reward;
    if (b.id === 'ysolde') { G.timer(1.5, () => LF.UI.ending()); G.writeSave(); return; }
    G.room.unlockDoors();
    if (rew) {
      let x = LF.clamp(b.cx, 8 * T, (G.room.W - 8) * T);
      const solidBelow = (px) => { const tx = Math.floor(px / T); for (let d = -1; d <= 1; d++) if (G.room.tile(tx + d, G.room.G0) === TL.E) return false; return true; };
      if (!solidBelow(x)) { for (let k = 1; k < G.room.W; k++) { if (solidBelow(x + k * T)) { x += k * T; break; } if (solidBelow(x - k * T)) { x -= k * T; break; } } }
      G.items.push(new LF.Item({ key: 'boss:' + b.id, t: 'ability', id: rew, x, y: (G.room.G0 - 2) * T }));
    }
    LF.audio.playMusic(LF.REGIONS[G.room.def.region].music);
    G.writeSave();
  };
  G.startBoss = () => {
    const b = G.boss; if (!b || b.active || b.intro) return;
    b.intro = true; G.room.lockDoors(); G.sfx('roar'); G.shake(6, 1);
    if (!G.S.seenBoss.includes(b.id)) G.S.seenBoss.push(b.id);
    LF.audio.playMusic(b.id === 'ysolde' ? 'finalboss' : 'boss');
    LF.UI.bossTitle(b.def.name, b.def.title);
    G.timer(2.0, () => { b.active = true; });
  };

  // ---------------------------------------------------------------- benches, interaction
  G.sitBench = () => {
    const p = G.player, b = G.room.rd.bench, S = G.S;
    p.sitting = true; p.x = b.x - p.w / 2; p.y = b.y - p.h - 12; p.vx = 0; p.vy = 0; p.face = 1;
    S.bench = G.room.def.id; S.hp = G.maxHp(); G.killed.clear(); S.shadeBench = true;
    G.sfx('bench'); G.writeSave(); G.calcStats();
    G.burst(p.cx, p.cy, 20, { col: '#ffcf8a', spd: 120, life: 1, size: 3, glow: true });
    G.toast('Rested', 'Your journey is saved. Press ' + LF.input.keyName('inv') + ' to change charms.');
  };
  G.standUp = () => { const p = G.player; p.y -= 2; };
  G.findInteractable = () => {
    const p = G.player, rd = G.room.rd;
    if (!p.onGround || p.sitting) return null;
    let best = null, bd = 1e9;
    const consider = (o, kind, r, label) => { const d = Math.abs(o.x - p.cx); if (d < r && Math.abs(o.y - p.bottom) < 70 && d < bd) { bd = d; best = { o, kind, label }; } };
    if (rd.bench) consider(rd.bench, 'bench', 50, 'Rest');
    for (const n of G.npcs) consider(n, 'npc', 70, n.id === 'cask' && LF.npcStage('cask', G.S) === 2 ? 'Examine' : 'Listen');
    for (const l of rd.lore) consider(l, 'lore', 45, 'Read');
    for (const s of rd.signs) consider(s, 'sign', 45, 'Read');
    // key gate
    const kd = G.room.def.doors.find(d => d.gate === 'key');
    if (kd && G.room.tile(kd.col, 1) === TL.KY && Math.abs(p.cx - (kd.col + 2) * T) < 120 && p.y < 7 * T) best = { o: { x: (kd.col + 2) * T, y: 4 * T }, kind: 'keygate', label: G.has('key') ? 'Unlock' : 'Inspect' };
    return best;
  };
  G.interact = (it) => {
    const S = G.S; if (!it) return;
    if (it.kind === 'bench') G.sitBench();
    else if (it.kind === 'npc') { const n = it.o, d = LF.NPCS[n.id]; const res = d.talk(S, G); LF.UI.dialog(d.name, res.lines, res.then, n.id); G.writeSave(); }
    else if (it.kind === 'lore') { if (!S.lore.includes(it.o.id)) { S.lore.push(it.o.id); G.writeSave(); } LF.UI.dialog(null, [LF.LORE[it.o.id] || '...'], null, 'lore'); }
    else if (it.kind === 'sign') LF.UI.dialog(null, [LF.UI.keys(LF.SIGNS[it.o.id] || '')], null, 'sign');
    else if (it.kind === 'keygate') {
      if (G.has('key')) { const kd = G.room.def.doors.find(d => d.gate === 'key'); G.breakCluster(kd.col, 1); G.sfx('ability'); G.toast('The Great Lantern Gate opens', 'The way to the Heart lies above.'); }
      else LF.UI.dialog(null, [LF.LORE.lantern_gate, 'The gate is sealed by a lock of cold light.'], null, 'lore');
    }
  };

  // ---------------------------------------------------------------- rooms
  G.enterRoom = (id, how, pos) => {
    const S = G.S, def = LF.world.rooms[id], prev = G.room;
    if (prev && prev.locked) prev.unlockDoors();
    G.room = new Room(def, S);
    G.enemies = []; G.projectiles = []; G.flames = []; G.glims = []; G.items = []; G.warnings = []; G.zones = []; G.particles = []; G.boss = null; G.shade = null; G.darkBoost = 0;
    const rd = G.room.rd;
    rd.spawns.forEach((s, i) => { if (!G.killed.has(id + ':' + i)) G.enemies.push(new LF.Enemy(s.type, s.x, s.y, { idx: i })); });
    for (const it of rd.items) if (!S.items.includes(it.key)) G.items.push(new LF.Item(it));
    // boss reward not yet collected (e.g. quit before picking it up)
    if (def.f.boss && S.bosses.includes(def.f.boss)) { const rew = LF.BOSSES[def.f.boss].reward; if (rew && !S.abilities.includes(rew)) G.items.push(new LF.Item({ key: 'boss:' + def.f.boss, t: 'ability', id: rew, x: G.room.W * T / 2, y: (G.room.G0 - 2) * T })); }
    G.npcs = rd.npcs.filter(n => n.stage === undefined || LF.npcStage(n.id, S) === n.stage);
    if (S.shade && S.shade.room === id) G.shade = new LF.Shade(S.shade.x, S.shade.y, S.shade.amount);
    if (def.f.boss && !S.bosses.includes(def.f.boss)) G.boss = new LF.BOSS_CLASSES[def.f.boss](G);
    // player placement
    const p = G.player;
    if (how === 'bench' || how === 'load') {
      if (rd.bench) { p.x = rd.bench.x - p.w / 2; p.y = rd.bench.y - p.h - 12; p.sitting = how === 'bench' || how === 'load'; }
      else { const st = { x: 6 * T, y: (G.room.G0) * T - p.h }; p.x = st.x; p.y = st.y; }
      p.vx = 0; p.vy = 0; p.dead = false; p.inv = 1;
    } else if (how === 'start') { p.x = 5 * T; p.y = 2 * T; p.vx = 0; p.vy = 0; }
    else if (pos) { p.x = pos.x; p.y = pos.y; p.sitting = false; }
    p.onGround = false; p.dashT = 0; p.slam = false; p.wall = 0; p.atkT = 0; p.chargeT = 0; p.charged = false; p.focusing = false; p.frozen = 0;
    // never leave the player embedded in a wall: break secret walls they came through, else nudge free
    for (let k = 0; k < 4; k++) {
      const c = p.collides(G, 0, p.bottom); if (!c) break;
      if (G.room.tile(c.tx, c.ty) === TL.BR) { G.breakCluster(c.tx, c.ty); continue; }
      G.unstick();
    }
    p.safe.x = p.x; p.safe.y = p.y;
    if (!S.visited.includes(id)) S.visited.push(id);
    S.room = id;
    // region title & music
    const reg = def.region;
    if (!prev || prev.def.region !== reg) {
      if (!S.regions.includes(reg)) { S.regions.push(reg); LF.UI.areaTitle(LF.REGIONS[reg].name, LF.REGIONS[reg].sub, true); }
      else if (prev) LF.UI.areaTitle(LF.REGIONS[reg].name, '', false);
    }
    if (!G.boss || !G.boss.active) LF.audio.playMusic(LF.REGIONS[reg].music);
    if (G.charm('spirit_kin')) G.kin = new LF.Kin(p); else G.kin = null;
    G.snapCam();
    G.autosave();
  };
  G.unstick = () => {
    const p = G.player, ox = p.x, oy = p.y;
    for (let r = 1; r < 12; r++) for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1], [1, -1], [-1, -1]]) {
      p.x = ox + dx * r * 16; p.y = oy + dy * r * 16;
      if (p.y < 2 || p.x < 2 || p.x + p.w > G.room.W * T - 2 || p.bottom > G.room.H * T - 2) continue;
      if (!p.collides(G, 0, p.bottom)) return true;
    }
    p.x = ox; p.y = oy; return false;
  };
  G.checkTransition = () => {
    const p = G.player, rm = G.room, W = rm.W * T, H = rm.H * T;
    let side = null;
    if (p.cx < 0) side = 'L'; else if (p.cx > W) side = 'R'; else if (p.y < -2) side = 'T'; else if (p.y > H) side = 'B';
    if (!side) return;
    const def = rm.def, ox = def.x * CW * T, oy = def.y * CH * T;
    const gx = ox + p.cx, gy = oy + p.y + p.h / 2;
    const cell = { x: Math.floor(gx / (CW * T)), y: Math.floor(gy / (CH * T)) };
    if (side === 'L') cell.x = def.x - 1; if (side === 'R') cell.x = def.x + def.w; if (side === 'T') cell.y = def.y - 1; if (side === 'B') cell.y = def.y + def.h;
    const nr = LF.roomAtCell(cell.x, cell.y);
    if (!nr || !def.doors.some(d => d.to === nr.id)) { // no room: push back
      p.x = LF.clamp(p.x, 2, W - p.w - 2); if (p.y > H) { p.y = H - p.h - 40; } if (p.y < 0) p.y = 0; return;
    }
    const nox = nr.x * CW * T, noy = nr.y * CH * T;
    let nx = ox + p.x - nox, ny = oy + p.y - noy;
    const NW = nr.w * CW * T, NH = nr.h * CH * T;
    if (side === 'R') nx = 2 * T - p.w / 2; if (side === 'L') nx = NW - 2 * T - p.w / 2;
    if (side === 'T') { ny = NH - p.h - 4; p.vy = -LF.PK.BOOST; p.jumpCut = true; }
    if (side === 'B') ny = 4;
    G.enterRoom(nr.id, 'door', { x: nx, y: ny });
    G.fade = 0.6; G.fadeTo = 0;
  };
  G.snapCam = () => { const t = G.camTarget(); G.cam.x = t.x; G.cam.y = t.y; };
  G.camTarget = () => {
    const p = G.player, rm = G.room;
    let x = p.cx - VW / 2 + p.face * 50, y = p.cy - VH / 2 - 30;
    if (p.onGround && LF.input.held('down') && Math.abs(p.vx) < 10 && !p.focusing) y += 140;
    if (p.onGround && LF.input.held('up') && Math.abs(p.vx) < 10) y -= 120;
    if (G.boss && G.boss.active && !G.boss.hidden) x = LF.lerp(x, G.boss.cx - VW / 2, 0.35);
    x = LF.clamp(x, 0, rm.W * T - VW); y = LF.clamp(y, 0, rm.H * T - VH);
    return { x, y };
  };

  // ---------------------------------------------------------------- saving
  G.writeSave = () => { if (!G.S) return; G.S.time = G.playTime; LF.writeSlot(G.S); };
  let lastAuto = 0;
  G.autosave = () => { if (G.time - lastAuto > 0.5) { lastAuto = G.time; G.writeSave(); } else G.pendingSave = true; };
  G.startGame = (slot, S) => {
    G.S = S || LF.newSave(slot); G.S.slot = slot;
    G.playTime = G.S.time || 0;
    G.killed.clear();
    G.player = new LF.Player(0, 0);
    G.calcStats();
    G.state = 'play';
    if (!S) { G.enterRoom('h_cliff', 'start'); G.S.hp = 5; G.player.frozen = 0; LF.UI.intro(); }
    else { G.S.hp = Math.max(1, G.S.hp); G.enterRoom(G.S.bench || 'h_cliff', G.S.bench ? 'load' : 'start'); }
    G.fade = 1; G.fadeTo = 0;
    G.writeSave();
  };

  // ================================================================ update
  G.update = (dt) => {
    const S = G.S, p = G.player;
    G.playTime += dt;
    for (let i = G.timers.length - 1; i >= 0; i--) { const tm = G.timers[i]; tm.t -= dt; if (tm.t <= 0) { G.timers.splice(i, 1); tm.fn(); } }
    if (G.pendingSave && G.time - lastAuto > 1) { G.pendingSave = false; lastAuto = G.time; G.writeSave(); }
    G.room.update(dt, G);
    G.calcStats();
    if (p.dead) { p.deathAnim += dt; }
    else {
      p.update(G, dt);
      if (p.collides(G, 0, p.bottom)) { p.stuckT = (p.stuckT || 0) + dt; if (p.stuckT > 0.25) { p.stuckT = 0; if (!G.unstick()) { p.x = p.safe.x; p.y = p.safe.y; } } } else p.stuckT = 0;
    }
    G.bossHits.length = 0;
    // hazards for player
    if (!p.dead && p.frozen <= 0) {
      const ix0 = Math.floor((p.x + 4) / T), ix1 = Math.floor((p.x + p.w - 4) / T), iy0 = Math.floor((p.y + 6) / T), iy1 = Math.floor((p.y + p.h - 2) / T);
      let haz = false;
      for (let ty = iy0; ty <= iy1; ty++) for (let tx = ix0; tx <= ix1; tx++) {
        const v = G.room.tile(tx, ty);
        if (v === TL.SPK && p.y + p.h > ty * T + 12) haz = true;
        if (v === TL.LAVA && p.y + p.h > ty * T + 10) haz = true;
        if (v === TL.GLOOM && !G.has('pearl')) haz = true;
      }
      // thorns hurt on touch
      for (let ty = Math.floor(p.y / T); ty <= Math.floor((p.y + p.h) / T); ty++) for (let tx = Math.floor((p.x - 2) / T); tx <= Math.floor((p.x + p.w + 2) / T); tx++) if (G.room.tile(tx, ty) === TL.TH) { if (!haz) G.hurtPlayer(1, tx * T + 16); }
      if (haz) G.hazardHit();
      if (p.y > G.room.H * T + 200) { p.y = 0; G.hazardHit(); }
    }
    // enemies
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.update(G, dt);
      const cb = e.contactBox(); if (cb && !p.dead && LF.overlap(cb, p) && !(e.def.ai === 'ambusher' && e.state !== 'bite' && e.state !== 'emerge')) G.hurtPlayer(e.def.dmg, e.cx);
      if (e.def.ai === 'ambusher' && e.state === 'bite' && !p.dead) { const bb = { x: e.x - 6, y: e.y - 40, w: e.w + 12, h: e.h + 40 }; if (LF.overlap(bb, p)) G.hurtPlayer(e.def.dmg, e.cx); }
    }
    G.enemies = G.enemies.filter(e => !e.dead);
    // boss
    if (G.boss) {
      const b = G.boss;
      if (!b.active && !b.intro && !b.dying) {
        const m = 7 * T, nearDoor = G.room.rd.doorRects.some(dr => p.x + p.w > (dr.x0 - 3) * T && p.x < (dr.x1 + 4) * T && p.y + p.h > (dr.y0 - 3) * T && p.y < (dr.y1 + 4) * T);
        if (p.x > m && p.x < G.room.W * T - m && p.onGround && p.bottom > (G.room.G0 - 9) * T && !nearDoor) G.startBoss();
      }
      b.update(G, dt);
      if (b.active && !b.dying && !p.dead) {
        for (const c of b.contact()) if (LF.overlap(c, p)) { G.hurtPlayer(1, b.cx); break; }
        for (const h of G.bossHits) if (LF.overlap(h, p)) { G.hurtPlayer(h.dmg, h.x + h.w / 2); break; }
      }
    }
    // projectiles
    for (const pr of G.projectiles) {
      pr.update(G, dt);
      if (pr.dead) continue;
      if (pr.owner === 'enemy') {
        if (!p.dead && Math.abs(pr.x - p.cx) < pr.r + p.w / 2 - 2 && Math.abs(pr.y - p.cy) < pr.r + p.h / 2 - 4) { if (G.hurtPlayer(pr.dmg, pr.x)) { pr.dead = true; G.spark(pr.x, pr.y, pr.col); } }
      } else {
        const box = { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };
        const hit = (tg, bx) => { if (pr.hits.has(tg) || !LF.overlap(box, bx)) return; pr.hits.add(tg); const r = tg.hurt(G, pr.dmg, LF.sign(pr.vx) || 1, 'spell'); if (r && !pr.pierce) pr.dead = true; };
        for (const e of G.enemies) if (!e.dead) hit(e, e);
        if (G.boss && G.boss.active) { for (const bx of G.boss.boxes()) hit(G.boss, bx); for (const m of G.boss.minions) if (m.hurt && !m.dead) hit(m, m); }
        if (G.shade) hit(G.shade, G.shade);
      }
    }
    G.projectiles = G.projectiles.filter(pr => !pr.dead);
    // flames / zones
    for (const f of G.flames) {
      f.update(G, dt); const fb = f.box();
      if (f.owner === 'enemy') { if (!p.dead && LF.overlap(fb, p)) G.hurtPlayer(1, f.x); }
      else { for (const e of G.enemies) if (!e.dead && !f.hits.has(e) && LF.overlap(fb, e)) { f.hits.add(e); e.hurt(G, G.stats.dmg * 0.5, 0, 'spell'); } if (G.boss && G.boss.active && !f.hits.has(G.boss)) for (const b of G.boss.boxes()) if (LF.overlap(fb, b)) { f.hits.add(G.boss); G.boss.hurt(G, G.stats.dmg * 0.4, 0, 'spell'); break; } }
    }
    G.flames = G.flames.filter(f => !f.dead);
    for (const z of G.zones) {
      z.t -= dt; z.tick -= dt; if (z.tick <= 0) { z.tick = 0.15; z.hits.clear(); }
      for (const e of G.enemies) if (!e.dead && !z.hits.has(e) && LF.overlap(z, e)) { z.hits.add(e); e.hurt(G, z.dmg, 0, 'spell'); }
      if (G.boss && G.boss.active && !z.hits.has(G.boss)) for (const b of G.boss.boxes()) if (LF.overlap(z, b)) { z.hits.add(G.boss); G.boss.hurt(G, z.dmg, 0, 'spell'); break; }
      if (G.boss) for (const m of G.boss.minions) if (m.hurt && !m.dead && LF.overlap(z, m)) m.hurt(G);
      G.room.dynLights.push({ x: z.x + z.w / 2, y: z.y + z.h / 2, r: 200, c: '#ffb347' });
    }
    G.zones = G.zones.filter(z => z.t > 0);
    if (G.shade && !G.shade.dead) { G.shade.update(G, dt); if (!p.dead && LF.overlap(G.shade.contactBox(), p) && G.shade.cool < 0) G.hurtPlayer(1, G.shade.cx); }
    if (G.kin) G.kin.update(G, dt);
    for (const g of G.glims) g.update(G, dt);
    G.glims = G.glims.filter(g => !g.dead);
    for (const it of G.items) it.update(G, dt);
    G.items = G.items.filter(i => !i.dead);
    for (const w of G.warnings) w.t -= dt;
    G.warnings = G.warnings.filter(w => w.t > 0);
    // lava lights
    if (LF.REGIONS[G.room.def.region].bgs === 'volcano') {
      const rd = G.room.rd;
      for (let y = Math.max(0, Math.floor(G.cam.y / T)); y < Math.min(rd.H, Math.ceil((G.cam.y + VH) / T)); y++) for (let x = Math.max(0, Math.floor(G.cam.x / T)); x < Math.min(rd.W, Math.ceil((G.cam.x + VW) / T)); x += 2) if (G.room.tiles[y * rd.W + x] === TL.LAVA) G.room.dynLights.push({ x: x * T + 16, y: y * T, r: 120, c: '#ff8c4c' });
    }
    // interaction
    G.prompt = !p.dead && !p.sitting && G.state === 'play' ? G.findInteractable() : null;
    if (G.prompt && LF.input.hit('interact') && !LF.input.held('down')) { G.interact(G.prompt); }
    if (!p.dead) G.checkTransition();
    // camera
    const ct = G.camTarget();
    G.cam.x = LF.lerp(G.cam.x, ct.x, Math.min(1, dt * 6)); G.cam.y = LF.lerp(G.cam.y, ct.y, Math.min(1, dt * 5));
    // particles
    for (const q of G.particles) {
      q.life -= dt;
      if (q.toward) { q.x = LF.lerp(q.x, q.toward.cx, dt * 4); q.y = LF.lerp(q.y, q.toward.cy, dt * 4); }
      else { q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    }
    G.particles = G.particles.filter(q => q.life > 0);
    G.ambient(dt);
  };
  G.ambient = (dt) => {
    const reg = LF.REGIONS[G.room.def.region], cam = G.cam, fx = reg.fx;
    const rate = { embers: 0.5, dust: 0.35, spores: 0.45, sparkles: 0.4, rain: 3, drips: 0.25, motes: 0.4, gloom: 0.5 }[fx] || 0.3;
    if (R() < rate) {
      const x = cam.x + R() * VW, y = cam.y + R() * VH;
      if (fx === 'embers') G.particle(x, cam.y + VH + 10, { vx: R.range(-20, 20), vy: -R.range(40, 110), life: R.range(3, 6), col: R() < 0.5 ? '#ff8c4c' : '#ffd36a', size: R.range(1.5, 3), glow: true });
      else if (fx === 'rain') G.particle(x, cam.y - 10, { vx: -40, vy: 900, life: 0.8, col: 'rgba(170,190,230,0.35)', size: 1.5 });
      else if (fx === 'spores') G.particle(x, y, { vx: R.range(-15, 15), vy: -R.range(5, 25), life: R.range(3, 5), col: R() < 0.5 ? '#c4f582' : '#e6c8ff', size: R.range(1.5, 3), glow: true });
      else if (fx === 'sparkles') G.particle(x, y, { vx: 0, vy: -5, life: R.range(0.8, 1.6), col: R() < 0.5 ? '#83f2ff' : '#fff', size: R.range(1, 2.5), glow: true });
      else if (fx === 'drips') G.particle(x, cam.y, { vx: 0, vy: 300, life: 1.5, col: 'rgba(160,230,240,0.6)', size: 1.5, grav: 600 });
      else if (fx === 'gloom') G.particle(x, y, { vx: R.range(-10, 10), vy: -R.range(5, 20), life: R.range(2, 4), col: R() < 0.3 ? '#c47dff' : 'rgba(10,5,20,0.8)', size: R.range(3, 7), alpha: 0.6 });
      else G.particle(x, y, { vx: R.range(-8, 8), vy: R.range(-6, 6), life: R.range(3, 6), col: reg.accent, size: R.range(1, 2.2), glow: true, alpha: 0.6 });
    }
  };

  // ================================================================ draw
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  G.ctx = ctx; G.canvas = canvas;
  G.draw = () => {
    const c = ctx, cam = G.cam, rm = G.room, reg = LF.REGIONS[rm.def.region], t = G.time;
    let sx = 0, sy = 0;
    if (G.shakeT > 0) { sx = (R() - 0.5) * G.shakeA * 2; sy = (R() - 0.5) * G.shakeA * 2; }
    const cx = Math.round(cam.x + sx), cy = Math.round(cam.y + sy);
    // sky

    // parallax
    RN.bgLayers(rm.def.region).forEach((L, li) => {
      const ox = Math.round(-((cx * L.f) % VW + VW) % VW), oy = li === 0 ? 0 : Math.round(-LF.clamp(cy * L.f * 0.4, 0, 120));
      c.drawImage(L.cv, ox, oy); c.drawImage(L.cv, ox + VW, oy);
      if (oy < 0) { c.drawImage(L.cv, ox, oy + VH); c.drawImage(L.cv, ox + VW, oy + VH); }
    });
    c.save(); c.translate(-cx, -cy);
    // back props
    for (const p of rm.rd.props) if (p.x > cx - 120 && p.x < cx + VW + 120 && p.y > cy - 250 && p.y < cy + VH + 250) RN.drawProp(c, p, reg, t);
    c.drawImage(rm.canvas, cx, cy, VW, VH, cx, cy, VW, VH);
    RN.drawDynamicTiles(c, G, { x: cx, y: cy });
    // warnings
    for (const w of G.warnings) { const a = (1 - w.t / w.max); c.fillStyle = w.col; c.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(a * 12)); c.fillRect(w.x, w.y, w.w, w.h); c.globalAlpha = 1; }
    // world objects
    if (rm.rd.bench) RN.drawBench(c, rm.rd.bench, reg, t);
    for (const l of rm.rd.lore) RN.drawTablet(c, l, reg, t, G.S.lore.includes(l.id));
    for (const s of rm.rd.signs) RN.drawSign(c, s);
    for (const n of G.npcs) { if (n.id === 'cask' && LF.npcStage('cask', G.S) === 2) RN.drawCaskCorpse(c, n.x, n.y); else RN.drawNPC(c, n, G); }
    for (const it of G.items) RN.drawItem(c, it, G);
    RN.drawCovers(c, G);
    if (G.flames.length) { c.save(); c.globalCompositeOperation = 'lighter'; const fs = RN.spr('#ffb347'); for (const f of G.flames) { c.globalAlpha = 0.85 * f.life / f.max; c.drawImage(fs, f.x - 24, f.y - 34, 48, 48); } c.restore(); }
    for (const gl of G.glims) { c.save(); c.translate(gl.x, gl.y); c.scale(Math.cos(gl.spin), 1); c.fillStyle = gl.v >= 10 ? '#fff0a0' : '#f4eccc'; c.beginPath(); const s = gl.v >= 10 ? 7 : 5; c.moveTo(0, -s); c.lineTo(s * 0.7, 0); c.lineTo(0, s); c.lineTo(-s * 0.7, 0); c.closePath(); c.fill(); c.restore(); }
    for (const e of G.enemies) RN.drawEnemy(c, e, G);
    if (G.boss) { c.save(); if (G.boss.flash > 0) c.filter = 'brightness(2.2)'; G.boss.draw(c, G); c.restore(); }
    if (G.shade && !G.shade.dead) RN.drawShade(c, G.shade, t);
    RN.drawPlayer(c, G.player, G);
    if (G.kin) { c.save(); c.globalCompositeOperation = 'lighter'; const k = G.kin; const gg = c.createRadialGradient(k.x, k.y, 0, k.x, k.y, 16); gg.addColorStop(0, '#fff'); gg.addColorStop(0.4, '#bff'); gg.addColorStop(1, 'rgba(150,255,255,0)'); c.fillStyle = gg; c.beginPath(); c.arc(k.x, k.y, 16, 0, Math.PI * 2); c.fill(); c.restore(); }
    for (const pr of G.projectiles) RN.drawProjectile(c, pr, t);
    // particles
    for (const q of G.particles) {
      const a = Math.min(1, q.life / q.max * 1.5) * q.alpha;
      if (q.x < cx - 20 || q.x > cx + VW + 20 || q.y < cy - 20 || q.y > cy + VH + 20) continue;
      if (q.glow) { c.globalCompositeOperation = 'lighter'; }
      c.globalAlpha = a; c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, q.size, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1;
    // interaction prompt
    if (G.prompt) { const o = G.prompt.o; c.save(); c.globalAlpha = 0.9 + Math.sin(t * 4) * 0.1; c.fillStyle = 'rgba(10,8,14,0.7)'; c.font = '15px "Palatino Linotype", Palatino, Georgia, serif'; const txt = '▲  ' + G.prompt.label; const w = c.measureText(txt).width + 22; c.fillRect(o.x - w / 2, o.y - 118, w, 26); c.strokeStyle = 'rgba(255,230,180,0.5)'; c.strokeRect(o.x - w / 2, o.y - 118, w, 26); c.fillStyle = '#f4e8d0'; c.textAlign = 'center'; c.fillText(txt, o.x, o.y - 100); c.restore(); }
    c.restore();
    RN.lighting(c, G, { x: cx, y: cy });
    RN.fog(c, G, { x: cx, y: cy });
    if (G.flashT > 0) { c.fillStyle = G.flashCol; c.globalAlpha = Math.min(1, G.flashT * 5); c.fillRect(0, 0, VW, VH); c.globalAlpha = 1; }
    if (G.player.dead) { c.fillStyle = `rgba(0,0,0,${Math.min(1, G.player.deathAnim / 2)})`; c.fillRect(0, 0, VW, VH); }
  };

  // ================================================================ loop
  let last = performance.now(), acc = 0, fpsT = 0, frames = 0;
  G.fps = 60;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000); last = now;
    fpsT += dt; frames++; if (fpsT > 0.5) { G.fps = Math.round(frames / fpsT); fpsT = 0; frames = 0; }
    LF.input.pollPad();
    G.step(dt);
  }
  const STEP = 1 / 60;
  G.step = (dt) => {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 6) {
      acc -= STEP; n++;
      G.tick(STEP);
      if (n === 1) { /* only the first sub-step sees fresh "pressed" edges */ LF.input.pressed.clear(); LF.input.released.clear(); LF.input.pad.prev = new Set(LF.input.pad.down); }
    }
    G.render();
  };
  G.tick = (dt) => {
    G.time += dt;
    LF.UI.update(dt);
    if (G.state === 'play' && G.room && !LF.UI.blocking()) {
      if (G.hitstop > 0) G.hitstop -= dt;
      else G.update(dt * G.slowmo);
      if (G.shakeT > 0) G.shakeT -= dt; else G.shakeA = 0;
      if (G.flashT > 0) G.flashT -= dt;
      if (LF.input.hit('pause')) LF.UI.open('pause');
      else if (LF.input.hit('inv') && !G.player.dead) LF.UI.open('inventory');
      else if (LF.input.hit('map') && !G.player.dead) LF.UI.open('map');
    }
    if (G.fadeTo !== undefined) G.fade = LF.approach(G.fade, G.fadeTo, dt * 3);
  };
  G.render = () => {
    const c = ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (G.state === 'play' && G.room) { G.draw(); LF.UI.drawHUD(c); }
    else { c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH); }
    if (G.fade > 0.001) { c.fillStyle = `rgba(0,0,0,${G.fade})`; c.fillRect(0, 0, VW, VH); }
    LF.UI.draw(c);
    if (LF.settings.fps) { c.fillStyle = '#fff'; c.font = '12px monospace'; c.textAlign = 'left'; c.fillText(G.fps + ' fps', 8, VH - 8); }
  };

  // ================================================================ boot
  function resize() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    canvas.style.width = Math.floor(VW * s) + 'px'; canvas.style.height = Math.floor(VH * s) + 'px';
  }
  window.addEventListener('resize', resize);
  LF.boot = () => {
    canvas.width = VW; canvas.height = VH; resize();
    LF.buildWorld();
    LF.applySettings();
    LF.UI.init();
    requestAnimationFrame(frame);
  };
  window.addEventListener('beforeunload', () => { if (G.state === 'play') G.writeSave(); });
})();

// ================================================================ test harness (used by tools/*.js; harmless in play)
LF.test = {
  // step the simulation n frames with the given actions held; 'press' actions get a fresh edge on frame 0
  run(n, hold = [], press = []) {
    const I = LF.input, G = LF.G;
    const codes = (acts) => acts.map(a => I.map[a][0]);
    for (let i = 0; i < n; i++) {
      const down = new Set([...codes(hold), ...(i < 3 ? codes(press) : [])]);
      const prev = this.prevDown || new Set();
      I.pressed = new Set([...down].filter(k => !prev.has(k)));
      if (i === 0) for (const k of codes(press)) I.pressed.add(k);
      I.released = new Set([...prev].filter(k => !down.has(k)));
      I.down = down; this.prevDown = down;
      if (this.autoClose) LF.UI.stack = LF.UI.stack.filter(x => !['card', 'ability', 'dialog'].includes(x.name));
      G.tick(1 / 60);
    }
  },
  release() { LF.input.down.clear(); this.prevDown = new Set(); },
  grantAll() { const S = LF.G.S; S.abilities = Object.keys(LF.ABILITIES); LF.G.calcStats(); },
  place(id, tx, ty) { const G = LF.G; LF.UI.stack = []; G.enterRoom(id, 'door', { x: tx * 32 + 6, y: ty * 32 - 41 }); G.player.vx = 0; G.player.vy = 0; },
};
