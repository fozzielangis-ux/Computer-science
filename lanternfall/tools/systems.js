// Headless gameplay systems test: doors, bosses, enemies, saves, UI. Run: node tools/systems.js
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOTS || path.join(__dirname, '..', 'shots');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { for (let i = 1; i <= 3; i++) localStorage.removeItem('lanternfall_slot_' + i); LF.UI.stack = []; LF.G.startGame(3, null); LF.UI.stack = []; });
  // ---------- 1. doors
  await page.evaluate(() => { LF.test.autoClose = true; });
  const doorRes = await page.evaluate(() => {
    const G = LF.G, T = 32, fails = [];
    LF.test.grantAll();
    let n = 0;
    for (const r of LF.world.list) {
      for (const d of r.doors) {
        const rd = LF.getRoomData(r.id);
        // open breakables/gates for traversal checks
        G.S.broken = {}; G.S.abilities = Object.keys(LF.ABILITIES);
        let tx, ty, hold = [], press = [], frames = 90;
        if (d.side === 'L') { tx = 3; ty = d.row; hold = ['left']; }
        else if (d.side === 'R') { tx = rd.W - 4; ty = d.row; hold = ['right']; }
        else if (d.side === 'B') { tx = d.col + 1; ty = rd.G0 - 1; frames = 120; if (r.f.grates) { ty = rd.G0; hold = ['down']; press = ['jump']; } }
        else { tx = d.col + 1; ty = 2; while (ty < rd.H && rd.tiles[ty * rd.W + tx] === 0) ty++; hold = ['jump']; frames = 50; }
        LF.test.place(r.id, tx, ty);
        // clear any gate tiles at the door for this mechanical check
        const room = G.room;
        for (let i = 0; i < room.tiles.length; i++) { const v = room.tiles[i]; if (v === LF.TILE.BR || v === LF.TILE.SL || v === LF.TILE.KY || v === LF.TILE.SE || v === LF.TILE.CR) room.tiles[i] = 0; }
        G.enemies = []; G.boss = null; G.player.inv = 99;

        LF.test.run(frames, hold, press);
        n++;
        if (G.room.def.id !== d.to) fails.push(`${r.id} ${d.side}${d.g} -> ${d.to} ended in ${G.room.def.id} at ${Math.round(G.player.x)},${Math.round(G.player.y)}`);
        else {
          // make sure we are not embedded in a wall after arriving
          const p = G.player; const c = p.collides(G, 0, p.bottom);
          if (c) fails.push(`${r.id}->${d.to}: arrived inside solid`);
        }
      }
    }
    return { n, fails };
  });
  console.log(`doors tested: ${doorRes.n}, failures: ${doorRes.fails.length}`); doorRes.fails.slice(0, 20).forEach(f => console.log('  ', f));

  // ---------- 2. bosses (AI runs, takes damage, dies, reward appears)
  const bossRes = await page.evaluate(() => {
    const G = LF.G, out = [];
    for (const r of LF.world.list.filter(r => r.f.boss)) {
      const id = r.f.boss;
      G.S.bosses = G.S.bosses.filter(b => b !== id); G.S.abilities = Object.keys(LF.ABILITIES).filter(a => a !== LF.BOSSES[id].reward);
      LF.test.place(r.id, 10, LF.getRoomData(r.id).G0);
      G.S.hp = G.maxHp(); G.player.inv = 0; G.slowmo = 1; G.hitstop = 0; G.timers = [];
      const b = G.boss;
      if (!b) { out.push(id + ': no boss spawned'); continue; }
      // walk in to trigger
      { const rd = G.room.rd; let bx = 20; for (let x = 9; x < rd.W - 9; x++) { if (!rd.doorRects.some(dr => x > dr.x0 - 5 && x < dr.x1 + 6)) { bx = x; break; } } G.player.x = bx * 32; G.player.y = rd.G0 * 32 - 41; } LF.test.run(10);
      LF.test.run(150);
      if (!b.active) { out.push(id + ': did not activate'); continue; }
      // let it fight a vulnerable player for 6s, measure damage dealt
      const hp0 = G.S.hp; G.S.hp = 99; G.S.masks = 99; const acts = new Set();
      for (let i = 0; i < 360; i++) { LF.test.run(1); if (b.act) acts.add(b.act); }
      const dealt = 99 - G.S.hp;
      // now invulnerable, chip it down while recording acts across phases
      G.S.masks = 5; G.S.hp = 5;
      let guard = 0;
      while (!b.dying && guard++ < 6000) { G.player.inv = 1; G.player.dead = false; LF.test.run(1); if (b.act) acts.add(b.act); if (guard % 20 === 0) { b.inv = 0; const r2 = b.hurt(G, b.maxHp / 60, 1, 'side'); } }
      LF.test.run(400);
      const defeated = G.S.bosses.includes(id);
      const rewardItem = G.items.some(it => it.t === 'ability') || G.S.abilities.includes(LF.BOSSES[id].reward);
      out.push(`${id}: hp=${b.hp|0} dying=${!!b.dying} acts=[${[...acts].join(',')}] phase=${b.phase} dmgToPlayer=${dealt} defeated=${defeated} reward=${LF.BOSSES[id].reward ? rewardItem : 'ending'} doorsUnlocked=${!G.room.locked}`);
      LF.UI.stack = [];
    }
    return out;
  });
  bossRes.forEach(l => console.log('  boss', l));
  await page.screenshot({ path: OUT + '/boss_last.png' });

  // ---------- 3. every enemy type
  const enemyRes = await page.evaluate(() => {
    const G = LF.G, out = [];
    LF.test.place('r1_hall', 6, LF.getRoomData('r1_hall').G0);
    G.S.hp = 99; G.S.masks = 99;
    for (const type of Object.keys(LF.ENEMIES)) {
      G.enemies = [];
      const e = new LF.Enemy(type, 30 * 32, (G.room.G0 - (['flyer', 'diver', 'shooterfly', 'ghost', 'teleporter', 'exploder'].includes(LF.ENEMIES[type].ai) ? 4 : 0)) * 32);
      G.enemies.push(e);
      G.player.x = 26 * 32; G.player.y = G.room.G0 * 32 - 41; G.player.inv = 0;
      const hp0 = G.S.hp;
      LF.test.run(300);
      const hurtPlayer = hp0 - G.S.hp;
      let k = 0; while (!e.dead && k++ < 200) { e.hidden = false; if (e.state === 'faded' || e.state === 'shell') e.state = 'idle'; e.inv = 0; e.hurt(G, 5, 1, 'spell'); LF.test.run(1); }
      out.push(`${type}:${e.dead ? 'killed' : 'ALIVE'}/${hurtPlayer}`);
      G.player.inv = 0;
    }
    return out;
  });
  console.log('  enemies', enemyRes.join(' '));

  // ---------- 4. UI screens
  for (const scr of ['inventory', 'map', 'pause', 'settings', 'controls']) {
    await page.evaluate((s) => { LF.UI.stack = []; LF.G.S.charms = Object.keys(LF.CHARMS).slice(0, 12); LF.G.S.equipped = ['quickstep', 'compass']; LF.UI.open(s); }, scr);
    await page.waitForTimeout(250);
    await page.screenshot({ path: OUT + `/ui_${scr}.png` });
  }
  await page.evaluate(() => { LF.UI.stack = []; LF.UI.open('inventory', { tab: 1 }); });
  await page.waitForTimeout(150); await page.screenshot({ path: OUT + '/ui_items.png' });
  await page.evaluate(() => { LF.UI.stack = []; LF.G.S.glim = 2000; LF.UI.open('shop', { shop: 'mirelle', msg: '' }); });
  await page.waitForTimeout(150); await page.screenshot({ path: OUT + '/ui_shop.png' });
  await page.evaluate(() => { LF.UI.stack = []; LF.UI.dialog('Vell', ['Peace, little flame. I am Vell, a pilgrim of the old faith.'], null, 'vell'); });
  await page.waitForTimeout(1500); await page.screenshot({ path: OUT + '/ui_dialog.png' });
  await page.evaluate(() => { LF.UI.stack = []; LF.UI.abilityCard('dash'); });
  await page.waitForTimeout(1300); await page.screenshot({ path: OUT + '/ui_ability.png' });

  // ---------- 5. save / reload
  const saved = await page.evaluate(() => { LF.UI.stack = []; LF.G.S.glim = 1234; LF.G.S.bench = 'r1_shrine'; LF.G.writeSave(); return LF.loadSlot(3).glim; });
  await page.reload(); await page.waitForTimeout(300);
  const loaded = await page.evaluate(() => { const s = LF.loadSlot(3); LF.UI.stack = []; LF.G.startGame(3, s); return { glim: LF.G.S.glim, room: LF.G.room.def.id, sitting: LF.G.player.sitting }; });
  console.log('save/load', saved, JSON.stringify(loaded));
  console.log('errors:', errors.length ? errors.slice(0, 8).join('\n') : 'none');
  await browser.close();
})();
