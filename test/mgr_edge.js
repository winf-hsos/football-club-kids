// node test/mgr_edge.js : sack / job offers / old saves / odd squad states
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'i18n', 'i18n_career', 'i18n_mgr', 'worlddata', 'world', 'season', 'manager', 'market', 'youth', 'mgrseason', 'career'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
const W = FCK.World.build(), C = FCK.Career, M = FCK.Mgr;
let errs = 0; const err = (m) => { errs++; console.log('ERR', m); };
// 1. old save without manager data
let c = C.create({ clubId: 'fcb', seed: 9 });
const pk = JSON.parse(JSON.stringify(C.pack())); delete pk.m;
const c2 = C.unpack(pk);
if (!c2.m || c2.m.players.length < 20) err('old save not upgraded');
else console.log('old save ok', c2.m.players.length, 'players');
// 2. relegation candidate: sell everyone good, season -> sack in full mode
c = C.create({ clubId: 'w231', seed: 5, easy: false });
M.listed; c.m.players.sort((a, b) => b.o - a.o).slice(0, 10).forEach((p) => { p.o = Math.max(30, p.o - 25); });
M.sync(c);
let n = 0; while (C.next()) { C.simulateNext(); n++; if (c.m.sacked) break; }
console.log('matches', n, 'sacked flag', c.m.sacked, 'bc', c.m.bc.toFixed(1), 'pos', (C.seasonSummary().pos));
if (!c.m.sacked) { // finish season, check endOfSeason decision
  const rv = M.review(c); rv.expiring.forEach((p) => M.renew(c, p, M.renewDemand(c, p), 1));
}
const sm = C.endSeason();
console.log('endSeason sacked', sm.rep.sacked, 'bc', sm.rep.bc0.toFixed(0) + '->' + sm.rep.bc1.toFixed(0), 'offers', sm.rep.offers.length);
if (sm.rep.sacked || c.m.sacked) { C.switchClub(W.clubs.find((x) => x.id === 'w250').idx); console.log('switched to', W.clubs[c.idx].name, 'squad', c.m.players.length, 'cash', M.money(c.m.cash)); }
// continue 1 more season after the switch (pack roundtrip)
const pk2 = JSON.parse(JSON.stringify(C.pack())); C.unpack(pk2);
while (C.next()) C.simulateNext();
C.endSeason(); console.log('after switch season ok, year', C.cur.sim.year, 'club', W.clubs[C.cur.idx].name);
// 3. kids profile: no injuries
FCK.settings.profile = 'kids';
c = C.create({ clubId: 'fcb', seed: 3 });
while (C.next()) C.simulateNext();
console.log('kids easy', c.m.easy, 'injured', c.m.players.filter((p) => p.inj).length, 'tl', c.m.tl.length);
// 4. bad inputs
const p0 = c.m.players[0];
console.log('release many:', (() => { let r; for (let i = 0; i < 30; i++) r = M.release(c, c.m.players[c.m.players.length - 1]); return r; })(), 'squad', c.m.players.length);
console.log(errs ? 'ERRORS ' + errs : 'ALL OK');
