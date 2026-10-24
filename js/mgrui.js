/* FCK - mgrui.js : manager mode screens (squad, transfers, youth, club) and dialogs */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const W = FCK.World;
  const C = FCK.Career;
  const M = FCK.Mgr;
  const T = (k, v) => FCK.T(k, v);
  const lang = () => (FCK.settings && FCK.settings.lang) || 'de';
  const cname = (cc) => W.countryName(cc);
  const flagOf = (cc) => (W.byCc[cc] ? W.byCc[cc].flag : '');
  const crest = (i, s) => UI.crestImg(typeof i === 'number' ? W.clubs[i] : i, s || 20);
  const money = (k, o) => M.money(k, o);
  const refresh = () => { UI.closeModal(); UI.show('career', null, true); };
  const save = () => C.autosave();
  const MgrUI = {};
  FCK.MgrUI = MgrUI;
  const ROLES = ['GK', 'DF', 'MF', 'FW'];

  // ---------- small widgets ----------
  const bar = (v, cls, label) => h('div', { class: 'bar ' + (cls || '') }, h('i', { style: { width: U.clamp(v, 0, 100) + '%' } }), label ? h('span', { text: label }) : null);
  const moDot = (mo) => h('i', { class: 'mo ' + (mo >= 72 ? 'hi' : mo >= 45 ? 'mid' : 'lo'), title: Math.round(mo) + '' });
  const pip = (n, max) => h('span', { class: 'pips' }, Array.from({ length: max || 5 }, (_, i) => h('i', { class: i < n ? 'on' : '' })));
  const natFlag = (nt) => FCK.groupFlag(nt);
  const err = (code) => UI.toast(T('m.err.' + code));
  const ptxt = (c, rec) => ({ ovr: Math.round(rec.o) });
  const ovrCls = (o) => (o >= 80 ? 'o-a' : o >= 68 ? 'o-b' : o >= 55 ? 'o-c' : 'o-d');
  const ovrBadge = (o, txt) => h('b', { class: 'ob ' + ovrCls(o), text: txt === undefined ? Math.round(o) : txt });
  const contractTxt = (c, rec) => { const y = rec.ct; return (y <= c.sim.year ? '⚠ ' : '') + y + '/' + String((y + 1) % 100).padStart(2, '0'); };
  const winTxt = (c) => { const w = M.window(c); return w ? T('m.win.open', { w: T('m.win.' + w) }) : T('m.win.closed'); };
  const fixedMoney = (k) => money(k);

  function infoRow(label, val) { return h('div', { class: 'ir' }, h('span', { class: 'muted', text: label }), h('b', null, val)); }

  // =============================== header chips / alerts ===============================
  MgrUI.headChips = function (c) {
    if (!c.m) return [];
    const m = c.m;
    return [h('span', { class: 'ci' + (m.cash < 0 ? ' bad' : ''), text: '💰 ' + money(m.cash) })];
  };
  MgrUI.alerts = function (c) {
    const m = c.m; if (!m) return;
    if (m.sacked && !m.easy && !MgrUI._sackShown) { MgrUI._sackShown = true; sackedDialog(c, null); }
    if (m.warnFlag) { m.warnFlag = false; UI.toast(T('m.warn.board'), 4200); }
  };

  // =============================== SQUAD TAB ===============================
  let sqSort = 'pos';
  MgrUI.tabSquad = function (body, c) {
    const m = c.m;
    const sect = UI.section(T('squad.tactics'));
    sect.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('formation') }), UI.chips(FCK.FORMATION_NAMES, c.formation, (v) => { c.formation = v; m.xi = null; save(); refresh(); })));
    sect.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('style') }), UI.chips(FCK.STYLE_KEYS.map((k) => ({ v: k, l: T('style.' + k) })), c.style, (v) => { c.style = v; save(); })));
    sect.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.training') }), UI.chips(['low', 'normal', 'high'].map((k) => ({ v: k, l: T('m.tr.' + k) })), m.tr, (v) => { m.tr = v; save(); }), h('small', { class: 'fine', text: T('m.tr.hint') })));
    sect.appendChild(h('div', { class: 'row' }, UI.btn(T('m.lineup'), () => lineupDialog(c), 'primary sm'), m.xi ? h('span', { class: 'ci eu', text: T('m.lineup.manual') }) : h('span', { class: 'ci', text: T('m.lineup.auto') })));
    body.appendChild(sect);
    const sq = M.squad(c);
    const pk = M.pick(c, c.formation);
    const st = new Set(pk.lineup.map((p) => p.sqi)), bn = new Set(pk.bench.map((p) => p.sqi));
    const bill = M.bill(c);
    const head = h('div', { class: 'row tight' },
      h('span', { class: 'ci', text: T('m.strength') + ' ' + c.m.S }), h('span', { class: 'ci', text: T('m.size', { n: sq.length }) }),
      h('span', { class: 'ci' + (bill > m.wb ? ' bad' : ''), text: T('m.wages') + ' ' + money(bill) + ' / ' + money(m.wb) }), h('span', { class: 'ci', text: '☺ ' + Math.round(m.mood) }));
    const tbl = h('table', { class: 'ptable sq mg' });
    const order = { GK: 0, DF: 1, MF: 2, FW: 3 };
    const TH = (t, cls, key) => h('th', { class: cls || '', text: t, onclick: key ? () => { sqSort = key; refresh(); } : null, style: key ? { cursor: 'pointer' } : null });
    tbl.appendChild(h('thead', null, h('tr', null, TH('#'), TH(T('res.player'), '', 'pos'), TH(T('c.pos.s'), '', 'pos'), TH(T('m.age'), 'hs', 'age'), TH(T('sq.ovr'), '', 'ovr'), TH('☺', 'hs'), TH(T('m.contract'), 'hs', 'ct'), TH(T('m.wage'), 'hs', 'w'), TH(T('sq.goals'), 'hs'))));
    const tb = h('tbody');
    const sorters = { pos: (a, b) => order[FCK.ROLE_OF[a.pos]] - order[FCK.ROLE_OF[b.pos]] || b.o - a.o, ovr: (a, b) => b.o - a.o, age: (a, b) => a.ag - b.ag, ct: (a, b) => a.ct - b.ct || b.o - a.o, w: (a, b) => b.w - a.w };
    const goals = c.sim.sc[c.idx] || {};
    m.players.slice().sort(sorters[sqSort] || sorters.pos).forEach((p) => {
      const tr = h('tr', { class: (p.ln ? 'ln' : st.has(p.id) ? 'st' : bn.has(p.id) ? 'bn' : '') + (p.inj ? ' hurt' : ''), onclick: () => playerDialog(c, p) },
        h('td', { text: p.nu }),
        h('td', null, h('b', { text: p.n }), p.inj ? h('span', { class: 'inj', title: T('m.inj', { n: p.inj }), text: ' 🤕' + p.inj }) : null, p.ln ? h('small', { text: ' ↗ ' + T('m.loan') }) : null, p.tr ? h('small', { class: 'tl', text: ' 🏷' }) : null),
        h('td', { text: FCK.posL(p.pos) }), h('td', { class: 'hs', text: p.ag }), h('td', { class: 'ovr' }, ovrBadge(p.o), p.ag <= 23 && p.pt > p.o + 2 ? h('small', { class: 'pt', text: '↗' + p.pt }) : null),
        h('td', { class: 'hs' }, moDot(p.mo)), h('td', { class: 'hs', text: contractTxt(c, p) }), h('td', { class: 'hs', text: money(p.w) }), h('td', { class: 'hs', text: (goals[p.id] || 0) + ' · ' + (p.ap || 0) }));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    body.appendChild(UI.section(T('tab.squad') + ' · ' + T('squad.count', { n: sq.length }), head, h('div', { class: 'scrollx' }, tbl), h('p', { class: 'fine', text: T('m.squad.note') })));
  };

  // ---------- player dialog (own players) ----------
  function playerDialog(c, p) {
    const m = c.m, sim = c.sim;
    const gp = M.toPlayer(c, p, 0);
    const wrap = h('div', { class: 'pd' });
    wrap.appendChild(h('div', { class: 'cm-head' }, h('div', { class: 'num', text: p.nu }), h('div', null, h('b', { class: 'big', text: p.n }), h('div', { class: 'muted', text: natFlag(p.nt) + ' ' + FCK.posL(p.pos) + ' · ' + T('m.years', { n: p.ag }) + (p.home ? ' · ' + T('m.homegrown') : '') })), ovrBadge(p.o)));
    const attrs = h('div', { class: 'attrs' });
    [['pac', gp.a.pac], ['sho', gp.a.sho], ['pas', gp.a.pas], ['dri', gp.a.dri], ['def', gp.a.def], ['phy', gp.a.phy]].forEach((a) => attrs.appendChild(h('div', { class: 'at' }, h('span', { text: T('m.a.' + a[0]) }), bar(a[1], ovrCls(a[1])), h('b', { text: a[1] }))));
    wrap.appendChild(attrs);
    const val = M.recValue(p);
    wrap.appendChild(h('div', { class: 'grid2 tight' },
      h('div', null, infoRow(T('m.value'), money(val)), infoRow(T('m.wage'), money(p.w) + '/' + T('m.yr')), infoRow(T('m.contract'), contractTxt(c, p)), infoRow(T('m.pot'), UI.stars(p.pt))),
      h('div', null, infoRow(T('m.mood'), h('span', null, moDot(p.mo), ' ', T('m.mood.' + (p.mo >= 72 ? 'hi' : p.mo >= 45 ? 'mid' : 'lo')))), infoRow(T('sq.goals'), String((c.sim.sc[c.idx] || {})[p.id] || 0)), infoRow(T('m.apps'), String(p.ap || 0)), p.inj ? infoRow(T('m.injury'), T('m.inj', { n: p.inj })) : null)));
    const win = M.window(c);
    const acts = h('div', { class: 'row' },
      UI.btn(T('m.renew'), () => renewDialog(c, p, () => playerDialog(c, p)), 'primary sm'),
      UI.btn(p.tr ? T('m.unlist') : T('m.list'), () => { M.toggleList(c, p); save(); playerDialog(c, p); }, 'ghost sm'),
      UI.btn(T('m.loanout'), () => { const r = M.loanOut(c, p); if (r !== 'ok') err(r); else { save(); refresh(); } }, 'ghost sm'),
      UI.btn(T('m.releasebtn'), () => confirmRelease(c, p), 'ghost sm bad'),
      UI.btn(T('close'), () => UI.closeModal(), 'ghost sm'));
    wrap.appendChild(acts);
    if (p.ln) wrap.appendChild(h('p', { class: 'fine', text: T('m.onloan') }));
    UI.modal(p.n, wrap, { cls: 'wide' });
  }
  function confirmRelease(c, p) {
    const left = Math.max(0, p.ct - c.sim.year + 1), cost = Math.round(p.w * left * 0.5);
    UI.modal(T('m.releasebtn'), h('div', null, h('p', { text: T('m.release.ask', { p: p.n, c: money(cost) }) }), h('div', { class: 'row center' },
      UI.btn(T('m.releasebtn'), () => { const r = M.release(c, p); if (r !== 'ok') { err(r); return; } save(); refresh(); }, 'primary'), UI.btn(T('cancel'), () => playerDialog(c, p), 'ghost'))));
  }
  // contract renewal
  function renewDialog(c, p, back) {
    const need = M.renewDemand(c, p);
    let wage = Math.round(need * 1.0 / 5) * 5, years = p.ag >= 33 ? 1 : 3;
    const out = h('p', { class: 'fine' });
    const wOut = h('output', { text: money(wage) });
    const wrap = h('div', null,
      h('p', { text: T('m.renew.intro', { p: p.n }) }),
      infoRow(T('m.wage.now'), money(p.w)), infoRow(T('m.contract'), contractTxt(c, p)),
      UI.slider(T('m.wage.new'), Math.max(5, Math.round(need * 0.7 / 5) * 5), Math.round(need * 1.6 / 5) * 5, 5, wage, (v) => { wage = v; }, (v) => money(v) + '/' + T('m.yr')),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.years.len') }), UI.chips([1, 2, 3, 4, 5].map((n) => ({ v: n, l: String(n) })), years, (v) => { years = v; })), out,
      h('div', { class: 'row center' }, UI.btn(T('m.offer'), () => {
        const r = M.renew(c, p, wage, years);
        if (r === 'ok') { save(); UI.toast(T('m.renew.ok', { p: p.n })); if (back) back(); else refresh(); return; }
        out.textContent = r === 'more' ? T('m.renew.more', { w: money(Math.round(need / 5) * 5) }) : r === 'wb' ? T('m.err.wb') : T('m.renew.no');
        out.className = 'fine bad';
      }, 'primary'), UI.btn(T('cancel'), () => (back ? back() : UI.closeModal()), 'ghost')));
    UI.modal(T('m.renew'), wrap);
  }

  // ---------- lineup editor ----------
  function lineupDialog(c) {
    const m = c.m;
    const list = M.availList(c, true);
    FCK.Lineup.edit({
      title: T('m.lineup') + ' · ' + c.formation, formation: c.formation, color: (FCK.World.clubs[c.idx] || {}).colors ? FCK.World.clubs[c.idx].colors.p : null,
      pool: list, ids: m.xi && m.xi.f === c.formation ? m.xi.ids : null, pick: (pl, f, ids) => M.pickManual(pl, f, ids),
      onSave: (ids) => { m.xi = { f: c.formation, ids: ids.slice() }; save(); refresh(); },
      onReset: () => { m.xi = null; save(); refresh(); },
    });
  }

  // =============================== TRANSFERS TAB ===============================
  const tf = { sub: 'search', f: { cc: null, tier: 0, role: '', ageMax: 0, q: '', sort: 'ovr', afford: true }, res: null, sel: null };
  MgrUI.tabTransfers = function (body, c) {
    const m = c.m;
    const nOff = m.offers.length;
    body.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci' + (M.window(c) ? ' eu' : ''), text: '🔁 ' + winTxt(c) }), h('span', { class: 'ci', text: T('m.tb') + ' ' + money(m.tb) }), h('span', { class: 'ci', text: T('m.wagefree') + ' ' + money(Math.max(0, m.wb - M.bill(c))) })));
    const subs = [['search', T('m.t.search')], ['scout', T('m.t.scout') + (m.sc.ms.length ? ' (' + m.sc.ms.length + ')' : '')], ['fa', T('m.t.fa')], ['offers', T('m.t.offers') + (nOff ? ' (' + nOff + ')' : '')], ['log', T('m.t.log')]];
    body.appendChild(UI.chips(subs.map((s) => ({ v: s[0], l: s[1] })), tf.sub, (v) => { tf.sub = v; refresh(); }, 'tabs sm'));
    ({ search: tSearch, scout: tScout, fa: tFA, offers: tOffers, log: tLog }[tf.sub] || tSearch)(body, c);
  };
  function playerRow(c, e, extra) {
    const m = c.m;
    const shown = M.shownOvr(c, e);
    const st = e.known;
    return h('div', { class: 'mrow', onclick: () => marketDialog(c, e) },
      h('span', { class: 'mr-n' }, crest(e.club, 18), h('b', { text: e.n }), h('small', { text: e.club.short + ' · ' + FCK.posL(e.pos) + ' · ' + e.ag })),
      h('span', { class: 'mr-o' }, ovrBadge(shown, (st ? '' : '~') + shown)),
      h('span', { class: 'mr-p hs' }, st ? UI.stars(e.pt) : h('small', { class: 'muted', text: '?' })),
      h('span', { class: 'mr-v', text: money(e.val) }), extra || null);
  }
  function tSearch(body, c) {
    const f = tf.f;
    const own = W.groups[c.sim.gid[c.idx]].cc;
    if (f.cc === null) f.cc = own;
    const countries = W.countries.slice().sort((a, b) => a.rank - b.rank || a.nameEn.localeCompare(b.nameEn));
    const sec = UI.section(T('m.t.search'));
    sec.appendChild(h('div', { class: 'row tight' }, UI.select([{ v: '', l: '🌍 ' + T('m.t.world') }].concat(countries.map((x) => ({ v: x.cc, l: x.flag + ' ' + cname(x.cc) }))), f.cc || '', (v) => { f.cc = v; }, T('c.country')),
      h('input', { class: 'txt', type: 'search', placeholder: T('m.t.name'), value: f.q, oninput: (e) => { f.q = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') doSearch(c); } })));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.t.tier') }), UI.chips([{ v: 0, l: T('m.t.all') }, { v: 1, l: '1' }, { v: 2, l: '2' }, { v: 3, l: '3' }], f.tier, (v) => { f.tier = v; })));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.t.pos') }), UI.chips([{ v: '', l: T('m.t.all') }].concat(ROLES.map((r) => ({ v: r, l: T('m.role.' + r) }))), f.role, (v) => { f.role = v; })));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.t.age') }), UI.chips([{ v: 0, l: T('m.t.all') }, { v: 21, l: '≤21' }, { v: 25, l: '≤25' }, { v: 30, l: '≤30' }], f.ageMax, (v) => { f.ageMax = v; })));
    sec.appendChild(UI.toggle(T('m.t.afford'), f.afford, (v) => { f.afford = v; }));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.t.sort') }), UI.chips(['ovr', 'val', 'pot', 'age'].map((k) => ({ v: k, l: T('m.sort.' + k) })), f.sort, (v) => { f.sort = v; })));
    sec.appendChild(h('div', { class: 'row center' }, UI.btn(T('m.t.go'), () => doSearch(c), 'primary')));
    body.appendChild(sec);
    if (tf.res) {
      const rs = UI.section(T('m.t.results', { n: tf.res.length }));
      if (!tf.res.length) rs.appendChild(h('p', { class: 'muted', text: T('m.t.none') }));
      const list = h('div', { class: 'mlist' });
      tf.res.forEach((e0) => { const e = M.entryByKey(c, e0.key) || e0; list.appendChild(playerRow(c, e)); });
      rs.appendChild(list);
      rs.appendChild(h('p', { class: 'fine', text: T('m.t.hint') }));
      body.appendChild(rs);
    }
  }
  function doSearch(c) {
    const f = tf.f;
    const S = Math.round(c.m.S);
    tf.res = M.search(c, { cc: f.cc || null, tier: f.tier || 0, role: f.role || null, ageMax: f.ageMax || 0, q: f.q, sort: f.sort, ovrMin: f.q ? 0 : Math.max(30, S - 14), maxVal: f.afford ? Math.max(100, Math.round(c.m.tb * 1.25)) : 0, limit: 50 });
    refresh();
  }
  // player card of another club's player + bidding
  function marketDialog(c, e) {
    const m = c.m;
    const known = e.known || !!m.sc.seen[e.key];
    e.known = known;
    const shown = M.shownOvr(c, e);
    const wrap = h('div', { class: 'pd' });
    wrap.appendChild(h('div', { class: 'cm-head' }, crest(e.club, 44), h('div', null, h('b', { class: 'big', text: e.n }), h('div', { class: 'muted', text: natFlag(e.nt) + ' ' + FCK.posL(e.pos) + ' · ' + T('m.years', { n: e.ag }) + ' · ' + e.club.name })), ovrBadge(shown, (known ? '' : '~') + shown)));
    wrap.appendChild(h('div', { class: 'grid2 tight' },
      h('div', null, infoRow(T('m.value'), money(e.val)), infoRow(T('m.contract'), e.ct + '/' + String((e.ct + 1) % 100).padStart(2, '0')), infoRow(T('m.pot'), known ? UI.stars(e.pt) : '?')),
      h('div', null, infoRow(T('m.wage.exp'), '≈ ' + money(M.wageDemand(c, { key: e.key, o: e.o, ag: e.ag }))), infoRow(T('m.club.str'), String(W.matchOvr(c.sim.r[e.idx]))), infoRow(T('m.known'), known ? T('m.known.yes') : T('m.known.no')))));
    const acts = h('div', { class: 'row' });
    if (!known) acts.appendChild(UI.btn(T('m.observe', { c: money(Math.max(5, Math.round(M.missionCost(c) * 0.3 / 5) * 5)) }), () => { const r = M.observe(c, e.key); if (r === 'ok') { e.known = true; save(); marketDialog(c, e); } else err(r); }, 'ghost sm'));
    acts.appendChild(UI.btn(m.sc.watch.includes(e.key) ? T('m.unwatch') : T('m.watch'), () => { M.watch(c, e.key); save(); marketDialog(c, e); }, 'ghost sm'));
    wrap.appendChild(acts);
    // bid form
    const ask0 = M.askFee(c, e);
    const dem0 = M.wageDemand(c, { key: e.key, o: e.o, ag: e.ag });
    let fee = Math.round(e.val / 10) * 10, wage = Math.round(dem0 * 1.1 / 5) * 5, years = e.ag >= 31 ? 2 : 4;
    const out = h('div', { class: 'bidout' });
    const win = M.window(c);
    const form = h('div', { class: 'bid' });
    form.appendChild(h('h4', { text: T('m.bid') }));
    if (!win) form.appendChild(h('p', { class: 'bad', text: T('m.win.closed') }));
    form.appendChild(UI.slider(T('m.fee'), Math.max(10, Math.round(e.val * 0.4 / 10) * 10), Math.max(20, Math.round(e.val * 2.2 / 10) * 10), Math.max(10, Math.round(e.val / 60 / 10) * 10), fee, (v) => { fee = v; }, (v) => money(v)));
    form.appendChild(UI.slider(T('m.wage.new'), Math.max(5, Math.round(dem0 * 0.6 / 5) * 5), Math.max(10, Math.round(dem0 * 2.0 / 5) * 5), 5, wage, (v) => { wage = v; }, (v) => money(v) + '/' + T('m.yr')));
    form.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.years.len') }), UI.chips([1, 2, 3, 4, 5].map((n) => ({ v: n, l: String(n) })), years, (v) => { years = v; })));
    form.appendChild(out);
    form.appendChild(h('div', { class: 'row center' }, UI.btn(T('m.offer'), () => {
      out.innerHTML = '';
      const ev = M.evalBid(c, e, fee, wage, years);
      const lines = [];
      if (ev.club === 'no') lines.push([T('m.bid.club.no'), 'bad']);
      else if (ev.club === 'counter') lines.push([T('m.bid.club.counter', { f: money(ev.ask) }), 'warn']);
      else lines.push([T('m.bid.club.ok'), 'ok']);
      if (ev.player === 'no') lines.push([T('m.bid.pl.no', { w: money(ev.demand) }) + (ev.why ? ' ' + T('m.why.' + ev.why) : ''), 'bad']);
      else if (ev.player === 'more') lines.push([T('m.bid.pl.more', { w: money(ev.demand) }) + (ev.why ? ' ' + T('m.why.' + ev.why) : ''), 'warn']);
      else lines.push([T('m.bid.pl.ok'), 'ok']);
      lines.forEach((l) => out.appendChild(h('p', { class: l[1], text: l[0] })));
      if (ev.club === 'ok' && ev.player === 'ok') {
        const af = M.canAfford(c, fee, wage);
        if (!win) { out.appendChild(h('p', { class: 'bad', text: T('m.err.window') })); return; }
        if (af) { out.appendChild(h('p', { class: 'bad', text: T('m.err.' + af) })); return; }
        out.appendChild(UI.btn(T('m.sign', { f: money(fee) }), () => {
          const r = M.buy(c, e, fee, wage, years);
          if (r === 'ok') { save(); UI.toast(T('m.bought', { p: e.n })); tf.res = null; refresh(); } else err(r);
        }, 'primary'));
      }
    }, 'primary')));
    wrap.appendChild(form);
    wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('close'), () => UI.closeModal(), 'ghost')));
    UI.modal(e.n, wrap, { cls: 'wide' });
  }
  // scouting
  const sc = { cc: '', role: '', age: 0 };
  function tScout(body, c) {
    const m = c.m;
    const sec = UI.section(T('m.sc.title'));
    sec.appendChild(h('p', { class: 'fine', text: T('m.sc.intro', { n: M.maxMissions(c), l: m.fac.scout }) }));
    m.sc.ms.forEach((ms) => sec.appendChild(h('div', { class: 'goalrow' }, h('span', { text: '🔎' }), h('b', { text: (ms.cc ? flagOf(ms.cc) + ' ' + cname(ms.cc) : '🌍 ' + T('m.t.world')) + (ms.role ? ' · ' + T('m.role.' + ms.role) : '') + (ms.ageMax ? ' · ≤' + ms.ageMax : '') }), h('small', { text: T('m.sc.eta', { n: Math.max(1, ms.end - m.wk) }) }))));
    const countries = W.countries.slice().sort((a, b) => a.rank - b.rank || a.nameEn.localeCompare(b.nameEn));
    sec.appendChild(h('div', { class: 'row tight' }, UI.select([{ v: '', l: '🌍 ' + T('m.t.world') }].concat(countries.map((x) => ({ v: x.cc, l: x.flag + ' ' + cname(x.cc) }))), sc.cc, (v) => { sc.cc = v; }, T('c.country'))));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.t.pos') }), UI.chips([{ v: '', l: T('m.t.all') }].concat(ROLES.map((r) => ({ v: r, l: T('m.role.' + r) }))), sc.role, (v) => { sc.role = v; })));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.t.age') }), UI.chips([{ v: 0, l: T('m.t.all') }, { v: 19, l: '≤19' }, { v: 21, l: '≤21' }, { v: 25, l: '≤25' }], sc.age, (v) => { sc.age = v; })));
    sec.appendChild(h('div', { class: 'row center' }, UI.btn(T('m.sc.start', { c: money(M.missionCost(c)) }), () => { const r = M.startMission(c, { cc: sc.cc || null, role: sc.role || null, ageMax: sc.age || 0 }); if (r === 'ok') { save(); refresh(); } else err('sc' + r); }, 'primary')));
    body.appendChild(sec);
    const list = (title, keys) => {
      const s = UI.section(title);
      const rows = keys.map((k) => M.entryByKey(c, k)).filter(Boolean);
      if (!rows.length) s.appendChild(h('p', { class: 'muted', text: T('m.t.none') }));
      const l = h('div', { class: 'mlist' }); rows.forEach((e) => l.appendChild(playerRow(c, e))); s.appendChild(l);
      body.appendChild(s);
    };
    list(T('m.sc.found'), m.sc.found);
    list(T('m.sc.watch'), m.sc.watch);
  }
  function tFA(body, c) {
    const m = c.m;
    const sec = UI.section(T('m.t.fa'));
    sec.appendChild(h('p', { class: 'fine', text: T('m.fa.intro') }));
    const l = h('div', { class: 'mlist' });
    m.fa.slice().sort((a, b) => b.o - a.o).forEach((r) => {
      l.appendChild(h('div', { class: 'mrow', onclick: () => faDialog(c, r) },
        h('span', { class: 'mr-n' }, h('span', { text: natFlag(r.nt) }), h('b', { text: r.n }), h('small', { text: FCK.posL(r.pos) + ' · ' + r.ag })), h('span', { class: 'mr-o' }, ovrBadge(r.o)), h('span', { class: 'mr-p hs' }, UI.stars(r.pt)), h('span', { class: 'mr-v', text: money(r.w) + '/' + T('m.yr') })));
    });
    sec.appendChild(l);
    body.appendChild(sec);
  }
  function faDialog(c, r) {
    let wage = Math.round(r.w * 1.02 / 5) * 5, years = r.ag >= 32 ? 1 : 3;
    const out = h('p', { class: 'fine' });
    const wrap = h('div', null,
      h('div', { class: 'cm-head' }, h('div', { class: 'num', text: FCK.posL(r.pos) }), h('div', null, h('b', { class: 'big', text: r.n }), h('div', { class: 'muted', text: natFlag(r.nt) + ' ' + T('m.years', { n: r.ag }) })), ovrBadge(r.o)),
      infoRow(T('m.pot'), UI.stars(r.pt)), infoRow(T('m.wage.exp'), money(r.w) + '/' + T('m.yr')),
      UI.slider(T('m.wage.new'), Math.max(5, Math.round(r.w * 0.8 / 5) * 5), Math.round(r.w * 1.8 / 5) * 5, 5, wage, (v) => { wage = v; }, (v) => money(v) + '/' + T('m.yr')),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.years.len') }), UI.chips([1, 2, 3, 4].map((n) => ({ v: n, l: String(n) })), years, (v) => { years = v; })), out,
      h('p', { class: 'fine', text: T('m.fa.bonus', { b: money(Math.round(wage * 0.4)) }) }),
      h('div', { class: 'row center' }, UI.btn(T('m.sign.free'), () => {
        const rr = M.signFA(c, r, wage, years);
        if (rr === 'ok') { save(); UI.toast(T('m.bought', { p: r.n })); refresh(); } else { out.textContent = rr === 'player' ? T('m.fa.more', { w: money(r.w) }) : T('m.err.' + rr); out.className = 'fine bad'; }
      }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')));
    UI.modal(r.n, wrap);
  }
  function tOffers(body, c) {
    const m = c.m;
    const sec = UI.section(T('m.t.offers'));
    if (!m.offers.length) sec.appendChild(h('p', { class: 'muted', text: T('m.off.none') }));
    m.offers.forEach((of) => {
      const p = M.byId(c, of.pid); if (!p) return;
      const val = M.recValue(p);
      sec.appendChild(h('div', { class: 'offer' },
        h('span', { class: 'mr-n' }, crest(of.club, 22), h('b', { text: p.n }), h('small', { text: W.clubs[of.club].name + ' · ' + T('m.off.wk', { n: Math.max(1, of.exp - m.wk + 1) }) })),
        h('b', { class: 'fee', text: money(of.fee) }), h('small', { class: of.fee >= val ? 'ok' : 'muted', text: (of.fee >= val ? '≥ ' : '< ') + T('m.value') + ' ' + money(val) }),
        h('div', { class: 'row' }, UI.btn(T('m.off.accept'), () => { const r = M.acceptOffer(c, of); if (r === 'ok') { save(); UI.toast(T('m.sold', { p: p.n })); refresh(); } else err(r); }, 'primary sm'), UI.btn(T('m.off.reject'), () => { M.rejectOffer(c, of); refresh(); }, 'ghost sm'))));
    });
    body.appendChild(sec);
    const lst = M.listed(c);
    const sec2 = UI.section(T('m.off.listed'));
    if (!lst.length) sec2.appendChild(h('p', { class: 'muted', text: T('m.off.nolist') }));
    lst.forEach((p) => sec2.appendChild(h('div', { class: 'goalrow' }, h('span', { text: '🏷' }), h('b', { text: p.n }), h('small', { text: FCK.posL(p.pos) + ' · ' + money(M.recValue(p)) }), UI.btn(T('m.unlist'), () => { M.toggleList(c, p); save(); refresh(); }, 'ghost sm'))));
    sec2.appendChild(h('p', { class: 'fine', text: T('m.off.hint') }));
    body.appendChild(sec2);
  }
  function tLog(body, c) {
    const sec = UI.section(T('m.t.log'));
    if (!c.m.tl.length) sec.appendChild(h('p', { class: 'muted', text: T('m.t.none') }));
    c.m.tl.forEach((t) => sec.appendChild(h('div', { class: 'goalrow' }, h('span', { text: t.k === 'buy' ? '⬇' : t.k === 'sell' ? '⬆' : '🆓' }), h('b', { text: t.n }), h('small', { text: C.seasonLabel(t.y) + ' · ' + (t.club >= 0 ? W.clubs[t.club].name : T('m.t.fa')) }), h('span', { class: 'sc', text: t.fee ? money(t.fee) : '–' }))));
    body.appendChild(sec);
  }

  // =============================== YOUTH TAB ===============================
  let ytSel = 'top';
  MgrUI.tabYouth = function (body, c) {
    const m = c.m;
    body.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci', text: T('fac.acad') + ' ' + m.fac.acad + '/5' }), h('span', { class: 'ci', text: T('m.youth.count', { n: m.youth.length }) }), h('span', { class: 'ci', text: T('m.youth.cost') + ' ' + money(M.youthCost(c)) + '/' + T('m.yr') })));
    const opts = [{ v: 'top', l: '★ ' + T('m.youth.top') }];
    for (let ag = M.YMIN; ag <= M.YMAX; ag++) opts.push({ v: ag, l: 'U' + ag });
    body.appendChild(UI.chips(opts, ytSel, (v) => { ytSel = v; refresh(); }, 'tabs sm'));
    let list, title;
    if (ytSel === 'top') { list = m.youth.slice().sort((a, b) => (b.pt + b.o * 0.3) - (a.pt + a.o * 0.3)).slice(0, 14); title = T('m.youth.top'); } else { list = M.youthGroup(c, +ytSel); title = 'U' + ytSel; }
    const sec = UI.section(title);
    if (ytSel !== 'top') { const pl = M.youthLeague(c, +ytSel); sec.appendChild(h('p', { class: 'fine', text: pl ? T('m.youth.place', { p: pl }) : T('m.youth.noleague') })); }
    const tbl = h('table', { class: 'ptable mg' });
    tbl.appendChild(h('thead', null, h('tr', null, h('th', { text: T('res.player') }), h('th', { text: T('c.pos.s') }), h('th', { text: ytSel === 'top' ? T('m.age') : '' }), h('th', { text: T('sq.ovr') }), h('th', { text: T('m.pot') }), h('th', { text: '' }))));
    const tb = h('tbody');
    list.forEach((y) => {
      const ps = M.potShown(c, y);
      tb.appendChild(h('tr', { onclick: () => youthDialog(c, y) }, h('td', null, h('b', { text: y.n })), h('td', { text: FCK.posL(y.pos) }), h('td', { text: ytSel === 'top' ? 'U' + y.ag : '' }), h('td', { class: 'ovr' }, ovrBadge(y.o)), h('td', null, UI.stars(ps.v), ps.unc >= 3 ? h('small', { class: 'muted', text: ' ±' + ps.unc }) : null),
        h('td', null, y.ag >= 16 ? UI.btn(T('m.promote'), (ev) => { ev.stopPropagation(); const r = M.promote(c, y); if (r === 'ok') { save(); UI.toast(T('m.promoted', { p: y.n })); refresh(); } else err(r); }, 'ghost sm') : h('small', { class: 'muted', text: '16+' }))));
    });
    tbl.appendChild(tb);
    sec.appendChild(h('div', { class: 'scrollx' }, tbl));
    sec.appendChild(h('p', { class: 'fine', text: T('m.youth.hint') }));
    body.appendChild(sec);
  };
  function youthDialog(c, y) {
    const gp = M.toPlayer(c, y, 0), ps = M.potShown(c, y);
    const wrap = h('div', { class: 'pd' });
    wrap.appendChild(h('div', { class: 'cm-head' }, h('div', { class: 'num', text: 'U' + y.ag }), h('div', null, h('b', { class: 'big', text: y.n }), h('div', { class: 'muted', text: natFlag(y.nt) + ' ' + FCK.posL(y.pos) + ' · ' + T('m.years', { n: y.ag }) })), ovrBadge(y.o)));
    const attrs = h('div', { class: 'attrs' });
    ['pac', 'sho', 'pas', 'dri', 'def', 'phy'].forEach((k) => attrs.appendChild(h('div', { class: 'at' }, h('span', { text: T('m.a.' + k) }), bar(gp.a[k], ovrCls(gp.a[k])), h('b', { text: gp.a[k] }))));
    wrap.appendChild(attrs);
    wrap.appendChild(infoRow(T('m.pot'), h('span', null, UI.stars(ps.v), ps.unc >= 3 ? ' ±' + ps.unc : '')));
    wrap.appendChild(infoRow(T('m.value'), money(M.valueOf(y.o, y.ag, ps.v))));
    wrap.appendChild(h('div', { class: 'row center' },
      y.ag >= 16 ? UI.btn(T('m.promote'), () => { const r = M.promote(c, y); if (r === 'ok') { save(); refresh(); } else err(r); }, 'primary') : null,
      UI.btn(T('m.youth.release'), () => { M.releaseYouth(c, y); save(); refresh(); }, 'ghost bad'), UI.btn(T('close'), () => UI.closeModal(), 'ghost')));
    UI.modal(y.n, wrap);
  }

  // =============================== CLUB TAB ===============================
  let clSub = 'board';
  MgrUI.tabClub = function (body, c) {
    const subs = ['board', 'fin', 'build', 'press'];
    body.appendChild(UI.chips(subs.map((s) => ({ v: s, l: T('m.c.' + s) })), clSub, (v) => { clSub = v; refresh(); }, 'tabs sm'));
    ({ board: cBoard, fin: cFin, build: cBuild, press: cPress }[clSub] || cBoard)(body, c);
  };
  MgrUI.objText = function (o) {
    if (o.k === 'lg') return T('obj.lg.' + o.kind, { p: o.p });
    if (o.k === 'cup') return T('obj.cup', { r: C.roundName(o.t, o.t + 1) });
    if (o.k === 'eu') return T('obj.eu', { c: FCK.SimConst.EURO_NAME[o.comp], s: T('stage.' + ['lp', 'po', 'r16', 'qf', 'sf', 'f'][o.t]) });
    if (o.k === 'fin') return T('obj.fin');
    return T('obj.youth', { n: o.n });
  };
  // live state of an objective: 'ok' (reached / on course), 'bad', 'open'
  function liveState(c, o) {
    const sim = c.sim, g = W.groups[sim.gid[c.idx]];
    if (o.k === 'lg') {
      const tb = sim.leagues[g.gid].table(); const row = tb.find((r) => r.idx === c.idx);
      if (!row || !row.p) return { st: 'open', txt: '–' };
      return { st: row.pos <= o.p ? 'ok' : 'bad', txt: T('t.pos', { n: row.pos }) };
    }
    const pr = M.progress(c);
    if (o.k === 'cup') { if (pr.cupWon) return { st: 'ok', txt: '🏆' }; const cup = sim.cups[g.cc]; if (pr.cupBest === null) return { st: 'open', txt: '–' }; return { st: pr.cupBest <= o.t ? 'ok' : 'open', txt: C.roundName(pr.cupBest, cup.R - pr.cupBest) }; }
    if (o.k === 'eu') return pr.euBest < 0 ? { st: 'open', txt: '–' } : { st: pr.euBest >= o.t ? 'ok' : 'open', txt: T('stage.' + ['lp', 'po', 'r16', 'qf', 'sf', 'f'][pr.euBest]) };
    if (o.k === 'fin') return { st: c.m.cash >= 0 ? 'ok' : 'bad', txt: money(c.m.cash) };
    return { st: c.m.prom >= o.n ? 'ok' : 'open', txt: String(c.m.prom) + '/' + o.n };
  }
  MgrUI.objList = function (c) {
    const box = h('div', { class: 'objs' });
    c.m.obj.forEach((o) => { const s = liveState(c, o); box.appendChild(h('div', { class: 'obj ' + s.st }, h('span', { class: 'od', text: s.st === 'ok' ? '✔' : s.st === 'bad' ? '✖' : '○' }), h('span', { text: MgrUI.objText(o) }), h('small', { text: s.txt }))); });
    return box;
  };
  function cBoard(body, c) {
    const m = c.m;
    const sec = UI.section(T('m.board'));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.board.conf') }), bar(m.bc, m.bc < 25 ? 'bad' : m.bc > 70 ? 'ok' : '', Math.round(m.bc) + '%')));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.fans') }), bar(m.fan, '', Math.round(m.fan) + '%')));
    sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('m.teammood') }), bar(m.mood, '', Math.round(m.mood) + '%')));
    if (m.easy) sec.appendChild(h('p', { class: 'fine', text: T('m.easy.note') }));
    body.appendChild(sec);
    body.appendChild(UI.section(T('m.obj.title', { s: C.seasonLabel(c.sim.year) }), MgrUI.objList(c), h('p', { class: 'fine', text: T('m.obj.hint') })));
    if (c.m.fh.length) {
      const t = h('table', { class: 'ptable' });
      c.m.fh.slice().reverse().forEach((r) => t.appendChild(h('tr', null, h('td', { text: C.seasonLabel(r.y) }), h('td', { class: r.net >= 0 ? 'ok' : 'bad', text: money(r.net, { plus: true }) }), h('td', { class: 'muted', text: money(r.cash) }))));
      body.appendChild(UI.section(T('m.fin.hist'), h('div', { class: 'scrollx' }, t)));
    }
  }
  function cFin(body, c) {
    const m = c.m, L = m.led;
    const inc = Object.values(L.inc).reduce((a, b) => a + b, 0), exp = Object.values(L.exp).reduce((a, b) => a + b, 0);
    const sec = UI.section(T('m.fin.title', { s: C.seasonLabel(c.sim.year) }));
    sec.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci' + (m.cash < 0 ? ' bad' : ''), text: T('m.cash') + ' ' + money(m.cash) }), h('span', { class: 'ci', text: T('m.rev') + ' ' + money(m.rev) + '/' + T('m.yr') }), h('span', { class: 'ci', text: T('m.tb') + ' ' + money(m.tb) })));
    const t = h('table', { class: 'ptable fin' });
    const row = (label, v, cls) => t.appendChild(h('tr', { class: cls || '' }, h('td', { text: label }), h('td', { class: 'ovr', text: money(Math.round(v)) })));
    t.appendChild(h('tr', null, h('th', { text: T('m.fin.income') })));
    ['gate', 'tv', 'sp', 'prize', 'sale', 'other'].forEach((k) => { if (L.inc[k] || k === 'gate') row(T('m.f.' + k), L.inc[k]); });
    row(T('m.fin.sum'), inc, 'sum');
    t.appendChild(h('tr', null, h('th', { text: T('m.fin.expense') })));
    ['wage', 'staff', 'buy', 'youth', 'other'].forEach((k) => row(T('m.f.' + k), L.exp[k]));
    row(T('m.fin.sum'), exp, 'sum');
    t.appendChild(h('tr', { class: 'sum ' + (inc - exp >= 0 ? 'ok' : 'bad') }, h('td', { text: T('m.fin.net') }), h('td', { class: 'ovr', text: money(Math.round(inc - exp), { plus: true }) })));
    sec.appendChild(h('div', { class: 'scrollx' }, t));
    body.appendChild(sec);
    // sponsor
    const sp = UI.section(T('m.sp.title'));
    if (m.sp) {
      sp.appendChild(h('div', { class: 'sponsor on' }, h('b', { text: m.sp.name }), h('small', { text: T('m.sp.fix', { f: money(m.sp.fix) }) + ' · ' + T('m.sp.bw', { b: money(m.sp.bw) }) + (m.sp.bt ? ' · ' + T('m.sp.bt', { b: money(m.sp.bt) }) : '') })));
    } else {
      sp.appendChild(h('p', { class: 'fine', text: T('m.sp.pick') }));
      m.spOffers.forEach((o, i) => sp.appendChild(h('div', { class: 'sponsor' }, h('b', { text: o.name }), h('small', { text: T('m.sp.fix', { f: money(o.fix) }) + ' · ' + T('m.sp.bw', { b: money(o.bw) }) + (o.bt ? ' · ' + T('m.sp.bt', { b: money(o.bt) }) : '') }), UI.btn(T('m.sp.take'), () => { M.pickSponsor(c, i); save(); refresh(); }, 'primary sm'))));
    }
    body.appendChild(sp);
  }
  function cBuild(body, c) {
    const m = c.m;
    const sec = UI.section(T('m.build'));
    sec.appendChild(h('p', { class: 'fine', text: T('m.build.intro', { u: money(M.staffCost(c)) }) }));
    M.FAC.forEach((k) => {
      const cost = M.upCost(c, k);
      sec.appendChild(h('div', { class: 'fac' }, h('span', { class: 'fn' }, h('b', { text: T('fac.' + k) }), h('small', { text: T('fac.' + k + '.d') })), pip(m.fac[k]),
        cost === null ? h('small', { class: 'muted', text: T('m.max') }) : UI.btn(T('m.upgrade', { c: money(cost) }), () => { const r = M.upgrade(c, k); if (r === 'ok') { save(); UI.toast(T('m.upgraded')); refresh(); } else err(r === 'cash' ? 'cash' : 'max'); }, 'ghost sm')));
    });
    body.appendChild(sec);
  }
  function cPress(body, c) {
    const m = c.m;
    const sec = UI.section(T('m.press'));
    sec.appendChild(h('p', { class: 'fine', text: T('m.press.intro') }));
    sec.appendChild(h('div', { class: 'row' }, UI.btn(T('m.press.pre'), () => pressDialog(c, 'pre', null), 'primary'), m.press ? UI.btn(T('m.press.post'), () => pressDialog(c, 'post', m.press.res), 'ghost') : null));
    body.appendChild(sec);
  }
  function pressDialog(c, ph, res) {
    const qs = M.pressQuestions(c, ph, res);
    let i = 0; const sum = { t: 0, b: 0, f: 0 };
    const wrap = h('div', null);
    const draw = () => {
      wrap.innerHTML = '';
      if (i >= qs.length) {
        const r = h('div', null, h('p', { class: 'center', text: T('m.press.done') }),
          h('div', { class: 'row center' }, h('span', { class: 'ci', text: '👥 ' + (sum.t >= 0 ? '+' : '') + sum.t }), h('span', { class: 'ci', text: '🏛 ' + (sum.b >= 0 ? '+' : '') + Math.round(sum.b * 0.9) }), h('span', { class: 'ci', text: '🎺 ' + (sum.f >= 0 ? '+' : '') + sum.f })),
          h('div', { class: 'row center' }, UI.btn(T('ok'), () => { if (ph === 'post') c.m.press = null; save(); refresh(); }, 'primary')));
        wrap.appendChild(r); return;
      }
      const q = qs[i];
      wrap.appendChild(h('p', { class: 'muted center', text: T('m.press.q', { n: i + 1, m: qs.length }) }));
      wrap.appendChild(h('p', { class: 'pq', text: '🎤 ' + T('press.' + q + '.q') }));
      [0, 1, 2].forEach((ai) => wrap.appendChild(UI.btn(T('press.' + q + '.a' + ai), () => { const e = M.pressAnswer(c, q, ai); sum.t += e.t; sum.b += e.b; sum.f += e.f; i++; draw(); }, 'ghost wide')));
    };
    draw();
    UI.modal(T(ph === 'pre' ? 'm.press.pre' : 'm.press.post'), wrap, { sticky: true });
  }

  // =============================== HOME CARDS ===============================
  MgrUI.homeCards = function (body, c) {
    const m = c.m; if (!m) return;
    const grid = h('div', { class: 'grid2' });
    // board / objectives
    grid.appendChild(UI.section(T('m.board') + ' · ' + Math.round(m.bc) + '%', MgrUI.objList(c), h('div', { class: 'row' }, UI.btn(T('m.c.board'), () => { C.tab = 'club'; clSub = 'board'; refresh(); }, 'ghost sm'))));
    // status
    const st = UI.section(T('m.status'));
    const hurt = m.players.filter((p) => p.inj && !p.ln).sort((a, b) => b.inj - a.inj);
    st.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci', text: T('m.strength') + ' ' + m.S }), h('span', { class: 'ci' + (M.window(c) ? ' eu' : ''), text: '🔁 ' + winTxt(c) }), h('span', { class: 'ci' + (m.cash < 0 ? ' bad' : ''), text: '💰 ' + money(m.cash) })));
    if (hurt.length) { st.appendChild(h('h4', { text: T('m.hurt') })); hurt.slice(0, 5).forEach((p) => st.appendChild(h('div', { class: 'goalrow' }, h('span', { text: '🤕' }), h('b', { text: p.n }), h('small', { text: FCK.posL(p.pos) + ' · ' + T('m.inj', { n: p.inj }) })))); } else st.appendChild(h('p', { class: 'muted', text: T('m.nohurt') }));
    if (m.offers.length) st.appendChild(UI.btn('📨 ' + T('m.offers.n', { n: m.offers.length }), () => { C.tab = 'transfers'; tf.sub = 'offers'; refresh(); }, 'primary sm'));
    if (m.press) st.appendChild(UI.btn('🎤 ' + T('m.press.waiting'), () => pressDialog(c, 'post', m.press.res), 'ghost sm'));
    if (!m.sp) st.appendChild(UI.btn('🤝 ' + T('m.sp.pickbtn'), () => { C.tab = 'club'; clSub = 'fin'; refresh(); }, 'ghost sm'));
    if (m.newScout) { st.appendChild(UI.btn('🔎 ' + T('m.sc.new', { n: m.newScout }), () => { m.newScout = 0; C.tab = 'transfers'; tf.sub = 'scout'; refresh(); }, 'ghost sm')); }
    grid.appendChild(st);
    body.appendChild(grid);
  };

  // =============================== SEASON END ===============================
  // checklist before the new season starts
  MgrUI.beforeEnd = function (c, go) {
    const rv = M.review(c);
    if (!c.m || (!rv.expiring.length && !rv.grads.length)) { go(); return; }
    const wrap = h('div', null);
    const draw = () => {
      wrap.innerHTML = '';
      const rv2 = M.review(c);
      if (rv2.expiring.length) {
        wrap.appendChild(h('h4', { text: T('m.end.expiring') }));
        wrap.appendChild(h('p', { class: 'fine', text: T('m.end.expiring.h') }));
        rv2.expiring.sort((a, b) => b.o - a.o).forEach((p) => wrap.appendChild(h('div', { class: 'goalrow' }, ovrBadge(p.o), h('b', { text: p.n }), h('small', { text: FCK.posL(p.pos) + ' · ' + p.ag + ' · ' + money(p.w) }), UI.btn(T('m.renew'), () => renewDialog(c, p, () => { UI.modal(T('m.end.title'), wrap, { cls: 'wide', sticky: true }); draw(); }), 'primary sm'))));
      }
      if (rv2.grads.length) {
        wrap.appendChild(h('h4', { text: T('m.end.grads') }));
        wrap.appendChild(h('p', { class: 'fine', text: T('m.end.grads.h') }));
        rv2.grads.sort((a, b) => b.pt - a.pt).forEach((y) => wrap.appendChild(h('div', { class: 'goalrow' }, ovrBadge(y.o), h('b', { text: y.n }), h('small', { text: FCK.posL(y.pos) + ' · ' + M.potShown(c, y).v + '↗' }), UI.btn(T('m.promote'), () => { const r = M.promote(c, y); if (r !== 'ok') err(r); draw(); }, 'primary sm'), UI.btn(T('m.youth.release'), () => { M.releaseYouth(c, y); draw(); }, 'ghost sm'))));
      }
      wrap.appendChild(h('div', { class: 'row center' }, UI.btn(T('m.end.go'), () => { UI.closeModal(); go(); }, 'primary xl'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')));
    };
    draw();
    UI.modal(T('m.end.title'), wrap, { cls: 'wide', sticky: true });
  };
  // extra part in the "new season" dialog
  MgrUI.seasonExtra = function (c, s) {
    const rep = s.rep; const box = h('div', { class: 'se-extra' });
    if (!rep || !c.m) return box;
    box.appendChild(h('h4', { text: T('m.rep.board') }));
    (rep.ev || []).forEach((o) => box.appendChild(h('div', { class: 'obj ' + (o.ok ? 'ok' : 'bad') }, h('span', { class: 'od', text: o.ok ? '✔' : '✖' }), h('span', { text: MgrUI.objText(o) }))));
    box.appendChild(h('p', { text: T('m.rep.conf', { a: Math.round(rep.bc0), b: Math.round(rep.bc1) }) }));
    box.appendChild(h('p', { text: T('m.rep.fin', { i: money(Math.round(rep.inc)), e: money(Math.round(rep.exp)), p: money(Math.round(rep.tot)) }) }));
    if (rep.retired && rep.retired.length) box.appendChild(h('p', { class: 'fine', text: T('m.rep.retired') + ': ' + rep.retired.join(', ') }));
    if (rep.left && rep.left.length) box.appendChild(h('p', { class: 'fine', text: T('m.rep.left') + ': ' + rep.left.join(', ') }));
    if (rep.riser && rep.riser.length) box.appendChild(h('p', { class: 'fine', text: T('m.rep.riser') + ': ' + rep.riser.map((r) => r.n + ' +' + r.d).join(', ') }));
    if (rep.grads && rep.grads.length) box.appendChild(h('p', { class: 'fine', text: T('m.rep.grads') + ': ' + rep.grads.join(', ') }));
    if (rep.sacked) {
      box.appendChild(h('p', { class: 'bad big', text: '🚪 ' + T('m.sacked.title') }));
    } else if (rep.offers && rep.offers.length) {
      box.appendChild(h('h4', { text: T('m.rep.offers') }));
      rep.offers.forEach((i) => box.appendChild(h('div', { class: 'goalrow' }, crest(i, 22), h('b', { text: W.clubs[i].name }), h('small', { text: flagOf(W.clubs[i].country) + ' ' + W.groups[c.sim.gid[i]].lname }), UI.btn(T('m.job.take'), () => { C.switchClub(i); MgrUI._sackShown = false; UI.closeModal(); refresh(); }, 'primary sm'))));
      box.appendChild(h('p', { class: 'fine', text: T('m.job.hint') }));
    }
    return box;
  };
  MgrUI.afterEnd = function (c, s) {
    if (s.rep && s.rep.sacked) setTimeout(() => sackedDialog(c, s.rep), 50);
  };
  function sackedDialog(c, rep) {
    const wrap = h('div', null,
      h('p', { text: T('m.sacked.text', { club: W.clubs[c.idx].name }) }),
      h('div', { class: 'row center' }, UI.btn(T('m.sacked.new'), () => {
        FCK.clubPicker({ career: true, title: T('m.sacked.new'), current: null, onPick: (t) => { C.switchClub(t.idx !== undefined ? t.idx : W.byId[t.id].idx); MgrUI._sackShown = false; refresh(); } });
      }, 'primary xl')));
    UI.modal('🚪 ' + T('m.sacked.title'), wrap, { sticky: true });
  }

  MgrUI.tab = function (name, body, c) {
    M.ensure(c);
    ({ squad: MgrUI.tabSquad, transfers: MgrUI.tabTransfers, youth: MgrUI.tabYouth, club: MgrUI.tabClub }[name])(body, c);
  };
})((globalThis.FCK = globalThis.FCK || {}));
