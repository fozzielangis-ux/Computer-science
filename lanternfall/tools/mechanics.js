// Mechanics test: physics envelope vs. solver assumptions, and every ability gate in-engine.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const G = LF.G, T = 32, TL = LF.TILE, out = [], ok = (name, cond, info = '') => out.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  (' + info + ')' : ''));
    for (let i = 1; i <= 3; i++) localStorage.removeItem('lanternfall_slot_' + i);
    LF.UI.stack = []; G.startGame(2, null); LF.UI.stack = []; LF.test.autoClose = true;
    const S = G.S, p = G.player;
    const flat = (id) => { LF.test.place(id, 8, LF.getRoomData(id).G0); G.enemies = []; G.boss = null; p.inv = 0; p.sitting = false; };
    const measure = (fn) => { const y0 = p.y, x0 = p.x; let minY = p.y, maxX = p.x; for (let i = 0; i < 90; i++) { fn(i); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); } return { rise: y0 - minY, run: maxX - x0 }; };
    // 1. jump envelope
    flat('h_town'); S.abilities = [];
    LF.test.run(5);
    let m = measure(i => LF.test.run(1, ['jump'], i === 0 ? ['jump'] : []));
    ok('full jump rises 3–4.5 tiles', m.rise > 96 && m.rise < 150, (m.rise / T).toFixed(2) + ' tiles');
    flat('h_town'); LF.test.run(5);
    m = measure(i => LF.test.run(1, i < 4 ? ['jump'] : [], i === 0 ? ['jump'] : []));
    ok('tapped jump is shorter', m.rise < 90, (m.rise / T).toFixed(2) + ' tiles');
    flat('h_town'); LF.test.run(5); const xs = p.x;
    let air = 0; LF.test.run(1, ['jump', 'right'], ['jump']); while (!p.onGround && air < 120) { LF.test.run(1, ['jump', 'right']); air++; }
    ok('running jump clears < 7 tiles (dash gap is 7)', (p.x - xs) / T < 7, ((p.x - xs) / T).toFixed(2) + ' tiles');
    // 2. double jump
    flat('h_town'); S.abilities = ['wings']; LF.test.run(5);
    m = measure(i => LF.test.run(1, ['jump'], i === 0 || i === 20 ? ['jump'] : []));
    ok('double jump rises > 6 tiles (solver uses 6)', m.rise > 6 * T, (m.rise / T).toFixed(2) + ' tiles');
    ok('double jump < 9 tiles (climb walls are 10)', m.rise < 9 * T);
    // 3. dash
    flat('h_town'); S.abilities = ['dash']; LF.test.run(5); const dx0 = p.x;
    LF.test.run(14, ['right'], ['dash']);
    ok('dash travels ~4 tiles', p.x - dx0 > 3.5 * T, ((p.x - dx0) / T).toFixed(2) + ' tiles');
    flat('h_town'); LF.test.run(5); const jx = p.x;
    LF.test.run(1, ['jump', 'right'], ['jump']); LF.test.run(14, ['jump', 'right']); LF.test.run(1, ['right', 'jump'], ['dash']); air = 0; while (!p.onGround && air < 120) { LF.test.run(1, ['right', 'jump']); air++; }
    ok('jump + air dash clears the 7-tile gap', (p.x - jx) / T > 8, ((p.x - jx) / T).toFixed(2) + ' tiles');
    // 4. gap gate in r1_stair: crossing without dash fails, with dash succeeds
    const gapTest = (abil) => { S.abilities = abil; S.broken = {}; LF.test.place('r1_stair', 12, LF.getRoomData('r1_stair').G0); G.enemies = []; p.inv = 0; p.face = -1; S.hp = 9; S.masks = 9;
      LF.test.run(4, ['left']); LF.test.run(1, ['left', 'jump'], ['jump']); LF.test.run(12, ['left', 'jump']); if (abil.includes('dash')) LF.test.run(1, ['left', 'jump'], ['dash']); LF.test.run(80, ['left', 'jump']); return G.room.def.id; };
    ok('dash gap blocks without Moth Cloak', gapTest([]) === 'r1_stair');
    ok('dash gap crossable with Moth Cloak', gapTest(['dash']) === 'm_edge');
    // 5. wall climb in m_well
    S.abilities = []; S.broken = {}; LF.test.place('m_well', 9, LF.getRoomData('m_well').G0); G.enemies = [];
    LF.test.run(120, ['right', 'up']); const noClaw = p.y;
    S.abilities = ['claws']; LF.test.place('m_well', 9, LF.getRoomData('m_well').G0); G.enemies = [];
    LF.test.run(140, ['right', 'up']); LF.test.run(40, ['right']); LF.test.run(160);
    ok('climb wall blocks without claws', noClaw > 12 * T, 'y=' + noClaw);
    ok('Thornhook Claws climb the wall and reach Glasswyrm', G.room.def.id === 'g_mouth', 'room=' + G.room.def.id);
    // 6. seal (bolt) in a_vault
    S.abilities = ['bolt']; S.broken = {}; S.energy = 99; LF.test.place('a_vault', 24, LF.getRoomData('a_vault').G0); G.enemies = []; p.face = -1;
    const sealBefore = G.room.tiles.filter(v => v === TL.SE).length;
    LF.test.run(2, ['left']); LF.test.run(30, [], ['spell']);
    ok('Ember Bolt melts wax seal', G.room.tiles.filter(v => v === TL.SE).length < sealBefore, `${sealBefore} -> ${G.room.tiles.filter(v => v === TL.SE).length}`);
    // 7. crystal (charge) in g_depths
    S.abilities = ['charge']; S.broken = {}; LF.test.place('g_depths', 6, LF.getRoomData('g_depths').G0); G.enemies = [];
    const crx = LF.getRoomData('g_depths').tiles.findIndex(v => v === TL.CR) % LF.getRoomData('g_depths').W;
    p.x = (crx - 2) * T; p.face = 1;
    const crBefore = G.room.tiles.filter(v => v === TL.CR).length;
    LF.test.run(5, ['attack'], ['attack']); LF.test.run(60, ['attack']); LF.test.run(20);
    ok('Lumen Cleave shatters crystal', G.room.tiles.filter(v => v === TL.CR).length < crBefore, `${crBefore} -> ${G.room.tiles.filter(v => v === TL.CR).length}`);
    // 8. slam floor in v_forge
    S.abilities = ['dash', 'slam']; S.broken = {}; const fr = LF.getRoomData('v_forge'), bd = LF.world.rooms.v_forge.doors.find(d => d.gate === 'slam');
    LF.test.place('v_forge', bd.col + 1, fr.G0 - 1); G.enemies = [];
    LF.test.run(1, ['down'], ['dash']); LF.test.run(60, ['down']); LF.test.run(80);
    ok('Stonefall breaks the cracked floor and drops into Slag Tunnels', G.room.def.id === 'v_lower', 'room=' + G.room.def.id);
    // 9. veil in r1_ante
    const veilTest = (ab) => { S.abilities = ab; S.broken = {}; const ad = LF.world.rooms.r1_ante.doors.find(d => d.gate === 'veil'); LF.test.place('r1_ante', ad.col - 6, LF.getRoomData('r1_ante').G0); G.enemies = []; p.face = 1;
      LF.test.run(3, ['right']); LF.test.run(14, ['right'], ['dash']); LF.test.run(30, ['right']); return G.room.def.id !== 'r1_ante' || p.x > (ad.col - 3) * T + 20; };
    ok('veil blocks a plain dash', !veilTest(['dash']));
    ok('Veilstep passes through veil', veilTest(['dash', 'veil']));
    // 10. gloomwater in l_reeds
    const waterTest = (ab) => { S.abilities = ab; S.hp = 9; S.masks = 9; LF.test.place('l_reeds', 64 - 17, LF.getRoomData('l_reeds').G0); G.enemies = []; p.inv = 0; const hp0 = S.hp; LF.test.run(120, ['right']); LF.test.run(100, ['right', 'up'], ['jump']); return { room: G.room.def.id, lost: hp0 - S.hp }; };
    let w0 = waterTest([]); ok('Gloomwater hurts without Tide Pearl', w0.room === 'l_reeds' && w0.lost > 0, JSON.stringify(w0));
    let w1 = waterTest(['pearl']); ok('Tide Pearl swims through to the temple', w1.room === 't_flooded', JSON.stringify(w1));
    // 11. key gate
    S.abilities = ['key']; S.broken = {}; const kd = LF.world.rooms.h_town.doors.find(d => d.gate === 'key');
    let ty = 2; const hr = LF.getRoomData('h_town'); while (hr.tiles[ty * hr.W + kd.col + 1] === 0) ty++;
    LF.test.place('h_town', kd.col + 1, ty); G.enemies = []; LF.test.run(3);
    const it = G.findInteractable(); ok('key gate offers Unlock with Lantern Key', it && it.kind === 'keygate' && it.label === 'Unlock', it && it.label);
    if (it) G.interact(it); LF.test.run(1, ['jump'], ['jump']); LF.test.run(40, ['jump']);
    ok('opened gate leads to the Heart of the Lantern', G.room.def.id === 'f_gate', 'room=' + G.room.def.id);
    // 12. pogo
    S.abilities = []; flat('r1_hall'); const e = new LF.Enemy('husk', p.cx + 0, (G.room.G0) * 32); e.vx = 0; e.def = Object.assign({}, e.def, { spd: 0 }); G.enemies = [e];
    p.y -= 120; p.vy = 0; LF.test.run(8); LF.test.run(1, ['down'], ['attack']); let bounced = false; for (let i = 0; i < 20; i++) { LF.test.run(1, ['down']); if (p.vy < -400) bounced = true; }
    ok('down-strike pogo bounces off enemies', bounced);
    // 13. death -> shade -> recovery
    S.abilities = []; S.bench = 'h_town'; S.glim = 321; flat('r1_hall'); S.hp = 1; G.hurtPlayer(1, p.cx - 10);
    ok('death triggers', p.dead); LF.test.run(200);
    ok('respawn at bench with full masks', G.room.def.id === 'h_town' && S.hp === G.maxHp() && !p.dead, G.room.def.id + ' hp ' + S.hp);
    ok('shade holds lost glimmer', S.shade && S.shade.amount === 321 && S.glim === 0);
    LF.test.place(S.shade.room, 8, LF.getRoomData(S.shade.room).G0); G.enemies = [];
    const sh = G.shade; let hits = 0; for (let i = 0; i < 6 && !sh.dead; i++) { sh.inv = 0; sh.hurt(G, 5, 1); hits++; }
    ok('striking the shade restores glimmer', S.glim === 321 && !S.shade, 'glim ' + S.glim);
    // 14. bench + charms
    LF.test.place('h_town', 8, LF.getRoomData('h_town').G0); G.enemies = []; p.sitting = false; p.x = G.room.rd.bench.x - 10; LF.test.run(2);
    const bi = G.findInteractable(); ok('bench is interactable', bi && bi.kind === 'bench'); if (bi) G.interact(bi);
    ok('resting sets respawn point and sits', S.bench === 'h_town' && p.sitting);
    // 15. shop purchase
    S.glim = 1000; const before = S.charms.length; LF.UI.stack = []; LF.UI.open('shop', { shop: 'mirelle', msg: '' }); LF.input.pressed = new Set(['Enter']); LF.UI.update(1 / 60); LF.UI.stack = [];
    ok('buying from Mirelle spends glimmer and grants the charm', S.charms.length === before + 1 && S.glim === 880, 'glim ' + S.glim);
    // 16. wisp rewards
    S.wisps = 6; S.wispsHome = 0; const lines = LF.NPCS.lumen.talk(S, G).lines;
    ok('returning 6 wisps grants the 3 and 6 rewards', S.wispsHome === 6 && S.wispRewards.length === 2, lines.slice(-2).join(' | '));
    return out;
  });
  res.forEach(l => console.log(l));
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
