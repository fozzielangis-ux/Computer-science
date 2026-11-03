// Lanternfall — world layout, deterministic room generation and reachability solver
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const { CW, CH } = LF;
  const TL = LF.TILE = { E: 0, S: 1, P: 2, SPK: 3, TH: 4, BR: 5, SL: 6, CR: 7, SE: 8, VE: 9, KY: 10, CU: 11, LAVA: 12, WATER: 13, GLOOM: 14 };
  const { E, S, P, SPK, TH, BR, SL, CR, SE, VE, KY, CU, LAVA, WATER, GLOOM } = TL;
  LF.isLiquid = v => v === WATER || v === GLOOM || v === LAVA;

  // ---------------------------------------------------------------- layout
  LF.buildWorld = function () {
    const rooms = {}, list = [];
    for (const d of LF.ROOMS) { const r = Object.assign({}, d, { doors: [] }); rooms[r.id] = r; list.push(r); }
    const occ = new Map();
    for (const r of list) for (let i = 0; i < r.w; i++) for (let j = 0; j < r.h; j++) {
      const k = (r.x + i) + ',' + (r.y + j);
      if (occ.has(k)) throw new Error('Room overlap ' + r.id + ' / ' + occ.get(k));
      occ.set(k, r.id);
    }
    for (const c of LF.CONNS) {
      const [aId, bId, o = {}] = c, a = rooms[aId], b = rooms[bId];
      if (!a || !b) throw new Error('Bad connection ' + aId + ' - ' + bId);
      const mk = (self, side, g, other) => ({ side, g, to: other.id, gate: o.gate && o.gate.in === self.id ? o.gate.type : null, secret: !!o.secret, secretRoom: !!other.f.secret });
      let made = false;
      if (a.x + a.w === b.x || b.x + b.w === a.x) {
        const L = a.x < b.x ? a : b, Rr = L === a ? b : a;
        const y0 = Math.max(a.y, b.y), y1 = Math.min(a.y + a.h, b.y + b.h) - 1;
        if (y0 <= y1) {
          const gy = o.at !== undefined ? o.at : y1;
          if (gy < y0 || gy > y1) throw new Error('Bad at for ' + aId + '-' + bId);
          L.doors.push(mk(L, 'R', gy, Rr)); Rr.doors.push(mk(Rr, 'L', gy, L)); made = true;
        }
      }
      if (!made && (a.y + a.h === b.y || b.y + b.h === a.y)) {
        const U = a.y < b.y ? a : b, D = U === a ? b : a;
        const x0 = Math.max(a.x, b.x), x1 = Math.min(a.x + a.w, b.x + b.w) - 1;
        if (x0 <= x1) {
          const gx = o.at !== undefined ? o.at : x0;
          if (gx < x0 || gx > x1) throw new Error('Bad at for ' + aId + '-' + bId);
          U.doors.push(mk(U, 'B', gx, D)); D.doors.push(mk(D, 'T', gx, U)); made = true;
        }
      }
      if (!made) throw new Error('Rooms not adjacent: ' + aId + ' - ' + bId);
    }
    for (const r of list) {
      for (const d of r.doors) {
        if (d.side === 'L' || d.side === 'R') d.row = (d.g - r.y) * CH + 15;
        else d.col = (d.g - r.x) * CW + 14;
      }
      const tc = r.doors.filter(d => d.side === 'T').map(d => d.col), bc = r.doors.filter(d => d.side === 'B').map(d => d.col);
      for (const c of tc) if (bc.includes(c)) throw new Error('T/B door share a column in ' + r.id);
    }
    LF.world = { rooms, list, cellMap: occ };
    return LF.world;
  };
  LF.roomAtCell = function (cx, cy) { const id = LF.world.cellMap.get(cx + ',' + cy); return id ? LF.world.rooms[id] : null; };

  // ---------------------------------------------------------------- generation
  const cache = new Map();
  LF.getRoomData = function (id) {
    if (!cache.has(id)) cache.set(id, LF.genRoom(LF.world.rooms[id]));
    return cache.get(id);
  };

  LF.genRoom = function (r) {
    const W = r.w * CW, H = r.h * CH, rg = LF.rng('room:' + r.id), reg = LF.REGIONS[r.region];
    const G0 = H - 3, f = r.f, isArena = !!f.boss, calm = !!f.calm || !!f.secret;
    const t = new Uint8Array(W * H).fill(S);
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const get = (x, y) => inb(x, y) ? t[y * W + x] : S;
    const set = (x, y, v) => { if (inb(x, y)) t[y * W + x] = v; };
    const fill = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
    const reserved = [];
    const reserve = (x0, y0, x1, y1) => reserved.push({ x0, y0, x1, y1 });
    const isRes = (x0, y0, x1, y1, m = 0) => reserved.some(q => x0 - m <= q.x1 && x1 + m >= q.x0 && y0 - m <= q.y1 && y1 + m >= q.y0);
    const lockG = new Int16Array(W).fill(-1);
    const lock = (x0, x1, v = G0) => { for (let x = Math.max(2, x0); x <= Math.min(W - 3, x1); x++) lockG[x] = v; };
    const out = { id: r.id, W, H, G0, items: [], spawns: [], npcs: [], lore: [], signs: [], props: [], lights: [], bench: null, doorRects: [], hazards: [] };
    const doors = r.doors;
    const leftFloorDoor = doors.some(d => d.side === 'L' && d.row === G0), rightFloorDoor = doors.some(d => d.side === 'R' && d.row === G0);
    const upperDoorRows = { L: doors.filter(d => d.side === 'L' && d.row !== G0).map(d => d.row), R: doors.filter(d => d.side === 'R' && d.row !== G0).map(d => d.row) };

    // ---- 1. locks
    for (const d of doors) {
      if (d.side === 'L') lock(2, d.row === G0 ? 9 : 15);
      if (d.side === 'R') lock(W - (d.row === G0 ? 10 : 16), W - 3);
      if (d.side === 'B') lock(d.col - 6, d.col + 9);
      if (d.side === 'T') lock(d.col - 4, d.col + 7);
      if (d.gate === 'gap' || d.gate === 'water') { if (d.side === 'L') lock(2, 17); else lock(W - 18, W - 3); }
    }
    const fx = (frac) => LF.clamp(Math.round(frac * W), 5, W - 6);
    if (isArena || calm) lock(2, W - 3);
    if (f.bench !== undefined) lock(fx(f.bench) - 4, fx(f.bench) + 4);
    (f.npcs || []).forEach(n => lock(fx(n.x) - 3, fx(n.x) + 3));
    (f.signs || []).forEach(n => lock(fx(n.x) - 2, fx(n.x) + 2));
    const loreList = (f.lore || []).map((l, i) => typeof l === 'string' ? { id: l, x: [0.38, 0.62, 0.5][i] || 0.5 } : l);
    loreList.forEach(n => lock(fx(n.x) - 2, fx(n.x) + 2));
    const itemDefs = (f.items || []).map((it, i) => Object.assign({ idx: i }, it));
    let alcoveSide = null;
    for (const it of itemDefs) {
      if (it.where === 'floor' || it.where === 'high' || it.where === 'pool') { it.tx = fx(it.x !== undefined ? it.x : 0.5); lock(it.tx - 7, it.tx + 4); }
      if (it.where === 'alcove') {
        const okL = !leftFloorDoor && !upperDoorRows.L.some(rw => rw > G0 - 9), okR = !rightFloorDoor && !upperDoorRows.R.some(rw => rw > G0 - 9);
        it.side = alcoveSide = okL && (!okR || rg() < 0.5) && alcoveSide !== 'L' ? 'L' : okR && alcoveSide !== 'R' ? 'R' : null;
        if (it.side === 'L') lock(2, 9); else if (it.side === 'R') lock(W - 10, W - 3);
        else { it.tx = fx(0.5 + (rg() - 0.5) * 0.3); lock(it.tx - 6, it.tx + 7); }
      }
    }

    // ---- 2. ground heightmap
    const ground = new Int16Array(W).fill(G0);
    if (!isArena) {
      let x = 2, h = G0;
      while (x < W - 2) {
        const len = rg.int(3, 8);
        const nh = LF.clamp(h + rg.pick([-2, -1, 0, 0, 1, 2]), G0 - 3, G0);
        for (let i = 0; i < len && x < W - 2; i++, x++) ground[x] = nh;
        h = nh;
      }
    }
    for (let x = 0; x < W; x++) if (lockG[x] >= 0) ground[x] = lockG[x];
    for (let pass = 0; pass < 4; pass++) {
      for (let x = 3; x < W - 2; x++) if (lockG[x] < 0) ground[x] = LF.clamp(ground[x], ground[x - 1] - 2, ground[x - 1] + 2);
      for (let x = W - 4; x >= 2; x--) if (lockG[x] < 0) ground[x] = LF.clamp(ground[x], ground[x + 1] - 2, ground[x + 1] + 2);
    }
    for (let x = 3; x < W - 3; x++) if (lockG[x] < 0 && ground[x] !== ground[x - 1] && ground[x] !== ground[x + 1]) ground[x] = ground[x - 1];
    for (let x = 2; x <= W - 3; x++) for (let y = 2; y < ground[x]; y++) set(x, y, E);
    out.ground = ground;

    // ---- 3. doors & connectors
    const catchers = [], gateZones = [];
    const platform = (x0, x1, y, v = P) => { for (let x = x0; x <= x1; x++) if (get(x, y) === E) set(x, y, v); };
    for (const d of doors) {
      if (d.side === 'L' || d.side === 'R') {
        const rw = d.row, L = d.side === 'L';
        const wx0 = L ? 0 : W - 2, wx1 = L ? 1 : W - 1;
        fill(wx0, rw - 3, wx1, rw - 1, E);
        out.doorRects.push({ d, x0: wx0, y0: rw - 3, x1: wx1, y1: rw - 1 });
        if (d.secret && !d.secretRoom) { /* entering from the secret room side: keep open */ }
        if (d.secretRoom) fill(wx0, rw - 3, wx1, rw - 1, BR);
        if (rw === G0) { reserve(L ? 0 : W - 11, rw - 5, L ? 10 : W - 1, rw); }
        else {
          const sx0 = L ? 2 : W - 6, sx1 = L ? 5 : W - 3;
          fill(sx0, rw, sx1, rw + 1, S); fill(sx0, rw - 3, sx1, rw - 1, E);
          const cols = L ? [[6, 9], [10, 13]] : [[W - 10, W - 7], [W - 14, W - 11]];
          let last = rw, p = rw + 3, i = 0;
          while (G0 - last > 3) { const pp = Math.min(p, G0 - 3); platform(cols[i % 2][0], cols[i % 2][1], pp); last = pp; p = pp + 3; i++; }
          reserve(L ? 0 : W - 16, rw - 5, L ? 15 : W - 1, G0);
        }
      } else if (d.side === 'T') {
        const c = d.col;
        fill(c, 0, c + 3, 1, E);
        out.doorRects.push({ d, x0: c, y0: 0, x1: c + 3, y1: 1 });
        if (d.gate === 'claws' || d.gate === 'climb') {
          fill(c - 1, 2, c - 1, G0 - 4, S); fill(c + 4, 2, c + 4, G0 - 4, S);
        } else if (d.gate === 'thorn') {
          let last = G0; while (last > 4) { const pp = Math.max(3, last - 6); platform(c - 1, c + 4, pp); last = pp; }
        } else {
          let last = G0; while (last > 4) { const pp = Math.max(3, last - 3); platform(c - 1, c + 4, pp); last = pp; }
        }
        reserve(c - 4, 0, c + 7, G0);
      } else if (d.side === 'B') {
        const c = d.col;
        fill(c, G0, c + 3, H - 1, E);
        catchers.push(d);
        out.doorRects.push({ d, x0: c, y0: H - 2, x1: c + 3, y1: H - 1 });
        reserve(c - 6, H - 10, c + 9, H - 1);
      }
    }

    // ---- 4. gates
    const gateRes = (x0, y0, x1, y1) => { reserve(x0, y0, x1, y1); gateZones.push({ x0, y0, x1, y1 }); };
    for (const d of doors) {
      if (!d.gate) continue;
      const g = d.gate;
      if (d.side === 'L' || d.side === 'R') {
        const L = d.side === 'L', X = (i) => L ? i : W - 1 - i;
        if (g === 'gap') {
          for (let i = 6; i <= 12; i++) { const x = X(i); fill(x, G0, x, H - 2, E); set(x, H - 2, SPK); ground[x] = H - 1; }
          gateRes(Math.min(X(2), X(17)), 2, Math.max(X(2), X(17)), H - 1);
          out.hazards.push('gap');
        } else if (g === 'water') {
          for (let i = 5; i <= 12; i++) { const x = X(i); fill(x, G0, x, H - 2, GLOOM); }
          for (let i = 7; i <= 10; i++) { const x = X(i); fill(x, 2, x, G0 - 1, S); }
          gateRes(Math.min(X(2), X(16)), 2, Math.max(X(2), X(16)), H - 1);
        } else if (g === 'veil' || g === 'seal' || g === 'crystal') {
          const v = g === 'veil' ? VE : g === 'seal' ? SE : CR, x = X(8);
          fill(x, 2, x, G0 - 1, v); gateRes(Math.min(X(2), X(12)), 2, Math.max(X(2), X(12)), H - 1);
        }
      } else {
        const c = d.col;
        if (d.side === 'B' && g === 'slam') { fill(c, G0, c + 3, H - 1, SL); }
        else if (d.side === 'T' && g === 'key') { fill(c, 0, c + 3, 1, KY); }
        else if (g === 'climb') {
          if (d.side === 'B') { fill(c - 4, 5, c - 3, G0 - 1, S); fill(c + 6, 5, c + 7, G0 - 1, S); }
        } else if (g === 'thorn') {
          if (d.side === 'B') { fill(c - 3, G0 - 5, c - 3, G0 - 1, TH); fill(c + 6, G0 - 5, c + 6, G0 - 1, TH); }
        } else if (g === 'veil' || g === 'seal' || g === 'crystal') {
          const v = g === 'veil' ? VE : g === 'seal' ? SE : CR;
          fill(c - 3, 2, c - 3, G0 - 1, v); fill(c + 6, 2, c + 6, G0 - 1, v);
        }
        gateRes(c - 7, 0, c + 10, H - 1);
      }
    }

    // catching ledges beside bottom holes (placed after gates so they never bridge a gate)
    for (const d of catchers) {
      const c = d.col, pocket = d.gate === 'climb' || d.gate === 'thorn';
      const opts = pocket ? [[c + 4, c + 5]] : (rg() < 0.5 ? [[c + 4, c + 7], [c - 4, c - 1]] : [[c - 4, c - 1], [c + 4, c + 7]]);
      for (const [a, b] of opts) {
        if (gateZones.some(q => a <= q.x1 && b >= q.x0) && !pocket) continue;
        let free = true; for (let x = a; x <= b; x++) if (get(x, H - 6) !== E) free = false;
        if (free) { platform(a, b, H - 6); break; }
      }
    }
    // ---- 5. boss arena shaping
    if (isArena) {
      const mid = Math.floor(W / 2);
      platform(10, 15, G0 - 4); platform(W - 16, W - 11, G0 - 4); platform(mid - 4, mid + 3, G0 - 8);
      reserve(2, 2, W - 3, H - 1);
      out.arena = { boss: f.boss };
    }

    // ---- 6. items / features
    const pushItem = (it, px, py) => out.items.push({ key: r.id + ':' + it.idx, t: it.t, id: it.id, v: it.v, x: px, y: py });
    for (const it of itemDefs) {
      if (it.where === 'floor') { pushItem(it, it.tx * 32 + 16, G0 * 32 - 18); reserve(it.tx - 1, G0 - 3, it.tx + 1, G0); }
      else if (it.where === 'high') {
        const x = it.tx;
        platform(x - 7, x - 4, G0 - 3); platform(x - 1, x + 2, G0 - 6);
        fill(x - 1, G0 - 9, x + 2, G0 - 7, E);
        pushItem(it, x * 32 + 16, (G0 - 6) * 32 - 18); reserve(x - 8, G0 - 9, x + 3, G0);
      } else if (it.where === 'pool') {
        const x = it.tx; fill(x - 1, G0, x + 1, G0 + 1, GLOOM);
        pushItem(it, x * 32 + 16, (G0 + 2) * 32 - 18); reserve(x - 2, G0 - 3, x + 2, H - 1);
      } else if (it.where === 'alcove') {
        if (it.side === 'L' || it.side === 'R') {
          const X = (i) => it.side === 'L' ? i : W - 1 - i;
          const a0 = Math.min(X(1), X(4)), a1 = Math.max(X(1), X(4));
          fill(a0, G0 - 5, a1, G0 - 1, S);
          const c0 = Math.min(X(1), X(3)), c1 = Math.max(X(1), X(3));
          fill(c0, G0 - 3, c1, G0 - 1, E); fill(X(4), G0 - 3, X(4), G0 - 1, BR);
          pushItem(it, X(2) * 32 + 16, G0 * 32 - 18); reserve(Math.min(X(0), X(9)), G0 - 7, Math.max(X(0), X(9)), G0);
        } else {
          const x = it.tx; // freestanding pillar with hidden chamber
          fill(x - 2, G0 - 5, x + 3, G0 - 1, S); fill(x - 1, G0 - 3, x + 2, G0 - 1, E);
          fill(x - 2, G0 - 3, x - 2, G0 - 1, BR); fill(x + 3, G0 - 3, x + 3, G0 - 1, BR);
          pushItem(it, x * 32 + 32, G0 * 32 - 18); reserve(x - 5, G0 - 8, x + 6, G0);
        }
      }
    }
    if (f.bench !== undefined) { const x = fx(f.bench); out.bench = { x: x * 32 + 16, y: G0 * 32 }; reserve(x - 2, G0 - 3, x + 2, G0); }
    (f.npcs || []).forEach(n => { const x = fx(n.x); out.npcs.push({ id: n.id, stage: n.stage, x: x * 32 + 16, y: G0 * 32 }); reserve(x - 2, G0 - 4, x + 2, G0); });
    loreList.forEach(n => { const x = fx(n.x); out.lore.push({ id: n.id, x: x * 32 + 16, y: G0 * 32 }); reserve(x - 1, G0 - 3, x + 1, G0); });
    (f.signs || []).forEach(n => { const x = fx(n.x); out.signs.push({ id: n.text, x: x * 32 + 16, y: G0 * 32 }); });

    // ---- 7. floating platforms & islands for vertical play
    const tries = (W * H) / 60;
    const plats = [];
    for (let i = 0; i < tries; i++) {
      const w = rg.int(3, 6), x0 = rg.int(3, W - 4 - w), y = rg.int(5, G0 - 4);
      let gmin = 99; for (let x = x0; x <= x0 + w; x++) gmin = Math.min(gmin, ground[x]);
      if (y > gmin - 4) continue;
      if (isRes(x0, y - 3, x0 + w, y + 3, 1)) continue;
      if (plats.some(q => x0 - 2 <= q.x1 && x0 + w + 2 >= q.x0 && Math.abs(q.y - y) < 3)) continue;
      // must be reachable-ish: near ground or another platform (rise <= 3)
      const nearGround = gmin - y <= 3;
      const nearPlat = plats.some(q => q.y - y >= 2 && q.y - y <= 3 && x0 - 3 <= q.x1 && x0 + w + 3 >= q.x0);
      if (!nearGround && !nearPlat && rg() < 0.8) continue;
      let ok = true; for (let x = x0 - 1; x <= x0 + w + 1; x++) for (let yy = y - 3; yy <= y + 1; yy++) if (get(x, yy) !== E) ok = false;
      if (!ok) continue;
      const solid = rg() < 0.35 && !calm;
      if (solid) fill(x0, y, x0 + w, y + 1, S); else platform(x0, x0 + w, y, (reg.diff >= 2 && rg() < 0.18) ? CU : P);
      plats.push({ x0, x1: x0 + w, y });
    }
    // ---- 8. hazards on the floor
    if (!calm && !isArena) {
      const hz = { mossdeep: SPK, aurel: SPK, glasswyrm: SPK, quietbells: SPK, mirrorlake: WATER, cinderdeep: LAVA, veiledeye: SPK, gloamreach: SPK, heart: SPK, umbravale: SPK }[r.region];
      const n = reg.diff <= 1 ? 1 : 2 + (reg.diff > 4 ? 1 : 0);
      for (let i = 0; i < n * r.w; i++) {
        const w = hz === WATER ? rg.int(3, 5) : rg.int(2, 3), x0 = rg.int(6, W - 7 - w);
        let flat = true; for (let x = x0 - 2; x <= x0 + w + 1; x++) if (ground[x] !== ground[x0] || lockG[x] >= 0) flat = false;
        if (!flat || isRes(x0 - 2, ground[x0] - 7, x0 + w + 1, ground[x0], 0)) continue;
        let clear = true; for (let x = x0 - 2; x <= x0 + w + 1; x++) for (let y = ground[x0] - 6; y < ground[x0]; y++) if (get(x, y) !== E) clear = false;
        if (!clear) continue;
        const g = ground[x0];
        if (hz === SPK) for (let x = x0; x < x0 + w; x++) set(x, g - 1, SPK);
        else if (hz === LAVA) for (let x = x0; x < x0 + w; x++) { set(x, g, LAVA); }
        else if (hz === WATER) for (let x = x0; x < x0 + w; x++) { fill(x, g, x, Math.min(g + 1, H - 2), WATER); }
        reserve(x0 - 1, g - 3, x0 + w, g + 1);
      }
    }
    // ---- 9. ceiling stalactites
    {
      let x = 2;
      while (x < W - 2) {
        const len = rg.int(2, 6), dep = rg.pick([0, 0, 1, 2, 3]);
        for (let i = 0; i < len && x < W - 2; i++, x++) {
          if (isRes(x, 2, x, 2 + dep + 3, 0) || isArena) continue;
          for (let y = 2; y < 2 + dep; y++) if (get(x, y) === E && ground[x] - y > 10 && get(x, y + 3) === E) set(x, y, S);
        }
      }
    }
    // ---- 10. enemy spawns
    if (!calm && !isArena) {
      const pool = reg.enemies.map(id => LF.ENEMIES[id]).filter(Boolean);
      const air = pool.filter(e => ['flyer', 'diver', 'shooterfly', 'ghost', 'teleporter'].includes(e.ai));
      const gnd = pool.filter(e => !air.includes(e));
      const count = Math.round((1.5 + reg.diff * 0.25) * r.w * r.h + rg.range(0, 1.5)) - (r.f.secret ? 2 : 0);
      const doorNear = (x) => doors.some(d => (d.side === 'L' && x < 10) || (d.side === 'R' && x > W - 11) || ((d.side === 'B' || d.side === 'T') && Math.abs(x - d.col - 2) < 6));
      const used = [];
      for (let i = 0, guard = 0; i < count && guard < 200; guard++) {
        const isAir = air.length && (gnd.length === 0 || rg() < 0.4);
        const def = isAir ? rg.pick(air) : rg.pick(gnd);
        if (!def) break;
        const x = rg.int(4, W - 5);
        if (doorNear(x) || used.some(u => Math.abs(u - x) < 4)) continue;
        const enemyId = Object.keys(LF.ENEMIES).find(k => LF.ENEMIES[k] === def);
        if (isAir) {
          const y = ground[x] - rg.int(4, 7);
          if (get(x, y) !== E || get(x, y - 1) !== E) continue;
          out.spawns.push({ type: enemyId, x: x * 32 + 16, y: y * 32 });
        } else {
          let ok = true; for (let xx = x - 1; xx <= x + 1; xx++) if (ground[xx] !== ground[x] || get(xx, ground[x] - 1) !== E || get(xx, ground[x] - 2) !== E) ok = false;
          if (!ok) continue;
          out.spawns.push({ type: enemyId, x: x * 32 + 16, y: ground[x] * 32 });
        }
        used.push(x); i++;
      }
    }
    // ---- 11. props & lights
    const style = reg.bgs;
    for (let x = 3; x < W - 3; x++) {
      const g = ground[x]; if (get(x, g - 1) !== E || get(x, g) !== S) continue;
      const p = rg();
      if (p < 0.08) out.props.push({ k: 'tuft', x: x * 32 + rg.range(4, 28), y: g * 32, s: rg.range(0.7, 1.3), r: rg() });
      else if (p < 0.11) out.props.push({ k: 'rock', x: x * 32 + 16, y: g * 32, s: rg.range(0.6, 1.2), r: rg() });
      else if (p < 0.135 && !isRes(x, g - 4, x, g)) {
        const kinds = { town: 'lamp', halls: 'statue', forest: 'mushroom', ruins: 'column', crystal: 'crystal', city: 'lamp', lake: 'reed', volcano: 'vent', temple: 'candle', gloam: 'spire', heart: 'candle' };
        out.props.push({ k: kinds[style] || 'rock', x: x * 32 + 16, y: g * 32, s: rg.range(0.8, 1.3), r: rg() });
      }
    }
    for (let x = 3; x < W - 3; x++) {
      for (let y = 2; y < H / 2; y++) {
        if (get(x, y) === S && get(x, y + 1) === E && get(x, y + 2) === E && rg() < 0.05) {
          out.props.push({ k: style === 'forest' || style === 'lake' ? 'vine' : style === 'crystal' ? 'icicle' : style === 'city' || style === 'halls' ? 'chain' : 'drip', x: x * 32 + 16, y: (y + 1) * 32, s: rg.range(0.6, 1.4), r: rg() });
          break;
        }
      }
    }
    if (style === 'halls' || style === 'city' || style === 'temple' || style === 'town' || style === 'heart') {
      for (let x = 6; x < W - 6; x += rg.int(9, 15)) {
        const y = rg.int(4, Math.max(5, G0 - 9));
        if (get(x, y) === E && !isRes(x, y, x, y + 3)) out.props.push({ k: 'banner', x: x * 32, y: y * 32, s: 1, r: rg() });
      }
    }
    out.props.forEach(p => { if (['lamp', 'crystal', 'candle', 'vent', 'mushroom'].includes(p.k)) out.lights.push({ x: p.x, y: p.y - 40, r: p.k === 'mushroom' ? 90 : 150, c: reg.accent }); });
    if (out.bench) out.lights.push({ x: out.bench.x, y: out.bench.y - 30, r: 200, c: '#ffcf8a' });

    // ---- 12. breakable clusters
    out.tiles = t;
    LF.labelClusters(out);
    return out;
  };

  LF.labelClusters = function (rd) {
    const { W, H, tiles } = rd, cl = new Int16Array(W * H).fill(-1);
    let n = 0; const sizes = [];
    for (let i = 0; i < W * H; i++) {
      const v = tiles[i];
      if (cl[i] >= 0 || !(v === BR || v === SL || v === CR || v === SE || v === KY)) continue;
      const st = [i]; cl[i] = n; let sz = 0;
      while (st.length) {
        const j = st.pop(); sz++;
        const x = j % W, y = (j / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const k = yy * W + xx; if (cl[k] < 0 && tiles[k] === v) { cl[k] = n; st.push(k); }
        }
      }
      sizes.push(sz); n++;
    }
    rd.cluster = cl; rd.clusterCount = n;
  };

  // ---------------------------------------------------------------- reachability solver
  // abilities: {dash, claws, wings, pearl, veil, bolt, charge, slam, key}
  LF.reach = function (rd, ab, entries) {
    const { W, H, tiles } = rd;
    const tl = (x, y) => (x < 0 || x >= W || y >= H) ? S : y < 0 ? E : tiles[y * W + x];
    const pass = (v) => v === E || v === P || v === WATER || v === BR || (v === GLOOM && ab.pearl) || (v === VE && ab.veil) || (v === SE && ab.bolt) || (v === CR && ab.charge) || (v === KY && ab.key) || (v === SL && ab.slam);
    const haz = (v) => v === SPK || v === LAVA || v === TH || (v === GLOOM && !ab.pearl);
    const sup = (v) => v === S || v === P || v === CU || v === BR || v === SL || v === CR || v === SE || v === KY || v === VE;
    const cling = (v) => v === S || v === BR || v === SL || v === CR || v === SE || v === KY || v === CU;
    const wet = (v) => v === WATER || (v === GLOOM && ab.pearl);
    const ok = (x, y) => { const v = tl(x, y); return pass(v) && !haz(v); };
    const body = (x, y) => ok(x, y - 1) && ok(x, y - 2);
    const stand = (x, y) => y > 0 && y < H && body(x, y) && sup(tl(x, y)) && !haz(tl(x, y));
    const inWater = (x, y) => wet(tl(x, y - 1)) || wet(tl(x, y - 2));
    const clingAt = (x, y, s) => ab.claws && body(x, y) && (cling(tl(x + s, y - 1)) || cling(tl(x + s, y - 2)));
    const J = ab.wings ? 6 : 3;
    const seen = new Uint8Array(W * (H + 4) * 3);
    const q = [];
    const exits = new Set();
    let standCount = 0;
    const standSet = new Uint8Array(W * H), anySet = new Uint8Array(W * H);
    const push = (x, y, m) => { // m: 0 stand 1 cling 2 swim
      if (x < 0 || x >= W || y < -2 || y > H + 1) return;
      const k = ((y + 2) * W + x) * 3 + m; if (seen[k]) return; seen[k] = 1; q.push(x, y, m);
      if (y >= 0 && y < H) anySet[y * W + x] = 1;
      if (m === 0 && y >= 0 && y < H) { standSet[y * W + x] = 1; standCount++; }
    };
    const fall = (x, y) => {
      for (let yy = y; yy < H + 2; yy++) {
        if (yy >= H - 1 && rd.bottomOpen && rd.bottomOpen(x)) { exits.add('B:' + x); return; }
        if (!body(x, yy)) return;
        if (inWater(x, yy)) { push(x, yy, 2); return; }
        if (ab.claws && (clingAt(x, yy, 1) || clingAt(x, yy, -1))) push(x, yy, 1);
        if (sup(tl(x, yy))) { if (!haz(tl(x, yy))) push(x, yy, 0); return; }
      }
    };
    const colClear = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (!ok(x, y)) return false; return true; };
    const rowClear = (x0, x1, y) => { const a = Math.min(x0, x1), b = Math.max(x0, x1); for (let x = a; x <= b; x++) if (!ok(x, y) || !ok(x, y - 1)) return false; return true; };
    const jumps = (x, y) => {
      for (let dy = -10; dy <= J; dy++) {
        const D = dy <= 2 ? (dy < 0 ? 5 : 4) : 3;
        for (let dx = -D; dx <= D; dx++) {
          if (dx === 0 && dy <= 0) continue;
          const tx = x + dx, ty = y - dy;
          const st = stand(tx, ty), cl = ab.claws && (clingAt(tx, ty, 1) || clingAt(tx, ty, -1));
          if (!st && !cl) continue;
          let good;
          if (dy >= 0) good = colClear(x, y - 1, ty - 2) && rowClear(x, tx, ty - 1);
          else good = rowClear(x, tx, y - 1) && colClear(tx, y - 1, ty - 1);
          if (good) { if (st) push(tx, ty, 0); if (cl) push(tx, ty, 1); }
        }
      }
      if (ab.dash) {
        for (const s of [-1, 1]) for (let k = 1; k <= 3; k++) {
          if (!colClear(x, y - 1, y - 2 - k)) break;
          for (let dx = 1; dx <= 8; dx++) {
            const xx = x + s * dx;
            if (!ok(xx, y - 1 - k) || !ok(xx, y - 2 - k)) break;
            if (dx >= 4) fall(xx, y - k);
            if (ab.claws && (clingAt(xx, y - k, 1) || clingAt(xx, y - k, -1))) push(xx, y - k, 1);
          }
        }
      }
      // exits up
      for (const d of rd.topDoors) if (x >= d.col && x <= d.col + 3 && y <= J + 1 && colClear(x, y - 1, 0)) exits.add('T:' + d.col);
    };
    for (const e of entries) {
      if (e.m === 'fall') fall(e.x, e.y);
      else if (e.m === 'boost') {
        for (let k = 1; k <= 7; k++) {
          const yy = H - k; if (!body(e.x, yy)) break;
          for (let dx = -3; dx <= 3; dx++) { const xx = e.x + dx; if (rowClear(e.x, xx, yy - 1) && stand(xx, yy)) push(xx, yy, 0); }
          if (ab.claws && (clingAt(e.x, yy, 1) || clingAt(e.x, yy, -1))) push(e.x, yy, 1);
        }
      } else push(e.x, e.y, 0);
    }
    while (q.length) {
      const m = q.pop(), y = q.pop(), x = q.pop();
      if (m === 0) {
        if (x <= 1) exits.add('L:' + y); if (x >= W - 2) exits.add('R:' + y);
        for (const s of [-1, 1]) {
          if (stand(x + s, y)) push(x + s, y, 0);
          else if (body(x + s, y)) fall(x + s, y);
          if (clingAt(x, y, s)) push(x, y, 1);
        }
        if (tl(x, y) === P || tl(x, y) === CU) fall(x, y + 1);
        if (inWater(x, y)) push(x, y, 2);
        jumps(x, y);
      } else if (m === 1) {
        for (const s of [-1, 1]) {
          if (!clingAt(x, y, s)) continue;
          if (stand(x + s, y)) push(x + s, y, 0);
          if (stand(x + s, y - 1)) push(x + s, y - 1, 0);
          if (body(x, y - 1)) { if (clingAt(x, y - 1, s)) push(x, y - 1, 1); else if (stand(x + s, y - 1)) push(x + s, y - 1, 0); }
          if (body(x, y + 1)) { if (clingAt(x, y + 1, s)) push(x, y + 1, 1); }
        }
        if (stand(x, y)) push(x, y, 0);
        for (const d of rd.topDoors) if (x >= d.col && x <= d.col + 3 && y <= 2) exits.add('T:' + d.col);
        fall(x, y + 1);
        jumps(x, y);
      } else {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (yy >= H - 1 && rd.bottomOpen && rd.bottomOpen(xx)) { exits.add('B:' + xx); continue; }
          if (!body(xx, yy)) continue;
          if (inWater(xx, yy)) push(xx, yy, 2); else if (stand(xx, yy)) push(xx, yy, 0); else fall(xx, yy);
        }
        if (!wet(tl(x, y - 2))) jumps(x, y);
        if (stand(x, y)) push(x, y, 0);
      }
    }
    return { exits, standSet, anySet, standCount };
  };

  // helpers describing a room's door geometry for the solver
  LF.prepSolver = function (r, rd) {
    rd.topDoors = r.doors.filter(d => d.side === 'T');
    const bd = r.doors.filter(d => d.side === 'B');
    rd.bottomOpen = (x) => bd.some(d => x >= d.col && x <= d.col + 3);
  };
  LF.doorExitKey = (d) => d.side === 'L' ? 'L:' + d.row : d.side === 'R' ? 'R:' + d.row : d.side + ':' + d.col;
  LF.doorEntry = (d, rd) => {
    if (d.side === 'L') return { x: 1, y: d.row };
    if (d.side === 'R') return { x: rd.W - 2, y: d.row };
    if (d.side === 'T') return { m: 'fall', x: d.col + 1, y: 2 };
    return { m: 'boost', x: d.col + 1, y: rd.H };
  };
  LF.exitMatches = (exits, d) => {
    if (d.side === 'B') { for (let x = d.col; x <= d.col + 3; x++) if (exits.has('B:' + x)) return true; return false; }
    return exits.has(LF.doorExitKey(d));
  };
})();
