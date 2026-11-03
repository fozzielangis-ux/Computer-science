// Lanternfall — rendering: terrain, parallax backgrounds, characters, enemies, lighting, fx
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const T = LF.T, TL = LF.TILE, TAU = Math.PI * 2, VW = LF.VW, VH = LF.VH;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  const mix = (h1, h2, t) => { const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16); const r = (a >> 16 & 255) * (1 - t) + (b >> 16 & 255) * t, g = (a >> 8 & 255) * (1 - t) + (b >> 8 & 255) * t, bl = (a & 255) * (1 - t) + (b & 255) * t; return `rgb(${r | 0},${g | 0},${bl | 0})`; };
  LF.hexA = hexA; LF.mix = mix;
  const RN = LF.Render = {};

  // ================================================================= terrain pre-render
  RN.renderRoom = function (room) {
    const rd = room.rd, W = rd.W, H = rd.H, reg = LF.REGIONS[room.def.region], tiles = room.tiles;
    const cv = room.canvas || mk(W * T, H * T), c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    const get = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? TL.S : tiles[y * W + x];
    const solid = (v) => v === TL.S || v === TL.BR || v === TL.SL;
    const rg = LF.rng('art:' + room.def.id);
    // depth map
    const depth = new Uint8Array(W * H).fill(9);
    const q = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!solid(get(x, y))) { depth[y * W + x] = 0; q.push(x, y); }
    for (let i = 0; i < q.length; i += 2) { const x = q[i], y = q[i + 1], d = depth[y * W + x]; if (d >= 4) continue; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const k = yy * W + xx; if (depth[k] > d + 1) { depth[k] = d + 1; q.push(xx, yy); } } }
    const dark = mix(reg.rock, '#000000', 0.55);
    // base fill
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = get(x, y); if (!solid(v)) continue;
      const d = depth[y * W + x];
      c.fillStyle = mix(reg.rock, dark, Math.min(1, (d - 1) / 3));
      c.fillRect(x * T - 0.5, y * T - 0.5, T + 1, T + 1);
    }
    // texture speckles
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(get(x, y)) || depth[y * W + x] > 3) continue;
      const n = 2 + (rg() * 3 | 0);
      for (let i = 0; i < n; i++) {
        c.fillStyle = rg() < 0.5 ? hexA(reg.rockHi, 0.18) : 'rgba(0,0,0,0.18)';
        const px = x * T + rg() * T, py = y * T + rg() * T, r = 1.5 + rg() * 4;
        c.beginPath(); c.ellipse(px, py, r * 1.4, r, rg() * 3, 0, TAU); c.fill();
      }
    }
    // round outer corners
    c.globalCompositeOperation = 'destination-out';
    const rr = 11;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!solid(get(x, y))) continue;
      const u = !solid(get(x, y - 1)), d = !solid(get(x, y + 1)), l = !solid(get(x - 1, y)), r = !solid(get(x + 1, y));
      const corner = (cx, cy, sx, sy) => {
        const ox = cx + sx * rr, oy = cy + sy * rr, a0 = Math.atan2(-sy, 0), a1 = Math.atan2(0, -sx);
        let dlt = a1 - a0; while (dlt <= -Math.PI) dlt += TAU; while (dlt > Math.PI) dlt -= TAU;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(ox, cy); c.arc(ox, oy, rr, a0, a1, dlt < 0); c.closePath(); c.fill();
      };
      if (u && l) corner(x * T, y * T, 1, 1);
      if (u && r) corner((x + 1) * T, y * T, -1, 1);
      if (d && l) corner(x * T, (y + 1) * T, 1, -1);
      if (d && r) corner((x + 1) * T, (y + 1) * T, -1, -1);
    }
    c.globalCompositeOperation = 'source-over';
    // edges
    const wob = (a) => (rg() - 0.5) * a;
    c.lineCap = 'round';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = get(x, y); if (!solid(v)) continue;
      const u = !solid(get(x, y - 1)), d = !solid(get(x, y + 1)), l = !solid(get(x - 1, y)), r = !solid(get(x + 1, y));
      const x0 = x * T + (l ? rr * (u || d ? 1 : 0) : 0), x1 = (x + 1) * T - (r ? rr * (u || d ? 1 : 0) : 0);
      if (u) {
        c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 5; c.beginPath(); c.moveTo(x0, y * T + 1); c.lineTo(x1, y * T + 1 + wob(1)); c.stroke();
        c.strokeStyle = reg.rim; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y * T + 2); c.quadraticCurveTo((x0 + x1) / 2, y * T + 2 + wob(2), x1, y * T + 2); c.stroke();
        c.strokeStyle = hexA(reg.rockHi, 0.6); c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + 2, y * T + 6); c.lineTo(x1 - 2, y * T + 6 + wob(2)); c.stroke();
        RN.topDeco(c, reg, x * T, y * T, rg);
      }
      if (d) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x0, (y + 1) * T - 6, x1 - x0, 6); c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, (y + 1) * T - 1); c.lineTo(x1, (y + 1) * T - 1); c.stroke(); RN.bottomDeco(c, reg, x * T, (y + 1) * T, rg); }
      const y0 = y * T + (u ? rr : 0), y1 = (y + 1) * T - (d ? rr : 0);
      if (l) { c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x * T + 1, y0); c.lineTo(x * T + 1 + wob(2), y1); c.stroke(); c.strokeStyle = hexA(reg.rockHi, 0.35); c.lineWidth = 2; c.beginPath(); c.moveTo(x * T + 4, y0); c.lineTo(x * T + 4, y1); c.stroke(); }
      if (r) { c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3; c.beginPath(); c.moveTo((x + 1) * T - 1, y0); c.lineTo((x + 1) * T - 1 + wob(2), y1); c.stroke(); }
      if (u && l) { c.strokeStyle = reg.rim; c.lineWidth = 3; c.beginPath(); c.arc(x * T + rr, y * T + rr, rr - 1, Math.PI, Math.PI * 1.5); c.stroke(); }
      if (u && r) { c.strokeStyle = reg.rim; c.lineWidth = 3; c.beginPath(); c.arc((x + 1) * T - rr, y * T + rr, rr - 1, Math.PI * 1.5, TAU); c.stroke(); }
      if (v === TL.BR) { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x * T + 8, y * T + 6); c.lineTo(x * T + 16, y * T + 16); c.lineTo(x * T + 12, y * T + 26); c.stroke(); }
      if (v === TL.SL) { c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x * T + 4, y * T + 4); c.lineTo(x * T + 14, y * T + 18); c.lineTo(x * T + 26, y * T + 10); c.moveTo(x * T + 14, y * T + 18); c.lineTo(x * T + 18, y * T + 30); c.stroke(); c.strokeStyle = hexA(reg.rim, 0.5); c.lineWidth = 1; c.stroke(); }
    }
    // static special tiles
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = get(x, y), px = x * T, py = y * T;
      if (v === TL.P) RN.ledge(c, reg, px, py, get(x - 1, y) !== TL.P && get(x - 1, y) !== TL.CU, get(x + 1, y) !== TL.P && get(x + 1, y) !== TL.CU, rg);
      else if (v === TL.SPK) RN.spikes(c, reg, px, py, rg);
      else if (v === TL.TH) RN.thorns(c, reg, px, py, rg);
      else if (v === TL.CR) RN.crystalWall(c, px, py, rg, get(x, y - 1) !== TL.CR);
      else if (v === TL.SE) RN.sealWall(c, px, py, rg, get(x, y - 1) !== TL.SE, get(x, y + 1) !== TL.SE);
      else if (v === TL.KY) RN.keyGate(c, px, py, rg, x, y, get);
    }
    room.canvas = cv;
    // backwall layer
    if (!room.back) {
      const bv = mk(W * T, H * T), b = bv.getContext('2d');
      RN.backwall(b, room, reg, rg, get, solid);
      room.back = bv;
    }
  };

  RN.topDeco = function (c, reg, x, y, rg) {
    const s = reg.bgs;
    if (s === 'forest' || s === 'lake') {
      c.fillStyle = s === 'forest' ? '#5a8a3a' : '#3a7a6a';
      for (let i = 0; i < 3; i++) { const gx = x + rg() * T, h = 4 + rg() * 9; c.beginPath(); c.moveTo(gx - 3, y + 3); c.quadraticCurveTo(gx + (rg() - 0.5) * 6, y - h / 2, gx + (rg() - 0.5) * 4, y - h); c.lineTo(gx + 2, y + 3); c.fill(); }
      if (rg() < 0.25) { c.fillStyle = s === 'forest' ? '#c4f582' : '#a5ffff'; c.beginPath(); c.arc(x + rg() * T, y - 2, 2, 0, TAU); c.fill(); }
    } else if (s === 'crystal') {
      if (rg() < 0.3) { const gx = x + rg() * T, h = 6 + rg() * 14; c.fillStyle = hexA('#83f2ff', 0.7); c.beginPath(); c.moveTo(gx - 4, y + 2); c.lineTo(gx, y - h); c.lineTo(gx + 4, y + 2); c.fill(); c.fillStyle = '#fff'; c.fillRect(gx - 1, y - h * 0.6, 1, h * 0.4); }
    } else if (s === 'volcano') {
      if (rg() < 0.3) { c.fillStyle = 'rgba(255,140,60,0.5)'; c.fillRect(x + rg() * T, y + 3, 6, 2); }
    } else if (s === 'gloam') {
      if (rg() < 0.2) { c.strokeStyle = 'rgba(196,125,255,0.4)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + rg() * T, y); c.quadraticCurveTo(x + rg() * T, y - 10, x + rg() * T, y - 16); c.stroke(); }
    } else if (s === 'heart' || s === 'temple') {
      if (rg() < 0.15) { c.fillStyle = hexA(reg.accent, 0.5); c.fillRect(x + rg() * T, y + 2, 3, 3); }
    } else {
      if (rg() < 0.25) { c.fillStyle = hexA(reg.rockHi, 0.8); c.beginPath(); c.ellipse(x + rg() * T, y + 1, 3 + rg() * 3, 2, 0, 0, TAU); c.fill(); }
    }
  };
  RN.bottomDeco = function (c, reg, x, y, rg) {
    const s = reg.bgs;
    if ((s === 'forest' || s === 'lake') && rg() < 0.35) { c.strokeStyle = s === 'forest' ? '#3f5b37' : '#2a5a50'; c.lineWidth = 2; const gx = x + rg() * T, h = 10 + rg() * 30; c.beginPath(); c.moveTo(gx, y); c.quadraticCurveTo(gx + (rg() - 0.5) * 10, y + h / 2, gx + (rg() - 0.5) * 6, y + h); c.stroke(); }
    else if (s === 'crystal' && rg() < 0.2) { c.fillStyle = hexA('#b9a2ff', 0.6); const gx = x + rg() * T; c.beginPath(); c.moveTo(gx - 4, y); c.lineTo(gx, y + 8 + rg() * 12); c.lineTo(gx + 4, y); c.fill(); }
    else if (rg() < 0.2) { c.fillStyle = 'rgba(0,0,0,0.5)'; const gx = x + rg() * T; c.beginPath(); c.moveTo(gx - 3, y); c.lineTo(gx, y + 4 + rg() * 8); c.lineTo(gx + 3, y); c.fill(); }
  };
  RN.ledge = function (c, reg, x, y, capL, capR, rg) {
    const s = reg.bgs;
    const wood = s === 'forest' || s === 'town' || s === 'lake';
    c.fillStyle = wood ? '#4a3520' : mix(reg.rockHi, '#000000', 0.25);
    c.fillRect(x, y, T, 10);
    c.fillStyle = wood ? '#6a4a2a' : reg.rockHi; c.fillRect(x, y, T, 3);
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 10); c.lineTo(x + T, y + 10); c.stroke();
    if (wood) { c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 12, y + 3); c.lineTo(x + 12, y + 10); c.stroke(); }
    if (capL) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x, y, 3, 10); if (wood) { c.strokeStyle = '#3a2a18'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 4, y + 10); c.lineTo(x + 10, y + 22); c.stroke(); } }
    if (capR) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x + T - 3, y, 3, 10); if (wood) { c.strokeStyle = '#3a2a18'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + T - 4, y + 10); c.lineTo(x + T - 10, y + 22); c.stroke(); } }
  };
  RN.spikes = function (c, reg, x, y) {
    const col = reg.bgs === 'forest' ? '#8a7a3a' : reg.bgs === 'crystal' ? '#83f2ff' : '#b0a8a0';
    for (let i = 0; i < 4; i++) { const sx = x + i * 8 + 4; c.fillStyle = col; c.beginPath(); c.moveTo(sx - 4, y + T); c.lineTo(sx, y + 8); c.lineTo(sx + 4, y + T); c.fill(); c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.moveTo(sx, y + 8); c.lineTo(sx + 4, y + T); c.lineTo(sx + 1, y + T); c.fill(); }
  };
  RN.thorns = function (c, reg, x, y, rg) {
    c.fillStyle = '#2a2a1a'; c.fillRect(x + 6, y, T - 12, T);
    c.fillStyle = '#9a8a5a';
    for (let i = 0; i < 6; i++) { const yy = y + rg() * T, s = rg() < 0.5 ? -1 : 1; c.beginPath(); c.moveTo(x + T / 2, yy); c.lineTo(x + T / 2 + s * 18, yy - 4); c.lineTo(x + T / 2, yy - 6); c.fill(); }
  };
  RN.crystalWall = function (c, x, y, rg, top) {
    const g = c.createLinearGradient(x, y, x + T, y + T); g.addColorStop(0, '#83f2ff'); g.addColorStop(1, '#4c40a0');
    c.fillStyle = g; c.beginPath(); c.moveTo(x + 4, y + T); c.lineTo(x + 2, y + (top ? 10 : 0)); c.lineTo(x + 16, y - (top ? 6 : 0)); c.lineTo(x + 30, y + (top ? 8 : 0)); c.lineTo(x + 28, y + T); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + 10, y + 4); c.lineTo(x + 8, y + 26); c.stroke();
  };
  RN.sealWall = function (c, x, y, rg, top, bot) {
    c.fillStyle = '#8a2a1a'; c.fillRect(x + 4, y, T - 8, T);
    c.fillStyle = '#b8402a'; c.fillRect(x + 8, y, 6, T);
    if (rg() < 0.5) { c.fillStyle = '#d86a3a'; c.beginPath(); c.arc(x + T / 2, y + T / 2, 8, 0, TAU); c.fill(); c.fillStyle = '#5a1a10'; c.fillRect(x + T / 2 - 1, y + T / 2 - 5, 2, 10); }
    if (bot) { c.fillStyle = '#8a2a1a'; c.beginPath(); c.arc(x + 12, y + T, 5, 0, Math.PI); c.fill(); }
  };
  RN.keyGate = function (c, x, y, rg, tx, ty, get) {
    c.fillStyle = '#3a3018'; c.fillRect(x, y, T, T);
    c.strokeStyle = '#ffe28c'; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, T - 6, T - 6);
    if (get(tx - 1, ty) !== TL.KY && ty === 1) { c.fillStyle = '#ffe28c'; c.beginPath(); c.arc(x + 2 * T, y + T / 2, 12, 0, TAU); c.fill(); c.fillStyle = '#3a3018'; c.beginPath(); c.arc(x + 2 * T, y + T / 2 - 2, 4, 0, TAU); c.fill(); c.fillRect(x + 2 * T - 2, y + T / 2, 4, 8); }
  };

  RN.backwall = function (b, room, reg, rg, get, solid) {
    const W = room.rd.W, H = room.rd.H, s = reg.bgs;
    const base = mix(reg.bg[1], reg.rock, 0.35);
    b.fillStyle = hexA(base.startsWith('rgb') ? '#000000' : base, 0);
    // soft back rock with ambient occlusion near walls
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (solid(get(x, y))) continue;
      let near = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (solid(get(x + dx, y + dy))) near++;
      b.fillStyle = `rgba(0,0,0,${0.06 + near * 0.022})`; b.fillRect(x * T, y * T, T, T);
    }
    b.globalAlpha = 0.22;
    if (s === 'halls' || s === 'city' || s === 'temple' || s === 'town' || s === 'heart' || s === 'ruins') {
      b.strokeStyle = reg.rockHi; b.lineWidth = 2;
      for (let y = 0; y < H * T; y += 24) { const off = (y / 24) % 2 ? 0 : 24; for (let x = off; x < W * T; x += 48) { if (rg() < 0.75) b.strokeRect(x + 1, y + 1, 46, 22); } }
      // pillars
      for (let x = 200 + rg() * 200; x < W * T; x += 300 + rg() * 260) { b.fillStyle = reg.rockHi; b.fillRect(x, 0, 36, H * T); b.fillStyle = reg.rock; b.fillRect(x + 6, 0, 8, H * T); }
    } else if (s === 'forest' || s === 'lake') {
      for (let i = 0; i < W / 3; i++) { b.strokeStyle = s === 'forest' ? '#3f5b37' : '#2a5a60'; b.lineWidth = 3 + rg() * 6; const x = rg() * W * T; b.beginPath(); b.moveTo(x, 0); b.bezierCurveTo(x + (rg() - 0.5) * 200, H * T * 0.3, x + (rg() - 0.5) * 200, H * T * 0.7, x + (rg() - 0.5) * 100, H * T); b.stroke(); }
    } else if (s === 'crystal') {
      for (let i = 0; i < W; i++) { const x = rg() * W * T, y = rg() * H * T, h = 20 + rg() * 60; b.fillStyle = rg() < 0.5 ? '#83f2ff' : '#b9a2ff'; b.beginPath(); b.moveTo(x - 8, y); b.lineTo(x, y - h); b.lineTo(x + 8, y); b.fill(); }
    } else if (s === 'volcano') {
      for (let i = 0; i < W / 2; i++) { b.strokeStyle = '#ff6a2a'; b.lineWidth = 1 + rg() * 2; const x = rg() * W * T, y = rg() * H * T; b.beginPath(); b.moveTo(x, y); b.lineTo(x + (rg() - 0.5) * 60, y + 30 + rg() * 50); b.lineTo(x + (rg() - 0.5) * 80, y + 80 + rg() * 60); b.stroke(); }
    } else if (s === 'gloam') {
      for (let i = 0; i < W / 3; i++) { b.fillStyle = '#c47dff'; const x = rg() * W * T, y = rg() * H * T; b.beginPath(); b.ellipse(x, y, 3, 1.5, 0, 0, TAU); b.fill(); b.beginPath(); b.ellipse(x + 10, y, 3, 1.5, 0, 0, TAU); b.fill(); }
    }
    b.globalAlpha = 1;
  };

  // ================================================================= parallax backgrounds
  const bgCache = {};
  RN.bgLayers = function (regId) {
    if (bgCache[regId]) return bgCache[regId];
    const reg = LF.REGIONS[regId], rg = LF.rng('bg:' + regId), out = [];
    for (let L = 0; L < 3; L++) {
      const cv = mk(VW, VH), c = cv.getContext('2d');
      const tone = mix(reg.bg[0], reg.rock, 0.3 + L * 0.25), dark = mix(reg.bg[1], '#000000', 0.2 + L * 0.2);
      const fog = mix(tone, reg.bg[0], 0.4 - L * 0.1);
      RN.drawBgStyle(c, reg, L, rg, L === 2 ? dark : fog);
      out.push({ cv, f: [0.12, 0.3, 0.55][L] });
    }
    bgCache[regId] = out;
    return out;
  };
  RN.drawBgStyle = function (c, reg, L, rg, col) {
    const s = reg.bgs, wrap = (fn) => { fn(0); fn(-VW); fn(VW); };
    c.fillStyle = col; c.strokeStyle = col;
    const glow = (x, y, r, color, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexA(color, a)); g.addColorStop(1, hexA(color, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.fillStyle = col; };
    const n = 4 + L * 3;
    if (s === 'town' || s === 'city') {
      for (let i = 0; i < n * 2; i++) {
        const x = rg() * VW, w = 50 + rg() * 90, h = 120 + rg() * (s === 'city' ? 320 : 200) - L * 30;
        wrap(o => { c.fillStyle = col; c.fillRect(x + o, VH - h, w, h); c.beginPath(); c.moveTo(x + o - 8, VH - h); c.lineTo(x + o + w / 2, VH - h - 30 - rg() * 30); c.lineTo(x + o + w + 8, VH - h); c.fill();
          if (s === 'city' && rg() < 0.4) { c.beginPath(); c.arc(x + o + w / 2, VH - h - 40, 12, Math.PI, 0); c.fill(); }
          for (let k = 0; k < 6; k++) if (rg() < 0.5) { const wx = x + o + 8 + rg() * (w - 20), wy = VH - h + 20 + rg() * (h - 40); glow(wx + 4, wy + 5, 16, reg.accent, 0.25 / (L + 1)); c.fillStyle = hexA(reg.accent, 0.5 / (L * 0.6 + 1)); c.fillRect(wx, wy, 8, 10); c.fillStyle = col; } });
      }
      for (let i = 0; i < 3; i++) { const x = rg() * VW; c.beginPath(); c.moveTo(x - 300, 0); c.quadraticCurveTo(x, 260 + L * 30, x + 300, 0); c.lineTo(x + 340, 0); c.quadraticCurveTo(x, 300 + L * 30, x - 340, 0); c.fill(); }
    } else if (s === 'halls' || s === 'temple' || s === 'heart') {
      for (let i = 0; i < n; i++) {
        const x = rg() * VW, w = 40 + rg() * 50 + L * 10;
        wrap(o => { c.fillRect(x + o, 0, w, VH); c.fillRect(x + o - 10, 40 + rg() * 30, w + 20, 14); c.fillRect(x + o - 10, VH - 80, w + 20, 18);
          c.beginPath(); c.moveTo(x + o + w, 120); c.quadraticCurveTo(x + o + w + 120, -20 + L * 20, x + o + w + 240, 120); c.lineTo(x + o + w + 240, 100); c.quadraticCurveTo(x + o + w + 120, -50, x + o + w, 100); c.fill();
          if (s === 'temple' && rg() < 0.5) { c.save(); c.strokeStyle = hexA(reg.accent, 0.3); c.lineWidth = 3; c.beginPath(); c.ellipse(x + o + w / 2, 220, 20, 12, 0, 0, TAU); c.stroke(); c.restore(); }
          if (s === 'heart' && rg() < 0.6) glow(x + o + w / 2, 160 + rg() * 200, 80, reg.accent, 0.15);
          if (s === 'halls' && rg() < 0.5) { c.save(); c.fillStyle = hexA(reg.accent, 0.08 + L * 0.04); c.beginPath(); c.moveTo(x + o + w + 20, 140); c.lineTo(x + o + w + 60, 140); c.lineTo(x + o + w + 60, 300); c.lineTo(x + o + w + 40, 280); c.lineTo(x + o + w + 20, 300); c.fill(); c.restore(); }
        });
      }
    } else if (s === 'forest') {
      for (let i = 0; i < n * 1.5; i++) {
        const x = rg() * VW, w = 20 + rg() * 40 + L * 12;
        wrap(o => { c.beginPath(); c.moveTo(x + o, VH); c.bezierCurveTo(x + o - 20, VH * 0.6, x + o + 30, VH * 0.3, x + o + 5, 0); c.lineTo(x + o + w, 0); c.bezierCurveTo(x + o + w + 20, VH * 0.4, x + o + w - 10, VH * 0.7, x + o + w + 10, VH); c.fill();
          for (let k = 0; k < 4; k++) { const ly = rg() * VH * 0.8; c.beginPath(); c.ellipse(x + o + w / 2 + (rg() - 0.5) * 120, ly, 40 + rg() * 50, 14 + rg() * 12, (rg() - 0.5), 0, TAU); c.fill(); }
          if (rg() < 0.6) glow(x + o + (rg() - 0.5) * 100, rg() * VH, 30, reg.accent, 0.2 / (L + 1)); });
      }
    } else if (s === 'ruins') {
      for (let i = 0; i < n; i++) {
        const x = rg() * VW, w = 40 + rg() * 40, h = 150 + rg() * 280;
        wrap(o => { c.fillRect(x + o, VH - h, w, h); c.fillRect(x + o - 8, VH - h - 12, w + 16, 14); c.beginPath(); c.moveTo(x + o, VH - h - 12); c.lineTo(x + o + w * 0.3, VH - h - 40); c.lineTo(x + o + w * 0.6, VH - h - 18); c.lineTo(x + o + w, VH - h - 12); c.fill();
          if (rg() < 0.3) { c.beginPath(); c.arc(x + o + w + 60, VH - 60, 50, 0, TAU); c.fill(); } });
      }
    } else if (s === 'crystal') {
      for (let i = 0; i < n * 2; i++) {
        const x = rg() * VW, h = 80 + rg() * 300, w = 20 + rg() * 40, up = rg() < 0.6;
        wrap(o => { c.beginPath(); if (up) { c.moveTo(x + o - w, VH); c.lineTo(x + o, VH - h); c.lineTo(x + o + w, VH); } else { c.moveTo(x + o - w, 0); c.lineTo(x + o, h * 0.7); c.lineTo(x + o + w, 0); } c.fill();
          if (rg() < 0.5) glow(x + o, up ? VH - h * 0.6 : h * 0.4, 60, rg() < 0.5 ? '#83f2ff' : '#b9a2ff', 0.18 / (L + 1)); });
      }
    } else if (s === 'lake') {
      for (let i = 0; i < n * 2; i++) { const x = rg() * VW, h = 60 + rg() * 220, w = 14 + rg() * 30; wrap(o => { c.beginPath(); c.moveTo(x + o - w, 0); c.lineTo(x + o, h); c.lineTo(x + o + w, 0); c.fill(); c.globalAlpha = 0.35; c.beginPath(); c.moveTo(x + o - w, VH); c.lineTo(x + o, VH - h * 0.5); c.lineTo(x + o + w, VH); c.fill(); c.globalAlpha = 1; }); }
      const g = c.createLinearGradient(0, VH - 140, 0, VH); g.addColorStop(0, hexA(reg.accent, 0)); g.addColorStop(1, hexA(reg.accent, 0.12 / (L + 1))); c.fillStyle = g; c.fillRect(0, VH - 140, VW, 140);
    } else if (s === 'volcano') {
      for (let i = 0; i < n * 1.5; i++) { const x = rg() * VW, h = 100 + rg() * 300, w = 40 + rg() * 80; wrap(o => { c.beginPath(); c.moveTo(x + o - w, VH); c.lineTo(x + o - w * 0.3, VH - h); c.lineTo(x + o + w * 0.2, VH - h * 0.8); c.lineTo(x + o + w, VH); c.fill(); }); }
      const g = c.createLinearGradient(0, VH * 0.5, 0, VH); g.addColorStop(0, 'rgba(255,90,30,0)'); g.addColorStop(1, `rgba(255,90,30,${0.25 / (L + 1)})`); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      if (L === 1) for (let i = 0; i < 3; i++) { const x = rg() * VW; const g2 = c.createLinearGradient(x, 0, x + 20, 0); g2.addColorStop(0, 'rgba(255,140,40,0)'); g2.addColorStop(0.5, 'rgba(255,160,60,0.35)'); g2.addColorStop(1, 'rgba(255,140,40,0)'); c.fillStyle = g2; c.fillRect(x, 0, 20, VH); }
    } else if (s === 'gloam') {
      for (let i = 0; i < n * 1.5; i++) { const x = rg() * VW, h = 160 + rg() * 360, w = 10 + rg() * 30; wrap(o => { c.beginPath(); c.moveTo(x + o - w, VH); c.lineTo(x + o, VH - h); c.lineTo(x + o + w, VH); c.fill();
        if (rg() < 0.4) { c.save(); c.fillStyle = hexA(reg.accent, 0.4 / (L + 1)); const ey = rg() * VH * 0.7; c.beginPath(); c.ellipse(x + o + 30, ey, 4, 2, 0, 0, TAU); c.ellipse(x + o + 44, ey, 4, 2, 0, 0, TAU); c.fill(); c.restore(); } }); }
    }
  };

  // ================================================================= dynamic tiles (per frame)
  RN.drawDynamicTiles = function (c, G, cam) {
    const room = G.room, rd = room.rd, W = rd.W, reg = LF.REGIONS[room.def.region], t = G.time;
    const x0 = Math.max(0, Math.floor(cam.x / T) - 1), x1 = Math.min(W - 1, Math.ceil((cam.x + VW) / T) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.min(rd.H - 1, Math.ceil((cam.y + VH) / T) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = room.tiles[y * W + x], px = x * T, py = y * T;
      if (v === TL.WATER || v === TL.GLOOM || v === TL.LAVA) {
        const top = room.tile(x, y - 1) !== v;
        const col = v === TL.WATER ? 'rgba(90,190,200,0.45)' : v === TL.GLOOM ? 'rgba(14,10,30,0.86)' : '#ff6a1a';
        c.fillStyle = col;
        if (top) { const wv = Math.sin(t * 2.5 + x * 0.9) * 2.5; c.fillRect(px, py + 6 + wv, T, T - 6 - wv); c.fillStyle = v === TL.LAVA ? '#ffd36a' : v === TL.GLOOM ? 'rgba(140,90,220,0.7)' : 'rgba(200,255,255,0.7)'; c.fillRect(px, py + 5 + wv, T, 2.5); }
        else c.fillRect(px, py, T, T);
        if (v === TL.LAVA && Math.random() < 0.02) G.particle(px + Math.random() * T, py + 6, { vx: 0, vy: -120, life: 0.6, col: '#ffb243', size: 3, glow: true, grav: 300 });
        if (v === TL.GLOOM && Math.random() < 0.01) G.particle(px + Math.random() * T, py + 10, { vx: 0, vy: -20, life: 1, col: '#8a5aff', size: 2, glow: true });
      } else if (v === TL.VE) {
        const a = 0.35 + Math.sin(t * 3 + y * 0.6) * 0.15;
        c.fillStyle = `rgba(230,200,255,${a})`; c.fillRect(px + 8, py, 16, T);
        c.fillStyle = `rgba(255,255,255,${a * 0.8})`; c.fillRect(px + 14 + Math.sin(t * 4 + y) * 4, py, 3, T);
      } else if (v === TL.CU) {
        const cr = room.crumbleState(x, y);
        if (cr.gone) continue;
        const shake = cr.t > 0 ? (Math.random() - 0.5) * 3 : 0;
        c.fillStyle = mix(reg.rockHi, '#000000', 0.3); c.fillRect(px + shake, py, T, 12); c.fillStyle = reg.rim; c.fillRect(px + shake, py, T, 3);
        c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(px + 8 + shake, py + 2); c.lineTo(px + 14 + shake, py + 12); c.moveTo(px + 22 + shake, py + 3); c.lineTo(px + 18 + shake, py + 11); c.stroke();
      }
    }
  };

  // ================================================================= props
  RN.drawProp = function (c, p, reg, t, front) {
    const s = p.s, r = p.r;
    c.save(); c.translate(p.x, p.y);
    switch (p.k) {
      case 'tuft': c.fillStyle = reg.bgs === 'forest' ? '#5a8a3a' : reg.bgs === 'volcano' ? '#3a2018' : hexA(reg.rockHi, 0.9); for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.3 + Math.sin(t * 1.5 + p.x) * 0.08; c.save(); c.rotate(a); c.beginPath(); c.ellipse(0, -8 * s, 2, 9 * s, 0, 0, TAU); c.fill(); c.restore(); } break;
      case 'rock': c.fillStyle = reg.rockHi; c.beginPath(); c.ellipse(0, -5 * s, 12 * s, 7 * s, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(3, -3 * s, 8 * s, 3 * s, 0, 0, Math.PI); c.fill(); break;
      case 'lamp': c.fillStyle = '#1a1418'; c.fillRect(-2, -70 * s, 4, 70 * s); c.fillRect(-8, -72 * s, 16, 4); c.fillStyle = reg.accent; c.shadowColor = reg.accent; c.shadowBlur = 20; c.beginPath(); c.ellipse(0, -80 * s, 6, 9, 0, 0, TAU); c.fill(); c.shadowBlur = 0; c.strokeStyle = '#1a1418'; c.lineWidth = 2; c.strokeRect(-7, -90 * s, 14, 18); break;
      case 'statue': c.fillStyle = mix(reg.rockHi, '#000000', 0.2); c.fillRect(-14 * s, -14, 28 * s, 14); c.beginPath(); c.ellipse(0, -40 * s, 12 * s, 26 * s, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(0, -72 * s, 10 * s, 0, TAU); c.fill(); c.fillStyle = hexA(reg.accent, 0.5); c.beginPath(); c.arc(-3, -73 * s, 2, 0, TAU); c.arc(4, -73 * s, 2, 0, TAU); c.fill(); break;
      case 'mushroom': c.fillStyle = '#d8d0b0'; c.fillRect(-3, -20 * s, 6, 20 * s); c.fillStyle = r < 0.5 ? '#c4f582' : '#e6c8ff'; c.shadowColor = c.fillStyle; c.shadowBlur = 16; c.beginPath(); c.ellipse(0, -22 * s, 16 * s, 9 * s, 0, Math.PI, 0); c.fill(); c.shadowBlur = 0; break;
      case 'column': c.fillStyle = mix(reg.rockHi, '#000000', 0.15); c.fillRect(-12 * s, -60 * s, 24 * s, 60 * s); c.fillRect(-16 * s, -66 * s, 32 * s, 8); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 7 * s, -58 * s); c.lineTo(i * 7 * s, 0); c.stroke(); } c.fillStyle = hexA('#74e4d4', 0.7); c.fillRect(-2, -40 * s, 4, 4); break;
      case 'crystal': for (let i = -1; i <= 1; i++) { const h = (30 + Math.abs(i) * -8 + r * 20) * s; c.fillStyle = i === 0 ? '#83f2ff' : '#b9a2ff'; c.shadowColor = '#83f2ff'; c.shadowBlur = 14; c.beginPath(); c.moveTo(i * 10 - 6, 0); c.lineTo(i * 12, -h); c.lineTo(i * 10 + 6, 0); c.fill(); } c.shadowBlur = 0; break;
      case 'reed': c.strokeStyle = '#3a6a5a'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { const sw = Math.sin(t * 1.2 + i + p.x * 0.01) * 4; c.beginPath(); c.moveTo(i * 5 - 8, 0); c.quadraticCurveTo(i * 5 - 8 + sw / 2, -25 * s, i * 5 - 8 + sw, -50 * s); c.stroke(); } c.fillStyle = '#a5ffff'; c.shadowColor = '#a5ffff'; c.shadowBlur = 10; c.beginPath(); c.arc(Math.sin(t * 1.2) * 4, -52 * s, 3, 0, TAU); c.fill(); c.shadowBlur = 0; break;
      case 'vent': c.fillStyle = '#2c1b17'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(-6, -16); c.lineTo(6, -16); c.lineTo(18, 0); c.fill(); c.fillStyle = '#ff8c4c'; c.shadowColor = '#ff8c4c'; c.shadowBlur = 16; c.fillRect(-5, -18, 10, 4); c.shadowBlur = 0; break;
      case 'candle': c.fillStyle = '#e8dcc0'; for (let i = -1; i <= 1; i++) { const h = (14 + (i + 1) * 6 * r) * s; c.fillRect(i * 9 - 3, -h, 6, h); c.fillStyle = reg.accent; c.shadowColor = reg.accent; c.shadowBlur = 12; c.beginPath(); c.ellipse(i * 9, -h - 5 + Math.sin(t * 9 + i) * 1, 2.5, 5, 0, 0, TAU); c.fill(); c.shadowBlur = 0; c.fillStyle = '#e8dcc0'; } break;
      case 'spire': c.fillStyle = '#0a0810'; c.beginPath(); c.moveTo(-10 * s, 0); c.lineTo(0, -70 * s); c.lineTo(10 * s, 0); c.fill(); c.fillStyle = hexA(reg.accent, 0.6 + Math.sin(t * 2 + p.x) * 0.3); c.beginPath(); c.arc(0, -40 * s, 3, 0, TAU); c.fill(); break;
      case 'vine': c.strokeStyle = reg.bgs === 'lake' ? '#2a5a50' : '#3f5b37'; c.lineWidth = 3; const len = 60 * s + r * 60, sw = Math.sin(t * 0.9 + p.x * 0.02) * 8; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sw, len / 2, sw * 1.5, len); c.stroke(); c.fillStyle = reg.bgs === 'lake' ? '#3a7a6a' : '#5a8a3a'; for (let i = 1; i < 5; i++) { c.beginPath(); c.ellipse(sw * i / 4 * 1.2 + 4, len * i / 5, 5, 2.5, 0.6, 0, TAU); c.fill(); } break;
      case 'icicle': c.fillStyle = hexA('#b9a2ff', 0.8); c.beginPath(); c.moveTo(-7, 0); c.lineTo(0, 30 * s + r * 20); c.lineTo(7, 0); c.fill(); break;
      case 'chain': c.strokeStyle = '#3a3a44'; c.lineWidth = 2; const cl = 50 + r * 120; for (let y = 0; y < cl; y += 8) { c.beginPath(); c.ellipse(Math.sin(t * 0.7 + p.x) * (y / cl) * 4, y, 2.5, 4, 0, 0, TAU); c.stroke(); } if (r > 0.5) { c.fillStyle = '#1a1418'; c.fillRect(-8, cl, 16, 14); c.fillStyle = reg.accent; c.globalAlpha = 0.8; c.fillRect(-5, cl + 3, 10, 8); c.globalAlpha = 1; } break;
      case 'drip': c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.moveTo(-5, 0); c.lineTo(0, 14 * s); c.lineTo(5, 0); c.fill(); break;
      case 'banner': { const h = 90, w = 34, sw2 = Math.sin(t * 1.2 + p.x) * 3; c.fillStyle = '#1a1418'; c.fillRect(-4, -4, w + 8, 4); const bc = reg.bgs === 'temple' ? '#5d3a6a' : reg.bgs === 'heart' ? '#8a6a2a' : reg.bgs === 'city' ? '#2a3a5a' : '#4a2a3a'; c.fillStyle = bc; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(w + sw2, h); c.lineTo(w / 2 + sw2, h - 14); c.lineTo(sw2, h); c.closePath(); c.fill(); c.strokeStyle = hexA(reg.accent, 0.5); c.lineWidth = 2; c.beginPath(); c.arc(w / 2 + sw2 / 2, h * 0.4, 8, 0, TAU); c.stroke(); break; }
    }
    c.restore();
  };

  // ================================================================= player
  RN.drawPlayer = function (c, p, G) {
    if (p.dead && p.deathAnim > 1.2) return;
    const t = G.time, x = p.cx, y = p.bottom, f = p.face;
    const blink = p.inv > 0 && !p.veiling && Math.floor(t * 20) % 2 === 0;
    c.save();
    if (blink) c.globalAlpha = 0.35;
    if (p.dashT > 0 && p.veiling) c.globalAlpha = 0.55;
    // cape
    const cp = p.cape;
    c.fillStyle = '#1b1622'; c.strokeStyle = '#0a080e'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cp[0].x - 7, cp[0].y);
    for (let i = 1; i < cp.length; i++) c.lineTo(cp[i].x - (7 + i * 1.4) * (i % 2 ? 1 : 0.85), cp[i].y);
    for (let i = cp.length - 1; i >= 1; i--) c.lineTo(cp[i].x + (7 + i * 1.4), cp[i].y + (i === cp.length - 1 ? 3 : 0));
    c.lineTo(cp[0].x + 7, cp[0].y); c.closePath(); c.fill(); c.stroke();
    c.translate(x, y);
    const sq = p.squash, sx = 1 / Math.sqrt(sq), sy = sq;
    c.scale(f * sx, sy);
    // legs
    const run = p.onGround && Math.abs(p.vx) > 40 ? p.runT : 0;
    c.strokeStyle = '#120e16'; c.lineWidth = 4; c.lineCap = 'round';
    const l1 = Math.sin(run * 1.1) * 6, l2 = Math.sin(run * 1.1 + Math.PI) * 6;
    if (!p.onGround) { c.beginPath(); c.moveTo(-3, -14); c.lineTo(-5, -4); c.moveTo(3, -14); c.lineTo(6, -6); c.stroke(); }
    else if (p.sitting) { c.beginPath(); c.moveTo(-3, -14); c.lineTo(6, -12); c.lineTo(7, -2); c.moveTo(3, -14); c.lineTo(10, -12); c.lineTo(11, -2); c.stroke(); }
    else { c.beginPath(); c.moveTo(-3, -14); c.lineTo(-3 + l1, -1); c.moveTo(3, -14); c.lineTo(3 + l2, -1); c.stroke(); }
    // body
    const body = c.createLinearGradient(0, -30, 0, -10); body.addColorStop(0, '#2a2234'); body.addColorStop(1, '#16121c');
    c.fillStyle = body; c.beginPath(); c.moveTo(-9, -12); c.quadraticCurveTo(-10, -28, 0, -29); c.quadraticCurveTo(10, -28, 9, -12); c.quadraticCurveTo(0, -9, -9, -12); c.fill();
    // arm + needle
    const atk = p.atkT > 0, ang = atk ? (p.atkDir === 'up' ? -1.6 : p.atkDir === 'down' ? 1.6 : p.combo === 1 ? -0.3 : 0.2) : p.chargeT > 0.2 ? -2.2 : p.focusing ? -0.9 : 0.6 + Math.sin(t * 2) * 0.05;
    c.save(); c.translate(4, -22); c.rotate(ang);
    c.strokeStyle = '#16121c'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 0); c.stroke();
    c.strokeStyle = p.charged ? '#fff' : '#d8dcea'; c.lineWidth = 2; c.beginPath(); c.moveTo(9, 0); c.lineTo(31, 0); c.stroke();
    c.fillStyle = '#ffd27a'; c.fillRect(7, -2.5, 3, 5);
    if (p.charged) { c.shadowColor = '#fff'; c.shadowBlur = 12; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(9, 0); c.lineTo(31, 0); c.stroke(); c.shadowBlur = 0; }
    c.restore();
    // head: lantern
    const hy = -40;
    c.fillStyle = '#0f0c12'; c.beginPath(); c.moveTo(-8, hy - 11); c.lineTo(8, hy - 11); c.lineTo(5, hy - 15); c.lineTo(-5, hy - 15); c.fill();
    c.fillRect(-1.5, hy - 19, 3, 4);
    const glass = c.createRadialGradient(0, hy, 2, 0, hy, 12); glass.addColorStop(0, '#fff7da'); glass.addColorStop(0.55, '#f0d9a0'); glass.addColorStop(1, '#b89a6a');
    c.fillStyle = glass; c.beginPath(); c.ellipse(0, hy, 10, 11, 0, 0, TAU); c.fill();
    c.strokeStyle = '#0f0c12'; c.lineWidth = 2.5; c.stroke();
    c.beginPath(); c.moveTo(-10, hy + 2); c.lineTo(10, hy + 2); c.lineWidth = 1.2; c.strokeStyle = 'rgba(15,12,18,0.5)'; c.stroke();
    // inner flame
    const fl = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 7.3) * 0.08;
    c.fillStyle = p.inv > 0 && !p.veiling ? '#ffb3a0' : '#ffb347'; c.beginPath(); c.moveTo(0, hy - 7 * fl); c.quadraticCurveTo(5, hy + 1, 0, hy + 5); c.quadraticCurveTo(-5, hy + 1, 0, hy - 7 * fl); c.fill();
    c.fillStyle = '#fffbe8'; c.beginPath(); c.ellipse(0, hy + 1, 2, 3 * fl, 0, 0, TAU); c.fill();
    // eyes
    const eyeY = hy - 1, closed = p.sitting && Math.sin(t) > 0.7;
    c.fillStyle = '#0f0c12';
    if (closed) { c.fillRect(1.5, eyeY, 4, 1.5); c.fillRect(-6, eyeY, 4, 1.5); }
    else { c.beginPath(); c.ellipse(4, eyeY, 2, 3, 0, 0, TAU); c.ellipse(-4, eyeY, 2, 3, 0, 0, TAU); c.fill(); }
    c.restore();
    // focus aura
    if (p.focusing) { const k = p.focusT / G.stats.focusTime; c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(255,220,150,${0.3 + k * 0.5})`; c.lineWidth = 3; c.beginPath(); c.arc(x, p.cy, 34 - k * 14, 0, TAU); c.stroke(); c.restore(); }
    // slash arcs
    if (p.atkT > 0) {
      const total = 0.22 * G.stats.atkSpeed, el = total - p.atkT, k = LF.clamp(el / 0.14, 0, 1);
      if (k < 1) {
        const box = p.attackBox(G.stats), cx = box.x + box.w / 2, cy = box.y + box.h / 2;
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k;
        c.translate(cx, cy);
        if (p.atkDir === 'up') c.rotate(-Math.PI / 2 * f); else if (p.atkDir === 'down') c.rotate(Math.PI / 2 * f);
        c.scale(f * (p.combo === 1 ? 1 : 1), p.combo === 1 ? -1 : 1);
        const rad = Math.max(box.w, box.h) * 0.55, a0 = -1.2 + k * 0.4, a1 = 1.2;
        const grd = c.createLinearGradient(-rad, 0, rad, 0); grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(1, p.combo === 2 ? 'rgba(255,230,160,0.95)' : 'rgba(255,255,255,0.95)');
        c.fillStyle = grd; c.beginPath(); c.arc(-rad * 0.35, 0, rad, a0, a1); c.arc(-rad * 0.6, 0, rad * 0.8, a1, a0, true); c.closePath(); c.fill();
        c.restore();
      }
    }
    if (p.cleaveT > 0) { const k = 1 - p.cleaveT / 0.25; c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.strokeStyle = '#fff6d8'; c.lineWidth = 14 * (1 - k) + 2; c.beginPath(); c.ellipse(p.cx, p.cy, 60 + k * 50, 30 + k * 20, 0, 0, TAU); c.stroke(); c.restore(); }
  };

  // ================================================================= enemies
  RN.drawEnemy = function (c, e, G) {
    const d = e.def, t = e.anim, fl = e.flash > 0;
    const C = (col) => fl ? '#ffffff' : col;
    c.save(); c.globalAlpha = e.alpha === undefined ? 1 : Math.max(0, e.alpha);
    if (e.hidden) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(e.cx, e.y + e.h, e.w * 0.6, 4, 0, 0, TAU); c.fill(); c.restore(); return; }
    c.translate(e.cx + (e.shakeX || 0), e.y + e.h); c.scale(e.face || 1, 1);
    const w = e.w, h = e.h, st = d.style;
    c.lineWidth = 2.5; c.strokeStyle = '#0a080c';
    const eyes = (x, y, r = 3, col = d.col2) => { c.fillStyle = fl ? '#fff' : col; c.shadowColor = col; c.shadowBlur = 8; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.shadowBlur = 0; };
    const legs = (n, spread, len, phase = 0) => { c.strokeStyle = '#0a080c'; c.lineWidth = 2.5; for (let i = 0; i < n; i++) { const lx = -spread / 2 + i * spread / (n - 1), sw = Math.sin(t * 12 + i * 2 + phase) * 4 * (Math.abs(e.vx) > 5 ? 1 : 0.2); c.beginPath(); c.moveTo(lx, -len); c.lineTo(lx + sw, 0); c.stroke(); } };
    switch (st) {
      case 'bug': case 'robed': {
        if (st === 'bug') legs(2, w * 0.4, 12); else { c.fillStyle = C(d.col); c.beginPath(); c.moveTo(-w / 2, 0); c.quadraticCurveTo(-w / 2, -h * 0.6, 0, -h * 0.75); c.quadraticCurveTo(w / 2, -h * 0.6, w / 2, 0); c.closePath(); c.fill(); c.stroke(); }
        c.fillStyle = C(d.col); c.beginPath(); c.ellipse(0, -h * 0.45, w * 0.42, h * 0.33, 0, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = C(d.col2); c.globalAlpha *= 0.9; c.beginPath(); c.ellipse(4, -h * 0.82, w * 0.3, h * 0.2, 0, 0, TAU); c.fill(); c.globalAlpha = e.alpha === undefined ? 1 : e.alpha; c.stroke();
        c.fillStyle = '#0a080c'; c.beginPath(); c.ellipse(8, -h * 0.82, 3, 4, 0, 0, TAU); c.ellipse(0, -h * 0.82, 3, 4, 0, 0, TAU); c.fill();
        if (d.shield) { c.fillStyle = C(d.shield); c.beginPath(); c.moveTo(w * 0.3, -h * 0.7); c.quadraticCurveTo(w * 0.75, -h * 0.55, w * 0.6, -h * 0.1); c.quadraticCurveTo(w * 0.35, -h * 0.25, w * 0.3, -h * 0.7); c.fill(); c.stroke(); }
        if (d.spear) { c.strokeStyle = '#8a8070'; c.lineWidth = 3; const sa = e.state === 'charge' || e.state === 'windup' ? 0 : -0.8; c.save(); c.translate(w * 0.2, -h * 0.5); c.rotate(sa); c.beginPath(); c.moveTo(-10, 0); c.lineTo(w * 1.1, 0); c.stroke(); c.fillStyle = C('#d8dcea'); c.beginPath(); c.moveTo(w * 1.1, -4); c.lineTo(w * 1.1 + 12, 0); c.lineTo(w * 1.1, 4); c.fill(); c.restore(); }
        if (st === 'robed' && e.state === 'cast') { c.fillStyle = d.col2; c.shadowColor = d.col2; c.shadowBlur = 16; c.beginPath(); c.arc(w * 0.5, -h * 0.7, 6 + Math.sin(t * 20) * 2, 0, TAU); c.fill(); c.shadowBlur = 0; }
        break; }
      case 'mite': case 'crystalbug': case 'frog': {
        const hop = e.onGround ? 0 : -3;
        legs(3, w * 0.7, 6);
        c.fillStyle = C(d.col); c.beginPath(); c.ellipse(0, -h * 0.5 + hop, w * 0.5, h * 0.45, 0, 0, TAU); c.fill(); c.stroke();
        if (st === 'crystalbug') { c.fillStyle = C(d.col2); for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 7 - 4, -h * 0.8); c.lineTo(i * 8, -h * 1.3); c.lineTo(i * 7 + 4, -h * 0.8); c.fill(); } }
        if (st === 'mite') { c.fillStyle = C(d.col2); c.shadowColor = d.col2; c.shadowBlur = 10; c.beginPath(); c.arc(-w * 0.25, -h * 0.6, 4, 0, TAU); c.fill(); c.shadowBlur = 0; }
        if (st === 'frog') { c.fillStyle = C(d.col2); c.beginPath(); c.ellipse(0, -h * 0.25, w * 0.3, h * 0.15, 0, 0, TAU); c.fill(); }
        eyes(w * 0.25, -h * 0.6 + hop, 2.5); break; }
      case 'beetle': case 'shell': case 'slug': {
        if (st !== 'slug') legs(3, w * 0.6, 8);
        const hide = st === 'shell' && e.state === 'shell';
        c.fillStyle = C(d.col);
        if (st === 'slug') { c.beginPath(); c.moveTo(-w / 2, 0); c.quadraticCurveTo(-w / 2, -h, w * 0.2, -h * 0.9); c.quadraticCurveTo(w / 2 + 4, -h * 0.6, w / 2, 0); c.closePath(); c.fill(); c.stroke(); c.fillStyle = C(d.col2); c.globalAlpha *= 0.7; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-w * 0.3 + i * 8, -h * 0.5 + Math.sin(t * 3 + i) * 2, 3, 0, TAU); c.fill(); } c.globalAlpha = 1; eyes(w * 0.35, -h * 0.75, 2.5); break; }
        c.beginPath(); c.ellipse(0, -h * 0.5, w * 0.55, h * (hide ? 0.45 : 0.5), 0, Math.PI, 0); c.lineTo(w * 0.55, -h * 0.3); c.lineTo(-w * 0.55, -h * 0.3); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = C(d.col2); c.lineWidth = 2; c.beginPath(); c.moveTo(0, -h * 0.98); c.lineTo(0, -h * 0.35); c.stroke();
        if (st === 'shell') { c.fillStyle = C(d.col2); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-w * 0.3 + i * w * 0.3 - 5, -h * 0.85); c.lineTo(-w * 0.3 + i * w * 0.3, -h * 1.15); c.lineTo(-w * 0.3 + i * w * 0.3 + 5, -h * 0.85); c.fill(); } }
        if (!hide) { c.fillStyle = C(mix(d.col, '#000000', 0.3)); c.beginPath(); c.ellipse(w * 0.5, -h * 0.4, 9, 8, 0, 0, TAU); c.fill(); eyes(w * 0.56, -h * 0.45, 2.5); }
        if (st === 'beetle') { c.strokeStyle = C(d.col2); c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.55, -h * 0.5); c.quadraticCurveTo(w * 0.8, -h * 0.9, w * 0.65, -h * 1.05); c.stroke(); }
        break; }
      case 'spiky': case 'hound': case 'beast': {
        legs(4, w * 0.75, 9);
        c.fillStyle = C(d.col); c.beginPath(); c.ellipse(0, -h * 0.55, w * 0.5, h * 0.38, 0, 0, TAU); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(w * 0.42, -h * 0.65, w * 0.2, h * 0.25, 0, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = C(d.col2);
        if (st === 'spiky') for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-w * 0.4 + i * w * 0.18 - 3, -h * 0.85); c.lineTo(-w * 0.4 + i * w * 0.18, -h * 1.2); c.lineTo(-w * 0.4 + i * w * 0.18 + 3, -h * 0.85); c.fill(); }
        if (st === 'hound') { c.strokeStyle = C(d.col2); c.lineWidth = 2; c.beginPath(); c.arc(-w * 0.1, -h * 0.55, 6, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(-w * 0.5, -h * 0.6); c.lineTo(-w * 0.75, -h * 0.9); c.stroke(); }
        if (st === 'beast') { c.fillStyle = C(d.col2); c.globalAlpha *= 0.5; c.beginPath(); c.ellipse(0, -h * 0.55, w * 0.55, h * 0.45, 0, 0, TAU); c.fill(); c.globalAlpha = 1; }
        eyes(w * 0.5, -h * 0.7, 2.5); break; }
      case 'fly': case 'bat': case 'moth': {
        const flap = Math.sin(t * (st === 'moth' ? 14 : 22));
        c.translate(0, -h / 2);
        c.fillStyle = C(st === 'fly' ? hexA(d.col2, 0.5) : d.col);
        for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.rotate(-0.3 + flap * 0.5); c.beginPath(); if (st === 'bat') { c.moveTo(0, 0); c.lineTo(w * 0.8, -h * 0.4); c.lineTo(w * 0.7, h * 0.1); c.lineTo(w * 0.45, -h * 0.05); c.lineTo(w * 0.3, h * 0.2); c.closePath(); } else c.ellipse(w * 0.4, -h * 0.2, w * 0.38, h * 0.3, 0.3, 0, TAU); c.fill(); c.restore(); }
        c.fillStyle = C(st === 'fly' ? d.col : mix(d.col, '#000000', 0.3)); c.beginPath(); c.ellipse(0, 0, w * 0.25, h * 0.4, 0, 0, TAU); c.fill(); c.stroke();
        if (st === 'moth') { c.fillStyle = d.col2; c.globalAlpha *= 0.8; c.beginPath(); c.arc(-w * 0.35, -h * 0.25, 4, 0, TAU); c.arc(w * 0.35, -h * 0.25, 4, 0, TAU); c.fill(); c.globalAlpha = 1; }
        eyes(4, -2, 2.5); if (e.state === 'windup') { c.strokeStyle = d.col2; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, w * 0.7, 0, TAU); c.stroke(); }
        break; }
      case 'puff': {
        const sw = 1 + (e.swell || 0) * 0.6 + Math.sin(t * 3) * 0.05;
        c.translate(0, -h / 2); c.scale(sw, sw);
        c.fillStyle = C(d.col); c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, r = w * 0.5 + (i % 2 ? 4 : 0); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
        c.fillStyle = C(d.col2); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(Math.cos(i * 1.3) * 7, Math.sin(i * 1.3) * 7, 3, 0, TAU); c.fill(); }
        eyes(5, -3, 2.5, '#2a1030'); break; }
      case 'turret': case 'eye': {
        c.fillStyle = C(mix(d.col, '#000000', 0.3)); c.beginPath(); c.moveTo(-w * 0.55, 0); c.lineTo(-w * 0.4, -h * 0.4); c.lineTo(w * 0.4, -h * 0.4); c.lineTo(w * 0.55, 0); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = C(d.col); c.beginPath(); c.arc(0, -h * 0.6, w * 0.4, 0, TAU); c.fill(); c.stroke();
        const p = G.player, a = Math.atan2(p.cy - (e.y + e.h * 0.4), (p.cx - e.cx) * (e.face || 1));
        if (st === 'eye') { c.fillStyle = C('#f4e8ff'); c.beginPath(); c.ellipse(0, -h * 0.6, w * 0.3, w * 0.22, 0, 0, TAU); c.fill(); }
        c.fillStyle = C(d.col2); c.shadowColor = d.col2; c.shadowBlur = (e.fireT > 0 ? 24 : 10); c.beginPath(); c.arc(Math.cos(a) * 6, -h * 0.6 + Math.sin(a) * 6, st === 'eye' ? 6 : 5, 0, TAU); c.fill(); c.shadowBlur = 0;
        break; }
      case 'wisp': case 'ghost': case 'jelly': {
        c.translate(0, -h / 2 + Math.sin(t * 3) * 3);
        if (st === 'jelly') { c.fillStyle = C(hexA(d.col, 0.75)); c.beginPath(); c.arc(0, -4, w * 0.5, Math.PI, 0); c.quadraticCurveTo(w * 0.5, 6, 0, 4); c.quadraticCurveTo(-w * 0.5, 6, -w * 0.5, -4); c.fill(); c.strokeStyle = hexA(d.col2, 0.8); c.lineWidth = 2; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 5, 4); c.quadraticCurveTo(i * 5 + Math.sin(t * 4 + i) * 5, h * 0.3, i * 5, h * 0.55); c.stroke(); } eyes(0, -6, 3); break; }
        if (st === 'wisp') { c.strokeStyle = C(d.col2); c.lineWidth = 2; c.save(); c.rotate(t * 2); c.strokeRect(-w * 0.35, -w * 0.35, w * 0.7, w * 0.7); c.restore(); c.fillStyle = C(d.col2); c.shadowColor = d.col2; c.shadowBlur = 14; c.font = 'bold 18px serif'; c.textAlign = 'center'; c.fillText('ᚱ', 0, 6); c.shadowBlur = 0; break; }
        c.fillStyle = C(hexA(d.col, 0.8)); c.beginPath(); c.arc(0, -h * 0.15, w * 0.45, Math.PI, 0); for (let i = 0; i <= 4; i++) c.lineTo(w * 0.45 - i * w * 0.225, h * 0.4 + (i % 2 ? -8 : 0) + Math.sin(t * 5 + i) * 3); c.closePath(); c.fill();
        c.fillStyle = '#0a080c'; c.beginPath(); c.ellipse(-6, -h * 0.18, 4, 6, 0, 0, TAU); c.ellipse(7, -h * 0.18, 4, 6, 0, 0, TAU); c.fill();
        break; }
      case 'golem': {
        const sm = e.state === 'windup' ? -6 : e.state === 'smash' ? 6 : 0;
        legs(2, w * 0.5, 14);
        c.fillStyle = C(d.col); c.beginPath(); c.moveTo(-w * 0.45, -14); c.lineTo(-w * 0.5, -h * 0.75); c.lineTo(-w * 0.2, -h); c.lineTo(w * 0.25, -h * 0.95); c.lineTo(w * 0.5, -h * 0.7); c.lineTo(w * 0.45, -14); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = C(d.col2); c.lineWidth = 2; c.beginPath(); c.moveTo(-w * 0.2, -h * 0.8); c.lineTo(-w * 0.05, -h * 0.5); c.lineTo(-w * 0.2, -h * 0.3); c.stroke();
        c.fillStyle = C(mix(d.col, '#000000', 0.2)); for (const s of [-1, 1]) { c.beginPath(); c.arc(s * w * 0.55, -h * 0.5 + (s > 0 ? sm : 0), w * 0.2, 0, TAU); c.fill(); c.stroke(); }
        eyes(w * 0.15, -h * 0.75, 4); break; }
      case 'bell': {
        c.translate(0, -h / 2 + Math.sin(t * 4) * 3);
        c.fillStyle = C(d.col); c.beginPath(); c.moveTo(-w * 0.5, h * 0.3); c.quadraticCurveTo(-w * 0.4, -h * 0.5, 0, -h * 0.5); c.quadraticCurveTo(w * 0.4, -h * 0.5, w * 0.5, h * 0.3); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = C(d.col2); c.fillRect(-w * 0.5, h * 0.22, w, 4);
        c.fillStyle = 'rgba(255,255,255,0.4)'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * w * 0.6, -h * 0.3, 8, 4, s * 0.5 + Math.sin(t * 25) * 0.3, 0, TAU); c.fill(); }
        eyes(0, -2, 3); break; }
      case 'maw': {
        const r = e.rise || 0;
        c.fillStyle = C(d.col); c.beginPath(); c.ellipse(0, 0, w * 0.55, h * r, 0, Math.PI, 0); c.fill(); c.stroke();
        c.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 6 - 3, -h * r * 0.3); c.lineTo(i * 6, -h * r * 0.3 - 8 * r); c.lineTo(i * 6 + 3, -h * r * 0.3); c.fill(); }
        c.fillStyle = C(d.col2); c.beginPath(); c.ellipse(0, -h * r * 0.15, w * 0.3, h * r * 0.12, 0, 0, TAU); c.fill();
        eyes(-w * 0.25, -h * r * 0.8, 3); eyes(w * 0.25, -h * r * 0.8, 3); break; }
      default: c.fillStyle = C(d.col); c.fillRect(-w / 2, -h, w, h);
    }
    c.restore();
    if (e.def.ai === 'charger' && e.state === 'windup') { c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = 'bold 16px serif'; c.textAlign = 'center'; c.fillText('!', e.cx, e.y - 8); }
  };

  // ================================================================= NPCs
  RN.drawNPC = function (c, n, G) {
    const d = LF.NPCS[n.id], t = G.time, x = n.x, y = n.y, look = d.look;
    c.save(); c.translate(x, y);
    const face = G.player.cx < x ? -1 : 1; c.scale(face, 1);
    const bob = Math.sin(t * 2 + x) * 1.5;
    c.strokeStyle = '#0a080c'; c.lineWidth = 2.5;
    if (look === 'wisp') {
      c.translate(0, -50 + Math.sin(t * 1.5) * 6);
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 40); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.4, hexA(d.col, 0.6)); g.addColorStop(1, hexA(d.col, 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.fill();
      c.fillStyle = '#fff3c4'; c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(16, 0, 0, 14); c.quadraticCurveTo(-16, 0, 0, -24); c.fill();
      c.fillStyle = '#5a4a2a'; c.beginPath(); c.ellipse(-4, 0, 2, 3, 0, 0, TAU); c.ellipse(4, 0, 2, 3, 0, 0, TAU); c.fill();
      c.restore(); return;
    }
    if (look === 'ghost') c.globalAlpha = 0.75 + Math.sin(t * 2) * 0.1;
    // body
    if (look === 'moth') {
      c.fillStyle = '#4a3a5a'; for (const s of [-1, 1]) { c.save(); c.scale(s, 1); c.rotate(Math.sin(t * 1.5) * 0.08); c.beginPath(); c.ellipse(22, -46, 22, 30, 0.4, 0, TAU); c.fill(); c.fillStyle = d.col; c.beginPath(); c.arc(26, -50, 6, 0, TAU); c.fill(); c.fillStyle = '#4a3a5a'; c.restore(); }
    }
    const bw = look === 'beetle' ? 26 : look === 'knight' ? 18 : 16, bh = look === 'beetle' ? 34 : 30;
    c.fillStyle = d.col;
    c.beginPath(); c.moveTo(-bw, 0); c.quadraticCurveTo(-bw - 2, -bh - 10 + bob, 0, -bh - 14 + bob); c.quadraticCurveTo(bw + 2, -bh - 10 + bob, bw, 0); c.closePath(); c.fill(); c.stroke();
    if (look === 'pilgrim' || look === 'bard' || look === 'hermit') { c.fillStyle = mix(d.col, '#000000', 0.35); c.beginPath(); c.moveTo(-bw, 0); c.lineTo(-bw + 6, -bh); c.lineTo(bw - 6, -bh); c.lineTo(bw, 0); c.fill(); }
    // head
    const hy = -bh - 22 + bob;
    c.fillStyle = look === 'moth' ? '#e8dcf0' : look === 'beetle' ? '#3a3028' : look === 'knight' ? '#c9c0a8' : look === 'bard' ? '#f4f0e8' : look === 'quill' ? '#d8c8a0' : '#d8d0c0';
    c.beginPath(); c.ellipse(0, hy, 13, 14, 0, 0, TAU); c.fill(); c.stroke();
    if (look === 'moth') { c.strokeStyle = '#e8dcf0'; c.lineWidth = 2; c.beginPath(); c.moveTo(-4, hy - 12); c.quadraticCurveTo(-12, hy - 30, -18, hy - 26); c.moveTo(4, hy - 12); c.quadraticCurveTo(12, hy - 30, 18, hy - 26); c.stroke(); }
    if (look === 'beetle') { c.fillStyle = '#5a4a3a'; c.beginPath(); c.moveTo(4, hy - 10); c.quadraticCurveTo(14, hy - 34, 2, hy - 38); c.quadraticCurveTo(8, hy - 24, -2, hy - 12); c.fill(); }
    if (look === 'knight') { c.fillStyle = '#7a6a5a'; c.fillRect(-14, hy - 4, 28, 5); c.fillStyle = d.col2; c.beginPath(); c.moveTo(0, hy - 14); c.lineTo(-4, hy - 30); c.lineTo(4, hy - 30); c.fill(); }
    if (look === 'quill') { c.strokeStyle = '#f4ead0'; c.lineWidth = 3; c.beginPath(); c.moveTo(6, hy - 10); c.quadraticCurveTo(20, hy - 36, 10, hy - 44); c.stroke(); c.fillStyle = '#3a2a18'; c.fillRect(10, -bh + 6, 16, 12); }
    if (look === 'bard') { c.fillStyle = '#1a1020'; c.beginPath(); c.arc(-5, hy, 3, 0, TAU); c.arc(5, hy, 3, 0, TAU); c.fill(); c.strokeStyle = '#1a1020'; c.lineWidth = 2; c.beginPath(); c.arc(0, hy + 5, 4, 0, Math.PI); c.stroke(); c.fillStyle = '#7a3a8a'; c.beginPath(); c.moveTo(-14, hy - 8); c.quadraticCurveTo(0, hy - 30, 16, hy - 10); c.fill(); }
    else if (look !== 'beetle') { c.fillStyle = '#0a080c'; c.beginPath(); c.ellipse(-4, hy, 2.5, 3.5, 0, 0, TAU); c.ellipse(4, hy, 2.5, 3.5, 0, 0, TAU); c.fill(); }
    else { c.fillStyle = d.col2; c.beginPath(); c.arc(4, hy, 2.5, 0, TAU); c.fill(); }
    if (look === 'pilgrim') { c.strokeStyle = '#5a4a3a'; c.lineWidth = 3; c.beginPath(); c.moveTo(-bw - 6, 0); c.lineTo(-bw - 6, -bh - 30); c.stroke(); c.fillStyle = d.col2; c.shadowColor = d.col2; c.shadowBlur = 14; c.beginPath(); c.arc(-bw - 6, -bh - 34, 5, 0, TAU); c.fill(); c.shadowBlur = 0; }
    if (look === 'hermit') { c.fillStyle = d.col2; c.shadowColor = d.col2; c.shadowBlur = 12; c.beginPath(); c.arc(bw, -bh * 0.5, 5, 0, TAU); c.fill(); c.shadowBlur = 0; }
    if (n.id === 'cask' && LF.npcStage('cask', G.save) === 2) { c.restore(); return; }
    c.restore();
  };
  RN.drawCaskCorpse = function (c, x, y) {
    c.save(); c.translate(x, y); c.fillStyle = '#4a4038'; c.strokeStyle = '#0a080c'; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(0, -10, 26, 12, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#8a8070'; c.beginPath(); c.ellipse(24, -12, 12, 11, 0.3, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#7a6a5a'; c.fillRect(14, -18, 22, 4);
    c.strokeStyle = '#2a2018'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -20); c.lineTo(2, -6); c.stroke();
    c.restore();
  };

  // ================================================================= items, benches, tablets
  RN.drawItem = function (c, it, G) {
    const t = it.at || 0, x = it.x, y = it.y + Math.sin(t * 2) * 4;
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(0, 0, 2, 0, 0, 34); g.addColorStop(0, 'rgba(255,245,210,0.55)'); g.addColorStop(1, 'rgba(255,245,210,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.fill();
    c.strokeStyle = '#0a080c'; c.lineWidth = 2;
    switch (it.t) {
      case 'mask': c.fillStyle = '#f4f0e8'; c.beginPath(); c.moveTo(-10, -8); c.quadraticCurveTo(0, -16, 10, -8); c.lineTo(4, 10); c.lineTo(-8, 6); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#0a080c'; c.beginPath(); c.ellipse(-3, -3, 2, 3, 0, 0, TAU); c.fill(); break;
      case 'vessel': c.fillStyle = '#ffe9b0'; c.shadowColor = '#ffb347'; c.shadowBlur = 14; c.beginPath(); c.arc(0, 0, 9, 0.3, Math.PI * 1.6); c.lineTo(2, -2); c.closePath(); c.fill(); c.shadowBlur = 0; c.stroke(); break;
      case 'notch': c.strokeStyle = '#ffe28c'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.stroke(); c.fillStyle = '#ffe28c'; c.fillRect(-2, -14, 4, 6); break;
      case 'ore': c.fillStyle = '#e8eef4'; c.shadowColor = '#cfe0ff'; c.shadowBlur = 16; c.beginPath(); c.moveTo(-10, 6); c.lineTo(-6, -8); c.lineTo(4, -11); c.lineTo(11, 0); c.lineTo(5, 9); c.closePath(); c.fill(); c.shadowBlur = 0; c.stroke(); break;
      case 'charm': c.fillStyle = '#d8b060'; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#ffe9b0'; c.beginPath(); c.moveTo(0, -7); c.lineTo(6, 0); c.lineTo(0, 7); c.lineTo(-6, 0); c.closePath(); c.fill(); break;
      case 'wisp': c.fillStyle = '#fff3c4'; c.shadowColor = '#ffd27a'; c.shadowBlur = 16; c.beginPath(); c.moveTo(0, -13); c.quadraticCurveTo(9, 0, 0, 8); c.quadraticCurveTo(-9, 0, 0, -13); c.fill(); c.shadowBlur = 0; c.fillStyle = '#5a4a2a'; c.fillRect(-4, -2, 2, 3); c.fillRect(2, -2, 2, 3); break;
      case 'glim': c.fillStyle = '#fff6c8'; for (let i = 0; i < 5; i++) { c.save(); c.rotate(i * 1.3); c.beginPath(); c.moveTo(0, -9 - i); c.lineTo(4, -3); c.lineTo(0, 0); c.lineTo(-4, -3); c.closePath(); c.fill(); c.restore(); } break;
      case 'ability': { const gg = c.createRadialGradient(0, 0, 2, 0, 0, 22); gg.addColorStop(0, '#fff'); gg.addColorStop(0.5, '#ffd27a'); gg.addColorStop(1, 'rgba(255,180,80,0)'); c.fillStyle = gg; c.beginPath(); c.arc(0, 0, 22 + Math.sin(t * 5) * 3, 0, TAU); c.fill(); break; }
    }
    c.restore();
  };
  RN.drawBench = function (c, b, reg, t) {
    c.save(); c.translate(b.x, b.y);
    c.fillStyle = '#3a2818'; c.strokeStyle = '#120a06'; c.lineWidth = 2;
    c.fillRect(-34, -18, 68, 6); c.strokeRect(-34, -18, 68, 6);
    c.fillRect(-34, -34, 68, 5); c.strokeRect(-34, -34, 68, 5);
    c.fillRect(-30, -12, 5, 12); c.fillRect(25, -12, 5, 12); c.fillRect(-30, -34, 4, 16); c.fillRect(26, -34, 4, 16);
    c.fillStyle = '#1a1210'; c.fillRect(40, -64, 4, 64);
    c.fillStyle = '#ffcf8a'; c.shadowColor = '#ffcf8a'; c.shadowBlur = 22; c.beginPath(); c.ellipse(42, -70, 6, 8 + Math.sin(t * 6) * 0.6, 0, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = '#1a1210'; c.strokeRect(35, -80, 14, 18);
    c.restore();
  };
  RN.drawTablet = function (c, l, reg, t, read) {
    c.save(); c.translate(l.x, l.y);
    c.fillStyle = mix(reg.rockHi, '#000000', 0.25); c.strokeStyle = '#0a080c'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(-18, 0); c.lineTo(-16, -40); c.quadraticCurveTo(0, -54, 16, -40); c.lineTo(18, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = hexA(reg.accent, read ? 0.35 : 0.6 + Math.sin(t * 2) * 0.25); for (let i = 0; i < 4; i++) c.fillRect(-10, -36 + i * 8, 20 - (i % 2) * 6, 2.5);
    c.restore();
  };
  RN.drawSign = function (c, s) {
    c.save(); c.translate(s.x, s.y); c.fillStyle = '#3a2818'; c.strokeStyle = '#120a06'; c.lineWidth = 2;
    c.fillRect(-3, -40, 6, 40); c.fillRect(-22, -48, 44, 20); c.strokeRect(-22, -48, 44, 20);
    c.fillStyle = '#d8c8a0'; c.fillRect(-16, -42, 32, 2); c.fillRect(-16, -36, 24, 2);
    c.restore();
  };
  RN.drawShade = function (c, s, t) {
    c.save(); c.translate(s.cx, s.y + s.h); c.scale(s.face, 1); c.globalAlpha = 0.85;
    c.fillStyle = s.flash > 0 ? '#fff' : '#120c1a';
    c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-16, -30, 0, -34); c.quadraticCurveTo(16, -30, 14, 0); for (let i = 0; i <= 4; i++) c.lineTo(14 - i * 7, Math.sin(t * 6 + i) * 4); c.fill();
    c.beginPath(); c.ellipse(0, -42, 11, 12, 0, 0, TAU); c.fill();
    c.fillStyle = '#a99cff'; c.shadowColor = '#a99cff'; c.shadowBlur = 14; c.beginPath(); c.ellipse(0, -43, 3, 5, 0, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#fff'; c.fillRect(3, -44, 3, 2); c.fillRect(-6, -44, 3, 2);
    c.restore();
  };

  // ================================================================= projectiles
  RN.drawProjectile = function (c, p, t) {
    c.save(); c.translate(p.x, p.y);
    const k = p.kind;
    if (p.owner === 'player') {
      if (k === 'spark') { c.fillStyle = '#dff'; c.shadowColor = '#bff'; c.shadowBlur = 10; c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill(); }
      else { c.rotate(Math.atan2(p.vy, p.vx)); const g = c.createRadialGradient(0, 0, 2, 0, 0, 22); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.4, '#ffb347'); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(-6, 0, 26, 14, 0, 0, TAU); c.fill(); }
    } else if (k === 'wave') {
      c.fillStyle = hexA(p.col.startsWith('#') ? p.col : '#ffd27a', 0.85); c.beginPath(); c.moveTo(-16, 12); c.quadraticCurveTo(-6, -30 - Math.sin(p.t * 20) * 6, 0, -36); c.quadraticCurveTo(6, -30, 16, 12); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.moveTo(-6, 12); c.lineTo(0, -24); c.lineTo(6, 12); c.fill();
    } else if (k === 'rock' || k === 'tome') {
      c.rotate(p.t * 6); c.fillStyle = k === 'tome' ? '#5a4a3a' : p.col; c.strokeStyle = '#0a080c'; c.lineWidth = 2;
      if (k === 'tome') { c.fillRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4); c.strokeRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4); c.fillStyle = '#f4ead0'; c.fillRect(-p.r + 6, -p.r * 0.7 + 4, p.r * 2 - 12, 6); }
      else { c.beginPath(); c.moveTo(-p.r, 0); c.lineTo(-p.r * 0.3, -p.r); c.lineTo(p.r, -p.r * 0.4); c.lineTo(p.r * 0.6, p.r); c.closePath(); c.fill(); c.stroke(); }
    } else if (k === 'page') { c.rotate(p.t * 4); c.fillStyle = p.col; c.fillRect(-7, -9, 14, 18); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(-4, -5, 8, 1.5); c.fillRect(-4, -1, 8, 1.5); c.fillRect(-4, 3, 6, 1.5); }
    else if (k === 'shard' || k === 'feather') { c.rotate(Math.atan2(p.vy, p.vx)); c.fillStyle = p.col; c.shadowColor = p.col; c.shadowBlur = 8; c.beginPath(); c.moveTo(12, 0); c.lineTo(-8, -4); c.lineTo(-8, 4); c.closePath(); c.fill(); }
    else if (k === 'moth') { c.fillStyle = p.col; const fl = Math.sin(p.t * 30); c.beginPath(); c.ellipse(-5, 0, 6, 3 + fl * 3, 0.5, 0, TAU); c.ellipse(5, 0, 6, 3 + fl * 3, -0.5, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.fillRect(-1, -1, 2, 2); }
    else if (k === 'note') { c.fillStyle = p.col; c.shadowColor = p.col; c.shadowBlur = 10; c.beginPath(); c.ellipse(0, 4, 6, 4.5, -0.4, 0, TAU); c.fill(); c.fillRect(4, -12, 2.5, 16); }
    else if (k === 'fireball') { const g = c.createRadialGradient(0, 0, 2, 0, 0, p.r * 1.8); g.addColorStop(0, '#fffbe8'); g.addColorStop(0.4, '#ffb243'); g.addColorStop(1, 'rgba(255,60,10,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, p.r * 1.8, 0, TAU); c.fill(); }
    else {
      const g = c.createRadialGradient(0, 0, 1, 0, 0, p.r * 1.7); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, p.col); g.addColorStop(1, hexA(p.col.startsWith('#') ? p.col : '#ffffff', 0)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, p.r * 1.7, 0, TAU); c.fill();
    }
    c.restore();
  };

  // ================================================================= lighting & atmosphere
  let lightCv = null, lc = null;
  RN.lighting = function (c, G, cam) {
    if (!lightCv) { lightCv = mk(VW, VH); lc = lightCv.getContext('2d'); }
    const reg = LF.REGIONS[G.room.def.region];
    let dark = (G.room.def.f.dark !== undefined ? G.room.def.f.dark : reg.dark) + (G.darkBoost || 0);
    dark = LF.clamp(dark, 0, 0.92);
    lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, VW, VH);
    lc.fillStyle = `rgba(4,3,8,${dark})`; lc.fillRect(0, 0, VW, VH);
    lc.globalCompositeOperation = 'destination-out';
    const L = (x, y, r, a = 1) => { const sx = x - cam.x, sy = y - cam.y; if (sx < -r || sy < -r || sx > VW + r || sy > VH + r) return; const g = lc.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lc.fillStyle = g; lc.fillRect(sx - r, sy - r, r * 2, r * 2); };
    const p = G.player;
    L(p.cx, p.y + 6, 230 + Math.sin(G.time * 9) * 4, 0.95);
    for (const l of G.room.rd.lights) L(l.x, l.y, l.r, 0.85);
    for (const pr of G.projectiles) if (pr.owner === 'player' || pr.kind === 'fireball' || pr.kind === 'orb') L(pr.x, pr.y, pr.owner === 'player' ? 140 : 70, 0.7);
    for (const it of G.items) L(it.x, it.y, 90, 0.6);
    for (const f of G.flames) L(f.x, f.y - 10, 70, 0.6);
    for (const l of G.room.dynLights) L(l.x, l.y, l.r, 0.8);
    if (G.boss && G.boss.active) L(G.boss.cx, G.boss.cy, 260, 0.6);
    for (const n of G.room.rd.npcs) L(n.x, n.y - 30, 110, 0.5);
    c.drawImage(lightCv, 0, 0);
    // additive glows
    c.save(); c.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, col, a) => { const sx = x - cam.x, sy = y - cam.y; if (sx < -r || sy < -r || sx > VW + r || sy > VH + r) return; const g = c.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0)); c.fillStyle = g; c.fillRect(sx - r, sy - r, r * 2, r * 2); };
    glow(p.cx, p.y + 2, 60, '#ffb347', 0.22);
    for (const l of G.room.rd.lights) glow(l.x, l.y, l.r * 0.5, l.c.startsWith('#') ? l.c : '#ffcf8a', 0.16);
    for (const l of G.room.dynLights) glow(l.x, l.y, l.r * 0.5, l.c || '#ff8c4c', 0.2);
    c.restore();
  };
  RN.fog = function (c, G, cam) {
    const reg = LF.REGIONS[G.room.def.region], t = G.time;
    c.save();
    for (let i = 0; i < 4; i++) {
      const fx = ((i * 380 - cam.x * 0.7 + t * (12 + i * 5)) % (VW + 600) + VW + 600) % (VW + 600) - 300;
      const fy = VH * (0.35 + i * 0.17) - cam.y * 0.1 % 100;
      const g = c.createRadialGradient(fx, fy, 0, fx, fy, 320);
      g.addColorStop(0, `rgba(${reg.fog},0.07)`); g.addColorStop(1, `rgba(${reg.fog},0)`);
      c.fillStyle = g; c.fillRect(fx - 320, fy - 320, 640, 640);
    }
    const v = c.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = v; c.fillRect(0, 0, VW, VH);
    c.restore();
  };
})();
