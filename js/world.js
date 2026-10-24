/* FCK - world.js : the football world (countries, leagues, clubs) built from FCK.WORLD_DATA */
(function (FCK) {
  'use strict';
  const U = FCK.U;

  const World = {
    ready: false, countries: [], byCc: {}, clubs: [], byId: {}, groups: [], extras: [], version: 1,
  };
  FCK.World = World;

  // ---------- helpers ----------
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  World.hash = hash;
  const STOP = new Set(['fc', 'cf', 'ac', 'afc', 'sc', 'ssc', 'as', 'sl', 'fk', 'sk', 'de', 'di', 'da', 'the', 'sv', 'club', 'calcio', 'cd', 'ud', 'ca', 'sd', 'rc', 'bk', 'if', 'ik', '1']);
  function toks(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((t) => t && !STOP.has(t));
  }
  function sameClub(a, b) {
    const A = toks(a), B = toks(b);
    if (!A.length || !B.length) return false;
    const sa = new Set(A), sb = new Set(B);
    const subset = (x, y) => { for (const t of x) if (!y.has(t)) return false; return true; };
    if (sa.size <= sb.size ? subset(sa, sb) : subset(sb, sa)) return Math.min(sa.size, sb.size) >= 1 && (Math.min(sa.size, sb.size) >= 2 || [...sa][0].length >= 5 || [...sb][0].length >= 5);
    return false;
  }

  // match strength: world rating r (10..96) -> player overall used by the match engine
  World.matchOvr = (r) => Math.round(U.clamp(46 + (r - 26) * 0.65, 36, 93));

  const PAL = [
    ['#d4162a', '#ffffff'], ['#0b3a8f', '#ffffff'], ['#0f8a3c', '#ffffff'], ['#ffd800', '#111111'], ['#6a1b9a', '#ffffff'], ['#f57c00', '#111111'],
    ['#00897b', '#ffffff'], ['#c62828', '#111111'], ['#1565c0', '#ffd800'], ['#111111', '#e53935'], ['#ffffff', '#1a237e'], ['#8d1b3d', '#f3d37a'],
    ['#2e7d32', '#ffeb3b'], ['#37474f', '#ffffff'], ['#039be5', '#ffffff'], ['#ad1457', '#ffffff'], ['#ef6c00', '#ffffff'], ['#283593', '#ff7043'],
  ];
  const KITS = ['solid', 'solid', 'solid', 'stripesV', 'stripesV', 'hoops', 'halves', 'band', 'sash', 'sleeves'];
  const SHAPES = ['round', 'shield', 'shield', 'diamond'];
  const PATTERNS = ['plain', 'plain', 'halves', 'stripesV', 'chevron', 'bend', 'cross'];
  const EMBLEMS = ['star', 'ball', 'bolt', 'crown', 'ring', 'tower', 'leaf'];

  function identity(name, colors) {
    const rng = U.makeRng(hash(name));
    let p, s;
    if (colors && colors[0]) { p = colors[0]; s = colors[1]; }
    if (!p) { const c = rng.pick(PAL); p = c[0]; s = c[1]; }
    if (!s) s = FCK.color.lum(p) > 0.5 ? '#14213d' : '#ffffff';
    let t = FCK.color.lum(p) > 0.55 ? '#14213d' : '#ffffff';
    if (FCK.color.cdist(t, s) < 80) t = rng.pick(['#ffd400', '#111111', '#f5f5f5']);
    const kit = rng.pick(KITS);
    return {
      colors: { p, s, t }, kit,
      crest: { shape: rng.pick(SHAPES), pattern: rng.pick(PATTERNS), emblem: rng.pick(EMBLEMS) },
    };
  }

  // ---------- build ----------
  World.build = function () {
    if (World.ready) return World;
    const data = (FCK.WORLD_DATA && FCK.WORLD_DATA.countries) || [];
    const hand = FCK.TEAMS.slice();
    FCK.HAND_TEAMS = hand;
    const usedHand = new Set();
    let idx = 0;
    data.forEach((c) => {
      const co = {
        cc: c.cc, name: c.name, nameEn: c.nameEn, flag: c.flag, names: c.names, uefa: !!c.uefa, cup: c.cup, leagues: [], clubIdx: [], rank: 99, strength: 0,
      };
      World.countries.push(co); World.byCc[c.cc] = co;
      c.leagues.slice().sort((a, b) => a.tier - b.tier).forEach((l) => {
        const lg = { tier: l.tier, name: l.name, rounds: l.rounds || 2, relegate: l.relegate || 0, gids: [], cc: c.cc };
        co.leagues.push(lg);
        l.groups.forEach((g, gi) => {
          const gr = { gid: World.groups.length, cc: c.cc, tier: l.tier, lname: l.name, gname: g.name || null, rounds: lg.rounds, size: g.clubs.length, relegate: lg.relegate, init: [] };
          World.groups.push(gr); lg.gids.push(gr.gid);
          g.clubs.forEach((d) => {
            const club = {
              idx, id: 'w' + idx, name: d.n, short: (d.s || d.n.slice(0, 3)).toUpperCase().slice(0, 3), cc: c.names, country: c.cc,
              league: c.name, lname: l.name, tier: l.tier, gid: gr.gid, r: d.r, rating: World.matchOvr(d.r), stadium: d.st || (d.n + ' Stadion'), cap: d.cap || Math.round(U.clamp(1200 + d.r * d.r * 8, 1500, 70000) / 100) * 100, world: true,
            };
            // use a hand-made club's identity when it is the same club
            const hm = hand.find((t) => !usedHand.has(t.id) && sameCountry(t, c) && sameClub(t.name, d.n));
            if (hm) {
              usedHand.add(hm.id);
              club.id = hm.id; club.colors = hm.colors; club.kit = hm.kit; club.crest = hm.crest; club.name = hm.name.length <= d.n.length + 8 ? hm.name : d.n; club.hand = true;
              if (!d.st) { club.stadium = hm.stadium; club.cap = hm.cap; }
            } else {
              Object.assign(club, identity(d.n, d.c));
            }
            World.clubs.push(club); World.byId[club.id] = club;
            co.clubIdx.push(idx); gr.init.push(idx);
            idx++;
          });
        });
      });
    });
    // clubs of the hand-made list that are not part of any league (fun teams, South America...)
    hand.forEach((t) => {
      if (usedHand.has(t.id)) return;
      const e = Object.assign({}, t, { world: false, extra: true, idx: -1, r: Math.round(26 + (t.rating - 46) / 0.65), country: 'x', tier: 0, lname: t.league });
      World.extras.push(e); World.byId[e.id] = e;
    });
    World.rankCountries(World.clubs.map((c) => c.r), null);
    World.loadCustom();
    // friendly pool: everything
    FCK.TEAMS = World.clubs.concat(World.extras);
    FCK.teamById = (id) => World.byId[id] || FCK.TEAMS[0];
    World.ready = true;
    return World;
  };
  function sameCountry(t, c) {
    const L = (t.league || '').toLowerCase();
    return L === (c.name || '').toLowerCase() || L === (c.nameEn || '').toLowerCase();
  }

  // rank countries by the mean strength of their best clubs (ratings array indexed by club idx)
  World.rankCountries = function (rArr, gidArr) {
    const by = {};
    World.clubs.forEach((c) => {
      const g = World.groups[gidArr ? gidArr[c.idx] : c.gid];
      if (g.tier === 1) (by[g.cc] = by[g.cc] || []).push(rArr[c.idx]);
    });
    World.countries.forEach((co) => {
      const v = (by[co.cc] || []).sort((x, y) => y - x).slice(0, 8);
      co.strength = v.length ? v.reduce((x, y) => x + y, 0) / v.length : 0;
      co.rank = 99;
    });
    const uefa = World.countries.filter((c) => c.uefa).sort((x, y) => y.strength - x.strength);
    uefa.forEach((c, i) => { c.rank = i + 1; });
    World.uefaOrder = uefa.map((c) => c.cc);
  };

  // ---------- squads ----------
  const sqCache = new Map();
  World.custom = {}; // imported players: clubId -> [{name,pos,ovr,age,nat}]
  World.clearSquadCache = function () { sqCache.clear(); };
  World.loadCustom = function () { World.custom = U.store.get('players', {}) || {}; sqCache.clear(); };
  World.setCustom = function (obj) { World.custom = obj; U.store.set('players', obj); sqCache.clear(); };
  World.squad = function (club, seed) {
    const key = club.id + '|' + seed;
    let s = sqCache.get(key);
    if (!s) {
      if (sqCache.size > 400) sqCache.clear();
      const sd = hash(club.id) ^ (seed >>> 0);
      const rec = club.recs || (World.edited && World.edited[club.id]) || World.custom[club.id];
      s = rec && rec.length ? FCK.makeCustomSquad(club, rec, sd) : FCK.makeFullSquad(club, sd);
      sqCache.set(key, s);
    }
    return s;
  };
  // fuzzy club lookup by name (for imports)
  World.findClub = function (name) {
    const n = (name || '').trim(); if (!n) return null;
    const exact = World.clubs.find((c) => c.name.toLowerCase() === n.toLowerCase() || c.id === n);
    if (exact) return exact;
    if (n.length <= 4) { const sh = World.clubs.filter((c) => c.short.toLowerCase() === n.toLowerCase()); if (sh.length === 1) return sh[0]; }
    return World.clubs.find((c) => sameClub(c.name, n)) || null;
  };

  World.countryName = (cc) => {
    const co = World.byCc[cc];
    if (!co) return cc;
    return FCK.settings && FCK.settings.lang === 'en' ? co.nameEn : co.name;
  };
})((globalThis.FCK = globalThis.FCK || {}));
