/* FCK - youth.js : youth academy U6..U19 */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;
  const Mgr = FCK.Mgr;
  const ROLE = FCK.ROLE_OF;
  Mgr.YMIN = 6; Mgr.YMAX = 19;

  Mgr.youthCost = (c) => Math.round(c.m.rev * 0.012 * c.m.fac.acad);
  Mgr.youthCap = (c) => 9 + 2 * c.m.fac.acad;
  const POS = ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST'];

  Mgr.youthBase = function (c) {
    const m = c.m;
    const S = m.S || W.clubs[c.idx].rating;
    return S - 5;
  };
  Mgr.newYouth = function (c, rng, ag) {
    const m = c.m, club = W.clubs[c.idx];
    const base = Mgr.youthBase(c);
    const pt = Math.round(U.clamp(base + rng.gauss() * 7 + (m.fac.acad - 3) * 1.6, 30, 96));
    const pos = rng.pick(POS);
    const nat = FCK.pickNameGroup(club, rng, 0.8, 0.3);
    const dn = FCK.drawName(nat, rng);
    const n = (dn.first ? dn.first + ' ' : '') + dn.last;
    const o = Math.round(U.clamp(curve(ag) * pt * (0.9 + 0.2 * rng.next()), 8, 95));
    return { id: m.nid++, n, nt: nat, pos, o, pt, ag, sd: rng.int(1, 4e9), mo: 70, inj: 0, ap: 0, nu: 0, y: 1 };
  };
  const curve = (a) => Mgr.curve(a);
  Mgr.genYouth = function (c, rng, first) {
    const m = c.m;
    if (first) {
      m.youth = [];
      for (let ag = Mgr.YMIN; ag <= Mgr.YMAX; ag++) {
        const n = Math.max(5, Math.round((6 + m.fac.acad + rng.int(0, 2)) * (1 - 0.025 * (ag - 6))));
        for (let i = 0; i < n; i++) m.youth.push(Mgr.newYouth(c, rng, ag));
      }
    } else {
      const n = 5 + m.fac.acad + rng.int(0, 2);
      for (let i = 0; i < n; i++) m.youth.push(Mgr.newYouth(c, rng, Mgr.YMIN));
    }
  };
  Mgr.youthGroup = (c, ag) => c.m.youth.filter((y) => y.ag === ag).sort((a, b) => b.o - a.o || b.pt - a.pt);
  // approximate potential the staff reports (uncertain for the young)
  Mgr.potShown = function (c, y) {
    const unc = Math.max(0, (20 - y.ag) * 0.9 - (c.m.fac.acad - 1) * 0.9);
    const j = Math.round(((W.hash('yp' + y.id) % 1000) / 1000 - 0.5) * 2 * unc);
    return { v: y.pt + j, unc: Math.round(unc) };
  };
  // table of the age groups (decorative: where does the age group stand in its youth league)
  Mgr.youthLeague = function (c, ag) {
    const g = Mgr.youthGroup(c, ag).slice(0, 11);
    if (g.length < 5) return null;
    const avg = g.reduce((s, y) => s + y.o, 0) / g.length;
    const E = curve(ag) * Mgr.youthBase(c) * 0.99;
    const z = (avg - E) / Math.max(3, E * 0.1);
    const p = Math.round(U.clamp(7 - z * 3.2 + ((W.hash('yl' + c.sim.year + ag) % 5) - 2) * 0.4, 1, 12));
    return p;
  };
  Mgr.canPromote = (c, y) => y.ag >= 16 && Mgr.squad(c).length < Mgr.MAXSQ;
  Mgr.promote = function (c, y) {
    const m = c.m, sim = c.sim;
    if (y.ag < 16) return 'young';
    if (Mgr.squad(c).length >= Mgr.MAXSQ) return 'full';
    const w = Math.max(5, Math.round(Mgr.wageOf(y.o, y.ag) * 0.7 / 5) * 5);
    if (Mgr.bill(c) + w > m.wb * 1.05) return 'wb';
    m.youth = m.youth.filter((x) => x !== y);
    const rec = Mgr.addRec(c, { n: y.n, nt: y.nt, pos: y.pos, o: y.o, pt: y.pt, ag: y.ag, w, ct: sim.year + 2, sd: y.sd, mo: 80, home: 1 });
    rec.nu = Mgr.newNumber(c, rec.pos);
    m.prom++;
    Mgr.news(c, 'promote', { p: y.n });
    Mgr.sync(c);
    return 'ok';
  };
  Mgr.releaseYouth = function (c, y) { c.m.gone[y.id] = y.n; c.m.youth = c.m.youth.filter((x) => x !== y); };
  // season rollover of the academy; graduates (ag 19) not promoted by the user are decided automatically
  Mgr.youthRollover = function (c, rng) {
    const m = c.m;
    const df = (0.9 + 0.06 * m.fac.acad) * (1 + (m.fac.coach - 3) * 0.04);
    const report = { out: [], auto: [] };
    // graduates
    m.youth.filter((y) => y.ag >= Mgr.YMAX).forEach((y) => {
      const sorted = Mgr.sorted(c); const med = sorted.length ? sorted[Math.min(sorted.length - 1, 12)].o : 0;
      if (y.ag >= 16 && (y.pt >= med + 4 || y.o >= med - 6) && Mgr.squad(c).length < Mgr.MAXSQ - 1) { if (Mgr.promote(c, y) === 'ok') { report.auto.push(y.n); return; } }
      report.out.push(y.n); Mgr.releaseYouth(c, y);
    });
    m.youth.forEach((y) => {
      y.ag++;
      const tgt = curve(y.ag) * y.pt;
      y.o = Math.round(U.clamp(y.o + (tgt - y.o) * Math.min(0.85, 0.62 * df) + rng.gauss() * 1.6, 8, 96));
      if (y.ag <= 18) y.pt = Math.round(U.clamp(y.pt + rng.gauss() * 1.8, y.o, 97));
      y.ap = 0;
    });
    // attrition: weakest above the cap leave, a few random departures
    for (let ag = Mgr.YMIN; ag <= Mgr.YMAX; ag++) {
      const g = Mgr.youthGroup(c, ag);
      g.forEach((y) => { if (g.length > 7 && rng.chance(0.06)) Mgr.releaseYouth(c, y); });
      const g2 = Mgr.youthGroup(c, ag);
      const cap = Mgr.youthCap(c);
      g2.slice(cap).forEach((y) => Mgr.releaseYouth(c, y));
    }
    Mgr.genYouth(c, rng, false);
    return report;
  };
})((globalThis.FCK = globalThis.FCK || {}));
