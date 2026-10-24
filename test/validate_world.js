// usage: node test/validate_world.js data/world_X.json
const fs = require('fs');
const f = process.argv[2];
let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log('INVALID JSON:', e.message); process.exit(1); }
if (!Array.isArray(d.countries)) { console.log('top level must be {"countries":[...]}'); process.exit(1); }
const hex = /^#[0-9a-fA-F]{6}$/; let errs = 0, clubs = 0; const err = (m) => { console.log('ERR', m); errs++; };
const seen = new Set();
for (const c of d.countries) {
  const w = c.cc;
  if (!/^[a-z]{2,3}$/.test(c.cc || '')) err('bad cc ' + c.cc);
  for (const k of ['name', 'nameEn', 'flag', 'names']) if (!c[k]) err(w + ': missing ' + k);
  if (!['de', 'en', 'es', 'it', 'fr', 'nl', 'pt', 'tr', 'us'].includes(c.names)) err(w + ': names must be one of de,en,es,it,fr,nl,pt,tr,us');
  if (typeof c.uefa !== 'boolean') err(w + ': uefa boolean missing');
  if (!c.cup || !c.cup.de || !c.cup.en) err(w + ': cup {de,en} missing');
  if (!Array.isArray(c.leagues) || !c.leagues.length) err(w + ': no leagues');
  let tiers = [];
  for (const l of c.leagues || []) {
    tiers.push(l.tier);
    if (!l.name || !l.tier) err(w + ': league needs name,tier');
    if (!Array.isArray(l.groups) || !l.groups.length) err(w + ' ' + l.name + ': no groups');
    if (typeof l.relegate !== 'number') err(w + ' ' + l.name + ': relegate number missing (0 if none)');
    for (const g of l.groups || []) {
      if (!Array.isArray(g.clubs) || g.clubs.length < 6) err(w + ' ' + l.name + ' ' + g.name + ': <6 clubs');
      for (const cl of g.clubs || []) {
        clubs++;
        if (!cl.n || !cl.s || typeof cl.r !== 'number') err(w + ': club needs n,s,r: ' + JSON.stringify(cl));
        if (cl.r < 10 || cl.r > 96) err(w + ': rating out of range ' + cl.n + ' ' + cl.r);
        if (cl.c && (!Array.isArray(cl.c) || cl.c.length < 1 || !cl.c.every((x) => hex.test(x)))) err(w + ': bad colors ' + cl.n);
        const key = c.cc + '|' + cl.n.toLowerCase();
        if (seen.has(key)) err(w + ': duplicate club ' + cl.n); seen.add(key);
      }
    }
  }
  for (let t = 1; t <= Math.max(...tiers); t++) if (!tiers.includes(t)) err(w + ': missing tier ' + t);
  const sizes = (c.leagues || []).map((l) => 'T' + l.tier + ':' + l.groups.map((g) => g.clubs.length).join('/'));
  console.log(c.cc, sizes.join(' '));
}
console.log(errs ? errs + ' ERRORS' : 'OK', clubs + ' clubs');
process.exit(errs ? 1 : 0);
