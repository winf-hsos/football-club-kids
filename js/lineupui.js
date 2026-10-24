/* FCK - lineupui.js : FIFA-style lineup view (pitch with player chips) + a reusable lineup editor dialog */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);
  const LU = FCK.Lineup = {};

  function textOn(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return '#fff';
    const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b1020' : '#fff';
  }
  const tier = (o) => (o >= 82 ? 'elite' : o >= 74 ? 'gold' : o >= 64 ? 'silver' : 'bronze');
  const lastName = (p) => {
    if (p.sname) return p.sname;
    const parts = String(p.name || p.n || '?').trim().split(/\s+/);
    return parts[parts.length - 1];
  };
  // how well does a player fit a slot: 0 = natural, 1 = same line, 2 = off position
  LU.fit = function (p, slotPos) {
    const nat = p.pos0 || p.pos;
    if (nat === slotPos) return 0;
    if (FCK.ROLE_OF[nat] === FCK.ROLE_OF[slotPos]) {
      // wide <-> central inside the same line is a small penalty, still "same line"
      return 1;
    }
    return 2;
  };

  /*
   * pitch({ formation, color, slots:[player|null x11], sel:index|null, onSlot(i), showFit, extra(player,i) })
   * player: { num, name|sname, ovr, pos|pos0, stam?, yellow?, limp?, red? }
   */
  LU.pitch = function (o) {
    const form = FCK.FORMATIONS[o.formation] || FCK.FORMATIONS['4-3-3'];
    const wrap = h('div', { class: 'lp-pitch' + (o.small ? ' small' : '') });
    const color = o.color || '#2ee6a6';
    const ink = textOn(color);
    form.forEach((sl, i) => {
      const p = o.slots[i] || null;
      const top = 92 - sl.fx * 105, left = 6 + sl.fy * 88;
      const cls = 'lp-chip' + (o.sel === i ? ' sel' : '') + (p ? '' : ' empty') + (p && o.showFit ? ' fit' + LU.fit(p, sl.pos) : '') + (p && p.red ? ' red' : '');
      const b = h('button', { class: cls, type: 'button', style: { left: left + '%', top: top + '%' }, title: p ? (p.name || p.n) + ' · ' + FCK.posL(sl.pos) : FCK.posL(sl.pos) });
      if (p) {
        // overall rating instead of the shirt number (lineup editors); in the match menu the number stays
        if (o.showOvr) b.appendChild(h('span', { class: 'lp-c lp-ovr ' + tier(p.ovr), style: { background: color, color: ink } }, h('b', { text: String(Math.round(p.ovr)) })));
        else {
          b.appendChild(h('span', { class: 'lp-c', style: { background: color, color: ink } }, h('b', { text: String(p.num != null ? p.num : '') })));
          b.appendChild(h('i', { class: 'lp-o ' + tier(p.ovr), text: String(Math.round(p.ovr)) }));
        }
        b.appendChild(h('span', { class: 'lp-n', text: lastName(p) }));
        b.appendChild(h('small', { class: 'lp-p', text: FCK.posL(sl.pos) }));
        if (p.stam != null) b.appendChild(h('i', { class: 'lp-s' }, h('u', { style: { width: Math.round(U.clamp(p.stam, 0, 1) * 100) + '%' } })));
        if (p.yellow) b.appendChild(h('span', { class: 'lp-card ycard' }));
        if (p.limp) b.appendChild(h('span', { class: 'lp-flag', text: '🩹' }));
        if (o.extra) { const x = o.extra(p, i); if (x) b.appendChild(x); }
      } else {
        b.appendChild(h('span', { class: 'lp-c' }, h('b', { text: '+' })));
        b.appendChild(h('small', { class: 'lp-p', text: FCK.posL(sl.pos) }));
      }
      if (o.onSlot) b.addEventListener('click', () => o.onSlot(i)); else b.tabIndex = -1;
      wrap.appendChild(b);
    });
    return wrap;
  };

  // one bench / pool row
  LU.row = function (p, o) {
    o = o || {};
    const b = h('button', { class: 'prow lp-row' + (o.on ? ' on' : '') + (o.queued ? ' queued' : ''), type: 'button' },
      h('span', { class: 'pos', text: FCK.posL(p.pos0 || p.pos) }), h('b', { text: (p.num != null && !o.showOvr ? p.num + ' ' : '') + lastName(p) }), h('span', { class: 'ovr', text: String(Math.round(p.ovr)) }),
      o.extra || null);
    if (o.onClick) b.addEventListener('click', o.onClick);
    return b;
  };

  /*
   * edit({ title, formation, color, pool:[players with sqi], ids:[11 sqi]|null, onSave(ids), onReset?, pick(pool, formation, ids) -> {lineup,bench}|null })
   * click a pitch spot, then another spot (swap) or a bench player (replace)
   */
  LU.edit = function (o) {
    const pool = o.pool;
    const byId = new Map(pool.map((p) => [p.sqi, p]));
    const auto = FCK.pickSquad(pool, o.formation, null, 0);
    let ids = o.ids && o.pick(pool, o.formation, o.ids) ? o.ids.slice() : auto.lineup.map((p) => p.sqi);
    let selSlot = null, selBench = null;
    const wrap = h('div', { class: 'lp-edit' });
    const info = h('p', { class: 'fine center' });
    const draw = () => {
      wrap.innerHTML = '';
      const form = FCK.FORMATIONS[o.formation];
      const slots = ids.map((id, i) => byId.get(id) || null);
      const used = new Set(ids);
      const bench = pool.filter((p) => !used.has(p.sqi)).sort((a, b) => b.ovr - a.ovr);
      const pk = o.pick(pool, o.formation, ids);
      const avg = slots.every(Boolean) ? slots.reduce((a, p) => a + p.ovr, 0) / 11 : 0;
      info.textContent = T('lu.hint') + (avg ? ' · ' + T('lu.avg', { v: avg.toFixed(1) }) : '');
      const left = h('div', { class: 'lp-col' }, LU.pitch({
        formation: o.formation, color: o.color, slots, sel: selSlot, showFit: true, showOvr: true,
        onSlot: (i) => {
          UI.sfx('tick');
          if (selBench != null) { const old = ids[i]; ids[i] = selBench; selBench = null; if (!o.pick(pool, o.formation, ids)) { ids[i] = old; UI.toast(T('m.lineup.bad')); } draw(); return; }
          if (selSlot == null) { selSlot = i; draw(); return; }
          if (selSlot === i) { selSlot = null; draw(); return; }
          const j = selSlot; const t = ids[i]; ids[i] = ids[j]; ids[j] = t; selSlot = null;
          if (!o.pick(pool, o.formation, ids)) { const t2 = ids[i]; ids[i] = ids[j]; ids[j] = t2; UI.toast(T('m.lineup.bad')); }
          draw();
        },
      }), info);
      const right = h('div', { class: 'lp-col bench' }, h('h5', { text: T('subs.bench') }));
      bench.forEach((p) => {
        right.appendChild(LU.row(p, { showOvr: true,
          on: selBench === p.sqi,
          onClick: () => {
            UI.sfx('tick');
            if (selSlot != null) { const old = ids[selSlot]; ids[selSlot] = p.sqi; if (!o.pick(pool, o.formation, ids)) { ids[selSlot] = old; UI.toast(T('m.lineup.bad')); } selSlot = null; selBench = null; draw(); return; }
            selBench = selBench === p.sqi ? null : p.sqi; draw();
          },
        }));
      });
      wrap.appendChild(h('div', { class: 'lp-grid' }, left, right));
      wrap.appendChild(h('div', { class: 'row center' },
        UI.btn(T('ok'), () => { if (!pk) { UI.toast(T('m.lineup.bad')); return; } o.onSave(ids.slice()); }, 'primary'),
        o.onReset ? UI.btn(T('m.lineup.reset'), () => o.onReset(), 'ghost') : null,
        UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')));
    };
    draw();
    UI.modal(o.title, wrap, { cls: 'wide', sticky: true });
  };
})((globalThis.FCK = globalThis.FCK || {}));
