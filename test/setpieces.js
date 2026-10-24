// set piece test: free kicks (curl), throw-ins, goal kicks, kick-offs, corners
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK, P = FCK.PITCH;
function trial(seed, type, x, y, team) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed, settings: { halfMins: 4 }, slots: [] });
  m.autoProceed = true;
  let steps = 0;
  while (m.mode !== 'play' && steps++ < 3000) m.update(1 / 60);
  m.update(1 / 60);
  const g0 = [m.teams[0].score, m.teams[1].score];
  m.setRestart(type, team, x, y);
  let outcome = 'none', flight = 0, curled = false, maxBend = 0, started = false, sx = 0, sy = 0, taken = false;
  for (let i = 0; i < 60 * 25; i++) {
    m.update(1 / 60);
    if (m.mode === 'play' && !taken) { taken = true; }
    if (m.teams[0].score !== g0[0] || m.teams[1].score !== g0[1]) { outcome = 'goal'; break; }
    if (taken && m.mode === 'restart') { outcome = 'next:' + m.restart.type; break; }
    if (m.ball.curl) curled = true;
  }
  return { outcome, curled, taken, mode: m.mode };
}
const out = {};
for (const [type, x, y, team] of [['freekick', 22, 34, 0], ['freekick', 18, 22, 0], ['freekick', 28, 40, 1], ['throwin', 40, 0.1, 0], ['goalkick', 5, 34, 1], ['kickoff', 52.5, 34, 0], ['corner', 0.2, 0.2, 1]]) {
  const key = type + '@' + x; out[key] = { n: 0, goal: 0, curled: 0, taken: 0, outs: {} };
  for (let s = 1; s <= 40; s++) {
    const px = team === 0 ? P.L - x : x; // team 0 attacks right goal
    const r = trial(s * 31, type, type === 'freekick' ? (team === 0 ? P.L - x : x) : (type === 'corner' ? (team === 0 ? P.L - 0.2 : 0.2) : x), y, team);
    const o = out[key]; o.n++; if (r.outcome === 'goal') o.goal++; if (r.curled) o.curled++; if (r.taken) o.taken++;
    const k = r.outcome.split(':')[0] + (r.outcome.includes(':') ? ':' + r.outcome.split(':')[1] : ''); o.outs[k] = (o.outs[k] || 0) + 1;
  }
}
console.log(JSON.stringify(out, null, 1));
