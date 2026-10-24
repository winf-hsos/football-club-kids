// node test/pass_stat.js [matches] : pass completion statistics, AI vs AI (no humans)
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const dir = process.env.JSDIR || path.join(__dirname, '..', 'js');
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'sim', 'rules', 'ai'].forEach((f) => (0, eval)(fs.readFileSync(path.join(dir, f + '.js'), 'utf8')));
const FCK = globalThis.FCK;
const N = +process.argv[2] || 6;
const lvl = process.argv[3] || 'pro';
const tot = { n: 0, ok: 0, opp: 0, mate: 0, out: 0, near: 0, other: 0 };
const byType = {};
for (let s = 1; s <= N; s++) {
  const a = FCK.teamById('fcb'), b = FCK.teamById('mci');
  const m = new FCK.Match({ clubs: [a, b], seed: s, settings: { halfMins: 4, level: lvl, homeFormation: '4-3-3', awayFormation: '4-4-2' }, slots: [], squads: [FCK.pickSquad(FCK.makeFullSquad(a, 11 + s), '4-3-3'), FCK.pickSquad(FCK.makeFullSquad(b, 5 + s), '4-4-2')] });
  m.autoProceed = true;
  let cur = null;
  m.on((e) => {
    if (e.type === 'kick' && /^(pass|through|lob)$/.test(e.kind)) {
      if (cur) fin('other');
      const t = m.ball.passTarget;
      cur = { type: e.kind, by: e.by, target: t, minD: 1e9, d0: t ? Math.hypot(t.x - e.by.x, t.y - e.by.y) : 0 };
    }
  });
  function fin(res) {
    if (!cur) return;
    tot.n++; tot[res] = (tot[res] || 0) + 1;
    const k = cur.type; byType[k] = byType[k] || { n: 0, ok: 0, near: 0 };
    byType[k].n++; if (res === 'ok') byType[k].ok++;
    if (res !== 'ok' && cur.minD < 2.2) { tot.near++; byType[k].near++; }
    cur = null;
  }
  let steps = 0, lastOwner = null, lastTouch = null;
  while (m.mode !== 'over' && steps++ < 60 * 60 * 12) {
    m.update(1 / 60);
    const b = m.ball;
    if (cur) {
      if (cur.target) cur.minD = Math.min(cur.minD, Math.hypot(cur.target.x - b.x, cur.target.y - b.y));
      if (b.owner) { const o = b.owner; if (o === cur.target) fin('ok'); else if (o.ti === cur.by.ti) fin(o === cur.by ? 'other' : 'mate'); else fin('opp'); }
      else if (m.mode !== 'play') fin('out');
    }
  }
}
const pc = (x) => (100 * x / tot.n).toFixed(1) + '%';
console.log('passes', tot.n, 'ok', pc(tot.ok), 'to other mate', pc(tot.mate || 0), 'intercepted', pc(tot.opp || 0), 'out/stop', pc(tot.out || 0), 'other', pc(tot.other || 0), '| failed but target came within 2.2m:', tot.near, '(' + (100 * tot.near / Math.max(1, tot.n - tot.ok)).toFixed(0) + '% of failures)');
console.log(JSON.stringify(byType));
