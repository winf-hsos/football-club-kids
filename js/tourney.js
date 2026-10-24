/* FCK - tourney.js : World Cup / Euro style tournaments with national teams (data + simulation; screens are in tourneyui.js) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;

  const Tn = { S: null, VERSION: 1 };
  FCK.Tourney = Tn;

  // groups, advancing teams, best third-placed teams and the knockout rounds of each format.
  // quotas = places per confederation (own simplified model, not the real qualification rules)
  Tn.FORMATS = {
    wm48: { key: 'wm48', cup: 'wm', n: 48, groups: 12, adv: 2, thirds: 8, third: true, quotas: { UEFA: 16, CAF: 9, AFC: 8, CONMEBOL: 6, CONCACAF: 6, OFC: 1 } },
    wm32: { key: 'wm32', cup: 'wm', n: 32, groups: 8, adv: 2, thirds: 0, third: true, quotas: { UEFA: 13, CAF: 5, AFC: 5, CONMEBOL: 5, CONCACAF: 3, OFC: 1 } },
    em24: { key: 'em24', cup: 'em', n: 24, groups: 6, adv: 2, thirds: 4, third: false, quotas: { UEFA: 24 } },
  };
  Tn.KIND_KEYS = ['wm48', 'wm32', 'em24'];
  const LETTERS = 'ABCDEFGHIJKL';
  const KO_KEYS = { 32: 'R32', 16: 'R16', 8: 'QF', 4: 'SF', 2: 'F' };
  Tn.letter = (i) => LETTERS[i];

  const hash = (s) => W.hash(String(s));
  function poisson(rng, l) {
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= rng.next(); } while (p > L && k < 12);
    return k - 1;
  }
  // goal weights per squad slot of the 24-man squad (same layout as World.squad)
  const SW = [0, 0, 0, 0.02, 0.01, 0.035, 0.03, 0.01, 0.005, 0.02, 0.01, 0.035, 0.015, 0.06, 0.045, 0.02, 0.1, 0.09, 0.09, 0.12, 0.12, 0.2, 0.11, 0.05];
  const SWT = SW.reduce((a, b) => a + b, 0);
  function scorerIdx(rng) {
    let r = rng.next() * SWT;
    for (let i = 0; i < SW.length; i++) { r -= SW[i]; if (r <= 0) return i; }
    return 21;
  }
  const rngFor = (S, tag) => U.makeRng(hash(S.seed + ':' + tag));

  // ---------------------------------------------------------------- national team club objects
  const clubs = {};
  Tn.clubId = (nid) => 'n_' + nid.toLowerCase();
  Tn.nationClub = function (nid) {
    let c = clubs[nid];
    const nat = FCK.NATION_BY_ID[nid];
    if (!nat) return null;
    const en = FCK.settings && FCK.settings.lang === 'en';
    if (!c) {
      const rng = U.makeRng(hash('nat' + nid));
      const t = FCK.color.lum(nat.p) > 0.55 ? '#14213d' : '#ffffff';
      c = {
        id: Tn.clubId(nid), nid, name: nat.de, short: nid, cc: nat.g, country: 'x', tier: 0, league: 'Nationalteams', lname: 'Nationalteams', idx: -1,
        colors: { p: nat.p, s: nat.s, t: FCK.color.cdist(t, nat.s) < 80 ? '#ffd400' : t }, kit: nat.kit,
        crest: { shape: rng.pick(['round', 'shield', 'round']), pattern: rng.pick(['plain', 'halves', 'stripesV', 'chevron', 'plain']), emblem: rng.pick(['star', 'ball', 'crown', 'leaf', 'star']) },
        r: nat.r, rating: W.matchOvr(nat.r), stadium: 'Nationalstadion', cap: 45000 + Math.round(nat.r) * 300, world: true, extra: true, nation: true, pure: true, flag: nat.flag, conf: nat.conf,
      };
      clubs[nid] = c; W.byId[c.id] = c;
    }
    c.name = en ? nat.en : nat.de;
    c.league = en ? 'National teams' : 'Nationalteams'; c.lname = c.league;
    return c;
  };
  Tn.refreshNames = function () { FCK.NATIONS.forEach((n) => Tn.nationClub(n.id)); };
  // make all national teams available as friendly-match teams too
  Tn.register = function () {
    FCK.NATIONS.forEach((n) => {
      const c = Tn.nationClub(n.id);
      if (!W.extras.includes(c)) W.extras.push(c);
    });
    FCK.TEAMS = W.clubs.concat(W.extras);
  };
  Tn.natName = (nid) => { const n = FCK.NATION_BY_ID[nid]; return FCK.settings && FCK.settings.lang === 'en' ? n.en : n.de; };
  Tn.nat = (nid) => FCK.NATION_BY_ID[nid];
  // strength of a national team including edits made in the editor (rating from the edited squad)
  Tn.strength = function (nid) {
    const c = Tn.nationClub(nid);
    const rec = W.edited && W.edited[c.id];
    if (rec && rec.length) {
      const top = rec.map((r) => r.ovr).sort((a, b) => b - a).slice(0, 14);
      const ovr = top.reduce((a, b) => a + b, 0) / top.length;
      return Math.round(26 + (ovr - 46) / 0.65);
    }
    return c.r;
  };

  // ---------------------------------------------------------------- creating a tournament
  function selectField(fmt, me, rng) {
    const by = {};
    FCK.NATIONS.forEach((n) => { (by[n.conf] = by[n.conf] || []).push(n); });
    const noise = {};
    FCK.NATIONS.forEach((n) => { noise[n.id] = n.r + rng.gauss() * 3.5; });
    const chosen = [];
    Object.keys(fmt.quotas).forEach((cf) => {
      const list = (by[cf] || []).slice().sort((a, b) => noise[b.id] - noise[a.id]);
      list.slice(0, fmt.quotas[cf]).forEach((n) => chosen.push(n.id));
    });
    // fill up with the best remaining teams (only for formats whose quotas do not add up)
    if (fmt.cup === 'wm') {
      const rest = FCK.NATIONS.filter((n) => !chosen.includes(n.id)).sort((a, b) => noise[b.id] - noise[a.id]);
      while (chosen.length < fmt.n && rest.length) chosen.push(rest.shift().id);
    }
    // the chosen team always takes part (replaces the weakest team of its confederation / of the field)
    if (me && !chosen.includes(me)) {
      const cf = FCK.NATION_BY_ID[me].conf;
      let worst = null;
      chosen.forEach((id) => { if (FCK.NATION_BY_ID[id].conf === cf && (!worst || noise[id] < noise[worst])) worst = id; });
      if (!worst) chosen.forEach((id) => { if (!worst || noise[id] < noise[worst]) worst = id; });
      chosen[chosen.indexOf(worst)] = me;
    }
    return chosen;
  }
  function drawGroups(fmt, ids, rng) {
    const sorted = ids.slice().sort((a, b) => FCK.NATION_BY_ID[b].r - FCK.NATION_BY_ID[a].r);
    const G = fmt.groups, size = ids.length / G;
    const conf = (id) => FCK.NATION_BY_ID[id].conf;
    for (let attempt = 0; attempt < 400; attempt++) {
      const groups = Array.from({ length: G }, () => []);
      let ok = true;
      for (let pot = 0; pot < size && ok; pot++) {
        const teams = sorted.slice(pot * G, pot * G + G);
        rng.shuffle(teams);
        // assign pot teams to groups, keep the confederation rule (max 1, UEFA max 2)
        const free = Array.from({ length: G }, (_, i) => i);
        for (const t of teams) {
          const cand = free.filter((gi) => {
            const n = groups[gi].filter((x) => conf(x) === conf(t)).length;
            return conf(t) === 'UEFA' ? n < (fmt.cup === 'em' ? 9 : 2) : n < 1;
          });
          if (!cand.length) { ok = false; break; }
          const gi = cand[rng.int(0, cand.length - 1)];
          groups[gi].push(t); free.splice(free.indexOf(gi), 1);
        }
      }
      if (ok) return groups;
    }
    // fallback: plain snake draw
    const groups = Array.from({ length: G }, () => []);
    sorted.forEach((t, i) => { const row = Math.floor(i / G), col = i % G; groups[row % 2 ? G - 1 - col : col].push(t); });
    return groups;
  }

  Tn.create = function (o) {
    o = o || {};
    const fmt = Tn.FORMATS[o.kind] || Tn.FORMATS.wm48;
    const seed = (o.seed != null ? o.seed : Math.floor(Math.random() * 4294967295)) >>> 0;
    const rng = U.makeRng(hash('tn' + seed));
    const me = o.me && FCK.NATION_BY_ID[o.me] ? o.me : null;
    // the field of the editor-changed team strengths is read at creation
    const ids = selectField(fmt, me, rng);
    const groups = drawGroups(fmt, ids, rng);
    const S = {
      v: Tn.VERSION, kind: fmt.key, seed, me, form: o.form || '4-3-3', style: o.style || 'balanced', half: o.half || 3, level: o.level || 'pro', preset: o.preset || 'p1',
      teams: ids, r: {}, groups, rounds: [], ri: 0, out: {}, sc: {}, done: false, champ: null, host: ids[rng.int(0, ids.length - 1)], created: Date.now(),
    };
    ids.forEach((id) => { S.r[id] = Tn.strength(id); });
    // three group rounds
    const MD = [[[0, 1], [2, 3]], [[0, 2], [3, 1]], [[3, 0], [1, 2]]];
    MD.forEach((pairs, md) => {
      const fx = [];
      groups.forEach((g, gi) => pairs.forEach((p) => fx.push({ a: g[p[0]], b: g[p[1]], g: gi, done: false })));
      S.rounds.push({ type: 'group', key: 'G' + (md + 1), n: md + 1, fx });
    });
    return S;
  };

  // ---------------------------------------------------------------- tables
  Tn.table = function (S, gi) {
    const rows = {};
    S.groups[gi].forEach((id) => { rows[id] = { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });
    S.rounds.filter((r) => r.type === 'group').forEach((R) => R.fx.forEach((f) => {
      if (f.g !== gi || !f.done) return;
      const A = rows[f.a], B = rows[f.b];
      A.p++; B.p++; A.gf += f.ga; A.ga += f.gb; B.gf += f.gb; B.ga += f.ga;
      if (f.ga > f.gb) { A.w++; B.l++; A.pts += 3; } else if (f.ga < f.gb) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
    }));
    const list = Object.keys(rows).map((k) => { const r = rows[k]; r.gd = r.gf - r.ga; return r; });
    // tie-breakers: points, goal difference, goals, head-to-head points among the tied teams, draw of lots
    const h2h = (ids) => {
      const pts = {}; ids.forEach((i) => { pts[i] = 0; });
      S.rounds.filter((r) => r.type === 'group').forEach((R) => R.fx.forEach((f) => {
        if (f.g !== gi || !f.done || !ids.includes(f.a) || !ids.includes(f.b)) return;
        if (f.ga > f.gb) pts[f.a] += 3; else if (f.ga < f.gb) pts[f.b] += 3; else { pts[f.a]++; pts[f.b]++; }
      }));
      return pts;
    };
    list.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
    for (let i = 0; i < list.length;) {
      let j = i + 1;
      while (j < list.length && list[j].pts === list[i].pts && list[j].gd === list[i].gd && list[j].gf === list[i].gf) j++;
      if (j - i > 1) {
        const ids = list.slice(i, j).map((r) => r.id), hp = h2h(ids);
        const part = list.slice(i, j).sort((x, y) => hp[y.id] - hp[x.id] || hash(S.seed + x.id) - hash(S.seed + y.id));
        for (let k = 0; k < part.length; k++) list[i + k] = part[k];
      }
      i = j;
    }
    list.forEach((r, i) => { r.pos = i + 1; });
    return list;
  };
  Tn.groupsDone = (S) => S.rounds.filter((r) => r.type === 'group').every((r) => r.fx.every((f) => f.done));

  // ---------------------------------------------------------------- simulating single matches
  function penWinner(S, rng, a, b) {
    const d = S.r[a] - S.r[b];
    const winA = rng.next() < U.clamp(0.5 + d * 0.0025, 0.38, 0.62);
    const lose = rng.int(2, 4), win = lose + (rng.chance(0.55) ? 1 : 2);
    return winA ? [win, lose] : [lose, win];
  }
  function addScorer(S, id, name, n) {
    const k = id + '|' + name;
    const e = S.sc[k] || (S.sc[k] = { id, n: name, g: 0 });
    e.g += n || 1;
  }
  function squadOf(id) { return W.squad(Tn.nationClub(id), 1); }
  function simGoals(S, rng, id, n) {
    if (n <= 0) return;
    const sq = squadOf(id);
    for (let i = 0; i < n; i++) { const p = sq[scorerIdx(rng)] || sq[21]; addScorer(S, id, p.name); }
  }
  Tn.simFixture = function (S, f, R) {
    const rng = rngFor(S, R.key + ':' + f.a + ':' + f.b);
    const d = S.r[f.a] - S.r[f.b];
    let ga = Math.min(poisson(rng, 1.25 * Math.exp(0.028 * d)), 9), gb = Math.min(poisson(rng, 1.25 * Math.exp(-0.028 * d)), 9);
    simGoals(S, rng, f.a, ga); simGoals(S, rng, f.b, gb);
    f.et = false; f.pens = null;
    if (R.type === 'ko' && ga === gb) {
      f.et = true;
      const ea = poisson(rng, 0.38 * Math.exp(0.028 * d)), eb = poisson(rng, 0.38 * Math.exp(-0.028 * d));
      simGoals(S, rng, f.a, ea); simGoals(S, rng, f.b, eb);
      ga += ea; gb += eb;
      if (ga === gb) f.pens = penWinner(S, rng, f.a, f.b);
    }
    f.ga = ga; f.gb = gb; f.done = true;
    return f;
  };
  Tn.winnerOf = function (f) {
    if (f.ga !== f.gb) return f.ga > f.gb ? f.a : f.b;
    if (f.pens) return f.pens[0] > f.pens[1] ? f.a : f.b;
    return null;
  };

  // ---------------------------------------------------------------- knockout bracket
  function bracketOrder(n) {
    let o = [1, 2];
    while (o.length < n) { const m = o.length * 2 + 1; const next = []; o.forEach((s) => { next.push(s, m - s); }); o = next; }
    return o;
  }
  function buildFirstKo(S) {
    const fmt = Tn.FORMATS[S.kind];
    const tabs = S.groups.map((g, gi) => Tn.table(S, gi));
    const q = [];
    tabs.forEach((t, gi) => { for (let i = 0; i < fmt.adv; i++) q.push(Object.assign({ gi }, t[i])); });
    if (fmt.thirds) {
      const th = tabs.map((t, gi) => Object.assign({ gi }, t[fmt.adv]));
      th.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || hash(S.seed + x.id) - hash(S.seed + y.id));
      th.slice(0, fmt.thirds).forEach((t) => q.push(t));
    }
    const inKo = new Set(q.map((t) => t.id));
    S.teams.forEach((id) => { if (!inKo.has(id)) S.out[id] = 'G'; });
    // seeds: group winners first, then runners-up, then thirds
    q.sort((x, y) => x.pos - y.pos || y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || hash(S.seed + x.id) - hash(S.seed + y.id));
    const N = q.length;
    const order = bracketOrder(N);
    const slots = order.map((s) => q[s - 1]);
    // avoid first-round pairs from the same group by swapping the lower seed with a neighbouring pair
    const bad = (i) => slots[2 * i].gi === slots[2 * i + 1].gi;
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      for (let i = 0; i < N / 2; i++) {
        if (!bad(i)) continue;
        for (let k = 1; k < N / 2; k++) {
          const j = (i + k) % (N / 2);
          const a = 2 * i + 1, b = 2 * j + 1;
          const t = slots[a]; slots[a] = slots[b]; slots[b] = t;
          if (!bad(i) && !bad(j)) { changed = true; break; }
          const t2 = slots[a]; slots[a] = slots[b]; slots[b] = t2;
        }
      }
      if (!changed) break;
    }
    const fx = [];
    for (let i = 0; i < N / 2; i++) fx.push({ a: slots[2 * i].id, b: slots[2 * i + 1].id, ko: true, done: false });
    S.rounds.push({ type: 'ko', key: KO_KEYS[N], fx });
  }
  function buildNextKo(S, R) {
    const fx = [];
    const main = R.fx.filter((f) => !f.bronze);
    if (R.key === 'SF') {
      fx.push({ a: Tn.winnerOf(main[0]), b: Tn.winnerOf(main[1]), ko: true, done: false });
      if (Tn.FORMATS[S.kind].third) fx.push({ a: loserOf(main[0]), b: loserOf(main[1]), ko: true, bronze: true, done: false });
    } else for (let i = 0; i < main.length; i += 2) fx.push({ a: Tn.winnerOf(main[i]), b: Tn.winnerOf(main[i + 1]), ko: true, done: false });
    S.rounds.push({ type: 'ko', key: KO_KEYS[fx.filter((f) => !f.bronze).length * 2], fx });
  }
  function loserOf(f) { const w = Tn.winnerOf(f); return w === f.a ? f.b : f.a; }

  function closeRound(S) {
    const R = S.rounds[S.ri];
    if (!R.fx.every((f) => f.done)) return false;
    if (R.type === 'group') {
      if (R.n === 3) buildFirstKo(S);
    } else {
      R.fx.forEach((f) => { if (!f.bronze || R.key !== 'F') { const l = loserOf(f); S.out[l] = f.bronze ? 'B' : R.key; } });
      if (R.key === 'F') {
        const fin = R.fx.find((f) => !f.bronze), br = R.fx.find((f) => f.bronze);
        S.champ = Tn.winnerOf(fin); S.second = loserOf(fin);
        if (br) { S.third = Tn.winnerOf(br); S.fourth = loserOf(br); }
        S.out[S.champ] = 'W'; S.out[S.second] = 'F';
        if (br) { S.out[S.third] = 'T3'; S.out[S.fourth] = 'T4'; }
        S.done = true; S.ri = S.rounds.length - 1; S.closed = S.ri;
        return true;
      }
      buildNextKo(S, R);
    }
    S.closed = S.ri;
    S.ri++;
    return true;
  }

  // ---------------------------------------------------------------- flow
  // is the human player still in the tournament (or about to play the third-place match)?
  Tn.isIn = function (S) {
    if (!S.me || S.done) return false;
    const o = S.out[S.me];
    return !o || (o === 'SF' && Tn.FORMATS[S.kind].third);
  };
  Tn.myFixture = function (S) {
    if (!S.me || S.done) return null;
    const R = S.rounds[S.ri];
    if (!R) return null;
    return R.fx.find((f) => !f.done && (f.a === S.me || f.b === S.me)) || null;
  };
  Tn.round = (S) => S.rounds[S.ri];
  // simulate until the human player has to play; if the player is out (or only watching) one round at a time
  Tn.settle = function (S, opts) {
    opts = opts || {};
    let stepped = false, guard = 0;
    while (!S.done && guard++ < 40) {
      const R = S.rounds[S.ri];
      const mine = S.me ? R.fx.find((f) => !f.done && (f.a === S.me || f.b === S.me)) : null;
      if (mine) return stepped;
      if (stepped && !opts.all && !Tn.isIn(S)) return stepped;
      R.fx.forEach((f) => { if (!f.done) Tn.simFixture(S, f, R); });
      closeRound(S);
      stepped = true;
    }
    return stepped;
  };
  // the human player chooses to simulate his own match
  Tn.simMine = function (S) {
    const f = Tn.myFixture(S);
    if (!f) return null;
    Tn.simFixture(S, f, S.rounds[S.ri]);
    return f;
  };

  // ---------------------------------------------------------------- playing a match with the real engine
  const STYLES = ['balanced', 'attack', 'defend', 'counter', 'press'];
  const venues = ['Nationalstadion', 'Olympiastadion', 'Arena Nord', 'Arena Süd', 'Zentralstadion', 'Hafenstadion', 'Bergstadion', 'Küstenarena', 'Stadion der Einheit', 'Sonnenarena'];
  Tn.venue = function (S, f, R) {
    const hostN = Tn.natName(S.host);
    return { name: hostN + ' · ' + venues[hash(S.seed + R.key + f.a + f.b) % venues.length], cap: 38000 + (hash(f.a + f.b + S.seed) % 9) * 5000 };
  };
  Tn.matchConfig = function (S, f) {
    const R = S.rounds[S.ri];
    const fi = R.fx.indexOf(f);
    const opp = f.a === S.me ? f.b : f.a;
    const lv = FCK.LEVELS[S.level] ? S.level : 'pro';
    const rr = U.makeRng(hash(S.seed + 'o' + opp));
    const setup = {
      home: Tn.clubId(S.me), away: Tn.clubId(opp), slots: FCK.presetSlots(S.preset),
      match: Object.assign({}, FCK.DEFAULT_MATCH, FCK.LEVELS[lv], { level: lv, halfMins: S.half, knockout: !!f.ko, homeFormation: S.form, homeStyle: S.style, awayFormation: rr.pick(FCK.FORMATION_NAMES), awayStyle: rr.pick(STYLES.filter((s) => FCK.STYLE_KEYS.includes(s))) }),
    };
    const cfg = FCK.buildMatchConfig(setup);
    const v = Tn.venue(S, f, R);
    cfg.clubs = cfg.clubs.map((c) => Object.assign({}, c));
    cfg.clubs[0].stadium = v.name; cfg.clubs[0].cap = v.cap;
    cfg.tourney = { ri: S.ri, fi, me: S.me, opp, key: R.key };
    return cfg;
  };
  Tn.play = function (S) {
    const f = Tn.myFixture(S);
    if (!f) return false;
    FCK.Audio.init();
    FCK.startMatch(Tn.matchConfig(S, f));
    return true;
  };
  // called from the game when a match started by the tournament is over
  Tn.onResult = function (m) {
    const ctx = m.tourneyCtx, S = Tn.S;
    if (!ctx || !S || !m.result) return null;
    const R = S.rounds[ctx.ri];
    const f = R && R.fx[ctx.fi];
    if (!f || f.done) return null;
    const res = m.result;
    const mine = res.score[0], theirs = res.score[1];
    const meIsA = f.a === ctx.me;
    f.ga = meIsA ? mine : theirs; f.gb = meIsA ? theirs : mine;
    f.et = !!(m.period >= 3); f.pens = res.pens ? (meIsA ? res.pens.slice() : [res.pens[1], res.pens[0]]) : null;
    f.mine = true; f.done = true;
    m.goals.forEach((g) => {
      if (g.og || !g.scorer) return;
      addScorer(S, g.team === 0 ? ctx.me : ctx.opp, g.scorer.name);
    });
    Tn.save();
    return f;
  };

  // ---------------------------------------------------------------- results & placement
  Tn.placeKey = function (S, id) { return S.out[id] || (S.done ? null : 'in'); };
  Tn.topScorers = function (S, n) {
    return Object.keys(S.sc).map((k) => S.sc[k]).sort((a, b) => b.g - a.g || a.n.localeCompare(b.n)).slice(0, n || 10);
  };
  Tn.matchCount = (S) => S.rounds.reduce((a, R) => a + R.fx.filter((f) => f.done).length, 0);
  Tn.totalMatches = (S) => { const f = Tn.FORMATS[S.kind]; const gm = f.groups * 6; const ko = (f.groups * f.adv + f.thirds) - 1 + (f.third ? 1 : 0); return gm + ko; };

  // ---------------------------------------------------------------- persistence
  Tn.save = function () { if (Tn.S) U.store.set('tourney', Tn.S); };
  Tn.valid = (o) => !!o && o.v === Tn.VERSION && Tn.FORMATS[o.kind] && Array.isArray(o.rounds) && Array.isArray(o.groups) && Array.isArray(o.teams);
  Tn.load = function () { const d = U.store.get('tourney', null); Tn.S = Tn.valid(d) ? d : null; return Tn.S; };
  Tn.install = function (S) { Tn.S = Tn.valid(S) ? S : null; Tn.save(); };
  Tn.clear = function () { Tn.S = null; U.store.del('tourney'); };
  Tn.history = () => U.store.get('tourney_hist', []);
  // store the result of a finished tournament once
  Tn.archive = function (S) {
    if (!S || !S.done || S.archived) return;
    S.archived = true;
    const hist = Tn.history();
    hist.unshift({ kind: S.kind, me: S.me, place: S.me ? S.out[S.me] : null, champ: S.champ, second: S.second, d: Date.now() });
    U.store.set('tourney_hist', hist.slice(0, 20));
    Tn.save();
  };
  Tn.exportText = (S) => 'FCKT1:' + btoa(unescape(encodeURIComponent(JSON.stringify(S || Tn.S))));
  Tn.importText = function (txt) {
    try {
      txt = (txt || '').trim();
      if (!txt.startsWith('FCKT1:')) return false;
      const o = JSON.parse(decodeURIComponent(escape(atob(txt.slice(6)))));
      if (!Tn.valid(o)) return false;
      Tn.install(o); return true;
    } catch (e) { return false; }
  };
})((globalThis.FCK = globalThis.FCK || {}));
