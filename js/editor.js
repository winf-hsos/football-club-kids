/* FCK - editor.js : own clubs, edited squads and stadiums (data + logic; screens are in editorui.js) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;

  const Ed = { data: null, VERSION: 1 };
  FCK.Editor = Ed;

  Ed.KITS = ['solid', 'stripesV', 'hoops', 'halves', 'band', 'sash', 'sleeves'];
  Ed.SHAPES = ['round', 'shield', 'diamond'];
  Ed.PATTERNS = ['plain', 'halves', 'stripesV', 'chevron', 'bend', 'cross'];
  Ed.EMBLEMS = ['star', 'ball', 'bolt', 'crown', 'ring', 'tower', 'leaf'];
  Ed.GRASS = ['stripes', 'wide', 'checks', 'diag', 'plain'];
  Ed.SEATS = ['dark', 'club'];
  Ed.COLORS = ['#d4162a', '#ff6a00', '#ffc400', '#ffe94d', '#7bd13a', '#0f8a3c', '#00897b', '#2ec4e6', '#1565c0', '#0b2a6f', '#6a1b9a', '#d81b8a', '#8d1b3d', '#795548', '#9aa4b2', '#2b2f3a', '#111111', '#f4f4f4'];
  Ed.POS = ['GK', 'LB', 'CB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LAM', 'RAM', 'LW', 'RW', 'ST'];
  Ed.GROUPS = ['de', 'en', 'es', 'it', 'fr', 'nl', 'pt', 'tr', 'us', 'sl', 'sc', 'ar', 'af', 'ja', 'ko', 'ir', 'gr', 'pl', 'ru', 'hu', 'ro', 'he', 'ca', 'cn', 'in', 'sea', 'po'];
  Ed.MAX_CLUBS = 40;

  const hash = (s) => W.hash(String(s));
  Ed.empty = () => ({ v: Ed.VERSION, clubs: [], over: {}, pl: {} });

  // ---------------------------------------------------------------- helpers
  const clone = (o) => JSON.parse(JSON.stringify(o));
  Ed.rateOf = function (recs) {
    const top = recs.map((r) => r.ovr).sort((a, b) => b - a).slice(0, 14);
    if (!top.length) return 60;
    return Math.round(top.reduce((a, b) => a + b, 0) / top.length);
  };
  const rOf = (rating) => Math.round(26 + (rating - 46) / 0.65);
  Ed.strengthToOvr = (r) => W.matchOvr(r);

  Ed.autoShort = function (name) {
    const w = (name || '').replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
    let s = '';
    if (w.length >= 3) s = w.slice(0, 3).map((x) => x[0]).join('');
    else if (w.length === 2) s = (w[0][0] + w[1].slice(0, 2));
    else if (w.length === 1) s = w[0].slice(0, 3);
    return (s || 'FCK').toUpperCase().slice(0, 3);
  };
  Ed.trimColor = function (p, s) {
    let t = FCK.color.lum(p) > 0.55 ? '#14213d' : '#ffffff';
    if (FCK.color.cdist(t, s) < 80) t = '#ffd400';
    return t;
  };

  // squad records [{name,pos,ovr,nat,age}] in the 24-slot order of makeFullSquad
  Ed.recsFrom = function (players) {
    return players.map((p) => ({ name: p.name, pos: p.pos0 || p.pos, ovr: Math.round(p.ovr), nat: p.nat, age: p.age || 24 }));
  };
  Ed.genRecs = function (group, r, seed) {
    const tmp = { id: 'tmp', cc: group, pure: true, rating: W.matchOvr(r) };
    return Ed.recsFrom(FCK.makeFullSquad(tmp, seed >>> 0));
  };
  // squad records of any club (own, real or national team)
  Ed.getRecs = function (club) {
    const D = Ed.data;
    if (D.pl[club.id]) return clone(D.pl[club.id]);
    if (club.recs) return clone(club.recs);
    return Ed.recsFrom(W.squad(club, 1));
  };
  Ed.setRecs = function (club, recs) {
    const D = Ed.data;
    recs = recs.map((r) => ({ name: String(r.name || '?').slice(0, 24), pos: r.pos, ovr: U.clamp(Math.round(+r.ovr || 50), 25, 99), nat: r.nat, age: r.age || 24 }));
    if (club.custom) {
      const rec = D.clubs.find((c) => c.id === club.id);
      if (rec) rec.recs = recs;
      club.recs = recs; club.rating = Ed.rateOf(recs); club.r = rOf(club.rating);
    } else D.pl[club.id] = recs;
    W.clearSquadCache(); Ed.save();
  };
  Ed.resetRecs = function (club) {
    if (club.custom) return;
    delete Ed.data.pl[club.id]; W.clearSquadCache(); Ed.save();
  };
  Ed.hasEditedSquad = (id) => !!Ed.data.pl[id];

  // ---------------------------------------------------------------- own clubs
  Ed.newClub = function (o) {
    o = o || {};
    const D = Ed.data;
    if (D.clubs.length >= Ed.MAX_CLUBS) return null;
    const id = 'e' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    const rng = U.makeRng(hash(id));
    const base = o.base || null;
    const p = o.p || rng.pick(Ed.COLORS.slice(0, 14)), s = o.s || (FCK.color.lum(p) > 0.5 ? '#14213d' : '#f4f4f4');
    const group = o.group || (base ? base.cc : 'de');
    const name = (o.name || (base ? base.name + ' 2' : 'FC Neustadt')).slice(0, 24);
    const rec = {
      id, name, short: (o.short || Ed.autoShort(name)).slice(0, 3).toUpperCase(), cc: group,
      colors: { p, s, t: Ed.trimColor(p, s) }, kit: o.kit || rng.pick(Ed.KITS), crest: { shape: rng.pick(Ed.SHAPES), pattern: rng.pick(Ed.PATTERNS), emblem: rng.pick(Ed.EMBLEMS) },
      stadium: (base && o.copyStadium !== false ? base.stadium : name + ' Arena').slice(0, 28), cap: base ? base.cap : 18000,
      pitch: { grass: 'stripes', ad: '', seat: 'dark' }, recs: [],
    };
    if (base) { rec.colors = clone(base.colors); rec.kit = base.kit; rec.crest = clone(base.crest); if (base.pitch) rec.pitch = clone(base.pitch); }
    rec.recs = base ? Ed.getRecs(base) : Ed.genRecs(group, o.r || 60, hash(id));
    if (base && o.r) { const off = o.r - rOf(Ed.rateOf(rec.recs)); rec.recs.forEach((r) => { r.ovr = U.clamp(r.ovr + Math.round(off * 0.65), 25, 97); }); }
    D.clubs.push(rec);
    Ed.save(); Ed.register();
    return W.byId[id];
  };
  Ed.dupClub = function (club) {
    const rec = Ed.data.clubs.find((c) => c.id === club.id);
    if (!rec || Ed.data.clubs.length >= Ed.MAX_CLUBS) return null;
    const id = 'e' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    const c2 = clone(rec); c2.id = id; c2.name = (rec.name + ' II').slice(0, 24);
    Ed.data.clubs.push(c2); Ed.save(); Ed.register();
    return W.byId[id];
  };
  Ed.deleteClub = function (id) {
    const D = Ed.data;
    D.clubs = D.clubs.filter((c) => c.id !== id);
    delete D.pl[id];
    Ed.save(); Ed.register();
    if (FCK.setup) { if (FCK.setup.home === id) FCK.setup.home = 'fcb'; if (FCK.setup.away === id) FCK.setup.away = 'mci'; FCK.saveSetup && FCK.saveSetup(); }
  };
  // edit fields of an own club or (as an override) of a real club
  Ed.patch = function (club, patch) {
    const D = Ed.data;
    if (club.custom) {
      const rec = D.clubs.find((c) => c.id === club.id);
      if (!rec) return;
      Object.assign(rec, clone(patch));
      Ed.apply(club, rec);
    } else {
      const ov = D.over[club.id] = Object.assign(D.over[club.id] || {}, clone(patch));
      Ed.apply(club, ov);
    }
    Ed.save();
  };
  Ed.apply = function (club, src) {
    ['name', 'short', 'colors', 'kit', 'crest', 'stadium', 'cap', 'pitch', 'cc'].forEach((k) => {
      if (src[k] !== undefined) club[k] = clone(src[k]);
    });
    if (club.custom) { club.recs = src.recs || club.recs; club.rating = Ed.rateOf(club.recs); club.r = rOf(club.rating); }
  };
  Ed.isOver = (id) => !!Ed.data.over[id];
  Ed.clearOver = function (club) {
    const D = Ed.data;
    delete D.over[club.id];
    if (club._orig) { ['name', 'short', 'colors', 'kit', 'crest', 'stadium', 'cap', 'cc'].forEach((k) => { club[k] = clone(club._orig[k]); }); if (club._orig.pitch) club.pitch = clone(club._orig.pitch); else delete club.pitch; }
    Ed.save();
  };

  // ---------------------------------------------------------------- registration in the football world
  Ed.register = function () {
    const D = Ed.data;
    const T = FCK.T ? FCK.T : (k) => k;
    const lg = FCK.I18N ? T('ed.league') : 'Eigene Vereine';
    // remove old custom clubs
    W.extras = W.extras.filter((c) => !c.custom);
    Object.keys(W.byId).forEach((id) => { if (W.byId[id] && W.byId[id].custom) delete W.byId[id]; });
    D.clubs.forEach((rec) => {
      const club = Object.assign(clone(rec), { world: true, custom: true, extra: true, idx: -1, country: 'x', tier: 0, league: lg, lname: lg });
      club.rating = Ed.rateOf(club.recs); club.r = rOf(club.rating);
      W.extras.push(club); W.byId[club.id] = club;
    });
    // overrides of real clubs
    Object.keys(D.over).forEach((id) => {
      const club = W.byId[id];
      if (!club) return;
      if (!club._orig) club._orig = clone({ name: club.name, short: club.short, colors: club.colors, kit: club.kit, crest: club.crest, stadium: club.stadium, cap: club.cap, cc: club.cc, pitch: club.pitch || null });
      Ed.apply(club, D.over[id]);
    });
    W.edited = D.pl;
    W.clearSquadCache();
    FCK.TEAMS = W.clubs.concat(W.extras);
    if (FCK.Career && FCK.Career.reapplyCustom) FCK.Career.reapplyCustom();
  };

  // ---------------------------------------------------------------- storage
  Ed.save = function () { U.store.set('editor', Ed.data); };
  Ed.valid = (o) => !!o && o.v === Ed.VERSION && Array.isArray(o.clubs) && o.over && typeof o.over === 'object' && o.pl && typeof o.pl === 'object';
  Ed.load = function () {
    const d = U.store.get('editor', null);
    Ed.data = Ed.valid(d) ? d : Ed.empty();
    Ed.register();
  };
  Ed.install = function (d) { Ed.data = Ed.valid(d) ? clone(d) : Ed.empty(); Ed.save(); Ed.register(); };
  Ed.count = () => Ed.data.clubs.length + Object.keys(Ed.data.over).length + Object.keys(Ed.data.pl).length;
  Ed.exportText = () => 'FCKE1:' + btoa(unescape(encodeURIComponent(JSON.stringify(Ed.data))));
  Ed.importText = function (txt, merge) {
    try {
      txt = (txt || '').trim();
      if (!txt.startsWith('FCKE1:')) return false;
      const o = JSON.parse(decodeURIComponent(escape(atob(txt.slice(6)))));
      if (!Ed.valid(o)) return false;
      if (merge) {
        const D = Ed.data;
        o.clubs.forEach((c) => { if (!D.clubs.find((x) => x.id === c.id) && D.clubs.length < Ed.MAX_CLUBS) D.clubs.push(c); });
        Object.assign(D.over, o.over); Object.assign(D.pl, o.pl);
        Ed.save(); Ed.register();
      } else Ed.install(o);
      return true;
    } catch (e) { return false; }
  };
  Ed.reset = function () {
    Object.keys(Ed.data.over).forEach((id) => { const c = W.byId[id]; if (c) Ed.clearOver(c); });
    Ed.install(Ed.empty());
    if (FCK.setup) { ['home', 'away'].forEach((k) => { if (!W.byId[FCK.setup[k]]) FCK.setup[k] = k === 'home' ? 'fcb' : 'mci'; }); FCK.saveSetup && FCK.saveSetup(); }
  };

  // ---------------------------------------------------------------- stadium preview
  Ed.drawStadium = function (cv, club) {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, st = club.pitch || {};
    g.fillStyle = '#1a2233'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) {
      const o = 8 + i * 5;
      g.fillStyle = i % 2 ? '#18202f' : '#1d2638'; g.fillRect(o, o, w - o * 2, h - o * 2);
      if (st.seat === 'club') { g.globalAlpha = i % 2 ? 0.32 : 0.2; g.fillStyle = club.colors.p; g.fillRect(o, o, w - o * 2, h - o * 2); g.globalAlpha = 1; }
    }
    const x0 = w * 0.14, pw = w * 0.72, ph = pw / 1.544, y0 = (h - ph) / 2;
    g.fillStyle = '#244d2c'; g.fillRect(x0 - 8, y0 - 8, pw + 16, ph + 16);
    const gr = ['#2f8f46', '#2a8040'];
    const gs = st.grass || 'stripes';
    const nS = gs === 'wide' ? 8 : 14;
    if (gs === 'plain') { g.fillStyle = gr[0]; g.fillRect(x0, y0, pw, ph); } else if (gs === 'checks') {
      const nY = 8;
      for (let i = 0; i < nS; i++) for (let j = 0; j < nY; j++) { g.fillStyle = gr[(i + j) % 2]; g.fillRect(x0 + (i * pw) / nS, y0 + (j * ph) / nY, pw / nS + 1, ph / nY + 1); }
    } else if (gs === 'diag') {
      g.fillStyle = gr[0]; g.fillRect(x0, y0, pw, ph);
      g.save(); g.beginPath(); g.rect(x0, y0, pw, ph); g.clip(); g.fillStyle = gr[1];
      for (let i = -6; i < 22; i++) { const xx = x0 + (i * pw) / 17.5; g.beginPath(); g.moveTo(xx, y0); g.lineTo(xx + pw / 35, y0); g.lineTo(xx + pw / 35 - ph * 0.6, y0 + ph); g.lineTo(xx - ph * 0.6, y0 + ph); g.closePath(); g.fill(); }
      g.restore();
    } else for (let i = 0; i < nS; i++) { g.fillStyle = gr[i % 2]; g.fillRect(x0 + (i * pw) / nS, y0, pw / nS + 1, ph); }
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.5;
    g.strokeRect(x0, y0, pw, ph);
    g.beginPath(); g.moveTo(x0 + pw / 2, y0); g.lineTo(x0 + pw / 2, y0 + ph); g.stroke();
    g.beginPath(); g.arc(x0 + pw / 2, y0 + ph / 2, ph * 0.135, 0, 7); g.stroke();
    g.strokeRect(x0, y0 + ph * 0.2, pw * 0.157, ph * 0.6); g.strokeRect(x0 + pw * 0.843, y0 + ph * 0.2, pw * 0.157, ph * 0.6);
    // ad boards
    g.font = '700 9px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ad = st.ad || 'FCK';
    for (let i = 0; i < 4; i++) {
      const ax = x0 + (i * pw) / 4;
      g.fillStyle = '#0a0e17'; g.fillRect(ax + 1, y0 - 8, pw / 4 - 2, 7); g.fillRect(ax + 1, y0 + ph + 1, pw / 4 - 2, 7);
      g.fillStyle = ['#ff4d6d', '#ffd24d', '#2dff8f', '#3de0ff'][i]; g.font = '700 6px sans-serif';
      g.fillText(i % 2 ? 'GOAL!' : ad, ax + pw / 8, y0 - 4.5); g.fillText(i % 2 ? ad : 'FAIR PLAY', ax + pw / 8, y0 + ph + 4.5);
    }
  };

  // ---------------------------------------------------------------- duplicate-id guard for other modules
  Ed.isCustom = (id) => !!(W.byId[id] && W.byId[id].custom);
})((globalThis.FCK = globalThis.FCK || {}));
