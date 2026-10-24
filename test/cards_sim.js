// node test/cards_sim.js : card mode logic smoke test (no browser)
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'i18n', 'i18n_career', 'worlddata', 'world', 'season', 'sim', 'rules', 'ai', 'cards'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
FCK.setup = { match: Object.assign({}, FCK.DEFAULT_MATCH) };
FCK.presetSlots = () => [];
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
globalThis.btoa = globalThis.btoa || ((s) => Buffer.from(s, 'binary').toString('base64'));
globalThis.unescape = globalThis.unescape || require('querystring').unescape;
const W = FCK.World.build(), C = FCK.Cards, U = FCK.U;
let errs = 0; const err = (m) => { errs++; if (errs < 30) console.log('ERR', m); };
const ok = (c, m) => { if (!c) err(m); };

// ---- fresh state
let t0 = Date.now();
const S = C.fresh(12345);
console.log('fresh', Date.now() - t0, 'ms', S.cards.length, 'cards', 'coins', S.coins);
ok(S.cards.length === 21, 'starter size');
ok(S.xi.length === 11 && S.xi.every((x) => x), 'xi filled');
ok(S.bench.length === 7 && S.bench.every((x) => x), 'bench filled');
let ev = C.teamEval(S);
console.log('starter S', ev.S.toFixed(1), 'chem', ev.chem, 'full', ev.full, 'gk', ev.slots[0].c.pos);
ok(ev.full && ev.slots[0].c.pos === 'GK', 'starter xi complete with GK');
ok(C.canPlay(S) === null, 'can play');

// ---- pack economics: quick-sell value vs price
console.log('pack EV (quick-sell / market value) and rarity mix');
for (const id of C.PACK_KEYS) {
  const P = C.PACKS[id]; const rng = U.makeRng(99);
  let qs = 0, mv = 0, n = 0; const mix = [0, 0, 0, 0, 0]; let minOk = 0;
  for (let i = 0; i < 4000; i++) {
    const cs = C.packCards(S, id, rng);
    ok(cs.length === P.n, 'pack size ' + id);
    if (cs.some((c) => c.r >= P.min)) minOk++;
    cs.forEach((c) => { qs += C.sellValue(c); mv += C.value(c); n++; mix[c.r]++; });
  }
  console.log(' ', id.padEnd(7), 'price', String(P.price).padStart(6), 'qs/pack', String(Math.round(qs / 4000)).padStart(6), '(' + (qs / 4000 / P.price).toFixed(2) + ')', 'market/pack', String(Math.round(mv / 4000)).padStart(7), '(' + (mv / 4000 / P.price).toFixed(2) + ')', 'mix%', mix.map((x) => (100 * x / n).toFixed(1)).join('/'), 'min ok', minOk === 4000);
  ok(minOk === 4000, 'pack guarantee ' + id);
}

// ---- generation sanity
{
  const rng = U.makeRng(5); const byR = [0, 0, 0, 0, 0]; let bad = 0; const nats = {};
  for (let i = 0; i < 3000; i++) {
    const c = C.gen(S, rng, {});
    byR[c.r]++;
    if (!W.byId[c.cl]) bad++;
    if (c.o < 40 || c.o > 97) bad++;
    nats[c.nt] = 1;
    const p = C.player(c, c.pos, c.o, 9);
    if (!p.look || !p.a || p.ovr !== c.o) bad++;
  }
  ok(!bad, 'gen invalid ' + bad);
  console.log('gen mix', byR.join('/'), 'nations', Object.keys(nats).length);
  // top players sit at strong clubs
  const hi = []; for (let i = 0; i < 400; i++) { const c = C.gen(S, rng, { r: 3 }); hi.push(W.byId[c.cl].rating); }
  console.log('club rating of elite cards avg', (hi.reduce((a, b) => a + b, 0) / hi.length).toFixed(1));
}

// ---- chemistry
{
  const form = '4-4-2';
  S.form = form;
  const mk = (nt, cl, pos, o) => C.add(S, Object.assign(C.gen(S, U.makeRng(o + 1), { pos, o }), { nt, cl }));
  const ids = [];
  const slots = FCK.FORMATIONS[form];
  const club = W.clubs.find((c) => c.tier === 1 && c.cc === 'de');
  slots.forEach((s) => ids.push(mk('de', club.id, s.pos, 70).id));
  const e = C.eval(form, ids);
  console.log('all same club/nation chem', e.chem, '/33 S', e.S);
  ok(e.chem === 33, 'perfect chem 33 got ' + e.chem);
  ok(Math.abs(e.S - 73) < 1e-9, 'eff = 70+3');
  // wrong position
  const ids2 = ids.slice(); const kid = mk('de', club.id, 'ST', 70).id; ids2[0] = kid; // ST in GK slot
  const e2 = C.eval(form, ids2);
  ok(e2.slots[0].chem === 0 && e2.slots[0].eff < 50, 'GK slot penalty');
  // remove cards again
  S.cards = S.cards.filter((c) => !ids.includes(c.id) && c.id !== kid); C.reindex();
}
S.form = '4-3-3';

