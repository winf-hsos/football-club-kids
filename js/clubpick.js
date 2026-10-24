/* FCK - clubpick.js : EA-FC-style club selector. Country on top, club in the middle, league at the bottom - always one at a time, with arrows.
   FCK.ClubSelector(opts) is the widget (used inline on the match setup, home and away side by side); FCK.clubPicker(opts) opens it in a dialog. */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const W = FCK.World;
  const T = (k, v) => FCK.T(k, v);

  const cname = (cc) => (cc === 'x' ? T('cpk.other') : W.countryName(cc));
  const flagOf = (cc) => (cc === 'x' ? '🌐' : W.byCc[cc] ? W.byCc[cc].flag : '');
  const stars = (r) => { const n = U.clamp(Math.round((r - 40) / 6) / 2, 0.5, 5); return '★'.repeat(Math.floor(n)) + (n % 1 ? '⯨' : ''); };
  const lgLabel = (g) => g.lname + (g.gname ? ' · ' + g.gname : '');

  // ---------------------------------------------------------------- the selector widget
  // opts: pool (array of teams), current (id), compact, onChange(team), onActivate(team)
  function ClubSelector(opts) {
    const pool = opts.pool;
    const byC = {};
    pool.forEach((t) => { (byC[t.country] = byC[t.country] || []).push(t); });
    const nations = W.countries.filter((c) => byC[c.cc]).sort((a, b) => (b.strength || 0) - (a.strength || 0) || a.nameEn.localeCompare(b.nameEn)).map((c) => c.cc);
    if (byC.x) nations.push('x');
    const leaguesOf = (cc) => {
      const m = new Map();
      (byC[cc] || []).forEach((t) => {
        const key = t.gid !== undefined ? 'g' + t.gid : 'l' + (t.lname || t.league || '');
        if (!m.has(key)) m.set(key, { key, tier: t.tier || 9, order: t.gid !== undefined ? t.gid : 1e6, label: t.gid !== undefined ? lgLabel(W.groups[t.gid]) : (t.lname || t.league || '–'), clubs: [] });
        m.get(key).clubs.push(t);
      });
      const arr = Array.from(m.values()).sort((a, b) => a.tier - b.tier || a.order - b.order);
      arr.forEach((l) => l.clubs.sort((a, b) => b.r - a.r || a.name.localeCompare(b.name)));
      return arr;
    };
    const cache = {};
    const lg = (cc) => cache[cc] || (cache[cc] = leaguesOf(cc));

    let ni = 0, li = 0, ci = 0;
    const cur = () => lg(nations[ni])[li].clubs[ci];
    const root = h('div', { class: 'cps' + (opts.compact ? ' compact' : '') });
    const arrow = (dir, fn, label) => { const b = h('button', { class: 'cps-ar', type: 'button', 'aria-label': label, text: dir < 0 ? '◀' : '▶' }); b.addEventListener('click', (e) => { e.stopPropagation(); UI.sfx('tick'); fn(dir); }); return b; };
    const cLabel = h('div', { class: 'cps-lab' });
    const clubBox = h('button', { class: 'cps-club', type: 'button' });
    const lLabel = h('div', { class: 'cps-lab' });
    const swipe = (el, fn) => {
      let x0 = null;
      el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
      el.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 45) { fn(e.clientX < x0 ? 1 : -1); el.dataset.sw = '1'; setTimeout(() => { delete el.dataset.sw; }, 60); } x0 = null; });
      el.addEventListener('pointercancel', () => { x0 = null; });
    };

    const stepC = (d) => { ni = (ni + d + nations.length) % nations.length; li = 0; ci = 0; draw(true); };
    const stepL = (d) => { const n = lg(nations[ni]).length; li = (li + d + n) % n; ci = 0; draw(true); };
    const stepT = (d) => { const n = lg(nations[ni])[li].clubs.length; ci = (ci + d + n) % n; draw(true); };

    root.appendChild(h('div', { class: 'cps-row cps-c', 'data-k': 'country' }, arrow(-1, stepC, T('cpk.country')), cLabel, arrow(1, stepC, T('cpk.country'))));
    root.appendChild(h('div', { class: 'cps-row cps-t', 'data-k': 'club' }, arrow(-1, stepT, T('cpk.club')), clubBox, arrow(1, stepT, T('cpk.club'))));
    root.appendChild(h('div', { class: 'cps-row cps-l', 'data-k': 'league' }, arrow(-1, stepL, T('cpk.league')), lLabel, arrow(1, stepL, T('cpk.league'))));
    swipe(clubBox, stepT);
    clubBox.addEventListener('click', () => { if (clubBox.dataset.sw) return; if (opts.onActivate) opts.onActivate(cur()); });

    function draw(changed) {
      const cc = nations[ni], L = lg(cc), l = L[li], t = l.clubs[ci];
      cLabel.innerHTML = '';
      cLabel.appendChild(h('span', { class: 'cps-flag', text: flagOf(cc) }));
      cLabel.appendChild(h('b', { text: cname(cc) }));
      cLabel.appendChild(h('small', { text: (ni + 1) + ' / ' + nations.length }));
      clubBox.innerHTML = '';
      clubBox.classList.toggle('pop', !!changed);
      clubBox.appendChild(UI.crestImg(t, opts.compact ? 88 : 132, 'cps-crest'));
      clubBox.appendChild(h('b', { class: 'cps-name', text: t.name }));
      clubBox.appendChild(h('span', { class: 'cps-meta' }, h('span', { class: 'stars', text: stars(t.rating) }), h('span', { class: 'cps-ovr', text: String(Math.round(t.rating)) })));
      clubBox.appendChild(h('small', { class: 'cps-cnt', text: (ci + 1) + ' / ' + l.clubs.length }));
      lLabel.innerHTML = '';
      lLabel.appendChild(h('b', { text: l.label }));
      lLabel.appendChild(h('small', { text: (L.length > 1 ? (li + 1) + ' / ' + L.length : '') }));
      if (changed && opts.onChange) opts.onChange(t);
    }
    function set(team) {
      for (let a = 0; a < nations.length; a++) {
        const L = lg(nations[a]);
        for (let b = 0; b < L.length; b++) { const k = L[b].clubs.indexOf(team); if (k >= 0) { ni = a; li = b; ci = k; draw(false); return true; } }
      }
      return false;
    }
    const start = pool.find((t) => t.id === opts.current);
    if (!start || !set(start)) { ni = 0; li = 0; ci = 0; draw(false); }
    return { el: root, get: cur, set: (t) => { if (set(t) && opts.onChange) opts.onChange(t); } };
  }
  FCK.ClubSelector = ClubSelector;

  // ---------------------------------------------------------------- dialog
  const statCache = {};
  function statsOf(t) {
    if (statCache[t.id]) return statCache[t.id];
    let sq = [];
    try { sq = FCK.makeFullSquad(t, W.hash(t.id)); } catch (e) { sq = []; }
    const avg = (role, n) => { const v = sq.filter((p) => p.role === role).map((p) => p.ovr).sort((a, b) => b - a).slice(0, n); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : Math.round(t.rating); };
    return (statCache[t.id] = { att: avg('FW', 3), mid: avg('MF', 4), def: avg('DF', 4), gk: avg('GK', 1) });
  }

  function clubPicker(opts) {
    W.build();
    const pool = opts.career ? W.clubs : FCK.TEAMS;
    let q = '', picked = null;
    const confirm = () => { const t = q ? null : sel.get(); if (!t) return; UI.sfx('ok'); UI.closeModal(); opts.onPick(t); };
    const search = h('input', { type: 'search', class: 'txt', placeholder: T('team.search'), 'aria-label': T('team.search') });
    const sel = ClubSelector({ pool, current: opts.current, onActivate: confirm, onChange: (t) => { picked = t; drawStats(); } });
    const info = h('div', { class: 'fine cpk-info' });
    const grid = h('div', { class: 'cpk-grid picker-grid' });
    const stat = h('div', { class: 'cpk-stats' });
    const view = h('div', { class: 'cpk-view' });
    function drawStats() {
      const t = sel.get(); stat.innerHTML = '';
      const st = statsOf(t);
      const bar = (lab, v) => h('div', { class: 'cpk-bar' }, h('span', { text: lab }), h('div', { class: 'bar' }, h('i', { style: { width: U.clamp(v, 0, 100) + '%' } })), h('b', { text: v }));
      stat.appendChild(bar(T('cpk.att'), st.att)); stat.appendChild(bar(T('cpk.mid'), st.mid)); stat.appendChild(bar(T('cpk.def'), st.def)); stat.appendChild(bar(T('cpk.gk'), st.gk));
      stat.appendChild(h('p', { class: 'fine pv-st', text: '🏟 ' + (t.stadium || '–') + (t.cap ? ' · ' + t.cap.toLocaleString(FCK.settings && FCK.settings.lang === 'en' ? 'en-GB' : 'de-DE') : '') }));
    }
    function fillResults() {
      grid.innerHTML = '';
      const list = pool.filter((t) => (t.name + ' ' + t.short + ' ' + (t.lname || '') + ' ' + (t.league || '') + ' ' + (t.stadium || '')).toLowerCase().includes(q)).sort((a, b) => b.r - a.r);
      info.textContent = T('c.found', { n: list.length }) + (list.length > 60 ? ' · ' + T('c.refine') : '');
      list.slice(0, 60).forEach((t) => {
        const b = h('button', { class: 'pick' + (t.id === opts.other ? ' dim' : ''), type: 'button' },
          UI.crestImg(t, 40), h('div', { class: 'pk-i' }, h('b', { text: t.name }), h('small', { text: (t.world ? (W.byCc[t.country] ? W.byCc[t.country].flag + ' ' : '') : '') + (t.lname || t.league) + (t.tier ? ' · ' + t.tier : '') })), h('span', { class: 'ovr', text: Math.round(t.rating) }));
        b.addEventListener('click', () => { UI.sfx('ok'); UI.closeModal(); opts.onPick(t); });
        grid.appendChild(b);
      });
    }
    function layout() {
      view.innerHTML = '';
      if (q) { view.appendChild(info); view.appendChild(grid); fillResults(); } else { view.appendChild(sel.el); view.appendChild(stat); drawStats(); }
      okRow.style.display = q ? 'none' : '';
    }
    const okRow = h('div', { class: 'row cpk-actions' }, UI.btn('🎲 ' + T('team.random'), () => { const t = pool[Math.floor(Math.random() * pool.length)]; sel.set(t); }, 'ghost'), UI.btn(T('cpk.ok'), confirm, 'primary pk-ok'));
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); layout(); });
    layout();
    UI.modal(opts.title || T('team.pick'), h('div', { class: 'cpk' }, search, view, okRow, h('div', { class: 'row' }, UI.btn(T('close'), () => UI.closeModal(), 'ghost'))), { cls: 'club' });
    if (!FCK.isTouchDevice || !FCK.isTouchDevice()) setTimeout(() => { try { search.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
  }
  FCK.clubPicker = clubPicker;
})((globalThis.FCK = globalThis.FCK || {}));
