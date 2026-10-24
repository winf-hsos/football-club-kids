/* FCK - manager.js : manager mode core (own squad with contracts, strength, development, injuries, finances, board, press, season rollover) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;
  const Mgr = {};
  FCK.Mgr = Mgr;
  const WEEKS = 48;
  const ROLE = () => FCK.ROLE_OF;
  Mgr.WEEKS = WEEKS;
  Mgr.MAXSQ = 32; Mgr.MINSQ = 16;

  // ---------- money / values ----------
  Mgr.money = function (k, opt) {
    const en = FCK.settings && FCK.settings.lang === 'en';
    const neg = k < 0, a = Math.abs(k);
    let s;
    if (a >= 1000) {
      const mio = a / 1000;
      const t = mio >= 100 ? mio.toFixed(0) : mio >= 10 ? mio.toFixed(1) : mio.toFixed(2);
      const t2 = t.replace(/\.?0+$/, (mm) => (mm.includes('.') ? '' : mm)); // keep integer zeros
      s = en ? '€' + t2 + 'M' : t2.replace('.', ',') + ' Mio. €';
    } else s = en ? '€' + Math.round(a) + 'K' : Math.round(a) + ' Tsd. €';
    return (neg ? '−' : (opt && opt.plus && k > 0 ? '+' : '')) + s;
  };
  Mgr.valueOf = function (o, ag, pt) {
    const v = 25 * Math.exp((o - 40) * 0.16);
    const young = Math.max(0, Math.min(1, (25 - ag) / 6));
    const prem = 1 + Math.max(0, (pt || o) - o) * 0.035 * young;
    const agef = ag <= 28 ? 1 : ag <= 31 ? 0.78 : ag <= 33 ? 0.5 : ag <= 35 ? 0.3 : 0.15;
    return Math.max(10, Math.round((v * prem * agef) / 10) * 10);
  };
  Mgr.wageOf = (o, ag) => Math.max(5, Math.round((15 * Math.exp((o - 40) * 0.115) * (ag >= 33 ? 0.85 : 1)) / 5) * 5);
  Mgr.potOf = function (o, ag, h01) {
    if (ag >= 29) return o;
    const room = Math.max(0, 27 - ag);
    return U.clamp(Math.round(o + room * (0.25 + 1.5 * h01) * (ag <= 21 ? 1 : 0.6)), o, 97);
  };
  const curve = (a) => Math.min(1, 0.28 + (a - 6) * 0.0475);
  Mgr.curve = curve;
  const hash01 = (s) => (W.hash(s) % 10007) / 10007;

  // ---------- state access ----------
  Mgr.club = (c) => W.clubs[c.idx];
  Mgr.R = (c) => c.m.rev;
  Mgr.squad = (c) => c.m.players.filter((p) => !p.ln);
  Mgr.sorted = (c) => Mgr.squad(c).slice().sort((a, b) => b.o - a.o);
  Mgr.bill = (c) => c.m.players.reduce((s, p) => s + (p.ln ? 0 : p.w), 0);
  Mgr.byId = (c, id) => c.m.players.find((p) => p.id === id) || null;
  Mgr.fitCount = (c) => Mgr.squad(c).filter((p) => !p.inj).length;
  Mgr.window = function (c) {
    const sim = c.sim; if (sim.done) return null;
    const w = sim.pos.w;
    return w <= 7 ? 'summer' : w >= 22 && w <= 26 ? 'winter' : null;
  };
  Mgr.stats = (c, p) => ({ g: (c.sim.sc[c.idx] || {})[p.id] || 0, ap: p.ap || 0 });
  const addNews = (c, k, v) => { if (FCK.Career && FCK.Career.cur === c) FCK.Career.news({ k: 'mn.' + k, v: v || {} }); };
  Mgr.news = addNews;

  // ---------- creation ----------
  const FAC = ['train', 'acad', 'med', 'scout', 'stad', 'coach'];
  Mgr.FAC = FAC;
  Mgr.init = function (c, opt) {
    opt = opt || {};
    const club = W.clubs[c.idx], sim = c.sim;
    const rng = U.makeRng(W.hash(club.id) ^ sim.seed ^ 0x51ed);
    const m = {
      v: 1, easy: !!(opt.easy !== undefined ? opt.easy : (FCK.settings && FCK.settings.profile === 'kids')), nid: 1, players: [], youth: [], xi: null, lastXI: [],
      fac: {}, tr: 'normal', cash: 0, tb: 0, rev: 0, led: null, fh: [], mood: 60, bc: 65, fan: 62, obj: [], rep: null, sp: null, spOffers: [], press: null, pressDone: 0,
      ai: {}, gone: {}, offers: [], tl: [], sc: { ms: [], seen: {}, found: [], watch: [] }, fa: [], wk: sim.year * WEEKS + (sim.pos ? sim.pos.w : 0) - 1, prom: 0, warn: 0, nameOf: {}, seasons: 0,
    };
    c.m = m;
    // facilities by club strength
    const lv0 = U.clamp(Math.round((club.rating - 44) / 10), 1, 5);
    FAC.forEach((k) => { m.fac[k] = U.clamp(lv0 + (W.hash(club.id + k) % 3) - 1, 1, 5); });
    // squad from the generated / imported world squad
    const base = W.squad(club, (sim.seed + Math.imul(sim.year, 7919)) >>> 0);
    const nums = new Set();
    base.forEach((gp, i) => {
      const h = hash01(club.id + ':' + i);
      const ag = gp.age || 26;
      const rec = { id: m.nid++, n: gp.name, nt: gp.nat, pos: gp.pos0 || gp.pos, o: Math.round(gp.ovr), ag, sd: W.hash(club.id + ':p' + i), mo: 60, inj: 0, ap: 0, nu: gp.num };
      rec.pt = Mgr.potOf(rec.o, ag, h);
      rec.w = Math.round(Mgr.wageOf(rec.o, ag) * (0.85 + 0.3 * hash01(club.id + 'w' + i)) / 5) * 5;
      rec.ct = sim.year + rng.int(0, ag >= 32 ? 1 : 3);
      nums.add(rec.nu);
      m.players.push(rec);
    });
    // economy
    const top = m.players.slice().sort((a, b) => b.o - a.o).slice(0, 22);
    m.rev = Math.round(top.reduce((s, p) => s + Mgr.wageOf(p.o, 26), 0) / 0.6 / 10) * 10;
    m.cash = Math.round(m.rev * 0.3);
    m.led = Mgr.newLedger();
    Mgr.genYouth(c, rng, true);
    Mgr.attach(c);
    Mgr.setBudgets(c, true);
    Mgr.genFA(c, true);
    Mgr.newObjectives(c);
    Mgr.genSponsors(c);
    Mgr.sync(c);
    return m;
  };
  Mgr.ensure = function (c) { if (!c.m) Mgr.init(c, { easy: FCK.settings && FCK.settings.profile === 'kids' }); else Mgr.attach(c); return c.m; };
  Mgr.setBudgets = function (c, first) {
    const m = c.m;
    const f = m.easy ? 0.7 : 0.25;
    m.tb = Math.round((first ? 0 : Math.max(0, m.tb) * 0.5) / 10) * 10 + Math.round(m.rev * f / 10) * 10;
    if (!first) m.tb += Math.round(0.2 * Math.max(0, m.cash - m.rev * 0.3) / 10) * 10;
    m.wb = Math.round(m.rev * (m.easy ? 1.0 : 0.72) / 10) * 10;
    m.wb = Math.max(m.wb, Math.round(Mgr.bill(c) * 1.02 / 10) * 10);
  };
  Mgr.newLedger = () => ({ inc: { gate: 0, tv: 0, sp: 0, prize: 0, sale: 0, other: 0 }, exp: { wage: 0, staff: 0, buy: 0, youth: 0, other: 0 } });

  // ---------- hooks into the simulation ----------
  Mgr.attach = function (c) {
    const sim = c.sim, m = c.m;
    sim.userSquad = () => Mgr.simSquad(c);
    sim.nameHook = (id) => {
      const p = Mgr.byId(c, id) || m.youth.find((y) => y.id === id);
      const n = p ? p.n : m.gone[id];
      return n ? { name: n, sname: shortName(n) } : null;
    };
    sim.scorerHook = (k, rng) => {
      const role = ROLE()[FCK.FULL_POS[k]];
      const xi = (m.lastXI || []).map((id) => Mgr.byId(c, id)).filter(Boolean);
      let pool = xi.filter((p) => ROLE()[p.pos] === role);
      if (!pool.length) pool = xi.length ? xi : Mgr.squad(c);
      if (!pool.length) return -1;
      const wts = pool.map((p) => Math.pow(Math.max(1, p.o - 25), 2));
      let r = rng.next() * wts.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) { r -= wts[i]; if (r <= 0) return pool[i].id; }
      return pool[0].id;
    };
    sim.aiOv = m.ai;
  };
  const shortName = (n) => { const p = n.trim().split(/\s+/); return p.length > 1 ? p[0][0] + '. ' + p.slice(1).join(' ') : n; };
  Mgr.shortName = shortName;

  // ---------- game players ----------
  Mgr.coachBonus = (c) => (c.m.fac.coach - 3) * 0.35;
  Mgr.toPlayer = function (c, rec, adj) {
    const club = W.clubs[c.idx];
    const p = FCK.makePlayer(club, rec.pos, rec.o + (adj || 0), rec.nu || (rec.id % 90) + 1, U.makeRng(rec.sd >>> 0), { name: rec.n, nat: FCK.NAMES[rec.nt] ? rec.nt : 'en' });
    p.sqi = rec.id; p.age = rec.ag; p.pos0 = rec.pos; p.rid = rec.id; p.cid = c.idx;
    return p;
  };
  Mgr.effAdj = (c, rec) => {
    const mo = rec.mo === undefined ? 60 : rec.mo;
    return U.clamp((mo - 60) / 22, -2.2, 1.6) + Mgr.coachBonus(c);
  };
  Mgr.simSquad = (c) => Mgr.squad(c).map((r) => Mgr.toPlayer(c, r, 0));
  Mgr.availList = function (c, withAdj) {
    const m = c.m;
    const club = W.clubs[c.idx];
    const list = m.players.filter((r) => !r.ln && !r.inj).map((r) => Mgr.toPlayer(c, r, withAdj ? Mgr.effAdj(c, r) : 0));
    if (!list.some((p) => p.role === 'GK')) { const g = FCK.makePlayer(club, 'GK', 44, 1, U.makeRng(77), null); g.sqi = -1; g.emg = true; list.push(g); }
    let k = 0;
    const ys = m.youth.filter((y) => y.ag >= 15).sort((a, b) => b.o - a.o);
    while (list.length < 13 && k < ys.length) { const y = ys[k++]; const p = Mgr.toPlayer(c, y, 0); p.sqi = y.id; p.yth = true; list.push(p); }
    while (list.length < 13) { const g = FCK.makePlayer(club, list.length % 2 ? 'CM' : 'CB', 38, 30 + list.length, U.makeRng(900 + list.length), null); g.sqi = -2 - list.length; g.emg = true; list.push(g); }
    return list;
  };
  Mgr.pickManual = function (list, formationName, ids) {
    const form = FCK.FORMATIONS[formationName];
    const byId = new Map(list.map((p) => [p.sqi, p]));
    const lineup = []; const used = new Set();
    for (let i = 0; i < 11; i++) { const p = byId.get(ids[i]); if (!p || used.has(p)) return null; used.add(p); lineup.push(FCK.clonePlayer(p, form[i].pos, i + 1, 0)); }
    if (lineup[0].role !== 'GK') return null;
    const rest = list.filter((p) => !used.has(p)).sort((a, b) => b.ovr - a.ovr);
    const bench = []; const gk = rest.find((p) => p.role === 'GK'); if (gk) bench.push(gk);
    rest.forEach((p) => { if (bench.length < 7 && !bench.includes(p)) bench.push(p); });
    return { lineup, bench: bench.map((p, k) => FCK.clonePlayer(p, p.pos0 || p.pos, 12 + k, 0)) };
  };
  Mgr.pick = function (c, formation) {
    const list = Mgr.availList(c, true);
    const m = c.m;
    let pk = null;
    if (m.xi && m.xi.f === formation) pk = Mgr.pickManual(list, formation, m.xi.ids);
    if (!pk) pk = FCK.pickSquad(list, formation, null, 0);
    return pk;
  };
  // squad for a match of the user; remembers who started
  Mgr.matchSquad = function (c, formation) {
    const pk = Mgr.pick(c, formation);
    c.m.lastXI = pk.lineup.map((p) => p.sqi).filter((id) => id > 0);
    pk.lineup.concat(pk.bench).forEach((p) => { p.cid = c.idx; });
    return pk;
  };
  Mgr.strength = function (c, formation) {
    const pk = FCK.pickSquad(Mgr.availList(c, true), formation || c.formation, null, 0);
    const avg = (a) => a.reduce((s, p) => s + p.ovr, 0) / Math.max(1, a.length);
    const xi = avg(pk.lineup), bn = avg(pk.bench);
    return xi + 0.15 * (bn - (xi - 7));
  };
  Mgr.sync = function (c) {
    const S = Mgr.strength(c);
    const r = U.clamp(26 + (S - 46) / 0.65, 8, 96);
    c.sim.r[c.idx] = r;
    c.m.S = Math.round(S * 10) / 10;
    return r;
  };

  // ---------- numbers helper ----------
  Mgr.newNumber = function (c, pos) {
    const used = new Set(c.m.players.map((p) => p.nu));
    const pref = pos === 'GK' ? [1, 12, 13, 25] : ROLE()[pos] === 'DF' ? [2, 3, 4, 5, 15, 23, 24] : ROLE()[pos] === 'MF' ? [6, 8, 10, 14, 16, 17, 18, 20] : [7, 9, 11, 19, 21, 22];
    for (const n of pref) if (!used.has(n)) return n;
    for (let n = 26; n < 100; n++) if (!used.has(n)) return n;
    return 99;
  };
  Mgr.addRec = function (c, d) {
    const m = c.m;
    const rec = Object.assign({ id: m.nid++, mo: 62, inj: 0, ap: 0 }, d);
    if (!rec.nu) rec.nu = Mgr.newNumber(c, rec.pos);
    if (!rec.sd) rec.sd = W.hash(rec.n + rec.id + c.sim.year);
    m.players.push(rec);
    return rec;
  };
  Mgr.removeRec = function (c, rec) {
    const m = c.m;
    m.gone[rec.id] = rec.n;
    const k = m.players.indexOf(rec); if (k >= 0) m.players.splice(k, 1);
    if (m.xi && m.xi.ids.includes(rec.id)) m.xi = null;
    m.offers = m.offers.filter((o) => o.pid !== rec.id);
  };

  // ---------- finances ----------
  Mgr.staffCost = (c) => Math.round(c.m.rev * 0.004 * FAC.reduce((s, k) => s + c.m.fac[k], 0));
  Mgr.gate = function (c, f, info) {
    if (f.h !== c.idx || f.neutral) return;
    const m = c.m;
    const k = f.t === 'L' ? 1 : f.t === 'C' ? 1.15 : 1.6;
    const g = (m.rev * 0.20 / 20) * k * (1 + 0.12 * (m.fac.stad - 1)) * (0.88 + 0.24 * m.fan / 100);
    m.cash += g; m.led.inc.gate += g;
  };
  Mgr.weekStep = function (c, w) {
    const m = c.m, sim = c.sim;
    const spw = (m.sp ? m.sp.fix : m.rev * 0.10) / WEEKS;
    const tvw = m.rev * 0.38 / WEEKS;
    const wage = Mgr.bill(c) / WEEKS, staff = Mgr.staffCost(c) / WEEKS;
    const yc = Mgr.youthCost(c) / WEEKS;
    m.cash += spw + tvw - wage - staff - yc;
    m.led.inc.sp += spw; m.led.inc.tv += tvw; m.led.exp.wage += wage; m.led.exp.staff += staff; m.led.exp.youth += yc;
    const med = m.fac.med;
    m.players.forEach((p) => {
      if (p.inj > 0) { p.inj = Math.max(0, p.inj - (med >= 4 ? 1.35 : 1)); if (p.inj < 0.5) p.inj = 0; p.inj = Math.ceil(p.inj - 1e-9); }
      p.mo = U.clamp(p.mo + (60 + (m.mood - 60) * 0.3 - p.mo) * 0.07, 5, 100);
    });
    m.mood = U.clamp(m.mood + (60 - m.mood) * 0.05, 5, 100);
    if (!m.easy && m.cash < 0) m.bc = U.clamp(m.bc - 0.12, 0, 100);
    m.fan = U.clamp(m.fan + (60 - m.fan) * 0.03, 5, 100);
    if (Mgr.marketWeek) Mgr.marketWeek(c, w);
  };
  Mgr.tick = function (c, w) {
    const m = c.m, sim = c.sim;
    const aw = sim.year * WEEKS + Math.min(w, WEEKS - 1);
    let guard = 0;
    while (m.wk < aw && guard++ < 60) { m.wk++; Mgr.weekStep(c, m.wk - sim.year * WEEKS); }
  };

  // ---------- results of the user's matches ----------
  Mgr.preMatch = function (c) { Mgr.sync(c); Mgr.matchSquad(c, c.formation); };
  Mgr.afterMatch = function (c, e, eng) {
    const m = c.m, rng = c.sim.rng;
    const win = e.res === 'W', loss = e.res === 'L';
    const xi = new Set(m.lastXI || []);
    const sorted = Mgr.sorted(c);
    m.players.forEach((p) => {
      if (p.ln) return;
      if (xi.has(p.id)) { p.ap = (p.ap || 0) + 1; p.mo = U.clamp(p.mo + (win ? 3 : loss ? -2.5 : 0), 5, 100); } else {
        const rank = sorted.indexOf(p);
        p.mo = U.clamp(p.mo + (rank >= 0 && rank < 13 ? -1.2 : rank < 18 ? -0.4 : 0), 5, 100);
      }
    });
    m.mood = U.clamp(m.mood + (win ? 3 : loss ? -3 : 0), 5, 100);
    m.fan = U.clamp(m.fan + (win ? 2.5 : loss ? -3 : -0.2), 5, 100);
    m.bc = U.clamp(m.bc + (win ? 0.9 : loss ? -1.2 : 0.1), 0, 100);
    // injuries
    const intens = { low: 0.75, normal: 1, high: 1.4 }[m.tr] || 1;
    const hurt = [];
    if (eng) eng.forEach((id) => { const p = Mgr.byId(c, id); if (p) hurt.push(p); });
    else if (!(FCK.settings && FCK.settings.profile === 'kids')) {
      (m.lastXI || []).forEach((id) => { const p = Mgr.byId(c, id); if (p && !p.inj && rng.chance(0.032 * intens * (1.25 - 0.1 * m.fac.med))) hurt.push(p); });
    }
    hurt.forEach((p) => {
      if (p.inj) return;
      p.inj = Math.min(26, 1 + Math.floor(Math.exp(rng.gauss() * 0.85 + 1.1)));
      if (m.fac.med >= 4) p.inj = Math.max(1, p.inj - 1);
      addNews(c, 'injury', { p: p.n, w: p.inj });
    });
    // board / sack check
    if (!m.easy && c.sim.pos.w >= 10) {
      if (m.bc < 25 && c.sim.pos.w - m.warn >= 10) { m.warn = c.sim.pos.w; addNews(c, 'warn', {}); m.warnFlag = true; }
      if (m.bc < 6) m.sacked = true;
    }
    if (m.press !== undefined) m.press = { ph: 'post', res: e.res, comp: e.t, w: e.w };
    Mgr.sync(c);
  };

  // ---------- objectives ----------
  Mgr.newObjectives = function (c) {
    const m = c.m, sim = c.sim;
    const g = W.groups[sim.gid[c.idx]];
    const lg = sim.leagues[g.gid];
    const ids = lg.clubs.slice().sort((a, b) => sim.r[b] - sim.r[a]);
    const e = ids.indexOf(c.idx) + 1, n = ids.length;
    const co = W.byCc[g.cc];
    const lgDef = co.leagues.find((l) => l.tier === g.tier);
    const safe = n - (lgDef.relegate || 0);
    const obj = [];
    const upLg = co.leagues.find((l) => l.tier === g.tier - 1);
    const promoN = upLg ? Math.max(1, Math.floor(upLg.relegate * upLg.gids.length / lgDef.gids.length)) : 0;
    let P, kind;
    const gap = ids[1] !== undefined ? sim.r[c.idx] - sim.r[ids[1]] : 0;
    if (e === 1 && gap > 5) { P = 1; kind = 'title'; }
    else if (promoN && e <= promoN + 1) { P = promoN; kind = 'promo'; }
    else if (e <= 3) { P = e + 1; kind = 'top'; }
    else if (e <= Math.ceil(n * 0.6)) { P = Math.min(safe - 1, e + 2); kind = 'mid'; }
    else { P = safe; kind = 'safe'; }
    P = U.clamp(P, 1, Math.max(1, safe));
    obj.push({ k: 'lg', kind, p: P, w: 12 });
    const cup = sim.cups[g.cc];
    if (cup) {
      const ent = cup.e.slice().sort((a, b) => sim.r[b] - sim.r[a]);
      const rank = Math.max(1, ent.indexOf(c.idx) + 1);
      const ex = Math.ceil(Math.log2(2 * rank)) - 1;
      obj.push({ k: 'cup', t: U.clamp(ex + 1, 0, cup.R - 1), w: 4 });
    }
    const eu = sim.euroOf.get(c.idx);
    if (eu) {
      const tm = sim.euro[eu].teams.slice().sort((a, b) => sim.r[b] - sim.r[a]); const rk = tm.indexOf(c.idx) + 1;
      obj.push({ k: 'eu', comp: eu, t: rk <= 4 ? 3 : rk <= 12 ? 2 : 1, w: 5 });
    }
    obj.push({ k: 'fin', w: 5 });
    if (m.fac.acad >= 2) obj.push({ k: 'youth', n: 1, w: 3 });
    m.obj = obj; m.prom = 0; m.cash0 = m.cash;
  };
  const EU_ST = ['lp', 'po', 'r16', 'qf', 'sf', 'f'];
  Mgr.progress = function (c) {
    const sim = c.sim, m = c.m, y = sim.year;
    const log = c.log.filter((e) => e.y === y);
    const res = {};
    const cupL = log.filter((e) => e.t === 'C');
    const g = W.groups[sim.gid[c.idx]], cup = sim.cups[g.cc];
    res.cupBest = cupL.length ? cup.R - 1 - Math.max.apply(null, cupL.map((e) => e.info.round)) : null; // rounds from the final
    res.cupWon = !!(cup && cup.w === c.idx);
    const eL = log.filter((e) => e.t === 'E');
    res.euBest = eL.length ? Math.max.apply(null, eL.map((e) => (e.info.st ? EU_ST.indexOf(e.info.st) : 0))) : -1;
    return res;
  };
  Mgr.evalObjectives = function (c, sm) {
    const m = c.m, pr = Mgr.progress(c);
    return m.obj.map((o) => {
      let ok = false, got = null;
      if (o.k === 'lg') { ok = sm.pos <= o.p; got = sm.pos; } else if (o.k === 'cup') { ok = pr.cupWon || (pr.cupBest !== null && pr.cupBest <= o.t); got = pr.cupWon ? 0 : pr.cupBest; } else if (o.k === 'eu') { ok = pr.euBest >= o.t || (c.sim.euro[o.comp].w === c.idx); got = pr.euBest; } else if (o.k === 'fin') { ok = m.cash >= 0; got = Math.round(m.cash); } else if (o.k === 'youth') { ok = m.prom >= o.n; got = m.prom; }
      return Object.assign({}, o, { ok, got });
    });
  };

  // ---------- sponsors ----------
  const BR1 = ['Nova', 'Kiko', 'Bergmann', 'Delta', 'Orbit', 'Sunrise', 'Pixel', 'Tornado', 'Blitz', 'Aqua', 'Volt', 'Zenith', 'Mango', 'Rocket', 'Panda'];
  const BR2 = ['Bank', 'Mobil', 'Energie', 'Getränke', 'Bau', 'Versicherung', 'Toys', 'Telekom', 'Sports', 'Foods', 'Reisen', 'Games'];
  Mgr.genSponsors = function (c) {
    const m = c.m, rng = U.makeRng(W.hash(W.clubs[c.idx].id) ^ c.sim.year ^ 0xaa17);
    const R = m.rev;
    const nm = () => rng.pick(BR1) + ' ' + rng.pick(BR2);
    m.spOffers = [
      { name: nm(), fix: Math.round(R * 0.17 / 10) * 10, bw: Math.round(R * 0.0015 / 5) * 5, bt: 0 },
      { name: nm(), fix: Math.round(R * 0.09 / 10) * 10, bw: Math.round(R * 0.0045 / 5) * 5, bt: Math.round(R * 0.02 / 10) * 10 },
      { name: nm(), fix: Math.round(R * 0.06 / 10) * 10, bw: Math.round(R * 0.008 / 5) * 5, bt: Math.round(R * 0.04 / 10) * 10 },
    ];
    m.sp = null;
  };
  Mgr.pickSponsor = function (c, i) { c.m.sp = Object.assign({}, c.m.spOffers[i]); };

  // ---------- facilities ----------
  Mgr.upCost = (c, k) => { const l = c.m.fac[k]; return l >= 5 ? null : Math.max(100, Math.round(c.m.rev * 0.07 * (l + 1) / 10) * 10); };
  Mgr.upgrade = function (c, k) {
    const m = c.m, cost = Mgr.upCost(c, k);
    if (cost === null) return 'max';
    if (m.cash < cost) return 'cash';
    m.cash -= cost; m.led.exp.other += cost; m.fac[k]++;
    addNews(c, 'upgrade', { k: FCK.T('fac.' + k), l: m.fac[k] });
    if (k === 'acad') m.acadUp = true;
    return 'ok';
  };

  // ---------- development ----------
  const devFactor = (c) => (0.85 + 0.075 * c.m.fac.train) * ({ low: 0.85, normal: 1, high: 1.18 }[c.m.tr] || 1) * (1 + (c.m.fac.coach - 3) * 0.04);
  Mgr.developPlayer = function (c, p, rng) {
    const df = devFactor(c);
    const play = (p.ap || 0) >= 10 ? 0.35 : (p.ap || 0) >= 4 ? 0 : p.ag <= 23 ? -0.6 : 0;
    let d;
    if (p.ag <= 22) d = (p.pt - p.o) * (0.30 * df) + rng.gauss() * 1.1 + play;
    else if (p.ag <= 25) d = (p.pt - p.o) * 0.22 * df + rng.gauss() * 1.0 + play * 0.6;
    else if (p.ag <= 29) d = (p.pt - p.o) * 0.1 + rng.gauss() * 0.9 + play * 0.3;
    else if (p.ag <= 32) d = -(p.ag - 29) * 0.55 + rng.gauss() * 0.9;
    else d = -(p.ag - 29) * 0.75 + rng.gauss() * 1.1;
    p.o = U.clamp(Math.round(p.o + d), 20, 97);
    if (p.ag >= 27) p.pt = Math.max(p.o, Math.min(p.pt, p.o + 1)); else if (p.pt < p.o) p.pt = p.o;
  };

  // ---------- press ----------
  Mgr.PRESS = [
    { id: 'form', ph: ['pre', 'post'], ans: [{ t: 2, b: 1, f: 0 }, { t: 0, b: 0, f: 3 }, { t: -2, b: 0, f: 1 }] },
    { id: 'star', ph: ['pre', 'post'], ans: [{ t: 3, b: 0, f: 0 }, { t: -1, b: 2, f: 0 }, { t: 1, b: 1, f: 1 }] },
    { id: 'fans', ph: ['pre', 'post'], ans: [{ t: 1, b: 0, f: 4 }, { t: 0, b: 1, f: 1 }, { t: -1, b: 0, f: -3 }] },
    { id: 'board', ph: ['pre', 'post'], ans: [{ t: 0, b: 3, f: 0 }, { t: 0, b: -3, f: 3 }, { t: 1, b: 1, f: 1 }] },
    { id: 'ref', ph: ['post'], loss: true, ans: [{ t: 2, b: -1, f: 2 }, { t: 0, b: 1, f: 0 }, { t: -1, b: 1, f: -1 }] },
    { id: 'win', ph: ['post'], win: true, ans: [{ t: 3, b: 1, f: 2 }, { t: 1, b: 2, f: 0 }, { t: -2, b: 0, f: 1 }] },
    { id: 'loss', ph: ['post'], loss: true, ans: [{ t: 1, b: 1, f: 0 }, { t: 3, b: -1, f: 1 }, { t: -3, b: 1, f: -2 }] },
    { id: 'young', ph: ['pre', 'post'], ans: [{ t: 1, b: 1, f: 2 }, { t: -1, b: 0, f: 0 }, { t: 2, b: 0, f: 1 }] },
    { id: 'rival', ph: ['pre'], ans: [{ t: 2, b: 0, f: 2 }, { t: 0, b: 1, f: 0 }, { t: -1, b: -1, f: 3 }] },
    { id: 'goal', ph: ['pre', 'post'], ans: [{ t: 1, b: 2, f: 0 }, { t: 2, b: 0, f: 2 }, { t: 0, b: 1, f: -1 }] },
    { id: 'tact', ph: ['pre'], ans: [{ t: 1, b: 1, f: 0 }, { t: 2, b: -1, f: 1 }, { t: 0, b: 1, f: 1 }] },
    { id: 'injury', ph: ['pre', 'post'], ans: [{ t: 2, b: 0, f: 0 }, { t: 0, b: 1, f: 1 }, { t: -2, b: 0, f: 0 }] },
  ];
  Mgr.pressQuestions = function (c, ph, res) {
    const rng = U.makeRng(W.hash(W.clubs[c.idx].id) ^ (c.sim.year * 53 + c.sim.pos.w * 7 + (ph === 'pre' ? 1 : 2)));
    let pool = Mgr.PRESS.filter((q) => q.ph.includes(ph) && (!q.win || res === 'W') && (!q.loss || res === 'L'));
    pool = rng.shuffle(pool.slice());
    return pool.slice(0, 3).map((q) => q.id);
  };
  Mgr.pressAnswer = function (c, qid, ai) {
    const q = Mgr.PRESS.find((x) => x.id === qid); if (!q) return;
    const e = q.ans[ai], m = c.m;
    const j = (v) => v;
    m.mood = U.clamp(m.mood + j(e.t), 5, 100);
    m.players.forEach((p) => { p.mo = U.clamp(p.mo + e.t * 0.8, 5, 100); });
    m.bc = U.clamp(m.bc + e.b * 0.9, 0, 100);
    m.fan = U.clamp(m.fan + e.f, 5, 100);
    m.pressDone = (m.pressDone || 0) + 1;
    return e;
  };

  // ---------- pack ----------
  Mgr.pack = function (c) { return c.m; };
  Mgr.unpack = function (c, o) {
    if (!o || !o.players) { c.m = null; return; }
    c.m = o;
    ['ai', 'gone', 'sc', 'fac', 'led'].forEach((k) => { if (!o[k]) o[k] = k === 'sc' ? { ms: [], seen: {}, found: [], watch: [] } : {}; });
    if (!o.offers) o.offers = []; if (!o.tl) o.tl = []; if (!o.fa) o.fa = []; if (!o.fh) o.fh = []; if (!o.spOffers) o.spOffers = [];
    Mgr.attach(c);
  };
})((globalThis.FCK = globalThis.FCK || {}));
