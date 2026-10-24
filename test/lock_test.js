// node test/lock_test.js : pro career engine support - one human slot tied to one player (bench entry, set pieces, no auto switching, shootout)
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
let errs = 0; const err = (m) => { errs++; console.log('ERR', m); };
function run(seed, lockSqi, at, setp) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const full = FCK.makeFullSquad(a, 11 + seed);
  const sqA = FCK.pickSquad(full, '4-3-3'), sqB = FCK.pickSquad(FCK.makeFullSquad(b, 5), '4-4-2');
  const m = new FCK.Match({ clubs: [a, b], seed, settings: { halfMins: 2, homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [{ dev: 'kb1', team: 0 }], squads: [sqA, sqB], lock: { team: 0, sqi: lockSqi, at, setp } });
  m.autoProceed = true;
  const ctrlSeen = new Set(); let onPitchTicks = 0, ffTicks = 0, switches = 0;
  m.on((e) => { if (e.type === 'switch') switches++; });
  let steps = 0;
  while (m.mode !== 'over' && steps++ < 60 * 60 * 12) {
    m.update(1 / 60);
    if (m.fastForward) ffTicks++;
    const t = m.teams[0];
    const ctl = t.players.filter((p) => p.ctrl >= 0);
    if (ctl.length > 1) err('more than one controlled player');
    ctl.forEach((p) => { ctrlSeen.add(p.d.sqi); });
    if (ctl.length) onPitchTicks++;
  }
  return { m, ctrlSeen, onPitchTicks, ffTicks, switches, steps };
}
// 1) starter: only the tied player is ever controlled, never auto-switched
const st = FCK.pickSquad(FCK.makeFullSquad(FCK.teamById('fcb'), 11 + 1), '4-3-3');
const starter = st.lineup[9].sqi; // a forward
const r1 = run(1, starter, null, ['penalty', 'freekick']);
if (r1.m.mode !== 'over') err('match 1 not finished');
if (![...r1.ctrlSeen].every((q) => q === starter)) err('controlled others: ' + [...r1.ctrlSeen]);
if (r1.switches) err('switch events in lock mode ' + r1.switches);
if (!r1.onPitchTicks) err('never controlled');
console.log('starter ok: controlled ticks', r1.onPitchTicks, 'steps', r1.steps);
// 2) bench: comes on at the planned minute, fast-forward flag is on before
const benchSqi = st.bench[3].sqi;
const r2 = run(2, benchSqi, 5, []);
const wasOn = r2.m.teams[0].all.some((p) => p.d.sqi === benchSqi);
// bench list of seed 2 differs from seed 1, so recompute the bench player for that run
{
  const full = FCK.makeFullSquad(FCK.teamById('fcb'), 11 + 2); const pk = FCK.pickSquad(full, '4-3-3');
  const bs = pk.bench[3].sqi;
  const r3 = run(2, bs, 5, []);
  const came = r3.m.teams[0].all.some((p) => p.d.sqi === bs && p.enter > 0);
  if (!came) err('bench player never came on');
  if (!r3.ffTicks) err('no fast-forward while on the bench');
  if (!r3.onPitchTicks) err('bench player never controlled after entering');
  if (![...r3.ctrlSeen].every((q) => q === bs)) err('controlled others (bench run) ' + [...r3.ctrlSeen]);
  console.log('bench ok: ff ticks', r3.ffTicks, 'controlled ticks', r3.onPitchTicks);
}
// 3) shootout with a tied shooter does not crash
{
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const full = FCK.makeFullSquad(a, 3), pk = FCK.pickSquad(full, '4-3-3');
  const m = new FCK.Match({ clubs: [a, b], seed: 9, settings: { halfMins: 1, knockout: true, homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [{ dev: 'kb1', team: 0 }], squads: [pk, FCK.pickSquad(FCK.makeFullSquad(b, 4), '4-4-2')], lock: { team: 0, sqi: pk.lineup[9].sqi, at: null, setp: ['penalty'] } });
  m.autoProceed = true;
  let n = 0; while (m.mode !== 'over' && n++ < 60 * 60 * 40) m.update(1 / 60);
  if (m.mode !== 'over') err('knockout match did not finish (' + m.mode + ')');
  console.log('knockout ok', m.teams[0].score + ':' + m.teams[1].score, m.result && m.result.pens ? 'pens ' + m.result.pens : '');
}
console.log(errs ? 'FAILED ' + errs : 'lock OK');
process.exit(errs ? 1 : 0);
