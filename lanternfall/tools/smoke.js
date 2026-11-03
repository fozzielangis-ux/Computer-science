// Browser smoke test: boots the game, starts a journey, visits rooms, screenshots.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOTS || path.join(__dirname, '..', 'shots');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/01_title.png' });
  await page.evaluate(() => { for (let i = 1; i <= 3; i++) localStorage.removeItem('lanternfall_slot_' + i); });
  const key = async (k, n = 1, hold = 60) => { for (let i = 0; i < n; i++) { await page.keyboard.down(k); await page.waitForTimeout(hold); await page.keyboard.up(k); await page.waitForTimeout(80); } };
  await key('Enter'); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/02_slots.png' });
  await key('Enter'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/03_intro.png' });
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(900); await key('Enter'); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/04_start.png' });
  // walk right and jump
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await key('KeyZ', 1, 200); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: OUT + '/05_walk.png' });
  const st = await page.evaluate(() => ({ room: LF.G.room.def.id, x: LF.G.player.x, y: LF.G.player.y, hp: LF.G.S.hp, state: LF.G.state, ui: LF.UI.stack.map(s => s.name) }));
  console.log('state', JSON.stringify(st));
  const rooms = (process.env.ROOMS || 'h_town,r1_hall,m_canopy,a_library,g_hall,c_avenue,l_reeds,v_flow,t_nave,k_hall,f_ascent').split(',');
  for (const id of rooms) {
    await page.evaluate((id) => { LF.UI.stack = []; LF.UI.area = null; const G = LF.G; G.enterRoom(id, 'start'); const rd = G.room.rd; G.player.x = 6 * 32; G.player.y = (rd.G0) * 32 - 41; G.snapCam(); }, id);
    await page.waitForTimeout(900);
    await page.screenshot({ path: OUT + `/room_${id}.png` });
  }
  console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
