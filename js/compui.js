/* FCK - compui.js : screens for the stand-alone competitions (menu + hub with table / bracket / fixtures / scorers / team) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const W = FCK.World;
  const Co = FCK.Comp;
  const C = FCK.Career;
  const T = (k, v) => FCK.T(k, v);
  FCK.Screens = FCK.Screens || {};
  const CUI = FCK.CompUI = {};

  const lang = () => (FCK.settings && FCK.settings.lang) || 'de';
  const crest = (i, s) => UI.crestImg(W.clubs[i], s || 22);
  const cname = (cc) => W.countryName(cc);
  const LEVELS = ['rookie', 'amateur', 'pro', 'world', 'legend'];
  const euroName = (k) => FCK.SimConst.EURO_NAME[k];
  const dateStr = (ts) => { try { return new Date(ts).toLocaleDateString(lang() === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch (e) { return ''; } };

  // double-click-to-confirm button
  function armed(label, sure, fn, cls) {
    const b = UI.btn(label, () => {}, cls || 'ghost');
    let a = false;
    b.addEventListener('click', () => {
      if (!a) { a = true; b.textContent = sure; b.classList.add('danger'); setTimeout(() => { a = false; b.textContent = label; b.classList.remove('danger'); }, 3500); return; }
      fn();
    }, true);
    return b;
  }

  // ---------- shared table / tie renderers (work on any sim) ----------
  function leagueTable(rows, o) {
    o = o || {};
    const tb = h('table', { class: 'lt' });
    tb.appendChild(h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: T('t.club') }), h('th', { text: T('t.p'), title: T('t.p.l') }), h('th', { class: 'hs', text: T('t.w') }), h('th', { class: 'hs', text: T('t.d') }), h('th', { class: 'hs', text: T('t.l') }), h('th', { class: 'hs', text: T('t.gf') }), h('th', { text: T('t.gd') }), h('th', { text: T('t.pts') }))));
    const body = h('tbody');
    rows.forEach((r) => {
      const z = o.zones && o.zones[r.pos] ? o.zones[r.pos].replace('?', '') : '';
      body.appendChild(h('tr', { class: (r.idx === o.me ? 'me ' : '') + (z ? 'z-' + z : '') },
        h('td', { class: 'pos', text: r.pos }),
        h('td', { class: 'cl' }, crest(r.idx, 20), h('span', { class: 'nm', text: W.clubs[r.idx].name })),
        h('td', { text: r.p }), h('td', { class: 'hs', text: r.w }), h('td', { class: 'hs', text: r.d }), h('td', { class: 'hs', text: r.l }),
        h('td', { class: 'hs', text: r.gf + ':' + r.ga }), h('td', { text: (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga) }), h('td', { class: 'pts', text: r.pts })));
    });
    tb.appendChild(body);
    return h('div', { class: 'scrollx' }, tb);
  }
  function tieRow(t, me, single) {
    const a = t[0], b = t[1];
    let sc;
    if (single) sc = t[2] < 0 ? '–' : t[2] + ':' + t[3] + (t[6] ? ' ' + T('aet') : '') + (t[4] >= 0 ? ' (' + t[4] + ':' + t[5] + ')' : '');
    else sc = t[2] < 0 ? '–' : (t[4] < 0 ? t[2] + ':' + t[3] : (t[2] + t[4]) + ':' + (t[3] + t[5]) + (t[6] ? ' ' + T('aet') : '') + (t[7] >= 0 ? ' (' + t[7] + ':' + t[8] + ')' : ''));
    const win = single ? (t[2] < 0 ? -1 : (t[2] > t[3] || (t[2] === t[3] && t[4] > t[5])) ? 0 : 1) : (t[9] >= 0 ? (t[9] === a ? 0 : 1) : -1);
    return h('div', { class: 'tie' + (a === me || b === me ? ' me' : '') },
      h('span', { class: 'tm a' + (win === 0 ? ' w' : '') }, h('b', { text: W.clubs[a].name }), crest(a, 18)),
      h('span', { class: 'ts', text: sc }),
      h('span', { class: 'tm b' + (win === 1 ? ' w' : '') }, crest(b, 18), h('b', { text: W.clubs[b].name })));
  }
  function zoneLegend(zones) {
    const used = new Set(Object.values(zones || {}).map((z) => z.replace('?', '')));
    if (!used.size) return null;
    return h('div', { class: 'zleg' }, ['promo', 'cl', 'el', 'ecl', 'rel'].filter((z) => used.has(z)).map((z) => h('span', { class: 'zl z-' + z }, h('i'), T('zone.' + z))));
  }
  function progressBar(p, text) {
    return h('div', { class: 'cp-prog' }, h('div', { class: 'tnbar' }, h('i', { style: { width: Math.round(U.clamp(p, 0, 1) * 100) + '%' } })), h('small', { class: 'fine', text }));
  }

  // ---------- club chooser limited to the entrants of a competition ----------
  function entrantPicker(kind, id, onPick) {
    const list = Co.entrants(kind, id).map((i) => W.clubs[i]).sort((a, b) => b.r - a.r);
    let q = '';
    const grid = h('div', { class: 'picker-grid' });
    const info = h('p', { class: 'fine' });
    const fill = () => {
      grid.innerHTML = '';
      const out = list.filter((t) => !q || (t.name + ' ' + t.short).toLowerCase().includes(q));
      info.textContent = T('c.found', { n: out.length }) + (out.length > 90 ? ' · ' + T('c.refine') : '');
      out.slice(0, 90).forEach((t) => {
        const b = h('button', { class: 'pick', type: 'button' }, UI.crestImg(t, 40), h('div', { class: 'pk-i' }, h('b', { text: t.name }), h('small', { text: W.byCc[t.country].flag + ' ' + t.lname + ' · ' + t.tier })), h('span', { class: 'ovr', text: Math.round(t.rating) }));
        b.addEventListener('click', () => { UI.sfx('ok'); UI.closeModal(); onPick(t.idx); });
        grid.appendChild(b);
      });
    };
    const search = h('input', { type: 'search', class: 'txt', placeholder: T('team.search'), 'aria-label': T('team.search') });
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); fill(); });
    fill();
    UI.modal(T('cp.club.pick'), h('div', { class: 'picker' }, search, info, grid, h('div', { class: 'row' }, UI.btn(T('close'), () => UI.closeModal(), 'ghost'))), { cls: 'wide' });
  }

  // =============================================================== menu
  FCK.Screens.comp = function () {
    W.build();
    const kids = FCK.settings.profile === 'kids';
    const saved = Co.peek();
    const el = h('div', { class: 'page comp' });
    el.appendChild(UI.header(T('cp.title'), () => UI.back()));
    const body = h('div', { class: 'cp-body' });
    el.appendChild(body);
    const opt = FCK.compDraft || (FCK.compDraft = { kind: 'league', cc: 'de', gid: null, euro: 'cl', me: null, half: Math.min(FCK.setup.match.halfMins || 3, 6), level: FCK.setup.match.level || (kids ? 'rookie' : 'pro'), preset: 'p1' });
    const draw = () => {
      body.innerHTML = '';
      // running competition
      if (saved) {
        const sec = UI.section(T('cp.running'));
        const S = Co.S || Co.load();
        if (S) {
          const row = h('div', { class: 'cp-run' }, h('span', { class: 'cp-fl', text: Co.flag(S.kind, S.id) }), h('div', { class: 'mr-n' }, h('b', { class: 'big', text: Co.title(S.kind, S.id) }), h('small', { text: C.seasonLabel(S.year) + ' · ' + (S.me >= 0 ? W.clubs[S.me].name : T('cp.watch')) })));
          if (S.me >= 0) row.insertBefore(crest(S.me, 40), row.children[1]);
          sec.appendChild(row);
          sec.appendChild(progressBar(Co.progress(), Co.status()));
          sec.appendChild(h('div', { class: 'row' }, UI.btn('▶ ' + T('cp.resume'), () => { FCK.CompUI.tab = 'start'; UI.show('compHub'); }, 'primary xl'), armed(T('cp.end'), T('cp.end.sure'), () => { Co.clear(); FCK.compDraft = null; UI.show('comp', null, true); }, 'ghost')));
          body.appendChild(sec);
        }
      }
      // new competition
      const nw = UI.section(T('cp.new'));
      nw.appendChild(h('p', { class: 'fine', text: T('cp.about') }));
      nw.appendChild(UI.chips(['league', 'cup', 'euro'].map((k) => ({ v: k, l: T('cp.kind.' + k) })), opt.kind, (v) => { opt.kind = v; opt.me = null; draw(); }, 'scroll'));
      const countries = Co.countries().filter((c) => opt.kind === 'league' || Co.hasCup(c.cc));
      if (opt.kind !== 'euro') {
        if (!countries.some((c) => c.cc === opt.cc)) opt.cc = countries[0].cc;
        nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('cp.country') }), UI.select(countries.map((c) => ({ v: c.cc, l: c.flag + ' ' + cname(c.cc) })), opt.cc, (v) => { opt.cc = v; opt.gid = null; opt.me = null; draw(); }, T('cp.country'))));
      }
      let id;
      if (opt.kind === 'league') {
        const ls = Co.leaguesOf(opt.cc);
        if (!ls.some((l) => l.gid === opt.gid)) opt.gid = ls[0].gid;
        if (ls.length > 1) nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('cp.league') }), UI.select(ls.map((l) => ({ v: l.gid, l: l.label + ' (' + l.size + ')' })), opt.gid, (v) => { opt.gid = +v; opt.me = null; draw(); }, T('cp.league'))));
        id = opt.gid;
      } else if (opt.kind === 'cup') id = opt.cc;
      else {
        nw.appendChild(UI.chips(['cl', 'el', 'ecl'].map((k) => ({ v: k, l: euroName(k) })), opt.euro, (v) => { opt.euro = v; opt.me = null; draw(); }, 'scroll'));
        id = opt.euro;
      }
      // my club
      const mine = h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('cp.club') }));
      if (opt.me !== null && opt.me >= 0 && W.clubs[opt.me]) {
        mine.appendChild(h('div', { class: 'cm-head' }, crest(opt.me, 48), h('div', null, h('b', { class: 'big', text: W.clubs[opt.me].name }), UI.stars(W.clubs[opt.me].rating))));
      } else mine.appendChild(h('p', { class: 'muted', text: opt.me === -1 ? T('cp.club.watch.on') : T('cp.club.hint') }));
      mine.appendChild(h('div', { class: 'row' }, UI.btn(T('cp.club.pick'), () => entrantPicker(opt.kind, id, (i) => { opt.me = i; draw(); }), opt.me >= 0 && opt.me !== null ? 'ghost' : 'primary'), UI.btn(T('cp.club.watch'), () => { opt.me = -1; draw(); }, opt.me === -1 ? 'primary' : 'ghost')));
      nw.appendChild(mine);
      nw.appendChild(UI.slider(T('set.half'), 1, 8, 1, opt.half, (v) => { opt.half = v; }, (v) => v + ' ' + T('min')));
      nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.cpu') }), UI.chips(LEVELS.map((k) => ({ v: k, l: T('level.' + k) })), opt.level, (v) => { opt.level = v; }, 'scroll')));
      nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.players') }), UI.chips(['p1', 'p2co'].map((k) => ({ v: k, l: T('k.pre.' + k) })), opt.preset, (v) => { opt.preset = v; }, 'scroll')));
      nw.appendChild(h('div', { class: 'row' }, UI.btn('▶ ' + T('cp.start'), () => {
        if (opt.me === null) { UI.toast(T('cp.club.hint')); return; }
        const S = Co.create({ kind: opt.kind, id, me: opt.me, half: opt.half, level: opt.level, preset: opt.preset, form: FCK.setup.match.homeFormation, style: FCK.setup.match.homeStyle });
        Co.save(); FCK.CompUI.tab = 'start'; UI.show('compHub');
      }, 'primary xl')));
      body.appendChild(nw);
      // history
      const hist = Co.history();
      if (hist.length) {
        const hs = UI.section(T('cp.history'));
        hist.slice(0, 12).forEach((e) => {
          const champ = W.clubs[e.champ];
          hs.appendChild(h('div', { class: 'crow' + (e.won ? ' resW' : '') }, h('span', { class: 'cp-fl', text: Co.flag(e.kind, e.id) }), champ ? crest(e.champ, 26) : null,
            h('div', { class: 'mr-n' }, h('b', { text: Co.title(e.kind, e.id) + ' ' + C.seasonLabel(e.year) }), h('small', { text: '🏆 ' + (champ ? champ.name : '–') + (e.me >= 0 ? ' · ' + W.clubs[e.me].name + (e.pos ? ' · ' + T('t.pos', { n: e.pos }) : '') : '') }))));
        });
        body.appendChild(hs);
      }
      // backup
      const bs = UI.section(T('cp.backup'), h('p', { class: 'fine', text: T('cp.backup.hint') }));
      const ta = h('textarea', { class: 'txt code', rows: 3, placeholder: 'FCKW1:…', 'aria-label': 'FCKW1' });
      bs.appendChild(ta);
      bs.appendChild(h('div', { class: 'row' },
        UI.btn(T('cp.export'), () => { if (!Co.S && !Co.load()) { UI.toast(T('cp.none')); return; } ta.value = Co.exportText(); ta.focus(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => UI.toast(T('copied')), () => {}); } catch (e) { /* ignore */ } }, 'ghost'),
        UI.btn(T('cp.import'), () => { const S = Co.importText(ta.value); if (S) { UI.toast(T('cp.imported')); UI.show('comp', null, true); } else UI.toast(T('cp.imp.bad')); }, 'ghost')));
      body.appendChild(bs);
    };
    draw();
    return el;
  };

  // =============================================================== hub
  CUI.tab = 'start';
  let fxMd = null;
  FCK.Screens.compHub = function () {
    const S = Co.S || Co.load();
    if (!S) return FCK.Screens.comp();
    const sim = S.sim;
    const el = h('div', { class: 'page hub comp' });
    const redraw = () => UI.show('compHub', null, true);
    const mineClub = S.me >= 0 ? W.clubs[S.me] : null;
    el.appendChild(h('header', { class: 'hub-head card' },
      UI.btn('‹', () => { Co.save(); UI.stack = ['home']; UI.show('comp', null, true); }, 'ghost round'),
      mineClub ? crest(S.me, 56) : h('span', { class: 'cp-fl big', text: Co.flag(S.kind, S.id) }),
      h('div', { class: 'hh-t' }, h('b', { class: 'big', text: Co.title(S.kind, S.id) }), h('div', { class: 'muted', text: C.seasonLabel(S.year) + ' · ' + (mineClub ? mineClub.name : T('cp.watch')) })),
      h('div', { class: 'hh-r' }, h('span', { class: 'ci', text: Co.status() }))));
    el.appendChild(progressBar(Co.progress(), ''));
    const tabs = [['start', 'cp.tab.start'], ['table', S.kind === 'league' ? 'cp.tab.table' : S.kind === 'cup' ? 'cp.tab.bracket' : 'cp.tab.euro']];
    if (S.kind === 'league') tabs.push(['fixtures', 'cp.tab.fixtures']);
    else if (S.me >= 0) tabs.push(['fixtures', 'cp.tab.mine']);
    tabs.push(['scorers', 'cp.tab.scorers']);
    if (S.me >= 0) tabs.push(['team', 'cp.tab.team']);
    const tab = tabs.some((t) => t[0] === CUI.tab) ? CUI.tab : 'start';
    el.appendChild(UI.chips(tabs.map((x) => ({ v: x[0], l: T(x[1]) })), tab, (v) => { CUI.tab = v; redraw(); }, 'tabs'));
    const body = h('div', { class: 'hub-body' });
    el.appendChild(body);
    ({ start: tabStart, table: tabTable, fixtures: tabFixtures, scorers: tabScorers, team: tabTeam }[tab])(body, S, redraw);
    return el;
  };

  // ----- start tab -----
  function resultCard(S) {
    const r = Co.result();
    const sec = UI.section(T('cp.final'));
    if (r.champ >= 0) sec.appendChild(h('div', { class: 'cp-champ' }, crest(r.champ, 72), h('div', null, h('small', { class: 'muted', text: T('tn.champion') }), h('b', { class: 'big', text: '🏆 ' + W.clubs[r.champ].name }))));
    if (S.me >= 0 && r.mine) {
      if (S.kind === 'league') sec.appendChild(h('p', { class: r.mine.pos === 1 ? 'ok' : '', text: T('cp.you.pos', { pos: r.mine.pos, n: r.mine.n, pts: r.mine.pts }) + (r.mine.zone ? ' · ' + T('zone.' + r.mine.zone.replace('?', '')) : '') }));
      else sec.appendChild(h('p', { class: r.mine.won ? 'ok' : '', text: r.mine.won ? T('cp.you.won', { c: Co.title(S.kind, S.id) }) : (S.log.length ? T('cp.you.out', { r: S.log[S.log.length - 1].label }) : T('cp.you.nogame')) }));
    }
    sec.appendChild(h('div', { class: 'row' },
      UI.btn('↻ ' + T('cp.again'), () => {
        const S2 = Co.create({ kind: S.kind, id: S.id, me: S.me, half: S.half, level: S.level, preset: S.preset, form: S.form, style: S.style });
        Co.save(); CUI.tab = 'start'; UI.show('compHub', null, true);
      }, 'primary'),
      UI.btn(T('cp.menu'), () => { UI.stack = ['home']; UI.show('comp', null, true); }, 'ghost')));
    return sec;
  }
  function lastGames(S) {
    if (!S.log.length) return null;
    const sec = UI.section(T('cp.last'));
    S.log.slice(-6).reverse().forEach((e) => {
      const home = e.h === S.me, opp = home ? e.a : e.h;
      sec.appendChild(h('div', { class: 'fx done' }, h('small', { class: 'fx-d', text: C.fmtDate(C.dateOf(S.year, e.w, e.s)) }), h('small', { class: 'fx-c', text: e.label }), h('span', { class: 'fx-h', text: home ? 'H' : 'A' }), crest(opp, 20), h('b', { class: 'fx-o', text: W.clubs[opp].name }),
        h('span', { class: 'fx-s ' + e.res, text: e.g[0] + ':' + e.g[1] + (e.pens ? ' (' + e.pens[0] + ':' + e.pens[1] + ')' : '') })));
    });
    return sec;
  }
  function tabStart(body, S, redraw) {
    const sim = S.sim;
    if (S.done) { body.appendChild(resultCard(S)); const lg = lastGames(S); if (lg) body.appendChild(lg); return; }
    const nx = S.me >= 0 ? Co.next() : null;
    if (S.done) { redraw(); return; } // next() may have found the end
    if (nx) {
      const f = nx.f, info = nx.info, home = f.h === S.me, opp = home ? f.a : f.h;
      const card = h('section', { class: 'card sect next-card' }, h('h3', { text: T('next.match') }));
      card.appendChild(h('div', { class: 'nm-row' },
        h('div', { class: 'nm-t' }, crest(f.h, 64), h('b', { text: W.clubs[f.h].name })),
        h('div', { class: 'nm-vs' }, h('small', { text: C.fmtDate(C.dateOf(S.year, nx.w, nx.s)) }), h('b', { text: 'VS' }), h('small', { text: f.neutral ? T('final.venue') : home ? T('home') : T('away') })),
        h('div', { class: 'nm-t' }, crest(f.a, 64), h('b', { text: W.clubs[f.a].name }))));
      card.appendChild(h('p', { class: 'center muted', text: Co.label(f, info) + (info.aggLead || info.leg === 1 ? ' · ' + T('agg.hint') : '') }));
      const myR = sim.r[S.me], opR = sim.r[opp];
      card.appendChild(h('div', { class: 'row center' }, h('span', { class: 'ci', text: T('c.strength') + ' ' + Math.round(myR) }), h('span', { class: 'ci', text: T('c.strength') + ' ' + Math.round(opR) + ' · ' + W.clubs[opp].short })));
      card.appendChild(h('div', { class: 'row center' },
        UI.btn('▶ ' + T('play'), () => { FCK.Audio.init(); Co.play(); }, 'primary xl'),
        UI.btn(T('cp.simmy'), () => {
          const r = Co.simulateNext();
          if (r) UI.toast(W.clubs[r.nx.f.h].short + ' ' + r.out.g[0] + ':' + r.out.g[1] + ' ' + W.clubs[r.nx.f.a].short + (r.out.pens ? ' (' + r.out.pens[0] + ':' + r.out.pens[1] + ')' : ''), 2600);
          redraw();
        }, 'ghost'),
        armed(T('cp.simend'), T('cp.simend.sure'), () => { Co.simulateAll(); redraw(); }, 'ghost')));
      body.appendChild(card);
    } else {
      const sec = UI.section(S.me >= 0 ? T('cp.out') : T('cp.watch'), h('p', { class: 'fine', text: S.me >= 0 ? T('cp.out.hint') : T('cp.watch.hint') }));
      const unit = S.kind === 'cup' ? T('cp.unit.round') : T('cp.unit.md');
      sec.appendChild(h('div', { class: 'row' },
        UI.btn('⏭ ' + T('cp.step', { u: unit }), () => { Co.stepMany(1); redraw(); }, 'primary'),
        UI.btn(T('cp.step5', { u: unit }), () => { Co.stepMany(5); redraw(); }, 'ghost'),
        armed(T('cp.simend'), T('cp.simend.sure'), () => { Co.simulateAll(); redraw(); }, 'ghost')));
      body.appendChild(sec);
    }
    const lg = lastGames(S); if (lg) body.appendChild(lg);
    if (S.kind === 'league') {
      const tb = sim.leagues[S.id].table();
      const win = S.me >= 0 ? (() => { const i = tb.findIndex((r) => r.idx === S.me); const a = Math.max(0, Math.min(tb.length - 5, i - 2)); return [a, a + 5]; })() : [0, 5];
      const sec = UI.section(T('cp.tab.table'), leagueTable(tb.slice(win[0], win[1]), { me: S.me, zones: sim.zones(S.id) }));
      body.appendChild(sec);
    }
  }

  // ----- table / bracket tab -----
  function tabTable(body, S) {
    const sim = S.sim, c = Co.main();
    if (S.kind === 'league') {
      const rows = c.table();
      const sect = UI.section(Co.title(S.kind, S.id) + ' · ' + C.seasonLabel(S.year), leagueTable(rows, { me: S.me, zones: sim.zones(S.id) }));
      const zl = zoneLegend(sim.zones(S.id)); if (zl) sect.appendChild(zl);
      body.appendChild(sect);
      return;
    }
    if (S.kind === 'cup') {
      const sect = UI.section(Co.title(S.kind, S.id) + ' · ' + C.seasonLabel(S.year));
      if (c.w >= 0) sect.appendChild(h('p', { class: 'ok', text: '🏆 ' + W.clubs[c.w].name }));
      for (let r = c.rounds.length - 1; r >= 0; r--) {
        if (!c.rounds[r]) continue;
        const d = h('details', { class: 'rnd' }); if (r === c.rounds.length - 1) d.setAttribute('open', '');
        d.appendChild(h('summary', null, h('b', { text: C.roundName(c.R - 1 - r, r + 1) }), h('small', { text: ' · ' + C.fmtDate(C.dateOf(S.year, c.weekOf(r), 0)) })));
        c.rounds[r].forEach((t) => d.appendChild(tieRow(t, S.me, true)));
        sect.appendChild(d);
      }
      if (!c.rounds.length) sect.appendChild(h('p', { class: 'muted', text: T('cup.notstarted', { d: C.fmtDate(C.dateOf(S.year, c.weekOf(0), 0)) }) }));
      sect.appendChild(h('p', { class: 'fine', text: T('cup.entries', { n: c.e.length }) }));
      body.appendChild(sect);
      return;
    }
    const sect = UI.section(euroName(S.id) + ' · ' + C.seasonLabel(S.year));
    if (c.w >= 0) sect.appendChild(h('p', { class: 'ok', text: '🏆 ' + W.clubs[c.w].name }));
    ['f', 'sf', 'qf', 'r16', 'po'].forEach((st) => {
      const ties = c.ko[st]; if (!ties) return;
      const d = h('details', { class: 'rnd' }); if (st === Object.keys(c.ko).slice(-1)[0]) d.setAttribute('open', '');
      d.appendChild(h('summary', null, h('b', { text: T('stage.' + st) })));
      ties.forEach((t) => d.appendChild(tieRow(t, S.me, st === 'f')));
      sect.appendChild(d);
    });
    const rows = c.lpTable();
    const lz = {}; rows.forEach((r) => { lz[r.pos] = r.pos <= 8 ? 'promo' : r.pos <= 24 ? 'ecl' : 'rel'; });
    const det = h('details', { class: 'rnd' }); if (!Object.keys(c.ko).length) det.setAttribute('open', '');
    det.appendChild(h('summary', null, h('b', { text: T('euro.lp') })));
    det.appendChild(leagueTable(rows, { me: S.me, zones: lz }));
    det.appendChild(h('div', { class: 'zleg' }, h('span', { class: 'zl z-promo' }, h('i'), T('euro.z.r16')), h('span', { class: 'zl z-ecl' }, h('i'), T('euro.z.po')), h('span', { class: 'zl z-rel' }, h('i'), T('euro.z.out'))));
    sect.appendChild(det);
    body.appendChild(sect);
  }

  // ----- fixtures tab -----
  function tabFixtures(body, S, redraw) {
    const sim = S.sim, c = Co.main();
    if (S.kind === 'league') {
      const M = c.M;
      if (fxMd === null || fxMd >= M || fxMd < 0) fxMd = Math.min(c.md, M - 1);
      const md = fxMd;
      const nav = h('div', { class: 'row center' },
        UI.btn('‹', () => { fxMd = Math.max(0, md - 1); redraw(); }, 'ghost round'),
        h('b', { class: 'big', text: T('md', { n: md + 1 }) + ' / ' + M }),
        UI.btn('›', () => { fxMd = Math.min(M - 1, md + 1); redraw(); }, 'ghost round'),
        UI.btn(T('cp.now'), () => { fxMd = Math.min(c.md, M - 1); redraw(); }, 'ghost sm'));
      const sect = UI.section(T('cp.tab.fixtures') + ' · ' + C.fmtDate(C.dateOf(S.year, c.weekOf(md), 1)), nav);
      const list = h('div', { class: 'fx-list' });
      c.sched[md].forEach((m, k) => {
        const r = md < c.md && c.res[md] && c.res[md][k];
        list.appendChild(h('div', { class: 'tie' + (m[0] === S.me || m[1] === S.me ? ' me' : '') },
          h('span', { class: 'tm a' }, h('b', { text: W.clubs[m[0]].name }), crest(m[0], 18)),
          h('span', { class: 'ts', text: r ? r[0] + ':' + r[1] : '–' }),
          h('span', { class: 'tm b' }, crest(m[1], 18), h('b', { text: W.clubs[m[1]].name }))));
      });
      sect.appendChild(list);
      body.appendChild(sect);
      return;
    }
    const lg = lastGames(S);
    body.appendChild(lg || h('p', { class: 'muted', text: T('cp.nogames') }));
  }

  // ----- scorers tab -----
  function tabScorers(body, S) {
    const ts = Co.topScorers(15);
    const s = UI.section(T('scorers'));
    if (!ts.length) s.appendChild(h('p', { class: 'muted', text: T('cp.noscorers') }));
    ts.forEach((x, i) => s.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm', text: i + 1 }), crest(x.club, 20), h('b', { text: x.name }), h('small', { text: W.clubs[x.club].short }), h('span', { class: 'sc', text: x.goals }))));
    body.appendChild(s);
  }

  // ----- team tab -----
  function tabTeam(body, S, redraw) {
    const sim = S.sim, club = W.clubs[S.me];
    const sect = UI.section(T('squad.tactics'));
    sect.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('formation') }), UI.chips(FCK.FORMATION_NAMES, S.form, (v) => { S.form = v; S.xi = null; Co.save(); redraw(); }, 'scroll')));
    sect.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('style') }), UI.chips(FCK.STYLE_KEYS.map((k) => ({ v: k, l: T('style.' + k) })), S.style, (v) => { S.style = v; Co.save(); redraw(); }, 'scroll')));
    sect.appendChild(h('div', { class: 'row' }, UI.btn('⚽ ' + T('lu.view'), () => {
      const pool = sim.squadOf(S.me);
      FCK.Lineup.edit({
        title: T('lu.title') + ' · ' + club.name + ' · ' + S.form, formation: S.form, color: club.colors.p, pool,
        ids: S.xi && S.xi.f === S.form ? S.xi.ids : null, pick: (pl, ff, ids) => FCK.Mgr.pickManual(pl, ff, ids),
        onSave: (ids) => { S.xi = { f: S.form, ids }; Co.save(); UI.closeModal(); redraw(); },
        onReset: () => { S.xi = null; Co.save(); UI.closeModal(); redraw(); },
      });
    }, 'ghost'), S.xi && S.xi.f === S.form ? h('span', { class: 'ci eu', text: T('lu.manual') }) : null));
    body.appendChild(sect);
    const set = UI.section(T('career.settings'));
    set.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.cpu') }), UI.chips(LEVELS.map((k) => ({ v: k, l: T('level.' + k) })), S.level, (v) => { S.level = v; Co.save(); }, 'scroll')));
    set.appendChild(UI.slider(T('set.half'), 1, 8, 1, S.half, (v) => { S.half = v; Co.save(); }, (v) => v + ' ' + T('min')));
    set.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.players') }), UI.chips(['p1', 'p2co'].map((k) => ({ v: k, l: T('k.pre.' + k) })), S.preset, (v) => { S.preset = v; Co.save(); }, 'scroll')));
    body.appendChild(set);
    // best players
    const sq = sim.squadOf(S.me).slice().sort((a, b) => b.ovr - a.ovr).slice(0, 11), d = sim.delta(S.me);
    const tbl = h('table', { class: 'ptable' });
    sq.forEach((p) => tbl.appendChild(h('tr', null, h('td', { text: FCK.posL(p.pos) }), h('td', null, h('b', { text: p.name })), h('td', { class: 'ovr', text: Math.round(p.ovr + d) }))));
    body.appendChild(UI.section(T('c.best'), h('div', { class: 'scrollx' }, tbl)));
  }

  // ----- result box inside the match result screen -----
  CUI.resultBox = function (m) {
    const S = Co.S; if (!S || !S.last) return null;
    const e = S.last;
    const box = h('section', { class: 'card sect cres' }, h('h3', { text: Co.title(S.kind, S.id) + ' · ' + e.label }));
    box.appendChild(h('div', { class: 'row' }, h('b', { class: 'big', text: T('cp.out.' + e.res) })));
    if (S.done) box.appendChild(h('p', { class: 'ok', text: T('cp.finished') + ' · ' + T('tn.champion') + ': ' + W.clubs[Co.result().champ].name }));
    return box;
  };
})((globalThis.FCK = globalThis.FCK || {}));
