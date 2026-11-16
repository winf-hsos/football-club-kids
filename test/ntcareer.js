// node test/ntcareer.js : national team career (any nation, several tournaments, goal / confidence / dismissal)
globalThis.window = { localStorage: null }; globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'crest', 'face', 'flags', 'i18n', 'i18n_career', 'natdata', 'names', 'worlddata', 'world', 'season', 'sim', 'rules', 'ai', 'tourney', 'ntcareer'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' }; FCK.setup = { match: { homeFormation: '4-3-3' } };
FCK.World.build(); FCK.Tourney.register && FCK.Tourney.register();
const NT = FCK.NTCareer, Tn = FCK.Tourney;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
ok(NT.kindOf(2026, 'GER') === 'wm48' && NT.kindOf(2028, 'GER') === 'em24' && NT.kindOf(2028, 'BRA') === 'cont' && NT.kindOf(2030, 'GER') === 'wm48', 'cycle of tournaments');
ok(NT.goalFor('ESP', 'wm48') === 'SF' && NT.goalFor('AND', 'wm48') === 'G', 'goals by strength');
for (const nat of ['GER', 'AND', 'BRA', 'NZL']) {
  NT.clear(); NT.start({ nat, coach: 'Test' });
  let played = 0, dnq = 0, guard = 0;
  while (!NT.S.fired && guard++ < 12) {
    const prep = NT.prepare();
    if (prep.auto) { ok(prep.rec && prep.rec.kind === 'cont', 'continental result'); played++; continue; }
    if (!prep.qualified) { NT.skip(); dnq++; continue; }
    const S = prep.S; ok(S.ntc && S.me === nat, 'tournament belongs to the career');
    let g = 0; Tn.settle(S); while (!S.done && g++ < 200) { if (S.me && Tn.myFixture(S)) { Tn.simMine(S); Tn.settle(S); } else Tn.settle(S, { all: true }); }
    ok(S.done, 'tournament finishes ' + nat); if (!S.done) break;
    const rec = NT.finish(S); ok(rec && typeof rec.ok === 'boolean', 'result booked'); played++;
    ok(NT.S.trust >= 0 && NT.S.trust <= 100, 'trust range');
  }
  console.log(nat, 'played', played, 'dnq', dnq, 'year', NT.S.year, 'trust', Math.round(NT.S.trust), 'titles', NT.S.titles, 'fired', NT.S.fired);
}
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
