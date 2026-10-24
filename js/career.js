/* FCK - career.js : career state, match flow (play / simulate), season flow, save slots */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;

  const Career = {
    cur: null, SLOTS: 5,
  };
  FCK.Career = Career;

  // ---------- dates ----------
  Career.dateOf = function (year, w, s) {
    const d = new Date(Date.UTC(year, 7, 8 + w * 7 - (s === 0 ? 3 : 0)));
    return d;
  };
  Career.fmtDate = function (d) {
    try { return d.toLocaleDateString(FCK.settings.lang === 'en' ? 'en-GB' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch (e) { return d.toISOString().slice(0, 10); }
  };
  Career.seasonLabel = (year) => year + '/' + String((year + 1) % 100).padStart(2, '0');

  // ---------- own (editor) clubs in the career ----------
  // An own club takes over the place of a real club of the world: it keeps the slot (league, fixtures,
  // id) but gets name, crest, colours, stadium and squad of the editor club. The career save holds a
  // snapshot, so later editor changes do not break a running career.
  const CFIELDS = ['name', 'short', 'colors', 'kit', 'crest', 'stadium', 'cap', 'pitch', 'recs', 'rating', 'r'];
  const cl = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  let bak = null;
  Career.customActive = () => !!bak;
  Career.restoreCustom = function () {
    if (!bak) return;
    const club = W.clubs[bak.idx];
    if (club) CFIELDS.forEach((k) => { if (bak.saved[k] === undefined) delete club[k]; else club[k] = cl(bak.saved[k]); });
    bak = null; W.clearSquadCache();
  };
  Career.rOfRating = (rt) => 26 + (rt - 46) / 0.65;
  function paint(club, rec) {
    ['name', 'short', 'colors', 'kit', 'crest', 'stadium', 'cap', 'pitch'].forEach((k) => { if (rec[k] !== undefined) club[k] = cl(rec[k]); });
    club.recs = cl(rec.recs || []);
    club.rating = FCK.Editor.rateOf(club.recs); club.r = Career.rOfRating(club.rating);
    W.clearSquadCache();
  }
  Career.applyCustom = function (spec) {
    W.build();
    if (!spec || !spec.rec || !W.clubs[spec.idx]) { Career.restoreCustom(); return false; }
    if (bak && bak.idx !== spec.idx) Career.restoreCustom();
    const club = W.clubs[spec.idx];
    if (!bak) { bak = { idx: spec.idx, saved: {} }; CFIELDS.forEach((k) => { bak.saved[k] = cl(club[k]); }); }
    paint(club, spec.rec);
    return true;
  };
  // after the editor re-registered the world: put the own club back in place
  Career.reapplyCustom = function () { const c = Career.cur; if (c && c.custom && bak && bak.idx === c.custom.idx) paint(W.clubs[bak.idx], c.custom.rec); };
  // the own club only shows up on career screens; everywhere else the real club is back
  Career.syncCustom = function (screen) {
    const c = Career.cur;
    if (screen === 'result' || screen === 'welcome') return;
    if (c && c.custom && (screen === 'career' || screen === 'careerSaves')) { if (!bak || bak.idx !== c.custom.idx) Career.applyCustom(c.custom); } else if (bak) Career.restoreCustom();
  };
  // club object as shown in lists (save slots, continue button) without touching the world
  Career.displayClub = function (clubId, custom) {
    const club = W.byId[clubId]; if (!club) return null;
    if (!custom || !custom.rec) return club;
    return Object.assign({}, club, cl({ name: custom.rec.name, short: custom.rec.short, colors: custom.rec.colors, kit: custom.rec.kit, crest: custom.rec.crest, stadium: custom.rec.stadium }));
  };
  // suggestion: weakest top-flight club of the country that matches the own club's name group
  Career.suggestSlot = function (rec) {
    W.build();
    const home = W.clubs.filter((c) => c.tier === 1 && c.country === rec.cc);
    const cands = home.length ? home : W.clubs.filter((c) => c.tier === 1 && c.cc === rec.cc);
    const pool = cands.length ? cands : W.clubs.filter((c) => c.tier === 1);
    return pool.slice().sort((a, b) => a.r - b.r)[0] || null;
  };

  // ---------- creation ----------
  Career.create = function (o) {
    W.build();
    Career.restoreCustom();
    const club = W.byId[o.clubId];
    if (!club || !club.world) return null;
    let custom = null;
    if (o.custom) { custom = { idx: club.idx, rec: cl(o.custom) }; if (!Career.applyCustom(custom)) return null; }
    const seed = (o.seed || (Math.random() * 4e9)) >>> 0;
    const sim = new FCK.Sim(seed);
    sim.userIdx = club.idx;
    const kids = FCK.settings.profile === 'kids';
    const c = {
      v: 1, name: o.name || club.name, clubId: club.id, idx: club.idx, sim, created: Date.now(),
      formation: '4-3-3', style: 'balanced', preset: o.preset || 'p1',
      level: o.level || (kids ? 'rookie' : 'pro'), halfMins: o.halfMins || (kids ? 3 : 4),
      log: [], chist: [], news: [], slot: -1, custom,
    };
    Career.cur = c;
    if (o.pro) {
      c.pro = o.pro; c.formation = FCK.Pro.formationFor(c);
      FCK.Pro.attach(c); FCK.Pro.startContract(c, o.years || 3); FCK.Pro.newObjectives(c);
      c.pro.trust = { star: 66, start: 56, rot: 46, bench: 38, out: 30 }[FCK.Pro.roleLabel(c)] || 45;
      Career.news({ k: 'pro.news.start', v: { name: c.pro.name, club: club.name } });
    } else {
      FCK.Mgr.init(c, { easy: o.easy });
      Career.news({ k: 'news.start', v: { club: club.name, season: Career.seasonLabel(sim.year) } });
    }
    return c;
  };

  // ---------- news / log ----------
  Career.news = function (item) {
    const c = Career.cur; if (!c) return;
    c.news.unshift(Object.assign({ y: c.sim.year, w: c.sim.pos.w }, item));
    if (c.news.length > 40) c.news.length = 40;
  };

  // ---------- state helpers ----------
  Career.club = () => W.clubs[Career.cur.idx];
  Career.groupOf = (i) => W.groups[Career.cur.sim.gid[i]];
  Career.clubName = (i) => W.clubs[i].name;
  // the user's most important upcoming fixture (loads the simulation up to it)
  Career.next = function () {
    const c = Career.cur;
    const cc = c.sim.nextUserFixture();
    return cc ? { f: cc.user, w: cc.w, s: cc.s, info: c.sim.info(cc.user) } : null;
  };

  // label of a competition fixture
  Career.compLabel = function (f, info) {
    const T = FCK.T;
    if (info.comp === 'L') return W.groups[f.gid].lname + (W.groups[f.gid].gname ? ' ' + W.groups[f.gid].gname : '') + ' · ' + T('md', { n: info.md });
    if (info.comp === 'C') {
      const co = W.byCc[f.cc];
      return (FCK.settings.lang === 'en' ? co.cup.en : co.cup.de) + ' · ' + Career.roundName(info.rname, info.round + 1);
    }
    const nm = FCK.SimConst.EURO_NAME[f.k];
    if (f.st === 'lp') return nm + ' · ' + T('md', { n: info.md });
    return nm + ' · ' + T('stage.' + f.st) + (info.twoLegs ? ' · ' + T('leg', { n: info.leg + 1 }) : '');
  };
  Career.roundName = function (fromFinal, n) {
    const T = FCK.T;
    return fromFinal === 0 ? T('stage.f') : fromFinal === 1 ? T('stage.sf') : fromFinal === 2 ? T('stage.qf') : fromFinal === 3 ? T('stage.r16') : T('round', { n });
  };
  Career.compKey = (f) => (f.t === 'L' ? 'L' : f.t === 'C' ? 'C' : f.k);

  // ---------- match config ----------
  const CPU_FORM = ['4-4-2', '4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '4-3-3', '5-3-2', '4-1-4-1', '3-4-3', '4-2-3-1'];
  Career.buildCfg = function (nx) {
    const c = Career.cur, sim = c.sim, f = nx.f, info = nx.info;
    const kids = FCK.settings.profile === 'kids';
    const rng = U.makeRng((W.hash(f.h + '-' + f.a) ^ sim.seed ^ (sim.pos.w * 977) ^ (sim.pos.s * 31)) >>> 0);
    const mk = (i) => Object.assign({}, W.clubs[i], { rating: U.clamp(W.matchOvr(sim.r[i]), 36, 93) });
    const home = mk(f.h), away = mk(f.a);
    if (f.neutral) { home.stadium = FCK.T('final.venue'); home.cap = 62000; }
    const userHome = f.h === c.idx;
    const cpuForm = (i) => CPU_FORM[W.hash(W.clubs[i].id) % CPU_FORM.length];
    let hf = userHome ? c.formation : cpuForm(f.h), af = userHome ? cpuForm(f.a) : c.formation;
    const hs = userHome ? c.style : 'balanced', as = userHome ? 'balanced' : c.style;
    if (c.m) FCK.Mgr.sync(c);
    let proRole = null;
    if (c.pro) {
      proRole = FCK.Pro.roleOf(c, 'm' + sim.year + ':' + f.h + '-' + f.a + ':' + nx.w + nx.s);
      if (c.pro.ctl === 'player') { if (userHome) hf = c.formation; else af = c.formation; }
    }
    const mk2 = (i, form) => (i === c.idx && c.pro ? FCK.Pro.matchSquad(c, form, proRole) : i === c.idx && c.m ? FCK.Mgr.matchSquad(c, form) : FCK.pickSquad(sim.squadOf(i), form, null, sim.delta(i)));
    const squads = [mk2(f.h, hf), mk2(f.a, af)];
    squads.forEach((sq, k) => { const cid = k === 0 ? f.h : f.a; sq.lineup.concat(sq.bench).forEach((p) => { p.cid = cid; }); });
    const lv = FCK.LEVELS[c.level] || FCK.LEVELS.pro;
    const settings = Object.assign({}, FCK.DEFAULT_MATCH, FCK.setup.match, lv, {
      level: c.level, halfMins: c.halfMins, knockout: info.knockout, aggLead: info.aggLead || 0,
      weather: rng.pick(['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'snow'].slice(0, sim.pos.w > 14 && sim.pos.w < 34 ? 9 : 7)),
      tod: info.comp === 'E' || f.neutral ? 'night' : rng.pick(['day', 'day', 'evening']),
      homeFormation: hf, awayFormation: af, homeStyle: hs, awayStyle: as,
    });
    if (kids) { settings.injuries = false; if (settings.referee === 'normal') settings.referee = 'lenient'; }
    const side = userHome ? 0 : 1;
    const slots = FCK.presetSlots(c.preset).filter((s) => s.dev && s.dev !== 'none').map((s) => ({ dev: s.dev, team: s.team === 0 ? side : 1 - side }));
    const cfg = { clubs: [home, away], settings, slots, squads, career: { f, info, w: nx.w, s: nx.s, role: proRole } };
    if (c.pro) {
      const lk = FCK.Pro.lockCfg(c, side, proRole);
      if (lk) cfg.lock = lk;
      else if (c.pro.ctl === 'player') cfg.slots = []; // cannot play (injured / not in the squad): watch the match
    }
    return cfg;
  };

  Career.play = function () {
    const nx = Career.next();
    if (!nx) return false;
    FCK.game.kind = 'idle';
    FCK.startMatch(Career.buildCfg(nx));
    return true;
  };

  // result of the match played with the engine
  Career.onResult = function (m) {
    const c = Career.cur, ctx = m.careerCtx; if (!c || !ctx || ctx.done) return;
    ctx.done = true;
    const sim = c.sim;
    const pens = m.result.pens;
    const et = m.period >= 3;
    const g = [m.teams[0].score, m.teams[1].score];
    if (!sim.cur || !sim.cur.user) return;
    const f = sim.cur.user;
    const info = ctx.info;
    sim.commit({ g, pens: pens ? [pens[0], pens[1]] : null, et });
    // real scorers
    m.goals.forEach((gl) => {
      if (gl.og || !gl.scorer || !gl.scorer.d || gl.scorer.d.sqi === undefined) return;
      sim.addGoal(gl.scorer.d.cid !== undefined ? gl.scorer.d.cid : (gl.team === 0 ? f.h : f.a), gl.scorer.d.sqi);
    });
    if (c.m) {
      const side = f.h === c.idx ? 0 : 1;
      ctx.hurt = m.teams[side].players.filter((p) => p.injured && p.d && p.d.sqi > 0).map((p) => p.d.sqi);
    }
    if (c.pro) ctx.pm = FCK.Pro.fromMatch(c, m);
    Career.record(f, info, g, pens, et, ctx);
  };
  Career.simulateNext = function () {
    const c = Career.cur, sim = c.sim;
    const nx = Career.next(); if (!nx) return null;
    const f = nx.f, info = nx.info;
    if (c.m) FCK.Mgr.preMatch(c);
    const sctx = { w: nx.w, s: nx.s };
    if (c.pro) sctx.role = FCK.Pro.preSim(c, f);
    sim.commit(null);
    // read the result back
    const out = Career.readResult(f, info);
    Career.record(f, info, out.g, out.pens, out.et, sctx);
    return out;
  };
  Career.readResult = function (f, info) {
    const sim = Career.cur.sim;
    if (f.t === 'L') return { g: sim.leagues[f.gid].res[f.md][f.k], pens: null, et: false };
    if (f.t === 'C') { const t = sim.cups[f.cc].rounds[f.r][f.k]; return { g: [t[2], t[3]], pens: t[4] >= 0 ? [t[4], t[5]] : null, et: !!t[6] }; }
    const eu = sim.euro[f.k];
    if (f.st === 'lp') return { g: eu.res[f.md][f.kk], pens: null, et: false };
    const t = eu.ko[f.st][f.kk];
    if (f.st === 'f') return { g: [t[2], t[3]], pens: t[7] >= 0 ? [t[7], t[8]] : null, et: !!t[6] };
    if (f.leg === 0) return { g: [t[2], t[3]], pens: null, et: false };
    return { g: [t[5], t[4]], pens: t[7] >= 0 ? [t[8], t[7]] : null, et: !!t[6] };
  };
  // log entry of one of the user's matches
  Career.record = function (f, info, g, pens, et, ctx) {
    const c = Career.cur, sim = c.sim;
    const userHome = f.h === c.idx;
    const my = userHome ? g[0] : g[1], op = userHome ? g[1] : g[0];
    let res = my > op ? 'W' : my < op ? 'L' : 'D';
    if (pens) { const mp = userHome ? pens[0] : pens[1], op2 = userHome ? pens[1] : pens[0]; res = mp > op2 ? 'W' : 'L'; }
    const e = { y: sim.year, w: ctx.w, s: ctx.s, t: f.t, key: Career.compKey(f), h: f.h, a: f.a, g, pens: pens || null, et: !!et, res, info: { md: info.md, round: info.round, rname: info.rname, st: f.st, leg: info.leg, cc: f.cc, gid: f.gid, k: f.k } };
    c.log.push(e);
    c.lastResult = e;
    if (c.m) { FCK.Mgr.gate(c, f, info); FCK.Mgr.tick(c, ctx.w); FCK.Mgr.afterMatch(c, e, ctx.hurt || null); }
    if (c.pro) FCK.Pro.afterMatch(c, e, ctx);
    const opp = userHome ? f.a : f.h;
    Career.news({ k: 'news.match.' + res, v: { opp: W.clubs[opp].name, s: g[0] + ':' + g[1], comp: Career.compLabel(f, info) } });
    Career.afterMatchNews(f, info, res);
    Career.autosave();
  };
  Career.afterMatchNews = function (f, info, res) {
    const c = Career.cur, sim = c.sim;
    if (f.t === 'C' && info.rname === 0) { /* final: handled at the end */ }
    if (f.t === 'C' && res === 'L') Career.news({ k: 'news.cupout', v: { comp: Career.compLabel(f, info) } });
    if (f.t === 'E' && f.st !== 'lp' && res === 'L' && (f.st === 'f' || info.leg === 1)) Career.news({ k: 'news.euroout', v: { comp: FCK.SimConst.EURO_NAME[f.k] } });
  };

  Career.simulateSeason = function () {
    const c = Career.cur;
    let n = 0, guard = 0;
    while (guard++ < 400) { const r = Career.simulateNext(); if (!r) break; n++; }
    return n;
  };

  // ---------- season end ----------
  Career.seasonSummary = function () {
    const c = Career.cur, sim = c.sim, idx = c.idx;
    const gid = sim.gid[idx], g = W.groups[gid];
    const tb = sim.leagues[gid].table();
    const row = tb.find((r) => r.idx === idx);
    const co = W.byCc[g.cc];
    const myLog = c.log.filter((e) => e.y === sim.year);
    const cupLog = myLog.filter((e) => e.t === 'C');
    let cupRound = cupLog.length ? Math.max.apply(null, cupLog.map((e) => e.info.round)) : -1;
    const cup = sim.cups[g.cc];
    const euroKey = sim.euroOf.get(idx) || null;
    const zones = sim.zones(gid);
    return {
      year: sim.year, gid, tier: g.tier, pos: row ? row.pos : 0, n: tb.length, pts: row ? row.pts : 0, row, champion: tb[0].idx,
      zone: zones[row ? row.pos : 0] || null,
      cupWon: cup && cup.w === idx, cupRound, cupR: cup ? cup.R : 0, cupWinner: cup ? cup.w : -1, euro: euroKey,
      euroWon: euroKey ? sim.euro[euroKey].w === idx : false,
      euroWinner: sim.euro.cl.w,
      played: myLog.length, wins: myLog.filter((e) => e.res === 'W').length,
    };
  };
  Career.endSeason = function () {
    const c = Career.cur, sim = c.sim;
    const sm = Career.seasonSummary();
    const wasTier = sm.tier;
    c.chist.push({ club: c.clubId, y: sm.year, cc: W.groups[sm.gid].cc, tier: sm.tier, lname: W.groups[sm.gid].lname, pos: sm.pos, pts: sm.pts, champ: sm.pos === 1, cup: sm.cupWon, euro: sm.euro, euroWon: sm.euroWon, cupRound: sm.cupRound, cupR: sm.cupR });
    const rep = c.m ? FCK.Mgr.endOfSeason(c, sm) : null;
    const prep = c.pro ? FCK.Pro.endOfSeason(c, sm) : null;
    const out = sim.endSeason();
    const g2 = W.groups[sim.gid[c.idx]];
    sm.moved = g2.tier < wasTier ? 'up' : g2.tier > wasTier ? 'down' : null;
    sm.newTier = g2.tier;
    sm.summary = out;
    sm.rep = rep;
    if (c.m) sm.rep = FCK.Mgr.beginSeason(c, sm);
    if (prep) { sm.pro = FCK.Pro.beginSeason(c, prep); }
    if (rep) sm.rep.sacked = rep.sacked;
    if (rep) sm.rep.offers = rep.offers;
    if (rep) sm.rep.ev = rep.ev;
    c.log = c.log.filter((e) => e.y >= sim.year - 1); // keep last season only
    if (sm.champ || sm.pos === 1) Career.news({ k: 'news.champion', v: { lname: W.groups[sm.gid].lname, season: Career.seasonLabel(sm.year) } });
    if (sm.moved === 'up') Career.news({ k: 'news.promoted', v: { lname: g2.lname } });
    if (sm.moved === 'down') Career.news({ k: 'news.relegated', v: { lname: g2.lname } });
    Career.news({ k: 'news.newseason', v: { season: Career.seasonLabel(sim.year), lname: g2.lname } });
    Career.autosave();
    return sm;
  };

  // ---------- persistence ----------
  Career.pack = function () {
    const c = Career.cur;
    return { type: 'career', v: 1, name: c.name, clubId: c.clubId, formation: c.formation, style: c.style, preset: c.preset, level: c.level, halfMins: c.halfMins, log: c.log, chist: c.chist, news: c.news, created: c.created, custom: c.custom || null, pro: c.pro || null, sim: c.sim.pack(), m: c.m ? FCK.Mgr.pack(c) : null };
  };
  Career.unpack = function (o) {
    W.build();
    if (!o || o.type !== 'career' || !o.sim) return null;
    Career.restoreCustom();
    const club = W.byId[o.clubId]; if (!club || !club.world) return null;
    if (o.custom && !Career.applyCustom(o.custom)) return null;
    const sim = FCK.Sim.unpack(o.sim);
    sim.userIdx = club.idx;
    const c = { v: 1, name: o.name, clubId: o.clubId, idx: club.idx, sim, created: o.created, formation: o.formation || '4-3-3', style: o.style || 'balanced', preset: o.preset || 'p1', level: o.level || 'pro', halfMins: o.halfMins || 4, log: o.log || [], chist: o.chist || [], news: o.news || [], slot: -1, custom: o.custom || null };
    Career.cur = c;
    if (o.pro) { c.pro = o.pro; FCK.Pro.attach(c); } else if (o.m) FCK.Mgr.unpack(c, o.m); else FCK.Mgr.ensure(c);
    return c;
  };
  Career.switchClub = function (idx) {
    const c = Career.cur; if (!c) return;
    if (c.custom) { c.custom = null; Career.restoreCustom(); }
    FCK.Mgr.switchClub(c, idx);
    Career.news({ k: 'mn.newjob', v: { club: W.clubs[idx].name } });
    Career.autosave();
  };
  // pro career: the player joins another club
  Career.moveTo = function (c, idx) {
    if (c.custom) { c.custom = null; Career.restoreCustom(); }
    c.idx = idx; c.clubId = W.clubs[idx].id; c.sim.userIdx = idx;
    c.formation = FCK.Pro.formationFor(c);
    W.clearSquadCache();
  };
  Career.autosave = function () {
    if (!Career.cur) return false;
    const ok = U.store.set(Career.cur.pro ? 'pauto' : 'cauto', Career.pack());
    if (!ok) { if (FCK.UI && FCK.UI.toast) FCK.UI.toast(FCK.T('career.nospace')); }
    return ok;
  };
  Career.loadAuto = function (kind) { const o = U.store.get(kind === 'pro' ? 'pauto' : 'cauto', null); return o ? Career.unpack(o) : null; };
  Career.autoInfo = function (kind) {
    // light-weight peek without unpacking the whole simulation
    const o = U.store.get(kind === 'pro' ? 'pauto' : 'cauto', null);
    if (!o || !o.sim) return null;
    const club = Career.displayClub(o.clubId, o.custom); if (!club) return null;
    return { name: o.name, club, year: o.sim.year, pro: o.pro || null };
  };
  Career.slotList = function () { const a = U.store.get('cslots', []); const out = []; for (let i = 0; i < Career.SLOTS; i++) out.push(a[i] || null); return out; };
  Career.saveSlot = function (i, name) {
    const c = Career.cur; if (!c) return false;
    const a = Career.slotList();
    a[i] = { name: name || c.name, date: Date.now(), club: c.clubId, year: c.sim.year, custom: c.custom || null, data: Career.pack() };
    return U.store.set('cslots', a);
  };
  Career.loadSlot = function (i) { const s = Career.slotList()[i]; return s ? Career.unpack(s.data) : null; };
  Career.deleteSlot = function (i) { const a = Career.slotList(); a[i] = null; U.store.set('cslots', a); };
  Career.exportText = function () { return 'FCKC1:' + btoa(unescape(encodeURIComponent(JSON.stringify(Career.pack())))); };
  Career.importText = function (txt) {
    try {
      txt = (txt || '').trim();
      if (!txt.startsWith('FCKC1:')) return null;
      return Career.unpack(JSON.parse(decodeURIComponent(escape(atob(txt.slice(6))))));
    } catch (e) { return null; }
  };
})((globalThis.FCK = globalThis.FCK || {}));
