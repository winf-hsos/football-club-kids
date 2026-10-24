// node test/pro_sim.js [seasons] : pro career smoke test (no browser)
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'crest', 'i18n', 'i18n_career', 'natdata', 'names', 'worlddata', 'world', 'season', 'sim', 'manager', 'tourney', 'career', 'pro'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
FCK.T = (k) => k;
const W = FCK.World.build(), C = FCK.Career, P = FCK.Pro;
FCK.Tourney.register && FCK.Tourney.register();
let errs = 0; const err = (m) => { errs++; if (errs < 30) console.log('ERR', m); };
const seasons = +process.argv[2] || 6;
const poss = ['ST', 'CM', 'CB', 'GK', 'LW', 'RB', 'CAM', 'CDM'];
let t0 = Date.now();
poss.forEach((pos, pi) => {
  const pl = P.newPlayer({ name: 'Test Spieler', nation: 'GER', pos, age: 17, arch: 'balanced', talent: 'gem', seed: 100 + pi });
  const ovr0 = P.ovr(pl);
  if (Math.abs(ovr0 - (53 + 3)) > 3.5) err('start ovr ' + pos + ' ' + ovr0);
  const club = W.clubs.find((c) => c.tier === 2 && c.cc === 'de') || W.clubs[300];
  const c = C.create({ clubId: club.id, pro: pl, seed: 7 + pi, years: 3 });
  if (!c || !c.pro) { err('no career ' + pos); return; }
  const role0 = P.roleLabel(c);
  let apAll = 0, gAll = 0;
  for (let s = 0; s < seasons; s++) {
    let guard = 0;
    while (guard++ < 400) {
      if (c.pro.pending === 'offers' || c.pro.pending === 'optional') { const off = c.pro.offers; const pick = off[0]; P.acceptOffer(c, pick); }
      const r = C.simulateNext(); if (!r) break;
    }
    const S = c.pro.season;
    apAll += S.ap; gAll += S.g;
    const sm = C.endSeason();
    if (!sm.pro) err('no pro report');
    if (c.pro.age < 17) err('age');
    if (P.ovr(c.pro) > P.cap(c.pro) + 0.5) err('ovr above cap ' + P.ovr(c.pro) + ' ' + P.cap(c.pro));
    // spend points
    let n = 0; while (c.pro.sp > 0 && n++ < 80) { const k = P.ATTR[n % 6]; if (!P.spend(c, k)) { c.pro.sp--; } }
  }
  const p = c.pro;
  console.log(pos, 'age', p.age, 'ovr', ovr0.toFixed(1), '->', P.ovr(p).toFixed(1), 'pt', p.pt, 'role0', role0, 'club', W.clubs[c.idx].name, 'tot', p.tot.ap, 'ap', p.tot.g, 'g', p.tot.a, 'a', 'avg', (p.tot.rn ? p.tot.rs / p.tot.rn : 0).toFixed(2), 'caps', p.intl.caps, 'trophies', p.trophies.length, 'awards', p.awards.length);
  // persistence
  const packed = JSON.parse(JSON.stringify(C.pack()));
  const c2 = C.unpack(packed);
  if (!c2 || !c2.pro || c2.pro.name !== p.name || c2.sim.year !== c.sim.year) err('roundtrip ' + pos);
  if (P.simSquad(c2).length !== 24) err('squad size');
  if (!P.simSquad(c2)[p.slot].pro) err('pro not in squad slot');
});
console.log('time', Date.now() - t0, 'ms');
console.log(errs ? 'FAILED ' + errs : 'pro OK');
process.exit(errs ? 1 : 0);
