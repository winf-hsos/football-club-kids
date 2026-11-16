// node test/ceremony.js : after a final the winners celebrate on the pitch (substitutes run on, captain on the podium) before the result is shown
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
let ceremonies = 0;
for (let s = 1; s <= 4; s++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 3, level: 'pro', knockout: true, trophy: 'wm', homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + s), '4-4-2')] });
  m.autoProceed = true;
  let ended = 0, cer = 0, sawCeremony = false, maxElev = 0, onPitchWin = 0, steps = 0;
  m.on((e) => { if (e.type === 'ceremony') cer++; if (e.type === 'end') { ended++; ok(sawCeremony, 'the result comes after the ceremony'); } });
  while (m.mode !== 'over' && steps++ < 60 * 60 * 20) {
    m.update(1 / 60);
    if (m.mode === 'ceremony') { sawCeremony = true; m.players.forEach((p) => { maxElev = Math.max(maxElev, p.elev || 0); }); if (m.modeT > 14) onPitchWin = m.teams[m.winner].players.filter((p) => p.onPitch).length; }
  }
  ok(m.mode === 'over' && ended === 1, 'match ends once'); ok(cer === 1, 'ceremony starts once'); ok(maxElev > 1, 'captain climbs the podium'); ok(onPitchWin >= 14, 'substitutes are on the pitch: ' + onPitchWin);
  ceremonies += cer;
}
console.log('ceremonies', ceremonies);
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
