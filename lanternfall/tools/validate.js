// Validates the generated world: every room, item and boss reachable; no softlocks.
// Usage: node tools/validate.js [--verbose] [--dump roomId]
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
for (const f of ['core.js', 'data.js', 'world.js']) vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), { filename: f });
const LF = globalThis.LF;
const verbose = process.argv.includes('--verbose');
const dumpId = process.argv.includes('--dump') ? process.argv[process.argv.indexOf('--dump') + 1] : null;
const world = LF.buildWorld();
const RD = {};
let t0 = Date.now();
for (const r of world.list) { RD[r.id] = LF.genRoom(r); LF.prepSolver(r, RD[r.id]); }
console.log(`generated ${world.list.length} rooms in ${Date.now() - t0}ms`);
const CH = 'ESP^TBsc#vKu~wg';
function dump(id, standSet) {
  const rd = RD[id]; const lines = [];
  for (let y = 0; y < rd.H; y++) { let s = ''; for (let x = 0; x < rd.W; x++) { const v = rd.tiles[y * rd.W + x]; s += standSet && standSet[y * rd.W + x] ? '@' : (v === 0 ? '.' : v === 1 ? '#' : CH[v]); } lines.push(s); }
  console.log(id + '\n' + lines.join('\n'));
}
if (dumpId) { dump(dumpId); }
const ABS = ['dash', 'claws', 'wings', 'pearl', 'veil', 'bolt', 'charge', 'slam', 'key'];
const memo = new Map();
function roomReach(id, entryIdx, ab) {
  const k = id + '|' + entryIdx + '|' + ABS.map(a => ab[a] ? 1 : 0).join('');
  if (memo.has(k)) return memo.get(k);
  const r = world.rooms[id], rd = RD[id];
  let entry;
  if (entryIdx === 'start') entry = { x: 6, y: rd.G0 };
  else entry = LF.doorEntry(r.doors[entryIdx], rd);
  const res = LF.reach(rd, ab, [entry]);
  const out = { res, exits: [] };
  r.doors.forEach((d, i) => {
    if (i === entryIdx && (d.side === 'L' || d.side === 'R')) { out.exits.push(i); return; }
    if (LF.exitMatches(res.exits, d)) out.exits.push(i);
  });
  memo.set(k, out);
  return out;
}
function counterpart(r, d) {
  const o = world.rooms[d.to];
  const opp = { L: 'R', R: 'L', T: 'B', B: 'T' }[d.side];
  const j = o.doors.findIndex(e => e.to === r.id && e.side === opp && e.g === d.g);
  if (j < 0) throw new Error('no counterpart door ' + r.id + ' -> ' + d.to);
  return j;
}
function explore(ab, startRoom, startEntry, stopAt) {
  const seen = new Set(), q = [[startRoom, startEntry]], rooms = new Map();
  while (q.length) {
    const [id, e] = q.shift(); const k = id + '|' + e; if (seen.has(k)) continue; seen.add(k);
    if (stopAt && id === stopAt) return { found: true };
    const rr = roomReach(id, e, ab);
    if (!rooms.has(id)) rooms.set(id, []); rooms.get(id).push(rr.res);
    const r = world.rooms[id];
    for (const i of rr.exits) { const d = r.doors[i]; q.push([d.to, counterpart(r, d)]); }
  }
  return { rooms, seen };
}
function itemReached(rd, results, it) {
  const tx = Math.floor(it.x / 32), ty = Math.floor((it.y + 17) / 32);
  for (const res of results) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 2; dy++) {
    const x = tx + dx, y = ty + dy; if (x < 0 || y < 0 || x >= rd.W || y >= rd.H) continue;
    if (res.anySet[y * rd.W + x]) return true;
  }
  return false;
}
// progression
const ab = {}; const order = []; const startId = world.list.find(r => r.f.start).id;
let stages = [];
for (let iter = 0; iter < 20; iter++) {
  const ex = explore(ab, startId, 'start');
  stages.push({ ab: Object.assign({}, ab), ex });
  let gained = false;
  for (const [id, results] of ex.rooms) {
    const r = world.rooms[id];
    if (r.f.boss && results.some(x => x.standCount > 0)) {
      const rew = LF.BOSSES[r.f.boss].reward;
      if (rew && !ab[rew]) { ab[rew] = true; order.push(iter + ':' + r.f.boss + '→' + rew); gained = true; }
      if (!rew && !order.includes('ysolde')) order.push('ysolde');
    }
  }
  if (!gained) break;
}
console.log('progression:', order.join(', '));
const final = stages[stages.length - 1].ex;
let errors = 0;
const missing = world.list.filter(r => !final.rooms.has(r.id));
if (missing.length) { errors++; console.log('UNREACHABLE ROOMS:', missing.map(r => r.id).join(', ')); }
let itemCount = 0, unreachableItems = [];
for (const r of world.list) {
  const rd = RD[r.id], results = final.rooms.get(r.id) || [];
  for (const it of rd.items) { itemCount++; if (!itemReached(rd, results, it)) unreachableItems.push(r.id + ':' + it.t + (it.where || '')); }
}
if (unreachableItems.length) { errors++; console.log('UNREACHABLE ITEMS:', unreachableItems.join(', ')); }
console.log(`items: ${itemCount}, reachable: ${itemCount - unreachableItems.length}`);
if (!order.includes('ysolde')) { errors++; console.log('FINAL BOSS NOT REACHED'); }
// doors that can never be used from either side
for (const r of world.list) {
  const results = final.rooms.get(r.id) || [];
  r.doors.forEach((d, i) => {
    const used = results.some(res => LF.exitMatches(res.exits, d)) || final.seen.has(r.id + '|' + i);
    if (!used) { console.log('door never usable:', r.id, d.side, d.g, '->', d.to); }
  });
}
// softlock check: from every reachable (room, entry) at each stage, can we return to start?
let soft = 0;
for (const st of stages) {
  for (const k of st.ex.seen) {
    const [id, e] = k.split('|'); const entry = e === 'start' ? 'start' : +e;
    const res = explore(st.ab, id, entry, 'h_town');
    if (!res.found) { soft++; if (soft < 15) console.log('SOFTLOCK at stage', Object.keys(st.ab).join('+') || 'none', 'room', id, 'entry', e); }
  }
}
if (soft) { errors++; console.log('softlocks:', soft); }
if (verbose) for (const r of world.list) { const res = (final.rooms.get(r.id) || [])[0]; if (res) dump(r.id, res.standSet); }
console.log(errors ? `FAILED (${errors} problem groups)` : 'OK — world is fully completable, no softlocks');
process.exit(errors ? 1 : 0);