// ---- open packs, auto lineup
S.inv = { bronze: 3, silver: 2, gold: 2, prem: 1, legend: 1 };
let opened = 0, newbies = 0;
for (const id of C.PACK_KEYS) { while (S.inv[id]) { const r = C.openPack(S, id); ok(Array.isArray(r), 'open ' + id); if (Array.isArray(r)) { opened++; newbies += r.length; } } }
console.log('opened', opened, 'packs ->', S.cards.length, 'cards');
ok(S.cards.length === 21 + newbies, 'cards added');
t0 = Date.now(); C.autoFill(S); console.log('autoFill', Date.now() - t0, 'ms');
ev = C.teamEval(S);
console.log('after packs S', ev.S.toFixed(1), 'chem', ev.chem, 'best card', Math.max(...S.cards.map((c) => c.o)));
ok(ev.full && new Set(S.xi).size === 11, 'auto xi valid');
ok(new Set(S.xi.concat(S.bench.filter(Boolean))).size === 11 + S.bench.filter(Boolean).length, 'no dup between xi/bench');
// bigger collection for timing
for (let i = 0; i < 300; i++) C.add(S, C.gen(S, U.makeRng(1000 + i), {}));
t0 = Date.now(); C.autoFill(S); console.log('autoFill 320 cards', Date.now() - t0, 'ms', C.teamEval(S).S.toFixed(1));
ok(Date.now() - t0 < 2500, 'autoFill speed');
for (const f of FCK.FORMATION_NAMES) { C.setForm(S, f); const e = C.teamEval(S); ok(e.full, 'formation ' + f); }
C.setForm(S, '4-3-3');

// ---- real match with the engine (card squads must be accepted)
{
  S.preset = 'cpu';
  const opp = C.opponent(S);
  ok(opp.fake && !W.byId[opp.id] && opp.name === C.opponent(S).name, 'opponent is an invented, stable club');
  const cfg = C.buildCfg(S, 'ladder', opp);
  ok(cfg.squads[0].lineup.length === 11 && cfg.squads[0].bench.length === 7, 'cfg squad sizes');
  const m = new FCK.Match({ clubs: cfg.clubs, settings: cfg.settings, slots: [], squads: cfg.squads });
  m.autoProceed = true; m.cardsCtx = cfg.cards;
  let steps = 0; while (m.mode !== 'over' && steps < 60 * 60 * 40) { m.update(1 / 60); steps++; }
  console.log('match', cfg.clubs[0].name, m.teams[0].score + ':' + m.teams[1].score, opp.name, 'steps', steps, 'mode', m.mode);
  ok(m.mode === 'over', 'match finished');
  const before = S.coins;
  const info = C.onResult(m);
  ok(info && S.coins > before, 'coins paid');
  console.log(' result', info.res, 'coins +' + info.coins, 'goals by cards', S.cards.filter((c) => c.gl).map((c) => c.n + ':' + c.gl).join(','));
  ok(!C.onResult(m), 'result applied once');
}

// ---- ladder: force results
{
  const R = S.rank; R.div = 10; R.pts = 0; R.m = 0; R.res = []; S.inv = {};
  const seq = ['W', 'W', 'W', 'D', 'L'];
  let last;
  seq.forEach((r) => { last = C.applyResult(S, { kind: 'ladder', opp: 'x' }, r === 'W' ? [2, 0] : r === 'D' ? [1, 1] : [0, 1]); });
  console.log('round1', JSON.stringify(last.round));
  ok(last.round && last.round.outcome === 'up' && R.div === 9 && R.m === 0, 'promotion');
  ok(S.inv.bronze === 1, 'promotion pack');
  ['L', 'L', 'L', 'L', 'L'].forEach((r) => { last = C.applyResult(S, { kind: 'ladder', opp: 'x' }, [0, 2]); });
  ok(last.round.outcome === 'down' && R.div === 10, 'relegation');
  ['L', 'L', 'L', 'L', 'L'].forEach((r) => { last = C.applyResult(S, { kind: 'ladder', opp: 'x' }, [0, 2]); });
  ok(R.div === 10, 'no relegation below 10');
  R.div = 1; ['W', 'W', 'W', 'W', 'W'].forEach(() => { last = C.applyResult(S, { kind: 'ladder', opp: 'x' }, [3, 0]); });
  ok(last.round.outcome === 'champ' && R.div === 1 && S.inv.legend === 1, 'champion keeps div 1 + legend pack');
  console.log('opponents by division', [10, 8, 6, 4, 2, 1].map((d) => { S.rank.div = d; const o = C.opponent(S); return d + ':' + o.name + '(' + o.rating + ')'; }).join(' | '));
  S.rank.div = 10;
}

