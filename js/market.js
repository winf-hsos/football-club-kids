/* FCK - market.js : transfer market, bids, offers, free agents, scouting, contracts */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;
  const Mgr = FCK.Mgr;
  const ROLE = FCK.ROLE_OF;
  const h01 = (s) => (W.hash(s) % 10007) / 10007;

  // ---------- market entries (players of other clubs) ----------
  Mgr.entry = function (c, idx, sqi) {
    const sim = c.sim, m = c.m;
    const sq = sim.squadOf(idx); const p = sq[sqi]; if (!p) return null;
    const d = sim.delta(idx);
    const o = Math.round(p.ovr + d);
    const key = idx + ':' + sim.year + ':' + sqi;
    const ag = p.age || 26;
    const pt = Mgr.potOf(o, ag, h01(key + 'p'));
    const left = ag >= 33 ? W.hash(key + 'c') % 2 : W.hash(key + 'c') % 4; // seasons left after this one
    const ct = sim.year + left;
    const val = Mgr.valueOf(o, ag, pt);
    const w = Math.round(Mgr.wageOf(o, ag) * (0.85 + 0.3 * h01(key + 'w')) / 5) * 5;
    return { key, idx, sqi, p, o, ag, pt, ct, val, w, pos: p.pos0 || p.pos, n: p.name, nt: p.nat, known: !!m.sc.seen[key], club: W.clubs[idx] };
  };
  Mgr.parseKey = (k) => { const q = k.split(':'); return { idx: +q[0], year: +q[1], sqi: +q[2] }; };
  Mgr.entryByKey = function (c, key) { const q = Mgr.parseKey(key); if (q.year !== c.sim.year) return null; return Mgr.entry(c, q.idx, q.sqi); };
  // what the user sees of an unscouted player
  Mgr.shownOvr = function (c, e) {
    if (e.known || e.owned) return e.o;
    const sp = 4 - 0.6 * c.m.fac.scout;
    const j = Math.round((h01(e.key + 'f') - 0.5) * 2 * sp);
    return e.o + j;
  };

  Mgr.search = function (c, f) {
    const sim = c.sim, m = c.m;
    f = f || {};
    const out = [];
    const ids = f.cc ? W.byCc[f.cc].clubIdx : W.clubs.map((x) => x.idx);
    const q = (f.q || '').trim().toLowerCase();
    ids.forEach((idx) => {
      if (idx === c.idx) return;
      if (f.tier && W.groups[sim.gid[idx]].tier !== f.tier) return;
      const ovrClub = W.matchOvr(sim.r[idx]);
      if (f.ovrMin && ovrClub + 14 < f.ovrMin) return;
      const sq = sim.squadOf(idx);
      for (let k = 0; k < sq.length; k++) {
        const p = sq[k];
        if (f.role && ROLE[p.pos0 || p.pos] !== f.role) continue;
        if (f.pos && (p.pos0 || p.pos) !== f.pos) continue;
        if (f.ageMax && (p.age || 26) > f.ageMax) continue;
        if (q && !p.name.toLowerCase().includes(q)) continue;
        const o = Math.round(p.ovr + sim.delta(idx));
        if (f.ovrMin && o < f.ovrMin) continue;
        if (f.ovrMax && o > f.ovrMax) continue;
        const e = Mgr.entry(c, idx, k);
        if (f.maxVal && e.val > f.maxVal) continue;
        if (m.bought && m.bought[e.key]) continue;
        out.push(e);
      }
    });
    const so = f.sort || 'ovr';
    out.sort((a, b) => so === 'val' ? b.val - a.val : so === 'age' ? a.ag - b.ag : so === 'pot' ? b.pt - a.pt : so === 'gem' ? (b.pt + b.o * 0.5) - (a.pt + a.o * 0.5) : b.o - a.o);
    return out.slice(0, f.limit || 60);
  };

  // ---------- evaluating a bid ----------
  Mgr.askFee = function (c, e) {
    const sim = c.sim;
    let f = e.val * (1 + (h01(e.key + 'a') - 0.5) * 0.14);
    const left = e.ct - sim.year;
    if (left <= 0) f *= 0.45; else if (left === 1) f *= 0.8;
    // key players of their club cost more
    const sq = sim.squadOf(e.idx).map((p) => p.ovr).sort((a, b) => b - a);
    if (e.p.ovr >= sq[2]) f *= 1.2;
    // smaller buying club -> selling club asks a bit more from a rich buyer
    return Math.max(10, Math.round(f / 10) * 10);
  };
  Mgr.wageDemand = function (c, rec) {
    // rec: {o, ag, w?, fromR}
    let w = Mgr.wageOf(rec.o, rec.ag) * (0.95 + 0.2 * h01('d' + (rec.key || rec.id || rec.n)));
    return Math.max(5, Math.round(w / 5) * 5);
  };
  // returns {club:'ok'|'counter'|'no', ask, player:'ok'|'more'|'no', demand, why}
  Mgr.evalBid = function (c, e, fee, wage, years) {
    const m = c.m, sim = c.sim;
    const ask = Mgr.askFee(c, e);
    const r = { ask, demand: Mgr.wageDemand(c, { key: e.key, o: e.o, ag: e.ag }) };
    if (fee >= ask) r.club = 'ok'; else if (fee >= ask * 0.86) r.club = 'counter'; else r.club = 'no';
    // the player
    const myR = W.matchOvr(sim.r[c.idx]), hisR = W.matchOvr(sim.r[e.idx]);
    let need = r.demand;
    const sorted = Mgr.sorted(c);
    const xiMin = (sorted[10] ? sorted[10].o : 0);
    r.why = null;
    if (myR < hisR - 7) { need *= 1.22; r.why = 'step'; }
    if (e.o < xiMin - 4) { need *= 1.12; r.why = r.why || 'bench'; }
    if (years > 3 && e.ag >= 31) need *= 1.1;
    r.demand = Math.round(need / 5) * 5;
    if (wage >= r.demand * 0.97) r.player = 'ok'; else if (wage >= r.demand * 0.85) r.player = 'more'; else r.player = 'no';
    return r;
  };
  Mgr.checkSquadLimits = (c) => (Mgr.squad(c).length < Mgr.MAXSQ ? null : 'full');
  Mgr.canAfford = function (c, fee, wage) {
    const m = c.m;
    if (fee > m.tb) return 'tb';
    if (fee > m.cash + (m.easy ? 1e9 : 0)) return 'cash';
    if (Mgr.bill(c) + wage > m.wb) return 'wb';
    return null;
  };
  // buy a player of another club
  Mgr.buy = function (c, e, fee, wage, years) {
    const m = c.m, sim = c.sim;
    if (!Mgr.window(c)) return 'window';
    if (Mgr.checkSquadLimits(c)) return 'full';
    const ev = Mgr.evalBid(c, e, fee, wage, years);
    if (ev.club !== 'ok') return 'club';
    if (ev.player !== 'ok') return 'player';
    const af = Mgr.canAfford(c, fee, wage); if (af) return af;
    m.cash -= fee; m.tb -= fee; m.led.exp.buy += fee;
    const rec = Mgr.addRec(c, { n: e.n, nt: e.nt, pos: e.pos, o: e.o, pt: e.pt, ag: e.ag, w: wage, ct: sim.year + years - 1, sd: W.hash(e.key + 'sd'), mo: 70, bk: e.club.short, nu: 0 });
    rec.nu = Mgr.newNumber(c, rec.pos);
    (m.bought = m.bought || {})[e.key] = 1;
    // replace him in the selling club's squad
    const ovr = m.ai[e.idx] = m.ai[e.idx] || {};
    const rng = U.makeRng(W.hash(e.key + 'fill'));
    const fill = FCK.makePlayer(W.clubs[e.idx], e.p.pos0 || e.p.pos, e.p.ovr - 6, e.p.num, rng, null);
    fill.sqi = e.sqi; fill.age = rng.int(18, 32);
    ovr[e.sqi] = fill;
    m.tl.unshift({ y: sim.year, w: sim.pos.w, k: 'buy', n: e.n, club: e.idx, fee });
    m.tl.length = Math.min(m.tl.length, 40);
    Mgr.news(c, 'buy', { p: e.n, club: e.club.name, fee: Mgr.money(fee) });
    Mgr.sync(c);
    return 'ok';
  };

  // ---------- free agents ----------
  Mgr.genFA = function (c, first) {
    const m = c.m, sim = c.sim;
    const rng = U.makeRng(W.hash(W.clubs[c.idx].id) ^ (sim.year * 977 + sim.pos.w * 13) ^ 0x7f3a);
    const keep = first ? [] : m.fa.filter(() => rng.chance(0.5));
    const S = m.S || W.clubs[c.idx].rating;
    const POS = ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST'];
    const gen = [];
    while (keep.length + gen.length < 26) {
      const pos = rng.pick(POS);
      const ag = rng.int(19, 35);
      const o = Math.round(U.clamp(S - 13 + rng.gauss() * 6 + (rng.chance(0.08) ? 8 : 0), 32, 90));
      const club = W.clubs[c.idx];
      const nat = FCK.pickNameGroup(club, rng, 0.5, 0.4);
      const dn = FCK.drawName(nat, rng);
      const n = (dn.first ? dn.first + ' ' : '') + dn.last;
      const id = 'fa' + sim.year + '_' + (m.nid++);
      const rec = { id, n, nt: nat, pos, o, ag, pt: Mgr.potOf(o, ag, rng.next()), sd: rng.int(1, 4e9) };
      rec.w = Math.round(Mgr.wageOf(o, ag) * (0.9 + 0.2 * rng.next()) / 5) * 5;
      gen.push(rec);
    }
    m.fa = keep.concat(gen);
  };
  Mgr.signFA = function (c, rec, wage, years) {
    const m = c.m, sim = c.sim;
    if (Mgr.checkSquadLimits(c)) return 'full';
    if (wage < rec.w * 0.97) return 'player';
    const bonus = Math.round(wage * 0.4);
    if (m.cash < bonus) return 'cash';
    if (Mgr.bill(c) + wage > m.wb) return 'wb';
    m.cash -= bonus; m.led.exp.other += bonus;
    m.fa = m.fa.filter((x) => x !== rec);
    const r = Mgr.addRec(c, { n: rec.n, nt: rec.nt, pos: rec.pos, o: rec.o, pt: rec.pt, ag: rec.ag, w: wage, ct: sim.year + years - 1, sd: rec.sd, mo: 68 });
    m.tl.unshift({ y: sim.year, w: sim.pos.w, k: 'free', n: rec.n, club: -1, fee: 0 });
    Mgr.news(c, 'free', { p: rec.n });
    Mgr.sync(c);
    return 'ok';
  };

  // ---------- selling / offers ----------
  Mgr.listed = (c) => c.m.players.filter((p) => p.tr);
  Mgr.toggleList = function (c, rec) { rec.tr = !rec.tr; if (!rec.tr) c.m.offers = c.m.offers.filter((o) => o.pid !== rec.id); };
  Mgr.recValue = (rec) => Mgr.valueOf(rec.o, rec.ag, rec.pt);
  Mgr.makeOffer = function (c, rec, rng, big) {
    const sim = c.sim;
    const o = rec.o, myR = W.matchOvr(sim.r[c.idx]);
    // pick a plausible buyer
    let tries = 0, club = null;
    while (tries++ < 40) {
      const i = rng.int(0, W.clubs.length - 1);
      if (i === c.idx) continue;
      const r = W.matchOvr(sim.r[i]);
      if (big ? (r >= myR + 1 && r <= myR + 14) : (r >= o - 12 && r <= o + 4)) { club = i; break; }
    }
    if (club === null) return null;
    const val = Mgr.recValue(rec);
    const fee = Math.max(10, Math.round(val * (big ? 1.05 + rng.next() * 0.5 : 0.72 + rng.next() * 0.5) / 10) * 10);
    return { id: c.m.nid++, pid: rec.id, club, fee, wk: c.m.wk, exp: c.m.wk + 2 };
  };
  Mgr.marketWeek = function (c, w) {
    const m = c.m, sim = c.sim;
    const rng = U.makeRng(W.hash(W.clubs[c.idx].id) ^ (m.wk * 2654435761));
    const open = w <= 7 || (w >= 22 && w <= 26);
    m.offers = m.offers.filter((o) => o.exp >= m.wk && Mgr.byId(c, o.pid));
    if (w === 0 || w === 22) Mgr.genFA(c, false);
    // scouting missions
    m.sc.ms = m.sc.ms.filter((ms) => { if (ms.end > m.wk) return true; Mgr.finishMission(c, ms, rng); return false; });
    if (!open) return;
    Mgr.listed(c).forEach((p) => {
      if (m.offers.filter((o) => o.pid === p.id).length < 2 && rng.chance(0.38)) { const of = Mgr.makeOffer(c, p, rng, false); if (of) m.offers.push(of); }
    });
    if (rng.chance(0.07)) {
      const top = Mgr.sorted(c).slice(0, 8).filter((p) => !p.tr);
      if (top.length) { const p = rng.pick(top); const of = Mgr.makeOffer(c, p, rng, true); if (of && !m.offers.some((x) => x.pid === p.id)) { m.offers.push(of); m.newOffer = true; Mgr.news(c, 'offer', { p: p.n, club: W.clubs[of.club].name, fee: Mgr.money(of.fee) }); } }
    }
  };
  Mgr.acceptOffer = function (c, of) {
    const m = c.m, sim = c.sim;
    if (!Mgr.window(c)) return 'window';
    const rec = Mgr.byId(c, of.pid); if (!rec) return 'gone';
    if (Mgr.squad(c).length <= Mgr.MINSQ) return 'few';
    if (Mgr.squad(c).filter((p) => ROLE[p.pos] === 'GK').length <= 1 && ROLE[rec.pos] === 'GK') return 'gk';
    m.cash += of.fee; m.tb += Math.round(of.fee * 0.7); m.led.inc.sale += of.fee;
    // goes into the buyer's squad (weakest player of the same position)
    const sq = sim.squadOf(of.club); let slot = -1, low = 1e9;
    sq.forEach((p, k) => { if ((p.pos0 || p.pos) === rec.pos || (slot < 0 && ROLE[p.pos] === ROLE[rec.pos])) { if (p.ovr < low) { low = p.ovr; slot = k; } } });
    if (slot >= 0) {
      const club = W.clubs[of.club];
      const np = FCK.makePlayer(club, sq[slot].pos0 || sq[slot].pos, rec.o - sim.delta(of.club), sq[slot].num, U.makeRng(rec.sd >>> 0), { name: rec.n, nat: FCK.NAMES[rec.nt] ? rec.nt : 'en' });
      np.sqi = slot; np.age = rec.ag;
      (m.ai[of.club] = m.ai[of.club] || {})[slot] = np;
    }
    m.tl.unshift({ y: sim.year, w: sim.pos.w, k: 'sell', n: rec.n, club: of.club, fee: of.fee });
    m.tl.length = Math.min(m.tl.length, 40);
    Mgr.news(c, 'sell', { p: rec.n, club: W.clubs[of.club].name, fee: Mgr.money(of.fee) });
    Mgr.removeRec(c, rec);
    m.offers = m.offers.filter((x) => x !== of && x.pid !== of.pid);
    Mgr.sync(c);
    return 'ok';
  };
  Mgr.rejectOffer = (c, of) => { c.m.offers = c.m.offers.filter((x) => x !== of); };
  Mgr.loanOut = function (c, rec) {
    const m = c.m;
    if (!Mgr.window(c)) return 'window';
    if (Mgr.squad(c).length <= Mgr.MINSQ) return 'few';
    if (ROLE[rec.pos] === 'GK' && Mgr.squad(c).filter((p) => ROLE[p.pos] === 'GK').length <= 1) return 'gk';
    rec.ln = 1; rec.tr = false;
    if (m.xi && m.xi.ids.includes(rec.id)) m.xi = null;
    m.offers = m.offers.filter((o) => o.pid !== rec.id);
    Mgr.news(c, 'loan', { p: rec.n });
    Mgr.sync(c);
    return 'ok';
  };
  Mgr.release = function (c, rec) {
    const m = c.m, left = Math.max(0, rec.ct - c.sim.year + 1);
    const cost = Math.round(rec.w * left * 0.5);
    if (Mgr.squad(c).length <= Mgr.MINSQ) return 'few';
    if (ROLE[rec.pos] === 'GK' && Mgr.squad(c).filter((p) => ROLE[p.pos] === 'GK').length <= 1) return 'gk';
    m.cash -= cost; m.led.exp.other += cost;
    Mgr.removeRec(c, rec);
    Mgr.sync(c);
    return 'ok';
  };

  // ---------- contracts ----------
  Mgr.renewDemand = function (c, rec) {
    const m = c.m;
    let w = Mgr.wageOf(rec.o + Math.max(0, (rec.pt - rec.o) * 0.3), rec.ag) * 1.08;
    if (rec.mo < 40) w *= 1.25; else if (rec.mo > 75) w *= 0.95;
    const sorted = Mgr.sorted(c); const rank = sorted.indexOf(rec);
    if (rank >= 0 && rank < 5) w *= 1.1;
    w *= 0.92 + 0.16 * h01('rn' + rec.id + c.sim.year);
    return Math.max(5, Math.round(w / 5) * 5);
  };
  Mgr.renew = function (c, rec, wage, years) {
    const need = Mgr.renewDemand(c, rec);
    if (wage < need * 0.97) return wage >= need * 0.88 ? 'more' : 'no';
    if (Mgr.bill(c) - rec.w + wage > c.m.wb * 1.03) return 'wb';
    rec.w = wage;
    rec.ct = Math.max(rec.ct, c.sim.year) + years;
    rec.mo = U.clamp(rec.mo + 8, 5, 100);
    return 'ok';
  };

  // ---------- scouting ----------
  Mgr.maxMissions = (c) => (c.m.fac.scout >= 4 ? 3 : 2);
  Mgr.missionCost = (c) => Math.max(10, Math.round(c.m.rev * 0.004 / 5) * 5);
  Mgr.startMission = function (c, o) {
    const m = c.m;
    if (m.sc.ms.length >= Mgr.maxMissions(c)) return 'max';
    const cost = Mgr.missionCost(c);
    if (m.cash < cost) return 'cash';
    m.cash -= cost; m.led.exp.other += cost;
    m.sc.ms.push({ id: m.nid++, cc: o.cc || null, role: o.role || null, ageMax: o.ageMax || 0, end: m.wk + (m.fac.scout >= 3 ? 1 : 2) });
    return 'ok';
  };
  Mgr.finishMission = function (c, ms, rng) {
    const m = c.m;
    const S = m.S || 55;
    const f = { cc: ms.cc, role: ms.role, ageMax: ms.ageMax, ovrMin: Math.max(34, Math.round(S - 8)), sort: 'gem', limit: 200 };
    let list = Mgr.search(c, f);
    if (!list.length) list = Mgr.search(c, Object.assign({}, f, { ovrMin: Math.max(34, Math.round(S - 16)) }));
    const n = 3 + m.fac.scout;
    const pick = []; const pool = list.slice(0, 30);
    while (pick.length < n && pool.length) pick.push(pool.splice(rng.int(0, Math.min(pool.length - 1, 12)), 1)[0]);
    pick.forEach((e) => { m.sc.seen[e.key] = 1; m.sc.found.unshift(e.key); });
    m.sc.found = m.sc.found.slice(0, 40);
    m.newScout = (m.newScout || 0) + pick.length;
    Mgr.news(c, 'scouted', { n: pick.length });
  };
  Mgr.watch = function (c, key) {
    const w = c.m.sc.watch; const i = w.indexOf(key);
    if (i >= 0) w.splice(i, 1); else w.unshift(key);
    c.m.sc.watch = w.slice(0, 40);
  };
  Mgr.observe = function (c, key) {
    const m = c.m, cost = Math.max(5, Math.round(Mgr.missionCost(c) * 0.3 / 5) * 5);
    if (m.sc.seen[key]) return 'known';
    if (m.cash < cost) return 'cash';
    m.cash -= cost; m.led.exp.other += cost; m.sc.seen[key] = 1;
    return 'ok';
  };
})((globalThis.FCK = globalThis.FCK || {}));
