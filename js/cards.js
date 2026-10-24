/* FCK - cards.js : card mode (packs, chemistry, coins, market, tasks, challenges, league ladder)
   Players on cards are generated; clubs are real club names used as plain text. All values are own estimates. */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;
  const Cards = {};
  FCK.Cards = Cards;
  const ROLE = FCK.ROLE_OF;

  Cards.VERSION = 1;
  Cards.MAXCARDS = 600;
  Cards.ROUND = 5;          // matches per league round
  Cards.DIVS = 10;
  Cards.MAXLIST = 10;
  Cards.now = () => new Date();

  // ---------------------------------------------------------------- rarity / value
  Cards.RAR = [
    { k: 0, lo: 45, hi: 64, key: 'bronze' }, { k: 1, lo: 65, hi: 74, key: 'silver' }, { k: 2, lo: 75, hi: 82, key: 'gold' },
    { k: 3, lo: 83, hi: 89, key: 'elite' }, { k: 4, lo: 90, hi: 96, key: 'legend' },
  ];
  Cards.rarOf = (o) => (o >= 90 ? 4 : o >= 83 ? 3 : o >= 75 ? 2 : o >= 65 ? 1 : 0);
  const nice = (v) => (v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : v < 10000 ? Math.round(v / 50) * 50 : Math.round(v / 100) * 100);
  Cards.value = function (c) {
    const o = c.o;
    let v = 9 * Math.exp((o - 45) * 0.135);
    if (o >= 75) v *= Math.exp((o - 75) * 0.12);
    if (c.rare && o < 83) v *= 1.4;
    if (c.sk) v *= 1.3;
    return Math.max(10, nice(v));
  };
  Cards.sellValue = (c) => Math.max(5, Math.round(Cards.value(c) * 0.5 / 5) * 5);

  Cards.PACKS = {
    bronze: { price: 400, n: 5, w: [86, 13, 1, 0, 0], min: 0 },
    silver: { price: 1600, n: 5, w: [44, 45, 10, 1, 0], min: 1 },
    gold: { price: 6000, n: 5, w: [14, 38, 42, 5.5, 0.5], min: 2 },
    prem: { price: 18000, n: 6, w: [0, 17, 60, 21, 2], min: 2 },
    legend: { price: 40000, n: 5, w: [0, 0, 48, 42, 10], min: 3 },
  };
  Cards.PACK_KEYS = Object.keys(Cards.PACKS);

  // ---------------------------------------------------------------- generation
  const POSW = [['GK', 8], ['LB', 5], ['CB', 12], ['RB', 5], ['LWB', 2], ['RWB', 2], ['CDM', 7], ['CM', 10], ['CAM', 6], ['LM', 4], ['RM', 4], ['LAM', 2], ['RAM', 2], ['LW', 5], ['RW', 5], ['ST', 11]];
  const POSTOT = POSW.reduce((a, b) => a + b[1], 0);
  function pickPos(rng) {
    let r = rng.next() * POSTOT;
    for (const [p, w] of POSW) { r -= w; if (r <= 0) return p; }
    return 'CM';
  }
  function pickW(rng, w) {
    let tot = 0; for (let i = 0; i < w.length; i++) tot += w[i];
    let r = rng.next() * tot;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
    return w.length - 1;
  }
  let sortedClubs = null, sortedKey = 0;
  function clubPool() {
    const key = W.clubs.length + W.extras.length;
    if (!sortedClubs || sortedKey !== key) {
      sortedClubs = W.clubs.concat(W.extras).slice().sort((a, b) => a.rating - b.rating);
      sortedKey = key;
    }
    return sortedClubs;
  }
  function clubNear(rng, target) {
    const a = clubPool();
    let lo = 0, hi = a.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].rating < target) lo = mid + 1; else hi = mid; }
    const win = 45;
    const i = U.clamp(lo + rng.int(-win, win), 0, a.length - 1);
    return a[i];
  }
  const natOf = (x) => (FCK.NAMES[x] ? x : 'en');
  Cards.leagueKey = (club) => (club ? club.country + '|' + (club.lname || club.league || '') : '');
  Cards.clubOf = (c) => W.byId[c.cl] || null;

  // opt: r (rarity), min, w (weights), pos, o (exact ovr), ag
  Cards.gen = function (S, rng, opt) {
    opt = opt || {};
    let r = opt.r !== undefined ? opt.r : pickW(rng, opt.w || [60, 30, 8, 1.8, 0.2]);
    if (opt.min !== undefined) r = Math.max(r, opt.min);
    const R = Cards.RAR[r];
    let o = opt.o !== undefined ? opt.o : Math.floor(R.lo + (R.hi - R.lo + 1) * Math.pow(rng.next(), 1.35));
    o = U.clamp(o, 40, 97);
    const pos = opt.pos || pickPos(rng);
    const club = clubNear(rng, o - 3 + rng.gauss() * 6);
    const nt = natOf(FCK.pickNameGroup(club, rng, 0.55, 0.4));
    const dn = FCK.drawName(nt, rng);
    const n = (dn.first ? dn.first + ' ' : '') + dn.last;
    const rare = r >= 3 ? 1 : (rng.chance(0.12) ? 1 : 0);
    const card = { id: 0, n, nt, cl: club.id, pos, o, r: Cards.rarOf(o), rare, ag: opt.ag || U.clamp(Math.round(25 + rng.gauss() * 4.5), 17, 38), sd: rng.int(1, 4e9), gl: 0, ap: 0 };
    const sk = Cards.rollStyle(card);
    if (sk) { card.sk = sk; card.rare = 1; }
    return card;
  };
  // special card styles (like Team of the Week or Icon); rolled from the card seed so the main RNG stream stays untouched
  Cards.SK = { 2: [['otw', 0.05]], 3: [['totw', 0.3], ['tots', 0.2], ['hero', 0.12], ['potm', 0.1]], 4: [['toty', 0.3]] };
  Cards.SK_KEYS = ['otw', 'totw', 'tots', 'hero', 'potm', 'toty'];
  Cards.rollStyle = function (c) {
    const list = Cards.SK[c.r];
    if (!list) return null;
    let x = U.makeRng((c.sd ^ 0x5bd1e995) >>> 0).next();
    for (const [k, p] of list) { if (x < p) return k; x -= p; }
    return null;
  };
  Cards.add = function (S, card) {
    card.id = S.nid++;
    S.cards.push(card);
    Cards._idx[card.id] = card;
    return card;
  };
  Cards.reindex = function () {
    Cards._idx = {};
    if (Cards.S) Cards.S.cards.forEach((c) => { Cards._idx[c.id] = c; });
  };
  Cards._idx = {};
  Cards.card = (id) => Cards._idx[id] || null;

  // real player object for the match engine
  Cards.player = function (c, pos, eff, num) {
    const rng = U.makeRng(c.sd);
    const p = FCK.makePlayer({ cc: c.nt }, pos, U.clamp(eff, 25, 99), num, rng, { name: c.n, nat: c.nt });
    p.cardId = c.id; p.age = c.ag; p.sqi = c.id; p.pos0 = c.pos;
    return p;
  };

  // ---------------------------------------------------------------- chemistry & team strength
  const CLOSE = {
    LB: ['LWB', 'LM'], RB: ['RWB', 'RM'], LWB: ['LB', 'LM'], RWB: ['RB', 'RM'], CB: [], CDM: ['CM', 'CB'], CM: ['CDM', 'CAM'], CAM: ['CM', 'LAM', 'RAM', 'ST'],
    LM: ['LW', 'LAM', 'LWB'], RM: ['RW', 'RAM', 'RWB'], LAM: ['LM', 'LW', 'CAM'], RAM: ['RM', 'RW', 'CAM'], LW: ['LM', 'LAM', 'ST'], RW: ['RM', 'RAM', 'ST'], ST: ['LW', 'RW', 'CAM'], GK: [],
  };
  Cards.posCost = function (natural, slot) {
    if (natural === slot) return 0;
    if (CLOSE[slot] && CLOSE[slot].includes(natural)) return 1;
    if (natural === 'GK' || slot === 'GK') return 25;
    return ROLE[natural] === ROLE[slot] ? 4 : 12;
  };
  const tier = (n, t) => (n >= t[2] ? 3 : n >= t[1] ? 2 : n >= t[0] ? 1 : 0);
  Cards.CHEM_BONUS = [0, 1, 2, 3];

  // ids: array (formation order) of card ids (0/null = empty). Returns details per slot and totals.
  Cards.eval = function (form, ids) {
    const slots = FCK.FORMATIONS[form] || FCK.FORMATIONS['4-3-3'];
    const cs = slots.map((sl, i) => (ids && ids[i] ? Cards.card(ids[i]) : null));
    const cnt = { c: {}, n: {}, l: {} };
    const lg = cs.map((c) => (c ? Cards.leagueKey(Cards.clubOf(c)) : ''));
    cs.forEach((c, i) => {
      if (!c) return;
      cnt.c[c.cl] = (cnt.c[c.cl] || 0) + 1;
      cnt.n[c.nt] = (cnt.n[c.nt] || 0) + 1;
      cnt.l[lg[i]] = (cnt.l[lg[i]] || 0) + 1;
    });
    let sum = 0, chemTot = 0, filled = 0;
    const out = cs.map((c, i) => {
      if (!c) return { c: null, eff: 0, chem: 0, cost: 0, lk: [0, 0, 0] };
      const lc = tier(cnt.c[c.cl], [2, 4, 7]), ln = tier(cnt.n[c.nt], [2, 5, 8]), ll = tier(cnt.l[lg[i]], [3, 5, 8]);
      const cost = Cards.posCost(c.pos, slots[i].pos);
      let chem = Math.min(3, lc + ln + ll);
      if (cost >= 12) chem = 0; else if (cost >= 4) chem = Math.max(0, chem - 1);
      const eff = U.clamp(c.o + Cards.CHEM_BONUS[chem] - cost, 20, 99);
      sum += eff; chemTot += chem; filled++;
      return { c, eff, chem, cost, lk: [lc, ln, ll] };
    });
    return { slots: out, filled, sum, S: filled ? sum / filled : 0, chem: chemTot, full: filled === slots.length };
  };

  // ---------------------------------------------------------------- state
  Cards.today = function () {
    const d = Cards.now();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const PALETTES = [
    ['#18b46b', '#ffffff'], ['#d4162a', '#ffffff'], ['#0b3a8f', '#ffffff'], ['#ffd800', '#111111'], ['#6a1b9a', '#ffffff'], ['#f57c00', '#111111'],
    ['#00897b', '#ffffff'], ['#111111', '#e53935'], ['#ffffff', '#1a237e'], ['#039be5', '#ffffff'], ['#ad1457', '#ffffff'], ['#2e7d32', '#ffeb3b'],
  ];
  Cards.PALETTES = PALETTES;
  Cards.KITS = ['solid', 'stripesV', 'hoops', 'halves', 'band', 'sash', 'sleeves'];
  Cards.SHAPES = ['round', 'shield', 'diamond'];
  Cards.PATTERNS = ['plain', 'halves', 'stripesV', 'chevron', 'bend', 'cross'];
  Cards.EMBLEMS = ['star', 'ball', 'bolt', 'crown', 'ring', 'tower', 'leaf'];

  Cards.fresh = function (seed) {
    seed = (seed != null ? seed : (Math.random() * 4294967295)) >>> 0;
    const S = {
      v: Cards.VERSION, seed, nid: 1, coins: 3000, cards: [], xi: [], bench: [], form: '4-3-3', style: 'balanced',
      team: { name: 'FCK Allstars', pal: 0, kit: 'stripesV', shape: 'shield', pattern: 'plain', emblem: 'star', stadium: 'FCK-Arena' },
      inv: { bronze: 2 }, list: [], mk: { tick: 0, sold: {} }, news: [],
      rank: { div: 10, pts: 0, m: 0, res: [], best: 10 },
      day: { date: '', c: {}, claimed: {}, ids: [] }, gift: '', ach: {}, sbc: {}, sbcDay: '',
      st: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, opened: 0, sold: 0, bought: 0, sbc: 0, rounds: 0, promo: 0, coinsEarned: 0 },
      level: FCK.settings && FCK.settings.profile === 'kids' ? 'rookie' : 'pro', half: 4, preset: 'p1', hist: [], created: Date.now(),
    };
    Cards.S = S; Cards._idx = {};
    // starter squad: 4-3-3 + bench + reserves
    const rng = U.makeRng(seed ^ 0x51a7e7);
    const xiPos = FCK.FORMATIONS['4-3-3'].map((s) => s.pos);
    const bPos = ['GK', 'CB', 'LB', 'CM', 'CAM', 'ST', 'RW'];
    xiPos.forEach((pos) => S.xi.push(Cards.add(S, Cards.gen(S, rng, { r: 0, pos, o: rng.int(55, 63) })).id));
    bPos.forEach((pos) => S.bench.push(Cards.add(S, Cards.gen(S, rng, { r: 0, pos, o: rng.int(50, 57) })).id));
    ['RB', 'CB', 'CDM'].forEach((pos) => Cards.add(S, Cards.gen(S, rng, { r: 0, pos, o: rng.int(48, 56) })));
    S.cards.forEach((c) => { c.nw = 0; });
    Cards.dayRoll(S);
    return S;
  };

  Cards.pack = function (S) {
    S = S || Cards.S;
    return JSON.parse(JSON.stringify(S));
  };
  Cards.save = function () { if (Cards.S) U.store.set('cards', Cards.S); };
  Cards.valid = function (o) {
    return !!(o && typeof o === 'object' && Array.isArray(o.cards) && Array.isArray(o.xi) && typeof o.coins === 'number' && o.team && o.rank && o.st);
  };
  Cards.install = function (o) {
    const base = Cards.fresh(o.seed);
    const S = Object.assign({}, base, o);
    ['team', 'inv', 'mk', 'rank', 'day', 'st', 'ach', 'sbc'].forEach((k) => { S[k] = Object.assign({}, base[k], o[k] || {}); });
    S.list = o.list || []; S.news = o.news || []; S.hist = o.hist || []; S.bench = o.bench || [];
    Cards.S = S; Cards.reindex();
    Cards.fix(S);
    return S;
  };
  Cards.load = function () {
    const o = U.store.get('cards', null);
    if (Cards.valid(o)) return Cards.install(o);
    return null;
  };
  Cards.ensure = function () {
    if (!Cards.S) { if (!Cards.load()) { Cards.fresh(); Cards.save(); } }
    return Cards.S;
  };
  Cards.reset = function () { U.store.del('cards'); Cards.S = null; return Cards.ensure(); };
  Cards.exportText = function () { return 'FCKC1:' + btoa(unescape(encodeURIComponent(JSON.stringify(Cards.S)))); };
  Cards.importText = function (txt) {
    try {
      txt = (txt || '').trim();
      if (!txt.startsWith('FCKC1:')) return false;
      const o = JSON.parse(decodeURIComponent(escape(atob(txt.slice(6)))));
      if (!Cards.valid(o)) return false;
      Cards.install(o); Cards.save();
      return true;
    } catch (e) { return false; }
  };

  // make lineup/bench consistent: valid ids, no duplicates, right sizes
  Cards.fix = function (S) {
    S = S || Cards.S;
    const n = (FCK.FORMATIONS[S.form] || FCK.FORMATIONS['4-3-3']).length;
    const used = new Set();
    const keep = (id) => { if (id && Cards._idx[id] && !used.has(id)) { used.add(id); return id; } return 0; };
    S.xi = Array.from({ length: n }, (_, i) => keep(S.xi[i]));
    S.bench = Array.from({ length: 7 }, (_, i) => keep(S.bench[i]));
    S.list = S.list.filter((l) => Cards._idx[l.id] && !used.has(l.id));
    if (S.xi.some((x) => !x) && S.cards.length >= 11) Cards.autoFill(S);
  };
  Cards.locked = function (S) {
    S = S || Cards.S;
    const set = new Set();
    S.xi.forEach((i) => i && set.add(i)); S.bench.forEach((i) => i && set.add(i)); S.list.forEach((l) => set.add(l.id));
    return set;
  };

  // ---------------------------------------------------------------- auto lineup
  Cards.score = function (form, ids) { const e = Cards.eval(form, ids); return e.sum + e.chem * 0.05; };
  Cards.autoLineup = function (S, form, exclude) {
    form = form || S.form;
    const slots = FCK.FORMATIONS[form];
    const pool = S.cards.filter((c) => !(exclude && exclude.has(c.id)));
    const ids = new Array(slots.length).fill(0);
    const used = new Set();
    const order = slots.map((s, i) => i).sort((a, b) => (slots[a].pos === 'GK' ? -1 : 0) - (slots[b].pos === 'GK' ? -1 : 0));
    order.forEach((i) => {
      let best = null, bs = -1e9;
      pool.forEach((c) => {
        if (used.has(c.id)) return;
        const cost = Cards.posCost(c.pos, slots[i].pos);
        const sc = c.o - cost * 1.6;
        if (sc > bs) { bs = sc; best = c; }
      });
      if (best) { ids[i] = best.id; used.add(best.id); }
    });
    // local improvement with chemistry
    let cur = Cards.score(form, ids);
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let i = 0; i < slots.length; i++) {
        let bestId = 0, bestSc = cur;
        for (const c of pool) {
          if (used.has(c.id) && c.id !== ids[i]) continue;
          if (c.id === ids[i]) continue;
          if (c.o < 40) continue;
          const keep = ids[i];
          ids[i] = c.id;
          const sc = Cards.score(form, ids);
          ids[i] = keep;
          if (sc > bestSc + 1e-6) { bestSc = sc; bestId = c.id; }
        }
        if (bestId) { used.delete(ids[i]); ids[i] = bestId; used.add(bestId); cur = bestSc; changed = true; }
      }
      if (!changed) break;
    }
    return ids;
  };
  Cards.autoBench = function (S, xi, exclude) {
    const used = new Set(xi);
    const rest = S.cards.filter((c) => !used.has(c.id) && !(exclude && exclude.has(c.id))).sort((a, b) => b.o - a.o);
    const bench = [];
    const take = (pred) => { const c = rest.find((x) => pred(x) && !bench.includes(x.id)); if (c) bench.push(c.id); };
    take((c) => c.pos === 'GK');
    take((c) => ROLE[c.pos] === 'DF'); take((c) => ROLE[c.pos] === 'DF');
    take((c) => ROLE[c.pos] === 'MF'); take((c) => ROLE[c.pos] === 'MF');
    take((c) => ROLE[c.pos] === 'FW');
    rest.forEach((c) => { if (bench.length < 7 && !bench.includes(c.id)) bench.push(c.id); });
    while (bench.length < 7) bench.push(0);
    return bench.slice(0, 7);
  };
  Cards.autoFill = function (S) {
    S = S || Cards.S; S.dirty = 0;
    const ex = new Set(S.list.map((l) => l.id));
    S.xi = Cards.autoLineup(S, S.form, ex);
    S.bench = Cards.autoBench(S, S.xi, ex);
  };
  Cards.setForm = function (S, form) {
    if (!FCK.FORMATIONS[form] || form === S.form) return;
    S.form = form;
    const ex = new Set(S.list.map((l) => l.id));
    S.xi = Cards.autoLineup(S, form, ex);
    S.bench = Cards.autoBench(S, S.xi, ex);
  };
  // put card into xi slot i (swaps if it was already somewhere in the lineup / bench)
  Cards.place = function (S, where, i, id) {
    const arr = where === 'xi' ? S.xi : S.bench;
    const old = arr[i];
    const inXi = S.xi.indexOf(id), inB = S.bench.indexOf(id);
    if (inXi >= 0) S.xi[inXi] = old || 0;
    if (inB >= 0) S.bench[inB] = old || 0;
    arr[i] = id;
  };
  Cards.teamEval = (S) => Cards.eval(S.form, S.xi);

  // ---------------------------------------------------------------- club object for the match engine
  Cards.club = function (S, rating) {
    const t = S.team, pal = PALETTES[t.pal % PALETTES.length];
    const key = [t.name, t.pal, t.shape, t.pattern, t.emblem, t.kit].join('|');
    const short = t.name.replace(/[^A-Za-zÄÖÜäöü]/g, '').toUpperCase().slice(0, 3) || 'FCK';
    return {
      id: 'cm' + W.hash(key).toString(36), name: t.name, short, cc: 'de', league: 'FCK Karten-Liga', lname: 'Karten', country: 'x', tier: 0, rating: Math.round(rating || 60),
      colors: { p: pal[0], s: pal[1], t: FCK.color && FCK.color.lum(pal[0]) > 0.55 ? '#14213d' : '#ffffff' }, kit: t.kit, crest: { shape: t.shape, pattern: t.pattern, emblem: t.emblem },
      stadium: t.stadium, cap: 30000, world: false, mine: true,
    };
  };

  // ---------------------------------------------------------------- packs
  Cards.packCards = function (S, id, rng) {
    const P = Cards.PACKS[id];
    const out = [];
    for (let i = 0; i < P.n; i++) out.push(Cards.gen(S, rng, { w: P.w }));
    if (!out.some((c) => c.r >= P.min)) {
      const k = rng.int(0, P.n - 1);
      out[k] = Cards.gen(S, rng, { w: P.w, min: P.min });
      if (out[k].r < P.min) out[k] = Cards.gen(S, rng, { r: P.min });
    }
    return out;
  };
  Cards.buyPack = function (S, id) {
    const P = Cards.PACKS[id]; if (!P) return 'bad';
    if (S.coins < P.price) return 'coins';
    S.coins -= P.price; S.inv[id] = (S.inv[id] || 0) + 1;
    return 'ok';
  };
  Cards.invCount = (S) => Cards.PACK_KEYS.reduce((a, k) => a + (S.inv[k] || 0), 0);
  // opens one pack from the inventory. Returns the new cards (already in the collection)
  Cards.openPack = function (S, id) {
    if (!Cards.PACKS[id] || !(S.inv[id] > 0)) return null;
    if (S.cards.length + Cards.PACKS[id].n > Cards.MAXCARDS) return 'full';
    S.inv[id]--; if (!S.inv[id]) delete S.inv[id];
    const rng = U.makeRng(S.seed ^ Math.imul(S.nid, 2654435761) ^ (S.st.opened * 7919 + 13));
    const cs = Cards.packCards(S, id, rng);
    cs.forEach((c) => { c.nw = 1; Cards.add(S, c); });
    S.dirty = 1;
    S.st.opened++;
    Cards.bump(S, 'opened', 1);
    return cs;
  };
  Cards.claimDaily = function (S) {
    const t = Cards.today();
    if (S.gift === t) return false;
    S.gift = t; S.inv.bronze = (S.inv.bronze || 0) + 1;
    return true;
  };

  // ---------------------------------------------------------------- selling
  Cards.quickSell = function (S, ids) {
    const lock = Cards.locked(S);
    let sum = 0, n = 0;
    ids.forEach((id) => {
      const c = Cards.card(id); if (!c || lock.has(id)) return;
      sum += Cards.sellValue(c); n++;
      S.cards = S.cards.filter((x) => x !== c); delete Cards._idx[id];
    });
    S.coins += sum; S.st.sold += n; if (n) Cards.bump(S, 'sold', n);
    return { sum, n };
  };
  Cards.listCard = function (S, id, price) {
    const c = Cards.card(id); if (!c) return 'bad';
    if (Cards.locked(S).has(id)) return 'locked';
    if (S.list.length >= Cards.MAXLIST) return 'max';
    const v = Cards.value(c);
    price = Math.round(U.clamp(price, Math.max(5, v * 0.5), v * 3));
    S.list.push({ id, price, age: 0 });
    return 'ok';
  };
  Cards.unlist = function (S, id) { S.list = S.list.filter((l) => l.id !== id); };
  Cards.saleChance = function (price, value) {
    const q = price / Math.max(1, value);
    return q <= 0.9 ? 0.9 : q <= 1.0 ? 0.65 : q <= 1.2 ? 0.35 : q <= 1.5 ? 0.12 : 0.03;
  };
  // called after each match: market tick + listings
  Cards.marketTick = function (S) {
    S.mk.tick++; S.mk.sold = {};
    const sold = [];
    const rng = U.makeRng(S.seed ^ (S.mk.tick * 40503) ^ 0x77);
    S.list = S.list.filter((l) => {
      const c = Cards.card(l.id); if (!c) return false;
      l.age++;
      if (rng.chance(Cards.saleChance(l.price, Cards.value(c)))) {
        const gain = Math.floor(l.price * 0.95);
        S.coins += gain; S.st.sold++; Cards.bump(S, 'sold', 1);
        S.cards = S.cards.filter((x) => x !== c); delete Cards._idx[c.id];
        sold.push({ n: c.n, o: c.o, gain });
        return false;
      }
      return l.age < 14;
    });
    sold.forEach((s) => S.news.unshift({ t: 'sold', n: s.n, g: s.gain }));
    S.news = S.news.slice(0, 20);
    Cards._stock = null;
    return sold;
  };

  // ---------------------------------------------------------------- transfer market
  Cards.stock = function (S) {
    if (Cards._stock && Cards._stock.tick === S.mk.tick && Cards._stock.seed === S.seed) return Cards._stock.items;
    const rng = U.makeRng(S.seed ^ Math.imul(S.mk.tick + 1, 2246822519) ^ 0x3d1);
    const items = [];
    for (let i = 0; i < 30; i++) {
      const c = Cards.gen(S, rng, { w: [46, 34, 15, 4.2, 0.8] });
      const price = Math.max(10, nice(Cards.value(c) * rng.range(0.9, 1.3)));
      items.push({ key: S.mk.tick + ':' + i, c, price });
    }
    Cards._stock = { tick: S.mk.tick, seed: S.seed, items };
    return items;
  };
  Cards.buyItem = function (S, item) {
    if (S.mk.sold[item.key]) return 'sold';
    if (S.coins < item.price) return 'coins';
    if (S.cards.length >= Cards.MAXCARDS) return 'full';
    S.coins -= item.price; S.mk.sold[item.key] = true;
    const c = Object.assign({}, item.c, { nw: 1 });
    Cards.add(S, c); S.dirty = 1;
    S.st.bought++; Cards.bump(S, 'bought', 1);
    return c;
  };

  // ---------------------------------------------------------------- daily tasks / achievements
  const DAILY = [
    { id: 'play2', k: 'played', need: 2, coins: 400 }, { id: 'play3', k: 'played', need: 3, coins: 600 },
    { id: 'win1', k: 'won', need: 1, coins: 500 }, { id: 'win2', k: 'won', need: 2, coins: 900 },
    { id: 'goals4', k: 'goals', need: 4, coins: 500 }, { id: 'goals8', k: 'goals', need: 8, coins: 900 },
    { id: 'clean1', k: 'clean', need: 1, coins: 700 }, { id: 'open2', k: 'opened', need: 2, coins: 350 },
    { id: 'sell3', k: 'sold', need: 3, coins: 300 }, { id: 'buy1', k: 'bought', need: 1, coins: 250 },
    { id: 'sbc1', k: 'sbc', need: 1, coins: 600 },
  ];
  Cards.DAILY = DAILY;
  Cards.dayRoll = function (S) {
    const t = Cards.today();
    if (S.day.date === t) return false;
    const rng = U.makeRng(W.hash(t) ^ S.seed);
    const pool = DAILY.slice();
    const play = pool.filter((d) => d.k === 'played' || d.k === 'won');
    const pick = [rng.pick(play)];
    const rest = pool.filter((d) => !pick.includes(d) && d.k !== pick[0].k);
    while (pick.length < 3 && rest.length) { const d = rest.splice(rng.int(0, rest.length - 1), 1)[0]; if (!pick.some((p) => p.k === d.k)) pick.push(d); }
    S.day = { date: t, c: {}, claimed: {}, ids: pick.map((d) => d.id) };
    return true;
  };
  Cards.bump = function (S, k, n) { S.day.c[k] = (S.day.c[k] || 0) + n; };
  Cards.dayTasks = function (S) {
    Cards.dayRoll(S);
    return S.day.ids.map((id) => {
      const d = DAILY.find((x) => x.id === id);
      const have = Math.min(d.need, S.day.c[d.k] || 0);
      return Object.assign({ have, done: have >= d.need, claimed: !!S.day.claimed[id] }, d);
    });
  };
  Cards.claimTask = function (S, id) {
    const t = Cards.dayTasks(S).find((x) => x.id === id);
    if (!t || !t.done || t.claimed) return null;
    S.day.claimed[id] = true; S.coins += t.coins; S.st.coinsEarned += t.coins;
    let bonus = null;
    if (S.day.ids.every((i) => S.day.claimed[i])) { S.inv.silver = (S.inv.silver || 0) + 1; bonus = 'silver'; }
    return { coins: t.coins, bonus };
  };

  const ACH = [
    { id: 'win10', f: (S) => S.st.won, need: 10, pack: 'silver' }, { id: 'win50', f: (S) => S.st.won, need: 50, pack: 'gold' }, { id: 'win200', f: (S) => S.st.won, need: 200, pack: 'prem' },
    { id: 'goal100', f: (S) => S.st.gf, need: 100, pack: 'gold' },
    { id: 'div8', f: (S) => 11 - S.rank.best, need: 3, pack: 'silver' }, { id: 'div5', f: (S) => 11 - S.rank.best, need: 6, pack: 'gold' },
    { id: 'div3', f: (S) => 11 - S.rank.best, need: 8, pack: 'prem' }, { id: 'div1', f: (S) => 11 - S.rank.best, need: 10, pack: 'legend' },
    { id: 'cards60', f: (S) => S.cards.length, need: 60, coins: 2000 }, { id: 'cards150', f: (S) => S.cards.length, need: 150, pack: 'gold' },
    { id: 'gold5', f: (S) => S.cards.filter((c) => c.r >= 2).length, need: 5, coins: 3000 },
    { id: 'elite', f: (S) => S.cards.filter((c) => c.r >= 3).length, need: 1, pack: 'prem' },
    { id: 'legend', f: (S) => S.cards.filter((c) => c.r >= 4).length, need: 1, coins: 25000 },
    { id: 'chem', f: (S) => Cards.teamEval(S).chem, need: 24, pack: 'gold' },
    { id: 'sbc5', f: (S) => S.st.sbc, need: 5, pack: 'prem' },
  ];
  Cards.ACH = ACH;
  Cards.achList = (S) => ACH.map((a) => { const have = Math.min(a.need, a.f(S)); return Object.assign({ have, done: have >= a.need, claimed: !!S.ach[a.id] }, a); });
  Cards.claimAch = function (S, id) {
    const a = Cards.achList(S).find((x) => x.id === id);
    if (!a || !a.done || a.claimed) return null;
    S.ach[id] = true;
    if (a.pack) S.inv[a.pack] = (S.inv[a.pack] || 0) + 1;
    if (a.coins) { S.coins += a.coins; S.st.coinsEarned += a.coins; }
    return { pack: a.pack || null, coins: a.coins || 0 };
  };
  Cards.openClaims = (S) => Cards.dayTasks(S).filter((t) => t.done && !t.claimed).length + Cards.achList(S).filter((a) => a.done && !a.claimed).length;

  // ---------------------------------------------------------------- squad building challenges
  const SBC = [
    { id: 'swap1', n: 5, req: { maxR: 0 }, reward: { pack: 'silver' } },
    { id: 'gk3', n: 3, req: { posN: { pos: ['GK'], n: 3 }, avg: 58 }, reward: { coins: 1200 } },
    { id: 'nation', n: 7, req: { nat: 4, avg: 60 }, reward: { pack: 'silver' } },
    { id: 'swap2', n: 6, req: { maxR: 1, avg: 66 }, reward: { pack: 'gold' } },
    { id: 'club2', n: 8, req: { club: 2, avg: 62 }, reward: { pack: 'silver' } },
    { id: 'league', n: 8, req: { league: 5, avg: 63 }, reward: { coins: 2500 } },
    { id: 'fw3', n: 3, req: { posN: { pos: ['ST', 'LW', 'RW'], n: 3 }, avg: 70 }, reward: { pack: 'gold' } },
    { id: 'gold1', n: 8, req: { avg: 71, minR: 1 }, reward: { pack: 'gold' } },
    { id: 'gold2', n: 10, req: { avg: 75 }, reward: { pack: 'prem' } },
    { id: 'elite', n: 11, req: { avg: 80, nat: 3 }, reward: { pack: 'legend' } },
  ];
  Cards.SBC = SBC;
  Cards.SBC_DAILY = { id: 'daily', n: 4, req: { maxR: 1, avg: 58 }, reward: { coins: 400 }, daily: true };
  Cards.sbcChecks = function (def, cards) {
    const r = def.req, out = [];
    const n = cards.length;
    out.push({ k: 'n', have: n, need: def.n, ok: n === def.n });
    const avg = n ? cards.reduce((a, c) => a + c.o, 0) / n : 0;
    if (r.avg) out.push({ k: 'avg', have: Math.round(avg * 10) / 10, need: r.avg, ok: n > 0 && avg >= r.avg });
    if (r.maxR !== undefined) out.push({ k: 'maxR', have: cards.filter((c) => c.r > r.maxR).length, need: 0, ok: cards.every((c) => c.r <= r.maxR), v: r.maxR });
    if (r.minR !== undefined) out.push({ k: 'minR', have: cards.filter((c) => c.r >= r.minR).length, need: 1, ok: cards.some((c) => c.r >= r.minR), v: r.minR });
    const mx = (f) => { const m = {}; let best = 0; cards.forEach((c) => { const k = f(c); m[k] = (m[k] || 0) + 1; if (m[k] > best) best = m[k]; }); return best; };
    if (r.nat) out.push({ k: 'nat', have: mx((c) => c.nt), need: r.nat, ok: mx((c) => c.nt) >= r.nat });
    if (r.club) out.push({ k: 'club', have: mx((c) => c.cl), need: r.club, ok: mx((c) => c.cl) >= r.club });
    if (r.league) out.push({ k: 'league', have: mx((c) => Cards.leagueKey(Cards.clubOf(c))), need: r.league, ok: mx((c) => Cards.leagueKey(Cards.clubOf(c))) >= r.league });
    if (r.posN) { const h = cards.filter((c) => r.posN.pos.includes(c.pos)).length; out.push({ k: 'posN', have: h, need: r.posN.n, ok: h >= r.posN.n, v: r.posN.pos.join('/') }); }
    return out;
  };
  Cards.sbcAvailable = function (S, def) {
    if (def.daily) return S.sbcDay !== Cards.today();
    return !S.sbc[def.id];
  };
  Cards.sbcSubmit = function (S, def, ids) {
    if (!Cards.sbcAvailable(S, def)) return 'done';
    const lock = Cards.locked(S);
    if (ids.some((i) => lock.has(i))) return 'locked';
    const cards = ids.map((i) => Cards.card(i));
    if (cards.some((c) => !c)) return 'bad';
    if (!Cards.sbcChecks(def, cards).every((c) => c.ok)) return 'req';
    S.cards = S.cards.filter((c) => !ids.includes(c.id)); ids.forEach((i) => { delete Cards._idx[i]; });
    if (def.daily) S.sbcDay = Cards.today(); else S.sbc[def.id] = true;
    S.st.sbc++; Cards.bump(S, 'sbc', 1);
    const rw = def.reward;
    if (rw.pack) S.inv[rw.pack] = (S.inv[rw.pack] || 0) + 1;
    if (rw.coins) { S.coins += rw.coins; S.st.coinsEarned += rw.coins; }
    return 'ok';
  };

  // ---------------------------------------------------------------- league ladder / matches
  Cards.oppRating = (div) => 48 + (Cards.DIVS - div) * 4.4;
  Cards.divMul = (div) => 1 + (Cards.DIVS - div) * 0.15;
  // opponents are invented clubs (name, colours, crest, stadium) of a fitting strength; their squads are generated like all squads
  const FK_PRE = ['FC', 'SC', 'SV', 'Real', 'Dynamo', 'Sporting', 'Union', 'Rapid', 'Olympia', 'Victoria', 'Atletic', 'Racing', 'Inter', 'Stern', 'United'];
  const FK_PLACE = ['Nordhafen', 'Sonnental', 'Eisbach', 'Rotwald', 'Blaufeld', 'Goldküste', 'Silberberg', 'Mondstadt', 'Falkenau', 'Steinbruck', 'Wellenburg', 'Kornfeld', 'Lindenau', 'Adlerhorst', 'Sturmhafen', 'Birkenau', 'Felsenburg', 'Seewiesen', 'Rabenstein', 'Windmark', 'Tannenhain', 'Kupferstadt', 'Nebelgrund', 'Sonnenhafen', 'Wolkenfels', 'Löwenau', 'Quellental', 'Bernsdorf', 'Ostmark', 'Hirschfeld'];
  const FK_SUF = ['', '', '', ' 04', ' 09', ' 1912', ' City', ' Athletic', ' Albion'];
  const FK_KITS = ['solid', 'stripesV', 'hoops', 'halves', 'band', 'sash', 'sleeves'];
  const FK_SHAPES = ['round', 'shield', 'diamond'];
  const FK_PATTERNS = ['plain', 'halves', 'stripesV', 'chevron', 'bend', 'cross'];
  const FK_EMBLEMS = ['star', 'ball', 'bolt', 'crown', 'ring', 'tower', 'leaf'];
  Cards.fakeClub = function (rng, rating) {
    const name = rng.pick(FK_PRE) + ' ' + rng.pick(FK_PLACE) + rng.pick(FK_SUF);
    const pal = rng.pick(PALETTES);
    const co = rng.pick(W.countries.filter((c) => c.uefa));
    const short = name.replace(/^(FC|SC|SV) /, '').replace(/[^A-Za-zÄÖÜäöü]/g, '').toUpperCase().slice(0, 3);
    return {
      id: 'fk' + W.hash(name + '|' + Math.round(rating)).toString(36), name, short, cc: co.cc, country: co.cc, league: 'Ultimate Team', lname: 'Ultimate Team', tier: 1,
      rating: Math.round(rating), colors: { p: pal[0], s: pal[1], t: FCK.color && FCK.color.lum(pal[0]) > 0.55 ? '#14213d' : '#ffffff' }, kit: rng.pick(FK_KITS),
      crest: { shape: rng.pick(FK_SHAPES), pattern: rng.pick(FK_PATTERNS), emblem: rng.pick(FK_EMBLEMS) }, stadium: name.split(' ')[1] + ' Arena', cap: 12000 + rng.int(0, 40) * 1000, world: true, fake: true,
    };
  };
  Cards.opponent = function (S) {
    const rng = U.makeRng(W.hash('opp' + S.seed + ':' + S.st.rounds + ':' + S.rank.m));
    return Cards.fakeClub(rng, Cards.oppRating(S.rank.div) + rng.range(-2.2, 2.2));
  };
  const OPP_FORMS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '4-1-4-1', '5-3-2', '3-4-3'];
  Cards.buildCfg = function (S, kind, opp) {
    const form = S.form, ev = Cards.teamEval(S);
    const mine = Cards.club(S, ev.S);
    const lineup = ev.slots.map((s, i) => {
      const pos = FCK.FORMATIONS[form][i].pos;
      const p = Cards.player(s.c, pos, s.eff, i + 1);
      return p;
    });
    const bench = S.bench.map((id, k) => (id ? Cards.card(id) : null)).filter(Boolean).map((c, k) => Cards.player(c, c.pos, c.o, 12 + k));
    const rng = U.makeRng((W.hash(opp.id) ^ S.seed ^ (S.st.played * 977)) >>> 0);
    const oppForm = rng.pick(OPP_FORMS);
    const oppSq = opp.world ? FCK.pickSquad(W.squad(opp, (S.seed ^ S.st.rounds * 31) >>> 0), oppForm, null, 0) : null;
    if (oppSq) oppSq.lineup.concat(oppSq.bench).forEach((p) => { p.cid = opp.id; });
    const kids = FCK.settings.profile === 'kids';
    const lv = FCK.LEVELS[S.level] || FCK.LEVELS.pro;
    const settings = Object.assign({}, FCK.DEFAULT_MATCH, FCK.setup && FCK.setup.match, lv, {
      level: S.level, halfMins: S.half, knockout: false, aggLead: 0,
      weather: rng.pick(['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'snow']),
      tod: rng.pick(['day', 'day', 'evening', 'night']),
      homeFormation: form, awayFormation: oppForm, homeStyle: S.style, awayStyle: 'balanced',
    });
    if (kids) { settings.injuries = false; if (settings.referee === 'normal') settings.referee = 'lenient'; }
    const slots = FCK.presetSlots(S.preset).filter((s) => s.dev && s.dev !== 'none').map((s) => ({ dev: s.dev, team: s.team }));
    return { clubs: [mine, Object.assign({}, opp)], settings, slots, squads: [{ lineup, bench }, oppSq], cards: { kind, opp: opp.id, div: S.rank.div, xi: S.xi.slice() } };
  };
  Cards.canPlay = function (S) {
    const ev = Cards.teamEval(S);
    if (!ev.full) return 'xi';
    const gk = ev.slots[0].c;
    if (!gk || gk.pos !== 'GK') return 'gk';
    return null;
  };
  Cards.play = function (kind, opp) {
    const S = Cards.ensure();
    const err = Cards.canPlay(S);
    if (err) return err;
    opp = opp || Cards.opponent(S);
    FCK.game.kind = 'idle';
    FCK.startMatch(Cards.buildCfg(S, kind, opp));
    return null;
  };

  Cards.matchCoins = function (S, kind, res, gf, ga) {
    let v = res === 'W' ? 350 : res === 'D' ? 140 : 50;
    v += 25 * Math.min(6, gf) + (ga === 0 ? 60 : 0);
    v *= kind === 'ladder' ? Cards.divMul(S.rank.div) : 0.25;
    return Math.round(v / 5) * 5;
  };
  Cards.PROMO_PTS = 10; Cards.RELEG_PTS = 3;
  Cards.packForDiv = (div) => (div >= 9 ? 'bronze' : div >= 7 ? 'silver' : div >= 4 ? 'gold' : div >= 2 ? 'prem' : 'legend');

  // result of a finished engine match (or simulated by tests). g = [goals mine, goals opp]
  Cards.applyResult = function (S, ctx, g, scorers, appearedIds) {
    const gf = g[0], ga = g[1];
    const res = gf > ga ? 'W' : gf < ga ? 'L' : 'D';
    const coins = Cards.matchCoins(S, ctx.kind, res, gf, ga);
    S.coins += coins; S.st.coinsEarned += coins;
    S.st.played++; S.st.gf += gf; S.st.ga += ga;
    if (res === 'W') S.st.won++; else if (res === 'D') S.st.drawn++; else S.st.lost++;
    (scorers || []).forEach((id) => { const c = Cards.card(id); if (c) c.gl++; });
    (appearedIds || []).forEach((id) => { const c = Cards.card(id); if (c) c.ap++; });
    Cards.bump(S, 'played', 1); Cards.bump(S, 'goals', gf);
    if (res === 'W') Cards.bump(S, 'won', 1);
    if (ga === 0) Cards.bump(S, 'clean', 1);
    const info = { kind: ctx.kind, res, gf, ga, coins, opp: ctx.opp, round: null, div: S.rank.div };
    if (ctx.kind === 'ladder') {
      const R = S.rank;
      R.pts += res === 'W' ? 3 : res === 'D' ? 1 : 0; R.m++; R.res.push(res);
      if (R.m >= Cards.ROUND) {
        const was = R.div, pts = R.pts;
        let outcome = 'stay';
        if (pts >= Cards.PROMO_PTS) outcome = was > 1 ? 'up' : 'champ'; else if (pts <= Cards.RELEG_PTS && was < Cards.DIVS) outcome = 'down';
        const base = Math.round(800 * (1 + (Cards.DIVS - was) * 0.6) / 50) * 50;
        const rc = outcome === 'up' || outcome === 'champ' ? base : outcome === 'stay' ? Math.round(base / 2 / 50) * 50 : Math.round(base / 5 / 50) * 50;
        S.coins += rc; S.st.coinsEarned += rc;
        let pack = null;
        if (outcome === 'up' || outcome === 'champ') { pack = Cards.packForDiv(was); S.inv[pack] = (S.inv[pack] || 0) + 1; }
        if (outcome === 'up') { R.div = was - 1; S.st.promo++; } else if (outcome === 'down') R.div = was + 1;
        R.best = Math.min(R.best, R.div);
        S.st.rounds++;
        info.round = { pts, from: was, to: R.div, outcome, coins: rc, pack, res: R.res.slice() };
        R.pts = 0; R.m = 0; R.res = [];
      }
    }
    S.hist.unshift({ k: ctx.kind, r: res, a: gf, b: ga, o: ctx.oppName || '', d: S.rank.div });
    S.hist = S.hist.slice(0, 12);
    info.sold = Cards.marketTick(S);
    S.last = info;
    return info;
  };
  Cards.onResult = function (m) {
    const S = Cards.S, ctx = m.cardsCtx;
    if (!S || !ctx || ctx.done) return null;
    ctx.done = true;
    ctx.oppName = m.teams[1].club.name;
    const scorers = [];
    m.goals.forEach((gl) => { if (gl.team === 0 && !gl.og && gl.scorer && gl.scorer.d && gl.scorer.d.cardId) scorers.push(gl.scorer.d.cardId); });
    const g = [m.teams[0].score, m.teams[1].score];
    const info = Cards.applyResult(S, ctx, g, scorers, ctx.xi);
    Cards.save();
    return info;
  };
})((globalThis.FCK = globalThis.FCK || {}));