// ---- market & selling
{
  S.coins = 100000; const items = C.stock(S);
  ok(items.length === 30, 'stock size');
  console.log('stock cheapest', Math.min(...items.map((i) => i.price)), 'priciest', Math.max(...items.map((i) => i.price)), 'rarities', items.map((i) => i.c.r).join(''));
  const it = items[0]; const n0 = S.cards.length;
  const got = C.buyItem(S, it); ok(typeof got === 'object' && S.cards.length === n0 + 1, 'buy');
  ok(C.buyItem(S, it) === 'sold', 'no double buy');
  const lock = C.locked(S);
  const spare = S.cards.filter((c) => !lock.has(c.id));
  const c1 = spare[0];
  ok(C.listCard(S, c1.id, C.value(c1) * 0.8) === 'ok', 'list');
  ok(C.listCard(S, S.xi[0], 10) === 'locked', 'xi locked');
  let soldN = 0; for (let i = 0; i < 6; i++) soldN += C.marketTick(S).length;
  console.log('listing sold within 6 ticks:', soldN, 'listings left', S.list.length);
  ok(soldN === 1 && S.list.length === 0, 'cheap listing sells');
  const q = C.quickSell(S, spare.slice(1, 4).map((c) => c.id)); console.log('quickSell', q);
  ok(q.n === 3 && q.sum > 0, 'quick sell');
  ok(C.quickSell(S, [S.xi[0]]).n === 0, 'cannot sell xi card');
  // restock changes with tick
  ok(C.stock(S)[0].key !== it.key, 'stock refreshed');
}

// ---- daily / tasks / achievements / sbc
{
  const t = C.dayTasks(S); console.log('daily', t.map((x) => x.id + ':' + x.have + '/' + x.need).join(' '));
  ok(t.length === 3, 'three daily tasks');
  t.forEach((x) => { S.day.c[x.k] = x.need; });
  let bonus = null; C.dayTasks(S).forEach((x) => { const r = C.claimTask(S, x.id); ok(r, 'claim ' + x.id); if (r && r.bonus) bonus = r.bonus; });
  ok(bonus === 'silver', 'bonus pack after all three');
  ok(C.claimTask(S, t[0].id) === null, 'no double claim');
  ok(C.claimDaily(S) === true && C.claimDaily(S) === false, 'daily gift once');
  const ach = C.achList(S); console.log('ach claimable', ach.filter((a) => a.done).map((a) => a.id).join(','));
  // sbc
  const lock = C.locked(S);
  const brz = []; for (let i = 0; i < 6; i++) brz.push(C.add(S, C.gen(S, U.makeRng(7000 + i), { r: 0 })));
  const def = C.SBC.find((d) => d.id === 'swap1');
  const checks = C.sbcChecks(def, brz.slice(0, 5)); ok(checks.every((c) => c.ok), 'swap1 checks');
  ok(C.sbcChecks(def, brz).some((c) => !c.ok), 'swap1 wrong n');
  const inv0 = S.inv.silver || 0;
  ok(C.sbcSubmit(S, def, brz.slice(0, 5).map((c) => c.id)) === 'ok', 'sbc submit');
  ok((S.inv.silver || 0) === inv0 + 1, 'sbc reward');
  ok(C.sbcSubmit(S, def, brz.slice(5).map((c) => c.id)) === 'done', 'sbc only once');
  const d2 = C.SBC_DAILY; ok(C.sbcAvailable(S, d2), 'daily sbc available');
  ok(C.sbcSubmit(S, d2, brz.slice(5).concat(S.cards.filter((c) => !C.locked(S).has(c.id) && c.r <= 1).slice(0, 3)).map((c) => c.id)) !== 'locked', 'daily sbc not locked');
  // every SBC is feasible with a rich collection
  const big = []; const rng = U.makeRng(31337); for (let i = 0; i < 400; i++) big.push(C.gen(S, rng, { w: [20, 30, 30, 15, 5] }));
  console.log('sbc definitions:', C.SBC.map((d) => d.id + ':' + d.n).join(' '));
}

// ---- export / import round trip
{
  C.save();
  const txt = C.exportText(); console.log('export size', txt.length);
  const snapshot = JSON.stringify(C.S);
  C.S = null; ok(C.importText(txt), 'import'); ok(JSON.stringify(C.S) === snapshot, 'roundtrip identical');
  ok(!C.importText('FCKC1:xxxx') && !C.importText('hello'), 'bad import rejected');
  const loaded = C.load(); ok(loaded && loaded.cards.length === C.S.cards.length, 'store load');
  // corrupted xi is repaired
  C.S.xi[3] = 99999; C.S.bench[0] = C.S.xi[1]; C.fix(C.S);
  ok(C.canPlay(C.S) === null && new Set(C.S.xi).size === 11, 'fix repairs xi');
  // old/partial state
  const cut = JSON.parse(snapshot); delete cut.sbcDay; delete cut.news; delete cut.mk; C.install(cut); ok(C.S.mk && C.S.mk.tick >= 0, 'missing keys filled');
}
console.log(errs ? 'FAILED ' + errs : 'ALL OK');
process.exit(errs ? 1 : 0);
