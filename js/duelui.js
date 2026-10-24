/* FCK - duelui.js : duel screen (challenge a friend with a code, accept a code, enter a result code) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);
  const W = FCK.World;
  const Du = FCK.Duel;
  const LEVELS = ['rookie', 'amateur', 'pro', 'world', 'legend'];

  FCK.Screens = FCK.Screens || {};
  const DUI = FCK.DuelUI = {};
  const fmtDate = (ts) => { try { return new Date(ts).toLocaleDateString(FCK.settings.lang === 'en' ? 'en-GB' : 'de-DE', { day: '2-digit', month: '2-digit' }); } catch (e) { return ''; } };

  function copyArea(ta) {
    ta.focus(); ta.select();
    try { navigator.clipboard.writeText(ta.value).then(() => UI.toast(T('copied'))).catch(() => { try { document.execCommand('copy'); UI.toast(T('copied')); } catch (e) { /* ignore */ } }); } catch (e) { try { document.execCommand('copy'); } catch (e2) { /* ignore */ } }
  }

  // my team for a duel: the card-mode team, or any club / national team / own editor club
  function resolveSrc() {
    const D = Du.D;
    const s = D.src;
    if (s && s.kind === 'cards') { const c = Du.sourceFromCards(); if (c) return c; }
    if (s && s.kind === 'club' && W.byId[s.id]) return Du.sourceFromClub(W.byId[s.id], s.form);
    const c = Du.sourceFromCards();
    if (c) return c;
    return Du.sourceFromClub(W.byId[FCK.setup.home] || W.clubs[0]);
  }
  function chooseTeam(onPick) {
    const D = Du.D;
    const body = h('div', { class: 'duel-choose' });
    const cards = Du.sourceFromCards();
    if (cards) body.appendChild(UI.btn('🃏 ' + T('du.team.cards', { n: cards.club.name }), () => { D.src = { kind: 'cards' }; Du.save(); UI.closeModal(); onPick(); }, 'primary'));
    body.appendChild(UI.btn(T('du.team.club'), () => {
      UI.closeModal();
      FCK.clubPicker({ title: T('du.team.club'), current: D.src && D.src.id, onPick: (t) => { D.src = { kind: 'club', id: t.id, form: '4-3-3' }; Du.save(); onPick(); } });
    }, 'ghost'));
    const mine = FCK.Editor && FCK.Editor.data ? FCK.Editor.data.clubs : [];
    if (mine.length) body.appendChild(h('p', { class: 'fine', text: T('du.team.editor') }));
    body.appendChild(UI.btn(T('close'), () => UI.closeModal(), 'ghost'));
    UI.modal(T('du.team.pick'), body);
  }

  function teamRow(src) {
    const rate = Du.teamRating(src.squad);
    return h('div', { class: 'duel-team' }, UI.crestImg(src.club, 52), h('div', { class: 'mr-n' }, h('b', { class: 'big', text: src.club.name }), h('small', { text: src.form + ' · ' + T('ed.team.ovr', { n: rate }) })), UI.stars(rate));
  }

  FCK.Screens.duel = function () {
    const D = Du.load();
    FCK.World.build();
    const el = h('div', { class: 'page duel' });
    el.appendChild(UI.header(T('du.title'), () => UI.back()));
    const body = h('div', { class: 'duel-body' });
    el.appendChild(body);
    const draw = () => {
      body.innerHTML = '';
      // how it works
      body.appendChild(h('section', { class: 'card sect' }, h('h3', { text: T('du.how') }),
        h('ol', { class: 'tips' }, h('li', { text: T('du.how1') }), h('li', { text: T('du.how2') }), h('li', { text: T('du.how3') })),
        h('p', { class: 'fine', text: T('du.live') })));
      // name
      const nameIn = h('input', { type: 'text', class: 'txt', maxlength: 14, value: D.name, placeholder: T('du.name.ph'), 'aria-label': T('du.name') });
      nameIn.addEventListener('input', () => { D.name = nameIn.value.trim().slice(0, 14); Du.save(); });
      body.appendChild(UI.section(T('du.name'), nameIn));
      // challenge
      const src = resolveSrc();
      const ch = UI.section(T('du.challenge'), teamRow(src));
      ch.appendChild(h('div', { class: 'row' }, UI.btn(T('team.change'), () => chooseTeam(draw), 'ghost')));
      ch.appendChild(UI.slider(T('set.half'), 1, 6, 1, D.opt.half, (v) => { D.opt.half = v; Du.save(); }, (v) => v + ' min'));
      ch.appendChild(UI.toggle(T('set.knockout'), D.opt.ko, (v) => { D.opt.ko = v; Du.save(); }));
      ch.appendChild(h('div', { class: 'row' }, UI.btn('✉ ' + T('du.make'), () => makeDialog(src), 'primary')));
      body.appendChild(ch);
      // paste a code
      const ta = h('textarea', { class: 'code', rows: 4, placeholder: 'FCKD1:…', 'aria-label': T('du.paste') });
      const sec = UI.section(T('du.paste'), h('p', { class: 'fine', text: T('du.paste.hint') }), ta);
      sec.appendChild(h('div', { class: 'row' }, UI.btn(T('du.paste.go'), () => {
        const o = Du.parse(ta.value);
        if (!o) { UI.toast(T('du.bad')); return; }
        if (o.t === 'C') { if (!Du.validTeam(o.team)) { UI.toast(T('du.bad')); return; } acceptDialog(o); } else {
          const r = Du.enterResult(o);
          if (!r.ok) { UI.toast(T('du.err.' + r.err)); return; }
          ta.value = ''; UI.toast(T('du.result.in', { a: r.entry.gf, b: r.entry.ga, n: r.entry.opp })); draw();
        }
      }, 'primary')));
      body.appendChild(sec);
      // open challenges
      const open = Object.keys(D.open).map((k) => D.open[k]).sort((a, b) => b.ts - a.ts);
      if (open.length) {
        const os = UI.section(T('du.open'), h('p', { class: 'fine', text: T('du.open.hint') }));
        open.forEach((o) => {
          const fake = { id: 'x' + o.id, name: o.team, short: o.short, colors: o.colors, crest: o.crest, kit: o.kit };
          const del = UI.btn('✕', () => { delete D.open[o.id]; Du.save(); draw(); }, 'ghost sm');
          os.appendChild(h('div', { class: 'crow' }, UI.crestImg(fake, 36), h('div', { class: 'mr-n' }, h('b', { text: o.team }), h('small', { text: fmtDate(o.ts) + ' · ' + T('ed.team.ovr', { n: o.r }) })), del));
        });
        body.appendChild(os);
      }
      // balance & history
      const bal = Du.balance();
      if (bal.length) {
        const bs = UI.section(T('du.balance'));
        const tb = h('table', { class: 'ptable' });
        tb.appendChild(h('thead', null, h('tr', null, h('th', { text: T('du.friend') }), h('th', { text: 'W' }), h('th', { text: 'D' }), h('th', { text: 'L' }), h('th', { text: T('du.goals') }))));
        const tbody = h('tbody');
        bal.forEach((r) => tbody.appendChild(h('tr', null, h('td', null, h('b', { text: r.name })), h('td', { text: String(r.w) }), h('td', { text: String(r.d) }), h('td', { text: String(r.l) }), h('td', { text: r.gf + ':' + r.ga }))));
        tb.appendChild(tbody); bs.appendChild(h('div', { class: 'scrollx' }, tb));
        body.appendChild(bs);
        const hs = UI.section(T('du.history'));
        D.hist.slice(0, 15).forEach((e) => {
          const o = Du.outcome(e);
          const row = h('div', { class: 'crow duel-h res' + o }, h('b', { class: 'rk', text: o }), h('div', { class: 'mr-n' }, h('b', { text: e.tm + ' ' + e.gf + ':' + e.ga + ' ' + e.ot + (e.pens ? ' (' + e.pens[0] + ':' + e.pens[1] + ')' : '') }),
            h('small', { text: fmtDate(e.ts) + ' · ' + (e.role === 'A' ? T('du.role.A', { n: e.opp }) : T('du.role.C', { n: e.opp })) })));
          if (e.code) row.appendChild(UI.btn('✉', () => showCode(T('du.result.code'), e.code, T('du.result.send', { n: e.opp })), 'ghost sm'));
          hs.appendChild(row);
        });
        const clr = UI.btn(T('du.clear'), () => {}, 'ghost');
        let a = false;
        clr.addEventListener('click', () => { if (!a) { a = true; clr.textContent = T('du.clear.sure'); clr.classList.add('danger'); setTimeout(() => { a = false; clr.textContent = T('du.clear'); clr.classList.remove('danger'); }, 3500); return; } D.hist = []; D.rids = {}; Du.save(); draw(); }, true);
        hs.appendChild(h('div', { class: 'row' }, clr));
        body.appendChild(hs);
      }
    };
    draw();
    return el;
  };

  function showCode(title, code, hint) {
    const ta = h('textarea', { class: 'code', readonly: true, rows: 6 }); ta.value = code;
    UI.modal(title, h('div', null, h('p', { class: 'fine', text: hint }), ta, h('div', { class: 'row' }, UI.btn(T('copy'), () => copyArea(ta), 'primary'), UI.btn(T('close'), () => UI.closeModal(), 'ghost'))));
    setTimeout(() => { try { ta.select(); } catch (e) { /* ignore */ } }, 60);
  }

  function makeDialog(src) {
    const D = Du.D;
    if (!D.name) { UI.toast(T('du.name.need')); return; }
    const r = Du.makeChallenge(src, { half: D.opt.half, ko: D.opt.ko });
    showCode(T('du.code.title'), r.code, T('du.code.hint', { n: D.opt.half }));
  }

  function acceptDialog(ch) {
    const D = Du.D;
    const theirs = Du.unpackTeam(ch.team, ch.id);
    const state = { level: D.opt.level, preset: D.opt.preset === 'p2co' ? 'p2co' : 'p1' };
    const box = h('div', { class: 'duel-accept' });
    const draw = () => {
      box.innerHTML = '';
      const mine = resolveSrc();
      box.appendChild(h('div', { class: 'tn-vs' },
        h('div', { class: 'side' }, UI.crestImg(mine.club, 64), h('b', { text: mine.club.name }), UI.stars(Du.teamRating(mine.squad))),
        h('div', { class: 'vs' }, h('b', { text: 'VS' })),
        h('div', { class: 'side' }, UI.crestImg(theirs.club, 64), h('b', { text: theirs.club.name }), UI.stars(Du.teamRating(theirs.squad)))));
      box.appendChild(h('p', { class: 'fine center', text: T('du.from', { n: ch.from }) + ' · ' + T('set.half') + ' ' + ch.set.h + ' min · ' + T('weather.' + ch.set.wx) + ' · ' + T('tod.' + ch.set.td) + (ch.set.k ? ' · ' + T('du.decisive') : '') }));
      box.appendChild(h('div', { class: 'row center' }, UI.btn(T('du.team.mine'), () => chooseTeam(() => acceptDialog(ch)), 'ghost')));
      box.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('k.level') }), UI.chips(LEVELS.map((k) => ({ v: k, l: T('level.' + k) })), state.level, (v) => { state.level = v; D.opt.level = v; Du.save(); }, 'scroll')));
      box.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.players') }), UI.chips(['p1', 'p2co'].map((k) => ({ v: k, l: T('k.pre.' + k) })), state.preset, (v) => { state.preset = v; D.opt.preset = v; Du.save(); }, 'scroll')));
      box.appendChild(FCK.PadNav.controlLine(() => state.preset));
      box.appendChild(h('div', { class: 'row center' }, UI.btn('▶ ' + T('du.kickoff'), () => {
        if (!D.name) { UI.toast(T('du.name.need')); return; }
        UI.closeModal();
        FCK.Audio.init();
        FCK.startMatch(Du.acceptConfig(ch, resolveSrc(), state));
      }, 'primary xl'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')));
    };
    draw();
    UI.modal(T('du.accept'), box, { cls: 'wide' });
  }

  // ------------------------------------------------------------------ result box inside the match result screen
  DUI.resultBox = function (m) {
    const ctx = m.duelCtx, D = Du.D;
    if (!ctx || !D || !D.last) return null;
    const entry = D.hist.find((e) => e.rid === ctx.rid);
    const box = h('section', { class: 'card sect cres' }, h('h3', { text: T('du.title') + ' · ' + T('du.vs', { n: ctx.from }) }));
    if (entry) box.appendChild(h('div', { class: 'row' }, h('b', { class: 'big', text: T('du.out.' + Du.outcome(entry)) })));
    box.appendChild(h('p', { class: 'fine', text: T('du.result.send', { n: ctx.from }) }));
    const ta = h('textarea', { class: 'code', readonly: true, rows: 4 }); ta.value = D.last.code;
    box.appendChild(ta);
    box.appendChild(h('div', { class: 'row' }, UI.btn(T('copy'), () => copyArea(ta), 'primary')));
    return box;
  };
})((globalThis.FCK = globalThis.FCK || {}));
