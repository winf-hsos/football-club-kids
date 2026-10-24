// node test/headers.js [matches] : field players head high balls (crosses, lobs, clearances); prints header counts and what came of them
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
const N = +process.argv[2] || 6;
let heads = 0, shots = 0, goals = 0, errs = 0, outOfBounds = 0;
for (let s = 1; s <= N; s++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 4, level: 'pro', homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + s), '4-4-2')] });
  m.autoProceed = true;
  let lastHeader = null;
  m.on((e) => {
    if (e.type === 'header') { heads++; const sh = m.ball.shotBy === e.by; if (sh) shots++; lastHeader = { by: e.by, t: m.clock, shot: sh }; }
    if (e.type === 'goal' && lastHeader && lastHeader.shot && m.clock - lastHeader.t < 4) goals++;
  });
  let steps = 0;
  while (m.mode !== 'over' && steps++ < 60 * 60 * 12) {
    try { m.update(1 / 60); } catch (e) { errs++; console.log(e.stack); break; }
    const bl = m.ball; if (!isFinite(bl.x) || !isFinite(bl.z)) { errs++; break; }
  }
}
console.log('matches', N, 'headers/match', (heads / N).toFixed(1), 'header shots/match', (shots / N).toFixed(1), 'header goals', goals, 'errors', errs);
if (errs || heads / N < 3) { console.log('FAIL'); process.exit(1); }
console.log('OK');
