/* FCK - proui.js : Profikarriere screens (menu, new player, hub with player / career tabs, season review, offers, retirement) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const W = FCK.World;
  const C = FCK.Career;
  const P = FCK.Pro;
  const T = (k, v) => FCK.T(k, v);
  FCK.Screens = FCK.Screens || {};
  const CU = () => FCK.CareerUI;
  const crest = (i, s) => UI.crestImg(typeof i === 'number' ? W.clubs[i] : i, s || 22);
  const money = (k) => FCK.Mgr.money(k);
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', FCK.settings.lang === 'en' ? '.' : ',');
  const natName = (id) => FCK.Tourney.natName(id);
  const natFlag = (id) => (FCK.NATION_BY_ID[id] ? FCK.NATION_BY_ID[id].flag : '');
  const refresh = () => UI.show('proHub', null, true);
  const save = () => C.autosave();
  const roleChip = (r) => h('span', { class: 'ci role-' + r, text: T('pro.role.' + r) });

  // small meter bar
  function meter(label, val, cls) {
    const v = Math.round(U.clamp(val, 0, 100));
    return h('div', { class: 'pmeter ' + (cls || '') }, h('span', { class: 'pm-l', text: label }), h('span', { class: 'pm-b' }, h('i', { style: 'width:' + v + '%' })), h('b', { class: 'pm-v', text: v }));
  }
  function avatar(look, size) {
    const w = size || 54;
    return h('img', { class: 'pavatar', alt: '', width: w, height: Math.round(w * 1.2), src: FCK.Face.url(look, Math.max(96, w * 2)) });
  }
  const posChip = (pos) => h('span', { class: 'ci pos-' + FCK.ROLE_OF[pos], text: FCK.posL(pos) });

  // ======================= menu =======================
  FCK.Screens.proMenu = function () {
    W.build();
    const el = h('div', { class: 'page' });
    el.appendChild(UI.header(T('home.pro'), () => UI.back()));
    const auto = C.autoInfo('pro');
    const menu = h('nav', { class: 'menu wide-menu' });
    const item = (label, sub, fn, cls) => {
      const b = h('button', { class: 'mitem ' + (cls || ''), type: 'button' }, h('b', { text: label }), h('small', { text: sub }));
      b.addEventListener('click', () => { FCK.Audio.init(); UI.sfx('click'); fn(); });
      return b;
    };
    if (auto && auto.pro) menu.appendChild(item(T('pro.continue'), auto.pro.name + ' · ' + auto.club.name + ' · ' + T('pro.age', { n: auto.pro.age }), () => { if (C.loadAuto('pro')) UI.show('proHub'); else UI.toast(T('career.loadfail')); }, 'primary'));
    menu.appendChild(item(T('pro.new'), T('pro.new.sub'), () => UI.show('proNew'), auto && auto.pro ? '' : 'primary'));
    menu.appendChild(item(T('career.slots'), T('career.slots.sub'), () => UI.show('careerSaves')));
    el.appendChild(menu);
    el.appendChild(h('section', { class: 'card sect' }, h('h3', { text: T('pro.about.t') }), h('p', { text: T('pro.about') }), h('p', { class: 'fine', text: T('pro.about.note') })));
    return el;
  };

  // ======================= new player =======================
  const colorBtn = (col, on, fn) => { const b = h('button', { class: 'swatch' + (on ? ' on' : ''), type: 'button', style: 'background:' + col, 'aria-label': col }); b.addEventListener('click', () => { UI.sfx('click'); fn(); }); return b; };
  FCK.Screens.proNew = function () {
    W.build();
    const kids = FCK.settings.profile === 'kids';
    const st = FCK.proDraft || (FCK.proDraft = { name: '', nation: FCK.settings.lang === 'en' ? 'ENG' : 'GER', pos: 'ST', foot: 'R', num: 9, age: 17, arch: 'balanced', talent: 'solid', skin: 1, hairStyle: 'short', hair: 1, beard: false, clubId: null, own: false, customId: null, ctl: 'player', level: kids ? 'rookie' : 'pro', halfMins: kids ? 3 : 4, preset: 'p1', seed: (Math.random() * 4e9) >>> 0 });
    const el = h('div', { class: 'page pro-new' });
    const draw = () => {
      el.innerHTML = '';
      el.appendChild(UI.header(T('pro.new'), () => UI.back()));
      const look = st.look || (st.look = FCK.Face.norm({ skin: FCK.SKIN[st.skin || 1], hairStyle: st.hairStyle || 'short', hair: FCK.HAIR[st.hair || 1], beard: !!st.beard }));
      // --- player
      const s1 = UI.section(T('pro.s.player'));
      const nameIn = h('input', { class: 'txt', value: st.name, maxlength: 28, placeholder: T('pro.name.ph') });
      nameIn.addEventListener('input', () => { st.name = nameIn.value; });
      s1.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.name') }), nameIn));
      const nats = FCK.NATIONS.slice().sort((a, b) => (FCK.settings.lang === 'en' ? a.en.localeCompare(b.en) : a.de.localeCompare(b.de)));
      s1.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.nation') }), UI.select(nats.map((n) => ({ v: n.id, l: n.flag + ' ' + (FCK.settings.lang === 'en' ? n.en : n.de) })), st.nation, (v) => { st.nation = v; }, T('pro.nation'))));
      s1.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.pos') }), UI.chips(P.POS.map((p) => ({ v: p, l: FCK.posL(p) })), st.pos, (v) => { st.pos = v; st.num = ({ GK: 1, LB: 3, CB: 4, RB: 2, CDM: 6, CM: 8, CAM: 10, LM: 11, RM: 7, LW: 11, RW: 7, ST: 9 })[v]; draw(); }, 'scroll'), h('small', { class: 'fine', text: T('pro.pos.' + FCK.ROLE_OF[st.pos]) })));
      s1.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.foot') }), UI.chips([{ v: 'R', l: T('pro.foot.R') }, { v: 'L', l: T('pro.foot.L') }], st.foot, (v) => { st.foot = v; })));
      s1.appendChild(UI.slider(T('pro.num'), 1, 99, 1, st.num, (v) => { st.num = v; }, (v) => '#' + v));
      s1.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.startage') }), UI.chips([16, 17, 18, 19, 20, 21].map((a) => ({ v: a, l: String(a) })), st.age, (v) => { st.age = v; draw(); })));
      s1.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.arch') }), UI.chips(Object.keys(P.ARCH).map((k) => ({ v: k, l: T('pro.arch.' + k) })), st.arch, (v) => { st.arch = v; draw(); }, 'scroll'), h('small', { class: 'fine', text: T('pro.arch.' + st.arch + '.d') })));
      s1.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.talent') }), UI.chips(['gem', 'solid', 'late'].map((k) => ({ v: k, l: T('pro.talent.' + k) })), st.talent, (v) => { st.talent = v; draw(); }), h('small', { class: 'fine', text: T('pro.talent.' + st.talent + '.d') })));
      el.appendChild(s1);
      // --- looks
      const s2 = UI.section(T('pro.s.look'));
      s2.appendChild(UI.lookEditor(look, () => {}));
      el.appendChild(s2);
      // --- club
      const tmp = P.newPlayer({ name: st.name || 'X', nation: st.nation, pos: st.pos, age: st.age, arch: st.arch, talent: st.talent, seed: st.seed });
      const sect3 = CU().clubSection(st, draw);
      const slotClub = st.clubId ? W.byId[st.clubId] : null;
      if (slotClub) {
        const y = 2026;
        const r = P.roleAt(tmp, slotClub, y, 1);
        sect3.appendChild(h('div', { class: 'row center' }, h('span', { class: 'ci', text: T('pro.expect') }), roleChip(r), h('span', { class: 'ci', text: T('pro.start.ovr', { n: Math.round(P.ovr(tmp)) }) })));
        sect3.appendChild(h('p', { class: 'fine', text: T('pro.role.' + r + '.d') }));
      }
      el.appendChild(sect3);
      // --- control + match
      const s4 = UI.section(T('pro.s.ctl'));
      s4.appendChild(h('div', { class: 'field' }, UI.chips([{ v: 'player', l: T('pro.ctl.player') }, { v: 'team', l: T('pro.ctl.team') }], st.ctl, (v) => { st.ctl = v; draw(); }), h('small', { class: 'fine', text: T('pro.ctl.' + st.ctl + '.d') })));
      s4.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.cpu') }), UI.chips(['rookie', 'amateur', 'pro', 'world', 'legend'].map((k) => ({ v: k, l: T('level.' + k) })), st.level, (v) => { st.level = v; })));
      s4.appendChild(UI.slider(T('set.half'), 2, 10, 1, st.halfMins, (v) => { st.halfMins = v; }, (v) => v + ' ' + T('min')));
      s4.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('career.players') }), UI.chips([{ v: 'p1', l: T('preset.p1') }, { v: 'p2co', l: T('preset.p2co') }, { v: 'p2vs', l: T('preset.p2vs') }], st.preset, (v) => { st.preset = v; })));
      el.appendChild(s4);
      el.appendChild(h('div', { class: 'row center sticky-actions' }, UI.btn(T('pro.start'), () => {
        if (!st.clubId || (st.own && !st.customId)) { UI.toast(T('career.pickclub.hint', { n: W.clubs.length })); return; }
        const name = (st.name || '').trim();
        if (name.length < 2) { UI.toast(T('pro.name.need')); return; }
        const pl = P.newPlayer({ name, nation: st.nation, pos: st.pos, age: st.age, arch: st.arch, talent: st.talent, foot: st.foot, num: st.num, look, ctl: st.ctl, seed: st.seed });
        const c = C.create({ clubId: st.clubId, custom: st.own ? (FCK.Editor.data.clubs.find((r) => r.id === st.customId) || null) : null, pro: pl, level: st.level, halfMins: st.halfMins, preset: st.preset });
        if (!c) { UI.toast(T('career.loadfail')); return; }
        C.autosave(); C.tab = 'home'; FCK.proDraft = null; UI.stack = ['home']; UI.show('proHub', null, true);
      }, 'primary xl'), UI.btn(T('back'), () => UI.back(), 'ghost')));
    };
    draw();
    return el;
  };

  // ======================= hub =======================
  FCK.Screens.proHub = function () {
    if (!C.cur || !C.cur.pro) { const a = C.loadAuto('pro'); if (!a) return FCK.Screens.proMenu(); }
    const c = C.cur, p = c.pro, sim = c.sim;
    const el = h('div', { class: 'page hub pro-hub' });
    const tab = ['home', 'player', 'table', 'fixtures', 'comps', 'career', 'world', 'menu'].includes(C.tab) ? C.tab : 'home';
    const g = W.groups[sim.gid[c.idx]], club = W.clubs[c.idx];
    const tb = sim.leagues[g.gid].table(), row = tb.find((r) => r.idx === c.idx);
    el.appendChild(h('header', { class: 'hub-head card' },
      UI.btn('‹', () => { C.autosave(); UI.stack = []; UI.show('home', null, true); }, 'ghost round'),
      avatar(p.look, 52),
      h('div', { class: 'hh-t' }, h('b', { class: 'big', text: p.name }), h('div', { class: 'muted', text: club.name + ' · ' + CU().flagOf(g.cc) + ' ' + g.lname + ' · ' + C.seasonLabel(sim.year) })),
      h('div', { class: 'hh-r' }, h('span', { class: 'ci ovr-big', text: Math.round(P.ovr(p)) }), posChip(p.pos), h('span', { class: 'ci', text: T('t.pos', { n: row ? row.pos : '-' }) }), p.sp ? h('span', { class: 'ci eu', text: '+' + p.sp + ' ' + T('pro.sp.short') }) : null)));
    const tabs = [['home', 'tab.home'], ['player', 'pro.tab.player'], ['table', 'tab.table'], ['fixtures', 'tab.fixtures'], ['comps', 'tab.comps'], ['career', 'pro.tab.career'], ['world', 'tab.world'], ['menu', 'tab.menu']];
    el.appendChild(UI.chips(tabs.map((x) => ({ v: x[0], l: T(x[1]) })), tab, (v) => { C.tab = v; refresh(); }, 'tabs'));
    const body = h('div', { class: 'hub-body' });
    el.appendChild(body);
    ({ home: tabHome, player: tabPlayer, table: (b) => CU().tabTable(b, c), fixtures: (b) => CU().tabFixtures(b, c), comps: (b) => CU().tabComps(b, c), career: tabCareer, world: (b) => CU().tabWorld(b, c), menu: tabMenu }[tab] || tabHome)(body, c);
    setTimeout(() => { if (p.pending === 'offers' && !UI.modalOpen && UI.cur === 'proHub') offersDialog(c); }, 40);
    return el;
  };

  // ----- overview -----
  function tabHome(body, c) {
    const p = c.pro, sim = c.sim;
    if (p.retired) { body.appendChild(retiredCard(c)); body.appendChild(careerSummary(c)); return; }
    if (p.pending) body.appendChild(pendingCard(c));
    const nx = C.next();
    const role = P.roleLabel(c);
    if (nx) {
      const f = nx.f, info = nx.info, home = f.h === c.idx;
      const d = C.dateOf(sim.year, nx.w, nx.s);
      const card = h('section', { class: 'card sect next-card' }, h('h3', { text: T('next.match') }));
      card.appendChild(h('div', { class: 'nm-row' },
        h('div', { class: 'nm-t' }, crest(f.h, 64), h('b', { text: W.clubs[f.h].name })),
        h('div', { class: 'nm-vs' }, h('small', { text: C.fmtDate(d) }), h('b', { text: 'VS' }), h('small', { text: f.neutral ? T('final.venue') : home ? T('home') : T('away') })),
        h('div', { class: 'nm-t' }, crest(f.a, 64), h('b', { text: W.clubs[f.a].name }))));
      card.appendChild(h('p', { class: 'center muted', text: C.compLabel(f, info) + (info.aggLead || info.leg === 1 ? ' · ' + T('agg.hint') : '') }));
      card.appendChild(h('div', { class: 'row center' }, h('span', { class: 'ci', text: T('pro.yourrole') }), roleChip(role), p.inj > 0 ? h('span', { class: 'ci bad', text: T('pro.injured', { n: p.inj }) }) : null));
      card.appendChild(h('div', { class: 'field center' }, h('span', { class: 'lbl', text: T('pro.ctl') }), UI.chips([{ v: 'player', l: T('pro.ctl.player') }, { v: 'team', l: T('pro.ctl.team') }], p.ctl, (v) => { p.ctl = v; save(); refresh(); }), h('small', { class: 'fine', text: T('pro.ctl.' + p.ctl + '.d') + (p.ctl === 'player' && (role === 'out' || p.inj > 0) ? ' ' + T('pro.ctl.watch') : '') })));
      const blocked = !!p.pending && p.pending === 'offers';
      card.appendChild(h('div', { class: 'row center' },
        blocked ? h('p', { class: 'bad', text: T('pro.decide.first') }) : UI.btn('▶ ' + (p.ctl === 'player' && (role === 'out' || p.inj > 0) ? T('pro.watch') : T('play')), () => { C.play(); }, 'primary xl'),
        UI.btn(T('simulate'), () => { if (blocked) { UI.toast(T('pro.decide.first')); return; } const r = C.simulateNext(); if (r) { const e = c.lastResult; UI.toast(W.clubs[e.h].short + ' ' + e.g[0] + ':' + e.g[1] + ' ' + W.clubs[e.a].short); } refresh(); }, 'ghost'),
        UI.btn(T('sim.season'), () => { if (blocked) { UI.toast(T('pro.decide.first')); return; } CU().confirmSim(); }, 'ghost')));
      body.appendChild(card);
    } else body.appendChild(seasonEndCard(c));
    // player card
    const S = p.season, ps = P.stats(p);
    const pc = UI.section(T('pro.you'));
    pc.appendChild(h('div', { class: 'row tight' }, posChip(p.pos), h('span', { class: 'ci', text: natFlag(p.nat) + ' ' + natName(p.nat) }), h('span', { class: 'ci', text: T('pro.age', { n: p.age }) }), h('span', { class: 'ci', text: '#' + p.num }), h('span', { class: 'ci', text: T('pro.pot', { n: p.pt }) })));
    pc.appendChild(h('div', { class: 'pmeters' }, meter(T('pro.form'), p.form, p.form >= 60 ? 'good' : p.form < 40 ? 'bad' : ''), meter(T('pro.fit'), p.fit, p.fit < 50 ? 'bad' : ''), meter(T('pro.trust'), p.trust, '')));
    pc.appendChild(h('div', { class: 'stat-row' },
      statBox(S.ap, T('pro.st.ap')), statBox(S.g, T('pro.st.g')), statBox(S.a, T('pro.st.a')), statBox(ps.avg ? f1(ps.avg) : '–', T('pro.st.avg')), statBox(S.mom, T('pro.st.mom'))));
    if (p.last) pc.appendChild(h('p', { class: 'fine center', text: lastLine(c) }));
    pc.appendChild(h('div', { class: 'row' }, UI.btn(T('pro.tab.player'), () => { C.tab = 'player'; refresh(); }, 'ghost sm')));
    body.appendChild(pc);
    // objectives
    const ob = UI.section(T('pro.goals'));
    p.obj.forEach((o) => ob.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm', text: objDone(c, o) ? '✓' : '·' }), h('b', { text: objText(o) }), h('small', { text: objProg(c, o) }))));
    ob.appendChild(h('p', { class: 'fine', text: T('pro.goals.note') }));
    body.appendChild(ob);
    // table + news
    const grid = h('div', { class: 'grid2' });
    const g = W.groups[sim.gid[c.idx]], tb = sim.leagues[g.gid].table(), me = tb.findIndex((r) => r.idx === c.idx), lo = Math.max(0, Math.min(me - 2, tb.length - 5));
    grid.appendChild(UI.section(T('tab.table'), CU().formDots(c.log.filter((e) => e.y === sim.year), 6), CU().leagueTable(tb, { zones: sim.zones(g.gid), window: [lo, lo + 5] })));
    const news = UI.section(T('news'));
    if (!c.news.length) news.appendChild(h('p', { class: 'muted', text: T('news.none') }));
    c.news.slice(0, 8).forEach((n) => news.appendChild(h('div', { class: 'news-i' }, h('small', { text: C.fmtDate(C.dateOf(n.y, n.w, 1)) }), h('span', { text: T(n.k, n.v) }))));
    grid.appendChild(news);
    body.appendChild(grid);
  }
  const statBox = (v, l) => h('div', { class: 'sbox' }, h('b', { text: v }), h('small', { text: l }));
  function lastLine(c) {
    const l = c.pro.last;
    return T('pro.last', { h: W.clubs[l.h].short, a: W.clubs[l.a].short, s: l.g[0] + ':' + l.g[1] }) + ' · ' + (l.mins ? T('pro.last.p', { m: l.mins, r: f1(l.rating), g: l.goals, as: l.assists }) : T('pro.last.n'));
  }
  const objText = (o) => T('pro.ob.' + o.k, { n: o.k === 'rt' ? f1(o.n / 10) : o.n });
  function objProg(c, o) {
    const S = c.pro.season;
    return o.k === 'ap' ? S.ap + '/' + o.n : o.k === 'rt' ? (S.rn ? f1(S.rs / S.rn) : '–') : o.k === 'ga' ? (S.g + S.a) + '/' + o.n : S.cs + '/' + o.n;
  }
  function objDone(c, o) {
    const S = c.pro.season;
    return o.k === 'ap' ? S.ap >= o.n : o.k === 'rt' ? S.rn >= 5 && S.rs / S.rn >= o.n / 10 : o.k === 'ga' ? S.g + S.a >= o.n : S.cs >= o.n;
  }

  // ----- decision card (offers / retirement) -----
  function pendingCard(c) {
    const p = c.pro;
    const card = h('section', { class: 'card sect next-card pending' });
    if (p.pending === 'offers') {
      card.appendChild(h('h3', { text: T('pro.offers.t') }));
      card.appendChild(h('p', { text: T('pro.offers.expired') }));
      card.appendChild(h('div', { class: 'row center' }, UI.btn(T('pro.offers.open'), () => offersDialog(c), 'primary xl')));
    } else if (p.pending === 'optional') {
      card.appendChild(h('h3', { text: T('pro.offers.t') }));
      card.appendChild(h('p', { text: T('pro.offers.interest', { n: p.offers.length - 1 }) }));
      card.appendChild(h('div', { class: 'row center' }, UI.btn(T('pro.offers.open'), () => offersDialog(c), 'primary'), UI.btn(T('pro.offers.stay'), () => { p.pending = null; p.offers = []; save(); refresh(); }, 'ghost')));
    } else if (p.pending === 'retire?') {
      card.appendChild(h('h3', { text: T('pro.retire.t') }));
      card.appendChild(h('p', { text: T('pro.retire.ask', { n: p.age }) }));
      card.appendChild(h('div', { class: 'row center' }, UI.btn(T('pro.retire.go'), () => confirmRetire(c), 'primary'), UI.btn(T('pro.retire.no'), () => { p.pending = null; save(); refresh(); }, 'ghost')));
    }
    return card;
  }
  function offersDialog(c) {
    const p = c.pro, sim = c.sim;
    if (!p.offers || !p.offers.length) { p.pending = null; return; }
    const wrap = h('div', { class: 'offers' });
    wrap.appendChild(h('p', { class: 'fine', text: T('pro.offers.hint') }));
    p.offers.forEach((o) => {
      const cl = W.clubs[o.idx], g = W.groups[sim.gid[o.idx]];
      const row = h('div', { class: 'offer' + (o.own ? ' own' : '') },
        crest(o.idx, 44),
        h('div', { class: 'of-i' }, h('b', { text: cl.name + (o.own ? ' · ' + T('pro.offers.own') : '') }), h('small', { text: CU().flagOf(g.cc) + ' ' + g.lname + (g.gname ? ' ' + g.gname : '') }), h('div', { class: 'row tight' }, roleChip(o.role), h('span', { class: 'ci', text: money(o.wage) + ' ' + T('pro.perweek') }), h('span', { class: 'ci', text: T('pro.years', { n: o.years }) }))),
        UI.btn(o.own ? T('pro.offers.renew') : T('pro.offers.take'), () => {
          P.acceptOffer(c, o); UI.closeModal(); C.autosave(); refresh();
        }, o.own ? 'ghost sm' : 'primary sm'));
      wrap.appendChild(row);
    });
    if (p.pending !== 'offers') wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('close'), () => UI.closeModal(), 'ghost')));
    UI.modal(T('pro.offers.t'), wrap, { cls: 'wide', sticky: p.pending === 'offers' });
  }

  // ----- transfer request -----
  function requestFlow(c) {
    const p = c.pro, sim = c.sim;
    if (P.requestsLeft(c) <= 0) { UI.toast(T('pro.req.limit')); return; }
    FCK.clubPicker({ career: true, title: T('pro.req.pick'), current: c.clubId, onPick: (t) => {
      const idx = t.idx !== undefined ? t.idx : W.byId[t.id].idx;
      const res = P.requestTransfer(c, idx);
      C.autosave();
      const cl = W.clubs[idx];
      const wrap = h('div', { class: 'offers' });
      if (res.ok) {
        const o = res.offer, g = W.groups[sim.gid[idx]];
        wrap.appendChild(h('p', { text: T('pro.req.yes', { club: cl.name }) }));
        wrap.appendChild(h('div', { class: 'offer' }, crest(idx, 44),
          h('div', { class: 'of-i' }, h('b', { text: cl.name }), h('small', { text: CU().flagOf(g.cc) + ' ' + g.lname + (g.gname ? ' ' + g.gname : '') }), h('div', { class: 'row tight' }, roleChip(o.role), h('span', { class: 'ci', text: money(o.wage) + ' ' + T('pro.perweek') }), h('span', { class: 'ci', text: T('pro.years', { n: o.years }) })))));
        wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('pro.offers.take'), () => { P.acceptOffer(c, o); UI.closeModal(); C.autosave(); refresh(); }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')));
      } else {
        wrap.appendChild(h('p', { text: T('pro.req.no.' + res.why, { club: cl.name }) }));
        wrap.appendChild(h('p', { class: 'fine', text: T('pro.req.left', { n: P.requestsLeft(c) }) }));
        wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('ok'), () => { UI.closeModal(); refresh(); }, 'primary')));
      }
      setTimeout(() => UI.modal(T('pro.req.t'), wrap, { cls: 'wide' }), 60);
    } });
  }

  // ----- end of the season -----
  function seasonEndCard(c) {
    const p = c.pro, sim = c.sim;
    const sm = C.seasonSummary(), g = W.groups[sm.gid];
    const card = h('section', { class: 'card sect next-card' }, h('h3', { text: T('season.over', { s: C.seasonLabel(sim.year) }) }));
    card.appendChild(h('p', { class: 'center', text: T('season.result', { pos: sm.pos, n: sm.n, l: g.lname, pts: sm.pts }) }));
    if (sm.pos === 1) card.appendChild(h('p', { class: 'center ok', text: '🏆 ' + T('season.champ') }));
    if (sm.cupWon) card.appendChild(h('p', { class: 'center ok', text: '🏆 ' + T('season.cupwin') }));
    card.appendChild(h('div', { class: 'row center' }, UI.btn(T('season.next'), () => {
      const s = C.endSeason();
      C.autosave();
      seasonReview(c, s);
    }, 'primary xl')));
    return card;
  }
  function seasonReview(c, sm) {
    const p = c.pro, rep = sm.pro;
    const wrap = h('div', { class: 'review' });
    if (rep) {
      const S = rep.season;
      wrap.appendChild(h('div', { class: 'stat-row' }, statBox(S.ap, T('pro.st.ap')), statBox(S.g, T('pro.st.g')), statBox(S.a, T('pro.st.a')), statBox(rep.avg ? f1(rep.avg) : '–', T('pro.st.avg')), statBox(S.mom, T('pro.st.mom'))));
      wrap.appendChild(h('p', { class: 'center', text: T('pro.rev.dev', { a: Math.round(rep.ovrBefore), b: Math.round(P.ovr(p)), age: p.age }) }));
      rep.trophies.forEach((k) => wrap.appendChild(h('p', { class: 'center ok', text: '🏆 ' + T('pro.tr.' + k) })));
      rep.awards.forEach((k) => wrap.appendChild(h('p', { class: 'center ok', text: '⭐ ' + T('pro.aw.' + k) })));
      if (rep.objs.length) {
        wrap.appendChild(h('h4', { text: T('pro.goals') }));
        rep.objs.forEach((o) => wrap.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm ' + (o.done ? 'ok' : 'bad'), text: o.done ? '✓' : '✗' }), h('b', { text: objText(o) }), h('small', { text: o.done ? '+150 XP' : '' }))));
      }
      if (rep.tour) wrap.appendChild(h('p', { class: 'center', text: rep.tour.in ? T('pro.rev.tour', { k: T('tn.kind.' + rep.tour.kind), p: T('tn.place.' + (rep.tour.place === 'W' ? 'W.' + (rep.tour.kind === 'wm48' ? 'wm' : 'em') : rep.tour.place)), g: rep.tour.g }) : T('pro.rev.tour.no', { k: T('tn.kind.' + rep.tour.kind) }) }));
    }
    wrap.appendChild(h('p', { class: 'center muted', text: T('pro.rev.next', { s: C.seasonLabel(c.sim.year), club: W.clubs[c.idx].name }) }));
    wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('ok'), () => { UI.closeModal(); refresh(); if (p.pending === 'offers') offersDialog(c); }, 'primary')));
    UI.modal(T('pro.rev.t', { s: C.seasonLabel(c.sim.year - 1) }), wrap, { cls: 'wide' });
    refresh();
  }

  // ----- player tab -----
  // ----- the 30 abilities -----
  let abGrp = 'mine';
  function abilitiesSection(c) {
    const A = FCK.Abilities, p = c.pro;
    p.ab = p.ab || [];
    const sect = UI.section(T('ab.title'));
    sect.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci', text: T('ab.count', { n: p.ab.length, t: A.count }) }), h('span', { class: 'ci eu', text: T('pro.sp', { n: p.sp }) })));
    const items = [{ v: 'mine', l: T('ab.mine') + ' (' + p.ab.length + ')' }].concat(A.GROUPS.map((g) => ({ v: g, l: T('ab.g.' + g) })));
    sect.appendChild(UI.chips(items, abGrp, (v) => { abGrp = v; refresh(); }, 'scroll'));
    const list = A.LIST.filter((a) => (abGrp === 'mine' ? A.has(p, a.id) : a.grp === abGrp));
    if (!list.length) sect.appendChild(h('p', { class: 'muted', text: T('ab.none') }));
    const box = h('div', { class: 'ablist' });
    list.forEach((a) => {
      const why = A.why(p, a.id), owned = why === 'owned';
      const reqs = Object.keys(a.req).map((k) => T('pro.a.' + k) + ' ' + a.req[k]).join(' · ');
      const row = h('div', { class: 'abrow' + (owned ? ' own' : why ? ' lock' : '') },
        h('span', { class: 'abico', text: a.ico }),
        h('div', { class: 'abtx' }, h('b', { text: T('ab.' + a.id) }), h('small', { text: T('ab.' + a.id + '.d') }), h('small', { class: 'abreq' + (why === 'req' || why === 'pos' ? ' bad' : ''), text: owned ? T('ab.owned') : (why === 'pos' ? T('ab.why.pos') : T('ab.req', { r: reqs }) + ' · ' + T('ab.cost', { n: a.cost })) })));
      if (!owned) {
        const b = UI.btn(T('ab.unlock'), () => { if (A.unlock(c, a.id)) { UI.sfx('ok'); UI.toast(T('ab.toast', { n: T('ab.' + a.id) })); save(); refresh(); } }, 'primary sm');
        if (why) b.disabled = true;
        row.appendChild(b);
      }
      box.appendChild(row);
    });
    sect.appendChild(box);
    sect.appendChild(h('p', { class: 'fine', text: T('ab.note') }));
    return sect;
  }
  const openAttrs = {};
  function tabPlayer(body, c) {
    const p = c.pro;
    const cap = P.cap(p);
    const sect = UI.section(T('pro.attrs'));
    sect.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci ovr-big', text: Math.round(P.ovr(p)) }), posChip(p.pos), h('span', { class: 'ci', text: T('pro.pot', { n: p.pt }) }), h('span', { class: 'ci', text: T('pro.cap', { n: Math.round(cap) }) }), h('span', { class: 'ci eu', text: T('pro.sp', { n: p.sp }) })));
    sect.appendChild(h('div', { class: 'xpbar' }, h('i', { style: 'width:' + Math.round(p.xp) + '%' }), h('small', { text: T('pro.xp', { n: Math.round(p.xp) }) })));
    const keys = FCK.ROLE_OF[p.pos] === 'GK' ? ['gk'].concat(P.ATTR) : P.ATTR;
    P.fix(p);
    const open = openAttrs;
    const detRow = (key, cls) => {
      const v = p.d[key];
      const r = h('div', { class: 'attr ' + (cls || '') }, h('span', { class: 'at-n', text: T('pro.d.' + key) }), h('span', { class: 'at-b' }, h('i', { style: 'width:' + Math.round(U.clamp(v, 0, 99)) + '%' })), h('b', { class: 'at-v', text: Math.round(v) }));
      const add = UI.btn('+', () => { if (P.spend(c, key)) { UI.sfx('ok'); save(); refresh(); } }, 'primary sm round');
      if (!P.canSpend(p, key)) add.disabled = true;
      r.appendChild(add);
      return r;
    };
    keys.forEach((k) => {
      const v = p.a[k];
      const row = h('div', { class: 'attr head' }, h('span', { class: 'at-n', text: T('pro.a.' + k) }), h('span', { class: 'at-b' }, h('i', { style: 'width:' + Math.round(U.clamp(v, 0, 99)) + '%' })), h('b', { class: 'at-v', text: Math.round(v) }));
      const tog = UI.btn(open[k] ? '▴' : '▾', () => { open[k] = !open[k]; refresh(); }, 'ghost sm round');
      tog.setAttribute('aria-expanded', open[k] ? 'true' : 'false'); tog.setAttribute('aria-label', T('pro.a.' + k));
      row.appendChild(tog);
      sect.appendChild(row);
      if (open[k]) (k === 'gk' ? P.GKD : P.DET[k].map((x) => x[0])).forEach((key) => sect.appendChild(detRow(key, 'sub')));
    });
    sect.appendChild(h('p', { class: 'fine', text: T('pro.attrs.note') }));
    body.appendChild(sect);
    const fsec = UI.section(T('face.title'));
    fsec.appendChild(h('div', { class: 'row' }, avatar(p.look, 64), UI.btn(T('face.edit'), () => {
      const ed = UI.lookEditor(p.look, () => {});
      UI.modal(T('face.title'), h('div', null, ed, h('div', { class: 'row center' }, UI.btn(T('close'), () => { UI.closeModal(); p.look = FCK.Face.norm(p.look); save(); refresh(); }, 'primary'))), { cls: 'face-modal', sticky: true });
    }, 'ghost')));
    body.appendChild(fsec);
    body.appendChild(abilitiesSection(c));
    const tr = UI.section(T('pro.train'));
    tr.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.train.focus') }), UI.chips(keys.filter((k) => k !== 'gk').map((k) => ({ v: k, l: T('pro.a.' + k) })).concat([{ v: 'all', l: T('pro.train.all') }]), p.train.focus, (v) => { p.train.focus = v; save(); refresh(); }, 'scroll')));
    tr.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pro.train.int') }), UI.chips(['low', 'normal', 'high'].map((k) => ({ v: k, l: T('m.tr.' + k) })), p.train.int, (v) => { p.train.int = v; save(); refresh(); }), h('small', { class: 'fine', text: T('pro.train.hint') })));
    tr.appendChild(h('div', { class: 'pmeters' }, meter(T('pro.form'), p.form, p.form >= 60 ? 'good' : p.form < 40 ? 'bad' : ''), meter(T('pro.fit'), p.fit, p.fit < 50 ? 'bad' : ''), meter(T('pro.trust'), p.trust, '')));
    body.appendChild(tr);
    const rk = P.rankInfo(c);
    const sq = UI.section(T('pro.squadrole'));
    sq.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci', text: T('pro.yourrole') }), roleChip(P.roleLabel(c))));
    sq.appendChild(h('p', { class: 'fine', text: T('pro.role.explain', { me: Math.round(rk.me), kth: Math.round(rk.kth) }) }));
    const sp = P.setPieces(c);
    sq.appendChild(h('p', { class: 'fine', text: sp.length ? T('pro.setp', { l: sp.map((x) => T('pro.setp.' + x)).join(', ') }) : T('pro.setp.none') }));
    body.appendChild(sq);
  }

  // ----- career tab -----
  function tabCareer(body, c) {
    const p = c.pro, sim = c.sim;
    const club = W.clubs[c.idx];
    const ct = UI.section(T('pro.contract'));
    ct.appendChild(h('div', { class: 'cm-head' }, crest(club, 48), h('div', null, h('b', { class: 'big', text: club.name }), h('div', { class: 'muted', text: T('pro.contract.until', { y: p.contract.until }) + ' · ' + money(p.contract.wage) + ' ' + T('pro.perweek') }))));
    if (p.offers && p.offers.length > 1 && p.pending !== 'retire?') ct.appendChild(h('div', { class: 'row' }, UI.btn(T('pro.offers.open'), () => offersDialog(c), 'ghost sm')));
    const left = P.requestsLeft(c);
    if (!p.retired && P.canRequest(c)) ct.appendChild(h('div', { class: 'row' }, UI.btn('🔄 ' + T('pro.req.btn'), () => requestFlow(c), 'primary sm'), h('small', { class: 'muted', text: T('pro.req.left', { n: left }) })));
    else if (!p.retired) ct.appendChild(h('p', { class: 'fine', text: T('pro.req.blocked') }));
    body.appendChild(ct);
    body.appendChild(careerSummary(c));
    if (!p.retired && p.age >= 31) body.appendChild(UI.section(T('pro.retire.t'), h('p', { class: 'fine', text: T('pro.retire.hint') }), h('div', { class: 'row' }, UI.btn(T('pro.retire.go'), () => confirmRetire(c), 'ghost sm'))));
  }
  function careerSummary(c) {
    const p = c.pro, ps = P.stats(p);
    const wrap = h('div', null);
    const tot = UI.section(T('pro.totals'));
    tot.appendChild(h('div', { class: 'stat-row' }, statBox(ps.tAp, T('pro.st.ap')), statBox(ps.tG, T('pro.st.g')), statBox(ps.tA, T('pro.st.a')), statBox(ps.tAvg ? f1(ps.tAvg) : '–', T('pro.st.avg')), statBox(p.intl.caps, T('pro.caps'))));
    tot.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci', text: natFlag(p.nat) + ' ' + natName(p.nat) + ' · ' + T('pro.intl', { c: p.intl.caps, g: p.intl.goals }) })));
    wrap.appendChild(tot);
    const tr = UI.section(T('pro.trophies'));
    if (!p.trophies.length && !p.awards.length) tr.appendChild(h('p', { class: 'muted', text: T('pro.trophies.none') }));
    p.trophies.forEach((t) => tr.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm', text: '🏆' }), h('b', { text: T('pro.tr.' + t.k) }), h('small', { text: C.seasonLabel(t.y) + (t.k === 'wm' || t.k === 'em' ? '' : '') }))));
    p.awards.forEach((t) => tr.appendChild(h('div', { class: 'goalrow' }, h('span', { class: 'gm', text: '⭐' }), h('b', { text: T('pro.aw.' + t.k) }), h('small', { text: C.seasonLabel(t.y) }))));
    wrap.appendChild(tr);
    const hs = UI.section(T('pro.seasons'));
    if (!p.hist.length) hs.appendChild(h('p', { class: 'muted', text: T('hist.none') }));
    else {
      const tbl = h('table', { class: 'ptable' });
      tbl.appendChild(h('thead', null, h('tr', null, h('th', { text: T('pro.season') }), h('th', { text: T('t.club') }), h('th', { text: T('pro.st.ap') }), h('th', { text: T('pro.st.g') }), h('th', { text: T('pro.st.a') }), h('th', { text: T('pro.st.avg') }), h('th', { text: 'OVR' }))));
      p.hist.slice().reverse().forEach((s) => { const cl = W.byId[s.club]; tbl.appendChild(h('tr', null, h('td', { text: C.seasonLabel(s.y) }), h('td', { text: cl ? cl.short : '' }), h('td', { text: s.ap }), h('td', { text: s.g }), h('td', { text: s.a }), h('td', { text: s.avg ? f1(s.avg) : '–' }), h('td', { class: 'ovr', text: s.o }))); });
      hs.appendChild(h('div', { class: 'scrollx' }, tbl));
    }
    wrap.appendChild(hs);
    return wrap;
  }
  function confirmRetire(c) {
    const p = c.pro;
    UI.modal(T('pro.retire.t'), h('div', null, h('p', { text: T('pro.retire.sure') }), h('div', { class: 'row center' },
      UI.btn(T('pro.retire.go'), () => { P.retire(c); C.autosave(); UI.closeModal(); refresh(); }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost'))));
  }
  function retiredCard(c) {
    const lg = P.legacy(c);
    const card = h('section', { class: 'card sect next-card' }, h('h3', { text: T('pro.retired.t') }));
    card.appendChild(h('p', { class: 'center', text: T('pro.retired.text', { name: c.pro.name }) }));
    card.appendChild(h('p', { class: 'center big ok', text: T('pro.legacy.' + lg.tier) + ' · ' + lg.score + ' ' + T('pro.legacy.pts') }));
    card.appendChild(h('div', { class: 'row center' }, UI.btn(T('pro.new'), () => { UI.stack = ['home']; UI.show('proNew'); }, 'primary'), UI.btn(T('career.tohome'), () => { UI.stack = []; UI.show('home', null, true); }, 'ghost')));
    return card;
  }

  // ----- menu tab -----
  function tabMenu(body, c) {
    const p = c.pro;
    const sect = UI.section(T('tab.menu'));
    sect.appendChild(h('div', { class: 'menu-col' },
      UI.btn(T('career.slots'), () => UI.show('careerSaves'), 'ghost'),
      UI.btn(T('career.matchsettings'), () => matchSettings(c), 'ghost'),
      UI.btn(T('pro.nat.tour'), () => natTournament(c), 'ghost'),
      UI.btn(T('career.tohome'), () => { C.autosave(); UI.stack = []; UI.show('home', null, true); }, 'ghost')));
    body.appendChild(sect);
    body.appendChild(h('p', { class: 'fine', text: T('career.autosave') }));
  }
  function matchSettings(c) {
    const wrap = h('div', null);
    wrap.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.cpu') }), UI.chips(['rookie', 'amateur', 'pro', 'world', 'legend'].map((k) => ({ v: k, l: T('level.' + k) })), c.level, (v) => { c.level = v; })));
    wrap.appendChild(UI.slider(T('set.half'), 2, 10, 1, c.halfMins, (v) => { c.halfMins = v; }, (v) => v + ' ' + T('min')));
    wrap.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('career.players') }), UI.chips([{ v: 'p1', l: T('preset.p1') }, { v: 'p2co', l: T('preset.p2co') }, { v: 'p2vs', l: T('preset.p2vs') }], c.preset, (v) => { c.preset = v; })));
    wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('ok'), () => { C.autosave(); UI.closeModal(); }, 'primary')));
    UI.modal(T('career.matchsettings'), wrap);
  }
  // the national team plays its tournament with the normal tournament mode (the pro is not part of that squad)
  function natTournament(c) {
    const p = c.pro;
    const wrap = h('div', null, h('p', { text: T('pro.nat.tour.text', { nat: natName(p.nat) }) }));
    const mk = (kind) => UI.btn(T('tn.kind.' + kind), () => { const S = FCK.Tourney.create({ kind, me: p.nat }); FCK.Tourney.install(S); UI.closeModal(); C.autosave(); UI.stack = ['home']; UI.show('tourneyHub'); }, 'ghost');
    wrap.appendChild(h('div', { class: 'row center' }, mk('wm48'), mk('em24')));
    wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')));
    UI.modal(T('pro.nat.tour'), wrap);
  }
})((globalThis.FCK = globalThis.FCK || {}));
