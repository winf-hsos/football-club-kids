// node test/own_sim.js : own editor clubs in the career (replace a real club, persistence, restore)
globalThis.window = { localStorage: null };
globalThis.FCK = {};
const fs = require('fs'), path = require('path');
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'squad', 'natdata', 'names', 'crest', 'i18n', 'i18n_career', 'worlddata', 'world', 'season', 'manager', 'market', 'youth', 'mgrseason', 'career', 'editor'].forEach(load);
FCK.settings = { lang: 'de', profile: 'normal' };
FCK.T = (k) => k;
const W = FCK.World.build(), C = FCK.Career, Ed = FCK.Editor;
let errs = 0; const err = (m) => { errs++; console.log('ERR', m); };
const assert = (c, m) => { if (!c) err(m); };
Ed.data = Ed.empty(); Ed.register();
const own = Ed.newClub({ name: 'FC Testhausen', short: 'FCT', group: 'de', r: 70 });
assert(own && own.custom, 'new club');
const rec = Ed.data.clubs[0];
const slot = C.suggestSlot(rec);
assert(slot && slot.tier === 1, 'slot suggestion ' + (slot && slot.name));
const before = JSON.stringify({ n: slot.name, c: slot.colors, r: slot.r, rating: slot.rating, st: slot.stadium });
const sqBefore = W.squad(slot, 1).map((p) => p.name).join(',');
const c = C.create({ clubId: slot.id, custom: rec, seed: 99, easy: true });
assert(c && c.custom, 'career created');
assert(W.clubs[slot.idx].name === 'FC Testhausen', 'name applied');
assert(c.m.players.length >= 18, 'squad ' + c.m.players.length);
const sq = W.squad(W.clubs[slot.idx], 1).map((p) => p.name).join(',');
assert(sq !== sqBefore, 'squad replaced');
const ovrAvg = Math.round(c.m.players.slice().sort((a, b) => b.o - a.o).slice(0, 14).reduce((a, p) => a + p.o, 0) / 14);
console.log('own career', c.name, 'S', c.m.S, 'avg14', ovrAvg);
// play two matchdays by simulation
for (let i = 0; i < 6; i++) { const nx = C.next(); if (!nx) break; C.simulate && C.simulate(nx); }
// persistence round trip
const packed = JSON.parse(JSON.stringify(C.pack()));
assert(packed.custom && packed.custom.rec.name === 'FC Testhausen', 'custom in pack');
C.syncCustom('home');
assert(W.clubs[slot.idx].name === slot.name || W.clubs[slot.idx].name !== 'FC Testhausen', 'restored at home');
assert(JSON.stringify({ n: W.clubs[slot.idx].name, c: W.clubs[slot.idx].colors, r: W.clubs[slot.idx].r, rating: W.clubs[slot.idx].rating, st: W.clubs[slot.idx].stadium }) === before, 'world restored exactly');
assert(W.squad(W.clubs[slot.idx], 1).map((p) => p.name).join(',') === sqBefore, 'squad restored');
const c2 = C.unpack(packed);
assert(c2 && W.clubs[slot.idx].name === 'FC Testhausen', 'unpack re-applies');
assert(c2.m.players.length === c.m.players.length, 'players kept');
// display helper
assert(C.displayClub(slot.id, packed.custom).name === 'FC Testhausen' && W.clubs[slot.idx].name === 'FC Testhausen', 'displayClub');
// editor edit after start does not change the career snapshot
Ed.patch(own, { name: 'FC Anders' });
C.reapplyCustom();
assert(W.clubs[slot.idx].name === 'FC Testhausen', 'career snapshot independent of editor edits');
// a normal career afterwards: everything back
const c3 = C.create({ clubId: 'fcb', seed: 5, easy: true });
assert(c3 && !c3.custom && !C.customActive(), 'normal career clears custom');
assert(W.clubs[slot.idx].name === slot.name, 'slot back to real club: ' + W.clubs[slot.idx].name);
// switch club drops the custom
const c4 = C.create({ clubId: slot.id, custom: rec, seed: 6, easy: true });
C.switchClub(W.clubs[5].idx);
assert(!C.cur.custom && !C.customActive() && W.clubs[slot.idx].name === slot.name, 'switchClub drops custom');
console.log(errs ? 'FAILED ' + errs : 'own clubs OK');
process.exit(errs ? 1 : 0);
