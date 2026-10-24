// node test/mgr_sim.js [seasons] : manager mode smoke test (no browser)
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'i18n', 'i18n_career', 'worlddata', 'world', 'season', 'manager', 'market', 'youth', 'mgrseason', 'career'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
const W = FCK.World.build(), C = FCK.Career, M = FCK.Mgr;
const club = process.argv[3] || 'fcb';
const seasons = +process.argv[2] || 3;
let errs = 0; const err = (m) => { errs++; if (errs < 30) console.log('ERR', m); };
let t0 = Date.now();
const c = C.create({ clubId: club, seed: 4242 });
console.log('create', Date.now() - t0, 'ms', c.m.players.length, 'players', c.m.youth.length, 'youth', 'rev', M.money(c.m.rev), 'cash', M.money(c.m.cash), 'tb', M.money(c.m.tb), 'wb', M.money(c.m.wb), 'bill', M.money(M.bill(c)), 'S', c.m.S);
console.log('obj', JSON.stringify(c.m.obj));
console.log('squad', M.sorted(c).slice(0, 5).map((p) => p.n + ' ' + p.pos + ' ' + p.o + '/' + p.pt + ' ' + p.ag + 'y ' + M.money(M.recValue ? 0 : 0)).join(' | '));
for (let s = 0; s < seasons; s++) {
  t0 = Date.now();
  // transfers in the summer window
  if (M.window(c)) {
    t0 = Date.now();
    const res = M.search(c, { cc: W.groups[c.sim.gid[c.idx]].cc, ovrMin: Math.round(c.m.S) - 2, sort: 'ovr', limit: 5 });
    console.log('search', Date.now() - t0, 'ms', res.length, res.slice(0, 3).map((e) => e.n + ' ' + e.o + ' ' + M.money(M.askFee(c, e))).join(' | '));
    t0 = Date.now(); const big = M.search(c, { limit: 5, sort: 'gem', ageMax: 21 }); console.log('global search', Date.now() - t0, 'ms', big.length, big.slice(0, 2).map((e) => e.n + ' ' + e.o + '/' + e.pt + ' ' + e.ag).join(' | '));
    const e = res.find((x) => x.val <= c.m.tb * 0.9) || res[res.length - 1];
    if (e) { const ask = M.askFee(c, e); const ev = M.evalBid(c, e, ask, e.w * 1.4, 3); const r = M.buy(c, e, ask, Math.round(ev.demand * 1.05 / 5) * 5, 3); console.log('buy', e.n, M.money(ask), r); }
    // sell the oldest
    const old = M.sorted(c).filter((p) => p.ag > 31)[0];
    if (old) { M.toggleList(c, old); }
    const fa = c.m.fa.slice().sort((a, b) => b.o - a.o)[0];
    console.log('fa', fa.n, fa.o, fa.ag, M.signFA(c, fa, fa.w, 2));
    const y = c.m.youth.filter((v) => v.ag >= 16).sort((a, b) => b.pt - a.pt)[0]; if (y) console.log('promote', y.n, y.o + '/' + y.pt, M.promote(c, y));
    M.startMission(c, { cc: 'en', ageMax: 21 });
  }
  let n = 0;
  while (C.next()) {
    n++;
    if (n === 12) { const o = C.autosave; }
    const out = C.simulateNext();
    if (!out) break;
    const m = c.m;
    if (m.offers.length && M.window(c)) { const of = m.offers[0]; const r = M.acceptOffer(c, of); if (r !== 'ok' && n < 3) console.log('accept', r); }
    if (m.sacked) break;
  }
  const sm = C.seasonSummary();
  const rev = M.review(c);
  console.log('season', c.sim.year, 'pos', sm.pos + '/' + sm.n, 'matches', n, 'ms', Date.now() - t0, 'cash', M.money(c.m.cash), 'bc', c.m.bc.toFixed(0), 'mood', c.m.mood.toFixed(0), 'S', c.m.S, 'expiring', rev.expiring.length, 'grads', rev.grads.length, 'inj now', c.m.players.filter((p) => p.inj).length);
  // renew most expiring
  rev.expiring.forEach((p) => { const d = M.renewDemand(c, p); M.renew(c, p, d, 2); });
  const out = C.endSeason();
  const rp = out.rep;
  console.log(' -> ev', rp.ev.map((o) => o.k + (o.ok ? '+' : '-')).join(' '), 'prize', M.money(Math.round(rp.tot)), 'inc', M.money(Math.round(rp.inc)), 'exp', M.money(Math.round(rp.exp)), 'bc', rp.bc0.toFixed(0) + '->' + rp.bc1.toFixed(0), 'sacked', rp.sacked, 'offers', rp.offers.length, 'left', rp.left.length, 'ret', rp.retired.length, 'grads', (rp.grads || []).length);
  console.log(' new season', c.sim.year, 'squad', M.squad(c).length, 'youth', c.m.youth.length, 'S', c.m.S, 'rev', M.money(c.m.rev), 'tb', M.money(c.m.tb), 'wb', M.money(c.m.wb), 'bill', M.money(M.bill(c)), 'obj', c.m.obj.map((o) => o.k + (o.p || o.t || '')).join(','));
  if (M.squad(c).length < 16 || M.squad(c).length > 32) err('squad size ' + M.squad(c).length);
  if (rp.sacked) { console.log(' SACKED'); const i = rp.offers[0] || (c.idx + 5) % W.clubs.length; C.switchClub(i); console.log(' new club', W.clubs[c.idx].name); }
  // pack / unpack roundtrip
  const pk = JSON.parse(JSON.stringify(C.pack()));
  const sz = JSON.stringify(pk).length;
  const c2 = C.unpack(pk);
  if (c2.m.players.length !== c.m.players.length || Math.abs(c2.m.cash - c.m.cash) > 1e-6) err('pack roundtrip');
  C.cur = c2; Object.assign(c, {}); 
  console.log(' pack', (sz / 1024).toFixed(0) + ' KB');
  // continue with the unpacked copy
  var cc2 = c2;
  C.cur = c2;
  Object.keys(c).forEach((k) => { c[k] = c2[k]; });
  C.cur = c;
}
console.log(errs ? 'ERRORS ' + errs : 'ALL OK');
