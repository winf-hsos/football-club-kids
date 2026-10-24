// node test/gk_rush.js : an attacker dribbling straight at goal must be met by the keeper (smother / rush out)
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK, U = FCK.U;
let goals = 0, stops = 0, runs = 30;
for (let s = 1; s <= runs; s++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 4, level: 'pro', homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + s), '4-4-2')] });
  m.autoProceed = true;
  for (let i = 0; i < 400 && m.mode !== 'play'; i++) m.update(1 / 60);
  const att = m.teams[0].players.find((p) => !p.isGK && p.onPitch), tgt = m.teams[0].goalX;
  const def = m.teams[1].players;
  // clear the area: other defenders far away
  def.forEach((p) => { if (!p.isGK) { p.x = tgt - m.teams[0].dir * 45; p.y = 10; } });
  att.x = tgt - m.teams[0].dir * 25; att.y = 34; att.vx = att.vy = 0; att.state = 'idle';
  m.ball.owner = att; m.ball.x = att.x; m.ball.y = att.y; m.ball.vx = m.ball.vy = 0;
  const g0 = m.teams[0].score;
  let res = 'none';
  for (let i = 0; i < 60 * 8; i++) {
    if (m.ball.owner === att) { m.moveTo(att, tgt, 34, 1); att.sprint = true; }
    m.update(1 / 60);
    if (m.teams[0].score > g0) { res = 'goal'; break; }
    if (m.ball.owner && m.ball.owner.isGK && m.ball.owner.ti === 1) { res = 'stop'; break; }
  }
  if (res === 'goal') goals++; else stops++;
}
console.log('goals', goals, 'stopped', stops, 'of', runs);
if (stops < runs * 0.8) { console.log('FAIL'); process.exit(1); }
console.log('OK');
