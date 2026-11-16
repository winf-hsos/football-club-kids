/* FCK - ntcareerui.js : national team career screens (nation choice, hub with goal / confidence / history) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const NT = FCK.NTCareer;
  const Tn = FCK.Tourney;
  const T = (k, v) => FCK.T(k, v);
  FCK.Screens = FCK.Screens || {};
  const natName = (id) => Tn.natName(id);
  const flagEl = (id) => h('span', { class: 'flag', text: FCK.NATION_BY_ID[id].flag });
  const kindName = (kind) => (kind === 'cont' ? T('nt.cont.' + (NT.S ? FCK.NATION_BY_ID[NT.S.nat].conf : 'UEFA')) : T('tn.kind.' + kind));
  const placeName = (p) => (p === 'DNQ' ? T('nt.place.dnq') : p === 'W' ? T('nt.place.W') : p === 'F' ? T('tn.place.F') : p === 'T3' || p === 'T4' || p === 'B' ? T('nt.place.SF') : T('nt.place.' + p));
  const goalName = (g) => T('nt.goal.' + g);

  // ----- nation choice -----
  const draft = { nat: null, q: '', conf: 'all', coach: '' };
  FCK.Screens.ntNew = function () {
    const el = h('div', { class: 'page pro-new' });
    const confs = ['all', 'UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
    const draw = () => {
      el.innerHTML = '';
      el.appendChild(UI.header(T('nt.new'), () => UI.back()));
      const sec = UI.section(T('nt.pick'));
      sec.appendChild(h('p', { class: 'fine', text: T('nt.pick.hint', { n: FCK.NATIONS.length }) }));
      const q = h('input', { class: 'txt', type: 'search', value: draft.q, placeholder: T('nt.search') });
      q.addEventListener('input', () => { draft.q = q.value; list(); });
      sec.appendChild(h('div', { class: 'field' }, q));
      sec.appendChild(UI.chips(confs.map((c) => ({ v: c, l: c === 'all' ? T('k.f.all') : c })), draft.conf, (v) => { draft.conf = v; list(); }, 'scroll'));
      const box = h('div', { class: 'nt-list' });
      const list = () => {
        box.innerHTML = '';
        const ql = draft.q.trim().toLowerCase();
        FCK.NATIONS.filter((n) => (draft.conf === 'all' || n.conf === draft.conf) && (!ql || natName(n.id).toLowerCase().includes(ql) || n.id.toLowerCase() === ql))
          .sort((a, b) => b.r - a.r).forEach((n) => {
            const b = h('button', { class: 'pick' + (draft.nat === n.id ? ' on' : ''), type: 'button' }, UI.crestImg(Tn.nationClub(n.id), 36),
              h('div', { class: 'pk-i' }, h('b', { text: n.flag + ' ' + natName(n.id) }), h('small', { text: n.conf + ' · ' + T('nt.rank', { n: NT.rank(n.id, 'wm48') }) + ' · ' + T('k.rating') + ' ' + Math.round(n.r) })));
            b.addEventListener('click', () => { UI.sfx('click'); draft.nat = n.id; draw(); });
            box.appendChild(b);
          });
      };
      list();
      sec.appendChild(box);
      el.appendChild(sec);
      if (draft.nat) {
        const s2 = UI.section(T('nt.coach'));
        const nm = h('input', { class: 'txt', value: draft.coach, maxlength: 28, placeholder: T('nt.coach.ph') });
        nm.addEventListener('input', () => { draft.coach = nm.value; });
        s2.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('nt.coach') }), nm));
        const nxt = NT.goalFor(draft.nat, 'wm48');
        s2.appendChild(h('p', { class: 'fine', text: T('nt.first', { n: natName(draft.nat), g: goalName(nxt) }) }));
        s2.appendChild(h('div', { class: 'row center' }, UI.btn('▶ ' + T('nt.start'), () => {
          if (NT.S && !NT.S.fired && !confirm_()) return;
          NT.start({ nat: draft.nat, coach: draft.coach });
          UI.stack = ['home']; UI.show('ntHub', null, true);
        }, 'primary xl')));
        el.appendChild(s2);
      }
    };
    const confirm_ = () => true;
    draw();
    return el;
  };

  // ----- hub -----
  FCK.Screens.ntHub = function () {
    const S = NT.S || NT.load();
    if (!S) { return FCK.Screens.ntNew(); }
    // a finished tournament of this career is booked once
    if (Tn.S && Tn.S.ntc && Tn.S.done && !Tn.S.ntcDone && NT.finish(Tn.S)) { /* booked */ }
    const el = h('div', { class: 'page hub' });
    el.appendChild(h('header', { class: 'hub-head card' },
      UI.btn('‹', () => { UI.stack = []; UI.show('home', null, true); }, 'ghost round'),
      UI.crestImg(Tn.nationClub(S.nat), 52),
      h('div', { class: 'hh-t' }, h('b', { class: 'big', text: FCK.NATION_BY_ID[S.nat].flag + ' ' + natName(S.nat) }), h('div', { class: 'muted', text: T('nt.coach.of', { n: S.coach, y: S.year }) })),
      h('div', { class: 'hh-r' }, h('span', { class: 'ci', text: '🏆 ' + S.titles }), h('span', { class: 'ci ' + (S.trust < 30 ? 'bad' : ''), text: T('nt.trust') + ' ' + Math.round(S.trust) }))));
    const body = h('div', { class: 'hub-body' });
    el.appendChild(body);
    if (S.fired) {
      const sec = UI.section(T('nt.fired'));
      sec.appendChild(h('p', { text: T('nt.fired.txt', { n: natName(S.nat) }) }));
      sec.appendChild(h('div', { class: 'row center' }, UI.btn(T('nt.newnation'), () => { NT.clear(); draft.nat = null; UI.show('ntNew', null, true); }, 'primary')));
      body.appendChild(sec);
    } else {
      const nx = NT.next();
      const sec = UI.section(T('nt.next'));
      sec.appendChild(h('div', { class: 'row tight' }, h('span', { class: 'ci', text: nx.year }), h('span', { class: 'ci', text: kindName(nx.kind) }), h('span', { class: 'ci', text: T('nt.rank', { n: NT.rank(S.nat, nx.kind) }) })));
      sec.appendChild(h('p', { text: T('nt.goal', { g: goalName(nx.goal) }) }));
      sec.appendChild(h('div', { class: 'xpbar' }, h('i', { style: 'width:' + Math.round(S.trust) + '%' }), h('small', { text: T('nt.trust.bar', { n: Math.round(S.trust) }) })));
      const T0 = Tn.S && Tn.S.ntc && !Tn.S.done ? Tn.S : null;
      if (T0) {
        sec.appendChild(h('div', { class: 'row center' }, UI.btn('▶ ' + T('tn.continue'), () => { UI.stack = ['home']; UI.show('tourneyHub'); }, 'primary xl')));
      } else {
        sec.appendChild(h('div', { class: 'row center' }, UI.btn('▶ ' + T('nt.play', { k: kindName(nx.kind), y: nx.year }), () => {
          const prep = NT.prepare();
          if (prep.auto) {
            const r = prep.rec;
            UI.modal(kindName('cont') + ' ' + r.y, h('div', null, h('p', { text: T('nt.cont.res', { p: placeName(r.place), g: goalName(r.goal), c: natName(r.champ) }) }), h('div', { class: 'row center' }, UI.btn(T('ok'), () => { UI.closeModal(); UI.show('ntHub', null, true); }, 'primary'))));
            return;
          }
          if (!prep.qualified) {
            NT.skip();
            UI.modal(T('nt.dnq.t'), h('div', null, h('p', { text: T('nt.dnq.txt', { n: natName(S.nat), k: kindName(prep.kind) }) }), h('div', { class: 'row center' }, UI.btn(T('ok'), () => { UI.closeModal(); UI.show('ntHub', null, true); }, 'primary'))));
            return;
          }
          if (prep.playoff) UI.toast(T('nt.playoff'));
          Tn.install(prep.S); UI.stack = ['home'];
          UI.show('tourneyHub');
        }, 'primary xl')));
      }
      body.appendChild(sec);
    }
    const hs = UI.section(T('nt.hist'));
    if (!S.hist.length) hs.appendChild(h('p', { class: 'fine', text: T('nt.hist.none') }));
    S.hist.forEach((r) => hs.appendChild(h('div', { class: 'crow' + (r.ok ? ' mine' : '') }, h('b', { class: 'rk', text: String(r.y) }), h('div', { class: 'pk-i' }, h('b', { text: kindName(r.kind) + ' · ' + placeName(r.place) }), h('small', { text: T('nt.goal.short', { g: goalName(r.goal) }) + ' · ' + (r.ok ? '✔' : '✘') })))));
    body.appendChild(hs);
    const ac = UI.section(T('nt.manage'));
    ac.appendChild(h('div', { class: 'row' }, UI.btn(T('nt.newnation'), () => { draft.nat = null; UI.show('ntNew'); }, 'ghost'), UI.btn(T('nt.end'), () => { NT.clear(); UI.stack = []; UI.show('home', null, true); }, 'ghost')));
    body.appendChild(ac);
    return el;
  };
})((globalThis.FCK = globalThis.FCK || {}));
