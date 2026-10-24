/* FCK - comp.js : stand-alone competitions - any league, any national cup, Champions / Europa / Conference League - played like the WM/EM mode */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;

  const Co = { S: null, VERSION: 1, KEY: 'comp', HKEY: 'comp_hist' };
  FCK.Comp = Co;
  const EURO = ['cl', 'el', 'ecl'];
  const lang = () => (FCK.settings && FCK.settings.lang) || 'de';

  // ---------------------------------------------------------------- catalog
  Co.countries = function () {
    W.build();
    return W.countries.slice().sort((a, b) => a.rank - b.rank || a.nameEn.localeCompare(b.nameEn));
  };
  // all league groups of a country: [{gid, tier, label, size}]
  Co.leaguesOf = function (cc) {
    const co = W.byCc[cc], out = [];
    if (!co) return out;
    co.leagues.forEach((lg) => lg.gids.forEach((g) => out.push({ gid: g, tier: lg.tier, label: lg.name + (W.groups[g].gname ? ' ' + W.groups[g].gname : ''), size: W.groups[g].size })));
    return out;
  };
  Co.hasCup = (cc) => { const co = W.byCc[cc]; return !!(co && co.cup && co.clubIdx.length >= 4); };
  Co.title = function (kind, id) {
    if (kind === 'league') { const g = W.groups[id]; return g.lname + (g.gname ? ' ' + g.gname : ''); }
    if (kind === 'cup') { const co = W.byCc[id]; return lang() === 'en' ? co.cup.en : co.cup.de; }
    return FCK.SimConst.EURO_NAME[id];
  };
  Co.flag = function (kind, id) {
    if (kind === 'league') return W.byCc[W.groups[id].cc].flag;
    if (kind === 'cup') return W.byCc[id].flag;
    return '🇪🇺';
  };
  // club indices that can take part (for the club chooser)
  Co.entrants = function (kind, id) {
    W.build();
    if (kind === 'league') return W.clubs.filter((c) => c.gid === id).map((c) => c.idx);
    if (kind === 'cup') { const co = W.byCc[id]; return co.clubIdx.slice(); }
    return FCK.Sim.single('euro', id, 1).euro[id].teams.slice();
  };

  // ---------------------------------------------------------------- state
  Co.create = function (o) {
    W.build();
    const seed = (o.seed || (Math.random() * 4e9)) >>> 0;
    const sim = FCK.Sim.single(o.kind, o.id, seed, 2026);
    const me = o.me >= 0 ? o.me : -1;
    sim.userIdx = me;
    const kids = FCK.settings.profile === 'kids';
    const S = {
      v: Co.VERSION, kind: o.kind, id: o.id, me, seed, year: sim.year, sim, created: Date.now(),
      half: o.half || (kids ? 3 : 4), level: o.level || (kids ? 'rookie' : 'pro'), preset: me >= 0 ? (o.preset || 'p1') : 'cpu',
      form: o.form || '4-3-3', style: o.style || 'balanced', xi: null, log: [], done: false, archived: false,
    };
    Co.S = S;
    return S;
  };
  Co.clubName = (i) => W.clubs[i].name;
  Co.isMine = (i) => Co.S && Co.S.me === i;

  // ---------------------------------------------------------------- progress
  Co.main = function () { const S = Co.S; return S.kind === 'league' ? S.sim.leagues[S.id] : S.kind === 'cup' ? S.sim.cups[S.id] : S.sim.euro[S.id]; };
  // has my club been knocked out (cup / European competition)?
  Co.eliminated = function () {
    const S = Co.S; if (!S || S.me < 0 || S.kind === 'league') return false;
    const me = S.me, c = Co.main();
    if (S.kind === 'cup') return c.rounds.some((r) => r && r.some((t) => (t[0] === me || t[1] === me) && t[2] >= 0 && c.winner(t) !== me));
    if (c.md >= 8) { const tb = c.lpTable(); const row = tb.find((x) => x.idx === me); if (row && row.pos > 24) return true; }
    return ['po', 'r16', 'qf', 'sf', 'f'].some((k) => c.ko[k] && c.ko[k].some((t) => (t[0] === me || t[1] === me) && t[9] >= 0 && t[9] !== me));
  };
  Co.next = function () {
    const S = Co.S; if (!S || S.me < 0 || S.done || Co.eliminated()) return null;
    const cc = S.sim.nextUserFixture();
    if (!cc) { S.sim.finishSeason(); S.done = true; Co.archive(); Co.save(); return null; }
    return { f: cc.user, w: cc.w, s: cc.s, info: S.sim.info(cc.user) };
  };
  // can the user just watch the rest (no club of mine, or knocked out)?
  Co.watching = () => !!(Co.S && !Co.S.done && (Co.S.me < 0 || Co.eliminated()));
  // is the competition over?
  Co.finished = function () {
    const S = Co.S, sim = S.sim, c = Co.main();
    if (S.kind === 'league') return c.md >= c.M;
    if (S.kind === 'cup') return c.w >= 0;
    return c.w >= 0;
  };
  Co.label = function (f, info) {
    const S = Co.S;
    return FCK.Career.compLabel(f, info);
  };
  // short status line: "Spieltag 5/34" / "Viertelfinale" ...
  Co.status = function () {
    const S = Co.S, T = FCK.T, c = Co.main();
    if (Co.finished()) return T('cp.finished');
    if (S.kind === 'league') return T('md', { n: Math.min(c.md + 1, c.M) }) + ' / ' + c.M;
    if (S.kind === 'cup') { const r = c.cur < 0 ? 0 : (c.rounds[c.cur] && c.rounds[c.cur].every((t) => t[2] >= 0) ? c.cur + 1 : c.cur); return FCK.Career.roundName(c.R - 1 - Math.min(c.R - 1, r), r + 1); }
    if (c.md < 8) return T('md', { n: c.md + 1 }) + ' / 8';
    const st = ['po', 'r16', 'qf', 'sf', 'f'].find((k) => !c.ko[k] || c.ko[k].some((t) => t[9] < 0));
    return st ? T('stage.' + st) : T('cp.finished');
  };
  Co.progress = function () {
    const S = Co.S, c = Co.main();
    if (Co.finished()) return 1;
    if (S.kind === 'league') return c.md / c.M;
    if (S.kind === 'cup') return Math.max(0, c.cur + (c.rounds[c.cur] && c.rounds[c.cur].every((t) => t[2] >= 0) ? 1 : 0)) / c.R;
    const koDone = ['po', 'r16', 'qf', 'sf', 'f'].filter((k) => c.ko[k] && c.ko[k].every((t) => t[9] >= 0)).length;
    return (c.md + koDone * 1.6) / 16;
  };

  // ---------------------------------------------------------------- match config
  const CPU_FORM = ['4-4-2', '4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '4-3-3', '5-3-2', '4-1-4-1', '3-4-3', '4-2-3-1'];
  Co.squadPool = (i) => Co.S.sim.squadOf(i);
  Co.buildCfg = function (nx) {
    const S = Co.S, sim = S.sim, f = nx.f, info = nx.info;
    const kids = FCK.settings.profile === 'kids';
    const rng = U.makeRng((W.hash(f.h + '-' + f.a) ^ sim.seed ^ (sim.pos.w * 977) ^ (sim.pos.s * 31)) >>> 0);
    const mk = (i) => Object.assign({}, W.clubs[i], { rating: U.clamp(W.matchOvr(sim.r[i]), 36, 93) });
    const home = mk(f.h), away = mk(f.a);
    if (f.neutral) { home.stadium = FCK.T('final.venue'); home.cap = 62000; }
    const userHome = f.h === S.me;
    const cpuForm = (i) => CPU_FORM[W.hash(W.clubs[i].id) % CPU_FORM.length];
    const hf = userHome ? S.form : cpuForm(f.h), af = userHome ? cpuForm(f.a) : S.form;
    const hs = userHome ? S.style : 'balanced', as = userHome ? 'balanced' : S.style;
    const mk2 = (i, form) => {
      const pool = sim.squadOf(i);
      if (i === S.me && S.xi && S.xi.f === form && FCK.Mgr && FCK.Mgr.pickManual) { const pm = FCK.Mgr.pickManual(pool, form, S.xi.ids); if (pm) return pm; }
      return FCK.pickSquad(pool, form, null, sim.delta(i));
    };
    const squads = [mk2(f.h, hf), mk2(f.a, af)];
    squads.forEach((sq, k) => { const cid = k === 0 ? f.h : f.a; sq.lineup.concat(sq.bench).forEach((p) => { p.cid = cid; }); });
    const lv = FCK.LEVELS[S.level] || FCK.LEVELS.pro;
    const settings = Object.assign({}, FCK.DEFAULT_MATCH, FCK.setup.match, lv, {
      level: S.level, halfMins: S.half, knockout: info.knockout, aggLead: info.aggLead || 0,
      weather: rng.pick(['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'snow'].slice(0, sim.pos.w > 14 && sim.pos.w < 34 ? 9 : 7)),
      tod: info.comp === 'E' || f.neutral ? 'night' : rng.pick(['day', 'day', 'evening']),
      homeFormation: hf, awayFormation: af, homeStyle: hs, awayStyle: as,
    });
    if (kids) { settings.injuries = false; if (settings.referee === 'normal') settings.referee = 'lenient'; }
    const side = userHome ? 0 : 1;
    const slots = FCK.presetSlots(S.preset).filter((s) => s.dev && s.dev !== 'none').map((s) => ({ dev: s.dev, team: s.team === 0 ? side : 1 - side }));
    return { clubs: [home, away], settings, slots, squads, comp: { f, info, w: nx.w, s: nx.s }, hook: Co.hook };
  };
  Co.play = function () {
    const nx = Co.next();
    if (!nx) return false;
    FCK.game.kind = 'idle';
    FCK.startMatch(Co.buildCfg(nx));
    return true;
  };
  // hook object handed to the match: result handling and navigation
  Co.hook = {
    onResult(m) { Co.onResult(m); },
    resultBox(m) { return FCK.CompUI ? FCK.CompUI.resultBox(m) : null; },
    continueLabel() { return FCK.T('tn.continue'); },
    next() { FCK.UI.stack = ['home', 'comp']; FCK.UI.show('compHub', null, true); },
    quit() { if (Co.S) { FCK.UI.stack = ['home', 'comp']; FCK.UI.show('compHub'); } else FCK.UI.show('home'); },
  };
  Co.onResult = function (m) {
    const S = Co.S;
    if (!S || !m.result || m._compDone) return;
    const cur = S.sim.cur;
    if (!cur || !cur.user) return;
    m._compDone = true;
    const f = cur.user, info = S.sim.info(f);
    const g = [m.teams[0].score, m.teams[1].score];
    const pens = m.result.pens ? [m.result.pens[0], m.result.pens[1]] : null;
    const et = m.period >= 3;
    S.sim.commit({ g, pens, et });
    m.goals.forEach((gl) => {
      if (gl.og || !gl.scorer || !gl.scorer.d || gl.scorer.d.sqi === undefined) return;
      S.sim.addGoal(gl.scorer.d.cid !== undefined ? gl.scorer.d.cid : (gl.team === 0 ? f.h : f.a), gl.scorer.d.sqi);
    });
    Co.record(f, info, g, pens, et, { w: cur.w, s: cur.s });
    Co.settle();
  };
  Co.readResult = function (f) {
    const sim = Co.S.sim;
    if (f.t === 'L') return { g: sim.leagues[f.gid].res[f.md][f.k], pens: null, et: false };
    if (f.t === 'C') { const t = sim.cups[f.cc].rounds[f.r][f.k]; return { g: [t[2], t[3]], pens: t[4] >= 0 ? [t[4], t[5]] : null, et: !!t[6] }; }
    const eu = sim.euro[f.k];
    if (f.st === 'lp') return { g: eu.res[f.md][f.kk], pens: null, et: false };
    const t = eu.ko[f.st][f.kk];
    if (f.st === 'f') return { g: [t[2], t[3]], pens: t[7] >= 0 ? [t[7], t[8]] : null, et: !!t[6] };
    if (f.leg === 0) return { g: [t[2], t[3]], pens: null, et: false };
    return { g: [t[5], t[4]], pens: t[7] >= 0 ? [t[8], t[7]] : null, et: !!t[6] };
  };
  Co.record = function (f, info, g, pens, et, ctx) {
    const S = Co.S;
    const home = f.h === S.me;
    const my = home ? g[0] : g[1], op = home ? g[1] : g[0];
    let res = my > op ? 'W' : my < op ? 'L' : 'D';
    if (pens) { const mp = home ? pens[0] : pens[1], o2 = home ? pens[1] : pens[0]; res = mp > o2 ? 'W' : 'L'; }
    const e = { w: ctx.w, s: ctx.s, h: f.h, a: f.a, g, pens: pens || null, et: !!et, res, label: Co.label(f, info) };
    S.log.push(e); S.last = e;
    if (S.log.length > 80) S.log.shift();
  };
  // after any progress: mark done, archive, save
  Co.settle = function () {
    const S = Co.S;
    if (!S) return;
    if (S.sim.done || Co.finished()) { S.sim.finishSeason(); S.done = true; Co.archive(); }
    Co.save();
  };
  // simulate my next fixture quickly (a fast-forward of one match)
  Co.simulateNext = function () {
    const S = Co.S, nx = Co.next(); if (!nx) return null;
    S.sim.commit(null);
    const out = Co.readResult(nx.f);
    Co.record(nx.f, nx.info, out.g, out.pens, out.et, { w: nx.w, s: nx.s });
    Co.settle();
    return { nx, out };
  };
  // everything that is left
  Co.simulateAll = function () {
    const S = Co.S;
    let guard = 0;
    if (S.me >= 0) while (guard++ < 400) { if (!Co.simulateNext()) break; }
    S.sim.finishSeason();
    S.done = true; Co.archive(); Co.save();
  };
  // watching only (no club of mine): one slot (matchday / round) at a time
  Co.stepWatch = function () {
    const S = Co.S;
    const r = S.sim.stepSlot();
    if (!r) { S.done = true; Co.archive(); Co.save(); return null; }
    if (Co.finished()) { S.sim.finishSeason(); S.done = true; Co.archive(); }
    Co.save();
    return r;
  };
  // watching: simulate until the next matchday (league/euro) or the next round (cup) is done = one step
  Co.stepMany = function (n) { let r = null; for (let i = 0; i < n; i++) { r = Co.stepWatch(); if (!r || Co.S.done) break; } return r; };

  // ---------------------------------------------------------------- results
  // final standing information
  Co.result = function () {
    const S = Co.S, sim = S.sim, c = Co.main();
    const o = { kind: S.kind, champ: -1, mine: null };
    if (S.kind === 'league') {
      const tb = c.table(); o.champ = tb[0] ? tb[0].idx : -1; o.table = tb;
      if (S.me >= 0) { const r = tb.find((x) => x.idx === S.me); o.mine = r ? { pos: r.pos, n: tb.length, pts: r.pts, zone: sim.zones(S.id)[r.pos] || null } : null; }
    } else {
      o.champ = c.w;
      if (S.me >= 0) {
        const rounds = S.log.length;
        o.mine = { won: c.w === S.me, rounds, last: S.log.length ? S.log[S.log.length - 1] : null, out: S.log.length && S.log[S.log.length - 1].res === 'L' };
      }
    }
    return o;
  };
  Co.history = () => U.store.get(Co.HKEY, []);
  Co.archive = function () {
    const S = Co.S;
    if (!S || S.archived || !S.done) return;
    S.archived = true;
    const r = Co.result();
    const h = Co.history();
    h.unshift({ ts: Date.now(), kind: S.kind, id: S.id, me: S.me, champ: r.champ, year: S.year, pos: r.mine && r.mine.pos || 0, won: !!(r.mine && (r.mine.won || (S.kind === 'league' && r.mine.pos === 1))) });
    U.store.set(Co.HKEY, h.slice(0, 40));
  };

  // top scorers of the competition
  Co.topScorers = function (limit) {
    const S = Co.S, sim = S.sim, set = new Set();
    const c = Co.main();
    if (S.kind === 'league') c.clubs.forEach((i) => set.add(i));
    else if (S.kind === 'cup') c.e.forEach((i) => set.add(i));
    else c.teams.forEach((i) => set.add(i));
    return sim.topScorers(set, limit || 10);
  };

  // ---------------------------------------------------------------- persistence
  Co.pack = function () {
    const S = Co.S;
    return { v: Co.VERSION, kind: S.kind, id: S.id, me: S.me, seed: S.seed, year: S.year, half: S.half, level: S.level, preset: S.preset, form: S.form, style: S.style, xi: S.xi, log: S.log, done: S.done, archived: S.archived, created: S.created, sim: S.sim.packSingle() };
  };
  Co.unpack = function (o) {
    W.build();
    if (!o || o.v !== Co.VERSION || !o.sim) return null;
    try {
      const sim = FCK.Sim.unpackSingle(o.sim);
      return { v: Co.VERSION, kind: o.kind, id: o.id, me: o.me, seed: o.seed, year: o.year, sim, created: o.created, half: o.half, level: o.level, preset: o.preset, form: o.form, style: o.style, xi: o.xi || null, log: o.log || [], done: !!o.done, archived: !!o.archived };
    } catch (e) { console.error(e); return null; }
  };
  Co.save = function () { if (Co.S) return U.store.set(Co.KEY, Co.pack()); return false; };
  Co.load = function () {
    const o = U.store.get(Co.KEY, null);
    const S = o ? Co.unpack(o) : null;
    Co.S = S;
    return S;
  };
  Co.clear = function () { Co.S = null; U.store.del(Co.KEY); };
  Co.hasSaved = () => !!U.store.get(Co.KEY, null);
  Co.peek = function () { const o = U.store.get(Co.KEY, null); return o && o.kind ? { kind: o.kind, id: o.id, me: o.me, year: o.year, done: o.done } : null; };
  Co.exportText = () => 'FCKW1:' + btoa(unescape(encodeURIComponent(JSON.stringify(Co.pack()))));
  Co.importText = function (txt) {
    try {
      txt = (txt || '').trim();
      if (!txt.startsWith('FCKW1:')) return null;
      const S = Co.unpack(JSON.parse(decodeURIComponent(escape(atob(txt.slice(6))))));
      if (S) { Co.S = S; Co.save(); }
      return S;
    } catch (e) { return null; }
  };
})((globalThis.FCK = globalThis.FCK || {}));
