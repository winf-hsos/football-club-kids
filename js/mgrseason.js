/* FCK - mgrseason.js : manager mode season end / start, job offers */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;
  const Mgr = FCK.Mgr;
  const ROLE = FCK.ROLE_OF;

  // what the user still has to decide before the season ends
  Mgr.review = function (c) {
    const m = c.m, y = c.sim.year;
    return {
      expiring: m.players.filter((p) => p.ct <= y && !p.ln),
      grads: m.youth.filter((p) => p.ag >= Mgr.YMAX),
    };
  };

  const EU_PRIZE = { cl: [0.05, 0.07, 0.09, 0.11, 0.14, 0.17, 0.22], el: [0.025, 0.035, 0.045, 0.055, 0.07, 0.085, 0.11], ecl: [0.012, 0.017, 0.022, 0.03, 0.037, 0.047, 0.06] };

  // called before the simulated world moves on
  Mgr.endOfSeason = function (c, sm) {
    const m = c.m, sim = c.sim, R = m.rev;
    Mgr.tick(c, 47);
    const pr = Mgr.progress(c);
    const g = W.groups[sim.gid[c.idx]], cup = sim.cups[g.cc];
    const prize = { lg: R * 0.06 * (sm.n - sm.pos) / Math.max(1, sm.n - 1), cup: 0, eu: 0, sp: 0 };
    if (pr.cupBest !== null && cup) prize.cup = R * 0.012 * (cup.R - pr.cupBest) + (pr.cupWon ? R * 0.08 : 0);
    if (pr.euBest >= 0 && sm.euro) { const t = EU_PRIZE[sm.euro]; prize.eu = R * t[Math.min(6, pr.euBest + (sim.euro[sm.euro].w === c.idx ? 1 : 0))]; }
    const wins = c.log.filter((e) => e.y === sim.year && e.res === 'W').length;
    if (m.sp) prize.sp = m.sp.bw * wins + (sm.pos === 1 ? m.sp.bt : 0);
    const tot = prize.lg + prize.cup + prize.eu + prize.sp;
    m.cash += tot; m.led.inc.prize += tot;
    const ev = Mgr.evalObjectives(c, sm);
    const bc0 = m.bc;
    ev.forEach((o) => {
      const d = o.k === 'lg' ? (o.ok ? 9 : -12) : o.k === 'cup' ? (o.ok ? 3 : -3) : o.k === 'eu' ? (o.ok ? 4 : -4) : o.k === 'fin' ? (o.ok ? 3 : -10) : (o.ok ? 2 : -1);
      m.bc = U.clamp(m.bc + d, 0, 100);
    });
    if (sm.pos === 1) m.bc = U.clamp(m.bc + 6, 0, 100);
    if (sm.zone === 'rel') m.bc = U.clamp(m.bc - 8, 0, 100);
    const inc = Object.values(m.led.inc).reduce((a, b) => a + b, 0), exp = Object.values(m.led.exp).reduce((a, b) => a + b, 0);
    const lgOk = (ev.find((o) => o.k === 'lg') || {}).ok;
    const rep = { y: sim.year, ev, prize, tot, inc, exp, bc0, bc1: m.bc, pos: sm.pos, n: sm.n, sacked: false, offers: [], cash: m.cash };
    if (!m.easy && (m.bc <= 12 || (!lgOk && m.bc < 30))) rep.sacked = true;
    if (m.sacked) rep.sacked = !m.easy;
    if (!rep.sacked && m.bc >= 72 && lgOk) rep.offers = Mgr.jobOffers(c);
    m.fh.push({ y: sim.year, inc: Math.round(inc), exp: Math.round(exp), net: Math.round(inc - exp), cash: Math.round(m.cash), rev: m.rev, led: JSON.parse(JSON.stringify(m.led)) });
    if (m.fh.length > 15) m.fh.shift();
    m.rep = rep;
    return rep;
  };

  Mgr.jobOffers = function (c) {
    const sim = c.sim;
    const rng = U.makeRng(W.hash(W.clubs[c.idx].id) ^ sim.year * 31 ^ 0x6a0b);
    const myR = sim.r[c.idx];
    const cand = [];
    for (let tries = 0; tries < 400 && cand.length < 3; tries++) {
      const i = rng.int(0, W.clubs.length - 1);
      if (i === c.idx || cand.includes(i)) continue;
      const g = W.groups[sim.gid[i]];
      if (g.tier > 2) continue;
      const d = sim.r[i] - myR;
      if (d >= 3 && d <= 20) cand.push(i);
    }
    return cand.slice(0, 3);
  };

  // after the world has moved on (sim.year is the new season)
  Mgr.beginSeason = function (c, sm) {
    const m = c.m, sim = c.sim;
    const rng = U.makeRng(W.hash(W.clubs[c.idx].id) ^ (sim.year * 6151) ^ sim.seed);
    const rep = m.rep || { retired: [], left: [], riser: [] };
    rep.retired = []; rep.left = []; rep.riser = []; rep.grads = [];
    // people age, develop, leave, retire
    const keep = [];
    m.players.forEach((p) => {
      p.ag++;
      const o0 = p.o;
      Mgr.developPlayer(c, p, rng);
      if (p.ln) { p.ln = 0; if (p.ag <= 22) p.o = Math.min(p.pt, p.o + 1); }
      p.ap = 0; p.tr = false;
      p.inj = Math.max(0, p.inj - 6);
      p.mo = U.clamp(p.mo * 0.4 + 62 * 0.6, 20, 90);
      if (p.ct < sim.year) { rep.left.push(p.n); m.gone[p.id] = p.n; return; }
      if (p.ag >= 37 || (p.ag >= 34 && p.o < 50 && rng.chance(0.6)) || (p.ag >= 35 && rng.chance(0.35))) { rep.retired.push(p.n); m.gone[p.id] = p.n; return; }
      p.d = p.o - o0;
      keep.push(p);
    });
    m.players = keep;
    rep.riser = keep.filter((p) => p.d >= 3).sort((a, b) => b.d - a.d).slice(0, 3).map((p) => ({ n: p.n, d: p.d }));
    const ys = Mgr.youthRollover(c, rng);
    rep.grads = ys.auto; rep.gradOut = ys.out;
    // economy
    const was = sm;
    let f = 1 + 0.05 * (0.5 - (sm.pos - 1) / Math.max(1, sm.n - 1));
    if (sm.moved === 'up') f *= 1.35; else if (sm.moved === 'down') f /= 1.3;
    if (sm.pos === 1) f *= 1.03;
    m.rev = Math.round(m.rev * f / 10) * 10;
    m.led = Mgr.newLedger();
    // reset season state
    Object.keys(m.ai).forEach((k) => delete m.ai[k]);
    m.bought = {}; m.sc.found = []; m.sc.watch = []; m.sc.seen = {}; m.sc.ms = []; m.offers = [];
    m.xi = null; m.press = null; m.sacked = false; m.warn = 0; m.warnFlag = false;
    m.wk = sim.year * Mgr.WEEKS - 1;
    m.bc = Math.max(m.bc, 35);
    m.seasons++;
    Mgr.setBudgets(c, false);
    if (m.cash < 0 && !m.easy) m.tb = 0;
    Mgr.sync(c);
    Mgr.genFA(c, true);
    Mgr.newObjectives(c);
    Mgr.genSponsors(c);
    m.rep = rep;
    return rep;
  };

  // new job: another club
  Mgr.switchClub = function (c, idx) {
    const sim = c.sim;
    c.idx = idx; c.clubId = W.clubs[idx].id; sim.userIdx = idx;
    c.log = []; c.lastResult = null;
    const old = c.m;
    c.m = null;
    Mgr.init(c, { easy: old ? old.easy : false });
    c.m.bc = 60;
  };
})((globalThis.FCK = globalThis.FCK || {}));
