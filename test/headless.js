// Headless simulation test: CPU vs CPU matches, checks flow and prints stats
const fs = require('fs');
const path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'crest', 'sim', 'rules', 'ai'].forEach((f) => {
  const code = fs.readFileSync(path.join(dir, f + '.js'), 'utf8');
  (0, eval)(code);
});
const FCK = globalThis.FCK;

function runMatch(seed, opts) {
  opts = opts || {};
  const a = FCK.teamById(opts.a || 'fcb'), b = FCK.teamById(opts.b || 'mci');
  const m = new FCK.Match({ clubs: [a, b], seed, settings: Object.assign({ halfMins: 4 }, opts.settings || {}), slots: opts.slots || [] });
  m.autoProceed = true;
  const dt = 1 / 60;
  let steps = 0;
  const log = [];
  m.on((e) => { if (opts.verbose && ['goal', 'foul', 'card', 'offside', 'penalty', 'period', 'sub', 'injury'].includes(e.type)) log.push(e.type + '@' + (e.t / 60).toFixed(1)); });
  const modes = {};
  while (m.mode !== 'over' && steps < 60 * 60 * 40) {
    m.update(dt); steps++;
    modes[m.mode] = (modes[m.mode] || 0) + 1;
  }
  return { m, steps, log, modes };
}

const n = parseInt(process.argv[2] || '5', 10);
let agg = { goals: 0, shots: 0, sot: 0, fouls: 0, yellow: 0, red: 0, corners: 0, offs: 0, passes: 0, passOk: 0, secs: 0, saves: 0, tackles: 0, poss0: 0, stuck: 0 };
for (let i = 0; i < n; i++) {
  const t0 = Date.now();
  const r = runMatch(1000 + i, { verbose: false, settings: i % 2 ? { weather: 'rain' } : {} });
  const m = r.m;
  const s0 = m.teams[0].stats, s1 = m.teams[1].stats;
  agg.goals += m.teams[0].score + m.teams[1].score;
  agg.shots += s0.shots + s1.shots; agg.sot += s0.sot + s1.sot;
  agg.fouls += s0.fouls + s1.fouls; agg.yellow += s0.yellow + s1.yellow; agg.red += s0.red + s1.red;
  agg.corners += s0.corners + s1.corners; agg.offs += s0.offsides + s1.offsides;
  agg.passes += s0.passes + s1.passes; agg.passOk += s0.passOk + s1.passOk;
  agg.saves += s0.saves + s1.saves; agg.tackles += s0.tackles + s1.tackles;
  agg.secs += r.steps / 60; agg.poss0 += m.result ? m.result.poss[0] : 0;
  if (m.mode !== 'over') agg.stuck++;
  console.log(`match ${i}: ${m.teams[0].short} ${m.teams[0].score}-${m.teams[1].score} ${m.teams[1].short}  steps=${r.steps} (${(r.steps / 3600).toFixed(1)} min real) mode=${m.mode} shots ${s0.shots}/${s1.shots} fouls ${s0.fouls}/${s1.fouls} corners ${s0.corners}/${s1.corners} offs ${s0.offsides}/${s1.offsides} ${Date.now() - t0}ms`);
}
for (const k in agg) agg[k] = Math.round((agg[k] / n) * 10) / 10;
console.log('AVERAGES per match:', JSON.stringify(agg));
