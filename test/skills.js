// node test/skills.js : skill moves (step-over, rainbow flick, roulette) work in the sim and the CPU uses them
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
function mk(seed) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed, settings: { halfMins: 4, level: 'pro', homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + seed), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + seed), '4-4-2')] });
  m.autoProceed = true; return m;
}
// direct trigger
for (const kind of ['stepover', 'rainbow', 'roulette']) {
  const m = mk(3);
  for (let i = 0; i < 400 && m.mode !== 'play'; i++) m.update(1 / 60);
  const p = m.teams[0].players.find((q) => !q.isGK && q.onPitch);
  m.ball.owner = p; m.ball.x = p.x; m.ball.y = p.y;
  const ok1 = m.skillMove(p, kind, [p.team.dir, 0]);
  ok(ok1 && p.skillKind === kind && p.skillT > 0, kind + ' starts');
  ok(!m.skillMove(p, kind, [1, 0]), kind + ' cooldown blocks a second one');
  if (kind === 'rainbow') { ok(!m.ball.owner && m.ball.vz > 4, 'rainbow lifts the ball'); for (let i = 0; i < 90; i++) m.update(1 / 60); ok(m.ball.z < 3, 'ball lands again'); }
}
// CPU usage in whole matches
let n = 0; const kinds = {};
for (let s = 1; s <= 4; s++) {
  const m = mk(s); m.on((e) => { if (e.type === 'skill') { n++; kinds[e.kind] = (kinds[e.kind] || 0) + 1; } });
  let steps = 0; while (m.mode !== 'over' && steps++ < 60 * 60 * 12) m.update(1 / 60);
}
console.log('CPU skill moves in 4 matches', n, JSON.stringify(kinds));
ok(n >= 4 && n < 400, 'CPU uses skill moves a sensible number of times');
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
