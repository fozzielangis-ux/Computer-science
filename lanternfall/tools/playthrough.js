// Scripted keyboard playthrough of the opening (real key events through the browser).
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.SHOTS || path.join(__dirname, '..', 'shots');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e.stack || e)));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => { for (let i = 1; i <= 3; i++) localStorage.removeItem('lanternfall_slot_' + i); });
  const tap = async (k, ms = 70) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(90); };
  const hold = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); };
  const st = () => page.evaluate(() => ({ room: LF.G.room && LF.G.room.def.id, x: LF.G.player && Math.round(LF.G.player.x / 32), ui: LF.UI.stack.map(s => s.name).join(','), hp: LF.G.S && LF.G.S.hp, glim: LF.G.S && LF.G.S.glim, prompt: LF.G.prompt && LF.G.prompt.label }));
  const dismiss = async () => { for (let i = 0; i < 12; i++) { const s = await st(); if (!s.ui || !/dialog|card|ability/.test(s.ui)) return; await tap('KeyZ'); await page.waitForTimeout(250); } };
  const shot = async (n) => { await page.screenshot({ path: OUT + '/play_' + n + '.png' }); console.log(n, JSON.stringify(await st())); };
  await page.waitForTimeout(400);
  await tap('Enter'); await tap('Enter');
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(850); await tap('Enter'); }
  await page.waitForTimeout(1800); await shot('01_landed');
  // read the sign
  for (let i = 0; i < 40; i++) { const s = await st(); if (s.prompt === 'Read') break; await hold('ArrowRight', 60); } await shot('02_sign'); await tap('ArrowUp'); await page.waitForTimeout(1500); await shot('03_signtext'); await dismiss();
  // into town
  await hold('ArrowRight', 2600); await page.waitForTimeout(400); await shot('04_town');
  // find Mirelle and talk
  for (let i = 0; i < 40; i++) { const s = await st(); if (s.prompt === 'Listen') break; await hold('ArrowRight', 60); }
  await tap('ArrowUp'); await page.waitForTimeout(1200); await shot('05_mirelle');
  await dismiss(); await page.waitForTimeout(300);
  await shot('06_shop'); await tap('Escape'); await page.waitForTimeout(200);
  // walk to bench and rest
  for (let i = 0; i < 60; i++) { const s = await st(); if (s.prompt === 'Rest') break; await hold('ArrowRight', 60); }
  await tap('ArrowUp'); await page.waitForTimeout(900); await shot('07_bench');
  await tap('Tab'); await page.waitForTimeout(300); await shot('08_inventory'); await tap('Tab'); await page.waitForTimeout(200);
  await tap('KeyM'); await page.waitForTimeout(300); await shot('09_map'); await tap('KeyM'); await page.waitForTimeout(200);
  // stand and go to the hole down to Old Umbravale (h_town B at local col 14)
  await tap('KeyZ'); await page.waitForTimeout(300);
  for (let i = 0; i < 120; i++) { const s = await st(); if (Math.abs(s.x - 15) <= 1) break; const dir = s.x > 15 ? 'ArrowLeft' : 'ArrowRight'; await hold(dir, 80); }
  await page.keyboard.down('ArrowDown'); await tap('KeyZ'); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(1500); await shot('10_umbravale');
  // fight: walk right swinging
  for (let i = 0; i < 25; i++) { await page.keyboard.down('ArrowRight'); await tap('KeyX', 60); await page.keyboard.up('ArrowRight'); }
  await shot('11_fight');
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
