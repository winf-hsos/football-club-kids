// node test/pro_req.js : pro career transfer request (mid-season) smoke test
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'crest', 'i18n', 'i18n_career', 'natdata', 'names', 'worlddata', 'world', 'season', 'sim', 'manager', 'tourney', 'career', 'pro'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
FCK.T = (k) => k;
const W = FCK.World.build(), C = FCK.Career, P = FCK.Pro;
FCK.Tourney.register && FCK.Tourney.register();
let errs = 0; const err = (m) => { errs++; console.log('ERR', m); };
const pl = P.newPlayer({ name: 'Test Spieler', nation: 'GER', pos: 'ST', age: 20, arch: 'balanced', talent: 'gem', seed: 5 });
const club = W.clubs.find((c) => c.tier === 2 && c.cc === 'de');
const c = C.create({ clubId: club.id, pro: pl, seed: 11, years: 3 });
const stats = { ok: 0, squad: 0, high: 0, no: 0 };
for (let s = 0; s < 4; s++) {
  for (let k = 0; k < 6; k++) { if (c.pro.pending === 'offers' || c.pro.pending === 'optional') P.acceptOffer(c, c.pro.offers[0]); C.simulateNext(); }
  if (!P.canRequest(c)) { console.log('cannot request, pending', c.pro.pending); }
  // try several clubs until one accepts
  const cands = W.clubs.filter((x) => x.idx !== c.idx).sort(() => Math.random() - 0.5).slice(0, 60);
  let moved = false, tries = 0;
  for (const cl of cands) {
    if (P.requestsLeft(c) <= 0) break;
    tries++;
    const res = P.requestTransfer(c, cl.idx);
    if (res.ok) { stats.ok++; P.acceptOffer(c, res.offer); moved = true; if (c.idx !== cl.idx || c.sim.userIdx !== cl.idx) err('not moved'); break; }
    stats[res.why] = (stats[res.why] || 0) + 1;
  }
  if (P.requestsLeft(c) !== (moved && tries === 1 ? 1 : moved ? 0 : 0) && tries <= 2) err('requestsLeft ' + P.requestsLeft(c) + ' tries ' + tries);
  if (P.requestTransfer(c, W.clubs[c.idx].idx).why !== 'same') err('same club not detected');
  if (P.simSquad(c)[c.pro.slot] && !P.simSquad(c)[c.pro.slot].pro) err('pro not in squad slot after move');
  let g = 0; while (g++ < 400) { if (c.pro.pending === 'offers' || c.pro.pending === 'optional') P.acceptOffer(c, c.pro.offers[0]); if (!C.simulateNext()) break; }
  const sm = C.endSeason(); if (!sm.pro) err('no pro report');
  const c2 = C.unpack(JSON.parse(JSON.stringify(C.pack()))); C.cur = c;
  if (!c2 || c2.pro.req === undefined && c.pro.req) err('req lost in roundtrip');
  console.log('season', c.sim.year, 'club', W.clubs[c.idx].name, 'tries', tries, moved ? 'moved' : 'stayed', 'req', JSON.stringify(c.pro.req));
}
{ // rejection paths: a young low-rated player asks the best clubs
  const pl2 = P.newPlayer({ name: 'Schwach Spieler', nation: 'GER', pos: 'CB', age: 17, arch: 'balanced', talent: 'late', seed: 9 });
  const c3 = C.create({ clubId: W.clubs.find((x) => x.tier === 3).id, pro: pl2, seed: 3, years: 3 });
  const top = W.clubs.slice().sort((a, b) => b.rating - a.rating).slice(0, 2);
  const out = top.map((t) => { const r = P.requestTransfer(c3, t.idx); return r.ok ? 'ok' : r.why; });
  console.log('top clubs for a weak player:', out.join(','), 'left', P.requestsLeft(c3));
  if (out.includes('ok')) err('weak player should not get top club');
  if (P.requestTransfer(c3, top[0].idx).why !== 'limit') err('limit not enforced');
}
console.log(JSON.stringify(stats));
console.log(errs ? 'FAILED ' + errs : 'pro req OK');
process.exit(errs ? 1 : 0);
