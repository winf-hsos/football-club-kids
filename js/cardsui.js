/* FCK - cardsui.js : card mode screens (home, lineup, collection, shop, market, tasks, swaps, club) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const W = FCK.World;
  const Cs = FCK.Cards;
  const T = (k, v) => FCK.T(k, v);
  const CUI = {};
  FCK.CardsUI = CUI;
  const ROLE = FCK.ROLE_OF;
  const lang = () => (FCK.settings && FCK.settings.lang) || 'de';
  const num = (n) => Math.round(n).toLocaleString(lang() === 'de' ? 'de-DE' : 'en-GB');
  const flag = (nt) => FCK.groupFlag(nt);
  const lastName = (n) => { const p = n.split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };
  const err = (code, v) => UI.toast(T('k.err.' + code, v));
  const save = () => Cs.save();
  const ST = { tab: 'home', coll: { role: 'all', rar: 'all', sort: 'ovr', q: '', limit: 60 }, mk: { sub: 'offers', role: 'all', rar: 'all', sort: 'price' }, sbcPick: null };
  const ROLES = ['GK', 'DF', 'MF', 'FW'];
  const TABS = ['home', 'team', 'coll', 'shop', 'market', 'tasks', 'sbc', 'club'];

  // ------------------------------------------------------------------ small pieces
  const faces = new Map();
  function faceUrl(c) {
    let u = faces.get(c.id);
    if (u) return u;
    if (typeof document === 'undefined') return '';
    try {
      const p = Cs.player(c, c.pos, c.o, 0);
      const cl = Cs.clubOf(c);
      const cv = document.createElement('canvas'); cv.width = cv.height = 96;
      const g = cv.getContext('2d');
      g.fillStyle = cl && cl.colors ? cl.colors.p : '#445'; g.beginPath(); g.ellipse(48, 100, 46, 42, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.stroke();
      g.save(); g.translate(54, 48); FCK.Renderer.prototype.drawHead.call({}, g, p.look, 23); g.restore();
      u = cv.toDataURL();
    } catch (e) { u = ''; }
    faces.set(c.id, u);
    return u;
  }
  // one player card. o: { sz: 's'|'m'|'l', eff, chem, onClick, cls }
  function fc(c, o) {
    o = o || {};
    const sz = o.sz || 'm';
    const el = h('div', { class: 'fc r' + c.r + (c.rare ? ' rare' : '') + ' sz-' + sz + (o.cls ? ' ' + o.cls : ''), title: c.n + ' · ' + FCK.posL(c.pos) + ' ' + c.o });
    const shown = o.eff !== undefined ? o.eff : c.o;
    el.appendChild(h('div', { class: 'fc-ovr' + (o.eff !== undefined && o.eff > c.o ? ' up' : o.eff !== undefined && o.eff < c.o ? ' dn' : ''), text: String(shown) }));
    el.appendChild(h('div', { class: 'fc-pos', text: FCK.posL(c.pos) }));
    el.appendChild(h('img', { class: 'fc-face', alt: '', src: faceUrl(c) }));
    el.appendChild(h('div', { class: 'fc-name', text: lastName(c.n) }));
    if (sz !== 's') {
      const cl = Cs.clubOf(c);
      el.appendChild(h('div', { class: 'fc-meta' }, cl ? UI.crestImg(cl, sz === 'l' ? 22 : 16) : null, h('span', { text: flag(c.nt) })));
    }
    if (sz === 'l') {
      const p = Cs.player(c, c.pos, c.o, 0);
      const st = h('div', { class: 'fc-stats' });
      [['pac', 'pac'], ['sho', 'sho'], ['pas', 'pas'], ['dri', 'dri'], ['def', 'def'], ['phy', 'phy']].forEach((a) => st.appendChild(h('span', null, h('b', { text: String(p.a[a[0]]) }), ' ' + T('m.a.' + a[1]).slice(0, 3).toUpperCase())));
      el.appendChild(st);
    }
    if (c.nw) el.appendChild(h('i', { class: 'fc-new', text: T('k.new') }));
    if (o.chem !== undefined) el.appendChild(h('div', { class: 'fc-chem c' + o.chem }, h('i'), h('i'), h('i')));
    if (o.onClick) { el.classList.add('tap'); el.setAttribute('role', 'button'); el.tabIndex = 0; el.addEventListener('click', o.onClick); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onClick(e); } }); }
    return el;
  }
  CUI.fc = fc;
  const chip = (text, cls) => h('span', { class: 'ci ' + (cls || ''), text });
  const coinChip = (S) => h('span', { class: 'ci coin', text: '🪙 ' + num(S.coins) });
  const rarName = (r) => T('k.rar.' + r);
  const packName = (id) => T('k.pack.' + id);
  const packArt = (id, n) => h('div', { class: 'pk pk-' + id }, h('b', { text: '⚽' }), h('span', { text: packName(id) }), n ? h('i', { class: 'pk-n', text: '×' + n }) : null);
  const redraw = () => { const sc = UI.screenEl.scrollTop; UI.show('cards', null, true); UI.screenEl.scrollTop = sc; };
  CUI.redraw = redraw;
  const oddsText = (id) => {
    const w = Cs.PACKS[id].w, tot = w.reduce((a, b) => a + b, 0);
    return w.map((x, i) => (x > 0 ? rarName(i) + ' ' + (x / tot * 100 < 1 ? '<1' : Math.round(x / tot * 100)) + '%' : null)).filter(Boolean).join(' · ');
  };
  const sfx = (n) => { try { FCK.Audio.play(n); } catch (e) { /* ignore */ } };
  const clubName = (c) => { const cl = Cs.clubOf(c); return cl ? cl.name : ''; };
  const leagueName = (c) => { const cl = Cs.clubOf(c); return cl ? (cl.lname || cl.league) + (cl.country && cl.country !== 'x' ? ' · ' + W.countryName(cl.country) : '') : ''; };

  // ------------------------------------------------------------------ screen frame
  FCK.Screens.cards = function () {
    const S = Cs.ensure();
    Cs.dayRoll(S);
    const el = h('div', { class: 'page hub cardsmode' });
    const ev = Cs.teamEval(S);
    const club = Cs.club(S, ev.S);
    const claims = Cs.openClaims(S);
    el.appendChild(h('header', { class: 'hub-head card' },
      UI.btn('‹', () => { save(); UI.stack = []; UI.show('home', null, true); }, 'ghost round'),
      UI.crestImg(club, 56),
      h('div', { class: 'hh-t' }, h('b', { class: 'big', text: club.name }), h('div', { class: 'muted', text: T('k.div', { n: S.rank.div }) + ' · ' + T('k.rating') + ' ' + ev.S.toFixed(1) + ' · ' + T('k.chem') + ' ' + ev.chem + '/33' })),
      h('div', { class: 'hh-r' }, coinChip(S))));
    const tabs = h('div', { class: 'chips tabs' });
    TABS.forEach((k) => {
      const b = h('button', { class: 'chip' + (ST.tab === k ? ' on' : ''), type: 'button' }, T('k.tab.' + k), k === 'tasks' && claims ? h('i', { class: 'dot', text: String(claims) }) : null);
      b.addEventListener('click', () => { UI.sfx('tick'); ST.tab = k; redraw(); });
      tabs.appendChild(b);
    });
    el.appendChild(tabs);
    const body = h('div', { class: 'cbody' });
    (CUI['tab_' + ST.tab] || CUI.tab_home)(body, S, ev);
    el.appendChild(body);
    el.appendChild(h('p', { class: 'fine center', text: T('k.note') }));
    return el;
  };

  // ------------------------------------------------------------------ HOME
  const newBar = (S) => (S.dirty ? h('button', { class: 'claimbar', type: 'button', onclick: () => { Cs.autoFill(S); save(); sfx('ok'); UI.toast(T('k.auto.done')); redraw(); } }, '✨ ' + T('k.newcards')) : null);
  CUI.tab_home = function (body, S, ev) {
    const R = S.rank;
    const opp = Cs.opponent(S);
    const claims = Cs.openClaims(S);
    const nb = newBar(S); if (nb) body.appendChild(nb);
    if (claims) body.appendChild(h('button', { class: 'claimbar', type: 'button', onclick: () => { ST.tab = 'tasks'; redraw(); } }, '🎁 ' + T('k.claims', { n: claims })));
    // league series
    const sec = UI.section(T('k.league') + ' · ' + T('k.div', { n: R.div }));
    const pips = h('div', { class: 'pips-r' });
    for (let i = 0; i < Cs.ROUND; i++) pips.appendChild(h('i', { class: 'rp ' + (R.res[i] || ''), text: R.res[i] ? T('k.res.' + R.res[i]).slice(0, 1) : (i + 1) }));
    sec.appendChild(h('div', { class: 'lg-top' }, pips, h('div', { class: 'lg-pts' }, h('b', { class: 'big', text: String(R.pts) }), h('small', { text: T('k.pts') }))));
    sec.appendChild(h('div', { class: 'lg-opp' }, UI.crestImg(opp, 48), h('div', null, h('small', { class: 'muted', text: T('k.next') }), h('b', { class: 'big', text: opp.name }), h('div', { class: 'muted', text: (W.byCc[opp.country] ? W.byCc[opp.country].flag + ' ' : '') + (opp.lname || opp.league) + ' · ' + T('k.rating') + ' ' + opp.rating }))));
    const playBtn = UI.btn('▶ ' + T('k.play'), () => { const e = Cs.play('ladder', opp); if (e) err(e); }, 'primary xl');
    sec.appendChild(h('div', { class: 'row' }, playBtn, UI.btn('⚽ ' + T('k.friendly'), () => FCK.clubPicker({ title: T('k.friendly'), current: null, onPick: (t) => { const e = Cs.play('friendly', t); if (e) err(e); } }), 'ghost')));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('k.level') }), UI.chips(FCK.LEVEL_KEYS.map((k) => ({ v: k, l: T('level.' + k) })), S.level, (v) => { S.level = v; save(); }, 'scroll')));
    sec.appendChild(h('p', { class: 'fine', text: T('k.promo.hint', { t: Cs.ROUND, p: Cs.PROMO_PTS, r: Cs.RELEG_PTS }) }));
    body.appendChild(sec);
    const grid = h('div', { class: 'grid2' });
    // team
    const tm = UI.section(T('k.tab.team'));
    tm.appendChild(h('div', { class: 'row tight' }, chip(T('k.rating') + ' ' + ev.S.toFixed(1)), chip(T('k.chem') + ' ' + ev.chem + '/33'), chip(S.form)));
    const strip = h('div', { class: 'fcstrip' });
    ev.slots.filter((s) => s.c).sort((a, b) => b.eff - a.eff).slice(0, 5).forEach((s) => strip.appendChild(fc(s.c, { sz: 's', eff: s.eff })));
    tm.appendChild(strip);
    tm.appendChild(UI.btn(T('k.tab.team'), () => { ST.tab = 'team'; redraw(); }, 'ghost'));
    grid.appendChild(tm);
    // gifts & packs
    const pk = UI.section(T('k.inv'));
    const today = Cs.today();
    if (S.gift !== today) pk.appendChild(h('div', { class: 'giftrow' }, h('div', null, h('b', { text: '🎁 ' + T('k.gift') }), h('small', { class: 'muted', text: T('k.gift.sub') })), UI.btn(T('k.gift.take'), () => { Cs.claimDaily(S); save(); UI.toast(T('k.gift.got')); sfx('ok'); redraw(); }, 'primary sm')));
    const have = Cs.PACK_KEYS.filter((k) => S.inv[k] > 0);
    if (!have.length) pk.appendChild(h('p', { class: 'fine', text: T('k.inv.none') }));
    have.forEach((k) => pk.appendChild(h('div', { class: 'invrow' }, packArt(k, S.inv[k]), UI.btn(T('k.open'), () => openPackFlow(k), 'primary sm'))));
    pk.appendChild(UI.btn(T('k.tab.shop'), () => { ST.tab = 'shop'; redraw(); }, 'ghost'));
    grid.appendChild(pk);
    body.appendChild(grid);
    // recent + stats
    const g2 = h('div', { class: 'grid2' });
    const rc = UI.section(T('k.last'));
    if (!S.hist.length) rc.appendChild(h('p', { class: 'fine', text: T('k.last.none') }));
    S.hist.slice(0, 6).forEach((x) => rc.appendChild(h('div', { class: 'hrow' }, h('i', { class: 'rp ' + x.r, text: x.r }), h('b', { text: x.a + ':' + x.b }), h('span', { class: 'muted', text: x.o }), h('small', { text: T('k.kind.' + x.k) }))));
    g2.appendChild(rc);
    const st = S.st;
    g2.appendChild(UI.section(T('k.stats'),
      infoRow(T('k.res.W') + ' / ' + T('k.res.D') + ' / ' + T('k.res.L'), st.won + ' / ' + st.drawn + ' / ' + st.lost),
      infoRow(T('k.goals'), st.gf + ' : ' + st.ga),
      infoRow(T('k.coll.count', { n: S.cards.length, v: num(S.cards.reduce((a, c) => a + Cs.value(c), 0)) }), ''),
      infoRow('📦', String(st.opened))));
    body.appendChild(g2);
  };
  function infoRow(l, v) { return h('div', { class: 'ir' }, h('span', { class: 'muted', text: l }), h('b', null, v)); }

  // ------------------------------------------------------------------ TEAM (lineup)
  function simPlace(S, where, i, id) {
    const f = { xi: S.xi.slice(), bench: S.bench.slice() };
    Cs.place(f, where, i, id);
    return f;
  }
  CUI.tab_team = function (body, S, ev) {
    const nb = newBar(S); if (nb) body.appendChild(nb);
    const top = UI.section(T('k.tab.team'));
    top.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('formation') }), UI.chips(FCK.FORMATION_NAMES, S.form, (v) => { Cs.setForm(S, v); save(); redraw(); })));
    top.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('style') }), UI.chips(FCK.STYLE_KEYS.map((k) => ({ v: k, l: T('style.' + k) })), S.style, (v) => { S.style = v; save(); })));
    top.appendChild(h('div', { class: 'row' },
      UI.btn('✨ ' + T('k.auto'), () => { Cs.autoFill(S); save(); sfx('ok'); redraw(); }, 'primary sm'),
      chip(T('k.rating') + ' ' + ev.S.toFixed(1)), chip(T('k.chem') + ' ' + ev.chem + '/33', ev.chem >= 24 ? 'eu' : '')));
    top.appendChild(h('p', { class: 'fine', text: T('k.chem.hint') }));
    body.appendChild(top);
    // pitch
    const form = FCK.FORMATIONS[S.form];
    const pitch = h('div', { class: 'pitch' });
    pitch.appendChild(h('div', { class: 'pl-mid' })); pitch.appendChild(h('div', { class: 'pl-box top' })); pitch.appendChild(h('div', { class: 'pl-box bot' }));
    form.forEach((sl, i) => {
      const s = ev.slots[i];
      const left = U.clamp(sl.fy, 0.09, 0.91) * 100, bottom = 5 + (sl.fx - 0.03) / 0.73 * 77;
      const wrap = h('div', { class: 'slot-w', style: { left: left + '%', bottom: bottom + '%' } });
      if (s.c) {
        wrap.appendChild(fc(s.c, { sz: 's', eff: s.eff, chem: s.chem, onClick: () => pickDialog(S, 'xi', i) }));
        if (s.cost) wrap.appendChild(h('small', { class: 'pen', text: T('k.pos.pen', { n: '−' + s.cost }) + ' (' + FCK.posL(sl.pos) + ')' }));
      } else {
        const b = h('button', { class: 'fc-empty', type: 'button', title: FCK.posL(sl.pos) }, h('b', { text: '+' }), h('small', { text: FCK.posL(sl.pos) }));
        b.addEventListener('click', () => pickDialog(S, 'xi', i)); wrap.appendChild(b);
      }
      pitch.appendChild(wrap);
    });
    body.appendChild(h('div', { class: 'pitch-w' }, pitch));
    // bench
    const bs = UI.section(T('k.bench'));
    const row = h('div', { class: 'fcstrip wrap' });
    S.bench.forEach((id, i) => {
      const c = id ? Cs.card(id) : null;
      if (c) row.appendChild(fc(c, { sz: 's', onClick: () => pickDialog(S, 'bench', i) }));
      else { const b = h('button', { class: 'fc-empty', type: 'button' }, h('b', { text: '+' })); b.addEventListener('click', () => pickDialog(S, 'bench', i)); row.appendChild(b); }
    });
    bs.appendChild(row);
    body.appendChild(bs);
  };

  function pickDialog(S, where, i) {
    const form = FCK.FORMATIONS[S.form];
    const slotPos = where === 'xi' ? form[i].pos : null;
    const cur = (where === 'xi' ? S.xi : S.bench)[i];
    const baseEv = Cs.teamEval(S);
    let q = '', onlyFit = where === 'xi';
    const list = h('div', { class: 'mlist pick-list' });
    const lockList = new Set(S.list.map((l) => l.id));
    const fill = () => {
      list.innerHTML = '';
      const rows = [];
      S.cards.forEach((c) => {
        if (lockList.has(c.id) || c.id === cur) return;
        if (q && !(c.n + ' ' + clubName(c) + ' ' + c.pos).toLowerCase().includes(q)) return;
        let d = 0, eff = c.o, cost = 0;
        if (where === 'xi') {
          cost = Cs.posCost(c.pos, slotPos);
          if (onlyFit && cost > 4) return;
          const f = simPlace(S, 'xi', i, c.id);
          const e2 = Cs.eval(S.form, f.xi);
          d = e2.sum - baseEv.sum; eff = e2.slots[i].eff;
        } else d = c.o;
        rows.push({ c, d, eff, cost });
      });
      rows.sort((a, b) => b.d - a.d || b.c.o - a.c.o);
      rows.slice(0, 80).forEach((r) => {
        const where2 = S.xi.includes(r.c.id) ? T('k.in.xi') : S.bench.includes(r.c.id) ? T('k.in.bench') : '';
        const row = h('div', { class: 'crow tap', role: 'button', tabIndex: 0 },
          fc(r.c, { sz: 's', eff: where === 'xi' ? r.eff : undefined }),
          h('div', { class: 'mr-n' }, h('b', { text: r.c.n }), h('small', { text: FCK.posL(r.c.pos) + ' · ' + clubName(r.c) + (where2 ? ' · ' + where2 : '') })),
          where === 'xi' ? h('b', { class: 'delta ' + (r.d > 0.5 ? 'up' : r.d < -0.5 ? 'dn' : ''), text: (r.d > 0 ? '+' : '') + r.d.toFixed(0) }) : h('b', { text: String(r.c.o) }));
        row.addEventListener('click', () => { Cs.place(S, where, i, r.c.id); Cs.fix(S); save(); sfx('ok'); UI.closeModal(); redraw(); });
        list.appendChild(row);
      });
      if (!rows.length) list.appendChild(h('p', { class: 'fine', text: '—' }));
    };
    const search = h('input', { type: 'search', class: 'txt', placeholder: T('k.search'), 'aria-label': T('k.search') });
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); fill(); });
    const acts = h('div', { class: 'row' });
    if (where === 'xi') acts.appendChild(UI.toggle(T('k.slot', { p: slotPos }), onlyFit, (v) => { onlyFit = v; fill(); }));
    if (cur) acts.appendChild(UI.btn(T('k.remove'), () => { (where === 'xi' ? S.xi : S.bench)[i] = 0; save(); UI.closeModal(); redraw(); }, 'ghost sm'));
    acts.appendChild(UI.btn(T('close'), () => UI.closeModal(), 'ghost sm'));
    fill();
    UI.modal(T('k.pick') + (slotPos ? ' · ' + slotPos : ''), h('div', { class: 'picker' }, cur ? h('div', { class: 'row' }, fc(Cs.card(cur), { sz: 's' }), h('b', { text: Cs.card(cur).n })) : null, search, acts, list));
  }

  // ------------------------------------------------------------------ COLLECTION
  function cardMatches(c, f) {
    if (f.role !== 'all' && ROLE[c.pos] !== f.role) return false;
    if (f.rar !== 'all' && c.r !== f.rar) return false;
    if (f.q && !(c.n + ' ' + clubName(c) + ' ' + c.pos).toLowerCase().includes(f.q)) return false;
    return true;
  }
  const SORTERS = {
    ovr: (a, b) => b.o - a.o || b.r - a.r, rar: (a, b) => b.r - a.r || b.o - a.o, new: (a, b) => b.id - a.id, val: (a, b) => Cs.value(b) - Cs.value(a), name: (a, b) => lastName(a.n).localeCompare(lastName(b.n)),
  };
  function filterBar(f, onChange, extra) {
    const wrap = h('div', { class: 'fbar' });
    wrap.appendChild(UI.chips([{ v: 'all', l: T('k.f.all') }].concat(ROLES.map((r) => ({ v: r, l: T('m.role.' + r) }))), f.role, (v) => { f.role = v; onChange(); }, 'scroll'));
    wrap.appendChild(UI.chips([{ v: 'all', l: T('k.f.all') }].concat([0, 1, 2, 3, 4].map((r) => ({ v: r, l: rarName(r) }))), f.rar, (v) => { f.rar = v; onChange(); }, 'scroll'));
    if (extra) wrap.appendChild(extra);
    return wrap;
  }
  CUI.tab_coll = function (body, S) {
    const f = ST.coll;
    const sec = UI.section(T('k.tab.coll'));
    sec.appendChild(h('p', { class: 'fine', text: T('k.coll.count', { n: S.cards.length, v: num(S.cards.reduce((a, c) => a + Cs.value(c), 0)) }) }));
    const grid = h('div', { class: 'cgrid' });
    const more = h('div', { class: 'row center' });
    const newIds = S.cards.filter((c) => c.nw).map((c) => c.id);
    const fill = () => {
      grid.innerHTML = ''; more.innerHTML = '';
      const list = S.cards.filter((c) => cardMatches(c, f)).sort(SORTERS[f.sort] || SORTERS.ovr);
      list.slice(0, f.limit).forEach((c) => {
        const el = fc(c, { sz: 'm', onClick: () => cardDialog(S, c) });
        const lock = S.xi.includes(c.id) ? 'xi' : S.bench.includes(c.id) ? 'bench' : S.list.some((l) => l.id === c.id) ? 'list' : '';
        if (lock) el.appendChild(h('i', { class: 'fc-lock', text: lock === 'xi' ? '⚽' : lock === 'bench' ? '🪑' : '🏷' }));
        grid.appendChild(el);
      });
      if (list.length > f.limit) more.appendChild(UI.btn('+ ' + (list.length - f.limit), () => { f.limit += 60; fill(); }, 'ghost'));
      if (!list.length) grid.appendChild(h('p', { class: 'fine', text: '—' }));
    };
    const sortSel = UI.select(Object.keys(SORTERS).map((k) => ({ v: k, l: T('k.sort.' + k) })), f.sort, (v) => { f.sort = v; fill(); }, 'sort');
    const search = h('input', { type: 'search', class: 'txt', placeholder: T('k.search'), 'aria-label': T('k.search'), value: f.q });
    search.addEventListener('input', () => { f.q = search.value.trim().toLowerCase(); f.limit = 60; fill(); });
    sec.appendChild(filterBar(f, () => { f.limit = 60; fill(); }, h('div', { class: 'row tight' }, sortSel, search)));
    sec.appendChild(grid); sec.appendChild(more);
    body.appendChild(sec);
    fill();
    newIds.forEach((id) => { const c = Cs.card(id); if (c) c.nw = 0; });
    if (newIds.length) save();
  };

  function cardDialog(S, c) {
    const wrap = h('div', { class: 'cd' });
    wrap.appendChild(h('div', { class: 'cd-card' }, fc(c, { sz: 'l' })));
    const cl = Cs.clubOf(c);
    const info = h('div', { class: 'cd-i' });
    info.appendChild(h('b', { class: 'big', text: c.n }));
    info.appendChild(infoRow(rarName(c.r) + (c.rare ? ' · ' + T('k.rare') : ''), FCK.posL(c.pos) + ' · ' + c.o));
    info.appendChild(infoRow(T('k.club'), h('span', null, cl ? UI.crestImg(cl, 18) : null, ' ' + clubName(c))));
    info.appendChild(infoRow(T('k.nation'), flag(c.nt) + ' ' + T('k.nt.' + c.nt)));
    info.appendChild(infoRow(T('k.lg'), leagueName(c)));
    info.appendChild(infoRow(T('k.age'), String(c.ag)));
    info.appendChild(infoRow(T('k.goals') + ' / ' + T('k.apps'), (c.gl || 0) + ' / ' + (c.ap || 0)));
    info.appendChild(infoRow(T('k.val'), '🪙 ' + num(Cs.value(c))));
    const where = S.xi.includes(c.id) ? T('k.in.xi') : S.bench.includes(c.id) ? T('k.in.bench') : S.list.some((l) => l.id === c.id) ? T('k.in.list') : '';
    if (where) info.appendChild(h('p', { class: 'fine', text: '⚽ ' + where }));
    wrap.appendChild(info);
    const acts = h('div', { class: 'row' });
    const locked = Cs.locked(S).has(c.id);
    if (!locked) {
      let armed = false;
      const qs = UI.btn(T('k.sell.quick', { c: num(Cs.sellValue(c)) }), () => {
        if (!armed) { armed = true; qs.textContent = T('k.sell.sure'); qs.classList.add('danger'); setTimeout(() => { armed = false; qs.classList.remove('danger'); qs.textContent = T('k.sell.quick', { c: num(Cs.sellValue(c)) }); }, 3000); return; }
        const r = Cs.quickSell(S, [c.id]); save(); UI.closeModal(); UI.toast(T('k.sold.n', { n: r.n, c: num(r.sum) })); redraw();
      }, 'ghost sm');
      acts.appendChild(qs);
      acts.appendChild(UI.btn(T('k.sell.list'), () => listDialog(S, c), 'ghost sm'));
    }
    acts.appendChild(UI.btn(T('close'), () => UI.closeModal(), 'primary sm'));
    wrap.appendChild(acts);
    UI.modal('', wrap);
  }
  function listDialog(S, c) {
    const v = Cs.value(c);
    let price = v;
    const out = h('p', { class: 'fine' });
    const upd = () => { out.textContent = T('k.list.chance', { p: Math.round(Cs.saleChance(price, v) * 100) }) + ' · ' + T('k.list.tax'); };
    const sl = UI.slider(T('k.price'), Math.max(5, Math.round(v * 0.5)), Math.round(v * 2.5), Math.max(5, Math.round(v / 40)), v, (x) => { price = Math.round(x); upd(); }, (x) => '🪙 ' + num(x));
    upd();
    UI.modal(c.n, h('div', null, fc(c, { sz: 'm' }), sl, out, h('div', { class: 'row' },
      UI.btn(T('k.list.go'), () => { const r = Cs.listCard(S, c.id, price); if (r !== 'ok') { err(r, { n: Cs.MAXLIST }); return; } save(); UI.closeModal(); UI.toast(T('k.listed')); ST.tab = 'market'; ST.mk.sub = 'mine'; redraw(); }, 'primary'),
      UI.btn(T('cancel'), () => UI.closeModal(), 'ghost'))));
  }

  // ------------------------------------------------------------------ SHOP + pack opening
  CUI.tab_shop = function (body, S) {
    const inv = UI.section(T('k.inv'));
    const have = Cs.PACK_KEYS.filter((k) => S.inv[k] > 0);
    if (S.gift !== Cs.today()) inv.appendChild(h('div', { class: 'giftrow' }, h('div', null, h('b', { text: '🎁 ' + T('k.gift') }), h('small', { class: 'muted', text: T('k.gift.sub') })), UI.btn(T('k.gift.take'), () => { Cs.claimDaily(S); save(); UI.toast(T('k.gift.got')); sfx('ok'); redraw(); }, 'primary sm')));
    if (!have.length) inv.appendChild(h('p', { class: 'fine', text: T('k.inv.none') }));
    have.forEach((k) => inv.appendChild(h('div', { class: 'invrow' }, packArt(k, S.inv[k]), UI.btn(T('k.open'), () => openPackFlow(k), 'primary sm'))));
    body.appendChild(inv);
    const sh = UI.section(T('k.tab.shop'));
    sh.appendChild(h('p', { class: 'fine', text: T('k.shop.hint') }));
    const grid = h('div', { class: 'packs' });
    Cs.PACK_KEYS.forEach((k) => {
      const P = Cs.PACKS[k];
      grid.appendChild(h('div', { class: 'pack card' }, packArt(k), h('div', { class: 'pk-i' }, h('b', { text: packName(k) }), h('small', { text: T('k.pack.' + k + '.d') + ' · ' + T('k.cards.n', { n: P.n }) }), h('small', { class: 'odds', text: T('k.odds') + ': ' + oddsText(k) })),
        h('div', { class: 'pk-b' }, h('b', { class: 'price' + (S.coins < P.price ? ' short' : ''), text: '🪙 ' + num(P.price) }),
          UI.btn(T('k.buy'), () => { const r = Cs.buyPack(S, k); if (r !== 'ok') { err(r); return; } save(); UI.toast(T('k.bought', { p: packName(k) })); sfx('ok'); redraw(); }, 'ghost sm'),
          UI.btn(T('k.buyopen'), () => { const r = Cs.buyPack(S, k); if (r !== 'ok') { err(r); return; } save(); openPackFlow(k); }, 'primary sm'))));
    });
    sh.appendChild(grid);
    body.appendChild(sh);
  };

  function openPackFlow(id) {
    const S = Cs.S;
    const cards = Cs.openPack(S, id);
    if (cards === 'full') { err('full'); return; }
    if (!Array.isArray(cards)) { err('bad'); return; }
    save();
    cards.sort((a, b) => a.o - b.o);
    sfx('whistle');
    const wrap = h('div', { class: 'opener' });
    const row = h('div', { class: 'op-row' });
    let revealed = 0;
    const info = h('p', { class: 'fine center', text: T('k.open.tap') });
    const foot = h('div', { class: 'row center' });
    const cells = cards.map((c) => {
      const cell = h('button', { class: 'op-cell', type: 'button', 'aria-label': T('k.open') },
        h('div', { class: 'op-in' }, h('div', { class: 'op-back pk-' + id }, h('b', { text: '⚽' })), h('div', { class: 'op-front' }, fc(c, { sz: 'm', cls: 'op-fc' }))));
      const flip = () => {
        if (cell.classList.contains('flipped')) return;
        cell.classList.add('flipped'); revealed++;
        sfx(c.r >= 3 ? 'goal' : c.r === 2 ? 'ok' : 'tick');
        if (c.r >= 2) cell.classList.add('glow' + c.r);
        if (revealed === cards.length) done();
      };
      cell.addEventListener('click', flip); cell._flip = flip;
      row.appendChild(cell);
      return cell;
    });
    const done = () => {
      info.textContent = T('k.open.best') + ': ' + cards[cards.length - 1].n + ' (' + cards[cards.length - 1].o + ')';
      foot.innerHTML = '';
      const left = S.inv[id] || 0;
      if (left > 0) foot.appendChild(UI.btn(T('k.open.again', { n: left }), () => { UI.closeModal(); openPackFlow(id); }, 'primary'));
      const lock = Cs.locked(S);
      const brz = cards.filter((c) => c.r === 0 && !lock.has(c.id));
      if (brz.length) foot.appendChild(UI.btn(T('k.open.sellbronze', { c: num(brz.reduce((a, c) => a + Cs.sellValue(c), 0)) }), () => { const r = Cs.quickSell(S, brz.map((c) => c.id)); save(); UI.toast(T('k.sold.n', { n: r.n, c: num(r.sum) })); UI.closeModal(); redraw(); }, 'ghost'));
      foot.appendChild(UI.btn(T('k.open.done'), () => { UI.closeModal(); redraw(); }, left > 0 ? 'ghost' : 'primary'));
    };
    wrap.appendChild(info); wrap.appendChild(row);
    foot.appendChild(UI.btn(T('k.open.all'), () => { cells.forEach((c, i) => setTimeout(() => c._flip(), i * 180)); }, 'ghost'));
    wrap.appendChild(foot);
    UI.modal(packName(id), wrap, { sticky: true, cls: 'packfx' });
  }
  CUI.openPackFlow = openPackFlow;

  // ------------------------------------------------------------------ MARKET
  CUI.tab_market = function (body, S) {
    const f = ST.mk;
    body.appendChild(h('div', { class: 'chips' }, ...['offers', 'mine'].map((k) => {
      const b = h('button', { class: 'chip' + (f.sub === k ? ' on' : ''), type: 'button' }, T(k === 'offers' ? 'k.mk.offers' : 'k.mk.mine') + (k === 'mine' && S.list.length ? ' (' + S.list.length + ')' : ''));
      b.addEventListener('click', () => { f.sub = k; redraw(); }); return b;
    })));
    if (f.sub === 'mine') return marketMine(body, S);
    const sec = UI.section(T('k.mk.title'));
    sec.appendChild(h('p', { class: 'fine', text: T('k.mk.hint') }));
    const list = h('div', { class: 'mlist' });
    const fill = () => {
      list.innerHTML = '';
      const items = Cs.stock(S).filter((it) => (f.role === 'all' || ROLE[it.c.pos] === f.role) && (f.rar === 'all' || it.c.r === f.rar));
      items.sort(f.sort === 'ovr' ? (a, b) => b.c.o - a.c.o : (a, b) => a.price - b.price);
      items.forEach((it) => {
        const sold = S.mk.sold[it.key];
        const cl = Cs.clubOf(it.c);
        const row = h('div', { class: 'crow' + (sold ? ' sold' : '') },
          fc(it.c, { sz: 's' }),
          h('div', { class: 'mr-n' }, h('b', { text: it.c.n }), h('small', null, cl ? UI.crestImg(cl, 14) : null, ' ' + FCK.posL(it.c.pos) + ' · ' + flag(it.c.nt) + ' ' + clubName(it.c))),
          h('b', { class: 'price' + (S.coins < it.price ? ' short' : ''), text: '🪙 ' + num(it.price) }),
          sold ? h('span', { class: 'ci', text: T('k.mk.sold') }) : UI.btn(T('k.buy'), () => {
            const r = Cs.buyItem(S, it);
            if (typeof r === 'string') { err(r); return; }
            save(); sfx('ok'); UI.toast(T('k.mk.bought', { n: r.n })); redraw();
          }, 'primary sm'));
        row.firstChild.addEventListener('click', () => cardDialogView(it.c));
        list.appendChild(row);
      });
    };
    sec.appendChild(filterBar(f, fill, UI.chips([{ v: 'price', l: T('k.price') }, { v: 'ovr', l: T('k.sort.ovr') }], f.sort, (v) => { f.sort = v; fill(); })));
    sec.appendChild(list);
    body.appendChild(sec);
    fill();
  };
  function cardDialogView(c) {
    UI.modal('', h('div', { class: 'cd' }, h('div', { class: 'cd-card' }, fc(c, { sz: 'l' })), h('div', { class: 'cd-i' }, h('b', { class: 'big', text: c.n }),
      infoRow(T('k.club'), clubName(c)), infoRow(T('k.nation'), flag(c.nt) + ' ' + T('k.nt.' + c.nt)), infoRow(T('k.lg'), leagueName(c)), infoRow(T('k.age'), String(c.ag)), infoRow(T('k.val'), '🪙 ' + num(Cs.value(c)))),
      h('div', { class: 'row' }, UI.btn(T('close'), () => UI.closeModal(), 'primary sm'))));
  }
  function marketMine(body, S) {
    const sec = UI.section(T('k.mk.mine'));
    if (!S.list.length) sec.appendChild(h('p', { class: 'fine', text: T('k.mk.none') }));
    S.list.forEach((l) => {
      const c = Cs.card(l.id); if (!c) return;
      sec.appendChild(h('div', { class: 'crow' }, fc(c, { sz: 's' }),
        h('div', { class: 'mr-n' }, h('b', { text: c.n }), h('small', { text: FCK.posL(c.pos) + ' · ' + T('k.mk.age', { n: l.age }) + ' · ' + T('k.list.chance', { p: Math.round(Cs.saleChance(l.price, Cs.value(c)) * 100) }) })),
        h('b', { class: 'price', text: '🪙 ' + num(l.price) }),
        UI.btn(T('k.mk.cancel'), () => { Cs.unlist(S, l.id); save(); redraw(); }, 'ghost sm')));
    });
    body.appendChild(sec);
    if (S.news.length) {
      const nw = UI.section(T('k.mk.title'));
      S.news.slice(0, 8).forEach((n) => nw.appendChild(h('div', { class: 'hrow' }, h('span', { text: '🪙' }), h('span', { text: T('k.mk.news', { n: n.n, g: num(n.g) }) }))));
      body.appendChild(nw);
    }
  }

  // ------------------------------------------------------------------ TASKS
  CUI.tab_tasks = function (body, S) {
    const sec = UI.section(T('k.task.title'));
    const tasks = Cs.dayTasks(S);
    tasks.forEach((t) => {
      sec.appendChild(h('div', { class: 'task' + (t.done ? ' done' : '') },
        h('div', { class: 'tk-t' }, h('b', { text: T('k.task.' + t.id, { n: t.need }) }), h('div', { class: 'bar' }, h('i', { style: { width: (t.have / t.need * 100) + '%' } }), h('span', { text: t.have + '/' + t.need }))),
        h('span', { class: 'ci coin', text: '🪙 ' + num(t.coins) }),
        t.claimed ? h('span', { class: 'ci', text: '✓ ' + T('k.claimed') }) : UI.btn(T('k.claim'), () => { const r = Cs.claimTask(S, t.id); if (r) { save(); sfx('ok'); UI.toast(T('k.reward.coins', { n: num(r.coins) }) + (r.bonus ? ' + ' + packName(r.bonus) : '')); redraw(); } }, 'primary sm', { disabled: !t.done })));
    });
    sec.appendChild(h('p', { class: 'fine', text: T('k.task.all') }));
    body.appendChild(sec);
    const ac = UI.section(T('k.ach.title'));
    Cs.achList(S).sort((a, b) => (b.done && !b.claimed) - (a.done && !a.claimed) || a.claimed - b.claimed).forEach((a) => {
      ac.appendChild(h('div', { class: 'task' + (a.done ? ' done' : '') },
        h('div', { class: 'tk-t' }, h('b', { text: T('k.ach.' + a.id) }), h('div', { class: 'bar' }, h('i', { style: { width: (a.have / a.need * 100) + '%' } }), h('span', { text: a.have + '/' + a.need }))),
        h('span', { class: 'ci coin', text: a.pack ? '📦 ' + packName(a.pack) : '🪙 ' + num(a.coins) }),
        a.claimed ? h('span', { class: 'ci', text: '✓ ' + T('k.claimed') }) : UI.btn(T('k.claim'), () => { const r = Cs.claimAch(S, a.id); if (r) { save(); sfx('ok'); UI.toast(r.pack ? packName(r.pack) : T('k.reward.coins', { n: num(r.coins) })); redraw(); } }, 'primary sm', { disabled: !a.done })));
    });
    body.appendChild(ac);
  };

  // ------------------------------------------------------------------ SWAPS (squad building challenges)
  const rewardText = (rw) => (rw.pack ? '📦 ' + packName(rw.pack) : '🪙 ' + T('k.reward.coins', { n: num(rw.coins) }));
  CUI.tab_sbc = function (body, S) {
    const sec = UI.section(T('k.sbc.title'));
    sec.appendChild(h('p', { class: 'fine', text: T('k.sbc.hint') }));
    const defs = [Cs.SBC_DAILY].concat(Cs.SBC);
    defs.forEach((d) => {
      const avail = Cs.sbcAvailable(S, d);
      sec.appendChild(h('div', { class: 'task sbc' + (avail ? '' : ' done') },
        h('div', { class: 'tk-t' }, h('b', { text: d.daily ? T('k.sbc.daily') : T('k.sbc.' + d.id) }), h('small', { class: 'muted', text: T('k.sbc.' + d.id + '.d') })),
        h('span', { class: 'ci coin', text: rewardText(d.reward) }),
        avail ? UI.btn(T('k.sbc.open'), () => sbcDialog(S, d), 'primary sm') : h('span', { class: 'ci', text: '✓ ' + T('k.sbc.done') })));
    });
    body.appendChild(sec);
  };
  function sbcDialog(S, def) {
    const sel = new Set();
    const f = { role: 'all', rar: 'all', sort: 'asc', q: '' };
    const lock = Cs.locked(S);
    const checks = h('div', { class: 'chk' });
    const list = h('div', { class: 'mlist pick-list' });
    const submit = UI.btn(T('k.sbc.submit'), () => {
      const r = Cs.sbcSubmit(S, def, [...sel]);
      if (r !== 'ok') { err(r === 'done' ? 'done' : r === 'locked' ? 'locked' : 'req'); return; }
      save(); sfx('goal'); UI.closeModal(); UI.toast(T('k.sbc.ok') + ' ' + rewardText(def.reward)); redraw();
    }, 'primary');
    const lab = (c) => {
      const v = c.v !== undefined ? (c.k === 'posN' ? c.v : rarName(c.v)) : '';
      return T('k.chk.' + c.k, { have: c.have, need: c.need, v });
    };
    const upd = () => {
      const cs = [...sel].map((i) => Cs.card(i));
      const ch = Cs.sbcChecks(def, cs);
      checks.innerHTML = '';
      ch.forEach((c) => checks.appendChild(h('div', { class: 'ck ' + (c.ok ? 'ok' : 'no') }, h('i', { text: c.ok ? '✓' : '•' }), h('span', { text: lab(c) }))));
      submit.disabled = !ch.every((c) => c.ok);
    };
    const fill = () => {
      list.innerHTML = '';
      let rows = S.cards.filter((c) => !lock.has(c.id) && cardMatches(c, f));
      const key = { asc: (a, b) => a.o - b.o, desc: (a, b) => b.o - a.o, nat: (a, b) => a.nt.localeCompare(b.nt) || b.o - a.o, club: (a, b) => clubName(a).localeCompare(clubName(b)), lg: (a, b) => leagueName(a).localeCompare(leagueName(b)) || b.o - a.o }[f.sort];
      rows.sort(key);
      rows.slice(0, 120).forEach((c) => {
        const row = h('div', { class: 'crow tap' + (sel.has(c.id) ? ' on' : ''), role: 'checkbox', tabIndex: 0, 'aria-checked': sel.has(c.id) ? 'true' : 'false' },
          fc(c, { sz: 's' }), h('div', { class: 'mr-n' }, h('b', { text: c.n }), h('small', { text: FCK.posL(c.pos) + ' · ' + flag(c.nt) + ' ' + clubName(c) + ' · ' + leagueName(c) })), h('b', { text: sel.has(c.id) ? '✓' : String(c.o) }));
        const tog = () => { if (sel.has(c.id)) sel.delete(c.id); else if (sel.size < def.n) sel.add(c.id); upd(); fill(); };
        row.addEventListener('click', tog); row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
        list.appendChild(row);
      });
    };
    const sortBar = filterBar(f, fill, UI.chips([{ v: 'asc', l: T('k.sort.ovr') + ' ↑' }, { v: 'desc', l: T('k.sort.ovr') + ' ↓' }, { v: 'nat', l: T('k.nation') }, { v: 'club', l: T('k.club') }, { v: 'lg', l: T('k.lg') }], f.sort, (v) => { f.sort = v; fill(); }, 'scroll'));
    upd(); fill();
    UI.modal(def.daily ? T('k.sbc.daily') : T('k.sbc.' + def.id), h('div', { class: 'picker' }, h('p', { class: 'fine', text: T('k.sbc.' + def.id + '.d') + ' ' + rewardText(def.reward) }), checks, sortBar, list, h('div', { class: 'row' }, submit, UI.btn(T('cancel'), () => UI.closeModal(), 'ghost'))));
  }

  // ------------------------------------------------------------------ CLUB
  CUI.tab_club = function (body, S, ev) {
    const t = S.team;
    const prev = h('div', { class: 'club-prev' });
    const drawPrev = () => { prev.innerHTML = ''; const cl = Cs.club(S, ev.S); prev.appendChild(UI.crestImg(cl, 84)); const kit = h('img', { class: 'kit', alt: '', width: 64, height: 64 }); kit.src = FCK.kitDataUrl(FCK.makeKits(cl, W.clubs[0])[0], 128); prev.appendChild(kit); };
    drawPrev();
    const sec = UI.section(T('k.club.title'), prev);
    const nameIn = h('input', { type: 'text', class: 'txt', maxlength: 18, value: t.name, 'aria-label': T('k.club.name') });
    nameIn.addEventListener('input', () => { t.name = nameIn.value.slice(0, 18) || 'FCK Allstars'; save(); drawPrev(); });
    sec.appendChild(h('label', { class: 'field' }, h('span', { class: 'lbl', text: T('k.club.name') }), nameIn));
    const sw = h('div', { class: 'swatches' });
    Cs.PALETTES.forEach((p, i) => {
      const b = h('button', { class: 'swatch' + (t.pal === i ? ' on' : ''), type: 'button', style: { background: 'linear-gradient(135deg,' + p[0] + ' 55%,' + p[1] + ' 55%)' }, 'aria-label': String(i + 1) });
      b.addEventListener('click', () => { t.pal = i; save(); sw.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); b.classList.add('on'); drawPrev(); });
      sw.appendChild(b);
    });
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('k.club.colors') }), sw));
    const pick = (key, label, opts) => sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: label }), UI.chips(opts, t[key], (v) => { t[key] = v; save(); drawPrev(); }, 'scroll')));
    pick('kit', T('k.club.kit'), Cs.KITS); pick('shape', T('k.club.shape'), Cs.SHAPES); pick('pattern', T('k.club.pattern'), Cs.PATTERNS); pick('emblem', T('k.club.emblem'), Cs.EMBLEMS);
    body.appendChild(sec);
    const set = UI.section(T('k.club.settings'));
    set.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('k.level') }), UI.chips(FCK.LEVEL_KEYS.map((k) => ({ v: k, l: T('level.' + k) })), S.level, (v) => { S.level = v; save(); }, 'scroll')));
    set.appendChild(UI.slider(T('k.half'), 1, 10, 1, S.half, (v) => { S.half = v; save(); }, (v) => v + ' min'));
    set.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('k.players') }), UI.chips(['p1', 'p2co', 'cpu'].map((k) => ({ v: k, l: T('k.pre.' + k) })), S.preset, (v) => { S.preset = v; save(); })));
    set.appendChild(FCK.PadNav.controlLine(() => S.preset));
    body.appendChild(set);
    const dat = UI.section(T('k.data'));
    let armed = false;
    const reset = UI.btn(T('k.reset'), () => {
      if (!armed) { armed = true; reset.textContent = T('k.reset.sure'); reset.classList.add('danger'); setTimeout(() => { armed = false; reset.textContent = T('k.reset'); reset.classList.remove('danger'); }, 3500); return; }
      Cs.reset(); faces.clear(); ST.tab = 'home'; redraw();
    }, 'ghost');
    dat.appendChild(h('div', { class: 'row' }, UI.btn(T('k.export'), exportDialog, 'ghost'), UI.btn(T('k.import'), importDialog, 'ghost'), reset));
    dat.appendChild(h('p', { class: 'fine', text: T('k.reset.hint') }));
    body.appendChild(dat);
  };
  function exportDialog() {
    const txt = Cs.exportText();
    const ta = h('textarea', { class: 'code', readonly: true, rows: 6 }); ta.value = txt;
    UI.modal(T('k.export'), h('div', null, h('p', { class: 'fine', text: T('k.export.hint') }), ta,
      h('div', { class: 'row' }, UI.btn(T('copy'), () => { ta.select(); try { navigator.clipboard.writeText(txt).then(() => UI.toast(T('copied'))).catch(() => { document.execCommand && document.execCommand('copy'); }); } catch (e) { /* ignore */ } }, 'primary'), UI.btn(T('close'), () => UI.closeModal(), 'ghost'))));
    setTimeout(() => ta.select(), 50);
  }
  function importDialog() {
    const ta = h('textarea', { class: 'code', rows: 6, placeholder: 'FCKC1:…' });
    UI.modal(T('k.import'), h('div', null, h('p', { class: 'fine', text: T('k.import.hint') }), ta,
      h('div', { class: 'row' }, UI.btn(T('ok'), () => { if (Cs.importText(ta.value)) { faces.clear(); UI.closeModal(); UI.toast(T('k.import.ok')); redraw(); } else UI.toast(T('k.import.bad')); }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost'))));
  }

  // ------------------------------------------------------------------ result box inside the match result screen
  CUI.resultBox = function (m) {
    const S = Cs.S, info = S && S.last;
    if (!info) return null;
    const box = h('section', { class: 'card sect cres' }, h('h3', { text: T('k.res.title') + ' · ' + T('k.kind.' + info.kind) }));
    box.appendChild(h('div', { class: 'row' }, h('b', { class: 'big', text: T('k.res.' + info.res) }), h('span', { class: 'ci coin', text: '🪙 ' + T('k.res.coins', { n: num(info.coins) }) })));
    if (info.kind === 'ladder') {
      const R = S.rank;
      if (info.round) {
        const r = info.round;
        box.appendChild(h('div', { class: 'round-box ' + r.outcome }, h('b', { text: T('k.res.round') }), h('div', null, T('k.res.pts', { n: r.pts, t: Cs.ROUND }) + ' · ' + r.res.map((x) => T('k.res.' + x).slice(0, 1)).join(' ')),
          h('b', { text: T(r.outcome === 'up' ? 'k.res.up' : r.outcome === 'champ' ? 'k.res.champ' : r.outcome === 'down' ? 'k.res.down' : 'k.res.stay', { n: r.to }) }),
          h('div', null, '🪙 ' + T('k.res.coins', { n: num(r.coins) }) + (r.pack ? ' · 📦 ' + T('k.res.pack', { p: packName(r.pack) }) : ''))));
      } else box.appendChild(h('p', { class: 'fine', text: T('k.res.rest', { n: Cs.ROUND - R.m }) + ' · ' + T('k.pts') + ' ' + R.pts }));
    }
    if (info.sold && info.sold.length) box.appendChild(h('p', { class: 'ok', text: '🏷 ' + T('k.res.sold', { n: info.sold.length, c: num(info.sold.reduce((a, s) => a + Math.floor(s.gain || 0), 0)) }) }));
    return box;
  };
})((globalThis.FCK = globalThis.FCK || {}));
