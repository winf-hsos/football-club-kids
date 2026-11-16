// node test/goal_cel.js : after a goal the scorer celebrates, mates join, opponents stand dejected, play resumes
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
let goals = 0, cels = {}, joined = 0, sad = 0, seen = 0;
for (let s = 1; s <= 6 && goals < 12; s++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 4, level: 'pro', homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + s), '4-4-2')] });
  m.autoProceed = true;
  let steps = 0, last = null, done = null;
  while (m.mode !== 'over' && steps++ < 60 * 60 * 12) {
    m.update(1 / 60);
    if (m.mode === 'goal' && m.lastGoal && m.lastGoal !== last && m.modeT < 0.5 && m.lastGoal !== done) { last = m.lastGoal; goals++; }
    if (m.mode === 'goal' && m.modeT > 4.0 && last) {
      done = last;
      seen++; cels[last.cel] = (cels[last.cel] || 0) + 1;
      joined += m.teams[last.team].players.filter((p) => p !== last.scorer && p.state === 'celebrate').length;
      sad += m.teams[1 - last.team].players.filter((p) => p.sadT > 0).length;
      last = null;
    }
  }
}
console.log('goals', goals, 'celebrations', JSON.stringify(cels), 'avg joined', (joined / Math.max(1, seen)).toFixed(1), 'avg sad', (sad / Math.max(1, seen)).toFixed(1));
ok(goals >= 4, 'goals happen'); ok(Object.keys(cels).length >= 2, 'celebration types vary'); ok(joined / Math.max(1, seen) >= 2, 'teammates join'); ok(sad / Math.max(1, seen) >= 6, 'opponents are dejected');
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
