/* FCK - careerui.js : career menu, new career, hub (overview, table, fixtures, competitions, squad, world, history), saves */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const W = FCK.World;
  const C = FCK.Career;
  const T = (k, v) => FCK.T(k, v);
  FCK.Screens = FCK.Screens || {};

  const lang = () => (FCK.settings && FCK.settings.lang) || 'de';
  const cname = (cc) => W.countryName(cc);
  const flagOf = (cc) => (W.byCc[cc] ? W.byCc[cc].flag : '');
  const crest = (i, s) => UI.crestImg(typeof i === 'number' ? W.clubs[i] : i, s || 22);
  const euroName = (k) => FCK.SimConst.EURO_NAME[k];
  const pad2 = (n) => String(n);

  // ======================= shared pieces =======================
  function formDots(log, n) {
    const last = log.slice(-n);
    return h('span', { class: 'form' }, last.map((e) => h('i', { class: 'fd ' + e.res, title: e.res }, e.res === 'W' ? T('f.w') : e.res === 'D' ? T('f.d') : T('f.l'))));
  }

  function leagueTable(rows, opts) {
    opts = opts || {};
    const me = opts.me === undefined ? (C.cur ? C.cur.idx : -1) : opts.me;
    const tb = h('table', { class: 'lt' });
    tb.appendChild(h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: T('t.club') }), h('th', { text: T('t.p'), title: T('t.p.l') }), h('th', { class: 'hs', text: T('t.w') }), h('th', { class: 'hs', text: T('t.d') }), h('th', { class: 'hs', text: T('t.l') }), h('th', { class: 'hs', text: T('t.gf') }), h('th', { text: T('t.gd') }), h('th', { text: T('t.pts') }))));
    const body = h('tbody');
    const list = opts.window ? rows.slice(Math.max(0, opts.window[0]), opts.window[1]) : rows;
    list.forEach((r) => {
      const z = opts.zones && opts.zones[r.pos] ? opts.zones[r.pos].replace('?', '') : '';
      const tr = h('tr', { class: (r.idx === me ? 'me ' : '') + (z ? 'z-' + z : '') },
        h('td', { class: 'pos', text: r.pos }),
        h('td', { class: 'cl' }, crest(r.idx, 20), h('span', { class: 'nm', text: W.clubs[r.idx].name })),
        h('td', { text: r.p }), h('td', { class: 'hs', text: r.w }), h('td', { class: 'hs', text: r.d }), h('td', { class: 'hs', text: r.l }),
        h('td', { class: 'hs', text: r.gf + ':' + r.ga }), h('td', { text: (r.gf - r.ga > 0 ? '+' : '') + (r.gf - r.ga) }), h('td', { class: 'pts', text: r.pts }));
      tr.addEventListener('click', () => clubModal(r.idx));
      body.appendChild(tr);
    });
    tb.appendChild(body);
    return h('div', { class: 'scrollx' }, tb);
  }
  function zoneLegend(zones) {
    const used = new Set(Object.values(zones || {}).map((z) => z.replace('?', '')));
    if (!used.size) return null;
    return h('div', { class: 'zleg' }, ['promo', 'cl', 'el', 'ecl', 'rel'].filter((z) => used.has(z)).map((z) => h('span', { class: 'zl z-' + z }, h('i'), T('zone.' + z))));
  }

  // club details
  function clubModal(idx, extra) {
    const c = W.clubs[idx]; if (!c) return;
    const sim = C.cur ? C.cur.sim : null;
    const g = sim ? W.groups[sim.gid[idx]] : W.groups[c.gid];
    const body = h('div', { class: 'club-modal' });
    body.appendChild(h('div', { class: 'cm-head' }, crest(idx, 72), h('div', null, h('b', { class: 'big', text: c.name }), h('div', { class: 'muted', text: flagOf(g.cc) + ' ' + cname(g.cc) + ' · ' + g.lname + (g.gname ? ' ' + g.gname : '') }), h('div', { class: 'muted', text: c.stadium + (c.cap ? ' · ' + c.cap.toLocaleString(lang() === 'en' ? 'en-GB' : 'de-DE') : '') }))));
    const r = sim ? sim.r[idx] : c.r;
    body.appendChild(h('div', { class: 'row' }, h('span', { class: 'ci', text: T('c.strength') + ' ' + Math.round(r) }), UI.stars(W.matchOvr(r)), sim && sim.euroOf.get(idx) ? h('span', { class: 'ci eu', text: euroName(sim.euroOf.get(idx)) }) : null));
    if (sim) {
      const tb = sim.leagues[g.gid].table();
      const row = tb.find((x) => x.idx === idx);
      if (row && row.p) body.appendChild(h('p', { text: T('c.pos', { pos: row.pos, n: tb.length, pts: row.pts, p: row.p }) }));
      const sq = sim.squadOf(idx).slice().sort((a, b) => b.ovr - a.ovr).slice(0, 11);
      const d = sim.delta(idx);
      const tbl = h('table', { class: 'ptable' });
      sq.forEach((p) => tbl.appendChild(h('tr', null, h('td', { text: FCK.posL(p.pos) }), h('td', null, h('b', { text: p.name })), h('td', { class: 'ovr', text: Math.round(p.ovr + d) }))));
      body.appendChild(h('h4', { text: T('c.best') }));
      body.appendChild(h('div', { class: 'scrollx' }, tbl));
    }
    if (extra) body.appendChild(extra);
    body.appendChild(h('div', { class: 'row center' }, UI.btn(T('close'), () => UI.closeModal(), 'ghost')));
    UI.modal(c.name, body, { cls: 'wide' });
  }

  // club picker (FIFA-style) lives in clubpick.js

  // ======================= career menu =======================
  FCK.Screens.careerMenu = function () {
    W.build();
    const el = h('div', { class: 'page' });
    el.appendChild(UI.header(T('career'), () => UI.back()));
    const auto = C.autoInfo();
    const menu = h('nav', { class: 'menu wide-menu' });
    const item = (label, sub, fn, cls) => {
      const b = h('button', { class: 'mitem ' + (cls || ''), type: 'button' }, h('b', { text: label }), h('small', { text: sub }));
      b.addEventListener('click', () => { FCK.Audio.init(); UI.sfx('click'); fn(); });
      return b;
    };
    if (auto) menu.appendChild(item(T('career.continue'), auto.club.name + ' · ' + C.seasonLabel(auto.year) + ' · ' + auto.name, () => { if (C.loadAuto()) { C.tab = 'home'; UI.show(C.cur.pro ? 'proHub' : 'career'); } else UI.toast(T('career.loadfail')); }, 'primary'));
    menu.appendChild(item(T('career.new'), T('career.new.sub'), () => UI.show('careerNew'), auto ? '' : 'primary'));
    menu.appendChild(item(T('career.slots'), T('career.slots.sub'), () => UI.show('careerSaves')));
    menu.appendChild(item(T('career.import'), T('career.import.sub'), () => importDialog()));
    menu.appendChild(item(T('imp.title'), FCK.Import.count() ? T('imp.active', { n: FCK.Import.count() }) : T('imp.sub'), () => playersDialog()));
    el.appendChild(menu);
    el.appendChild(h('section', { class: 'card sect' }, h('h3', { text: T('career.about') }), h('p', { text: T('career.about.text', { clubs: W.clubs.length, countries: W.countries.length }) }), h('p', { class: 'fine', text: T('career.about.note') })));
    return el;
  };

  function importDialog() {
    const ta = h('textarea', { class: 'txt', rows: 6, placeholder: 'FCKC1:…' });
    UI.modal(T('career.import'), h('div', null, h('p', { class: 'fine', text: T('career.import.hint') }), ta, h('div', { class: 'row center' },
      UI.btn(T('saves.import.go'), () => { const c = C.importText(ta.value); if (c) { UI.closeModal(); C.autosave(); C.tab = 'home'; UI.show(c.pro ? 'proHub' : 'career'); } else UI.toast(T('saves.import.bad')); }, 'primary'), UI.btn(T('close'), () => UI.closeModal(), 'ghost'))));
  }

  function playersDialog() {
    const ta = h('textarea', { class: 'txt code', rows: 7, placeholder: 'club;name;pos;ovr;age;nat\nFC Bayern München;Max Mustermann;ST;84;27;de' });
    const file = h('input', { type: 'file', accept: '.csv,.txt,text/csv,text/plain' });
    file.addEventListener('change', () => { const f = file.files && file.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { ta.value = String(rd.result || ''); }; rd.readAsText(f); });
    let scale = true, replace = false;
    const out = h('p', { class: 'fine' });
    UI.modal(T('imp.title'), h('div', null,
      h('p', { class: 'fine', text: T('imp.hint') }), file, ta,
      UI.toggle(T('imp.scale'), scale, (v) => { scale = v; }), UI.toggle(T('imp.replace'), replace, (v) => { replace = v; }), out,
      h('div', { class: 'row center' },
        UI.btn(T('imp.go'), () => {
          const r = FCK.Import.parsePlayers(ta.value);
          if (!r.rows.length) { out.textContent = T('imp.none'); return; }
          const a = FCK.Import.applyPlayers(r.rows, { scale, replace });
          out.textContent = T('imp.done', { p: a.players, c: a.clubs, u: a.unknown.length, e: r.errors.length }) + (a.unknown.length ? ' · ' + a.unknown.slice(0, 5).join(', ') : '');
        }, 'primary'),
        UI.btn(T('imp.clear'), () => { FCK.Import.clear(); out.textContent = T('imp.cleared'); }, 'ghost'),
        UI.btn(T('close'), () => UI.closeModal(), 'ghost'))), { cls: 'wide' });
  }

  // club choice of a new career: real club or own (editor) club in the place of a real one
  function clubSection(st, draw) {
      const club = st.clubId ? W.byId[st.clubId] : null;
      const eds = FCK.Editor ? FCK.Editor.data.clubs : [];
      const own = st.own ? eds.find((c) => c.id === st.customId) || null : null;
      const sect1 = UI.section(T('career.pickclub'));
      if (eds.length || st.own) sect1.appendChild(h('div', { class: 'field' }, UI.chips([{ v: 'real', l: T('career.src.real') }, { v: 'own', l: T('career.src.own') }], st.own ? 'own' : 'real', (v) => {
        st.own = v === 'own';
        if (st.own && !st.customId && eds[0]) { st.customId = eds[0].id; st.clubId = FCK.Career.suggestSlot(eds[0]).id; }
        draw();
      })));
      if (st.own) {
        if (!eds.length) {
          sect1.appendChild(h('p', { class: 'muted', text: T('career.own.none') }));
          sect1.appendChild(h('div', { class: 'row' }, UI.btn(T('career.own.editor'), () => UI.show('editor'), 'primary')));
        } else {
          const grid = h('div', { class: 'picker-grid own-grid' });
          eds.forEach((rec) => {
            const b = h('button', { class: 'pick' + (rec.id === st.customId ? ' on' : ''), type: 'button' },
              crest(rec, 40), h('div', { class: 'pk-i' }, h('b', { text: rec.name }), h('small', { text: rec.stadium })), h('span', { class: 'ovr', text: Math.round(FCK.Editor.rateOf(rec.recs)) }));
            b.addEventListener('click', () => { UI.sfx('ok'); st.customId = rec.id; if (!st.slotManual) st.clubId = FCK.Career.suggestSlot(rec).id; draw(); });
            grid.appendChild(b);
          });
          sect1.appendChild(grid);
          if (own && club) {
            sect1.appendChild(h('div', { class: 'cm-head' }, crest(own, 64), h('div', null, h('b', { class: 'big', text: own.name }), h('div', { class: 'muted', text: T('career.own.in', { club: club.name, league: club.lname + ' · ' + cname(club.country) }) }), UI.stars(FCK.Editor.rateOf(own.recs)))));
            sect1.appendChild(h('p', { class: 'fine', text: T('career.own.hint') }));
            sect1.appendChild(h('div', { class: 'row' }, UI.btn(T('career.own.slot'), () => FCK.clubPicker({ career: true, title: T('career.own.slot'), current: st.clubId, onPick: (t) => { st.clubId = t.id; st.slotManual = true; draw(); } }), 'ghost')));
          }
        }
      } else {
        if (club) {
          sect1.appendChild(h('div', { class: 'cm-head' }, crest(club, 64), h('div', null, h('b', { class: 'big', text: club.name }), h('div', { class: 'muted', text: flagOf(club.country) + ' ' + cname(club.country) + ' · ' + club.lname + (club.tier ? ' · ' + T('tier', { n: club.tier }) : '') }), UI.stars(club.rating))));
        } else sect1.appendChild(h('p', { class: 'muted', text: T('career.pickclub.hint', { n: W.clubs.length }) }));
        sect1.appendChild(h('div', { class: 'row' }, UI.btn(club ? T('career.change') : T('career.pickclub'), () => FCK.clubPicker({ career: true, title: T('career.pickclub'), current: st.clubId, onPick: (t) => { st.clubId = t.id; draw(); } }), club ? 'ghost' : 'primary')));
      }
    return sect1;
  }

  // ======================= new career =======================
  FCK.Screens.careerNew = function () {
    W.build();
    const kids = FCK.settings.profile === 'kids';
    const st = FCK.careerDraft || (FCK.careerDraft = { clubId: null, level: kids ? 'rookie' : 'pro', halfMins: kids ? 3 : 4, preset: 'p1', easy: kids });
    const el = h('div', { class: 'page' });
    const draw = () => {
      el.innerHTML = '';
      el.appendChild(UI.header(T('career.new'), () => UI.back()));
      const sect1 = clubSection(st, draw);
      el.appendChild(sect1);
      const sect2 = UI.section(T('career.settings'));
      sect2.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.cpu') }), UI.chips(['rookie', 'amateur', 'pro', 'world', 'legend'].map((k) => ({ v: k, l: T('level.' + k) })), st.level, (v) => { st.level = v; })));
      sect2.appendChild(UI.slider(T('set.half'), 2, 10, 1, st.halfMins, (v) => { st.halfMins = v; }, (v) => v + ' ' + T('min')));
      sect2.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('career.players') }), UI.chips([{ v: 'p1', l: T('preset.p1') }, { v: 'p2co', l: T('preset.p2co') }, { v: 'p2vs', l: T('preset.p2vs') }], st.preset, (v) => { st.preset = v; })));
      sect2.appendChild(FCK.PadNav.controlLine(() => st.preset));
      sect2.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.mode') }), UI.chips([{ v: 'easy', l: T('m.mode.easy') }, { v: 'full', l: T('m.mode.full') }], st.easy ? 'easy' : 'full', (v) => { st.easy = v === 'easy'; }), h('small', { class: 'fine', text: T('m.mode.hint') })));
      sect2.appendChild(h('p', { class: 'fine', text: T('career.settings.hint') }));
      el.appendChild(sect2);
      el.appendChild(h('div', { class: 'row center sticky-actions' }, UI.btn(T('career.start'), () => {
        if (!st.clubId || (st.own && !st.customId)) { UI.toast(T('career.pickclub.hint', { n: W.clubs.length })); return; }
        const c = C.create({ clubId: st.clubId, custom: st.own ? (FCK.Editor.data.clubs.find((r) => r.id === st.customId) || null) : null, level: st.level, halfMins: st.halfMins, preset: st.preset, easy: st.easy });
        if (!c) { UI.toast(T('career.loadfail')); return; }
        C.autosave(); C.tab = 'home'; FCK.careerDraft = null; UI.stack = ['home']; UI.show('career', null, true);
      }, 'primary xl'), UI.btn(T('back'), () => UI.back(), 'ghost')));
    };
    draw();
    return el;
  };

  // ======================= saves =======================
  FCK.Screens.careerSaves = function () {
    const el = h('div', { class: 'page' });
    const draw = () => {
      el.innerHTML = '';
      el.appendChild(UI.header(T('career.slots'), () => UI.back()));
      const list = C.slotList();
      const grid = h('div', { class: 'grid2' });
      list.forEach((s, i) => {
        const card = h('section', { class: 'card sect' }, h('h3', { text: T('saves.slot') + ' ' + (i + 1) }));
        if (s) {
          const club = C.displayClub(s.club, s.custom);
          card.appendChild(h('div', { class: 'cm-head' }, club ? crest(club, 40) : null, h('div', null, h('b', { text: (s.data && s.data.pro ? '⭐ ' : '') + s.name }), h('div', { class: 'muted', text: (club ? club.name + ' · ' : '') + C.seasonLabel(s.year) }), h('small', { text: new Date(s.date).toLocaleString(lang() === 'en' ? 'en-GB' : 'de-DE') }))));
        } else card.appendChild(h('p', { class: 'muted', text: T('saves.empty') }));
        card.appendChild(h('div', { class: 'row' },
          UI.btn(T('saves.save'), () => {
            if (!C.cur) { UI.toast(T('career.nocareer')); return; }
            if (C.saveSlot(i)) { UI.toast(T('saves.saved')); draw(); } else UI.toast(T('career.nospace'));
          }, 'ghost sm'),
          s ? UI.btn(T('saves.load'), () => { const c = C.loadSlot(i); if (c) { C.autosave(); C.tab = 'home'; UI.show(c.pro ? 'proHub' : 'career'); } else UI.toast(T('career.loadfail')); }, 'primary sm') : null,
          s ? UI.btn(T('delete'), () => { C.deleteSlot(i); draw(); }, 'ghost sm') : null));
        grid.appendChild(card);
      });
      el.appendChild(grid);
      if (C.cur) {
        el.appendChild(h('section', { class: 'card sect' }, h('h3', { text: T('career.export') }), h('p', { class: 'fine', text: T('career.export.hint') }),
          h('div', { class: 'row' }, UI.btn(T('career.export'), () => {
            const txt = C.exportText();
            const ta = h('textarea', { class: 'txt', rows: 6, readonly: true }); ta.value = txt;
            UI.modal(T('career.export'), h('div', null, h('p', { class: 'fine', text: T('saves.export.hint') }), ta, h('div', { class: 'row center' },
              UI.btn(T('copy'), () => { ta.select(); try { navigator.clipboard.writeText(txt).then(() => UI.toast(T('copied')), () => UI.toast(T('copied'))); } catch (e) { UI.toast(T('copied')); } }, 'primary'), UI.btn(T('close'), () => UI.closeModal(), 'ghost'))));
          }, 'ghost'))));
      }
    };
    draw();
    return el;
  };

  // ======================= hub =======================
  FCK.Screens.career = function () {
    if (!C.cur) { const a = C.loadAuto(); if (!a) { return FCK.Screens.careerMenu(); } }
    const c = C.cur, sim = c.sim;
    const el = h('div', { class: 'page hub' });
    const tab = C.tab || 'home';
    const g = W.groups[sim.gid[c.idx]];
    const club = W.clubs[c.idx];
    const tb = sim.leagues[g.gid].table();
    const row = tb.find((r) => r.idx === c.idx);
    // header
    el.appendChild(h('header', { class: 'hub-head card' },
      UI.btn('‹', () => { C.autosave(); UI.stack = []; UI.show('home', null, true); }, 'ghost round'),
      crest(club, 56),
      h('div', { class: 'hh-t' }, h('b', { class: 'big', text: club.name }), h('div', { class: 'muted', text: flagOf(g.cc) + ' ' + g.lname + (g.gname ? ' ' + g.gname : '') + ' · ' + C.seasonLabel(sim.year) })),
      h('div', { class: 'hh-r' }, h('span', { class: 'ci', text: T('t.pos', { n: row ? row.pos : '-' }) }), h('span', { class: 'ci', text: T('week', { n: Math.min(sim.pos.w + 1, 48) }) }), FCK.MgrUI.headChips(c))));
    FCK.Mgr.ensure(c);
    const tabs = [['home', 'tab.home'], ['table', 'tab.table'], ['fixtures', 'tab.fixtures'], ['comps', 'tab.comps'], ['squad', 'tab.squad'], ['transfers', 'tab.transfers'], ['youth', 'tab.youth'], ['club', 'tab.club'], ['world', 'tab.world'], ['history', 'tab.history'], ['menu', 'tab.menu']];
    el.appendChild(UI.chips(tabs.map((x) => ({ v: x[0], l: T(x[1]) })), tab, (v) => { C.tab = v; UI.show('career', null, true); }, 'tabs'));
    const body = h('div', { class: 'hub-body' });
    el.appendChild(body);
    const mt = (n) => (b, cc) => FCK.MgrUI.tab(n, b, cc);
    ({ home: tabHome, table: tabTable, fixtures: tabFixtures, comps: tabComps, squad: mt('squad'), transfers: mt('transfers'), youth: mt('youth'), club: mt('club'), world: tabWorld, history: tabHistory, menu: tabMenu }[tab] || tabHome)(body, c);
    setTimeout(() => FCK.MgrUI.alerts(c), 30);
    return el;
  };
  const refresh = () => UI.show(UI.cur === 'proHub' ? 'proHub' : 'career', null, true);

  // ----- overview -----
  function tabHome(body, c) {
    const sim = c.sim;
    const nx = C.next();
    const g = W.groups[sim.gid[c.idx]];
    if (nx) {
      const f = nx.f, info = nx.info;
      const home = f.h === c.idx;
      const opp = home ? f.a : f.h;
      const d = C.dateOf(sim.year, nx.w, nx.s);
      const card = h('section', { class: 'card sect next-card' }, h('h3', { text: T('next.match') }));
      card.appendChild(h('div', { class: 'nm-row' },
        h('div', { class: 'nm-t' }, crest(f.h, 64), h('b', { text: W.clubs[f.h].name })),
        h('div', { class: 'nm-vs' }, h('small', { text: C.fmtDate(d) }), h('b', { text: 'VS' }), h('small', { text: f.neutral ? T('final.venue') : home ? T('home') : T('away') })),
        h('div', { class: 'nm-t' }, crest(f.a, 64), h('b', { text: W.clubs[f.a].name }))));
      card.appendChild(h('p', { class: 'center muted', text: C.compLabel(f, info) + (info.aggLead || info.leg === 1 ? ' · ' + T('agg.hint') : '') }));
      const oppR = sim.r[opp], myR = sim.r[c.idx];
      card.appendChild(h('div', { class: 'row center' }, h('span', { class: 'ci', text: T('c.strength') + ' ' + Math.round(myR) }), h('span', { class: 'ci', text: '≈ ' + (myR - oppR > 6 ? T('fav.me') : myR - oppR < -6 ? T('fav.opp') : T('fav.even')) }), h('span', { class: 'ci', text: T('c.strength') + ' ' + Math.round(oppR) })));
      card.appendChild(h('div', { class: 'row center' },
        UI.btn('▶ ' + T('play'), () => { C.play(); }, 'primary xl'),
        UI.btn(T('simulate'), () => { const r = C.simulateNext(); if (r) { const e = c.lastResult; UI.toast(W.clubs[e.h].short + ' ' + e.g[0] + ':' + e.g[1] + ' ' + W.clubs[e.a].short); } refresh(); }, 'ghost'),
        UI.btn(T('sim.season'), () => confirmSim(), 'ghost')));
      body.appendChild(card);
    } else {
      body.appendChild(seasonEndCard(c));
    }
    FCK.MgrUI.homeCards(body, c);
    const grid = h('div', { class: 'grid2' });
    // form + mini table
    const tb = sim.leagues[g.gid].table();
    const me = tb.findIndex((r) => r.idx === c.idx);
    const lo = Math.max(0, Math.min(me - 2, tb.length - 5));
    const mini = UI.section(T('tab.table'), formDots(c.log.filter((e) => e.y === sim.year), 6), leagueTable(tb, { zones: sim.zones(g.gid), window: [lo, lo + 5] }), h('div', { class: 'row' }, UI.btn(T('tab.table'), () => { C.tab = 'table'; refresh(); }, 'ghost sm')));
    grid.appendChild(mini);
    // news
    const news = UI.section(T('news'));
    if (!c.news.length) news.appendChild(h('p', { class: 'muted', text: T('news.none') }));
    c.news.slice(0, 8).forEach((n) => news.appendChild(h('div', { class: 'news-i' }, h('small', { text: C.fmtDate(C.dateOf(n.y, n.w, 1)) }), h('span', { text: T(n.k, n.v) }))));
    grid.appendChild(news);
    body.appendChild(grid);
    // top scorers of the league
    const ts = sim.topScorers(sim.leagues[g.gid].clubs, 5);
    if (ts.length) {
      const s = UI.section(T('scorers') + ' · ' + g.lname);
      ts.forEach((x, i) => s.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm', text: i + 1 }), crest(x.club, 20), h('b', { text: x.name }), h('small', { text: W.clubs[x.club].short }), h('span', { class: 'sc', text: x.goals }))));
      body.appendChild(s);
    }
  }
  function confirmSim() {
    UI.modal(T('sim.season'), h('div', null, h('p', { text: T('sim.season.ask') }), h('div', { class: 'row center' },
      UI.btn(T('sim.season'), () => { UI.closeModal(); const n = C.simulateSeason(); UI.toast(T('sim.done', { n })); refresh(); }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost'))));
  }

  function seasonEndCard(c) {
    const sim = c.sim;
    const sm = C.seasonSummary();
    const g = W.groups[sm.gid];
    const card = h('section', { class: 'card sect next-card' }, h('h3', { text: T('season.over', { s: C.seasonLabel(sim.year) }) }));
    card.appendChild(h('p', { class: 'center', text: T('season.result', { pos: sm.pos, n: sm.n, l: g.lname, pts: sm.pts }) }));
    if (sm.zone === 'promo') card.appendChild(h('p', { class: 'center ok', text: T('season.promo') }));
    if (sm.zone === 'rel') card.appendChild(h('p', { class: 'center bad', text: T('season.rel') }));
    if (sm.zone === 'cl' || sm.zone === 'el' || sm.zone === 'ecl') card.appendChild(h('p', { class: 'center ok', text: T('season.euro', { c: euroName(sm.zone) }) }));
    if (sm.pos === 1) card.appendChild(h('p', { class: 'center ok', text: '🏆 ' + T('season.champ') }));
    if (sm.cupWon) card.appendChild(h('p', { class: 'center ok', text: '🏆 ' + T('season.cupwin') }));
    card.appendChild(h('div', { class: 'row center' }, UI.btn(T('season.next'), () => {
      FCK.MgrUI.beforeEnd(c, () => { const s = C.endSeason(); seasonDialog(s); FCK.MgrUI.afterEnd(c, s); });
    }, 'primary xl')));
    return card;
  }
  function seasonDialog(s) {
    const c = C.cur, sim = c.sim;
    const g2 = W.groups[sim.gid[c.idx]];
    const wrap = h('div', null);
    wrap.appendChild(h('p', { class: 'center', text: s.moved === 'up' ? '⬆ ' + T('season.moved.up', { l: g2.lname }) : s.moved === 'down' ? '⬇ ' + T('season.moved.down', { l: g2.lname }) : T('season.stay', { l: g2.lname }) }));
    const eu = sim.euroOf.get(c.idx);
    wrap.appendChild(h('p', { class: 'center', text: eu ? T('season.euro.next', { c: euroName(eu) }) : T('season.noeuro') }));
    wrap.appendChild(FCK.MgrUI.seasonExtra(c, s));
    const sum = s.summary;
    const lst = h('div', { class: 'news-list' });
    const ccs = [g2.cc].concat(Object.keys(sum.champs).filter((x) => x !== g2.cc).sort((a, b) => W.byCc[a].rank - W.byCc[b].rank).slice(0, 6));
    ccs.forEach((cc) => { if (sum.champs[cc] !== undefined) lst.appendChild(h('div', { class: 'goalrow' }, h('span', { text: flagOf(cc) }), crest(sum.champs[cc], 20), h('b', { text: W.clubs[sum.champs[cc]].name }), h('small', { text: cname(cc) }))); });
    wrap.appendChild(h('h4', { text: T('season.champs') }));
    wrap.appendChild(lst);
    ['cl', 'el', 'ecl'].forEach((k) => { if (sum.euro[k] >= 0) wrap.appendChild(h('div', { class: 'goalrow' }, h('span', { text: '🏆' }), crest(sum.euro[k], 20), h('b', { text: W.clubs[sum.euro[k]].name }), h('small', { text: euroName(k) }))); });
    wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('ok'), () => { UI.closeModal(); refresh(); }, 'primary')));
    UI.modal(T('season.new', { s: C.seasonLabel(sim.year) }), wrap, { cls: 'wide' });
    refresh();
  }

  // ----- table tab -----
  let tbSel = null;
  function tabTable(body, c) {
    const sim = c.sim;
    const mine = W.groups[sim.gid[c.idx]];
    const gid = tbSel !== null && sim.leagues[tbSel] && W.groups[tbSel].cc === mine.cc ? tbSel : mine.gid;
    const co = W.byCc[mine.cc];
    // league chips for the country (tier + groups)
    const opts = [];
    co.leagues.forEach((lg) => lg.gids.forEach((gi) => opts.push({ v: gi, l: lg.name + (W.groups[gi].gname ? ' ' + W.groups[gi].gname : '') })));
    if (opts.length > 1) body.appendChild(UI.chips(opts, gid, (v) => { tbSel = v; refresh(); }, 'tabs sm'));
    const g = W.groups[gid];
    const rows = sim.leagues[gid].table();
    const sect = UI.section(g.lname + (g.gname ? ' ' + g.gname : '') + ' · ' + C.seasonLabel(sim.year), leagueTable(rows, { zones: sim.zones(gid) }));
    const zl = zoneLegend(sim.zones(gid)); if (zl) sect.appendChild(zl);
    body.appendChild(sect);
    const ts = sim.topScorers(sim.leagues[gid].clubs, 10);
    if (ts.length) {
      const s = UI.section(T('scorers'));
      ts.forEach((x, i) => s.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm', text: i + 1 }), crest(x.club, 20), h('b', { text: x.name }), h('small', { text: W.clubs[x.club].short }), h('span', { class: 'sc', text: x.goals }))));
      body.appendChild(s);
    }
  }

  // ----- fixtures tab -----
  function tabFixtures(body, c) {
    const sim = c.sim, g = W.groups[sim.gid[c.idx]], lg = sim.leagues[g.gid];
    const items = [];
    for (let md = 0; md < lg.M; md++) {
      const day = lg.sched[md];
      const k = day.findIndex((m) => m[0] === c.idx || m[1] === c.idx);
      if (k < 0) continue;
      const m = day[k];
      const played = md < lg.md && lg.res[md] && lg.res[md][k];
      items.push({ w: lg.weekOf(md), s: 1, comp: g.lname + ' · ' + T('md', { n: md + 1 }), h: m[0], a: m[1], g: played ? lg.res[md][k] : null });
    }
    c.log.filter((e) => e.y === sim.year && e.t !== 'L').forEach((e) => {
      const f = { t: e.t, k: e.info.k, st: e.info.st, cc: e.info.cc };
      const info = { comp: e.t, md: e.info.md, round: e.info.round, rname: e.info.rname, leg: e.info.leg, twoLegs: e.info.st && e.info.st !== 'f' && e.info.st !== 'lp' };
      items.push({ w: e.w, s: e.s, comp: C.compLabel(f, info), h: e.h, a: e.a, g: e.g, pens: e.pens, extra: true });
    });
    items.sort((a, b) => a.w - b.w || a.s - b.s);
    const sect = UI.section(T('tab.fixtures') + ' · ' + C.seasonLabel(sim.year));
    const tbl = h('div', { class: 'fx-list' });
    items.forEach((it) => {
      const home = it.h === c.idx, opp = home ? it.a : it.h;
      let res = '';
      if (it.g) { const my = home ? it.g[0] : it.g[1], op = home ? it.g[1] : it.g[0]; res = my > op ? 'W' : my < op ? 'L' : 'D'; if (it.pens) { res = (home ? it.pens[0] > it.pens[1] : it.pens[1] > it.pens[0]) ? 'W' : 'L'; } }
      tbl.appendChild(h('div', { class: 'fx' + (it.g ? ' done' : '') },
        h('small', { class: 'fx-d', text: C.fmtDate(C.dateOf(sim.year, it.w, it.s)) }), h('small', { class: 'fx-c', text: it.comp }),
        h('span', { class: 'fx-h', text: home ? 'H' : 'A' }), crest(opp, 20), h('b', { class: 'fx-o', text: W.clubs[opp].name }),
        it.g ? h('span', { class: 'fx-s ' + res, text: it.g[0] + ':' + it.g[1] + (it.pens ? ' (' + it.pens[0] + ':' + it.pens[1] + ')' : '') }) : h('span', { class: 'fx-s', text: '–' })));
    });
    sect.appendChild(tbl);
    body.appendChild(sect);
    body.appendChild(h('p', { class: 'fine', text: T('fixtures.note') }));
  }

  // ----- competitions tab -----
  let compSel = 'cup';
  function tieRow(t, me, single, two) {
    const a = t[0], b = t[1];
    let sc;
    if (single) sc = t[2] < 0 ? '–' : t[2] + ':' + t[3] + (t[6] ? ' ' + T('aet') : '') + (t[4] >= 0 ? ' (' + t[4] + ':' + t[5] + ')' : '');
    else if (two) sc = t[2] < 0 ? '–' : (t[4] < 0 ? t[2] + ':' + t[3] : (t[2] + t[4]) + ':' + (t[3] + t[5]) + (t[6] ? ' ' + T('aet') : '') + (t[7] >= 0 ? ' (' + t[7] + ':' + t[8] + ')' : ''));
    const win = single ? (t[2] < 0 ? -1 : (t[2] > t[3] || (t[2] === t[3] && t[4] > t[5])) ? 0 : 1) : (t[9] >= 0 ? (t[9] === a ? 0 : 1) : -1);
    return h('div', { class: 'tie' + (a === me || b === me ? ' me' : '') },
      h('span', { class: 'tm a' + (win === 0 ? ' w' : '') }, h('b', { text: W.clubs[a].name }), crest(a, 18)),
      h('span', { class: 'ts', text: sc }),
      h('span', { class: 'tm b' + (win === 1 ? ' w' : '') }, crest(b, 18), h('b', { text: W.clubs[b].name })));
  }
  function tabComps(body, c) {
    const sim = c.sim, g = W.groups[sim.gid[c.idx]];
    const co = W.byCc[g.cc];
    const euroK = sim.euroOf.get(c.idx);
    const opts = [{ v: 'cup', l: lang() === 'en' ? co.cup.en : co.cup.de }, { v: 'cl', l: 'CL' }, { v: 'el', l: 'EL' }, { v: 'ecl', l: 'ECL' }];
    body.appendChild(UI.chips(opts, compSel, (v) => { compSel = v; refresh(); }, 'tabs sm'));
    if (compSel === 'cup') {
      const cup = sim.cups[g.cc];
      if (!cup) { body.appendChild(h('p', { class: 'muted', text: T('cup.none') })); return; }
      const sect = UI.section((lang() === 'en' ? co.cup.en : co.cup.de) + ' · ' + C.seasonLabel(sim.year));
      if (cup.w >= 0) sect.appendChild(h('p', { class: 'ok', text: '🏆 ' + W.clubs[cup.w].name }));
      for (let r = cup.rounds.length - 1; r >= 0; r--) {
        if (!cup.rounds[r]) continue;
        const d = h('details', { class: 'rnd' }); if (r === cup.rounds.length - 1) d.setAttribute('open', '');
        d.appendChild(h('summary', null, h('b', { text: C.roundName(cup.R - 1 - r, r + 1) }), h('small', { text: ' · ' + C.fmtDate(C.dateOf(sim.year, cup.weekOf(r), 0)) })));
        cup.rounds[r].forEach((t) => d.appendChild(tieRow(t, c.idx, true, false)));
        sect.appendChild(d);
      }
      if (!cup.rounds.length) sect.appendChild(h('p', { class: 'muted', text: T('cup.notstarted', { d: C.fmtDate(C.dateOf(sim.year, cup.weekOf(0), 0)) }) }));
      sect.appendChild(h('p', { class: 'fine', text: T('cup.entries', { n: cup.e.length }) }));
      body.appendChild(sect);
      return;
    }
    const eu = sim.euro[compSel];
    const sect = UI.section(euroName(compSel) + ' · ' + C.seasonLabel(sim.year));
    if (eu.w >= 0) sect.appendChild(h('p', { class: 'ok', text: '🏆 ' + W.clubs[eu.w].name }));
    if (euroK === compSel) sect.appendChild(h('p', { class: 'ci eu', text: T('euro.you') }));
    // knockout stages (latest first)
    ['f', 'sf', 'qf', 'r16', 'po'].forEach((st) => {
      const ties = eu.ko[st]; if (!ties) return;
      const d = h('details', { class: 'rnd' }); if (st === Object.keys(eu.ko).slice(-1)[0] || false) d.setAttribute('open', '');
      d.appendChild(h('summary', null, h('b', { text: T('stage.' + st) })));
      ties.forEach((t) => d.appendChild(tieRow(t, c.idx, st === 'f', st !== 'f')));
      sect.appendChild(d);
    });
    const rows = eu.lpTable();
    const lz = {}; rows.forEach((r) => { lz[r.pos] = r.pos <= 8 ? 'promo' : r.pos <= 24 ? 'ecl' : 'rel'; });
    const det = h('details', { class: 'rnd' }); if (!Object.keys(eu.ko).length) det.setAttribute('open', '');
    det.appendChild(h('summary', null, h('b', { text: T('euro.lp') })));
    det.appendChild(leagueTable(rows, { zones: lz }));
    det.appendChild(h('div', { class: 'zleg' }, h('span', { class: 'zl z-promo' }, h('i'), T('euro.z.r16')), h('span', { class: 'zl z-ecl' }, h('i'), T('euro.z.po')), h('span', { class: 'zl z-rel' }, h('i'), T('euro.z.out'))));
    sect.appendChild(det);
    body.appendChild(sect);
  }

  // ----- squad tab -----
  function tabSquad(body, c) {
    const sim = c.sim;
    const sq = sim.squadOf(c.idx), d = sim.delta(c.idx);
    const sect = UI.section(T('squad.tactics'));
    sect.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('formation') }), UI.chips(FCK.FORMATION_NAMES, c.formation, (v) => { c.formation = v; C.autosave(); refresh(); })));
    sect.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('style') }), UI.chips(FCK.STYLE_KEYS.map((k) => ({ v: k, l: T('style.' + k) })), c.style, (v) => { c.style = v; C.autosave(); refresh(); })));
    body.appendChild(sect);
    const pk = FCK.pickSquad(sq, c.formation, null, d);
    const starters = new Set(pk.lineup.map((p) => p.sqi));
    const bench = new Set(pk.bench.map((p) => p.sqi));
    const goals = sim.sc[c.idx] || {};
    const tbl = h('table', { class: 'ptable sq' });
    tbl.appendChild(h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: T('res.player') }), h('th', { text: T('c.pos.s') }), h('th', { text: T('sq.ovr') }), h('th', { text: T('sq.goals') }), h('th', { text: '' }))));
    const order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    const tb = h('tbody');
    sq.slice().sort((a, b) => order[a.role] - order[b.role] || b.ovr - a.ovr).forEach((p) => {
      tb.appendChild(h('tr', { class: starters.has(p.sqi) ? 'st' : bench.has(p.sqi) ? 'bn' : '' }, h('td', { text: p.num }), h('td', null, h('b', { text: p.name })), h('td', { text: FCK.posL(p.pos) }), h('td', { class: 'ovr', text: Math.round(p.ovr + d) }), h('td', { text: goals[p.sqi] || '' }), h('td', { class: 'xi', text: starters.has(p.sqi) ? 'XI' : bench.has(p.sqi) ? T('sq.bench') : '' })));
    });
    tbl.appendChild(tb);
    body.appendChild(UI.section(T('tab.squad') + ' · ' + T('squad.count', { n: sq.length }), h('div', { class: 'scrollx' }, tbl), h('p', { class: 'fine', text: T('squad.note') })));
  }

  // ----- world tab -----
  let wSel = null, wGid = null, wMode = 'table';
  function tabWorld(body, c) {
    const sim = c.sim;
    const mine = W.groups[sim.gid[c.idx]];
    const cc = wSel || mine.cc;
    const co = W.byCc[cc];
    const countries = W.countries.slice().sort((a, b) => a.rank - b.rank || a.nameEn.localeCompare(b.nameEn));
    body.appendChild(h('div', { class: 'row tight' }, UI.select(countries.map((x) => ({ v: x.cc, l: x.flag + ' ' + cname(x.cc) + (x.uefa ? ' (#' + x.rank + ')' : '') })), cc, (v) => { wSel = v; wGid = null; refresh(); }, T('c.country'))));
    const opts = [];
    co.leagues.forEach((lg) => lg.gids.forEach((gi) => opts.push({ v: gi, l: lg.name + (W.groups[gi].gname ? ' ' + W.groups[gi].gname : '') })));
    const gid = wGid !== null && W.groups[wGid] && W.groups[wGid].cc === cc ? wGid : opts[0].v;
    body.appendChild(UI.chips(opts, gid, (v) => { wGid = v; refresh(); }, 'tabs sm'));
    const g = W.groups[gid];
    const rows = sim.leagues[gid].table();
    const sect = UI.section(g.lname + (g.gname ? ' ' + g.gname : ''), leagueTable(rows, { zones: sim.zones(gid) }));
    const zl = zoneLegend(sim.zones(gid)); if (zl) sect.appendChild(zl);
    body.appendChild(sect);
    const ts = sim.topScorers(sim.leagues[gid].clubs, 5);
    if (ts.length) {
      const s = UI.section(T('scorers'));
      ts.forEach((x, i) => s.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm', text: i + 1 }), crest(x.club, 20), h('b', { text: x.name }), h('small', { text: W.clubs[x.club].short }), h('span', { class: 'sc', text: x.goals }))));
      body.appendChild(s);
    }
    // country ranking
    const rk = UI.section(T('world.rank'));
    const t = h('table', { class: 'ptable' });
    countries.filter((x) => x.uefa).slice(0, 25).forEach((x) => {
      const q = FCK.euroQuota(x.rank);
      t.appendChild(h('tr', { class: x.cc === mine.cc ? 'st' : '' }, h('td', { text: x.rank }), h('td', { text: x.flag + ' ' + cname(x.cc) }), h('td', { class: 'ovr', text: Math.round(x.strength) }), h('td', { class: 'muted', text: 'CL ' + q.cl + ' · EL ' + (q.el + q.elCup) + ' · ECL ' + (q.ecl + q.eclCup) })));
    });
    rk.appendChild(h('div', { class: 'scrollx' }, t)); rk.appendChild(h('p', { class: 'fine', text: T('world.rank.note') }));
    body.appendChild(rk);
  }

  // ----- history tab -----
  function tabHistory(body, c) {
    const sim = c.sim;
    const trophies = { league: c.chist.filter((s) => s.champ).length, cup: c.chist.filter((s) => s.cup).length, euro: c.chist.filter((s) => s.euroWon).length };
    body.appendChild(UI.section(T('hist.trophies'), h('div', { class: 'row center trophies' }, h('div', { class: 'tr' }, h('b', { text: trophies.league }), h('small', { text: T('hist.league') })), h('div', { class: 'tr' }, h('b', { text: trophies.cup }), h('small', { text: T('hist.cup') })), h('div', { class: 'tr' }, h('b', { text: trophies.euro }), h('small', { text: T('hist.euro') })))));
    const sect = UI.section(T('hist.seasons'));
    if (!c.chist.length) sect.appendChild(h('p', { class: 'muted', text: T('hist.none') }));
    const tbl = h('table', { class: 'ptable' });
    c.chist.slice().reverse().forEach((s) => tbl.appendChild(h('tr', null, h('td', { text: C.seasonLabel(s.y) }), h('td', { text: s.lname }), h('td', { class: 'ovr', text: s.pos + '.' }), h('td', { text: s.pts + ' ' + T('t.pts') }), h('td', { text: (s.champ ? '🏆' : '') + (s.cup ? '🏆' : '') + (s.euro ? ' ' + s.euro.toUpperCase() : '') }))));
    sect.appendChild(h('div', { class: 'scrollx' }, tbl));
    body.appendChild(sect);
    const wh = UI.section(T('hist.world'));
    if (!sim.hist.length) wh.appendChild(h('p', { class: 'muted', text: T('hist.none') }));
    sim.hist.slice().reverse().forEach((s) => {
      const d = h('details', { class: 'rnd' });
      d.appendChild(h('summary', null, h('b', { text: C.seasonLabel(s.year) }), h('small', { text: ' · CL: ' + (s.euro.cl >= 0 ? W.clubs[s.euro.cl].name : '–') })));
      ['cl', 'el', 'ecl'].forEach((k) => { if (s.euro[k] >= 0) d.appendChild(h('div', { class: 'goalrow' }, h('b', { text: euroName(k) }), crest(s.euro[k], 18), h('span', { text: W.clubs[s.euro[k]].name }))); });
      Object.keys(s.champs).sort((a, b) => W.byCc[a].rank - W.byCc[b].rank).forEach((cc) => d.appendChild(h('div', { class: 'goalrow' }, h('span', { text: flagOf(cc) }), crest(s.champs[cc], 18), h('span', { text: W.clubs[s.champs[cc]].name }), s.cups[cc] !== undefined && s.cups[cc] >= 0 ? h('small', { text: T('hist.cupw') + ': ' + W.clubs[s.cups[cc]].name }) : null)));
      wh.appendChild(d);
    });
    body.appendChild(wh);
  }

  // ----- menu tab -----
  function tabMenu(body, c) {
    const sect = UI.section(T('tab.menu'));
    sect.appendChild(h('div', { class: 'menu-col' },
      UI.btn(T('career.slots'), () => UI.show('careerSaves'), 'ghost'),
      UI.btn(T('career.rename'), () => {
        const inp = h('input', { class: 'txt', value: c.name, maxlength: 40 });
        UI.modal(T('career.rename'), h('div', null, inp, h('div', { class: 'row center' }, UI.btn(T('ok'), () => { c.name = inp.value.trim() || c.name; C.autosave(); UI.closeModal(); refresh(); }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost'))));
      }, 'ghost'),
      UI.btn(T('career.matchsettings'), () => matchSettings(c), 'ghost'),
      UI.btn(T('career.tohome'), () => { C.autosave(); UI.stack = []; UI.show('home', null, true); }, 'ghost')));
    body.appendChild(sect);
    body.appendChild(h('p', { class: 'fine', text: T('career.autosave') }));
  }
  function matchSettings(c) {
    const wrap = h('div', null);
    wrap.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.cpu') }), UI.chips(['rookie', 'amateur', 'pro', 'world', 'legend'].map((k) => ({ v: k, l: T('level.' + k) })), c.level, (v) => { c.level = v; })));
    wrap.appendChild(UI.slider(T('set.half'), 2, 10, 1, c.halfMins, (v) => { c.halfMins = v; }, (v) => v + ' ' + T('min')));
    wrap.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('career.players') }), UI.chips([{ v: 'p1', l: T('preset.p1') }, { v: 'p2co', l: T('preset.p2co') }, { v: 'p2vs', l: T('preset.p2vs') }], c.preset, (v) => { c.preset = v; })));
    wrap.appendChild(FCK.PadNav.controlLine(() => c.preset));
    wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('ok'), () => { C.autosave(); UI.closeModal(); }, 'primary')));
    UI.modal(T('career.matchsettings'), wrap);
  }

  FCK.clubModal = clubModal;
  FCK.CareerUI = { clubSection, tabTable, tabFixtures, tabComps, tabWorld, tabHistory, formDots, leagueTable, zoneLegend, crest, flagOf, cname, euroName, confirmSim };
})((globalThis.FCK = globalThis.FCK || {}));
