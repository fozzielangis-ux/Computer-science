// Screenshots every boss mid-fight (for visual review).
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOTS || path.join(__dirname, '..', 'shots');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  page.on('pageerror', e => console.log('ERR', e.stack));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  await page.evaluate(() => { LF.UI.stack = []; LF.G.startGame(3, null); LF.UI.stack = []; LF.test.autoClose = true; LF.test.grantAll(); });
  for (const r of ['r1_arena', 'm_arena', 'a_arena', 'g_arena', 'c_arena', 'l_arena', 'v_arena', 't_arena', 'k_arena', 'f_throne']) {
    await page.evaluate((id) => {
      const G = LF.G; G.S.bosses = []; G.S.hp = 99; G.S.masks = 12;
      LF.test.place(id, 12, LF.getRoomData(id).G0);
      const rd = G.room.rd; let bx = 20; for (let x = 9; x < rd.W - 9; x++) { if (!rd.doorRects.some(dr => x > dr.x0 - 5 && x < dr.x1 + 6)) { bx = x; break; } }
      G.player.x = bx * 32; LF.test.run(10); LF.test.run(150);
      G.boss.hp = G.boss.maxHp * 0.45; G.boss.phase = 2; if (G.boss.onPhase) G.boss.onPhase(G, 2);
      for (let i = 0; i < 160; i++) { G.player.inv = 1; LF.test.run(1, i % 30 < 10 ? ['attack'] : [], i % 30 === 0 ? ['attack'] : []); }
    }, r);
    await page.waitForTimeout(60);
    await page.screenshot({ path: OUT + `/boss_${r}.png` });
  }
  await browser.close();
})();
