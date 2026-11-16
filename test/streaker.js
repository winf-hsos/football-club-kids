// node test/streaker.js : the streaker (a fan in a dino costume, chased by stewards) crosses the pitch and is led off
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
// default chance is about 1 in 1000 matches
let hits = 0; const N = 2000;
for (let s = 1; s <= N; s++) { const a = FCK.teamById('fcb'), b = FCK.teamById('mci'); const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 2, level: 'pro' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 1), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 2), '4-4-2')] }); if (m.streak) hits++; }
console.log('matches with a streaker', hits, 'of', N);
ok(hits <= 8, 'streakers are rare');
// forced streaker
const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
const m = new FCK.Match({ clubs: [a, b], seed: 5, settings: { halfMins: 3, level: 'pro', streaker: 1 }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 1), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 2), '4-4-2')] });
m.autoProceed = true; let ev = 0, ran = 0, led = 0, steps = 0;
m.on((e) => { if (e.type === 'streaker') ev++; });
while (m.mode !== 'over' && steps++ < 60 * 60 * 10) { m.update(1 / 60); if (m.streak.state === 'run') ran++; if (m.streak.state === 'led') led++; }
ok(ev === 1, 'one streaker event'); ok(ran > 60 * 8, 'he runs for a while: ' + ran); ok(led > 0 || m.streak.state === 'done', 'stewards catch him'); ok(m.streak.state === 'done', 'he leaves the pitch');
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
