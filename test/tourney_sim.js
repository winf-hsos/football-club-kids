// node test/tourney_sim.js [runs] : simulate full tournaments of every format and check invariants
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'crest', 'natdata', 'names', 'worlddata', 'world', 'tourney'].forEach(load);
FCK.settings = { lang: 'de' };
FCK.World.build();
const Tn = FCK.Tourney;
Tn.register();
const runs = +process.argv[2] || 30;
let errs = 0; const err = (m) => { errs++; if (errs < 40) console.log('ERR', m); };
const assert = (c, m) => { if (!c) err(m); };
console.log('nations', FCK.NATIONS.length, 'in TEAMS', FCK.TEAMS.filter((t) => t.nation).length);
const confs = {}; FCK.NATIONS.forEach((n) => { confs[n.conf] = (confs[n.conf] || 0) + 1; });
console.log('confederations', JSON.stringify(confs));
assert(new Set(FCK.NATIONS.map((n) => n.id)).size === FCK.NATIONS.length, 'duplicate nation ids');
FCK.NATIONS.forEach((n) => { assert(FCK.NAMES[n.g], 'name group missing ' + n.id + ' ' + n.g); assert(FCK.SKIN_W[n.g], 'skin weights missing ' + n.g); });
const expect = { wm48: 104, wm32: 64, em24: 51 };
const champs = {};
for (const kind of Tn.KIND_KEYS) {
  const win = {}; let goals = 0, matches = 0, et = 0, pens = 0, draws = 0, favWin = 0;
  for (let i = 0; i < runs; i++) {
    const me = i % 3 === 0 ? null : FCK.NATIONS[(i * 7) % FCK.NATIONS.length].id;
    const S = Tn.create({ kind, me, seed: 1000 + i * 17 });
    const fmt = Tn.FORMATS[kind];
    assert(S.teams.length === fmt.n && new Set(S.teams).size === fmt.n, kind + ' field size ' + S.teams.length);
    if (me) assert(S.teams.includes(me), 'chosen team missing in field');
    assert(S.groups.every((g) => g.length === fmt.n / fmt.groups), 'group sizes');
    if (kind !== 'em24') S.groups.forEach((g) => { const cnt = {}; g.forEach((id) => { const c = FCK.NATION_BY_ID[id].conf; cnt[c] = (cnt[c] || 0) + 1; }); Object.keys(cnt).forEach((c) => assert(c === 'UEFA' ? cnt[c] <= 2 : cnt[c] <= 1, 'group confederation rule ' + JSON.stringify(cnt))); });
    // play: user's matches are simulated step by step like the UI does
    let guard = 0;
    Tn.settle(S);
    while (!S.done && guard++ < 200) {
      if (S.me && Tn.myFixture(S)) { Tn.simMine(S); Tn.settle(S); } else Tn.settle(S, (guard % 2) ? {} : { all: true });
    }
    assert(S.done, kind + ' not finished');
    const played = Tn.matchCount(S);
    assert(played === expect[kind], kind + ' matches ' + played + ' expected ' + expect[kind]);
    assert(Tn.totalMatches(S) === expect[kind], 'totalMatches formula');
    assert(S.champ && S.second && S.champ !== S.second, 'champion/second');
    if (fmt.third) assert(S.third && S.fourth && new Set([S.champ, S.second, S.third, S.fourth]).size === 4, 'top four');
    // every ko fixture has a winner, groups consistent
    S.rounds.forEach((R) => R.fx.forEach((f) => {
      assert(f.done && Number.isInteger(f.ga) && Number.isInteger(f.gb), 'fixture result');
      if (R.type === 'ko') { assert(Tn.winnerOf(f), 'ko winner ' + R.key); if (f.ga === f.gb) assert(f.pens && f.pens[0] !== f.pens[1], 'pens'); if (f.ga === f.gb) pens++; if (f.et) et++; }
      else if (f.ga === f.gb) draws++;
      goals += f.ga + f.gb; matches++;
      assert(f.a !== f.b, 'self match');
      if (R.type === 'ko' && R.key === (kind === 'wm48' ? 'R32' : 'R16')) { /* first ko round: same-group collisions counted below */ }
    }));
    // first ko round: no same-group pairs (if avoidable)
    const first = S.rounds.find((R) => R.type === 'ko');
    const grpOf = {}; S.groups.forEach((g, gi) => g.forEach((id) => { grpOf[id] = gi; }));
    const same = first.fx.filter((f) => grpOf[f.a] === grpOf[f.b]).length;
    assert(same === 0, kind + ' same-group pairs in first ko round: ' + same);
    // each team plays 3 group matches
    const cnt = {}; S.rounds.filter((R) => R.type === 'group').forEach((R) => R.fx.forEach((f) => { cnt[f.a] = (cnt[f.a] || 0) + 1; cnt[f.b] = (cnt[f.b] || 0) + 1; }));
    assert(S.teams.every((id) => cnt[id] === 3), 'each team 3 group matches');
    // teams that advanced: first ko round has exactly the right number
    assert(first.fx.length * 2 === fmt.groups * fmt.adv + fmt.thirds, 'ko size');
    // places: everyone has an out marker
    assert(S.teams.every((id) => S.out[id]), 'out markers complete');
    // tables sorted
    S.groups.forEach((g, gi) => { const t = Tn.table(S, gi); for (let k = 1; k < t.length; k++) assert(t[k - 1].pts >= t[k].pts, 'table order'); });
    // scorers equal goals scored (all matches simulated here)
    const sg = Object.values(S.sc).reduce((a, x) => a + x.g, 0);
    let tg = 0; S.rounds.forEach((R) => R.fx.forEach((f) => { tg += f.ga + f.gb; }));
    assert(sg === tg, 'scorer goals ' + sg + ' vs ' + tg);
    win[S.champ] = (win[S.champ] || 0) + 1;
    const top = S.teams.slice().sort((a, b) => S.r[b] - S.r[a])[0];
    if (S.champ === top) favWin++;
    // save / reload roundtrip
    const rt = JSON.parse(JSON.stringify(S)); assert(Tn.valid(rt), 'valid after roundtrip');
  }
  champs[kind] = win;
  console.log(kind, 'runs', runs, 'avg goals/match', (goals / matches).toFixed(2), 'draw share(group)', (draws / (matches * 0.6)).toFixed(2), 'ET', et, 'pens', pens, 'top-rated champion', favWin + '/' + runs,
    'champions', Object.keys(win).sort((a, b) => win[b] - win[a]).slice(0, 5).map((k) => k + ':' + win[k]).join(' '));
}
// resume determinism: simulating the same state twice gives the same result
{
  const A = Tn.create({ kind: 'wm48', me: 'GER', seed: 4242 }), B = JSON.parse(JSON.stringify(A));
  Tn.settle(A); Tn.simMine(A); Tn.settle(A, { all: true });
  Tn.settle(B); Tn.simMine(B); Tn.settle(B, { all: true });
  assert(A.champ === B.champ && JSON.stringify(A.rounds) === JSON.stringify(B.rounds), 'deterministic');
}
console.log(errs ? errs + ' ERRORS' : 'tourney sim OK');
process.exit(errs ? 1 : 0);
