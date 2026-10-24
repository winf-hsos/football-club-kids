// node test/face_test.js : face designer data (defaults for old looks, random looks stay valid)
globalThis.window = globalThis; globalThis.FCK = {};
const fs = require('fs'), path = require('path');
['util', 'face'].forEach((f) => (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')));
const F = FCK.Face, U = FCK.U;
let errs = 0; const ok = (c, m) => { if (!c) { errs++; console.log('ERR', m); } };
// an old look (only 4 fields) gets all new fields
const old = F.norm({ skin: '#eac0a0', hair: '#2e2018', hairStyle: 'short', beard: true });
ok(old.beardStyle === 'full' && old.beard && old.beardCol === '#2e2018' && old.f.shape === 'oval' && old.f.band === null, 'old look defaults');
ok(F.norm({ skin: '#fff' }).hairStyle === 'short' && !F.norm(null).beard, 'empty looks');
const rng = U.makeRng(5);
const seen = new Set();
for (let i = 0; i < 400; i++) {
  const l = F.random(rng, i % 2 === 0);
  seen.add(l.hairStyle);
  ok(F.SKIN.includes(l.skin) && F.HAIR_STYLES.includes(l.hairStyle) && F.SHAPES.includes(l.f.shape) && F.MOUTHS.includes(l.f.mouth), 'random look valid');
  ok(l.beard === (l.beardStyle !== 'none'), 'beard flag matches style');
  if (i % 2 === 0) ok(!l.beard, 'kids profile: no beards');
}
ok(seen.size >= 13, 'many hair styles appear: ' + seen.size);
console.log(F.SKIN.length + ' skin tones, ' + F.HAIR.length + ' hair colours, ' + F.HAIR_STYLES.length + ' hair styles');
console.log(errs ? 'FAIL' : 'OK'); if (errs) process.exit(1);
