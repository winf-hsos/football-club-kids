/* FCK - season.js : competition engine (leagues, cups, CL/EL/ECL), quick simulation, season rollover */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;

  const WEEKS = 48;
  const EW = { lp: [4, 7, 10, 13, 16, 19, 23, 26], po: [29, 30], r16: [33, 34], qf: [37, 38], sf: [41, 42], f: [46] };
  const CUPW = [47, 44, 40, 35, 31, 27, 24, 21, 18];
  const EURO = ['cl', 'el', 'ecl'];
  const HEX = '0123456789abcdef';
  const LP_ROUNDS = [2, 6, 11, 15, 19, 24, 28, 32];

  // ---------- quick match simulation ----------
  function poisson(rng, l) {
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= rng.next(); } while (p > L && k < 12);
    return k - 1;
  }
  function quick(rng, rh, ra, neutral) {
    const d = rh - ra + (neutral ? 0 : 4);
    return [Math.min(poisson(rng, 1.3 * Math.exp(0.022 * d)), 9), Math.min(poisson(rng, 1.05 * Math.exp(-0.022 * d)), 9)];
  }
  function penShootout(rng, ra, rb) {
    const pa = U.clamp(0.5 + (ra - rb) * 0.002, 0.4, 0.6);
    const winA = rng.next() < pa;
    const lose = rng.int(2, 4), win = lose + (rng.chance(0.55) ? 1 : 2);
    return winA ? [win, lose] : [lose, win];
  }

  // goals -> squad index (weights by position slot of the 24-man squad)
  const SW = [0, 0, 0, 0.02, 0.01, 0.035, 0.03, 0.01, 0.005, 0.02, 0.01, 0.035, 0.015, 0.06, 0.045, 0.02, 0.1, 0.09, 0.09, 0.12, 0.12, 0.2, 0.11, 0.05];
  const SWT = SW.reduce((a, b) => a + b, 0);
  function scorerIdx(rng) {
    let r = rng.next() * SWT;
    for (let i = 0; i < SW.length; i++) { r -= SW[i]; if (r <= 0) return i; }
    return 21;
  }

  // ---------- round robin ----------
  function roundRobin(ids, rounds) {
    const arr = ids.slice();
    if (arr.length % 2) arr.push(-1);
    const n = arr.length, out = [];
    for (let k = 0; k < n - 1; k++) {
      const md = [];
      for (let i = 0; i < n / 2; i++) {
        const a = i === 0 ? arr[0] : arr[((k + i - 1) % (n - 1)) + 1];
        const b = arr[((k + n - 1 - i - 1) % (n - 1)) + 1];
        if (a < 0 || b < 0) continue;
        md.push((k + i) % 2 === 0 ? [a, b] : [b, a]);
      }
      out.push(md);
    }
    const res = out.slice();
    if (rounds >= 2) out.forEach((md) => res.push(md.map((m) => [m[1], m[0]])));
    return res;
  }

  // ======================= League =======================
  class League {
    constructor(gid, clubs, seed, rounds) {
      this.gid = gid; this.clubs = clubs.slice(); this.seed = seed; this.rounds = rounds; this.md = 0; this.res = [];
      this.build();
    }
    build() {
      const rng = U.makeRng(this.seed);
      const ids = this.clubs.slice(); rng.shuffle(ids);
      this.sched = roundRobin(ids, this.rounds);
      this.M = this.sched.length;
    }
    weekOf(md) { return this.M <= 1 ? 20 : Math.round((md * (WEEKS - 1)) / (this.M - 1)); }
    table(upTo) {
      const rows = new Map();
      this.clubs.forEach((i) => rows.set(i, { idx: i, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
      const n = upTo === undefined ? this.res.length : upTo;
      for (let m = 0; m < n && m < this.res.length; m++) {
        const day = this.sched[m], rs = this.res[m];
        for (let k = 0; k < day.length; k++) {
          const h = rows.get(day[k][0]), a = rows.get(day[k][1]), r = rs[k];
          if (!r) continue;
          h.p++; a.p++; h.gf += r[0]; h.ga += r[1]; a.gf += r[1]; a.ga += r[0];
          if (r[0] > r[1]) { h.w++; a.l++; h.pts += 3; } else if (r[0] < r[1]) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
        }
      }
      const arr = Array.from(rows.values());
      arr.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.idx - y.idx);
      arr.forEach((r, i) => { r.pos = i + 1; });
      return arr;
    }
    pack() {
      let s = '';
      this.res.forEach((day) => day.forEach((r) => { s += HEX[Math.min(r[0], 15)] + HEX[Math.min(r[1], 15)]; }));
      return { g: this.gid, c: this.clubs, s: this.seed, r: this.rounds, m: this.md, x: s };
    }
    static unpack(o) {
      const l = new League(o.g, o.c, o.s, o.r);
      l.md = o.m; let p = 0;
      for (let m = 0; m < o.m; m++) {
        const day = l.sched[m], rs = [];
        for (let k = 0; k < day.length; k++) { rs.push([HEX.indexOf(o.x[p]), HEX.indexOf(o.x[p + 1])]); p += 2; }
        l.res.push(rs);
      }
      return l;
    }
  }

  // week of every round of a cup with R rounds: last four rounds are fixed, earlier ones are spread over autumn/winter
  const cupWeekCache = {};
  function cupWeeks(R) {
    if (cupWeekCache[R]) return cupWeekCache[R];
    const euro = new Set([].concat(EW.lp, EW.po, EW.r16, EW.qf, EW.sf, EW.f));
    const fixed = [35, 40, 44, 47]; // R16, QF, SF, F
    const out = [];
    const E = Math.max(0, R - 4);
    for (let i = 0; i < E; i++) {
      let w = E === 1 ? 24 : Math.round(2 + (i * 29) / (E - 1));
      while (euro.has(w) || (i > 0 && w <= out[i - 1])) w++;
      out.push(w);
    }
    const tail = fixed.slice(Math.max(0, 4 - R));
    const res = out.concat(tail);
    cupWeekCache[R] = res;
    return res;
  }

  // ======================= Cup =======================
  class Cup {
    constructor(cc, entrants, seed, rArr, tierOf) {
      this.cc = cc; this.e = entrants.slice(); this.seed = seed;
      const N = this.e.length;
      this.R = Math.max(1, Math.ceil(Math.log2(N)));
      this.rounds = []; this.cur = -1; this.pend = []; this.byes = []; this.w = -1;
      const half = Math.pow(2, this.R - 1);
      const n1 = N - half;
      if (N === 2) { this.first = 'direct'; }
      // first round: the weakest teams play, the strongest get byes
      const sorted = this.e.slice().sort((a, b) => (tierOf(b) - tierOf(a)) || (rArr[a] - rArr[b]));
      if (n1 > 0 && n1 < half) { this.pre = sorted.slice(0, 2 * n1); this.byes = sorted.slice(2 * n1); } else { this.pre = this.e.slice(); this.byes = []; }
      this.rng = U.makeRng(seed);
    }
    weekOf(r) { return cupWeeks(this.R)[r]; }
    draw(r, tierOf) {
      const pool = r === 0 ? this.pre.slice() : this.pend.slice().concat(r === 1 ? this.byes : []);
      this.pend = [];
      this.rng.shuffle(pool);
      const ties = [];
      for (let i = 0; i + 1 < pool.length; i += 2) {
        let a = pool[i], b = pool[i + 1];
        const ta = tierOf(a), tb = tierOf(b);
        if (ta > tb || (ta === tb && this.rng.chance(0.5))) { const t = a; a = b; b = t; } // lower-tier team hosts (a = home)
        ties.push([a, b, -1, -1, -1, -1, 0]); // a,b,ga,gb,pa,pb,et
      }
      this.rounds[r] = ties; this.cur = r;
      return ties;
    }
    winner(t) { return t[2] > t[3] ? t[0] : t[3] > t[2] ? t[1] : t[4] > t[5] ? t[0] : t[1]; }
    finishRound(r) {
      this.pend = this.rounds[r].map((t) => this.winner(t));
      if (this.pend.length === 1 && r === this.R - 1) this.w = this.pend[0];
    }
    resolveQuick(t, rArr, rng, neutral) {
      const g = quick(rng, rArr[t[0]], rArr[t[1]], neutral);
      t[2] = g[0]; t[3] = g[1];
      if (g[0] === g[1]) {
        t[6] = 1;
        t[2] += poisson(rng, 0.38 * Math.exp(0.02 * (rArr[t[0]] - rArr[t[1]]))); t[3] += poisson(rng, 0.38 * Math.exp(-0.02 * (rArr[t[0]] - rArr[t[1]])));
        if (t[2] === t[3]) { const p = penShootout(rng, rArr[t[0]], rArr[t[1]]); t[4] = p[0]; t[5] = p[1]; }
      }
    }
    pack() { return { c: this.cc, e: this.e, s: this.seed, r: this.rounds, u: this.cur, p: this.pend, b: this.byes, pr: this.pre, w: this.w, R: this.R }; }
    static unpack(o, rArr, tierOf) {
      const c = new Cup(o.c, o.e, o.s, rArr, tierOf);
      c.rounds = o.r; c.cur = o.u; c.pend = o.p; c.byes = o.b; c.pre = o.pr; c.w = o.w; c.R = o.R;
      c.rng = U.makeRng((o.s + 7919 * (o.u + 2)) >>> 0);
      return c;
    }
  }

  // ======================= European competition =======================
  const KO_STAGES = ['po', 'r16', 'qf', 'sf', 'f'];
  class Euro {
    constructor(kind, teams, seed) {
      this.kind = kind; this.teams = teams.slice(); this.seed = seed; this.res = []; this.md = 0; this.ko = {}; this.w = -1;
      this.build();
    }
    build() {
      const T = this.teams, n = T.length; // T sorted by strength (seed order)
      const arr = []; for (let i = 0; i < n; i++) arr.push(i);
      const sched = [];
      const N1 = n - 1;
      LP_ROUNDS.forEach((k) => {
        const md = [];
        md.push(((k % 2) === 0) ? [T[k % N1], T[N1]] : [T[N1], T[k % N1]]);
        for (let i = 1; i <= (N1 - 1) / 2; i++) {
          const a = (k + i) % N1, b = ((k - i) % N1 + N1) % N1;
          md.push(((b - a + N1) % N1) < N1 / 2 ? [T[a], T[b]] : [T[b], T[a]]);
        }
        sched.push(md);
      });
      this.sched = sched;
    }
    lpTable(upTo) {
      const rows = new Map();
      this.teams.forEach((i) => rows.set(i, { idx: i, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
      const n = upTo === undefined ? this.res.length : upTo;
      for (let m = 0; m < n && m < this.res.length; m++) {
        const day = this.sched[m], rs = this.res[m];
        for (let k = 0; k < day.length; k++) {
          const h = rows.get(day[k][0]), a = rows.get(day[k][1]), r = rs[k];
          if (!r) continue;
          h.p++; a.p++; h.gf += r[0]; h.ga += r[1]; a.gf += r[1]; a.ga += r[0];
          if (r[0] > r[1]) { h.w++; a.l++; h.pts += 3; } else if (r[0] < r[1]) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
        }
      }
      const arr = Array.from(rows.values());
      arr.sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.idx - y.idx);
      arr.forEach((r, i) => { r.pos = i + 1; });
      return arr;
    }
    // build the pairings of a knockout stage from earlier results
    ensure(stage, rng, rArr) {
      if (this.ko[stage]) return this.ko[stage];
      let ties = [];
      const mk = (a, b) => [a, b, -1, -1, -1, -1, 0, -1, -1, -1]; // a,b,g1a,g1b,g2a,g2b,et,pa,pb,w
      if (stage === 'po') {
        const tb = this.lpTable();
        this.lpFinal = tb.map((r) => r.idx);
        const mid = tb.slice(8, 24).map((r) => r.idx);
        for (let i = 0; i < 8; i++) ties.push(mk(mid[15 - i], mid[i])); // seeded team (a lower index in table) hosts leg 2
      } else if (stage === 'r16') {
        const top = this.lpFinal.slice(0, 8);
        const po = this.ko.po.map((t) => this.tieWinner(t));
        rng.shuffle(po);
        for (let i = 0; i < 8; i++) ties.push(mk(po[i], top[i]));
      } else {
        const prev = KO_STAGES[KO_STAGES.indexOf(stage) - 1];
        const win = this.ko[prev].map((t) => this.tieWinner(t));
        rng.shuffle(win);
        for (let i = 0; i + 1 < win.length; i += 2) ties.push(mk(win[i], win[i + 1]));
      }
      this.ko[stage] = ties;
      return ties;
    }
    tieWinner(t) {
      if (t[9] >= 0) return t[9];
      const A = t[2] + (t[4] > -1 ? t[4] : 0), B = t[3] + (t[5] > -1 ? t[5] : 0);
      if (A !== B) return A > B ? t[0] : t[1];
      return t[7] > t[8] ? t[0] : t[1];
    }
    // aggregate after leg 1 from the viewpoint of team a (positive = a leads)
    resolve(t, rArr, rng) { // called after leg 2 (or the final)
      const A = t[2] + (t[4] > -1 ? t[4] : 0), B = t[3] + (t[5] > -1 ? t[5] : 0);
      if (A === B && t[7] < 0) {
        t[6] = 1;
        const ex = [poisson(rng, 0.38 * Math.exp(0.02 * (rArr[t[0]] - rArr[t[1]]))), poisson(rng, 0.38 * Math.exp(-0.02 * (rArr[t[0]] - rArr[t[1]])))];
        if (t[4] > -1) { t[4] += ex[0]; t[5] += ex[1]; } else { t[2] += ex[0]; t[3] += ex[1]; }
        if (t[2] + (t[4] > -1 ? t[4] : 0) === t[3] + (t[5] > -1 ? t[5] : 0)) { const p = penShootout(rng, rArr[t[0]], rArr[t[1]]); t[7] = p[0]; t[8] = p[1]; }
      }
      t[9] = this.tieWinner(t);
    }
    pack() {
      let s = '';
      this.res.forEach((day) => day.forEach((r) => { s += HEX[Math.min(r[0], 15)] + HEX[Math.min(r[1], 15)]; }));
      return { k: this.kind, t: this.teams, s: this.seed, m: this.md, x: s, ko: this.ko, lf: this.lpFinal || null, w: this.w };
    }
    static unpack(o) {
      const e = new Euro(o.k, o.t, o.s);
      e.md = o.m; let p = 0;
      for (let m = 0; m < o.m; m++) {
        const day = e.sched[m], rs = [];
        for (let k = 0; k < day.length; k++) { rs.push([HEX.indexOf(o.x[p]), HEX.indexOf(o.x[p + 1])]); p += 2; }
        e.res.push(rs);
      }
      e.ko = o.ko || {}; e.lpFinal = o.lf; e.w = o.w;
      return e;
    }
  }
  const EURO_NAME = { cl: 'Champions League', el: 'Europa League', ecl: 'Conference League' };

  function euroQuota(rank) {
    const cl = rank <= 4 ? 4 : rank === 5 ? 3 : rank <= 7 ? 2 : rank <= 20 ? 1 : 0;
    const el = rank <= 6 ? 2 : rank <= 23 ? 1 : 0;
    const elCup = rank <= 7 ? 1 : 0;
    const ecl = rank <= 28 ? 1 : 0;
    const eclCup = rank >= 8 && rank <= 15 ? 1 : 0;
    return { cl, el, elCup, ecl, eclCup };
  }
  FCK.euroQuota = euroQuota;

  // ======================= The simulated world state =======================
  class Sim {
    constructor(seed) {
      this.seed = seed >>> 0; this.year = 2026; this.n = W.clubs.length;
      this.r = W.clubs.map((c) => c.r); this.anchor = this.r.slice();
      this.gid = W.clubs.map((c) => c.gid);
      this.leagues = {}; this.cups = {}; this.euro = {}; this.sc = {}; this.hist = [];
      this.pos = { w: 0, s: 0 }; this.done = false; this.cur = null;
      this.rng = U.makeRng(this.seed ^ 0x9e3779b1);
      this.userIdx = -1;
      W.rankCountries(this.r, this.gid);
      // season 1: Europe by rating (stand-in for last season's table)
      const order = {}; W.countries.forEach((co) => { order[co.cc] = []; });
      W.clubs.forEach((c) => { if (W.groups[this.gid[c.idx]].tier === 1) order[c.country].push(c.idx); });
      Object.keys(order).forEach((cc) => order[cc].sort((a, b) => this.r[b] - this.r[a]));
      this.startSeason(this.qualify(order, {}));
    }
    tierOf(i) { return W.groups[this.gid[i]].tier; }
    ccOf(i) { return W.clubs[i].country; }
    ovr(i) { return this.r[i]; }

    // ----- season set-up -----
    startSeason(euroTeams) {
      const y = this.year;
      this.leagues = {}; this.cups = {}; this.euro = {}; this.sc = {};
      this.pos = { w: 0, s: 0 }; this.done = false; this.cur = null;
      const members = {}; W.groups.forEach((g) => { members[g.gid] = []; });
      this.gid.forEach((g, i) => members[g].push(i));
      W.groups.forEach((g) => {
        this.leagues[g.gid] = new League(g.gid, members[g.gid], (this.seed ^ Math.imul(g.gid + 1, 2654435761) ^ y) >>> 0, g.rounds);
      });
      W.countries.forEach((co) => {
        const ent = []; co.leagues.forEach((lg) => lg.gids.forEach((g) => members[g].forEach((i) => ent.push(i))));
        if (ent.length >= 4) this.cups[co.cc] = new Cup(co.cc, ent, (this.seed ^ W.hash(co.cc) ^ (y * 31)) >>> 0, this.r, (i) => this.tierOf(i));
      });
      EURO.forEach((k, ki) => {
        const teams = euroTeams[k].slice().sort((a, b) => this.r[b] - this.r[a]);
        this.euro[k] = new Euro(k, teams, (this.seed ^ (ki + 1) * 7919 ^ y) >>> 0);
      });
      this.euroOf = new Map();
      EURO.forEach((k) => this.euro[k].teams.forEach((i) => this.euroOf.set(i, k)));
    }

    // ----- European qualification -----
    qualify(order, cupWin) {
      W.rankCountries(this.r, this.gid);
      const ranks = W.uefaOrder; // cc by rank
      const used = new Set();
      const out = { cl: [], el: [], ecl: [] };
      const quota = euroQuota;
      const take = (cc, k, n, skip) => {
        const lst = order[cc] || [];
        let c = 0;
        for (let i = 0; i < lst.length && c < n; i++) {
          if (used.has(lst[i])) continue;
          used.add(lst[i]); out[k].push(lst[i]); c++;
        }
      };
      const takeCup = (cc, k) => {
        const w = cupWin[cc];
        if (w !== undefined && w >= 0 && !used.has(w)) { used.add(w); out[k].push(w); return true; }
        return false;
      };
      ranks.forEach((cc, i) => { take(cc, 'cl', quota(i + 1).cl); });
      ranks.forEach((cc, i) => { const q = quota(i + 1); if (q.elCup && !takeCup(cc, 'el')) take(cc, 'el', 1); take(cc, 'el', q.el); });
      ranks.forEach((cc, i) => { const q = quota(i + 1); if (q.eclCup && !takeCup(cc, 'ecl')) take(cc, 'ecl', 1); take(cc, 'ecl', q.ecl); });
      // fill / trim to exactly 36
      EURO.forEach((k) => {
        let guard = 0;
        while (out[k].length < 36 && guard++ < 400) {
          let added = false;
          for (let i = 0; i < ranks.length && out[k].length < 36; i++) {
            const before = out[k].length; take(ranks[i], k, 1);
            if (out[k].length > before) added = true;
          }
          if (!added) break;
        }
        if (out[k].length > 36) out[k] = out[k].slice(0, 36);
      });
      return out;
    }

    // ----- calendar -----
    // fixtures of one slot (s=0 midweek, s=1 weekend) - creates draws when needed
    fixtures(w, s) {
      const list = [];
      if (s === 1) {
        for (const gid in this.leagues) {
          const lg = this.leagues[gid];
          if (lg.md < lg.M && lg.weekOf(lg.md) === w) {
            lg.sched[lg.md].forEach((m, k) => list.push({ t: 'L', gid: +gid, md: lg.md, k, h: m[0], a: m[1] }));
          }
        }
      } else {
        for (const cc in this.cups) {
          const cup = this.cups[cc];
          let r = cup.cur;
          if (!(r >= 0 && cup.rounds[r] && cup.rounds[r].some((t) => t[2] < 0))) r = cup.cur + 1;
          if (r < cup.R && cup.weekOf(r) === w && cup.w < 0) {
            if (!cup.rounds[r]) cup.draw(r, (i) => this.tierOf(i));
            cup.rounds[r].forEach((t, k) => list.push({ t: 'C', cc, r, k, h: t[0], a: t[1], neutral: r === cup.R - 1 }));
          }
        }
        EURO.forEach((k) => {
          const eu = this.euro[k];
          if (!eu) return;
          const li = EW.lp.indexOf(w);
          if (li >= 0 && eu.md === li) {
            eu.sched[li].forEach((m, kk) => list.push({ t: 'E', k, st: 'lp', md: li, kk, h: m[0], a: m[1] }));
          }
          KO_STAGES.forEach((st) => {
            const wk = EW[st];
            const leg = wk.indexOf(w);
            if (leg < 0) return;
            const ties = eu.ensure(st, this.rng, this.r);
            ties.forEach((t, kk) => {
              if (st === 'f') { list.push({ t: 'E', k, st, leg: 0, kk, h: t[0], a: t[1], neutral: true }); return; }
              list.push({ t: 'E', k, st, leg, kk, h: leg === 0 ? t[0] : t[1], a: leg === 0 ? t[1] : t[0] });
            });
          });
        });
      }
      return list;
    }

    // simulate one fixture quickly and record it
    playFix(f, res) {
      let r;
      const rng = this.rng;
      this._real = !!res;
      if (f.t === 'L') {
        r = res ? res.g : quick(rng, this.r[f.h], this.r[f.a]);
        const lg = this.leagues[f.gid];
        (lg.res[f.md] = lg.res[f.md] || [])[f.k] = r;
        this.goals(f.h, r[0]); this.goals(f.a, r[1]);
      } else if (f.t === 'C') {
        const cup = this.cups[f.cc], t = cup.rounds[f.r][f.k];
        if (res) { // from a played match: res = {g:[h,a], pens:[h,a]|null, et:bool}
          t[2] = res.g[0]; t[3] = res.g[1]; t[6] = res.et ? 1 : 0;
          if (res.pens) { t[4] = res.pens[0]; t[5] = res.pens[1]; }
        } else cup.resolveQuick(t, this.r, rng, f.neutral);
        this.goals(t[0], t[2]); this.goals(t[1], t[3]);
      } else if (f.t === 'E') {
        const eu = this.euro[f.k];
        if (f.st === 'lp') {
          r = res ? res.g : quick(rng, this.r[f.h], this.r[f.a]);
          (eu.res[f.md] = eu.res[f.md] || [])[f.kk] = r;
          this.goals(f.h, r[0]); this.goals(f.a, r[1]);
        } else {
          const t = eu.ko[f.st][f.kk];
          if (f.st === 'f') {
            if (res) { t[2] = res.g[0]; t[3] = res.g[1]; t[6] = res.et ? 1 : 0; if (res.pens) { t[7] = res.pens[0]; t[8] = res.pens[1]; } else { t[7] = t[8] = -1; } eu.resolve(t, this.r, rng); }
            else { const g = quick(rng, this.r[t[0]], this.r[t[1]], true); t[2] = g[0]; t[3] = g[1]; t[4] = t[5] = -1; eu.resolve(t, this.r, rng); }
            this.goals(t[0], t[2]); this.goals(t[1], t[3]);
          } else if (f.leg === 0) {
            const g = res ? res.g : quick(rng, this.r[t[0]], this.r[t[1]]);
            t[2] = g[0]; t[3] = g[1];
            this.goals(t[0], g[0]); this.goals(t[1], g[1]);
          } else {
            const g = res ? res.g : quick(rng, this.r[t[1]], this.r[t[0]]); // [goals of b (home), goals of a]
            t[4] = g[1]; t[5] = g[0];
            if (res) { t[6] = res.et ? 1 : 0; if (res.pens) { t[7] = res.pens[1]; t[8] = res.pens[0]; } }
            this.goals(t[1], g[0]); this.goals(t[0], g[1]);
            // ET goals of a played match are already part of g
            if (res) { const A = t[2] + t[4], B = t[3] + t[5]; if (A === B && t[7] < 0) { const p = penShootout(rng, this.r[t[0]], this.r[t[1]]); t[7] = p[0]; t[8] = p[1]; } t[9] = eu.tieWinner(t); }
            else eu.resolve(t, this.r, rng);
          }
        }
      }
      this._real = false;
    }
    goals(club, n) {
      if (this._real) return;
      for (let i = 0; i < n; i++) {
        const o = this.sc[club] || (this.sc[club] = {});
        let k = scorerIdx(this.rng);
        if (club === this.userIdx && this.scorerHook) k = this.scorerHook(k, this.rng);
        o[k] = (o[k] || 0) + 1;
      }
    }
    addGoal(club, sqi) { const o = this.sc[club] || (this.sc[club] = {}); o[sqi] = (o[sqi] || 0) + 1; }

    // description of a fixture for the UI / the match engine
    info(f) {
      const o = { comp: f.t, knockout: false, aggLead: 0, neutral: !!f.neutral, leg: 0, twoLegs: false, round: 0, rounds: 0 };
      if (f.t === 'L') { const lg = this.leagues[f.gid]; o.md = f.md + 1; o.mds = lg.M; o.gid = f.gid; }
      else if (f.t === 'C') { const cup = this.cups[f.cc]; o.knockout = true; o.round = f.r; o.rounds = cup.R; o.cc = f.cc; o.rname = cup.R - 1 - f.r; }
      else {
        o.k = f.k; o.st = f.st;
        if (f.st === 'lp') { o.md = f.md + 1; o.mds = 8; }
        else {
          const t = this.euro[f.k].ko[f.st][f.kk];
          o.knockout = f.st === 'f' || f.leg === 1; o.twoLegs = f.st !== 'f'; o.leg = f.leg || 0;
          if (f.leg === 1) o.aggLead = t[3] - t[2]; // lead of the home side (= team b) after leg 1
        }
      }
      return o;
    }

    // after all fixtures of a slot are recorded
    closeSlot(w, s, list) {
      if (s === 1) {
        const seen = new Set();
        list.forEach((f) => { if (f.t === 'L') seen.add(f.gid); });
        seen.forEach((g) => { this.leagues[g].md++; });
      } else {
        const cups = new Set(), eus = new Set();
        list.forEach((f) => { if (f.t === 'C') cups.add(f.cc); if (f.t === 'E') eus.add(f.k); });
        cups.forEach((cc) => { const c = this.cups[cc]; c.finishRound(c.cur); });
        eus.forEach((k) => {
          const e = this.euro[k];
          if (EW.lp.includes(w) && e.md === EW.lp.indexOf(w)) e.md++;
          if (w === EW.f[0]) e.w = e.tieWinner(e.ko.f[0]);
        });
      }
    }
    // simulate everything in the slot except fixtures of the user's club; returns user fixture
    prepare() {
      if (this.cur) return this.cur;
      while (this.pos.w < WEEKS) {
        const { w, s } = this.pos;
        const list = this.fixtures(w, s);
        if (list.length || false) {
          const uf = this.userIdx >= 0 ? list.find((f) => f.h === this.userIdx || f.a === this.userIdx) : null;
          if (uf) { this.cur = { w, s, list, user: uf }; return this.cur; }
          list.forEach((f) => this.playFix(f));
          this.closeSlot(w, s, list);
        }
        this.advance();
      }
      this.done = true;
      return null;
    }
    advance() { if (this.pos.s === 0) this.pos.s = 1; else { this.pos.s = 0; this.pos.w++; } }
    // user's result is in (res as for playFix) -> close the slot and move on
    commit(res) {
      if (!this.cur) return;
      const c = this.cur;
      c.list.forEach((f) => { if (f !== c.user) this.playFix(f); });
      if (c.user) this.playFix(c.user, res);
      this.closeSlot(c.w, c.s, c.list);
      this.cur = null; this.advance();
    }
    // simulate until the user's next fixture (or season end)
    nextUserFixture() {
      const c = this.prepare();
      return c && c.user ? c : null;
    }
    // simulate the whole rest of the season (user's matches too)
    finishSeason() {
      let guard = 0;
      while (!this.done && guard++ < 5000) {
        const c = this.prepare();
        if (!c) break;
        this.commit(null);
      }
      this.done = true;
    }
    weekLabel() { return this.pos.w; }

    // ----- standings helpers -----
    table(gid) { return this.leagues[gid].table(); }
    finalOrder() {
      const o = {};
      W.countries.forEach((co) => {
        const lg = co.leagues.find((l) => l.tier === 1);
        if (!lg) return;
        o[co.cc] = [];
        lg.gids.forEach((g) => this.leagues[g].table().forEach((r) => o[co.cc].push(r.idx)));
      });
      return o;
    }

    // ----- rollover -----
    endSeason() {
      this.finishSeason();
      const sum = { year: this.year, champs: {}, cups: {}, euro: {}, up: [], down: [], tables: {} };
      const tables = {};
      W.groups.forEach((g) => { tables[g.gid] = this.leagues[g.gid].table(); });
      const order = this.finalOrder();
      const cupWin = {};
      for (const cc in this.cups) { cupWin[cc] = this.cups[cc].w; sum.cups[cc] = this.cups[cc].w; }
      EURO.forEach((k) => { sum.euro[k] = this.euro[k].w; });
      W.countries.forEach((co) => { const t1 = co.leagues.find((l) => l.tier === 1); if (t1) sum.champs[co.cc] = tables[t1.gids[0]][0].idx; });

      // ratings drift (before moves)
      const newR = this.r.slice();
      W.groups.forEach((g) => {
        const rows = tables[g.gid], n = rows.length;
        rows.forEach((row, i) => {
          const d = n > 1 ? 0.5 - i / (n - 1) : 0;
          newR[row.idx] += d * 3.2 + this.rng.gauss() * 0.7;
        });
      });
      EURO.forEach((k) => { const w = this.euro[k].w; if (w >= 0) newR[w] += k === 'cl' ? 1.5 : 0.8; });

      // promotion / relegation
      W.countries.forEach((co) => {
        const tiers = co.leagues;
        const down = {}, up = {};
        for (let ti = 0; ti + 1 < tiers.length; ti++) {
          const upper = tiers[ti], lower = tiers[ti + 1];
          const dn = [];
          upper.gids.forEach((g) => { const rows = tables[g]; for (let k = 0; k < upper.relegate && rows.length - 1 - k >= 0; k++) dn.push(rows[rows.length - 1 - k].idx); });
          const P = dn.length;
          const pr = [];
          let place = 0;
          while (pr.length < P && place < 30) {
            const cand = [];
            lower.gids.forEach((g) => { const rows = tables[g]; if (rows[place]) cand.push(rows[place]); });
            if (!cand.length) break;
            cand.sort((x, y) => (y.pts / Math.max(1, y.p)) - (x.pts / Math.max(1, x.p)) || (y.gf - y.ga) / Math.max(1, y.p) - (x.gf - x.ga) / Math.max(1, x.p));
            for (let q = 0; q < cand.length && pr.length < P; q++) pr.push(cand[q].idx);
            place++;
          }
          down[ti] = dn.slice(0, pr.length); up[ti + 1] = pr; // dn clubs go to tier ti+1, pr clubs go to tier ti
          dn.slice(0, pr.length).forEach((i) => { newR[i] -= 1.2; sum.down.push(i); });
          pr.forEach((i) => { newR[i] += 1.2; sum.up.push(i); });
        }
        // vacated slots per tier
        tiers.forEach((lg, ti) => {
          const leaving = new Set((down[ti] || []).concat(up[ti] || []));
          const slots = [];
          lg.gids.forEach((g) => { this.leagues[g].clubs.forEach((i) => { if (leaving.has(i)) slots.push(g); }); });
          const incoming = (down[ti - 1] || []).concat(up[ti + 1] || []);
          // incoming clubs are matched to the slots of leaving clubs (random)
          this.rng.shuffle(slots);
          incoming.forEach((i, k) => { this.gid[i] = slots[k] !== undefined ? slots[k] : lg.gids[0]; });
        });
      });
      // pull to the long-term level
      for (let i = 0; i < this.n; i++) {
        newR[i] = U.clamp(newR[i] + (this.anchor[i] - newR[i]) * 0.12, 8, 96);
      }
      this.r = newR;

      const record = { year: this.year, champs: sum.champs, cups: sum.cups, euro: sum.euro };
      this.hist.push(record);
      if (this.hist.length > 30) this.hist.shift();
      this.year++;
      const q = this.qualify(order, cupWin);
      this.startSeason(q);
      return sum;
    }

    // ----- squads -----
    squadOf(i) {
      if (i === this.userIdx && this.userSquad) return this.userSquad();
      const base = W.squad(W.clubs[i], (this.seed + Math.imul(this.year, 7919)) >>> 0);
      const ov = this.aiOv && this.aiOv[i];
      return ov ? base.map((p, k) => ov[k] || p) : base;
    }
    delta(i) { if (i === this.userIdx && this.userSquad) return 0; return W.matchOvr(this.r[i]) - W.clubs[i].rating; }
    // table zones of a group: pos -> 'promo' | 'cl' | 'el' | 'ecl' | 'rel' | 'po'
    zones(gid) {
      const g = W.groups[gid], co = W.byCc[g.cc], z = {};
      const lg = co.leagues.find((l) => l.tier === g.tier);
      const n = this.leagues[gid].clubs.length;
      if (g.tier === 1 && co.uefa) {
        const q = euroQuota(co.rank); let p = 1;
        for (let k = 0; k < q.cl; k++) z[p++] = 'cl';
        for (let k = 0; k < q.el + (q.elCup ? 0 : 0); k++) z[p++] = 'el';
        for (let k = 0; k < q.ecl; k++) z[p++] = 'ecl';
      }
      if (g.tier > 1) {
        const up = co.leagues.find((l) => l.tier === g.tier - 1);
        if (up) { const P = up.relegate * up.gids.length; const per = Math.floor(P / lg.gids.length) || 0; for (let p = 1; p <= per; p++) z[p] = 'promo'; if (!per && P) z[1] = 'promo?'; }
      }
      for (let k = 0; k < lg.relegate; k++) z[n - k] = 'rel';
      return z;
    }

    // ----- scorers -----
    topScorers(clubSet, limit) {
      const out = [];
      clubSet.forEach((ci) => {
        const o = this.sc[ci]; if (!o) return;
        let squad = null;
        for (const k in o) {
          let p = null;
          if (ci === this.userIdx && this.nameHook) p = this.nameHook(+k);
          else { if (!squad) squad = this.squadOf(ci); p = squad[+k]; }
          if (p) out.push({ club: ci, name: p.name, sname: p.sname, goals: o[k] });
        }
      });
      out.sort((a, b) => b.goals - a.goals || (a.name < b.name ? -1 : 1));
      return out.slice(0, limit || 10);
    }

    // ----- persistence -----
    pack() {
      const sc = {}; for (const k in this.sc) { sc[k] = Object.keys(this.sc[k]).map((q) => q + ':' + this.sc[k][q]).join(','); }
      const lg = []; for (const g in this.leagues) lg.push(this.leagues[g].pack());
      const cups = []; for (const c in this.cups) cups.push(this.cups[c].pack());
      const eu = {}; EURO.forEach((k) => { eu[k] = this.euro[k].pack(); });
      return { v: 1, seed: this.seed, year: this.year, r: this.r.map((x) => Math.round(x * 100) / 100), a: this.anchor, gid: this.gid, lg, cups, eu, sc, hist: this.hist, pos: this.pos, done: this.done, ui: this.userIdx, rs: this.rng.seed };
    }
    static unpack(o) {
      const s = Object.create(Sim.prototype);
      s.seed = o.seed; s.year = o.year; s.n = W.clubs.length; s.r = o.r.slice(); s.anchor = o.a.slice(); s.gid = o.gid.slice();
      s.leagues = {}; o.lg.forEach((l) => { s.leagues[l.g] = League.unpack(l); });
      s.cups = {}; o.cups.forEach((c) => { s.cups[c.c] = Cup.unpack(c, s.r, (i) => W.groups[s.gid[i]].tier); });
      s.euro = {}; EURO.forEach((k) => { s.euro[k] = Euro.unpack(o.eu[k]); });
      s.euroOf = new Map(); EURO.forEach((k) => s.euro[k].teams.forEach((i) => s.euroOf.set(i, k)));
      s.sc = {}; for (const k in o.sc) { s.sc[k] = {}; o.sc[k].split(',').forEach((p) => { if (p) { const q = p.split(':'); s.sc[k][+q[0]] = +q[1]; } }); }
      s.hist = o.hist || []; s.pos = o.pos; s.done = o.done; s.cur = null; s.userIdx = o.ui;
      s.rng = U.makeRng((o.rs ^ 0x51ed270b ^ Math.imul(o.year, 7919) ^ Math.imul(o.pos.w + 1, 104729) ^ (o.pos.s * 13)) >>> 0);
      W.rankCountries(s.r, s.gid);
      return s;
    }
  }

  // ---- a world with ONE competition only (used by the stand-alone competition mode) ----
  // kind: 'league' (id = group id) | 'cup' (id = country code) | 'euro' (id = 'cl' | 'el' | 'ecl')
  Sim.single = function (kind, id, seed, year) {
    const s = Object.create(Sim.prototype);
    s.seed = seed >>> 0; s.year = year || 2026; s.n = W.clubs.length;
    s.r = W.clubs.map((c) => c.r); s.anchor = s.r.slice(); s.gid = W.clubs.map((c) => c.gid);
    s.leagues = {}; s.cups = {}; s.euro = {}; s.sc = {}; s.hist = []; s.pos = { w: 0, s: 0 }; s.done = false; s.cur = null; s.userIdx = -1;
    s.rng = U.makeRng(s.seed ^ 0x9e3779b1); s.euroOf = new Map(); s.singleOf = { kind, id };
    W.rankCountries(s.r, s.gid);
    const y = s.year;
    if (kind === 'league') {
      const members = []; s.gid.forEach((g, i) => { if (g === id) members.push(i); });
      s.leagues[id] = new League(id, members, (s.seed ^ Math.imul(id + 1, 2654435761) ^ y) >>> 0, W.groups[id].rounds);
    } else if (kind === 'cup') {
      const co = W.byCc[id], ent = [];
      co.leagues.forEach((lg) => lg.gids.forEach((g) => s.gid.forEach((gg, i) => { if (gg === g) ent.push(i); })));
      s.cups[id] = new Cup(id, ent, (s.seed ^ W.hash(id) ^ (y * 31)) >>> 0, s.r, (i) => s.tierOf(i));
    } else {
      const order = {}; W.countries.forEach((co) => { order[co.cc] = []; });
      W.clubs.forEach((c) => { if (W.groups[s.gid[c.idx]].tier === 1) order[c.country].push(c.idx); });
      Object.keys(order).forEach((cc) => order[cc].sort((a, b) => s.r[b] - s.r[a]));
      const q = s.qualify(order, {});
      const teams = q[id].slice().sort((a, b) => s.r[b] - s.r[a]);
      s.euro[id] = new Euro(id, teams, (s.seed ^ (EURO.indexOf(id) + 1) * 7919 ^ y) >>> 0);
      s.euro[id].teams.forEach((i) => s.euroOf.set(i, id));
    }
    return s;
  };
  // compact persistence of a single-competition world
  Sim.prototype.packSingle = function () {
    const k = this.singleOf.kind, id = this.singleOf.id;
    const sc = {}; for (const c in this.sc) { sc[c] = Object.keys(this.sc[c]).map((q) => q + ':' + this.sc[c][q]).join(','); }
    const comp = k === 'league' ? this.leagues[id].pack() : k === 'cup' ? this.cups[id].pack() : this.euro[id].pack();
    return { seed: this.seed, year: this.year, kind: k, id, comp, sc, pos: this.pos, done: this.done, ui: this.userIdx, rs: this.rng.seed };
  };
  Sim.unpackSingle = function (o) {
    const s = Sim.single(o.kind, o.id, o.seed, o.year);
    if (o.kind === 'league') s.leagues[o.id] = League.unpack(o.comp);
    else if (o.kind === 'cup') s.cups[o.id] = Cup.unpack(o.comp, s.r, (i) => W.groups[s.gid[i]].tier);
    else { s.euro[o.id] = Euro.unpack(o.comp); s.euroOf = new Map(); s.euro[o.id].teams.forEach((i) => s.euroOf.set(i, o.id)); }
    s.sc = {}; for (const c in o.sc) { s.sc[c] = {}; o.sc[c].split(',').forEach((p) => { if (p) { const q = p.split(':'); s.sc[c][+q[0]] = +q[1]; } }); }
    s.pos = o.pos; s.done = o.done; s.userIdx = o.ui;
    s.rng = U.makeRng((o.rs ^ 0x51ed270b ^ Math.imul(o.year, 7919) ^ Math.imul(o.pos.w + 1, 104729) ^ (o.pos.s * 13)) >>> 0);
    return s;
  };
  // simulate the next slot of the calendar that has fixtures (all of them, nobody is the user); returns {w, s, list} or null at the end
  Sim.prototype.stepSlot = function () {
    while (this.pos.w < WEEKS) {
      const { w, s } = this.pos;
      const list = this.fixtures(w, s);
      if (list.length) {
        list.forEach((f) => this.playFix(f));
        this.closeSlot(w, s, list);
        this.advance();
        return { w, s, list };
      }
      this.advance();
    }
    this.done = true;
    return null;
  };

  FCK.SimClasses = { League, Cup, Euro };
  FCK.Sim = Sim; FCK.SimConst = { WEEKS, EW, CUPW, EURO, EURO_NAME, KO_STAGES };
  FCK.quickMatch = quick;
})((globalThis.FCK = globalThis.FCK || {}));
