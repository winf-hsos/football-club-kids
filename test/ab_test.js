// node test/ab_test.js [matches] : the 30 abilities - catalog checks and an A/B match comparison (team 0 gets abilities, team 1 none)
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'abilities', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK, A = FCK.Abilities;
let errs = 0; const err = (m) => { errs++; console.log('ERR', m); };
if (A.LIST.length !== 30) err('need 30 abilities, got ' + A.LIST.length);
const keysSeen = new Set();
A.LIST.forEach((a) => { if (!A.GROUPS.includes(a.grp)) err('group ' + a.id); if (!a.cost || !a.fx || !Object.keys(a.fx).length) err('def ' + a.id); Object.keys(a.fx).forEach((k) => keysSeen.add(k)); });
// every fx key must be read by the engine
const src = ['sim', 'rules', 'ai'].map((f) => fs.readFileSync(path.join(dir, f + '.js'), 'utf8')).join('\n');
keysSeen.forEach((k) => { if (!new RegExp('abx\\.' + k + '\\b|X\\.' + k + '\\b|\\.' + k + '\\b').test(src)) err('engine never reads ' + k); });
// every non-gk ability must be reachable: a player with high attrs can unlock all
const rich = { pos: 'ST', sp: 99, a: { pac: 90, sho: 90, pas: 90, dri: 90, def: 90, phy: 90, gk: 20 }, ab: [] };
const richGK = { pos: 'GK', sp: 99, a: { pac: 60, sho: 30, pas: 70, dri: 40, def: 30, phy: 70, gk: 90 }, ab: [] };
A.LIST.forEach((a) => { const p = A.allowed(a, 'ST') ? rich : richGK; if (A.why(p, a.id)) err('cannot unlock ' + a.id + ': ' + A.why(p, a.id)); });
console.log('catalog ok:', A.LIST.length, 'abilities, engine keys', [...keysSeen].length);
// A/B
const N = +process.argv[2] || 8;
function run(withAb, swap) {
  const st = { n: [0, 0], ok: [0, 0], sh: [0, 0], sot: [0, 0], g: [0, 0], tk: [0, 0], tkw: [0, 0], fouls: [0, 0], stam: [0, 0] };
  for (let s = 1; s <= N; s++) {
    const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
    const sa = FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), sb = FCK.pickSquad(FCK.makeFullSquad(b, 11 + s), '4-3-3');
    const give = (sq) => { sq.lineup.concat(sq.bench).forEach((q) => { q.ab = q.role === 'GK' ? A.LIST.filter((x) => x.pos !== 'f').map((x) => x.id) : A.LIST.filter((x) => x.pos !== 'g').map((x) => x.id); }); };
    if (withAb) give(swap ? sb : sa);
    const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 4, level: 'pro', homeFormation: '4-3-3', awayFormation: '4-3-3' }, slots: [], squads: [sa, sb] });
    m.autoProceed = true;
    let n = 0; while (m.mode !== 'over' && n++ < 60 * 60 * 12) m.update(1 / 60);
    for (let i = 0; i < 2; i++) { const t = m.teams[i], S = t.stats; st.n[i] += S.passes; st.ok[i] += S.passOk; st.sh[i] += S.shots; st.sot[i] += S.sot; st.g[i] += t.score; st.tk[i] += S.tackles; st.tkw[i] += S.tackleWon; st.fouls[i] += S.fouls; }
  }
  const f = (i) => ({ pass: (100 * st.ok[i] / Math.max(1, st.n[i])).toFixed(1), shots: st.sh[i], sot: st.sot[i], goals: st.g[i], tackleWin: (100 * st.tkw[i] / Math.max(1, st.tk[i])).toFixed(1), fouls: st.fouls[i] });
  return [f(0), f(1)];
}
const base = run(false), ab = run(true), abSwap = run(true, true);
console.log('baseline  team0', JSON.stringify(base[0]), '\n          team1', JSON.stringify(base[1]));
console.log('abilities team0', JSON.stringify(ab[0]), '\n   (none) team1', JSON.stringify(ab[1]));
console.log('swapped   team0', JSON.stringify(abSwap[0]), '(none)\n   abil.  team1', JSON.stringify(abSwap[1]));
console.log(errs ? 'FAILED ' + errs : 'abilities OK');
process.exit(errs ? 1 : 0);
