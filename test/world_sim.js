// node test/world_sim.js [seasons] : build the world, simulate seasons, check invariants
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'crest', 'worlddata', 'world', 'season'].forEach(load);
const W = FCK.World.build();
const seasons = +process.argv[2] || 3;
let t0 = Date.now();
console.log('countries', W.countries.length, 'clubs', W.clubs.length, 'groups', W.groups.length, 'extras', W.extras.length, 'hand-matched', W.clubs.filter((c) => c.hand).length);
console.log('uefa order', W.uefaOrder.slice(0, 14).join(' '), '...');
let errs = 0; const err = (m) => { errs++; if (errs < 30) console.log('ERR', m); };
const sim = new FCK.Sim(12345);
console.log('init', Date.now() - t0, 'ms');
for (const k of ['cl', 'el', 'ecl']) console.log(k, sim.euro[k].teams.length, sim.euro[k].teams.slice(0, 6).map((i) => W.clubs[i].name).join(', '));
const size0 = W.groups.map((g) => g.size);
for (let s = 0; s < seasons; s++) {
  t0 = Date.now();
  sim.userIdx = W.clubs.findIndex((c) => c.id === 'fcb');
  let n = 0, c;
  while ((c = sim.nextUserFixture())) {
    n++;
    if (n % 11 === 0) { // pack in the middle of a slot (fixture pending) and continue on the copy
      const o = JSON.parse(JSON.stringify(sim.pack())); const cp = FCK.Sim.unpack(o); cp.userIdx = sim.userIdx;
      const c2 = cp.nextUserFixture();
      if (!c2 || c2.user.h !== c.user.h || c2.user.a !== c.user.a || c2.w !== c.w) err('pending roundtrip differs at match ' + n);
    }
    sim.commit(null);
  }
  const tt = Date.now() - t0;
  // league completeness
  for (const g in sim.leagues) {
    const L = sim.leagues[g];
    if (L.md !== L.M) err('league ' + g + ' md ' + L.md + '/' + L.M);
    const tb = L.table(); const pl = tb.map((r) => r.p);
    if (new Set(pl).size > 1 && !(W.groups[g].size % 2)) err('uneven played ' + g + ' ' + pl.join(','));
  }
  for (const cc in sim.cups) if (sim.cups[cc].w < 0) err('cup unfinished ' + cc + ' cur ' + sim.cups[cc].cur + '/' + sim.cups[cc].R);
  for (const k of ['cl', 'el', 'ecl']) if (sim.euro[k].w < 0) err('euro unfinished ' + k);
  const bayern = sim.userIdx;
  const t1 = sim.leagues[sim.gid[bayern]].table();
  console.log('season', sim.year, 'user matches', n, 'time', tt, 'ms | Bundesliga winner', W.clubs[t1[0].idx].name, t1[0].pts, '| user pos', t1.findIndex((r) => r.idx === bayern) + 1,
    '| CL', W.clubs[sim.euro.cl.w].name, 'EL', W.clubs[sim.euro.el.w].name, 'ECL', W.clubs[sim.euro.ecl.w].name, '| DFB-Pokal', W.clubs[sim.cups.de.w].name);
  const pk = JSON.stringify(sim.pack());
  console.log('  pack size', (pk.length / 1024).toFixed(0), 'KB');
  const sim2 = FCK.Sim.unpack(JSON.parse(pk));
  // roundtrip check
  const t2 = sim2.leagues[sim.gid[bayern]].table();
  if (t2[0].idx !== t1[0].idx || t2[0].pts !== t1[0].pts) err('roundtrip league mismatch');
  if (sim2.cups.de.w !== sim.cups.de.w) err('roundtrip cup mismatch');
  if (sim2.euro.cl.w !== sim.euro.cl.w) err('roundtrip euro mismatch');
  const sum = sim.endSeason();
  // group sizes preserved
  const cnt = {}; sim.gid.forEach((g) => { cnt[g] = (cnt[g] || 0) + 1; });
  W.groups.forEach((g) => { if ((cnt[g.gid] || 0) !== g.size) err('size changed group ' + g.gid + ' ' + g.cc + g.tier + ' ' + (cnt[g.gid] || 0) + '/' + g.size); });
  console.log('  moves up', sum.up.length, 'down', sum.down.length, '| top scorer (user league prev)', '');
  for (const k of ['cl', 'el', 'ecl']) if (sim.euro[k].teams.length !== 36) err('euro size ' + k + ' ' + sim.euro[k].teams.length);
  const dup = new Set(); ['cl', 'el', 'ecl'].forEach((k) => sim.euro[k].teams.forEach((i) => { if (dup.has(i)) err('club in two euro comps ' + W.clubs[i].name); dup.add(i); }));
}
const rs = sim.r.slice().sort((a, b) => b - a);
console.log('rating spread', rs[0].toFixed(1), rs[Math.floor(rs.length / 2)].toFixed(1), rs[rs.length - 1].toFixed(1));
console.log(errs ? errs + ' ERRORS' : 'ALL OK');
process.exit(errs ? 1 : 0);
