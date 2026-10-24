/* FCK - pro.js : Profikarriere (player career). One own player grows up in the football world:
   training, form, coach trust, squad role, contract offers, national team, awards, retirement.
   It runs on top of Career (c.pro) and the same world simulation; the rest of the squad is generated like every other club. */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;
  const Pro = {};
  FCK.Pro = Pro;

  const ATTR = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
  Pro.XP_PER_SP = 50; // experience for one skill point
  Pro.SP_GAIN = 2; // one point raises one detail value by this much
  Pro.ATTR = ATTR;
  // 31 detail values (+5 for keepers) behind the six headline values; the headline value is their weighted average and is what the match engine uses
  Pro.DET = {
    pac: [['accel', 0.45], ['sprint', 0.55]],
    sho: [['finish', 0.3], ['power', 0.2], ['long', 0.15], ['volley', 0.1], ['pen', 0.05], ['attpos', 0.2]],
    pas: [['vision', 0.2], ['cross', 0.15], ['fk', 0.1], ['short', 0.3], ['long2', 0.15], ['curve', 0.1]],
    dri: [['agil', 0.12], ['bal', 0.08], ['react', 0.12], ['ctrl', 0.22], ['drib', 0.22], ['comp', 0.1], ['skill', 0.14]],
    def: [['inter', 0.2], ['head', 0.12], ['aware', 0.2], ['stand', 0.2], ['slide', 0.13], ['mark', 0.15]],
    phy: [['jump', 0.2], ['stam', 0.3], ['str', 0.3], ['aggr', 0.2]],
  };
  Pro.GKD = ['gk_div', 'gk_han', 'gk_kic', 'gk_pos', 'gk_ref'];
  Pro.DKEYS = ATTR.reduce((a, k) => a.concat(Pro.DET[k].map((x) => x[0])), []);
  Pro.groupOf = (key) => ATTR.find((k) => Pro.DET[k].some((x) => x[0] === key)) || (Pro.GKD.includes(key) ? 'gk' : null);
  // typical strengths by position (added to the group value before the group is re-centred)
  const FLAVOR = {
    ST: { finish: 5, attpos: 5, volley: 3, head: 3, comp: 3, power: 2, inter: -6, mark: -6, slide: -6, stand: -5, aware: -6, vision: -3, cross: -4 },
    LW: { accel: 3, sprint: 2, cross: 4, skill: 5, drib: 3, agil: 4, finish: 1, head: -4, str: -5, jump: -3, slide: -4 },
    RW: { accel: 3, sprint: 2, cross: 4, skill: 5, drib: 3, agil: 4, finish: 1, head: -4, str: -5, jump: -3, slide: -4 },
    LM: { cross: 5, accel: 2, stam: 3, drib: 2, head: -3, str: -3 }, RM: { cross: 5, accel: 2, stam: 3, drib: 2, head: -3, str: -3 },
    CAM: { vision: 6, short: 3, ctrl: 3, curve: 3, fk: 3, comp: 3, skill: 3, long: 2, mark: -6, slide: -5, str: -4 },
    CM: { short: 4, vision: 3, stam: 4, inter: 2, long2: 3, ctrl: 2, finish: -2 },
    CDM: { inter: 6, aware: 5, stand: 5, mark: 4, slide: 3, str: 3, short: 2, aggr: 4, finish: -5, volley: -5, skill: -5, curve: -4 },
    CB: { head: 6, aware: 5, stand: 5, mark: 5, inter: 4, jump: 5, str: 5, aggr: 3, finish: -8, skill: -8, curve: -6, volley: -8, long: -6, agil: -5, accel: -3 },
    LB: { cross: 3, stam: 5, accel: 3, sprint: 3, stand: 2, slide: 3, finish: -6, head: -2, skill: -3 }, RB: { cross: 3, stam: 5, accel: 3, sprint: 3, stand: 2, slide: 3, finish: -6, head: -2, skill: -3 },
    GK: {},
  };
  const dmult = (p, key, v) => (v >= 0 ? p.dm[key] : 2 - p.dm[key]);
  function buildDetails(p, rng) {
    const fl = FLAVOR[p.pos] || {};
    p.d = {}; p.dm = {};
    ATTR.forEach((k) => {
      const raw = Pro.DET[k].map((x) => p.a[k] + (fl[x[0]] || 0) + rng.gauss() * 3.2);
      const avg = Pro.DET[k].reduce((s, x, i) => s + x[1] * raw[i], 0);
      Pro.DET[k].forEach((x, i) => { p.d[x[0]] = clamp(raw[i] + (p.a[k] - avg), 20, 99); });
    });
    const gk = FCK.ROLE_OF[p.pos] === 'GK';
    const raw = Pro.GKD.map(() => (gk ? p.a.gk : 18) + rng.gauss() * (gk ? 3 : 2));
    const avg = raw.reduce((s, v) => s + v, 0) / raw.length;
    Pro.GKD.forEach((k, i) => { p.d[k] = clamp(raw[i] + (gk ? p.a.gk - avg : 0), 10, 99); });
    Pro.DKEYS.concat(Pro.GKD).forEach((k) => { p.dm[k] = 0.8 + rng.next() * 0.45; });
  }
  // headline values from the detail values
  Pro.sync = function (p) {
    ATTR.forEach((k) => { p.a[k] = Pro.DET[k].reduce((s, x) => s + x[1] * p.d[x[0]], 0); });
    if (FCK.ROLE_OF[p.pos] === 'GK') p.a.gk = Pro.GKD.reduce((s, k) => s + p.d[k], 0) / Pro.GKD.length;
  };
  // old saves (before the detail values) get them built from the six values
  Pro.fix = function (p) {
    if (p.d && p.dm) return p;
    buildDetails(p, U.makeRng(hash('det' + p.name + p.age + p.pos) >>> 0));
    return p;
  };
  // grow (or shrink) a group of detail values
  Pro.bump = function (p, group, v, top) {
    const lim = top || Pro.cap(p);
    const keys = group === 'gk' ? Pro.GKD : Pro.DET[group].map((x) => x[0]);
    keys.forEach((k) => { p.d[k] = clamp(p.d[k] + v * dmult(p, k, v), 20, Math.max(lim, 20)); });
  };
  Pro.POS = ['GK', 'LB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];
  // same offsets as the squad generator, so a rating means the same thing for the pro and for everybody else
  const BIAS = {
    GK: { pac: -20, sho: -40, pas: -10, dri: -30, def: -20, phy: 0 },
    DF: { pac: -2, sho: -14, pas: -4, dri: -8, def: 6, phy: 4 },
    MF: { pac: 0, sho: -3, pas: 5, dri: 3, def: -3, phy: 0 },
    FW: { pac: 3, sho: 6, pas: -2, dri: 4, def: -20, phy: 0 },
  };
  const POS_BIAS = {
    LW: { pac: 5, dri: 3 }, RW: { pac: 5, dri: 3 }, LM: { pac: 4 }, RM: { pac: 4 }, LB: { pac: 4 }, RB: { pac: 4 },
    CDM: { def: 6, sho: -4 }, CAM: { pas: 4, dri: 3, def: -6 }, CB: { def: 4, phy: 3 }, ST: { sho: 4 },
  };
  const WEIGHT = {
    DF: { def: 0.38, phy: 0.2, pac: 0.14, pas: 0.12, dri: 0.08, sho: 0.08 },
    MF: { pas: 0.28, dri: 0.2, sho: 0.12, def: 0.12, phy: 0.14, pac: 0.14 },
    FW: { sho: 0.32, pac: 0.2, dri: 0.2, phy: 0.12, pas: 0.1, def: 0.06 },
  };
  const bias = (pos, k) => BIAS[FCK.ROLE_OF[pos]][k] + ((POS_BIAS[pos] && POS_BIAS[pos][k]) || 0);
  Pro.ovrOf = function (a, pos) {
    const role = FCK.ROLE_OF[pos];
    if (role === 'GK') return a.gk;
    const w = WEIGHT[role];
    let s = 0;
    for (const k in w) s += w[k] * (a[k] - bias(pos, k));
    return s;
  };
  // positions that can compete for the same place
  const CLOSE = { LB: ['LB'], RB: ['RB'], CB: ['CB'], CDM: ['CDM', 'CM'], CM: ['CM', 'CDM', 'CAM'], CAM: ['CAM', 'CM'], LM: ['LM', 'LW'], RM: ['RM', 'RW'], LW: ['LW', 'LM'], RW: ['RW', 'RM'], ST: ['ST'], GK: ['GK'] };
  const SLOTS_NEEDED = { GK: 1, LB: 1, CB: 2, RB: 1, CDM: 2, CM: 2, CAM: 1, LM: 1, RM: 1, LW: 1, RW: 1, ST: 2 };
  const DEF_NUM = { GK: 1, LB: 3, CB: 4, RB: 2, CDM: 6, CM: 8, CAM: 10, LM: 11, RM: 7, LW: 11, RW: 7, ST: 9 };
  Pro.ROLES = ['star', 'start', 'rot', 'bench', 'out'];
  const hash = (s) => W.hash(String(s));
  const clamp = U.clamp;

  // ---------------------------------------------------------------- creation
  Pro.ARCH = {
    balanced: {},
    pace: { pac: 9, dri: 3, phy: -4, def: -2 },
    shot: { sho: 9, phy: 2, pas: -3, def: -4 },
    tech: { pas: 6, dri: 7, pac: -2, phy: -5 },
    power: { phy: 9, def: 3, pac: -4, dri: -4 },
  };
  Pro.TALENT = { gem: [88, 93], solid: [80, 85], late: [74, 79] };
  // rng: optional; fixed seed gives a reproducible start
  Pro.newPlayer = function (o) {
    o = o || {};
    const rng = U.makeRng((o.seed || Math.random() * 4e9) >>> 0);
    const pos = Pro.POS.includes(o.pos) ? o.pos : 'ST';
    const age = clamp(Math.round(o.age || 17), 16, 24);
    const o0 = 53 + (age - 16) * 3 + rng.range(-1.5, 1.5);
    const arch = Pro.ARCH[o.arch] || Pro.ARCH.balanced;
    const a = {};
    ATTR.forEach((k) => { a[k] = o0 + bias(pos, k) + (arch[k] || 0) + rng.gauss() * 2.2; });
    a.gk = FCK.ROLE_OF[pos] === 'GK' ? o0 + rng.gauss() * 1.5 : 20;
    const cur = Pro.ovrOf(a, pos), shift = o0 - cur;
    ATTR.forEach((k) => { a[k] += shift; });
    const tr = Pro.TALENT[o.talent] || Pro.TALENT.solid;
    const nation = FCK.NATION_BY_ID[o.nation] || FCK.NATIONS[0];
    const p = {
      v: 1, name: String(o.name || 'Max Mustermann').trim().slice(0, 28) || 'Max Mustermann', nat: nation.id, grp: nation.g, pos, foot: o.foot === 'L' ? 'L' : 'R',
      num: clamp(Math.round(o.num || DEF_NUM[pos]), 1, 99), look: o.look || { skin: FCK.SKIN[1], hairStyle: 'short', hair: FCK.HAIR[1], beard: false },
      age, a, pt: Math.round(rng.range(tr[0], tr[1])), xp: 0, sp: 3, ab: FCK.Abilities ? [FCK.Abilities.starter(pos, o.arch)] : [], train: { focus: defaultFocus(pos), int: 'normal' },
      form: 55, fit: 100, trust: 50, inj: 0, ctl: o.ctl === 'team' ? 'team' : 'player', slot: FCK.FULL_POS.lastIndexOf(pos),
      contract: { until: 0, wage: 0 }, season: blankSeason(), hist: [], tot: { ap: 0, st: 0, g: 0, a: 0, min: 0, mom: 0, cs: 0, rs: 0, rn: 0 },
      trophies: [], awards: [], intl: { caps: 0, goals: 0, done: [], tour: [] }, obj: [], pending: null, offers: [], last: null, retired: false, rec: { seasons: 0 },
    };
    buildDetails(p, rng);
    Pro.sync(p);
    return p;
  };
  function defaultFocus(pos) {
    const r = FCK.ROLE_OF[pos];
    return r === 'FW' ? 'sho' : r === 'MF' ? 'pas' : r === 'DF' ? 'def' : 'pac';
  }
  function blankSeason() { return { ap: 0, st: 0, min: 0, g: 0, a: 0, rs: 0, rn: 0, mom: 0, yc: 0, rc: 0, cs: 0, played: 0 }; }
  Pro.blankSeason = blankSeason;

  Pro.ovr = (p) => Pro.ovrOf(p.a, p.pos);
  Pro.cap = (p) => Math.min(99, p.pt + 6);
  Pro.nameOf = (n) => { const q = n.trim().split(/\s+/); return q.length > 1 ? q[0][0] + '. ' + q.slice(1).join(' ') : n; };

  // ---------------------------------------------------------------- squad with the pro
  Pro.shift = function (p) {
    const form = (p.form - 50) / 12;
    const fit = p.fit < 70 ? (p.fit - 70) / 10 : 0;
    return form + fit;
  };
  // squad record as the match engine and the squad generator use it
  Pro.rec = function (c, noShift) {
    const p = Pro.fix(c.pro), sh = noShift ? 0 : Pro.shift(p);
    const a = {};
    ATTR.forEach((k) => { a[k] = clamp(Math.round(p.a[k] + sh), 22, 99); });
    a.gk = FCK.ROLE_OF[p.pos] === 'GK' ? clamp(Math.round(p.a.gk + sh), 30, 99) : 20;
    return {
      id: 900001, name: p.name, sname: Pro.nameOf(p.name), last: p.name.trim().split(/\s+/).slice(-1)[0], num: p.num, pos: p.pos, role: FCK.ROLE_OF[p.pos], pos0: p.pos,
      ovr: clamp(Math.round(Pro.ovr(p) + sh), 25, 99), a, nat: p.grp, look: p.look, sqi: p.slot, age: p.age, pro: true, real: true, cid: c.idx, ab: (p.ab || []).slice(),
    };
  };
  // generated squad of the user's club with the pro in his slot
  Pro.simSquad = function (c) {
    const sim = c.sim, club = W.clubs[c.idx];
    const base = W.squad(club, (sim.seed + Math.imul(sim.year, 7919)) >>> 0);
    const d = W.matchOvr(sim.r[c.idx]) - club.rating;
    const out = base.map((q) => FCK.clonePlayer(q, q.pos, q.num, d));
    const me = Pro.rec(c);
    const used = new Set(out.map((q, i) => (i === c.pro.slot ? -1 : q.num)));
    if (used.has(me.num)) { let n = 12; while (used.has(n)) n++; out.forEach((q, i) => { if (i !== c.pro.slot && q.num === me.num) q.num = n; }); }
    out[c.pro.slot] = me;
    return out;
  };
  Pro.attach = function (c) {
    const sim = c.sim, p = Pro.fix(c.pro);
    sim.userSquad = () => Pro.simSquad(c);
    sim.nameHook = null;
    sim.scorerHook = (k, rng) => {
      const s = Pro._share;
      if (s && s.on && rng.next() < s.p) { s.g++; return p.slot; }
      return k;
    };
  };

  // competition for his place
  Pro.rankInfo = function (c) {
    const p = c.pro, sim = c.sim, club = W.clubs[c.idx];
    const base = W.squad(club, (sim.seed + Math.imul(sim.year, 7919)) >>> 0);
    const d = W.matchOvr(sim.r[c.idx]) - club.rating;
    const grp = CLOSE[p.pos] || [p.pos];
    const rivals = base.filter((q, i) => i !== p.slot && grp.includes(q.pos0 || q.pos)).map((q) => q.ovr + d).sort((x, y) => y - x);
    const k = SLOTS_NEEDED[p.pos] || 1;
    const kth = rivals.length >= k ? rivals[k - 1] : (rivals.length ? rivals[rivals.length - 1] - 8 : 0);
    const me = Pro.ovr(p) + Pro.shift(p);
    return { me, kth, best: rivals[0] || 0, edge: me - kth, rivals };
  };
  Pro.roleScore = (c) => { const r = Pro.rankInfo(c); return r.edge + (c.pro.trust - 50) / 8; };
  Pro.roleOf = function (c, seedKey) {
    const p = c.pro;
    if (p.inj > 0) return 'out';
    const s = Pro.roleScore(c);
    if (s >= 5) return 'star';
    if (s >= 0) return 'start';
    if (s >= -4) return (hash(seedKey + p.name) % 100) < 50 + s * 8 ? 'start' : 'bench'; // rotation
    if (s >= -12) return 'bench';
    return 'out';
  };
  // role label for the planning view (without the rotation coin flip)
  Pro.roleLabel = function (c) {
    const p = c.pro;
    if (p.inj > 0) return 'inj';
    const s = Pro.roleScore(c);
    return s >= 5 ? 'star' : s >= 0 ? 'start' : s >= -4 ? 'rot' : s >= -12 ? 'bench' : 'out';
  };
  // role a new player would get at a club (for the start screen and for offers)
  Pro.roleAt = function (p, club, simYear, seed, delta) {
    const base = W.squad(club, ((seed || 1) + Math.imul(simYear, 7919)) >>> 0);
    const grp = CLOSE[p.pos] || [p.pos];
    const rivals = base.filter((q, i) => i !== p.slot && grp.includes(q.pos0 || q.pos)).map((q) => q.ovr + (delta || 0)).sort((x, y) => y - x);
    const k = SLOTS_NEEDED[p.pos] || 1;
    const kth = rivals.length >= k ? rivals[k - 1] : (rivals.length ? rivals[rivals.length - 1] - 8 : 0);
    const s = Pro.ovr(p) - kth;
    return s >= 5 ? 'star' : s >= 0 ? 'start' : s >= -4 ? 'rot' : s >= -12 ? 'bench' : 'out';
  };

  // formation of the coach: first one that has the pro's exact position
  Pro.formationFor = function (c) {
    const names = FCK.FORMATION_NAMES.slice().sort((x, y) => hash(W.clubs[c.idx].id + x) - hash(W.clubs[c.idx].id + y));
    const hit = names.find((n) => FCK.FORMATIONS[n].some((s) => s.pos === c.pro.pos));
    return hit || names[0];
  };

  // lineup + bench for a match of the pro's club
  Pro.matchSquad = function (c, form, role) {
    const sq = Pro.simSquad(c);
    const p = c.pro, me = sq[p.slot];
    const mode = role || 'start';
    const excl = (mode === 'bench' || mode === 'out') ? new Set([p.slot]) : null;
    const pk = FCK.pickSquad(sq, form, excl, 0);
    const inLine = pk.lineup.findIndex((q) => q.sqi === p.slot);
    const slots = FCK.FORMATIONS[form];
    if ((mode === 'start' || mode === 'star') && inLine < 0) {
      // make sure he starts: he takes the place of the weakest player of his line
      let best = -1, bs = 1e9;
      pk.lineup.forEach((q, i) => { const s = (slots[i].pos === 'GK') !== (me.role === 'GK') ? 1e8 : q.ovr - (slots[i].pos === p.pos ? 50 : 0) + (FCK.ROLE_OF[slots[i].pos] === me.role ? 0 : 20); if (s < bs) { bs = s; best = i; } });
      const old = pk.lineup[best];
      pk.lineup[best] = FCK.clonePlayer(me, slots[best].pos, me.num, 0);
      pk.lineup[best].sqi = p.slot;
      if (old && !pk.bench.some((q) => q.sqi === old.sqi)) pk.bench.unshift(old);
      pk.bench = pk.bench.slice(0, 7);
    }
    if (mode === 'bench') {
      const cl = FCK.clonePlayer(me, me.pos, me.num, 0); cl.sqi = p.slot;
      pk.bench = pk.bench.filter((q) => q.sqi !== p.slot);
      pk.bench.splice(Math.min(2, pk.bench.length), 0, cl);
      pk.bench = pk.bench.slice(0, 7);
      if (!pk.bench.some((q) => q.sqi === p.slot)) pk.bench[pk.bench.length - 1] = cl;
    }
    // everybody gets the club id (goal credit)
    pk.lineup.concat(pk.bench).forEach((q) => { q.cid = c.idx; });
    return pk;
  };
  // which set pieces the coach gives him
  Pro.setPieces = function (c) {
    const p = c.pro, out = [];
    if (FCK.ROLE_OF[p.pos] === 'GK') return out;
    const star = p.trust >= 55;
    if (!star) return out;
    Pro.fix(p);
    if ((p.a.sho >= 72 || p.d.pen >= 76) && p.d.pen >= 62 && FCK.ROLE_OF[p.pos] !== 'DF') out.push('penalty');
    if ((p.a.sho >= 68 || p.a.pas >= 72) && p.d.fk >= 58) out.push('freekick');
    if (p.a.pas >= 70 && p.d.cross >= 62 && ['LM', 'RM', 'LW', 'RW', 'CAM', 'CM'].includes(p.pos)) out.push('corner');
    return out;
  };
  // match configuration additions for the engine; null when he cannot be controlled alone
  Pro.lockCfg = function (c, side, role) {
    const p = c.pro;
    if (p.ctl !== 'player' || role === 'out' || p.inj > 0) return null;
    let at = null;
    if (role === 'bench') at = 52 + (hash(c.sim.year + ':' + c.sim.pos.w + p.name) % 22) - Math.round((p.trust - 50) / 8);
    return { team: side, sqi: p.slot, at, setp: Pro.setPieces(c) };
  };

  // ---------------------------------------------------------------- ratings
  Pro.rate = function (st, pos, o) {
    // st: engine player stats; o: {mins, win, loss, conceded, yellow, red}
    const role = FCK.ROLE_OF[pos];
    let r = 6.1;
    const gw = role === 'FW' ? 0.95 : role === 'MF' ? 1.1 : role === 'DF' ? 1.3 : 1.5;
    r += Math.min(3, st.goals) * gw + Math.min(3, st.assists) * 0.65;
    r += Math.min(4, st.sot) * 0.08 + Math.min(4, st.shots - st.sot) * 0.02;
    if (st.passes >= 8) r += (st.passOk / st.passes - 0.78) * 2.2;
    r += Math.min(5, st.tackleWon) * 0.14 + Math.max(0, st.tackles - st.tackleWon) * -0.03;
    if (role === 'GK') r += Math.min(7, st.saves) * 0.26 - Math.min(4, o.conceded) * 0.28 + (o.conceded === 0 && o.mins >= 60 ? 0.55 : 0);
    if (role === 'DF') { r -= Math.min(4, o.conceded) * 0.2; if (o.conceded === 0 && o.mins >= 60) r += 0.45; }
    if (role === 'MF') r += o.conceded === 0 && o.mins >= 60 ? 0.15 : 0;
    r += o.win ? 0.3 : o.loss ? -0.25 : 0;
    r -= st.fouls * 0.08 + (o.yellow ? 0.3 : 0) + (o.red ? 1.6 : 0) + st.og * 1.0;
    r += Math.min(1, st.touches / 60) * 0.15;
    if (o.mins < 45) r = 6.1 + (r - 6.1) * Math.max(0.3, o.mins / 45);
    return clamp(Math.round(r * 10) / 10, 3, 10);
  };

  // ---------------------------------------------------------------- after a match
  // played with the engine: m is the finished match; simulated: m == null
  Pro.afterMatch = function (c, e, ctx) {
    const p = c.pro, sim = c.sim, rng = U.makeRng((hash(c.clubId + e.y + ':' + e.w + ':' + e.s) ^ sim.seed ^ p.xp) >>> 0);
    const userHome = e.h === c.idx;
    const my = userHome ? e.g[0] : e.g[1], op = userHome ? e.g[1] : e.g[0];
    const win = e.res === 'W', loss = e.res === 'L';
    let mins = 0, goals = 0, assists = 0, rating = null, yellow = false, red = false, st = null, played = false;
    const pm = ctx && ctx.pm;
    if (pm) { ({ mins, goals, assists, rating, yellow, red } = pm); played = mins > 0; st = pm.st; }
    else {
      // simulated by the game: appearance depends on his role, goals come from the scorer hook
      const role = ctx && ctx.role ? ctx.role : 'out';
      mins = role === 'out' ? 0 : (role === 'star' || role === 'start') ? (rng.chance(0.78) ? 90 : rng.int(60, 88)) : rng.int(8, 32);
      played = mins > 0;
      const sh = Pro._share || { g: 0 };
      goals = played ? sh.g : 0;
      if (played) {
        const rest = Math.max(0, my - goals);
        const ap = (FCK.ROLE_OF[p.pos] === 'FW' ? 0.22 : FCK.ROLE_OF[p.pos] === 'MF' ? 0.26 : FCK.ROLE_OF[p.pos] === 'DF' ? 0.07 : 0.01) * (mins / 90) * clamp(Math.pow(Pro.ovr(p) / 72, 2), 0.3, 2);
        for (let i = 0; i < rest; i++) if (rng.next() < ap) assists++;
        const strengthGap = (Pro.ovr(p) + Pro.shift(p) - W.matchOvr(sim.r[userHome ? e.a : e.h])) / 22;
        const stat = { goals, assists, shots: goals + rng.int(0, 3), sot: goals + rng.int(0, 2), passes: 25, passOk: 21, tackles: 2, tackleWon: rng.int(0, 2), saves: FCK.ROLE_OF[p.pos] === 'GK' ? rng.int(0, 5) : 0, fouls: rng.int(0, 2), og: 0, touches: 40 };
        rating = Pro.rate(stat, p.pos, { mins, win, loss, conceded: op, yellow: false, red: false });
        rating = clamp(Math.round((rating + strengthGap * 0.5 + rng.gauss() * 0.45) * 10) / 10, 3.5, 9.9);
      }
    }
    Pro._share = null;
    // injury (engine injuries are given in ctx.hurt by the match; simulated ones are random)
    let newInj = 0;
    if (played) {
      const risk = 0.022 + (p.fit < 60 ? (60 - p.fit) / 500 : 0) + (p.train.int === 'high' ? 0.012 : 0) - (p.train.int === 'low' ? 0.006 : 0);
      if (pm ? pm.injured : rng.next() < risk * (mins / 90)) newInj = [1, 1, 2, 2, 3, 4, 6, 8][rng.int(0, 7)];
    }
    if (p.inj > 0 && !played) p.inj = Math.max(0, p.inj - 1);
    if (newInj) { p.inj = newInj; Career_news(c, 'pro.news.injury', { n: newInj }); }
    // statistics
    const S = p.season;
    if (played) {
      S.ap++; if (pm ? pm.started : (ctx.role === 'start' || ctx.role === 'star')) S.st++;
      S.min += mins; S.g += goals; S.a += assists; S.rs += rating; S.rn++; if (rating >= 8.5) S.mom++;
      if (yellow) S.yc++; if (red) S.rc++;
      if (op === 0 && mins >= 60) S.cs++;
    }
    S.played++;
    // form, trust, fitness
    if (played) {
      p.form = clamp(p.form * 0.7 + (50 + (rating - 6.0) * 22) * 0.3, 0, 100);
      p.trust = clamp(p.trust + (rating - 6.0) * 4.5 + (win ? 0.8 : 0) + (mins >= 60 ? 0.3 : 0), 0, 100);
      p.fit = clamp(p.fit - (mins / 90) * 12, 0, 100);
    } else {
      p.form = clamp(p.form * 0.9 + 5, 0, 100);
      p.trust = clamp(p.trust - (ctx.role === 'bench' || ctx.role === 'rot' ? 0.8 : 0.4), 0, 100);
    }
    // training + recovery
    const inten = p.train.int, im = inten === 'low' ? 0.6 : inten === 'high' ? 1.5 : 1;
    const am = p.age <= 20 ? 1.3 : p.age <= 24 ? 1.1 : p.age <= 28 ? 0.8 : p.age <= 31 ? 0.5 : 0.3;
    const room = Pro.ovr(p) < p.pt ? 1 : 0.4;
    const g = 0.05 * im * am * room;
    const fk = p.train.focus;
    Pro.fix(p);
    if (fk === 'all') ATTR.forEach((k) => Pro.bump(p, k, g * 0.4));
    else { Pro.bump(p, fk, g); ATTR.forEach((k) => { if (k !== fk) Pro.bump(p, k, g * 0.12); }); }
    if (FCK.ROLE_OF[p.pos] === 'GK') Pro.bump(p, 'gk', g * (fk === 'all' ? 0.4 : 0.6));
    Pro.sync(p);
    p.fit = clamp(p.fit - (inten === 'low' ? 1 : inten === 'high' ? 6 : 3) + (inten === 'low' ? 19 : inten === 'high' ? 14 : 16), 0, 100);
    // experience
    const xp = played ? 6 + Math.max(0, rating - 5.5) * 5 + goals * 5 + assists * 3 + (rating >= 8.5 ? 8 : 0) + (win ? 2 : 0) : 2;
    p.xp += xp;
    while (p.xp >= Pro.XP_PER_SP) { p.xp -= Pro.XP_PER_SP; p.sp++; }
    p.last = { y: e.y, w: e.w, h: e.h, a: e.a, g: e.g, mins, goals, assists, rating, role: ctx.role || null, res: e.res };
    ctx.proLast = p.last;
    Pro.international(c, e.w);
    return p.last;
  };
  function Career_news(c, k, v) { if (FCK.Career && FCK.Career.cur === c) FCK.Career.news({ k, v: v || {} }); }

  // before a simulated match: role + goal share for the scorer hook
  Pro.preSim = function (c, f) {
    const p = c.pro, sim = c.sim;
    const role = Pro.roleOf(c, 'sim' + sim.year + ':' + f.h + '-' + f.a + ':' + sim.pos.w);
    const mins = role === 'out' ? 0 : (role === 'star' || role === 'start') ? 82 : 20;
    const r = FCK.ROLE_OF[p.pos];
    const pShare = (r === 'FW' ? 0.30 : r === 'MF' ? (p.pos === 'CAM' || p.pos === 'LM' || p.pos === 'RM' ? 0.14 : 0.07) : r === 'DF' ? 0.035 : 0) * clamp(Math.pow((Pro.ovr(p) + Pro.shift(p)) / 70, 3), 0.2, 2.6) * (mins / 90);
    Pro._share = { on: mins > 0, p: pShare, g: 0 };
    return role;
  };
  Pro.simCtx = function (c, f) { return { role: Pro.preSim(c, f) }; };

  // ---------------------------------------------------------------- national team
  const WINDOWS = [9, 21, 38];
  Pro.natLevel = function (c) {
    const n = FCK.NATION_BY_ID[c.pro.nat];
    const r = FCK.Tourney ? FCK.Tourney.strength(n.id) : n.r;
    return W.matchOvr(r) - 7;
  };
  Pro.international = function (c, w) {
    const p = c.pro, I = p.intl;
    if (p.age < 18 || p.retired) return;
    WINDOWS.forEach((wk, i) => {
      if (w < wk || I.done.includes(c.sim.year + ':' + i)) return;
      I.done.push(c.sim.year + ':' + i); if (I.done.length > 12) I.done.shift();
      const rng = U.makeRng((hash(p.name + c.sim.year + i)) >>> 0);
      const eff = Pro.ovr(p) + Pro.shift(p);
      const need = Pro.natLevel(c);
      const chance = 1 / (1 + Math.exp(-(eff - need) / 2.2));
      if (p.inj > 0 || !rng.chance(chance)) { if (I.caps > 0 && p.inj === 0 && rng.chance(0.3)) Career_news(c, 'pro.news.nocall', {}); return; }
      const games = 2;
      let g = 0;
      for (let k = 0; k < games; k++) {
        const role = eff - need >= 4 ? 'start' : eff - need >= 0 ? (rng.chance(0.6) ? 'start' : 'bench') : 'bench';
        if (role === 'bench' && !rng.chance(0.7)) continue;
        I.caps++;
        const r = FCK.ROLE_OF[p.pos];
        if (rng.chance((r === 'FW' ? 0.3 : r === 'MF' ? 0.1 : r === 'DF' ? 0.03 : 0) * (role === 'start' ? 1 : 0.4))) { I.goals++; g++; }
      }
      Career_news(c, 'pro.news.callup', { nat: FCK.Tourney ? FCK.Tourney.natName(p.nat) : p.nat, g });
      p.fit = clamp(p.fit - 6, 0, 100);
    });
  };
  // summer tournament after the season (WM in 2026 + 4n, EM in 2028 + 4n)
  Pro.tournamentFor = function (year) {
    if ((year - 2026) % 4 === 0 && year >= 2026) return 'wm48';
    if ((year - 2028) % 4 === 0 && year >= 2028) return 'em24';
    return null;
  };
  Pro.tournament = function (c, year) {
    const p = c.pro, kind = Pro.tournamentFor(year);
    if (!kind || p.age < 18) return null;
    const eff = Pro.ovr(p) + Pro.shift(p);
    if (p.inj > 2 || eff < Pro.natLevel(c) - 3 || p.intl.caps < 1) return null;
    const Tn = FCK.Tourney;
    const S = Tn.create({ kind, me: null, seed: hash(p.name + year) });
    if (!S.teams.includes(p.nat)) return { kind, year, in: false };
    Tn.settle(S, { all: true });
    let guard = 0; while (!S.done && guard++ < 20) Tn.settle(S, { all: true });
    const place = Tn.placeKey(S, p.nat) || (S.champ === p.nat ? 'W' : null);
    const rng = U.makeRng(hash(p.name + 'tour' + year) >>> 0);
    const r = FCK.ROLE_OF[p.pos];
    const games = place === 'G' ? 3 : place === 'R32' ? 4 : place === 'R16' ? 5 : place === 'QF' ? 6 : 7;
    let g = 0; for (let i = 0; i < games; i++) if (rng.chance((r === 'FW' ? 0.28 : r === 'MF' ? 0.09 : r === 'DF' ? 0.03 : 0))) g++;
    p.intl.caps += games; p.intl.goals += g;
    const won = S.champ === p.nat;
    const res = { kind, year, in: true, place: won ? 'W' : place, games, g };
    p.intl.tour.push(res);
    if (won) p.trophies.push({ y: year, k: kind === 'wm48' ? 'wm' : 'em', club: p.nat });
    return res;
  };

  // ---------------------------------------------------------------- contract and offers
  Pro.wage = (p) => Math.round(FCK.Mgr.wageOf(Pro.ovr(p), p.age) * (0.8 + Math.min(0.5, p.pt / 200)) / 5) * 5;
  Pro.startContract = function (c, years) {
    const p = c.pro, sim = c.sim;
    p.contract = { until: sim.year + years, wage: Pro.wage(p) };
  };
  // offers from other clubs at the end of a season (after sim.endSeason: tiers are updated)
  Pro.makeOffers = function (c) {
    const p = c.pro, sim = c.sim, rng = U.makeRng((hash(p.name + 'off' + sim.year) ^ sim.seed) >>> 0);
    const me = Pro.ovr(p), seen = new Set([c.idx]);
    const list = [];
    const myTier = W.groups[sim.gid[c.idx]].tier, myCc = W.groups[sim.gid[c.idx]].cc;
    const interest = (p.season.rn >= 8 ? (p.season.rs / p.season.rn - 6.2) * 1.4 : -1) + (p.form - 50) / 40;
    const n = clamp(Math.round(2 + interest + (p.contract.until <= sim.year ? 1.5 : 0)), 0, 5);
    const cands = W.clubs.filter((cl) => cl.idx !== c.idx).map((cl) => {
      const role = Pro.roleAt(p, cl, sim.year, sim.seed, W.matchOvr(sim.r[cl.idx]) - cl.rating);
      return { cl, role, r: sim.r[cl.idx] };
    });
    const myR = sim.r[c.idx];
    // interested clubs: strength near what he is worth, minus a bit of luck
    const want = cands.filter((x) => x.role !== 'out' && Math.abs(W.matchOvr(x.r) - (me + 6 + interest * 2)) < 11).sort(() => rng.next() - 0.5);
    want.forEach((x) => {
      if (list.length >= n || seen.has(x.cl.idx)) return;
      seen.add(x.cl.idx);
      const w = Math.round(FCK.Mgr.wageOf(me + (W.matchOvr(x.r) - me) * 0.3, p.age) * (0.85 + rng.next() * 0.45) / 5) * 5;
      list.push({ idx: x.cl.idx, role: x.role, wage: w, years: rng.int(2, 5), top: x.r > myR });
    });
    // the own club: renewal (always when the contract ends)
    const keep = Pro.roleAt(p, W.clubs[c.idx], sim.year, sim.seed, W.matchOvr(sim.r[c.idx]) - W.clubs[c.idx].rating);
    list.unshift({ idx: c.idx, role: keep === 'out' ? 'bench' : keep, wage: Math.round(Pro.wage(p) * (1.05 + Math.max(0, interest) * 0.08) / 5) * 5, years: rng.int(2, 4), own: true });
    return list;
  };
  // transfer request: the player asks to leave; the advisor checks if a club of his choice would take him
  Pro.requestsLeft = function (c) { const p = c.pro; return p.req && p.req.y === c.sim.year ? Math.max(0, 2 - p.req.n) : 2; };
  Pro.canRequest = function (c) { const p = c.pro; return !p.retired && (!p.pending || p.pending === "optional"); };
  Pro.requestTransfer = function (c, idx) {
    const p = c.pro, sim = c.sim;
    if (idx === c.idx) return { ok: false, why: 'same' };
    if (Pro.requestsLeft(c) <= 0) return { ok: false, why: 'limit' };
    p.req = { y: sim.year, n: (p.req && p.req.y === sim.year ? p.req.n : 0) + 1 };
    const cl = W.clubs[idx], r = sim.r[idx], me = Pro.ovr(p);
    const role = Pro.roleAt(p, cl, sim.year, sim.seed, W.matchOvr(r) - cl.rating);
    if (role === 'out') return { ok: false, why: 'squad', role };
    const gap = W.matchOvr(r) - me;
    const rng = U.makeRng((hash(p.name + 'req' + sim.year + cl.id + p.req.n) ^ sim.seed) >>> 0);
    const prob = gap <= 4 ? 1 : clamp(0.85 - (gap - 4) * 0.09 + (p.form - 50) / 200 + (p.season.rn >= 6 ? (p.season.rs / p.season.rn - 6.5) * 0.12 : 0), 0, 0.95);
    if (!rng.chance(prob)) return { ok: false, why: gap > 10 ? 'high' : 'no', role };
    const w = Math.round(FCK.Mgr.wageOf(me + (W.matchOvr(r) - me) * 0.3, p.age) * (0.85 + rng.next() * 0.4) / 5) * 5;
    return { ok: true, offer: { idx, role, wage: w, years: rng.int(2, 5), req: true } };
  };
  Pro.acceptOffer = function (c, o) {
    const p = c.pro, sim = c.sim;
    if (o.idx !== c.idx) {
      const old = W.clubs[c.idx].name;
      FCK.Career.moveTo(c, o.idx);
      Career_news(c, 'pro.news.moved', { from: old, to: W.clubs[o.idx].name });
    } else Career_news(c, 'pro.news.renewed', {});
    p.contract = { until: sim.year + o.years, wage: o.wage };
    p.trust = o.role === 'star' ? 68 : o.role === 'start' ? 58 : o.role === 'rot' ? 48 : 38;
    p.pending = null; p.offers = [];
  };

  // ---------------------------------------------------------------- season end / start
  const DEV = (age) => (age <= 18 ? 1.9 : age === 19 ? 1.6 : age === 20 ? 1.4 : age === 21 ? 1.1 : age === 22 ? 0.9 : age === 23 ? 0.6 : age === 24 ? 0.4 : age <= 27 ? 0.1 : age <= 29 ? -0.3 : age <= 31 ? -0.9 : age <= 33 ? -1.6 : -2.3);
  Pro.endOfSeason = function (c, sm) {
    const p = c.pro, sim = c.sim, S = p.season;
    const rep = { year: sim.year, season: Object.assign({}, S), avg: S.rn ? S.rs / S.rn : 0, awards: [], objs: [], trophies: [], dev: 0, tour: null, ovrBefore: Pro.ovr(p), age: p.age };
    // objectives
    p.obj.forEach((ob) => {
      let ok = false;
      if (ob.k === 'ap') ok = S.ap >= ob.n;
      else if (ob.k === 'rt') ok = S.rn >= 5 && S.rs / S.rn >= ob.n / 10;
      else if (ob.k === 'ga') ok = S.g + S.a >= ob.n;
      else if (ob.k === 'cs') ok = S.cs >= ob.n;
      ob.done = ok; rep.objs.push({ k: ob.k, n: ob.n, done: ok });
      if (ok) { p.xp += 150; p.trust = clamp(p.trust + 4, 0, 100); }
    });
    while (p.xp >= Pro.XP_PER_SP) { p.xp -= Pro.XP_PER_SP; p.sp++; }
    // trophies of the club
    if (sm.pos === 1) { p.trophies.push({ y: sim.year, k: 'league', club: c.clubId }); rep.trophies.push('league'); }
    if (sm.cupWon) { p.trophies.push({ y: sim.year, k: 'cup', club: c.clubId }); rep.trophies.push('cup'); }
    if (sm.euroWon) { p.trophies.push({ y: sim.year, k: sm.euro, club: c.clubId }); rep.trophies.push(sm.euro); }
    // awards
    const avg = rep.avg;
    const gid = sim.gid[c.idx];
    const ts = sim.topScorers(sim.leagues[gid].clubs, 1)[0];
    if (S.ap >= 12 && ts && ts.club === c.idx && ts.goals === S.g && S.g >= 8 && FCK.ROLE_OF[p.pos] !== 'GK') rep.awards.push('scorer');
    if (S.ap >= 20 && avg >= 7.5) rep.awards.push('best');
    if (p.age <= 21 && S.ap >= 12 && avg >= 7.1) rep.awards.push('talent');
    if (S.ap >= 25 && avg >= 7.9 && Pro.ovr(p) >= 84 && (sm.pos <= 2 || sm.euroWon)) rep.awards.push('world');
    rep.awards.forEach((k) => p.awards.push({ y: sim.year, k }));
    // development
    Pro.fix(p);
    const before = Pro.ovr(p);
    const dev = DEV(p.age) * (DEV(p.age) > 0 ? (Pro.ovr(p) < p.pt ? 1 : 0.3) : 1);
    ATTR.forEach((k) => {
      let d = dev;
      if (p.age >= 28 && k === 'pac') d = dev * 1.7 - 0.2;
      if (p.age <= 22 && k === 'phy') d = dev * 1.15;
      if (p.age >= 30 && (k === 'pas' || k === 'def')) d = dev * 0.5;
      Pro.bump(p, k, d);
    });
    if (FCK.ROLE_OF[p.pos] === 'GK') Pro.bump(p, 'gk', dev * 0.9 + (p.age >= 30 ? 0.6 : 0));
    Pro.sync(p);
    rep.dev = Pro.ovr(p) - before;
    // summer tournament
    const T = Pro.tournament(c, sim.year + 1);
    if (T) rep.tour = T;
    // history row
    p.hist.push({ y: sim.year, club: c.clubId, ap: S.ap, st: S.st, g: S.g, a: S.a, avg: Math.round(avg * 100) / 100, o: Math.round(Pro.ovr(p)), age: p.age, mom: S.mom, cs: S.cs, trophies: rep.trophies, awards: rep.awards, tier: sm.tier });
    p.tot.ap += S.ap; p.tot.st += S.st; p.tot.g += S.g; p.tot.a += S.a; p.tot.min += S.min; p.tot.mom += S.mom; p.tot.cs += S.cs; p.tot.rs += S.rs; p.tot.rn += S.rn;
    p.rec.seasons++;
    p.age++; p.season = blankSeason();
    p.fit = 100; p.inj = Math.max(0, p.inj - 3);
    p.pt = p.age >= 24 ? Math.min(p.pt, Math.max(Pro.ovr(p) + 2, p.pt - 1)) : p.pt;
    return rep;
  };
  Pro.beginSeason = function (c, rep) {
    const p = c.pro, sim = c.sim;
    Pro.newObjectives(c);
    if (p.age >= 33 && p.age < 42) p.pending = p.contract.until <= sim.year ? 'offers' : p.pending;
    p.form = 55;
    if (p.contract.until <= sim.year || (rep && rep.awards.length) || p.hist.length) {
      p.offers = Pro.makeOffers(c);
      p.pending = p.contract.until <= sim.year ? 'offers' : (p.offers.length > 1 ? 'optional' : null);
    }
    if (p.age >= 36) p.pending = p.pending || 'retire?';
    return rep;
  };
  Pro.newObjectives = function (c) {
    const p = c.pro, role = Pro.roleLabel(c), r = FCK.ROLE_OF[p.pos];
    const rr = role === 'star' ? 6 : role === 'start' ? 5 : role === 'rot' ? 3 : 2;
    const ob = [{ k: 'ap', n: role === 'star' || role === 'start' ? 28 : role === 'rot' ? 18 : 10 }, { k: 'rt', n: role === 'star' ? 72 : role === 'start' ? 68 : 65 }];
    if (r === 'GK') ob.push({ k: 'cs', n: role === 'star' || role === 'start' ? 8 : 3 });
    else ob.push({ k: 'ga', n: Math.max(2, Math.round((r === 'FW' ? 2.6 : r === 'MF' ? 1.3 : 0.5) * rr)) });
    p.obj = ob.map((x) => Object.assign({ done: false }, x));
  };
  Pro.retire = function (c) {
    const p = c.pro;
    p.retired = true; p.pending = null;
    return Pro.legacy(c);
  };
  // legacy score for the career summary
  Pro.legacy = function (c) {
    const p = c.pro, T = p.tot;
    const t = (k) => p.trophies.filter((x) => x.k === k).length;
    const score = Math.round(T.g * 0.8 + T.a * 0.5 + T.ap * 0.15 + (p.intl.caps) * 0.3 + t('league') * 12 + t('cup') * 5 + t('cl') * 30 + t('el') * 12 + t('ecl') * 8 + t('wm') * 45 + t('em') * 28 + p.awards.filter((x) => x.k === 'world').length * 35 + p.awards.filter((x) => x.k === 'best').length * 8 + p.awards.filter((x) => x.k === 'scorer').length * 8);
    return { score, tier: score >= 400 ? 'legend' : score >= 220 ? 'star' : score >= 100 ? 'pro' : 'journey' };
  };

  // ---------------------------------------------------------------- spending skill points
  // one point raises one detail value by SP_GAIN (a group name spreads the points over the whole group)
  Pro.canSpend = (p, k) => {
    Pro.fix(p);
    if (p.sp <= 0) return false;
    if (p.d[k] === undefined) return ATTR.includes(k) && Math.round(p.a[k]) < Math.min(99, Pro.cap(p));
    return Math.round(p.d[k]) < Math.min(99, Pro.cap(p));
  };
  Pro.spend = function (c, k) {
    const p = Pro.fix(c.pro);
    if (!Pro.canSpend(p, k)) return false;
    p.sp--;
    if (p.d[k] === undefined) Pro.bump(p, k, Pro.SP_GAIN / 3); else p.d[k] = Math.min(99, Pro.cap(p), p.d[k] + Pro.SP_GAIN);
    Pro.sync(p);
    return true;
  };
  Pro.stats = function (p) {
    const S = p.season, T = p.tot;
    return { avg: S.rn ? S.rs / S.rn : 0, ap: S.ap, g: S.g, a: S.a, tAp: T.ap + S.ap, tG: T.g + S.g, tA: T.a + S.a, tAvg: (T.rn + S.rn) ? (T.rs + S.rs) / (T.rn + S.rn) : 0 };
  };

  // ---------------------------------------------------------------- the match engine result of the pro
  Pro.fromMatch = function (c, m) {
    const p = c.pro, ctx = m.careerCtx;
    const f = ctx.f, side = f.h === c.idx ? 0 : 1;
    const t = m.teams[side];
    const pl = t.all.find((q) => q.d && q.d.pro);
    if (!pl) return { mins: 0 };
    const endClock = m.clock;
    const t0 = pl.enter || 0, t1 = pl.leave != null ? pl.leave : endClock;
    const mins = Math.max(0, Math.round((Math.min(t1, endClock) - t0) / 60));
    const started = !pl.enter;
    const used = mins > 0 || (started && pl.onPitch);
    if (!used) return { mins: 0 };
    const st = pl.st;
    const conceded = m.teams[1 - side].score;
    const my = t.score;
    const rating = Pro.rate(st, p.pos, { mins: Math.max(mins, 1), win: my > conceded, loss: my < conceded, conceded, yellow: pl.yellow > 0, red: !!pl.red });
    return { mins: Math.max(mins, 1), goals: st.goals, assists: st.assists, rating, yellow: pl.yellow > 0, red: !!pl.red, st, injured: !!pl.injured, started };
  };

  Pro.pack = (p) => JSON.parse(JSON.stringify(p));
})((globalThis.FCK = globalThis.FCK || {}));
