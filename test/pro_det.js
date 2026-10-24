// node test/pro_det.js : the 31 detail values (36 for keepers) behind the six pro values
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'crest', 'i18n', 'i18n_career', 'natdata', 'names', 'worlddata', 'world', 'season', 'sim', 'manager', 'tourney', 'career', 'pro'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' }; FCK.T = (k) => k;
const W = FCK.World.build(), C = FCK.Career, P = FCK.Pro;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
ok(P.DKEYS.length === 31, 'outfield detail count ' + P.DKEYS.length);
ok(P.DKEYS.length + P.GKD.length === 36, 'with keeper values 36');
for (const pos of ['ST', 'CB', 'GK', 'CAM']) {
  const p = P.newPlayer({ name: 'Test', nation: 'GER', pos, age: 18, arch: 'balanced', talent: 'gem', seed: 5 });
  ok(P.DKEYS.every((k) => typeof p.d[k] === 'number' && p.d[k] >= 20 && p.d[k] <= 99), 'details in range ' + pos);
  const a0 = Object.assign({}, p.a);
  P.sync(p);
  P.ATTR.forEach((k) => ok(Math.abs(p.a[k] - a0[k]) < 0.01, 'headline = weighted average ' + k + ' ' + pos));
}
// ST: finishing is stronger than marking, CB the other way round
const st = P.newPlayer({ name: 'S', nation: 'GER', pos: 'ST', age: 18, talent: 'gem', seed: 9 }), cb = P.newPlayer({ name: 'C', nation: 'GER', pos: 'CB', age: 18, talent: 'gem', seed: 9 });
ok(st.d.finish > st.d.mark + 8, 'striker: finishing > marking'); ok(cb.d.mark > cb.d.finish + 8, 'centre back: marking > finishing');
// old save without details gets them, the six values stay
const old = P.newPlayer({ name: 'Alt', nation: 'GER', pos: 'CM', age: 20, talent: 'solid', seed: 3 }); const keep = Object.assign({}, old.a);
delete old.d; delete old.dm; P.fix(old); P.sync(old);
P.ATTR.forEach((k) => ok(Math.abs(old.a[k] - keep[k]) < 0.5, 'old save keeps ' + k));
// spending: +2 on one detail, headline moves by weight x 2
const c = { pro: st }; st.sp = 5; const f0 = st.d.finish, h0 = st.a.sho;
ok(P.spend(c, 'finish') && Math.abs(st.d.finish - f0 - P.SP_GAIN) < 0.01 && Math.abs(st.a.sho - h0 - 0.3 * P.SP_GAIN) < 0.05 && st.sp === 4, 'spend on a detail');
ok(P.spend(c, 'dri') && st.sp === 3, 'spend on a group still works');
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
