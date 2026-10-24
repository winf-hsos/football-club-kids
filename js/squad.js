/* FCK - squad.js : generated players (names are random mixes, not real people) */
(function (FCK) {
  'use strict';
  const U = FCK.U;

  function weightedPick(rng, weights) {
    let tot = 0;
    for (let i = 0; i < weights.length; i++) tot += weights[i];
    let r = rng.next() * tot;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return weights.length - 1;
  }

  function makeLook(rng, nat) {
    const skin = weightedPick(rng, FCK.SKIN_W[nat] || FCK.SKIN_W.en);
    const styleW = [30, 15, 8, 10, 5, 5, 3, 20];
    const style = FCK.HAIR_STYLES[weightedPick(rng, styleW)];
    let hair;
    if (skin >= 4) hair = rng.chance(0.9) ? 0 : 1;
    else hair = weightedPick(rng, [14, 12, 10, 8, 5, 3, 2, 1]);
    return {
      skin: FCK.SKIN[skin],
      hairStyle: style,
      hair: FCK.HAIR[hair],
      beard: style !== 'bald' || rng.chance(0.5) ? rng.chance(0.22) : false,
    };
  }

  const BIAS = {
    GK: { pac: -20, sho: -40, pas: -10, dri: -30, def: -20, phy: 0 },
    DF: { pac: -2, sho: -14, pas: -4, dri: -8, def: 6, phy: 4 },
    MF: { pac: 0, sho: -3, pas: 5, dri: 3, def: -3, phy: 0 },
    FW: { pac: 3, sho: 6, pas: -2, dri: 4, def: -20, phy: 0 },
  };
  const POS_BIAS = {
    LW: { pac: 5, dri: 3 }, RW: { pac: 5, dri: 3 }, LM: { pac: 4 }, RM: { pac: 4 },
    LB: { pac: 4 }, RB: { pac: 4 }, LWB: { pac: 5 }, RWB: { pac: 5 },
    CDM: { def: 6, sho: -4 }, CAM: { pas: 4, dri: 3, def: -6 }, CB: { def: 4, phy: 3 }, ST: { sho: 4 },
  };

  let uid = 1;
  function makePlayer(club, pos, ovr, num, rng, custom) {
    const role = FCK.ROLE_OF[pos];
    const nat = custom && custom.nat && FCK.NAMES[custom.nat] ? custom.nat : club.pure ? (rng.next(), club.cc) : FCK.pickNameGroup(club, rng, 0.6, 0.35);
    const pool = FCK.NAMES[nat] || FCK.NAMES.en;
    let first, last;
    if (custom) { const parts = custom.name.trim().split(/\s+/); last = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]; first = parts.length > 1 ? parts[0] : ''; } else { const dn = FCK.drawName(nat, rng); first = dn.first; last = dn.last; }
    const a = {};
    ['pac', 'sho', 'pas', 'dri', 'def', 'phy'].forEach((k) => {
      let v = ovr + BIAS[role][k] + ((POS_BIAS[pos] && POS_BIAS[pos][k]) || 0) + rng.gauss() * 4;
      a[k] = U.clamp(Math.round(v), 22, 97);
    });
    a.gk = role === 'GK' ? U.clamp(Math.round(ovr + rng.gauss() * 3), 40, 97) : 20;
    return {
      id: uid++,
      name: (first ? first + ' ' : '') + last,
      sname: first ? first[0] + '. ' + last : last,
      last,
      num,
      pos,
      role,
      ovr: Math.round(ovr),
      a,
      nat,
      look: makeLook(rng, nat),
    };
  }

  FCK.makePlayer = makePlayer;
  // no two players of one squad share a surname (deterministic re-draw)
  FCK.dedupeNames = function (list, seed) {
    const rng = U.makeRng(((seed >>> 0) ^ 0x51ed27) >>> 0);
    const seen = new Set();
    list.forEach((p) => {
      let tries = 0;
      while (seen.has(p.last) && tries++ < 12 && !p.real) {
        const dn = FCK.drawName(p.nat, rng);
        if (!dn.last) continue;
        p.last = dn.last; p.name = (dn.first ? dn.first + ' ' : '') + dn.last; p.sname = dn.first ? dn.first[0] + '. ' + dn.last : dn.last;
      }
      seen.add(p.last);
    });
    return list;
  };
  FCK.FULL_POS = ['GK', 'GK', 'GK', 'LB', 'LB', 'CB', 'CB', 'CB', 'CB', 'RB', 'RB', 'CDM', 'CDM', 'CM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST', 'ST'];
  // Returns { lineup:[11 in formation slot order], bench:[7] }
  FCK.makeSquad = function (club, formationName, rng) {
    const form = FCK.FORMATIONS[formationName] || FCK.FORMATIONS['4-4-2'];
    const lineup = form.map((slot, i) => {
      const ovr = club.rating + rng.gauss() * 3.2 + (slot.pos === 'GK' ? 0 : 0);
      return makePlayer(club, slot.pos, ovr, i + 1, rng);
    });
    const benchPos = ['GK', 'CB', 'LB', 'CM', 'CAM', 'ST', 'RW'];
    const bench = benchPos.map((pos, i) => makePlayer(club, pos, club.rating - 7 + rng.gauss() * 3, 12 + i, rng));
    FCK.dedupeNames(lineup.concat(bench), Math.floor(rng.next() * 4e9));
    return { lineup, bench };
  };


  // ---------- full squads (24 players) for the world / career ----------
  const FULL_POS = ['GK', 'GK', 'GK', 'LB', 'LB', 'CB', 'CB', 'CB', 'CB', 'RB', 'RB', 'CDM', 'CDM', 'CM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST', 'ST'];
  const FULL_NUM = [1, 13, 12, 3, 23, 4, 5, 15, 24, 2, 22, 6, 8, 14, 16, 10, 17, 11, 7, 18, 19, 9, 20, 21];
  // Deterministic: same club + seed -> same squad
  FCK.makeFullSquad = function (club, seed) {
    const rng = U.makeRng(seed >>> 0);
    const list = FULL_POS.map((pos, i) => {
      // first of each position group is a starter, later ones are weaker
      const seen = FULL_POS.slice(0, i).filter((x) => x === pos).length;
      const ovr = club.rating + rng.gauss() * 3.0 - seen * (pos === 'GK' ? 7 : 3.6) - (pos === 'GK' && seen === 0 ? 0 : 0);
      const p = makePlayer(club, pos, ovr, FULL_NUM[i], rng);
      p.sqi = i;
      p.age = rng.int(18, 36);
      return p;
    });
    FCK.dedupeNames(list, seed);
    return list;
  };
  // squad from imported records [{name,pos,ovr,age,nat}] -> 24 slots in the same layout as makeFullSquad
  FCK.makeCustomSquad = function (club, recs, seed) {
    const rng = U.makeRng(seed >>> 0);
    const gen = FCK.makeFullSquad(club, seed);
    const pool = recs.slice().sort((a, b) => b.ovr - a.ovr);
    const used = new Set();
    const pick = new Array(FULL_POS.length).fill(null);
    FULL_POS.forEach((pos, i) => { const r = pool.find((x) => !used.has(x) && x.pos === pos); if (r) { used.add(r); pick[i] = r; } });
    FULL_POS.forEach((pos, i) => {
      if (pick[i] || pos === 'GK') return;
      const r = pool.find((x) => !used.has(x) && FCK.ROLE_OF[x.pos] === FCK.ROLE_OF[pos] && x.pos !== 'GK');
      if (r) { used.add(r); pick[i] = r; }
    });
    return FULL_POS.map((pos, i) => {
      const r = pick[i];
      if (!r) return gen[i];
      const p = makePlayer(club, pos, r.ovr, FULL_NUM[i], rng, r);
      p.sqi = i; p.age = r.age || rng.int(19, 34); p.real = true; p.pos0 = pos;
      return p;
    });
  };
  const FIT = { // pairs counted as "close" positions
    LB: ['LWB', 'LM'], RB: ['RWB', 'RM'], LWB: ['LB', 'LM'], RWB: ['RB', 'RM'], CB: [], CDM: ['CM', 'CB'], CM: ['CDM', 'CAM'], CAM: ['CM', 'LAM', 'RAM', 'ST'],
    LM: ['LW', 'LAM', 'LWB'], RM: ['RW', 'RAM', 'RWB'], LAM: ['LM', 'LW', 'CAM'], RAM: ['RM', 'RW', 'CAM'], LW: ['LM', 'LAM', 'ST'], RW: ['RM', 'RAM', 'ST'], ST: ['LW', 'RW', 'CAM'], GK: [],
  };
  function fitCost(natural, slot) {
    if (natural === slot) return 0;
    if (FIT[slot] && FIT[slot].includes(natural)) return 3;
    return FCK.ROLE_OF[natural] === FCK.ROLE_OF[slot] ? 9 : 30;
  }
  // pick lineup + bench from a full squad for a formation; excluded = Set of sqi (injured, suspended)
  FCK.pickSquad = function (players, formationName, excluded, delta) {
    const form = FCK.FORMATIONS[formationName] || FCK.FORMATIONS['4-4-2'];
    const avail = players.filter((p) => !(excluded && excluded.has(p.sqi)));
    const used = new Set();
    const lineup = new Array(11);
    // fill slots with the scarcest positions first (GK, then by fewest candidates)
    const order = form.map((sl, i) => i).sort((a, b) => (form[a].pos === 'GK' ? -1 : 0) - (form[b].pos === 'GK' ? -1 : 0));
    order.forEach((i) => {
      const slot = form[i];
      let best = null, bs = -1e9;
      avail.forEach((p) => {
        if (used.has(p)) return;
        if (slot.pos === 'GK' !== (p.role === 'GK')) return;
        const sc = p.ovr - fitCost(p.pos0 || p.pos, slot.pos);
        if (sc > bs) { bs = sc; best = p; }
      });
      if (!best) best = avail.find((p) => !used.has(p)) || players[0];
      used.add(best);
      lineup[i] = clonePlayer(best, slot.pos, i + 1, delta);
    });
    const rest = avail.filter((p) => !used.has(p)).sort((a, b) => b.ovr - a.ovr);
    const bench = [];
    const gk = rest.find((p) => p.role === 'GK');
    if (gk) bench.push(gk);
    rest.forEach((p) => { if (bench.length < 7 && !bench.includes(p)) bench.push(p); });
    return { lineup, bench: bench.map((p, k) => clonePlayer(p, p.pos0 || p.pos, 12 + k, delta)) };
  };
  function clonePlayer(p, pos, num, delta) {
    const c = Object.assign({}, p);
    if (!p.pos0) { c.pos0 = p.pos; }
    c.num = p.num;
    c.pos = pos; c.role = FCK.ROLE_OF[pos];
    c.a = Object.assign({}, p.a);
    if (delta) { for (const k in c.a) { if (k !== 'gk' || c.role === 'GK') c.a[k] = U.clamp(Math.round(c.a[k] + delta), 22, 97); } c.ovr = Math.round(p.ovr + delta); }
    return c;
  }

  FCK.clonePlayer = clonePlayer;
  // Re-map the 11 players on the pitch to a new formation (by role, then by side)
  FCK.remapFormation = function (lineup, formationName) {
    const form = FCK.FORMATIONS[formationName];
    if (!form) return lineup;
    const rank = { GK: 0, DF: 1, MF: 2, FW: 3 };
    const gk = lineup.find((p) => p.role === 'GK') || lineup[0];
    const field = lineup.filter((p) => p !== gk);
    field.sort((a, b) => rank[a.role] - rank[b.role] || (a.slotFy || 0.5) - (b.slotFy || 0.5));
    const slots = form.map((s, i) => ({ s, i })).filter((o) => o.s.pos !== 'GK');
    slots.sort((a, b) => rank[FCK.ROLE_OF[a.s.pos]] - rank[FCK.ROLE_OF[b.s.pos]] || a.s.fy - b.s.fy);
    const out = new Array(11);
    out[0] = gk;
    slots.forEach((o, k) => { out[o.i] = field[k]; });
    out.forEach((p, i) => {
      p.pos = form[i].pos;
      p.role = FCK.ROLE_OF[form[i].pos];
      p.slotFy = form[i].fy;
    });
    return out;
  };
})((globalThis.FCK = globalThis.FCK || {}));
