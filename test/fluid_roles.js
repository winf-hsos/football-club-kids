// node test/fluid_roles.js [matches] : how far do players leave their role zone? (AI vs AI, no humans)
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
const N = +process.argv[2] || 4;
const acc = { dfOpp: 0, dfN: 0, mfBox: 0, mfN: 0, fwDeep: 0, fwN: 0, goals: 0, shots: 0, matches: 0 };
for (let s = 1; s <= N; s++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 4, level: 'pro', homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + s), '4-4-2')] });
  m.autoProceed = true;
  let steps = 0;
  while (m.mode !== 'over' && steps++ < 60 * 60 * 12) {
    m.update(1 / 60);
    if (steps % 30 || m.mode !== 'play') continue;
    m.teams.forEach((t) => t.players.forEach((p) => {
      if (!p.onPitch || p.isGK) return;
      const d = t.depth(p.x);
      if (p.role === 'DF') { acc.dfN++; if (d > 0.55) acc.dfOpp++; }
      if (p.role === 'MF') { acc.mfN++; if (d > 0.85 && Math.abs(p.y - 34) < 10) acc.mfBox++; }
      if (p.role === 'FW') { acc.fwN++; if (d < 0.4) acc.fwDeep++; }
    }));
  }
  acc.matches++; acc.goals += m.teams[0].score + m.teams[1].score; acc.shots += m.teams[0].stats.shots + m.teams[1].stats.shots;
}
const pc = (a, n) => (100 * a / Math.max(1, n)).toFixed(1) + '%';
console.log('DF in opp half', pc(acc.dfOpp, acc.dfN), '| MF in box', pc(acc.mfBox, acc.mfN), '| FW deep', pc(acc.fwDeep, acc.fwN), '| goals/match', (acc.goals / acc.matches).toFixed(2), '| shots/match', (acc.shots / acc.matches).toFixed(1));
