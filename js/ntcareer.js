/* FCK - ntcareer.js : national team career. The player takes over any nation and plays the World Cups (even cycles: 2026, 2030, ...) and
   the European Championships (2028, 2032, ...) one after the other. Qualification (a roll based on strength), a goal per tournament and
   the confidence of the federation decide how long the career lasts. Tournaments themselves run on the Tourney engine. */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const Tn = FCK.Tourney;
  const NT = {};
  FCK.NTCareer = NT;
  NT.VERSION = 1;
  const clamp = U.clamp;

  NT.S = null;
  NT.load = function () { const d = U.store.get('ntc', null); NT.S = d && d.v === NT.VERSION && FCK.NATION_BY_ID[d.nat] ? d : null; return NT.S; };
  NT.save = function () { if (NT.S) U.store.set('ntc', NT.S); };
  NT.clear = function () { NT.S = null; U.store.del('ntc'); };

  // the kind of the tournament in a given year: World Cup in years 2026, 2030, ...; European Championship in 2028, 2032, ...
  // nations outside Europe play their continental championship instead of the Euros ('cont', simulated)
  NT.kindOf = (year, nat) => (((year - 2026) / 2) % 2 === 0 ? 'wm48' : nat && FCK.NATION_BY_ID[nat] && FCK.NATION_BY_ID[nat].conf !== 'UEFA' ? 'cont' : 'em24');
  // strength rank of a nation in the field it plays for (World Cup: all nations, Euros: UEFA only)
  NT.rank = function (nat, kind) {
    const n = FCK.NATION_BY_ID[nat];
    const pool = FCK.NATIONS.filter((x) => (kind === 'em24' ? x.conf === 'UEFA' : kind === 'cont' ? x.conf === n.conf : true)).sort((a, b) => b.r - a.r);
    const i = pool.findIndex((x) => x.id === nat);
    return i < 0 ? 99 : i + 1;
  };
  // goal set by the federation: the order of the places is 'out' < 'G' < 'R32' < 'R16' < 'QF' < 'SF' < 'F' < 'W'
  const ORDER = ['out', 'G', 'R32', 'R16', 'QF', 'SF', 'F', 'W'];
  NT.goalFor = function (nat, kind) {
    const r = NT.rank(nat, kind), em = kind === 'em24';
    if (kind === 'cont') return r <= 2 ? 'SF' : r <= 5 ? 'QF' : r <= 10 ? 'R16' : 'G';
    if (em) return r <= 2 ? 'SF' : r <= 6 ? 'QF' : r <= 14 ? 'R16' : 'G';
    return r <= 2 ? 'SF' : r <= 8 ? 'QF' : r <= 18 ? 'R16' : r <= 30 ? 'R32' : 'G';
  };
  NT.placeIndex = function (place) {
    if (place === 'W') return 7;
    if (!place) return 0;
    if (place === 'T3' || place === 'T4' || place === 'B') return 5; // played the semi-finals
    const i = ORDER.indexOf(place);
    return i < 0 ? 1 : i;
  };

  NT.start = function (o) {
    const nat = o.nat;
    if (!FCK.NATION_BY_ID[nat]) return null;
    NT.S = { v: NT.VERSION, nat, coach: String(o.coach || 'Trainer').trim().slice(0, 28) || 'Trainer', year: 2026, trust: 65, titles: 0, hist: [], seed: (Math.random() * 4294967295) >>> 0, fired: false, opts: { half: o.half || 3, level: o.level || 'pro', preset: o.preset || 'p1' } };
    NT.save();
    return NT.S;
  };
  NT.next = function () { const S = NT.S, kind = NT.kindOf(S.year, S.nat); return { year: S.year, kind, goal: NT.goalFor(S.nat, kind) }; };

  // creates the tournament of the current year (or reports that the nation did not qualify)
  NT.prepare = function () {
    const S = NT.S, kind = NT.kindOf(S.year, S.nat), seed = (S.seed + S.year * 7919) >>> 0;
    const rng = U.makeRng(seed ^ 0x9e3779b1);
    if (kind === 'cont') return { qualified: true, kind, auto: true, rec: NT.playContinental(rng) };
    const natural = Tn.create({ kind, me: null, seed });
    let qualified = natural.teams.includes(S.nat);
    let playoff = false;
    if (!qualified) { qualified = rng.next() < 0.1 + FCK.NATION_BY_ID[S.nat].r / 400; playoff = qualified; }
    if (!qualified) return { qualified: false, kind };
    const o = S.opts;
    const T = Tn.create({ kind, me: S.nat, seed, half: o.half, level: o.level, preset: o.preset, form: FCK.setup && FCK.setup.match ? FCK.setup.match.homeFormation : '4-3-3', style: 'balanced' });
    T.ntc = true; T.ntcYear = S.year; T.playoff = playoff;
    return { qualified: true, kind, S: T, playoff };
  };

  // result of a finished tournament -> confidence, history, next year
  NT.finish = function (T) {
    const S = NT.S;
    if (!S || !T || !T.done || T.ntcDone) return null;
    T.ntcDone = true;
    const kind = T.kind, goal = NT.goalFor(S.nat, kind);
    const place = T.champ === S.nat ? 'W' : T.out[S.nat] || 'G';
    const got = NT.placeIndex(place), want = ORDER.indexOf(goal);
    const ok = got >= want;
    const delta = got > want ? 14 : got === want ? 8 : -7 - (want - got) * 3;
    S.trust = clamp(S.trust + delta, 0, 100);
    if (place === 'W') S.titles++;
    const rec = { y: S.year, kind, place, goal, ok, trust: S.trust };
    S.hist.unshift(rec);
    S.year += 2;
    if (S.trust <= 0) S.fired = true;
    NT.save(); Tn.archive(T);
    return rec;
  };
  // continental championship (Copa America, Africa Cup, ...): simulated with noisy strengths, the nation's place is booked like a tournament result
  NT.playContinental = function (rng) {
    const S = NT.S, kind = 'cont', me = FCK.NATION_BY_ID[S.nat];
    const pool = FCK.NATIONS.filter((x) => x.conf === me.conf).map((x) => ({ id: x.id, v: x.r + rng.gauss() * 7 })).sort((a, b) => b.v - a.v);
    const pos = pool.findIndex((x) => x.id === S.nat) + 1;
    const place = pos === 1 ? 'W' : pos === 2 ? 'F' : pos <= 4 ? 'SF' : pos <= 8 ? 'QF' : pos <= 14 ? 'R16' : 'G';
    const goal = NT.goalFor(S.nat, kind), got = NT.placeIndex(place), want = ORDER.indexOf(goal), ok = got >= want;
    S.trust = clamp(S.trust + (got > want ? 12 : got === want ? 6 : -10 - (want - got) * 3), 0, 100);
    if (place === 'W') S.titles++;
    const rec = { y: S.year, kind, place, goal, ok, trust: S.trust, champ: pool[0].id };
    S.hist.unshift(rec); S.year += 2; if (S.trust <= 0) S.fired = true; NT.save();
    return rec;
  };
  NT.skip = function () { // did not qualify
    const S = NT.S, kind = NT.kindOf(S.year, S.nat);
    S.trust = clamp(S.trust - 30, 0, 100);
    S.hist.unshift({ y: S.year, kind, place: 'DNQ', goal: NT.goalFor(S.nat, kind), ok: false, trust: S.trust });
    S.year += 2;
    if (S.trust <= 0) S.fired = true;
    NT.save();
  };
})((globalThis.FCK = globalThis.FCK || {}));
