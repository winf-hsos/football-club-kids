// node test/cards_sk.js : special card styles (Team of the Week, Icon, ...) are rolled deterministically and only on the right rarities
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'i18n', 'i18n_career', 'worlddata', 'world', 'season', 'sim', 'rules', 'ai', 'cards'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
FCK.setup = { match: Object.assign({}, FCK.DEFAULT_MATCH) };
FCK.presetSlots = () => [];
FCK.World.build();
const C = FCK.Cards, U = FCK.U;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
const S = C.fresh(777), rng = U.makeRng(4242);
const cnt = {}, tot = {};
for (let i = 0; i < 6000; i++) {
  const c = C.gen(S, rng, { w: [20, 20, 25, 20, 15] });
  tot[c.r] = (tot[c.r] || 0) + 1;
  if (c.sk) { cnt[c.r + c.sk] = (cnt[c.r + c.sk] || 0) + 1; ok(c.rare === 1, 'special cards are rare'); ok(C.SK[c.r] && C.SK[c.r].some((x) => x[0] === c.sk), 'style fits rarity'); }
  ok(!c.sk || c.r >= 2, 'no style below gold');
  ok(C.rollStyle(c) === (c.sk || null), 'deterministic');
}
console.log(JSON.stringify(cnt), JSON.stringify(tot));
['3totw', '3tots', '3hero', '3potm', '2otw', '4toty'].forEach((k) => ok((cnt[k] || 0) > 20, 'style appears: ' + k));
const a = { o: 85, r: 3, rare: 1, sd: 5 }, b = Object.assign({}, a, { sk: 'totw' });
ok(C.value(b) > C.value(a), 'special cards are worth more');
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
