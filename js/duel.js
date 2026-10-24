/* FCK - duel.js : "online" duels without a server. A challenge code carries a whole team; the friend plays against it and sends back a result code. */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;

  const Du = { D: null, VERSION: 1 };
  FCK.Duel = Du;
  const hash = (s) => W.hash(String(s));
  const ATTR = ['pac', 'sho', 'pas', 'dri', 'def', 'phy', 'gk'];
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------------------------------------------------------------- storage
  Du.fresh = () => ({ v: Du.VERSION, name: '', open: {}, hist: [], rids: {}, src: null, opt: { half: 3, level: 'pro', ko: true, preset: 'p1' }, last: null });
  Du.load = function () {
    const d = U.store.get('duel', null);
    Du.D = d && d.v === Du.VERSION ? Object.assign(Du.fresh(), d) : Du.fresh();
    Du.D.opt = Object.assign(Du.fresh().opt, Du.D.opt);
    return Du.D;
  };
  Du.save = function () { if (Du.D) U.store.set('duel', Du.D); };
  Du.reset = function () { Du.D = Du.fresh(); Du.save(); };
  Du.playerName = () => (Du.D && Du.D.name) || (FCK.settings && FCK.settings.lang === 'en' ? 'Player' : 'Spieler');

  // ---------------------------------------------------------------- codes
  const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const unb64 = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));
  Du.encode = function (o) {
    const body = Object.assign({}, o); delete body.ck;
    body.ck = hash(JSON.stringify(body) + 'fck').toString(36);
    return 'FCKD1:' + b64(body);
  };
  // returns the decoded object, or null when the text is not a valid duel code
  Du.parse = function (txt) {
    try {
      txt = String(txt || '').replace(/\s+/g, '');
      if (!txt.startsWith('FCKD1:')) return null;
      const o = unb64(txt.slice(6));
      const ck = o.ck; delete o.ck;
      if (!ck || ck !== hash(JSON.stringify(o) + 'fck').toString(36)) return null;
      if (o.v !== Du.VERSION || (o.t !== 'C' && o.t !== 'R')) return null;
      o.ck = ck;
      return o;
    } catch (e) { return null; }
  };

  // ---------------------------------------------------------------- teams
  // a "source" is { club, squad:{lineup,bench}, form, style }
  Du.sourceFromClub = function (club, form) {
    form = form || '4-3-3';
    return { club, squad: FCK.pickSquad(W.squad(club, 1), form), form, style: 'balanced' };
  };
  Du.sourceFromCards = function () {
    const Cs = FCK.Cards;
    if (!Cs) return null;
    Cs.ensure();
    const S = Cs.S;
    if (!S || !S.cards || S.cards.length < 11) return null;
    const cfg = Cs.buildCfg(S, 'friendly', W.clubs[0]);
    return { club: cfg.clubs[0], squad: cfg.squads[0], form: cfg.settings.homeFormation, style: cfg.settings.homeStyle };
  };
  Du.teamRating = (sq) => Math.round(sq.lineup.reduce((a, p) => a + p.ovr, 0) / sq.lineup.length);
  const packPlayer = (p) => ({ n: p.name, p: p.pos, o: p.ovr, g: p.nat, u: p.num, a: ATTR.map((k) => p.a[k]) });
  Du.packTeam = function (src) {
    const c = src.club;
    return {
      n: c.name, s: c.short, c: [c.colors.p, c.colors.s, c.colors.t], k: c.kit, cr: [c.crest.shape, c.crest.pattern, c.crest.emblem], st: c.stadium, cap: c.cap, pt: c.pitch || null,
      r: Du.teamRating(src.squad), f: src.form, y: src.style, sq: src.squad.lineup.map(packPlayer), bn: src.squad.bench.map(packPlayer),
    };
  };
  Du.unpackTeam = function (t, tag) {
    const id = 'd' + hash(tag + t.n + t.c.join('')).toString(36);
    const club = {
      id, name: String(t.n).slice(0, 24), short: String(t.s || 'FCK').slice(0, 3), cc: 'de', country: 'x', tier: 0, league: 'Duell', lname: 'Duell', idx: -1,
      colors: { p: t.c[0], s: t.c[1], t: t.c[2] }, kit: t.k, crest: { shape: t.cr[0], pattern: t.cr[1], emblem: t.cr[2] }, rating: t.r, r: Math.round(26 + (t.r - 46) / 0.65),
      stadium: String(t.st || 'Arena').slice(0, 28), cap: U.clamp(+t.cap || 20000, 1000, 100000), world: false, duel: true,
    };
    if (t.pt) club.pitch = t.pt;
    const mk = (d, num) => {
      const rng = U.makeRng(hash(d.n + d.g));
      const p = FCK.makePlayer({ cc: d.g, pure: true }, d.p, U.clamp(d.o, 25, 99), d.u || num, rng, { name: d.n, nat: d.g });
      if (Array.isArray(d.a)) ATTR.forEach((k, i) => { if (typeof d.a[i] === 'number') p.a[k] = U.clamp(Math.round(d.a[i]), 20, 99); });
      p.age = 25; p.pos0 = d.p;
      return p;
    };
    return { club, squad: { lineup: t.sq.map((d, i) => mk(d, i + 1)), bench: t.bn.map((d, i) => mk(d, 12 + i)) }, form: t.f, style: t.y };
  };
  Du.validTeam = function (t) {
    try {
      return t && Array.isArray(t.sq) && t.sq.length === 11 && Array.isArray(t.bn) && t.bn.length >= 0 && t.bn.length <= 9 && Array.isArray(t.c) && t.c.length === 3 && Array.isArray(t.cr) && t.cr.length === 3
        && FCK.FORMATIONS[t.f] && t.sq.every((d) => typeof d.n === 'string' && FCK.ROLE_OF[d.p] && d.o >= 20 && d.o <= 99);
    } catch (e) { return false; }
  };

  // ---------------------------------------------------------------- challenge
  Du.makeChallenge = function (src, opt) {
    const D = Du.D;
    const id = Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    const rng = U.makeRng(hash(id));
    const ch = {
      v: Du.VERSION, t: 'C', id, from: Du.playerName(), ts: Date.now(), team: Du.packTeam(src),
      set: { h: opt.half, wx: opt.weather || rng.pick(['clear', 'clear', 'cloudy', 'rain', 'snow']), td: opt.tod || rng.pick(['day', 'evening', 'night']), k: opt.ko !== false },
    };
    const code = Du.encode(ch);
    D.open[id] = { id, ts: ch.ts, team: src.club.name, short: src.club.short, colors: src.club.colors, crest: src.club.crest, kit: src.club.kit, r: ch.team.r };
    // keep the list short
    const ids = Object.keys(D.open).sort((a, b) => D.open[b].ts - D.open[a].ts);
    ids.slice(12).forEach((k) => { delete D.open[k]; });
    Du.save();
    return { ch, code };
  };

  // build the match config for accepting a challenge with my own source
  Du.acceptConfig = function (ch, mine, opt) {
    const rid = Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    const theirs = Du.unpackTeam(ch.team, ch.id);
    const lv = FCK.LEVELS[opt.level] ? opt.level : 'pro';
    const kids = FCK.settings.profile === 'kids';
    const settings = Object.assign({}, FCK.DEFAULT_MATCH, FCK.LEVELS[lv], {
      level: lv, halfMins: U.clamp(ch.set.h || 3, 1, 10), weather: ch.set.wx, tod: ch.set.td, knockout: !!ch.set.k,
      homeFormation: mine.form, awayFormation: theirs.form, homeStyle: mine.style, awayStyle: theirs.style,
    });
    if (kids) { settings.injuries = false; if (settings.referee === 'normal') settings.referee = 'lenient'; }
    const slots = FCK.presetSlots(opt.preset || 'p1').filter((s) => s.dev && s.dev !== 'none').map((s) => ({ dev: s.dev, team: s.team }));
    const myClub = Object.assign({}, mine.club, { stadium: theirs.club.stadium, cap: theirs.club.cap, pitch: theirs.club.pitch });
    if (!myClub.pitch) delete myClub.pitch;
    return { clubs: [myClub, theirs.club], settings, slots, squads: [mine.squad, theirs.squad], duel: { id: ch.id, rid, from: ch.from, theirTeam: ch.team.n, myTeam: mine.club.name, lv } };
  };

  // called from the game when a duel match is over: builds the result code the friend needs
  Du.onResult = function (m) {
    const ctx = m.duelCtx, D = Du.D;
    if (!ctx || !m.result) return null;
    const res = m.result;
    const me = Du.playerName();
    // score is ordered [challenger, accepter]
    const ro = {
      v: Du.VERSION, t: 'R', id: ctx.id, rid: ctx.rid, c: ctx.from, a: me, tc: ctx.theirTeam, ta: ctx.myTeam, sc: [res.score[1], res.score[0]],
      pn: res.pens ? [res.pens[1], res.pens[0]] : null, lv: ctx.lv, h: m.set.halfMins, ts: Date.now(),
    };
    const code = Du.encode(ro);
    D.hist.unshift({ rid: ctx.rid, id: ctx.id, ts: ro.ts, role: 'A', opp: ctx.from, tm: ctx.myTeam, ot: ctx.theirTeam, gf: res.score[0], ga: res.score[1], pens: res.pens ? res.pens.slice() : null, code });
    D.hist = D.hist.slice(0, 60);
    D.last = { rid: ctx.rid, code };
    Du.save();
    return { code, ro };
  };

  // the challenger enters the friend's result code
  Du.enterResult = function (ro) {
    const D = Du.D;
    if (!ro || ro.t !== 'R') return { ok: false, err: 'bad' };
    if (D.rids[ro.rid]) return { ok: false, err: 'dup' };
    if (!D.open[ro.id]) return { ok: false, err: 'unknown' };
    D.rids[ro.rid] = 1;
    D.hist.unshift({ rid: ro.rid, id: ro.id, ts: ro.ts, role: 'C', opp: ro.a, tm: ro.tc, ot: ro.ta, gf: ro.sc[0], ga: ro.sc[1], pens: ro.pn ? ro.pn.slice() : null });
    D.hist = D.hist.slice(0, 60);
    Du.save();
    return { ok: true, entry: D.hist[0] };
  };
  Du.outcome = function (e) {
    if (e.gf !== e.ga) return e.gf > e.ga ? 'W' : 'L';
    if (e.pens && e.pens[0] !== e.pens[1]) return e.pens[0] > e.pens[1] ? 'W' : 'L';
    return 'D';
  };
  // head-to-head table per friend (by name)
  Du.balance = function () {
    const by = {};
    Du.D.hist.forEach((e) => {
      const k = (e.opp || '?').toLowerCase();
      const r = by[k] || (by[k] = { name: e.opp, w: 0, d: 0, l: 0, gf: 0, ga: 0 });
      const o = Du.outcome(e);
      r[o === 'W' ? 'w' : o === 'D' ? 'd' : 'l']++; r.gf += e.gf; r.ga += e.ga;
    });
    return Object.keys(by).map((k) => by[k]).sort((a, b) => (b.w + b.d + b.l) - (a.w + a.d + a.l));
  };
})((globalThis.FCK = globalThis.FCK || {}));
