/* FCK - importer.js : CSV import of real squads (clubs are matched by name, values are scaled to the club strength) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const W = FCK.World;

  const POS = {
    GK: 'GK', TW: 'GK', TORWART: 'GK', G: 'GK',
    CB: 'CB', IV: 'CB', D: 'CB', DEF: 'CB', LB: 'LB', LV: 'LB', RB: 'RB', RV: 'RB', LWB: 'LB', RWB: 'RB',
    CDM: 'CDM', DM: 'CDM', ZDM: 'CDM', CM: 'CM', ZM: 'CM', M: 'CM', MID: 'CM', CAM: 'CAM', AM: 'CAM', ZOM: 'CAM', OM: 'CAM',
    LM: 'LM', RM: 'RM', LW: 'LW', LA: 'LW', LF: 'LW', RW: 'RW', RA: 'RW', RF: 'RW', LAV: 'LB', RAV: 'RB', LAM: 'LAM', RAM: 'RAM', ST: 'ST', CF: 'ST', MS: 'ST', S: 'ST', FW: 'ST', A: 'ST', SS: 'ST',
  };
  const NAT = { de: 'de', ger: 'de', germany: 'de', deutschland: 'de', en: 'en', eng: 'en', uk: 'en', gb: 'en', ie: 'en', es: 'es', esp: 'es', spain: 'es', it: 'it', ita: 'it', fr: 'fr', fra: 'fr', nl: 'nl', ned: 'nl', pt: 'pt', por: 'pt', br: 'pt', bra: 'pt', tr: 'tr', tur: 'tr', us: 'us', usa: 'us', ar: 'es', mx: 'es' };

  function splitLine(line, d) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === d && !q) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  }

  const Import = {
    parsePlayers(text) {
      const lines = (text || '').replace(/\r/g, '').split('\n').filter((l) => l.trim());
      const errors = [], rows = [];
      if (!lines.length) return { rows, errors: ['empty'] };
      const cnt = (c) => lines[0].split(c).length;
      const d = [';', ',', '\t'].sort((a, b) => cnt(b) - cnt(a))[0];
      let idx = { club: 0, name: 1, pos: 2, ovr: 3, age: 4, nat: 5 };
      let first = splitLine(lines[0], d);
      let start = 0;
      if (first.length >= 4 && isNaN(parseFloat(first[3]))) {
        start = 1;
        const find = (...keys) => first.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k)));
        const m = { club: find('club', 'verein', 'team'), name: find('name', 'spieler', 'player'), pos: find('pos'), ovr: find('ovr', 'overall', 'rating', 'stärke', 'wert'), age: find('age', 'alter'), nat: find('nat') };
        Object.keys(m).forEach((k) => { if (m[k] >= 0) idx[k] = m[k]; else if (k === 'age' || k === 'nat') idx[k] = -1; });
      }
      for (let i = start; i < lines.length; i++) {
        const f = splitLine(lines[i], d);
        const club = f[idx.club], name = f[idx.name];
        const pos = POS[(f[idx.pos] || '').toUpperCase().replace(/[^A-ZÄÖÜ]/g, '')];
        const ovr = parseFloat(f[idx.ovr]);
        if (!club || !name || !pos || !(ovr >= 20 && ovr <= 99)) { errors.push(i + 1); continue; }
        const age = idx.age >= 0 ? parseInt(f[idx.age], 10) : 0;
        const nat = idx.nat >= 0 ? NAT[(f[idx.nat] || '').toLowerCase()] : undefined;
        rows.push({ club, name, pos, ovr: Math.round(ovr), age: age > 14 && age < 50 ? age : 0, nat });
      }
      return { rows, errors };
    },
    // apply parsed rows: group by club, scale to the club strength (optional) and store
    applyPlayers(rows, opts) {
      opts = opts || {};
      const by = {}, unknown = new Set();
      rows.forEach((r) => {
        const c = W.findClub(r.club);
        if (!c) { unknown.add(r.club); return; }
        (by[c.id] = by[c.id] || []).push(r);
      });
      const store = opts.replace ? {} : Object.assign({}, W.custom);
      let players = 0;
      Object.keys(by).forEach((id) => {
        const club = W.byId[id];
        let recs = by[id].sort((a, b) => b.ovr - a.ovr).slice(0, 40);
        if (opts.scale !== false) {
          const top = recs.slice(0, 14); const mean = top.reduce((a, b) => a + b.ovr, 0) / top.length;
          const off = Math.round(club.rating - mean);
          recs = recs.map((r) => Object.assign({}, r, { ovr: U.clamp(r.ovr + off, 25, 97) }));
        }
        store[id] = recs; players += recs.length;
      });
      W.setCustom(store);
      return { clubs: Object.keys(by).length, players, unknown: Array.from(unknown) };
    },
    clear() { W.setCustom({}); },
    count() { return Object.keys(W.custom || {}).length; },
  };
  FCK.Import = Import;
})((globalThis.FCK = globalThis.FCK || {}));
