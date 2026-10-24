// node test/pass_human.js [matches] [seedOffset]: scripted human (always passes forward with the stick) - completion rate of human passes
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = process.env.JSDIR || path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
const N = +process.argv[2] || 4;
let n = 0, ok = 0, opp = 0, out = 0, mate = 0;
for (let s = 1; s <= N; s++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 4, level: 'pro', homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [{ dev: 'kb1', team: 0 }], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + s), '4-4-2')] });
  m.autoProceed = true;
  let cur = null, cool = 0, t = 0;
  m.on((e) => { if (e.type === 'kick' && /^(pass|through|lob)$/.test(e.kind) && e.by.ctrlHuman) cur = { target: m.ball.passTarget, by: e.by }; });
  const fin = (r) => { if (!cur) return; n++; if (r === 'ok') ok++; else if (r === 'opp') opp++; else if (r === 'out') out++; else mate++; cur = null; };
  let steps = 0;
  while (m.mode !== 'over' && steps++ < 60 * 60 * 12) {
    const sl = m.slots[0], p = sl.player;
    const inp = { dx: 0, dy: 0, sprint: false, held: [false, false, false, false], pressed: [false, false, false, false], released: [false, false, false, false], pause: false };
    if (p && m.ball.owner === p && m.mode === 'play') {
      cool -= 1 / 60;
      inp.dx = p.team.dir; inp.dy = (Math.sin(steps / 90) * 0.5);
      if (cool <= 0 && !cur) { inp.pressed[0] = true; cool = 0.5 + (steps % 7) * 0.1; }
    } else if (p && !m.ball.owner && m.ball.passTarget !== p) { inp.dx = m.ball.x > p.x ? 0.7 : -0.7; inp.dy = m.ball.y > p.y ? 0.7 : -0.7; }
    sl.input = inp;
    m.update(1 / 60);
    if (cur && m.ball.owner) { const o = m.ball.owner; fin(o === cur.target ? 'ok' : o.ti === cur.by.ti ? 'mate' : 'opp'); }
    else if (cur && m.mode !== 'play') fin('out');
  }
}
const pc = (x) => (100 * x / Math.max(1, n)).toFixed(1) + '%';
console.log('human passes', n, 'ok', pc(ok), 'other mate', pc(mate), 'intercepted', pc(opp), 'out', pc(out));
