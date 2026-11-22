// node test/cards_sim.js : Ultimate Team: simulate a match without playing it (no browser)
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'i18n', 'i18n_career', 'worlddata', 'world', 'season', 'sim', 'rules', 'ai', 'cards'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
FCK.setup = { match: Object.assign({}, FCK.DEFAULT_MATCH) };
FCK.presetSlots = () => [];
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
globalThis.btoa = globalThis.btoa || ((s) => Buffer.from(s, 'binary').toString('base64'));
globalThis.unescape = globalThis.unescape || require('querystring').unescape;
const W = FCK.World.build(), C = FCK.Cards, U = FCK.U;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
C.fresh(7); const S = C.S; C.save = () => {};
let w = 0, d = 0, l = 0;
for (let i = 0; i < 6; i++) {
  const before = S.st.played, coins = S.coins;
  const r = C.simulate('ladder');
  ok(r && !r.err && r.info, 'simulation returns a result ' + JSON.stringify(r && r.err));
  ok(S.st.played === before + 1, 'result is booked'); ok(S.coins > coins, 'coins are paid');
  ok(S.rank.m >= 1 || S.rank.res.length === 0, 'ladder progresses');
  if (r.info) { if (r.info.res === 'W') w++; else if (r.info.res === 'D') d++; else l++; }
}
console.log({ w, d, l, played: S.st.played });
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
