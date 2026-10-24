// node test/comp_sim.js : stand-alone competitions (every league group, every cup, CL/EL/ECL) simulate to the end, persist and stay consistent
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'crest', 'natdata', 'names', 'worlddata', 'world', 'season', 'career', 'comp'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
FCK.T = (k) => k;
const W = FCK.World; W.build();
const Co = FCK.Comp;
let errs = 0; const err = (m) => { errs++; if (errs < 40) console.log('ERR', m); };
const assert = (c, m) => { if (!c) err(m); };
const t0 = Date.now();
let nL = 0, nC = 0, nE = 0;
// 1) every league group, watching only
W.groups.forEach((g) => {
  const S = Co.create({ kind: 'league', id: g.gid, me: -1, seed: 100 + g.gid });
  let steps = 0;
  while (!S.done && steps++ < 200) Co.stepWatch();
  assert(S.done, 'league not done ' + g.gid);
  const tb = Co.main().table();
  const n = tb.length, rounds = g.rounds;
  assert(tb.every((r) => r.p === (n - 1) * rounds), 'games per club ' + g.gid + ' ' + tb[0].p + ' vs ' + (n - 1) * rounds);
  assert(tb.reduce((a, r) => a + r.gf, 0) === tb.reduce((a, r) => a + r.ga, 0), 'goals balance');
  const res = Co.result(); assert(res.champ === tb[0].idx, 'champion');
  nL++;
});
// 2) every cup, with me in it (quick sim of my games)
W.countries.forEach((co) => {
  if (!Co.hasCup(co.cc)) return;
  const ent = Co.entrants('cup', co.cc);
  const me = ent[(co.cc.charCodeAt(0) * 7) % ent.length];
  const S = Co.create({ kind: 'cup', id: co.cc, me, seed: 77 });
  let n = 0;
  while (!S.done && n++ < 60) {
    const nx = Co.next();
    if (nx) Co.simulateNext(); else if (Co.watching()) Co.stepWatch(); else break;
  }
  assert(S.done, 'cup not done ' + co.cc);
  const cup = Co.main(); assert(cup.w >= 0, 'cup winner ' + co.cc);
  const r = Co.result(); assert(r.champ === cup.w, 'cup champ');
  assert(Co.progress() === 1, 'progress 1');
  nC++;
});
// 3) European competitions with and without me
['cl', 'el', 'ecl'].forEach((k, i) => {
  [-1, 0, 5, 20].forEach((pick) => {
    const ent = Co.entrants('euro', k);
    assert(ent.length === 36, k + ' entrants ' + ent.length);
    const me = pick < 0 ? -1 : ent[pick];
    const S = Co.create({ kind: 'euro', id: k, me, seed: 5 + i });
    let n = 0;
    while (!S.done && n++ < 80) {
      const nx = Co.next();
      if (nx) Co.simulateNext(); else if (Co.watching()) Co.stepWatch(); else break;
    }
    assert(S.done, k + ' not done me=' + me);
    const eu = Co.main(); assert(eu.w >= 0, k + ' winner');
    assert(eu.ko.f && eu.ko.f.length === 1, 'final');
    assert(eu.ko.po.length === 8 && eu.ko.r16.length === 8 && eu.ko.qf.length === 4 && eu.ko.sf.length === 2, 'ko sizes');
    nE++;
  });
});
// 4) persistence round trip mid-way
{
  const g = W.groups.find((x) => x.cc === 'de' && x.tier === 1);
  const me = W.clubs.find((c) => c.gid === g.gid).idx;
  const S = Co.create({ kind: 'league', id: g.gid, me, seed: 4242 });
  for (let i = 0; i < 6; i++) Co.simulateNext();
  const before = JSON.stringify(Co.main().table().map((r) => [r.idx, r.pts, r.gf, r.ga]));
  const txt = Co.exportText();
  Co.S = null; const S2 = Co.importText(txt);
  assert(S2, 'import');
  const after = JSON.stringify(Co.main().table().map((r) => [r.idx, r.pts, r.gf, r.ga]));
  assert(before === after, 'table after import');
  assert(Co.main().md === 6, 'md after import ' + Co.main().md);
  Co.simulateAll();
  assert(Co.S.done && Co.finished(), 'finished');
  assert(Co.main().table().every((r) => r.p === 34), 'bundesliga 34 games');
  assert(Co.S.log.length === 34, 'my log ' + Co.S.log.length);
  const ts = Co.topScorers(5); assert(ts.length === 5 && ts[0].goals >= ts[4].goals, 'scorers');
}
console.log('leagues', nL, 'cups', nC, 'euro runs', nE, 'time', ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log(errs ? 'FAILED ' + errs : 'comp sim OK');
process.exit(errs ? 1 : 0);
