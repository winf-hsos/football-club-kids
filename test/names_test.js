// name variety: distinct names across the whole world, duplicates inside squads, group mix, countries
const fs = require('fs'), path = require('path');
globalThis.window = globalThis;
const load = (f) => { (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')); };
['util', 'data', 'abilities', 'squad', 'crest', 'natdata', 'names', 'worlddata', 'world'].forEach(load);
const W = FCK.World.build();
const clubs = W.clubs;
const names = new Map(), grp = {}, lasts = new Map(); let dup = 0, total = 0, noFirst = 0;
const perCountry = {};
for (const c of clubs.slice(0, 1200)) {
  const sq = FCK.makeFullSquad(c, FCK.World.hash(c.id));
  const seen = new Set();
  for (const p of sq) {
    total++; names.set(p.name, (names.get(p.name) || 0) + 1); lasts.set(p.last, (lasts.get(p.last) || 0) + 1);
    grp[p.nat] = (grp[p.nat] || 0) + 1; if (seen.has(p.last)) dup++; seen.add(p.last); if (!p.name.includes(' ')) noFirst++;
    (perCountry[c.country] = perCountry[c.country] || {})[p.nat] = ((perCountry[c.country] || {})[p.nat] || 0) + 1;
  }
}
console.log('players', total, 'distinct full names', names.size, 'distinct surnames', lasts.size);
console.log('same surname inside a squad:', dup, ' mononyms', noFirst);
console.log('groups', Object.entries(grp).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + (100 * v / total).toFixed(1) + '%').join(' '));
for (const cc of ['pl', 'se', 'gr', 'de', 'br', 'jp', 'rs']) if (perCountry[cc]) console.log(cc, JSON.stringify(perCountry[cc]));
const top = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); console.log('most frequent', JSON.stringify(top));
const c0 = clubs.find((c) => c.country === 'pl') || clubs[5]; console.log(c0.name, FCK.makeFullSquad(c0, 7).slice(0, 12).map((p) => p.name).join(', '));
const c1 = clubs.find((c) => c.country === 'de'); console.log(c1.name, FCK.makeFullSquad(c1, 9).slice(0, 12).map((p) => p.name).join(', '));
if (dup > 0) { console.log('FAIL dup'); process.exit(1); }
if (names.size < total * 0.55) { console.log('FAIL variety'); process.exit(1); }
console.log('names OK');
