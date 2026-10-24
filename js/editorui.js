/* FCK - editorui.js : editor screens (own clubs, adjust real clubs, squads, stadium, data) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);
  const W = FCK.World;
  const Ed = FCK.Editor;

  FCK.Screens = FCK.Screens || {};
  const ST = { tab: 'own' };
  const cname = (cc) => W.countryName(cc);

  function copyTo(ta) {
    ta.select();
    try { navigator.clipboard.writeText(ta.value).then(() => UI.toast(T('copied'))).catch(() => { try { document.execCommand('copy'); } catch (e) { /* ignore */ } }); } catch (e) { /* ignore */ }
  }
  function armed(btn, label, sure, fn) {
    let a = false;
    btn.addEventListener('click', () => {
      if (!a) { a = true; btn.textContent = sure; btn.classList.add('danger'); setTimeout(() => { a = false; btn.textContent = label; btn.classList.remove('danger'); }, 3500); return; }
      a = false; fn();
    }, true);
    return btn;
  }
  const grpLabel = (g) => T('ed.grp.' + g);

  // ------------------------------------------------------------------ main screen
  FCK.Screens.editor = function () {
    Ed.register();
    const el = h('div', { class: 'page editor' });
    el.appendChild(UI.header(T('ed.title'), () => UI.back()));
    const body = h('div', { class: 'ed-body' });
    const tabs = UI.chips([{ v: 'own', l: T('ed.tab.own') }, { v: 'adjust', l: T('ed.tab.adjust') }, { v: 'data', l: T('ed.tab.data') }], ST.tab, (v) => { ST.tab = v; draw(); }, 'scroll tabs');
    el.appendChild(tabs); el.appendChild(body);
    const draw = () => {
      body.innerHTML = '';
      ({ own: tabOwn, adjust: tabAdjust, data: tabData })[ST.tab](body, draw);
    };
    draw();
    return el;
  };

  function clubRow(c, actions, sub) {
    return h('div', { class: 'crow ed-row' }, UI.crestImg(c, 44),
      h('div', { class: 'mr-n' }, h('b', { text: c.name }), h('small', { text: sub || (c.stadium + ' · ' + c.cap.toLocaleString(FCK.settings.lang === 'en' ? 'en-US' : 'de-DE')) })),
      UI.stars(c.rating), h('div', { class: 'ed-act' }, actions));
  }

  function tabOwn(body, redraw) {
    const D = Ed.data;
    const sec = UI.section(T('ed.own.title'), h('p', { class: 'fine', text: T('ed.own.hint', { n: Ed.MAX_CLUBS }) }));
    sec.appendChild(h('div', { class: 'row' }, UI.btn('＋ ' + T('ed.new'), () => newDialog(redraw), 'primary', { disabled: D.clubs.length >= Ed.MAX_CLUBS })));
    body.appendChild(sec);
    if (!D.clubs.length) { body.appendChild(h('p', { class: 'muted center', text: T('ed.own.none') })); return; }
    const list = h('div', { class: 'card sect' });
    D.clubs.forEach((rec) => {
      const c = W.byId[rec.id]; if (!c) return;
      const del = UI.btn('🗑', () => {}, 'ghost sm'); del.title = T('ed.delete');
      armed(del, '🗑', T('ed.delete.sure'), () => { Ed.deleteClub(c.id); redraw(); });
      list.appendChild(clubRow(c, [
        UI.btn(T('ed.edit'), () => UI.show('editorClub', { id: c.id }), 'ghost sm'),
        UI.btn('⚽', () => { FCK.setup.home = c.id; if (FCK.setup.away === c.id) FCK.setup.away = c.id === 'mci' ? 'fcb' : 'mci'; FCK.setup.touched = true; FCK.saveSetup(); UI.show('setup'); }, 'ghost sm'),
        (() => { const b = UI.btn('⎘', () => { const n = Ed.dupClub(c); if (n) redraw(); }, 'ghost sm'); b.title = T('ed.dup'); return b; })(),
        del]));
    });
    body.appendChild(list);
  }

  function newDialog(redraw) {
    const f = { name: '', mode: 'random', r: 60, group: 'de', base: null };
    const nameIn = h('input', { type: 'text', class: 'txt', maxlength: 24, placeholder: T('ed.name.ph'), 'aria-label': T('ed.name') });
    nameIn.addEventListener('input', () => { f.name = nameIn.value; });
    const dyn = h('div');
    const baseBtn = UI.btn(T('ed.base.pick'), () => {
      FCK.clubPicker({ title: T('ed.base.pick'), current: f.base && f.base.id, onPick: (t) => { f.base = t; if (!nameIn.value) { nameIn.value = t.name + ' 2'; f.name = nameIn.value; } fill(); UI.modal(T('ed.new'), box); } });
    }, 'ghost');
    const fill = () => {
      dyn.innerHTML = '';
      dyn.appendChild(UI.chips([{ v: 'random', l: T('ed.mode.random') }, { v: 'copy', l: T('ed.mode.copy') }], f.mode, (v) => { f.mode = v; fill(); }));
      if (f.mode === 'random') {
        dyn.appendChild(UI.slider(T('ed.strength'), 30, 90, 1, f.r, (v) => { f.r = v; }, (v) => '★ ' + W.matchOvr(v)));
        dyn.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('ed.names') }), UI.select(Ed.GROUPS.map((g) => ({ v: g, l: grpLabel(g) })), f.group, (v) => { f.group = v; }, T('ed.names'))));
      } else {
        dyn.appendChild(h('p', { class: 'fine', text: T('ed.mode.copy.hint') }));
        dyn.appendChild(h('div', { class: 'row' }, baseBtn, f.base ? h('b', { text: f.base.name }) : h('span', { class: 'muted', text: T('ed.base.none') })));
      }
    };
    fill();
    const box = h('div', null, h('label', { class: 'field stk' }, h('span', { class: 'lbl', text: T('ed.name') }), nameIn), dyn,
      h('div', { class: 'row' }, UI.btn(T('ed.create'), () => {
        if (f.mode === 'copy' && !f.base) { UI.toast(T('ed.base.none')); return; }
        const c = Ed.newClub({ name: f.name.trim() || undefined, group: f.group, r: f.mode === 'random' ? f.r : undefined, base: f.mode === 'copy' ? f.base : null });
        UI.closeModal();
        if (c) UI.show('editorClub', { id: c.id });
      }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')));
    UI.modal(T('ed.new'), box);
    setTimeout(() => { try { nameIn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
  }

  function tabAdjust(body, redraw) {
    const sec = UI.section(T('ed.adj.title'), h('p', { class: 'fine', text: T('ed.adj.hint') }));
    sec.appendChild(h('div', { class: 'row' }, UI.btn(T('ed.adj.pick'), () => FCK.clubPicker({ title: T('ed.adj.pick'), onPick: (t) => UI.show('editorClub', { id: t.id }) }), 'primary')));
    body.appendChild(sec);
    const D = Ed.data;
    const ids = Array.from(new Set(Object.keys(D.over).concat(Object.keys(D.pl)))).filter((id) => W.byId[id] && !W.byId[id].custom);
    if (!ids.length) { body.appendChild(h('p', { class: 'muted center', text: T('ed.adj.none') })); return; }
    const list = h('div', { class: 'card sect' }, h('h3', { text: T('ed.adj.list') }));
    ids.forEach((id) => {
      const c = W.byId[id];
      const tags = [D.over[id] ? T('ed.tag.look') : null, D.pl[id] ? T('ed.tag.squad') : null].filter(Boolean).join(' · ');
      list.appendChild(clubRow(c, [UI.btn(T('ed.edit'), () => UI.show('editorClub', { id }), 'ghost sm')], tags));
    });
    body.appendChild(list);
  }

  function tabData(body, redraw) {
    const sec = UI.section(T('ed.data.title'), h('p', { class: 'fine', text: T('ed.data.hint') }));
    const ta = h('textarea', { class: 'code', rows: 5, placeholder: 'FCKE1:…' });
    sec.appendChild(h('div', { class: 'row' }, UI.btn(T('ed.export'), () => { ta.value = Ed.exportText(); copyTo(ta); }, 'ghost'),
      UI.btn(T('ed.import'), () => { if (Ed.importText(ta.value, false)) { UI.toast(T('ed.import.ok')); ta.value = ''; redraw(); } else UI.toast(T('ed.import.bad')); }, 'ghost'),
      UI.btn(T('ed.import.merge'), () => { if (Ed.importText(ta.value, true)) { UI.toast(T('ed.import.ok')); ta.value = ''; redraw(); } else UI.toast(T('ed.import.bad')); }, 'ghost')));
    sec.appendChild(ta);
    const rb = UI.btn(T('ed.reset'), () => {}, 'ghost');
    armed(rb, T('ed.reset'), T('ed.reset.sure'), () => { Ed.reset(); UI.toast(T('ed.reset.done')); redraw(); });
    sec.appendChild(h('div', { class: 'row' }, rb));
    sec.appendChild(h('p', { class: 'fine', text: T('ed.stats', { c: Ed.data.clubs.length, o: Object.keys(Ed.data.over).length, p: Object.keys(Ed.data.pl).length }) }));
    body.appendChild(sec);
  }

  // ------------------------------------------------------------------ club screen (own club or real club override)
  FCK.Screens.editorClub = function (data) {
    Ed.register();
    const club = W.byId[data && data.id];
    const el = h('div', { class: 'page editor' });
    if (!club) { el.appendChild(UI.header(T('ed.title'), () => UI.back())); el.appendChild(h('p', { class: 'muted', text: T('ed.gone') })); return el; }
    const own = !!club.custom;
    el.appendChild(UI.header(club.name, () => UI.back()));
    const prev = h('div', { class: 'club-prev' });
    const drawPrev = () => {
      prev.innerHTML = '';
      prev.appendChild(UI.crestImg(club, 84));
      const kits = FCK.makeKits(club, W.clubs[0]);
      [0, 1].forEach((i) => { const k = h('img', { class: 'kit', alt: '', width: 64, height: 64 }); k.src = FCK.kitDataUrl(kits[i], 128); prev.appendChild(k); });
      prev.appendChild(h('div', { class: 'ed-sum' }, UI.stars(club.rating), h('small', { text: T('ed.team.ovr', { n: club.rating }) })));
    };
    drawPrev();
    const grid = h('div', { class: 'grid2' });

    // general
    const gen = UI.section(own ? T('ed.sec.club') : T('ed.sec.adjust'), prev);
    const nameIn = h('input', { type: 'text', class: 'txt', maxlength: 24, value: club.name, 'aria-label': T('ed.name') });
    const shortIn = h('input', { type: 'text', class: 'txt short', maxlength: 3, value: club.short, 'aria-label': T('ed.short') });
    nameIn.addEventListener('input', () => { const v = nameIn.value.trim() || club.name; const auto = club.short === Ed.autoShort(club.name); Ed.patch(club, { name: v.slice(0, 24) }); if (auto) { Ed.patch(club, { short: Ed.autoShort(v) }); shortIn.value = club.short; } drawPrev(); });
    shortIn.addEventListener('input', () => { shortIn.value = shortIn.value.toUpperCase(); if (shortIn.value.length >= 2) { Ed.patch(club, { short: shortIn.value.slice(0, 3) }); drawPrev(); } });
    gen.appendChild(h('label', { class: 'field stk' }, h('span', { class: 'lbl', text: T('ed.name') }), nameIn));
    gen.appendChild(h('label', { class: 'field stk' }, h('span', { class: 'lbl', text: T('ed.short') }), shortIn));
    grid.appendChild(gen);

    // look
    const look = UI.section(T('ed.sec.look'));
    const swatches = (key, label) => {
      const sw = h('div', { class: 'swatches' });
      Ed.COLORS.forEach((col) => {
        const b = h('button', { class: 'swatch' + (club.colors[key] === col ? ' on' : ''), type: 'button', style: { background: col }, 'aria-label': col });
        b.addEventListener('click', () => {
          const c = Object.assign({}, club.colors, { [key]: col });
          c.t = Ed.trimColor(c.p, c.s);
          Ed.patch(club, { colors: c });
          sw.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on')); b.classList.add('on'); drawPrev();
        });
        sw.appendChild(b);
      });
      return h('div', { class: 'field' }, h('span', { class: 'lbl', text: label }), sw);
    };
    look.appendChild(swatches('p', T('ed.col.p'))); look.appendChild(swatches('s', T('ed.col.s')));
    const pick = (key, label, opts, cur, set, pre) => look.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: label }), UI.chips(opts.map((v) => ({ v, l: T(pre + v) })), cur, (v) => { set(v); drawPrev(); }, 'scroll')));
    pick('kit', T('k.club.kit'), Ed.KITS, club.kit, (v) => Ed.patch(club, { kit: v }), 'ed.kit.');
    pick('shape', T('k.club.shape'), Ed.SHAPES, club.crest.shape, (v) => Ed.patch(club, { crest: Object.assign({}, club.crest, { shape: v }) }), 'ed.shape.');
    pick('pattern', T('k.club.pattern'), Ed.PATTERNS, club.crest.pattern, (v) => Ed.patch(club, { crest: Object.assign({}, club.crest, { pattern: v }) }), 'ed.pat.');
    pick('emblem', T('k.club.emblem'), Ed.EMBLEMS, club.crest.emblem, (v) => Ed.patch(club, { crest: Object.assign({}, club.crest, { emblem: v }) }), 'ed.emb.');
    grid.appendChild(look);

    // stadium
    const sta = UI.section(T('ed.sec.stadium'));
    const cv = h('canvas', { width: 300, height: 190, class: 'stadium-prev', 'aria-label': T('ed.sec.stadium') });
    const drawSt = () => Ed.drawStadium(cv, club);
    const stIn = h('input', { type: 'text', class: 'txt', maxlength: 28, value: club.stadium, 'aria-label': T('ed.stadium.name') });
    stIn.addEventListener('input', () => { Ed.patch(club, { stadium: stIn.value.slice(0, 28) || club.stadium }); });
    const setPitch = (k, v) => { const p = Object.assign({ grass: 'stripes', ad: '', seat: 'dark' }, club.pitch || {}, { [k]: v }); Ed.patch(club, { pitch: p }); drawSt(); };
    const cur = Object.assign({ grass: 'stripes', ad: '', seat: 'dark' }, club.pitch || {});
    const adIn = h('input', { type: 'text', class: 'txt', maxlength: 10, value: cur.ad, placeholder: 'FCK', 'aria-label': T('ed.stadium.ad') });
    adIn.addEventListener('input', () => { adIn.value = adIn.value.toUpperCase(); setPitch('ad', adIn.value); });
    sta.appendChild(cv);
    sta.appendChild(h('label', { class: 'field stk' }, h('span', { class: 'lbl', text: T('ed.stadium.name') }), stIn));
    sta.appendChild(UI.slider(T('ed.stadium.cap'), 1000, 100000, 500, club.cap, (v) => { Ed.patch(club, { cap: v }); }, (v) => v.toLocaleString(FCK.settings.lang === 'en' ? 'en-US' : 'de-DE')));
    sta.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('ed.stadium.grass') }), UI.chips(Ed.GRASS.map((v) => ({ v, l: T('ed.grass.' + v) })), cur.grass, (v) => setPitch('grass', v), 'scroll')));
    sta.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('ed.stadium.seats') }), UI.chips(Ed.SEATS.map((v) => ({ v, l: T('ed.seat.' + v) })), cur.seat, (v) => setPitch('seat', v), 'scroll')));
    sta.appendChild(h('label', { class: 'field stk' }, h('span', { class: 'lbl', text: T('ed.stadium.ad') }), adIn));
    sta.appendChild(h('p', { class: 'fine', text: T('ed.stadium.hint') }));
    grid.appendChild(sta);
    drawSt();

    // players
    const pl = UI.section(T('ed.sec.players'));
    const sum = h('p', { class: 'fine' });
    const sumTxt = () => { sum.textContent = T('ed.team.ovr', { n: club.rating }) + (!own && Ed.hasEditedSquad(club.id) ? ' · ' + T('ed.tag.squad') : ''); };
    sumTxt();
    pl.appendChild(sum);
    pl.appendChild(h('div', { class: 'row' }, UI.btn(T('ed.players.edit'), () => UI.show('editorSquad', { id: club.id }), 'primary')));
    if (!own) {
      const rs = UI.btn(T('ed.players.reset'), () => { Ed.resetRecs(club); UI.toast(T('ed.players.reset.done')); UI.show('editorClub', { id: club.id }, true); }, 'ghost');
      if (Ed.hasEditedSquad(club.id)) pl.appendChild(h('div', { class: 'row' }, rs));
    }
    grid.appendChild(pl);
    el.appendChild(grid);

    // footer actions
    const foot = h('div', { class: 'row center' });
    foot.appendChild(UI.btn('⚽ ' + T('ed.play'), () => { FCK.setup.home = club.id; if (FCK.setup.away === club.id) FCK.setup.away = club.id === 'mci' ? 'fcb' : 'mci'; FCK.setup.touched = true; FCK.saveSetup(); UI.show('setup'); }, 'primary'));
    if (!own && (Ed.isOver(club.id) || Ed.hasEditedSquad(club.id))) {
      const rb = UI.btn(T('ed.adj.reset'), () => {}, 'ghost');
      armed(rb, T('ed.adj.reset'), T('ed.reset.sure'), () => { Ed.clearOver(club); Ed.resetRecs(club); UI.toast(T('ed.reset.done')); UI.show('editorClub', { id: club.id }, true); });
      foot.appendChild(rb);
    }
    el.appendChild(foot);
    return el;
  }

  // ------------------------------------------------------------------ squad screen
  FCK.Screens.editorSquad = function (data) {
    Ed.register();
    const club = W.byId[data && data.id];
    const el = h('div', { class: 'page editor' });
    if (!club) { el.appendChild(UI.header(T('ed.title'), () => UI.back())); return el; }
    el.appendChild(UI.header(T('ed.players.title', { n: club.name }), () => UI.back()));
    let recs = Ed.getRecs(club);
    let timer = null;
    const sum = h('div', { class: 'ed-sum big' });
    const flush = () => { clearTimeout(timer); Ed.setRecs(club, recs); upd(); };
    const queue = () => { clearTimeout(timer); timer = setTimeout(flush, 350); };
    const upd = () => { sum.innerHTML = ''; sum.appendChild(UI.crestImg(club, 40)); sum.appendChild(UI.stars(Ed.rateOf(recs))); sum.appendChild(h('small', { text: T('ed.team.ovr', { n: Ed.rateOf(recs) }) })); };
    upd();
    const bar = h('div', { class: 'row' },
      UI.btn('＋1', () => { recs.forEach((r) => { r.ovr = Math.min(99, r.ovr + 1); }); flush(); draw(); }, 'ghost sm'),
      UI.btn('−1', () => { recs.forEach((r) => { r.ovr = Math.max(25, r.ovr - 1); }); flush(); draw(); }, 'ghost sm'),
      UI.btn('🎲 ' + T('ed.players.dice'), () => { const g = Ed.GROUPS.includes(club.cc) ? club.cc : 'de'; recs = Ed.genRecs(g, club.r || 60, (Math.random() * 4294967295) >>> 0); flush(); draw(); }, 'ghost sm'));
    el.appendChild(h('section', { class: 'card sect' }, sum, bar, h('p', { class: 'fine', text: T('ed.players.hint') })));
    const list = h('div', { class: 'card sect ed-list' });
    el.appendChild(list);
    const draw = () => {
      list.innerHTML = '';
      recs.forEach((r, i) => {
        const pos = UI.select(Ed.POS.map((c) => ({ v: c, l: FCK.posL(c) + (['LAM', 'RAM', 'LW', 'RW'].includes(c) ? ' · ' + c : '') })), r.pos, (v) => { r.pos = v; queue(); }, T('ed.pos'));
        const name = h('input', { type: 'text', class: 'txt', maxlength: 24, value: r.name, 'aria-label': T('ed.pname') });
        name.addEventListener('input', () => { r.name = name.value || '?'; queue(); });
        const nat = UI.select(Ed.GROUPS.map((g) => ({ v: g, l: g.toUpperCase() })), Ed.GROUPS.includes(r.nat) ? r.nat : 'de', (v) => { r.nat = v; queue(); }, T('ed.names'));
        nat.title = T('ed.names');
        const ovr = h('input', { type: 'number', class: 'txt num', min: 25, max: 99, step: 1, value: r.ovr, 'aria-label': 'OVR' });
        ovr.addEventListener('input', () => { const v = parseInt(ovr.value, 10); if (v >= 25 && v <= 99) { r.ovr = v; queue(); } });
        const row = h('div', { class: 'edrow' }, h('span', { class: 'no', text: String(i + 1) }), pos, name, nat, ovr);
        const more = h('button', { class: 'edmore', type: 'button', title: T('ed.names'), 'aria-label': T('ed.names') }, '👤');
        more.addEventListener('click', () => row.classList.toggle('open'));
        row.appendChild(more);
        list.appendChild(row);
      });
    };
    draw();
    const stop = () => flush();
    el.addEventListener('focusout', () => { clearTimeout(timer); timer = setTimeout(flush, 80); });
    el.appendChild(h('div', { class: 'row center' }, UI.btn(T('ed.done'), () => { stop(); UI.back(); }, 'primary')));
    return el;
  };
})((globalThis.FCK = globalThis.FCK || {}));
