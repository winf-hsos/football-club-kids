// node test/pass_test.js [level] : share of passes that reach a team-mate (AI vs AI, and "human-like" with ctrlHuman error model)
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
if (process.env.PC) Object.assign(FCK.PC, JSON.parse(process.env.PC));
const SEEDS = +(process.env.SEEDS || 12);
const level = process.argv[2] || 'pro';
const asHuman = process.argv[3] === 'human';
if (asHuman) { const P = FCK.Match.prototype, orig = P.passError; P.passError = function (p, extra) { const press = this.pressure(p); const sig = 0.012 + (1 - p.a.pas / 100) * 0.07 + press * 0.022 + (p.sprint ? 0.012 : 0) + this.surf.err + (extra || 0); return this.rng.gauss() * sig * (FCK.PC.herr == null ? 0.6 : FCK.PC.herr); }; }
if (process.argv[4] === 'rand') { const P = FCK.Match.prototype, orig = P.passTo; P.passTo = function (p, t, type, pw) { if (type === 'pass' && this.restart == null) { const a = this.rng.range(-1.2, 1.2) + (p.team.dir > 0 ? 0 : Math.PI); const t2 = this.pickTarget(p, Math.cos(a), Math.sin(a), 'pass'); if (t2) t = t2; } return orig.call(this, p, t, type, pw); }; }
const tot = { pass: [0, 0], through: [0, 0], lob: [0, 0] };
for (let seed = 1; seed <= SEEDS; seed++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const sqA = FCK.pickSquad(FCK.makeFullSquad(a, 11 + seed), '4-3-3'), sqB = FCK.pickSquad(FCK.makeFullSquad(b, 5 + seed), '4-4-2');
  const m = new FCK.Match({ clubs: [a, b], seed, settings: { halfMins: 4, level, homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [sqA, sqB] });
  m.autoProceed = true;
  let pend = null;
  m.on((e) => { if (e.type === 'kick' && tot[e.kind]) pend = { kind: e.kind, team: e.by.ti, t: m.time }; });
  let steps = 0, lastOwner = null;
  while (m.mode !== 'over' && steps++ < 60 * 60 * 12) {
    m.update(1 / 60);
    const o = m.ball.owner;
    if (pend && o && o !== lastOwner) { tot[pend.kind][1]++; if (o.ti === pend.team) tot[pend.kind][0]++; pend = null; }
    if (pend && m.time - pend.t > 6) pend = null;
    lastOwner = o || lastOwner;
  }
}
for (const k in tot) console.log(k, tot[k][1], 'complete', (100 * tot[k][0] / Math.max(1, tot[k][1])).toFixed(1) + '%');
