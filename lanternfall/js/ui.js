// Lanternfall — user interface: HUD, menus, map, inventory, dialogue, shops, title, cards
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const VW = LF.VW, VH = LF.VH, TAU = Math.PI * 2;
  const FONT = '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
  const I = () => LF.input, G = () => LF.G;
  const font = (s, w = '') => `${w} ${s}px ${FONT}`;
  const GOLD = '#e8cf9a', INK = '#f4ead8', DIM = 'rgba(244,234,216,0.5)';

  const UI = LF.UI = { stack: [], toasts: [], area: null, bossT: null, t: 0 };
  UI.keys = (s) => s.replace(/\[(\w+)\]/g, (m, a) => '‹' + LF.input.keyName(a) + '›');
  UI.blocking = () => UI.stack.length > 0;
  UI.top = () => UI.stack[UI.stack.length - 1];
  UI.open = (name, data = {}) => { UI.stack.push(Object.assign({ name, t: 0, sel: 0 }, data)); LF.audio.play('ui'); };
  UI.close = () => { const s = UI.stack.pop(); if (s && s.onClose) s.onClose(); };
  UI.init = () => { UI.open('title'); LF.audio.playMusic('title'); };

  // ---------------------------------------------------------- drawing helpers
  function wrap(c, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (c.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test; }
    if (line) lines.push(line); return lines;
  }
  function panel(c, x, y, w, h, alpha = 0.88) {
    c.save();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(18,14,24,${alpha})`); g.addColorStop(1, `rgba(8,6,12,${alpha})`);
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.strokeStyle = 'rgba(232,207,154,0.55)'; c.lineWidth = 1.5; c.strokeRect(x + 5, y + 5, w - 10, h - 10);
    c.strokeStyle = 'rgba(232,207,154,0.2)'; c.strokeRect(x + 9, y + 9, w - 18, h - 18);
    const fl = (cx, cy, sx, sy) => { c.beginPath(); c.moveTo(cx, cy + sy * 22); c.quadraticCurveTo(cx, cy, cx + sx * 22, cy); c.moveTo(cx + sx * 6, cy + sy * 6); c.arc(cx + sx * 6, cy + sy * 6, 3, 0, TAU); c.stroke(); };
    c.strokeStyle = GOLD; c.lineWidth = 2;
    fl(x + 5, y + 5, 1, 1); fl(x + w - 5, y + 5, -1, 1); fl(x + 5, y + h - 5, 1, -1); fl(x + w - 5, y + h - 5, -1, -1);
    c.restore();
  }
  function flourish(c, x, y, w) {
    c.save(); c.strokeStyle = GOLD; c.lineWidth = 1.5; c.globalAlpha = 0.8;
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - 14, y); c.moveTo(x + 14, y); c.lineTo(x + w / 2, y); c.stroke();
    c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 6, y); c.lineTo(x, y + 6); c.lineTo(x - 6, y); c.closePath(); c.stroke();
    c.restore();
  }
  function text(c, s, x, y, size = 18, col = INK, align = 'center', w = '') { c.font = font(size, w); c.fillStyle = col; c.textAlign = align; c.fillText(s, x, y); }
  function menuList(c, items, sel, x, y, gap = 40, size = 24) {
    items.forEach((it, i) => {
      const on = i === sel, label = typeof it === 'string' ? it : it.label, dis = it.disabled;
      text(c, label, x, y + i * gap, size, dis ? 'rgba(244,234,216,0.3)' : on ? '#fff6dc' : DIM);
      if (on) { const w = c.measureText(label).width; c.save(); c.fillStyle = '#ffcf7a'; c.shadowColor = '#ffb347'; c.shadowBlur = 10; for (const s of [-1, 1]) { const fx = x + s * (w / 2 + 22); c.beginPath(); c.moveTo(fx, y + i * gap - 13); c.quadraticCurveTo(fx + s * 6, y + i * gap - 6, fx, y + i * gap - 2); c.quadraticCurveTo(fx - s * 6, y + i * gap - 6, fx, y + i * gap - 13); c.fill(); } c.restore(); }
    });
  }
  function nav(scr, n, vertical = true) {
    const inp = I();
    if (inp.hit(vertical ? 'up' : 'left')) { scr.sel = (scr.sel - 1 + n) % n; LF.audio.play('ui'); }
    if (inp.hit(vertical ? 'down' : 'right')) { scr.sel = (scr.sel + 1) % n; LF.audio.play('ui'); }
  }
  const confirm = () => I().hit('confirm') || I().hit('jump') || I().hit('attack') && false;
  const back = () => I().hit('back') || I().hit('pause');
  UI.charmIcon = function (c, id, x, y, r, owned = true, equipped = false) {
    c.save(); c.translate(x, y);
    c.fillStyle = owned ? (equipped ? '#5a4520' : '#2a2230') : '#151219'; c.strokeStyle = owned ? GOLD : 'rgba(232,207,154,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
    if (!owned) { c.fillStyle = 'rgba(232,207,154,0.25)'; c.font = font(r, 'bold'); c.textAlign = 'center'; c.fillText('?', 0, r * 0.35); c.restore(); return; }
    const h = LF.hash(id), kind = h % 8, col = ['#ffcf7a', '#a5ffff', '#ffa3f2', '#c4f582', '#ff8c4c', '#b9a2ff', '#fff3c4', '#83f2ff'][(h >> 3) % 8];
    c.fillStyle = col; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = equipped ? 12 : 4; const s = r * 0.55;
    c.beginPath();
    if (kind === 0) { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? s * 0.45 : s; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
    else if (kind === 1) { c.arc(0, 0, s, 0.6, TAU - 0.6); c.arc(s * 0.45, 0, s * 0.7, TAU - 0.9, 0.9, true); c.fill(); }
    else if (kind === 2) { c.moveTo(0, -s); c.quadraticCurveTo(s, 0, 0, s); c.quadraticCurveTo(-s, 0, 0, -s); c.fill(); }
    else if (kind === 3) { c.moveTo(0, s); c.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.4, -s * 1.2, 0, -s * 0.4); c.bezierCurveTo(s * 0.4, -s * 1.2, s * 1.4, -s * 0.2, 0, s); c.fill(); }
    else if (kind === 4) { c.ellipse(0, 0, s, s * 0.55, 0, 0, TAU); c.fill(); c.fillStyle = '#1a1420'; c.beginPath(); c.arc(0, 0, s * 0.3, 0, TAU); c.fill(); }
    else if (kind === 5) { c.moveTo(-s, s); c.quadraticCurveTo(0, -s * 1.6, s, -s); c.quadraticCurveTo(0, 0, -s, s); c.fill(); }
    else if (kind === 6) { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.moveTo(0, 0); c.lineTo(Math.cos(a) * s, Math.sin(a) * s); } c.lineWidth = 3; c.stroke(); }
    else { c.moveTo(0, -s); c.lineTo(s * 0.8, 0); c.lineTo(0, s); c.lineTo(-s * 0.8, 0); c.closePath(); c.fill(); }
    c.restore();
  };
  function maskIcon(c, x, y, s, full, flash) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = full ? (flash ? '#fff' : '#f4f0e8') : 'rgba(30,26,36,0.8)'; c.strokeStyle = full ? '#0a080c' : 'rgba(232,207,154,0.35)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-10, -10); c.quadraticCurveTo(0, -18, 10, -10); c.quadraticCurveTo(12, 4, 0, 14); c.quadraticCurveTo(-12, 4, -10, -10); c.fill(); c.stroke();
    if (full) { c.fillStyle = '#0a080c'; c.beginPath(); c.ellipse(-4, -3, 2.2, 3.5, 0, 0, TAU); c.ellipse(4, -3, 2.2, 3.5, 0, 0, TAU); c.fill(); }
    c.restore();
  }
  UI.maskIcon = maskIcon;

  // ---------------------------------------------------------- public API used by the game
  UI.toast = (title, sub) => { UI.toasts.push({ title, sub: sub || '', t: 0 }); if (UI.toasts.length > 4) UI.toasts.shift(); };
  UI.areaTitle = (name, sub, big) => { UI.area = { name, sub, big, t: 0 }; };
  UI.bossTitle = (name, title) => { UI.bossT = { name, title, t: 0 }; };
  UI.itemCard = (type, arg) => {
    const S = G().S; let title = '', desc = '', icon = type;
    if (type === 'mask') { title = 'Mask Shard'; desc = `${arg} of 4 shards gathered. Gather four to form a new mask.`; }
    if (type === 'maskFull') { title = 'A New Mask'; desc = `The shards join into a whole mask. You now have ${S.masks} masks.`; icon = 'mask'; }
    if (type === 'vessel') { title = 'Vessel Fragment'; desc = `${arg} of 3 fragments gathered. Gather three to hold more Lumen.`; }
    if (type === 'vesselFull') { title = 'Lumen Vessel'; desc = 'The fragments form a new vessel. You can hold more Lumen for focusing and spells.'; icon = 'vessel'; }
    if (type === 'notch') { title = 'Charm Notch'; desc = `You can now bear charms costing up to ${S.notches} notches.`; }
    if (type === 'ore') { title = 'Pale Ore'; desc = 'A cold, pale ore that glows from within. Thrennic the smith can use it to strengthen your blade.'; }
    if (type === 'charm') { const ch = LF.CHARMS[arg]; title = 'Charm: ' + ch.name; desc = ch.desc + ` (costs ${ch.cost} notch${ch.cost > 1 ? 'es' : ''}). Equip charms while resting at a bench.`; }
    UI.open('card', { title, desc: UI.keys(desc), icon, arg });
  };
  UI.abilityCard = (id) => { const a = LF.ABILITIES[id]; UI.open('ability', { title: a.name, desc: UI.keys(a.desc), id }); };
  UI.dialog = (name, lines, then, npc) => { UI.open('dialog', { speaker: name, lines: lines.map(UI.keys), idx: 0, chars: 0, then, npc }); };
  UI.intro = () => UI.open('intro', { lines: [
    'Beneath the world lies Umbravale, a kingdom that was lit by a single living flame: the Great Lantern.',
    'Its queen, Ysolde of the Moths, tended the flame for a thousand years.',
    'Then the Gloam rose from below. It is a darkness that does not burn. It smothers. It makes things forget.',
    'The Lantern went out. The kingdom forgot itself.',
    'But a flame never quite dies. One last spark fell from the dark Lantern...',
    '...and woke.'] });
  UI.ending = () => { LF.audio.playMusic('ending'); G().S.completed = true; G().writeSave(); UI.open('ending', {}); };

  // ---------------------------------------------------------- update (input handling)
  UI.update = (dt) => {
    UI.t += dt;
    for (const t of UI.toasts) t.t += dt; UI.toasts = UI.toasts.filter(t => t.t < 4.5);
    if (UI.area) { UI.area.t += dt; if (UI.area.t > (UI.area.big ? 4.5 : 2.5)) UI.area = null; }
    if (UI.bossT) { UI.bossT.t += dt; if (UI.bossT.t > 3.2) UI.bossT = null; }
    const s = UI.top(); if (!s) return;
    s.t += dt;
    const fn = SCREENS[s.name]; if (fn && fn.update) fn.update(s, dt);
  };
  UI.draw = (c) => { for (const s of UI.stack) { const fn = SCREENS[s.name]; if (fn && fn.draw) fn.draw(c, s); } };

  // ---------------------------------------------------------- HUD
  UI.drawHUD = (c) => {
    const g = G(), S = g.S, t = UI.t;
    if (!S) return;
    c.save();
    // energy orb
    const ox = 58, oy = 58, r = 34, me = 99, cur = Math.min(S.energy, me), k = cur / me;
    c.fillStyle = 'rgba(10,8,14,0.75)'; c.beginPath(); c.arc(ox, oy, r + 4, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.arc(ox, oy, r, 0, TAU); c.clip();
    const ly = oy + r - k * r * 2;
    const lg = c.createLinearGradient(0, ly, 0, oy + r); lg.addColorStop(0, '#fff6d8'); lg.addColorStop(1, '#d89a40');
    c.fillStyle = lg; c.beginPath(); c.moveTo(ox - r, oy + r); for (let i = 0; i <= 20; i++) c.lineTo(ox - r + i / 20 * r * 2, ly + Math.sin(t * 3 + i * 0.6) * (k > 0.02 && k < 0.98 ? 2.5 : 0)); c.lineTo(ox + r, oy + r); c.fill();
    c.restore();
    c.strokeStyle = GOLD; c.lineWidth = 3; c.beginPath(); c.arc(ox, oy, r, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; c.beginPath(); c.arc(ox - 8, oy - 10, r * 0.6, Math.PI * 1.1, Math.PI * 1.5); c.stroke();
    if (S.energy >= 33) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,200,120,${0.12 + Math.sin(t * 3) * 0.05})`; c.beginPath(); c.arc(ox, oy, r + 6, 0, TAU); c.fill(); c.restore(); }
    // extra vessels
    const extra = Math.floor(S.vfrags / 3);
    for (let i = 0; i < extra; i++) { const ex = ox + 46 + i * 26, ey = oy + 30, ek = LF.clamp((S.energy - me - i * 33) / 33, 0, 1); c.fillStyle = 'rgba(10,8,14,0.75)'; c.beginPath(); c.arc(ex, ey, 10, 0, TAU); c.fill(); c.fillStyle = '#f0c070'; c.beginPath(); c.arc(ex, ey, 9 * ek, 0, TAU); c.fill(); c.strokeStyle = GOLD; c.lineWidth = 1.5; c.beginPath(); c.arc(ex, ey, 10, 0, TAU); c.stroke(); }
    // masks
    const mh = g.maxHp(), msp = mh > 14 ? 360 / mh : 28;
    for (let i = 0; i < mh; i++) maskIcon(c, ox + 56 + i * msp, oy - 18, msp < 28 ? msp / 28 : 1, i < S.hp, false);
    // glimmer
    const gx = ox + 54, gy = oy + 8 + (extra ? 0 : 0);
    c.save(); c.translate(gx, gy + 2); c.fillStyle = '#fff0a0'; c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 0); c.lineTo(0, 8); c.lineTo(-6, 0); c.closePath(); c.fill(); c.restore();
    const pop = g.glimPop || 0; g.glimPop = Math.max(0, pop - 0.05);
    text(c, String(S.glim), gx + 14, gy + 9, 22 + pop * 4, INK, 'left');
    if (S.wisps > 0) { c.save(); c.translate(gx + 110, gy + 2); c.fillStyle = '#fff3c4'; c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(7, 0, 0, 6); c.quadraticCurveTo(-7, 0, 0, -9); c.fill(); c.restore(); text(c, '×' + S.wisps, gx + 122, gy + 8, 16, INK, 'left'); }
    // boss bar
    if (g.boss && (g.boss.active || g.boss.intro) && !g.boss.dead) {
      const b = g.boss, bw = 520, bx = VW / 2 - bw / 2, by = VH - 46, k2 = b.hp / b.maxHp;
      c.fillStyle = 'rgba(8,6,12,0.8)'; c.fillRect(bx - 4, by - 4, bw + 8, 18);
      const bg2 = c.createLinearGradient(bx, 0, bx + bw, 0); bg2.addColorStop(0, '#8a2a2a'); bg2.addColorStop(1, '#d8604a');
      c.fillStyle = bg2; c.fillRect(bx, by, bw * k2, 10);
      c.strokeStyle = GOLD; c.lineWidth = 1.5; c.strokeRect(bx - 4, by - 4, bw + 8, 18);
      if (b.phases) for (const ph of b.phases) { c.fillStyle = 'rgba(232,207,154,0.8)'; c.fillRect(bx + bw * ph - 1, by - 2, 2, 14); }
      text(c, b.def.name, VW / 2, by - 12, 18, INK);
    }
    // area title
    if (UI.area) {
      const a = UI.area, dur = a.big ? 4.5 : 2.5, al = Math.min(1, a.t / 0.8, (dur - a.t) / 0.8);
      c.globalAlpha = Math.max(0, al);
      if (a.big) { text(c, a.name.toUpperCase(), VW / 2, VH * 0.32, 46, '#fff6e4'); flourish(c, VW / 2, VH * 0.32 + 22, 360); if (a.sub) text(c, a.sub, VW / 2, VH * 0.32 + 56, 20, DIM); }
      else text(c, a.name, VW / 2, VH * 0.2, 26, '#fff6e4');
      c.globalAlpha = 1;
    }
    if (UI.bossT) {
      const a = UI.bossT, al = Math.max(0, Math.min(1, a.t / 0.5, (3.2 - a.t) / 0.6));
      c.globalAlpha = al; text(c, a.title, VW / 2, VH * 0.72, 20, DIM); text(c, a.name.toUpperCase(), VW / 2, VH * 0.72 + 44, 42, '#fff6e4'); flourish(c, VW / 2, VH * 0.72 + 62, 420); c.globalAlpha = 1;
    }
    // toasts
    UI.toasts.forEach((ts, i) => {
      const al = Math.min(1, ts.t * 4, (4.5 - ts.t) * 2); c.globalAlpha = Math.max(0, al);
      c.font = font(14); const w = Math.max(c.measureText(ts.sub).width, 200) + 40; const x = VW - w - 18, y = 18 + i * 62;
      c.fillStyle = 'rgba(10,8,14,0.78)'; c.fillRect(x, y, w, 52); c.strokeStyle = 'rgba(232,207,154,0.5)'; c.strokeRect(x + 3, y + 3, w - 6, 46);
      text(c, ts.title, x + 18, y + 22, 17, '#fff6dc', 'left'); text(c, ts.sub, x + 18, y + 41, 13, DIM, 'left');
      c.globalAlpha = 1;
    });
    if (LF.settings.timer) { const tt = g.playTime, hh = Math.floor(tt / 3600), mm = Math.floor(tt / 60) % 60, ss = Math.floor(tt) % 60; text(c, `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, VW - 16, VH - 14, 14, DIM, 'right'); }
    c.restore();
  };

  // ---------------------------------------------------------- screens
  const SCREENS = UI.SCREENS = {};

  // ---- title
  SCREENS.title = {
    items() { return ['Begin Journey', 'Settings', 'Controls', 'About']; },
    update(s) {
      nav(s, 4);
      if (confirm()) { LF.audio.play('uiOk'); [() => UI.open('slots'), () => UI.open('settings'), () => UI.open('controls'), () => UI.open('about')][s.sel](); }
    },
    draw(c, s) {
      const t = UI.t;
      const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#1a1424'); g.addColorStop(1, '#05040a'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      // great lantern silhouette
      c.save(); c.translate(VW / 2, 150);
      const gl = c.createRadialGradient(0, 30, 10, 0, 30, 260); gl.addColorStop(0, `rgba(255,190,110,${0.2 + Math.sin(t) * 0.04})`); gl.addColorStop(1, 'rgba(255,190,110,0)'); c.fillStyle = gl; c.fillRect(-300, -250, 600, 600);
      c.strokeStyle = '#2a2232'; c.lineWidth = 6; c.beginPath(); c.moveTo(0, -160); c.lineTo(0, -60); c.stroke();
      c.fillStyle = '#120e16'; c.beginPath(); c.moveTo(-70, -60); c.lineTo(70, -60); c.lineTo(50, -80); c.lineTo(-50, -80); c.fill();
      c.strokeStyle = '#120e16'; c.lineWidth = 8; c.beginPath(); c.ellipse(0, 30, 70, 90, 0, 0, TAU); c.stroke();
      for (let i = -1; i <= 1; i++) { c.lineWidth = 4; c.beginPath(); c.moveTo(i * 40, -55); c.quadraticCurveTo(i * 80, 30, i * 40, 115); c.stroke(); }
      const fl = 1 + Math.sin(t * 6) * 0.06;
      c.fillStyle = `rgba(255,180,80,${0.35 + Math.sin(t * 2) * 0.1})`; c.beginPath(); c.moveTo(0, -20 * fl); c.quadraticCurveTo(22, 30, 0, 60); c.quadraticCurveTo(-22, 30, 0, -20 * fl); c.fill();
      c.restore();
      // embers
      for (let i = 0; i < 40; i++) { const x = (i * 137 + t * 20 * (1 + i % 3)) % VW, y = VH - ((i * 89 + t * 30 * (1 + i % 4)) % VH); c.fillStyle = `rgba(255,${150 + i % 80},80,${0.3 + (i % 5) / 10})`; c.beginPath(); c.arc(x, y, 1 + i % 3, 0, TAU); c.fill(); }
      text(c, 'LANTERNFALL', VW / 2, 330, 76, '#fff0d8');
      flourish(c, VW / 2, 352, 460);
      text(c, 'A tale of Umbravale', VW / 2, 380, 20, DIM);
      menuList(c, this.items(), s.sel, VW / 2, 438, 34, 22);
      text(c, 'A D move · Space jump · Left Click attack · Enter select — or a gamepad', VW / 2, VH - 16, 13, 'rgba(244,234,216,0.35)');
    }
  };
  SCREENS.about = {
    update(s) { if (back() || confirm()) UI.close(); },
    draw(c, s) {
      panel(c, 170, 90, VW - 340, VH - 180, 0.95);
      text(c, 'About', VW / 2, 140, 30, '#fff6dc'); flourish(c, VW / 2, 156, 260);
      const lines = ['Lanternfall is an original action-adventure set in the buried kingdom of Umbravale.', 'All of its art is drawn in code and all of its music and sound is synthesised live.', 'Explore eleven regions, rescue the lost wisps, master nine abilities,', 'collect charms and face ten guardians on the way to the Lantern\'s Heart.', '', 'Your journey saves automatically. Resting at a bench sets where you return.'];
      lines.forEach((l, i) => text(c, l, VW / 2, 200 + i * 30, 17, INK));
      text(c, 'Press ' + LF.input.keyName('back') + ' to return', VW / 2, VH - 110, 14, DIM);
    }
  };

  // ---- save slots
  SCREENS.slots = {
    update(s) {
      if (s.sub) {
        const sub = s.sub; nav(sub, sub.items.length);
        if (back()) { s.sub = null; return; }
        if (confirm()) {
          const it = sub.items[sub.sel];
          if (it === 'Continue') { LF.audio.play('uiOk'); UI.stack = []; G().startGame(s.sel + 1, LF.loadSlot(s.sel + 1)); }
          else if (it === 'Delete') { sub.items = ['Really delete?', 'Yes, delete it', 'No']; sub.sel = 2; }
          else if (it === 'Yes, delete it') { LF.deleteSlot(s.sel + 1); s.sub = null; LF.audio.play('break'); }
          else if (it === 'No' || it === 'Back') s.sub = null;
        }
        return;
      }
      nav(s, 3);
      if (back()) { UI.close(); return; }
      if (confirm()) {
        const sv = LF.loadSlot(s.sel + 1);
        if (!sv) { LF.audio.play('uiOk'); UI.stack = []; G().startGame(s.sel + 1, null); }
        else s.sub = { items: ['Continue', 'Delete', 'Back'], sel: 0 };
      }
    },
    draw(c, s) {
      const bg = c.createLinearGradient(0, 0, 0, VH); bg.addColorStop(0, '#1a1424'); bg.addColorStop(1, '#05040a'); c.fillStyle = bg; c.fillRect(0, 0, VW, VH);
      text(c, 'Choose a Journey', VW / 2, 70, 32, '#fff6dc'); flourish(c, VW / 2, 88, 300);
      for (let i = 0; i < 3; i++) {
        const sv = LF.loadSlot(i + 1), y = 120 + i * 140, on = s.sel === i;
        panel(c, 172, y, VW - 344, 120, on ? 0.95 : 0.7);
        text(c, String(i + 1), 214, y + 70, 40, on ? '#ffcf7a' : DIM);
        if (!sv) text(c, 'New Journey', 270, y + 68, 24, on ? INK : DIM, 'left');
        else {
          const room = LF.world.rooms[sv.bench || sv.room] || LF.world.rooms.h_cliff, reg = LF.REGIONS[room.region];
          text(c, reg.name, 270, y + 46, 24, on ? INK : DIM, 'left');
          const tt = sv.time || 0; text(c, `${Math.floor(tt / 3600)}h ${Math.floor(tt / 60) % 60}m  ·  ${LF.completion(sv)}%  ·  ${sv.glim} glimmer  ·  ${sv.bosses.length}/10 guardians${sv.completed ? '  ·  ✦ completed' : ''}`, 270, y + 76, 15, DIM, 'left');
          for (let m = 0; m < sv.masks; m++) maskIcon(c, 280 + m * 22, y + 98, 0.7, true);
        }
        if (on && s.sub) { const sub = s.sub; sub.items.forEach((it, j) => text(c, it, VW - 230, y + 40 + j * 28, 18, j === sub.sel ? '#fff6dc' : DIM)); }
      }
      text(c, `${LF.input.keyName('confirm')} select   ·   ${LF.input.keyName('back')} back`, VW / 2, VH - 16, 13, DIM);
    }
  };

  // ---- pause
  SCREENS.pause = {
    items: ['Resume', 'Map', 'Inventory', 'Settings', 'Controls', 'Save & Quit'],
    update(s) {
      nav(s, this.items.length);
      if (back()) { UI.close(); return; }
      if (confirm()) {
        LF.audio.play('uiOk');
        const k = this.items[s.sel];
        if (k === 'Resume') UI.close();
        if (k === 'Map') { UI.close(); UI.open('map'); }
        if (k === 'Inventory') { UI.close(); UI.open('inventory'); }
        if (k === 'Settings') UI.open('settings');
        if (k === 'Controls') UI.open('controls');
        if (k === 'Save & Quit') { G().writeSave(); G().state = 'title'; G().room = null; UI.stack = []; UI.open('title'); LF.audio.playMusic('title'); }
      }
    },
    draw(c, s) {
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 0, VW, VH);
      panel(c, VW / 2 - 180, 110, 360, 360);
      text(c, 'Paused', VW / 2, 160, 32, '#fff6dc'); flourish(c, VW / 2, 178, 220);
      menuList(c, this.items, s.sel, VW / 2, 220, 40, 22);
      const S = G().S; if (S) text(c, `${LF.completion(S)}% complete`, VW / 2, 450, 14, DIM);
    }
  };

  // ---- settings
  SCREENS.settings = {
    rows() { const s = LF.settings; return [
      { k: 'master', label: 'Master Volume', v: Math.round(s.master * 10) },
      { k: 'music', label: 'Music Volume', v: Math.round(s.music * 10) },
      { k: 'sfx', label: 'Sound Effects', v: Math.round(s.sfx * 10) },
      { k: 'shake', label: 'Screen Shake', v: s.shake ? 'On' : 'Off' },
      { k: 'preset', label: 'Keyboard Layout', v: s.preset === 'arrows' ? 'Arrows + Z X C A S' : 'WASD + Space · Click · Shift Q F' },
      { k: 'timer', label: 'Show Play Timer', v: s.timer ? 'On' : 'Off' },
      { k: 'fps', label: 'Show FPS', v: s.fps ? 'On' : 'Off' },
      { k: 'full', label: 'Fullscreen', v: document.fullscreenElement ? 'On' : 'Off' },
      { k: 'back', label: 'Back', v: '' }]; },
    update(s) {
      const rows = this.rows(); nav(s, rows.length);
      if (back()) { UI.close(); LF.saveSettings(); return; }
      const r = rows[s.sel], st = LF.settings, inp = I();
      const d = inp.hit('left') ? -1 : inp.hit('right') ? 1 : 0;
      const ok = confirm();
      if (['master', 'music', 'sfx'].includes(r.k) && d) { st[r.k] = LF.clamp(Math.round((st[r.k] + d * 0.1) * 10) / 10, 0, 1); LF.applySettings(); LF.audio.play('ui'); }
      if ((d || ok) && r.k === 'shake') st.shake = !st.shake;
      if ((d || ok) && r.k === 'timer') st.timer = !st.timer;
      if ((d || ok) && r.k === 'fps') st.fps = !st.fps;
      if ((d || ok) && r.k === 'preset') { st.preset = st.preset === 'arrows' ? 'wasd' : 'arrows'; LF.applySettings(); }
      if (ok && r.k === 'full') { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { } }
      if (ok && r.k === 'back') { UI.close(); }
      if (d || ok) LF.saveSettings();
    },
    draw(c, s) {
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, VW, VH);
      panel(c, VW / 2 - 290, 60, 580, 456, 0.96);
      text(c, 'Settings', VW / 2, 108, 30, '#fff6dc'); flourish(c, VW / 2, 124, 240);
      this.rows().forEach((r, i) => {
        const y = 166 + i * 38, on = i === s.sel;
        text(c, r.label, VW / 2 - 240, y, 19, on ? '#fff6dc' : DIM, 'left');
        if (typeof r.v === 'number') { const bx = VW / 2 + 40; c.fillStyle = 'rgba(232,207,154,0.2)'; c.fillRect(bx, y - 9, 180, 6); c.fillStyle = on ? '#ffcf7a' : GOLD; c.fillRect(bx, y - 9, 18 * r.v, 6); c.beginPath(); c.arc(bx + 18 * r.v, y - 6, 7, 0, TAU); c.fill(); }
        else text(c, r.v, VW / 2 + 240, y, 17, on ? '#fff6dc' : DIM, 'right');
      });
      text(c, '← → adjust   ·   ' + LF.input.keyName('back') + ' back', VW / 2, 500, 13, DIM);
    }
  };
  SCREENS.controls = {
    update(s) { if (back() || confirm()) UI.close(); },
    draw(c, s) {
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, VW, VH);
      panel(c, VW / 2 - 330, 40, 660, 496, 0.96);
      text(c, 'Controls', VW / 2, 88, 30, '#fff6dc'); flourish(c, VW / 2, 104, 240);
      const k = (a) => (LF.input.map[a] || []).map(x => x.replace('Mouse0', 'Left Click').replace('Key', '').replace('ShiftLeft', 'Shift').replace('Arrow', '').replace('Escape', 'Esc')).join(' / ');
      const rows = [['Move', k('left') + ' · ' + k('right')], ['Look up / down', k('up') + ' · ' + k('down')], ['Jump (hold for height)', k('jump')], ['Attack', k('attack')], ['Dash', k('dash')], ['Spell (Ember Bolt)', k('spell')], ['Focus / heal (hold)', k('heal')], ['Interact / talk / rest', k('interact')], ['Stonefall slam', k('down') + ' + ' + k('dash') + ' in mid-air'], ['Lumen Cleave', 'hold ' + k('attack') + ', then release'], ['Drop through a ledge', k('down') + ' + ' + k('jump')], ['Inventory · Map', k('inv') + ' · ' + k('map')], ['Pause', k('pause')]];
      rows.forEach((r, i) => { text(c, r[0], VW / 2 - 280, 144 + i * 28, 17, INK, 'left'); text(c, r[1], VW / 2 + 280, 144 + i * 28, 16, '#ffcf7a', 'right'); });
      text(c, 'Gamepad: stick/d-pad move · A jump · X attack · RT/RB dash · B spell · Y heal · LB map · Select inventory', VW / 2, 520, 12, DIM);
    }
  };

  // ---- dialogue
  SCREENS.dialog = {
    update(s, dt) {
      const line = s.lines[s.idx] || '';
      const before = Math.floor(s.chars); s.chars = Math.min(line.length, s.chars + dt * 60);
      if (Math.floor(s.chars) > before && Math.floor(s.chars) % 3 === 0 && s.speaker) LF.audio.play('talk', s.npc === 'thrennic' ? 0.6 : s.npc === 'oro' ? 1.4 : 1);
      if (confirm() || I().hit('interact') || I().hit('attack')) {
        if (s.chars < line.length) { s.chars = line.length; return; }
        s.idx++; s.chars = 0;
        if (s.idx >= s.lines.length) {
          UI.close();
          const th = s.then;
          if (typeof th === 'string' && th.startsWith('shop:')) UI.open('shop', { shop: th.slice(5), msg: '' });
          else if (th === 'smith') UI.open('smith', { msg: '' });
          else if (th && th.ask) UI.open('ask', { q: th.ask, yes: th.yes, speaker: s.speaker });
        }
      }
    },
    draw(c, s) {
      const x = 120, y = VH - 190, w = VW - 240, h = 160;
      panel(c, x, y, w, h, 0.92);
      if (s.speaker) { text(c, s.speaker, x + 34, y + 38, 22, '#ffcf7a', 'left'); const npc = LF.NPCS[s.npc]; if (npc) text(c, npc.title, x + 40 + G().ctx.measureText(s.speaker).width + 10, y + 38, 14, DIM, 'left'); }
      c.font = font(18); const line = (s.lines[s.idx] || '').slice(0, Math.floor(s.chars));
      const lines = wrap(c, line, w - 70);
      lines.forEach((l, i) => text(c, l, x + 34, y + (s.speaker ? 70 : 52) + i * 26, 18, INK, 'left'));
      if (s.chars >= (s.lines[s.idx] || '').length) { c.fillStyle = GOLD; c.beginPath(); const bx = x + w - 34, by = y + h - 26 + Math.sin(UI.t * 5) * 3; c.moveTo(bx - 7, by - 4); c.lineTo(bx + 7, by - 4); c.lineTo(bx, by + 4); c.fill(); }
    }
  };
  SCREENS.ask = {
    update(s) {
      nav(s, 2, false); if (I().hit('up') || I().hit('down')) s.sel = 1 - s.sel;
      if (back()) { UI.close(); return; }
      if (confirm()) { UI.close(); if (s.sel === 0) { const msg = s.yes(); if (msg) UI.dialog(s.speaker, [msg], null, 'quillon'); } }
    },
    draw(c, s) {
      panel(c, VW / 2 - 260, VH / 2 - 80, 520, 160, 0.95);
      c.font = font(19); wrap(c, s.q, 440).forEach((l, i) => text(c, l, VW / 2, VH / 2 - 30 + i * 26, 19, INK));
      text(c, `You have ${G().S.glim} glimmer`, VW / 2, VH / 2 + 16, 14, DIM);
      ['Yes', 'No'].forEach((o, i) => text(c, o, VW / 2 - 70 + i * 140, VH / 2 + 56, 22, s.sel === i ? '#ffcf7a' : DIM));
    }
  };

  // ---- shops
  function shopItems(shop) {
    const S = G().S, list = [];
    for (const it of LF.SHOPS[shop]) {
      if (it.req && S.bosses.length < it.req) continue;
      if (it.t === 'charm' && S.charms.includes(it.id)) continue;
      if (it.key && S.bought.includes(it.key)) continue;
      if (it.t === 'pins' && S.pins.includes(it.id)) continue;
      const name = it.t === 'charm' ? LF.CHARMS[it.id].name : it.t === 'mask' ? 'Mask Shard' : it.t === 'vessel' ? 'Vessel Fragment' : it.t === 'notch' ? 'Charm Notch' : it.name;
      const desc = it.t === 'charm' ? LF.CHARMS[it.id].desc + ` (Costs ${LF.CHARMS[it.id].cost} notch${LF.CHARMS[it.id].cost > 1 ? 'es' : ''}.)` : it.t === 'mask' ? 'A fragment of a mask. Four make a whole mask.' : it.t === 'vessel' ? 'A fragment of a Lumen vessel. Three make a whole vessel.' : it.t === 'notch' ? 'Lets you bear more charms at once.' : it.desc;
      list.push(Object.assign({ name, desc }, it));
    }
    return list;
  }
  SCREENS.shop = {
    update(s) {
      const list = shopItems(s.shop);
      if (back()) { UI.close(); return; }
      if (!list.length) return;
      s.sel = Math.min(s.sel, list.length - 1); nav(s, list.length);
      if (confirm()) {
        const it = list[s.sel], S = G().S;
        if (S.glim < it.price) { LF.audio.play('uiNo'); s.msg = s.shop === 'mirelle' ? 'Ah ah ah. Glimmer first, dearie.' : 'Not enough glimmer, I\'m afraid!'; return; }
        S.glim -= it.price; LF.audio.play('uiOk'); LF.audio.play('coin');
        if (it.key) S.bought.push(it.key);
        if (it.t === 'charm') S.charms.push(it.id);
        if (it.t === 'mask') { S.shards++; if (S.shards % 4 === 0) { S.masks++; S.hp = G().maxHp(); } }
        if (it.t === 'vessel') S.vfrags++;
        if (it.t === 'notch') S.notches++;
        if (it.t === 'pins') S.pins.push(it.id);
        s.msg = ['A fine choice!', 'Wear it well.', 'Pleasure doing business.'][Math.floor(Math.random() * 3)];
        G().calcStats(); G().writeSave();
      }
    },
    draw(c, s) {
      const list = shopItems(s.shop), S = G().S;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, VW, VH);
      panel(c, 90, 50, VW - 180, VH - 100, 0.96);
      text(c, s.shop === 'mirelle' ? 'Mirelle\'s Curios' : 'Penna\'s Pins & Inks', VW / 2, 96, 28, '#fff6dc'); flourish(c, VW / 2, 112, 300);
      text(c, `◆ ${S.glim}`, VW - 130, 96, 20, '#fff0a0', 'right');
      if (!list.length) text(c, 'Sold out! Come back later, there may be more.', VW / 2, VH / 2, 20, DIM);
      const start = Math.max(0, s.sel - 7);
      list.slice(start, start + 9).forEach((it, j) => {
        const i = start + j, y = 150 + j * 34, on = i === s.sel;
        if (on) { c.fillStyle = 'rgba(232,207,154,0.12)'; c.fillRect(120, y - 22, 460, 30); }
        if (it.t === 'charm') UI.charmIcon(c, it.id, 140, y - 7, 11, true);
        else maskIcon(c, 140, y - 6, 0.6, it.t === 'mask');
        text(c, it.name, 160, y, 18, on ? '#fff6dc' : DIM, 'left');
        text(c, String(it.price), 570, y, 18, S.glim >= it.price ? '#fff0a0' : '#a06050', 'right');
      });
      const it = list[s.sel];
      if (it) { c.font = font(16); wrap(c, UI.keys(it.desc), 300).forEach((l, i) => text(c, l, 620, 160 + i * 24, 16, INK, 'left')); }
      if (s.msg) text(c, s.msg, 620, VH - 110, 16, '#ffcf7a', 'left');
      text(c, `${LF.input.keyName('confirm')} buy   ·   ${LF.input.keyName('back')} leave`, VW / 2, VH - 64, 13, DIM);
    }
  };
  SCREENS.smith = {
    update(s) {
      if (back()) { UI.close(); return; }
      const S = G().S, nx = LF.NAIL[S.nail + 1];
      if (confirm() && nx) {
        if (S.glim < nx.price || S.ore < nx.ore) { LF.audio.play('uiNo'); s.msg = S.ore < nx.ore ? 'I need pale ore for this, little flame.' : 'Glimmer. More of it.'; return; }
        S.glim -= nx.price; S.ore -= nx.ore; S.nail++; LF.audio.play('slam'); LF.audio.play('item');
        s.msg = 'There. Feel that weight? That\'s a ' + nx.name + '.'; G().calcStats(); G().writeSave();
      }
    },
    draw(c, s) {
      const S = G().S, cur = LF.NAIL[S.nail], nx = LF.NAIL[S.nail + 1];
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, VW, VH);
      panel(c, VW / 2 - 300, 110, 600, 340, 0.96);
      text(c, 'Thrennic\'s Forge', VW / 2, 158, 28, '#fff6dc'); flourish(c, VW / 2, 174, 260);
      text(c, `Your blade: ${cur.name} (${cur.dmg} damage)`, VW / 2, 220, 19, INK);
      if (nx) {
        text(c, `Temper it into a ${nx.name} (${nx.dmg} damage)`, VW / 2, 270, 20, '#ffcf7a');
        text(c, `Cost: ${nx.price} glimmer` + (nx.ore ? ` and ${nx.ore} pale ore` : ''), VW / 2, 304, 18, S.glim >= nx.price && S.ore >= nx.ore ? INK : '#c07060');
        text(c, `You have ${S.glim} glimmer and ${S.ore} pale ore`, VW / 2, 334, 15, DIM);
        text(c, `${LF.input.keyName('confirm')} upgrade   ·   ${LF.input.keyName('back')} leave`, VW / 2, 420, 13, DIM);
      } else text(c, 'Your blade is as fine as any ever forged.', VW / 2, 290, 19, DIM);
      if (s.msg) text(c, s.msg, VW / 2, 380, 16, '#ffcf7a');
    }
  };

  // ---- item & ability cards
  SCREENS.card = {
    update(s) { if (s.t > 0.5 && (confirm() || back() || I().hit('attack') || I().hit('interact'))) UI.close(); },
    draw(c, s) {
      const a = Math.min(1, s.t * 4);
      c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, VW, VH);
      panel(c, VW / 2 - 280, VH / 2 - 120, 560, 240, 0.95);
      if (s.icon === 'charm') UI.charmIcon(c, s.arg, VW / 2, VH / 2 - 62, 26, true, true);
      else if (s.icon === 'mask') maskIcon(c, VW / 2, VH / 2 - 62, 1.6, true);
      else { c.fillStyle = s.icon === 'ore' ? '#e8eef4' : s.icon === 'notch' ? '#ffe28c' : '#ffe9b0'; c.beginPath(); c.arc(VW / 2, VH / 2 - 62, 18, 0, TAU); c.fill(); }
      text(c, s.title, VW / 2, VH / 2 - 10, 26, '#fff6dc');
      c.font = font(17); wrap(c, s.desc, 480).forEach((l, i) => text(c, l, VW / 2, VH / 2 + 24 + i * 24, 17, INK));
      c.globalAlpha = 1;
    }
  };
  SCREENS.ability = {
    update(s) { if (s.t > 1.2 && (confirm() || back() || I().hit('attack') || I().hit('interact'))) UI.close(); },
    draw(c, s) {
      const a = Math.min(1, s.t * 2);
      c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,0.75)'; c.fillRect(0, 0, VW, VH);
      const gl = c.createRadialGradient(VW / 2, VH / 2 - 60, 10, VW / 2, VH / 2 - 60, 220); gl.addColorStop(0, 'rgba(255,220,150,0.5)'); gl.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = gl; c.fillRect(0, 0, VW, VH);
      UI.abilityIcon(c, s.id, VW / 2, VH / 2 - 70, 44);
      text(c, 'You have gained', VW / 2, VH / 2 + 10, 18, DIM);
      text(c, s.title.toUpperCase(), VW / 2, VH / 2 + 52, 40, '#fff6e4'); flourish(c, VW / 2, VH / 2 + 72, 380);
      c.font = font(18); wrap(c, s.desc, 560).forEach((l, i) => text(c, l, VW / 2, VH / 2 + 108 + i * 26, 18, INK));
      if (s.t > 1.2) text(c, 'Press ' + LF.input.keyName('confirm') + ' to continue', VW / 2, VH - 40, 13, DIM);
      c.globalAlpha = 1;
    }
  };
  UI.abilityIcon = function (c, id, x, y, r) {
    c.save(); c.translate(x, y); c.strokeStyle = GOLD; c.lineWidth = 3; c.fillStyle = '#1a1420';
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#ffe9b0'; c.strokeStyle = '#ffe9b0'; c.shadowColor = '#ffb347'; c.shadowBlur = 16; c.lineWidth = 4; const s = r * 0.55;
    c.beginPath();
    switch (id) {
      case 'dash': c.moveTo(-s, -s * 0.5); c.lineTo(s, 0); c.lineTo(-s, s * 0.5); c.lineTo(-s * 0.4, 0); c.closePath(); c.fill(); break;
      case 'claws': for (let i = -1; i <= 1; i++) { c.moveTo(i * s * 0.5, s); c.quadraticCurveTo(i * s * 0.5 + s * 0.6, 0, i * s * 0.5, -s); } c.stroke(); break;
      case 'bolt': c.moveTo(0, -s); c.quadraticCurveTo(s, 0, 0, s); c.quadraticCurveTo(-s, 0, 0, -s); c.fill(); break;
      case 'charge': c.arc(0, 0, s, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s); c.stroke(); break;
      case 'wings': for (const k of [-1, 1]) { c.moveTo(0, 0); c.quadraticCurveTo(k * s * 1.4, -s * 1.2, k * s * 1.1, s * 0.4); c.closePath(); } c.fill(); break;
      case 'pearl': c.arc(0, 0, s * 0.7, 0, TAU); c.fill(); break;
      case 'slam': c.moveTo(-s * 0.4, -s); c.lineTo(s * 0.4, -s); c.lineTo(s * 0.4, 0); c.lineTo(s * 0.9, 0); c.lineTo(0, s); c.lineTo(-s * 0.9, 0); c.lineTo(-s * 0.4, 0); c.closePath(); c.fill(); break;
      case 'veil': c.globalAlpha = 0.6; c.ellipse(-s * 0.3, 0, s * 0.5, s, 0, 0, TAU); c.fill(); c.globalAlpha = 1; c.beginPath(); c.ellipse(s * 0.3, 0, s * 0.5, s, 0, 0, TAU); c.fill(); break;
      case 'key': c.arc(0, -s * 0.4, s * 0.45, 0, TAU); c.moveTo(0, 0); c.lineTo(0, s); c.lineTo(s * 0.4, s); c.stroke(); break;
      case 'nova': c.moveTo(-s * 0.5, s); c.quadraticCurveTo(-s * 0.6, -s * 0.2, 0, -s * 1.1); c.quadraticCurveTo(s * 0.6, -s * 0.2, s * 0.5, s); c.closePath(); c.fill(); break;
    }
    c.restore();
  };

  // ---- inventory
  const CHARM_IDS = Object.keys(LF.CHARMS);
  SCREENS.inventory = {
    tabs: ['Charms', 'Abilities & Items', 'Journal'],
    update(s) {
      const inp = I();
      if (back() || inp.hit('inv')) { UI.close(); return; }
      if (inp.hit('tabL')) { s.tab = ((s.tab || 0) + 2) % 3; s.sel = 0; LF.audio.play('ui'); }
      if (inp.hit('tabR')) { s.tab = ((s.tab || 0) + 1) % 3; s.sel = 0; LF.audio.play('ui'); }
      const tab = s.tab || 0, S = G().S;
      if (tab === 0) {
        const cols = 8, n = CHARM_IDS.length;
        if (inp.hit('left')) s.sel = (s.sel - 1 + n) % n; if (inp.hit('right')) s.sel = (s.sel + 1) % n;
        if (inp.hit('up')) s.sel = (s.sel - cols + n) % n; if (inp.hit('down')) s.sel = (s.sel + cols) % n;
        if (inp.hit('left') || inp.hit('right') || inp.hit('up') || inp.hit('down')) LF.audio.play('ui');
        if (confirm()) {
          const id = CHARM_IDS[s.sel];
          if (!S.charms.includes(id)) { LF.audio.play('uiNo'); return; }
          if (!G().player.sitting) { LF.audio.play('uiNo'); s.msg = 'Charms can only be changed while resting at a bench.'; s.msgT = 2.5; return; }
          if (S.equipped.includes(id)) { S.equipped = S.equipped.filter(x => x !== id); LF.audio.play('ui'); }
          else if (G().notchesUsed() + LF.CHARMS[id].cost <= S.notches) { S.equipped.push(id); LF.audio.play('uiOk'); }
          else { LF.audio.play('uiNo'); s.msg = 'Not enough notches. Remove another charm first.'; s.msgT = 2.5; }
          if (S.hp > G().maxHp()) S.hp = G().maxHp();
          if (id === 'hearthstone' && S.equipped.includes(id)) S.hp = G().maxHp();
          G().kin = S.equipped.includes('spirit_kin') ? (G().kin || new LF.Kin(G().player)) : null;
          G().calcStats(); G().writeSave();
        }
      } else {
        const list = tab === 1 ? this.itemRows() : this.journalRows();
        nav(s, Math.max(1, list.length));
      }
      if (s.msgT) s.msgT -= 1 / 60;
    },
    itemRows() {
      const S = G().S, rows = [];
      for (const id of Object.keys(LF.ABILITIES)) if (S.abilities.includes(id)) rows.push({ name: LF.ABILITIES[id].name, desc: UI.keys(LF.ABILITIES[id].desc), icon: id });
      const nail = LF.NAIL[S.nail];
      rows.push({ name: nail.name, desc: `Your blade deals ${nail.dmg} damage. Thrennic the smith in Lanternwatch can temper it further.` });
      rows.push({ name: `Masks: ${S.masks}`, desc: `Mask shards: ${S.shards % 4} of 4 toward the next mask.` });
      rows.push({ name: `Lumen Vessels: ${1 + Math.floor(S.vfrags / 3)}`, desc: `Vessel fragments: ${S.vfrags % 3} of 3 toward the next vessel.` });
      rows.push({ name: `Charm Notches: ${S.notches}`, desc: 'More notches let you wear more charms at once.' });
      if (S.ore) rows.push({ name: `Pale Ore ×${S.ore}`, desc: 'Thrennic can use pale ore to temper your blade.' });
      rows.push({ name: `Lost Wisps: ${S.wisps} following, ${S.wispsHome} home`, desc: 'Bring the wisps that follow you to Grandmother Lumen in Elder\'s Hollow, east of Lanternwatch.' });
      rows.push({ name: `Guardians defeated: ${S.bosses.length} of 10`, desc: S.bosses.map(b => LF.BOSSES[b].name).join(', ') || 'None yet.' });
      rows.push({ name: `Completion: ${LF.completion(S)}%`, desc: `Rooms explored: ${S.visited.length} of ${LF.world.list.length}. Deaths: ${S.deaths}.` });
      return rows;
    },
    journalRows() {
      const S = G().S, rows = [];
      for (const id of Object.keys(LF.ENEMIES)) { const k = S.kills[id] || 0; if (k > 0) rows.push({ name: LF.ENEMIES[id].name, desc: LF.ENEMIES[id].desc + `\n\nDefeated: ${k}` }); }
      for (const id of S.lore) rows.push({ name: '✎ ' + (id.charAt(0).toUpperCase() + id.slice(1)).replace('_', ' '), desc: LF.LORE[id] });
      if (!rows.length) rows.push({ name: 'The journal is empty', desc: 'Defeat creatures and read ancient tablets to fill your journal.' });
      return rows;
    },
    draw(c, s) {
      const S = G().S, tab = s.tab || 0;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, VW, VH);
      panel(c, 40, 30, VW - 80, VH - 60, 0.96);
      this.tabs.forEach((tb, i) => text(c, tb, VW / 2 + (i - 1) * 230, 76, 22, i === tab ? '#fff6dc' : DIM));
      flourish(c, VW / 2 + (tab - 1) * 230, 92, 160);
      text(c, `‹${LF.input.keyName('tabL')}`, 90, 76, 16, DIM, 'left'); text(c, `${LF.input.keyName('tabR')}›`, VW - 90, 76, 16, DIM, 'right');
      if (tab === 0) {
        const used = G().notchesUsed();
        text(c, 'Notches', 90, 130, 16, DIM, 'left');
        for (let i = 0; i < S.notches; i++) { c.fillStyle = i < used ? '#ffcf7a' : 'rgba(232,207,154,0.25)'; c.beginPath(); c.arc(170 + i * 22, 125, 7, 0, TAU); c.fill(); }
        text(c, 'Equipped', 90, 170, 16, DIM, 'left');
        S.equipped.forEach((id, i) => UI.charmIcon(c, id, 190 + i * 44, 165, 17, true, true));
        CHARM_IDS.forEach((id, i) => {
          const cx = 110 + (i % 8) * 62, cy = 250 + Math.floor(i / 8) * 66, own = S.charms.includes(id), eq = S.equipped.includes(id);
          UI.charmIcon(c, id, cx, cy, 22, own, eq);
          if (i === s.sel) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 28, 0, TAU); c.stroke(); }
          if (own) { for (let k = 0; k < LF.CHARMS[id].cost; k++) { c.fillStyle = GOLD; c.beginPath(); c.arc(cx - (LF.CHARMS[id].cost - 1) * 4 + k * 8, cy + 30, 2.5, 0, TAU); c.fill(); } }
        });
        const id = CHARM_IDS[s.sel], own = S.charms.includes(id), ch = LF.CHARMS[id];
        text(c, own ? ch.name : '???', 640, 250, 22, '#fff6dc', 'left');
        if (own) { text(c, `Cost: ${ch.cost} notch${ch.cost > 1 ? 'es' : ''}`, 640, 278, 15, GOLD, 'left'); c.font = font(16); wrap(c, UI.keys(ch.desc), 300).forEach((l, i) => text(c, l, 640, 310 + i * 22, 16, INK, 'left')); }
        else text(c, 'You have not found this charm yet.', 640, 280, 16, DIM, 'left');
        const hint = G().player.sitting ? `${LF.input.keyName('confirm')} equip / remove` : 'Rest at a bench to change charms';
        text(c, s.msgT > 0 ? s.msg : hint, VW / 2, VH - 56, 15, s.msgT > 0 ? '#ffcf7a' : DIM);
      } else {
        const list = tab === 1 ? this.itemRows() : this.journalRows();
        s.sel = Math.min(s.sel, list.length - 1);
        const start = Math.max(0, s.sel - 9);
        list.slice(start, start + 11).forEach((r, j) => {
          const i = start + j, y = 140 + j * 34, on = i === s.sel;
          if (on) { c.fillStyle = 'rgba(232,207,154,0.12)'; c.fillRect(80, y - 22, 440, 30); }
          if (r.icon) UI.abilityIcon(c, r.icon, 100, y - 7, 11);
          text(c, r.name, r.icon ? 120 : 92, y, 17, on ? '#fff6dc' : DIM, 'left');
        });
        const r = list[s.sel];
        if (r) { text(c, r.name, 560, 150, 21, '#fff6dc', 'left'); c.font = font(16); let yy = 184; for (const para of r.desc.split('\n')) { for (const l of wrap(c, para, 380)) { text(c, l, 560, yy, 16, INK, 'left'); yy += 23; } yy += 4; } }
        if (tab === 1) { const S2 = S; text(c, `◆ ${S2.glim}`, VW - 90, 130, 18, '#fff0a0', 'right'); }
      }
    }
  };

  // ---- map
  SCREENS.map = {
    update(s) {
      const inp = I();
      if (back() || inp.hit('map')) { UI.close(); return; }
      s.px = s.px || 0; s.py = s.py || 0;
      const sp = 6;
      if (inp.held('left')) s.px += sp; if (inp.held('right')) s.px -= sp; if (inp.held('up')) s.py += sp; if (inp.held('down')) s.py -= sp;
    },
    draw(c, s) {
      const g = G(), S = g.S, W = LF.world;
      c.fillStyle = 'rgba(6,5,10,0.92)'; c.fillRect(0, 0, VW, VH);
      // parchment
      const pg = c.createRadialGradient(VW / 2, VH / 2, 100, VW / 2, VH / 2, 640); pg.addColorStop(0, 'rgba(60,50,40,0.5)'); pg.addColorStop(1, 'rgba(20,16,14,0.2)'); c.fillStyle = pg; c.fillRect(20, 20, VW - 40, VH - 40);
      panel(c, 20, 20, VW - 40, VH - 40, 0);
      const cw = 46, ch = 26, cur = g.room.def;
      const ox = VW / 2 - (cur.x + cur.w / 2) * cw + (s.px || 0), oy = VH / 2 - (cur.y + cur.h / 2) * ch + (s.py || 0);
      const known = (r) => S.visited.includes(r.id) || (S.maps.includes(r.region) && !r.f.secret) || r.region === 'hub' && !r.f.secret;
      c.save(); c.beginPath(); c.rect(30, 30, VW - 60, VH - 60); c.clip();
      const regPos = {};
      for (const r of W.list) {
        if (!known(r)) continue;
        const reg = LF.REGIONS[r.region], vis = S.visited.includes(r.id);
        const x = ox + r.x * cw + 2, y = oy + r.y * ch + 2, w = r.w * cw - 4, h = r.h * ch - 4;
        c.fillStyle = vis ? LF.hexA(reg.rim, 0.32) : 'rgba(200,190,170,0.08)';
        c.strokeStyle = vis ? LF.hexA(reg.rim, 0.9) : 'rgba(200,190,170,0.35)'; c.lineWidth = vis ? 2 : 1;
        if (!vis) c.setLineDash([4, 4]);
        c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, 5) : c.rect(x, y, w, h); c.fill(); c.stroke(); c.setLineDash([]);
        (regPos[r.region] = regPos[r.region] || []).push([x + w / 2, y + h / 2]);
        // doors
        for (const d of r.doors) {
          const o = W.rooms[d.to]; if (d.secretRoom && !S.visited.includes(o.id)) continue;
          c.fillStyle = vis ? LF.hexA(reg.rim, 0.95) : 'rgba(200,190,170,0.4)';
          if (d.side === 'R') c.fillRect(ox + (r.x + r.w) * cw - 4, oy + (d.g + 0.7) * ch - 3, 8, 6);
          if (d.side === 'B') c.fillRect(ox + (d.g + 0.5) * cw - 3, oy + (r.y + r.h) * ch - 4, 6, 8);
          if (d.gate && vis) { c.fillStyle = '#ff9a6a'; const gx = d.side === 'L' ? ox + r.x * cw + 6 : d.side === 'R' ? ox + (r.x + r.w) * cw - 6 : ox + (d.g + 0.5) * cw, gy = d.side === 'T' ? oy + r.y * ch + 6 : d.side === 'B' ? oy + (r.y + r.h) * ch - 6 : oy + (d.g + 0.7) * ch; c.beginPath(); c.arc(gx, gy, 2.5, 0, TAU); c.fill(); }
        }
        // icons
        const rd = LF.getRoomData(r.id);
        if (vis && rd.bench && (S.pins.includes('bench') || r.id === S.bench)) { c.fillStyle = '#ffcf8a'; c.fillRect(x + w / 2 - 7, y + h - 9, 14, 3); c.fillRect(x + w / 2 - 6, y + h - 7, 2, 4); c.fillRect(x + w / 2 + 4, y + h - 7, 2, 4); }
        if (r.f.boss && (vis || S.maps.includes(r.region))) { const dead = S.bosses.includes(r.f.boss); c.fillStyle = dead ? 'rgba(200,190,170,0.5)' : '#e05a4a'; c.beginPath(); c.arc(x + w / 2, y + h / 2, 5, 0, TAU); c.fill(); if (dead) { c.strokeStyle = '#2a2020'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + w / 2 - 4, y + h / 2 - 4); c.lineTo(x + w / 2 + 4, y + h / 2 + 4); c.stroke(); } }
        if (vis && S.pins.includes('npc')) for (const n of rd.npcs) { if (n.stage !== undefined && LF.npcStage(n.id, S) !== n.stage) continue; const nx = x + (n.x / (r.w * 32 * 32)) * w; c.fillStyle = ['mirelle', 'penna', 'thrennic', 'quillon'].includes(n.id) ? '#9ff0a0' : '#d8c8ff'; c.beginPath(); c.arc(nx, y + h - 12, 3, 0, TAU); c.fill(); }
        if (vis && S.pins.includes('items')) for (const it of rd.items) if (!S.items.includes(it.key)) { const ix = x + (it.x / (r.w * 32 * 32)) * w, iy = y + (it.y / (r.h * 18 * 32)) * h; c.fillStyle = '#fff3a0'; c.beginPath(); c.moveTo(ix, iy - 4); c.lineTo(ix + 3, iy); c.lineTo(ix, iy + 4); c.lineTo(ix - 3, iy); c.fill(); }
        if (S.shade && S.shade.room === r.id) { c.fillStyle = '#a99cff'; c.beginPath(); c.arc(x + 8, y + 8, 4, 0, TAU); c.fill(); }
      }
      // region labels
      for (const k in regPos) { const pts = regPos[k]; const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = Math.min(...pts.map(p => p[1])) - 16; text(c, LF.REGIONS[k].name, mx, my, 14, 'rgba(244,234,216,0.75)'); }
      // player
      const rx = ox + cur.x * cw, ry = oy + cur.y * ch;
      const pul = 0.5 + Math.sin(UI.t * 5) * 0.5;
      if (g.charm('compass')) { const px = rx + (g.player.cx / (cur.w * 32 * 32)) * cur.w * cw, py = ry + (g.player.cy / (cur.h * 18 * 32)) * cur.h * ch; c.fillStyle = '#ffb347'; c.shadowColor = '#ffb347'; c.shadowBlur = 10; c.beginPath(); c.arc(px, py, 4 + pul * 2, 0, TAU); c.fill(); c.shadowBlur = 0; }
      else { c.strokeStyle = `rgba(255,180,80,${0.5 + pul * 0.5})`; c.lineWidth = 3; c.strokeRect(rx + 1, ry + 1, cur.w * cw - 2, cur.h * ch - 2); }
      c.restore();
      text(c, 'Map of Umbravale', VW / 2, 56, 24, '#fff6dc');
      text(c, `${g.charm('compass') ? '● you are here' : '▢ your room (wear the Wayfarer\'s Compass to see your exact position)'}   ·   red: guardian   ·   orange dot: sealed path   ·   ${LF.input.keyName('map')} close   ·   arrows scroll`, VW / 2, VH - 34, 12, DIM);
    }
  };

  // ---- intro & ending
  SCREENS.intro = {
    update(s) { if (s.t > 0.8 && (confirm() || I().hit('attack'))) { s.idx = (s.idx || 0) + 1; s.t = 0; if (s.idx >= s.lines.length) UI.close(); } },
    draw(c, s) {
      c.fillStyle = '#000'; c.fillRect(0, 0, VW, VH);
      const a = Math.min(1, s.t * 1.5); c.globalAlpha = a;
      c.font = font(24); wrap(c, s.lines[s.idx || 0], 700).forEach((l, i) => text(c, l, VW / 2, VH / 2 - 10 + i * 34, 24, INK));
      c.globalAlpha = 1;
      text(c, 'Press ' + LF.input.keyName('confirm'), VW / 2, VH - 40, 13, 'rgba(244,234,216,0.35)');
    }
  };
  SCREENS.ending = {
    pages: [
      'The Queen\'s wings folded. From her breast rose a light the kingdom had not seen in a hundred years.',
      '"Little flame," she whispered. "I held it too tightly. I was so afraid to let it go."',
      'The Lantern\'s Heart stood empty and cold, waiting for a flame. And a flame was there.',
      'The last Wick stepped into the Heart, and the Great Lantern burned again.',
      'Down in the deep, the bells rang. The thicket bloomed. The lake remembered how to laugh.',
      'And in every corner of Umbravale, the folk who had forgotten themselves looked up, and remembered their names.',
    ],
    update(s) { if (s.t > 1 && (confirm() || I().hit('attack'))) { s.idx = (s.idx || 0) + 1; s.t = 0; if (s.idx > this.pages.length) { UI.stack = []; G().state = 'title'; G().room = null; UI.open('title'); LF.audio.playMusic('title'); } } },
    draw(c, s) {
      const i = s.idx || 0, a = Math.min(1, s.t);
      const g = c.createRadialGradient(VW / 2, VH / 2, 10, VW / 2, VH / 2, 600); g.addColorStop(0, `rgba(255,220,150,${0.1 + i * 0.04})`); g.addColorStop(1, '#05040a'); c.fillStyle = '#05040a'; c.fillRect(0, 0, VW, VH); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      c.globalAlpha = a;
      if (i < this.pages.length) { c.font = font(24); wrap(c, this.pages[i], 720).forEach((l, k) => text(c, l, VW / 2, VH / 2 - 20 + k * 34, 24, INK)); }
      else {
        const S = G().S, tt = S.time || 0;
        text(c, 'LANTERNFALL', VW / 2, 170, 56, '#fff0d8'); flourish(c, VW / 2, 192, 400);
        text(c, 'The light returns to Umbravale.', VW / 2, 236, 20, DIM);
        text(c, `Completion: ${LF.completion(S)}%   ·   Time: ${Math.floor(tt / 3600)}h ${Math.floor(tt / 60) % 60}m   ·   Deaths: ${S.deaths}`, VW / 2, 300, 18, INK);
        text(c, `Wisps returned: ${S.wispsHome}/24   ·   Charms found: ${S.charms.length}/${Object.keys(LF.CHARMS).length}   ·   Rooms explored: ${S.visited.length}/${LF.world.list.length}`, VW / 2, 332, 16, DIM);
        text(c, 'Thank you for playing. Your journey is saved, and you may continue it to find what remains hidden.', VW / 2, 400, 16, INK);
      }
      c.globalAlpha = 1;
    }
  };
})();
