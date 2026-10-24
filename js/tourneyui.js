/* FCK - tourneyui.js : screens for the World Cup / Euro tournaments */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);
  const W = FCK.World;
  const Tn = FCK.Tourney;
  const LEVELS = ['rookie', 'amateur', 'pro', 'world', 'legend'];

  FCK.Screens = FCK.Screens || {};
  const ST = { tab: 'home', grp: 'all' };
  const cupOf = (S) => Tn.FORMATS[S.kind].cup;

  function armed(btn, label, sure, fn) {
    let a = false;
    btn.addEventListener('click', () => {
      if (!a) { a = true; btn.textContent = sure; btn.classList.add('danger'); setTimeout(() => { a = false; btn.textContent = label; btn.classList.remove('danger'); }, 3500); return; }
      a = false; fn();
    }, true);
    return btn;
  }
  const flag = (nid) => h('span', { class: 'flag', text: Tn.nat(nid).flag });
  const nm = (nid) => Tn.natName(nid);
  const roundLabel = (S, R) => R.type === 'group' ? T('tn.md', { n: R.n }) : T('tn.ko.' + R.key);
  const fxLabel = (S, R, f) => f.bronze ? T('tn.ko.B') : R.type === 'group' ? T('tn.group', { g: Tn.letter(f.g) }) + ' · ' + T('tn.md', { n: R.n }) : T('tn.ko.' + R.key);
  const placeLabel = (S, id) => {
    const o = S.out[id];
    if (o === 'W') return T('tn.place.W.' + cupOf(S));
    return o ? T('tn.place.' + o) : T('tn.place.in');
  };
  FCK.TourneyUI = { placeLabel, roundLabel };

  // ------------------------------------------------------------------ nation picker
  function nationPicker(opts) {
    let q = '', conf = 'all';
    const list = h('div', { class: 'picker-grid' });
    const search = h('input', { type: 'search', class: 'txt', placeholder: T('team.search'), 'aria-label': T('team.search') });
    const fill = () => {
      list.innerHTML = '';
      FCK.NATIONS.slice().sort((a, b) => Tn.strength(b.id) - Tn.strength(a.id)).forEach((n) => {
        if (conf !== 'all' && n.conf !== conf) return;
        if (q && !(n.de + ' ' + n.en + ' ' + n.id).toLowerCase().includes(q)) return;
        const c = Tn.nationClub(n.id);
        const b = h('button', { class: 'pick' + (n.id === opts.current ? ' on' : ''), type: 'button' }, UI.crestImg(c, 40),
          h('div', { class: 'pk-i' }, h('b', { text: n.flag + ' ' + Tn.natName(n.id) }), h('small', { text: n.conf + ' · ' + n.id })), UI.stars(c.rating));
        b.addEventListener('click', () => { UI.sfx('ok'); UI.closeModal(); opts.onPick(n.id); });
        list.appendChild(b);
      });
    };
    search.addEventListener('input', () => { q = search.value.trim().toLowerCase(); fill(); });
    fill();
    UI.modal(T('tn.pick'), h('div', { class: 'picker' }, UI.chips([{ v: 'all', l: T('all') }].concat(['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'].map((c) => ({ v: c, l: c }))), conf, (v) => { conf = v; fill(); }, 'scroll'), search, list,
      h('div', { class: 'row' }, UI.btn(T('team.random'), () => { UI.closeModal(); opts.onPick(FCK.NATIONS[Math.floor(Math.random() * FCK.NATIONS.length)].id); }, 'ghost'), UI.btn(T('close'), () => UI.closeModal(), 'ghost'))), { cls: 'wide' });
    setTimeout(() => { try { search.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
  }

  // ------------------------------------------------------------------ menu
  FCK.Screens.tourney = function () {
    Tn.refreshNames();
    Tn.load();
    const el = h('div', { class: 'page tourney' });
    el.appendChild(UI.header(T('tn.title'), () => UI.back()));
    const opt = { kind: 'wm48', me: 'GER', half: Math.min(FCK.setup.match.halfMins || 3, 6), level: FCK.setup.match.level || 'pro', preset: 'p1' };
    if (!LEVELS.includes(opt.level)) opt.level = 'pro';
    const body = h('div', { class: 'tn-menu' });
    el.appendChild(body);
    const draw = () => {
      body.innerHTML = '';
      const S = Tn.S;
      if (S) {
        const pct = Math.round((Tn.matchCount(S) / Tn.totalMatches(S)) * 100);
        const sec = UI.section(T('tn.running'));
        sec.appendChild(h('div', { class: 'tn-run' }, S.me ? UI.crestImg(Tn.nationClub(S.me), 56) : h('span', { class: 'big', text: '👁' }),
          h('div', null, h('b', { class: 'big', text: T('tn.kind.' + S.kind) }), h('div', { text: S.me ? flagName(S.me) : T('tn.spectator') }),
            h('small', { text: S.done ? T('tn.finished') : roundLabel(S, S.rounds[S.ri]) }))));
        sec.appendChild(h('div', { class: 'tnbar' }, h('i', { style: { width: pct + '%' } })));
        const rm = UI.btn(T('tn.discard'), () => {}, 'ghost');
        armed(rm, T('tn.discard'), T('tn.discard.sure'), () => { Tn.clear(); draw(); });
        sec.appendChild(h('div', { class: 'row' }, UI.btn('▶ ' + T('tn.continue'), () => { ST.tab = 'home'; UI.show('tourneyHub'); }, 'primary xl'), rm));
        body.appendChild(sec);
      }
      // new tournament
      const nw = UI.section(S ? T('tn.new.replace') : T('tn.new'));
      nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('tn.format') }), UI.chips(Tn.KIND_KEYS.map((k) => ({ v: k, l: T('tn.kind.' + k) })), opt.kind, (v) => { opt.kind = v; kindHint.textContent = T('tn.kind.' + v + '.d'); }, 'scroll')));
      const kindHint = h('p', { class: 'fine', text: T('tn.kind.' + opt.kind + '.d') });
      nw.appendChild(kindHint);
      const teamBtn = h('div', { class: 'row tn-team' });
      const drawTeam = () => {
        teamBtn.innerHTML = '';
        teamBtn.appendChild(opt.me ? UI.crestImg(Tn.nationClub(opt.me), 44) : h('span', { class: 'big', text: '👁' }));
        teamBtn.appendChild(h('b', { text: opt.me ? flagName(opt.me) : T('tn.spectator') }));
        teamBtn.appendChild(UI.btn(T('team.change'), () => nationPicker({ current: opt.me, onPick: (id) => { opt.me = id; drawTeam(); } }), 'ghost'));
        teamBtn.appendChild(UI.btn(opt.me ? T('tn.watch') : T('tn.play'), () => { opt.me = opt.me ? null : 'GER'; drawTeam(); }, 'ghost'));
      };
      drawTeam();
      nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('tn.team') }), teamBtn));
      nw.appendChild(UI.slider(T('set.half'), 1, 10, 1, opt.half, (v) => { opt.half = v; }, (v) => v + ' min'));
      nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('k.level') }), UI.chips(LEVELS.map((k) => ({ v: k, l: T('level.' + k) })), opt.level, (v) => { opt.level = v; }, 'scroll')));
      nw.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.players') }), UI.chips(['p1', 'p2co', 'cpu'].map((k) => ({ v: k, l: T('k.pre.' + k) })), opt.preset, (v) => { opt.preset = v; }, 'scroll')));
      nw.appendChild(FCK.PadNav.controlLine(() => opt.preset));
      const go = () => {
        const S2 = Tn.create({ kind: opt.kind, me: opt.me, half: opt.half, level: opt.level, preset: opt.me ? opt.preset : 'cpu', form: FCK.setup.match.homeFormation, style: FCK.setup.match.homeStyle });
        Tn.install(S2); ST.tab = 'home'; ST.grp = 'all';
        UI.show('tourneyHub');
      };
      const start = UI.btn('▶ ' + T('tn.start'), () => {
        if (Tn.S && !Tn.S.done) { UI.modal(T('tn.new.replace'), h('div', null, h('p', { text: T('tn.replace.hint') }), h('div', { class: 'row' }, UI.btn(T('tn.start'), () => { UI.closeModal(); go(); }, 'primary'), UI.btn(T('cancel'), () => UI.closeModal(), 'ghost')))); return; }
        go();
      }, 'primary xl');
      nw.appendChild(h('div', { class: 'row' }, start));
      nw.appendChild(h('p', { class: 'fine', text: T('tn.note') }));
      body.appendChild(nw);
      // history
      const hist = Tn.history();
      if (hist.length) {
        const hs = UI.section(T('tn.history'));
        hist.slice(0, 8).forEach((x) => {
          hs.appendChild(h('div', { class: 'crow' }, h('span', { class: 'flag big', text: x.champ ? Tn.nat(x.champ).flag : '' }),
            h('div', { class: 'mr-n' }, h('b', { text: T('tn.kind.' + x.kind) + ' · ' + T('tn.champion') + ': ' + (x.champ ? nm(x.champ) : '–') }),
              h('small', { text: x.me ? flagName(x.me) + ': ' + (x.place === 'W' ? T('tn.place.W.' + Tn.FORMATS[x.kind].cup) : T('tn.place.' + (x.place || 'G'))) : T('tn.spectator') }))));
        });
        body.appendChild(hs);
      }
      // import / export
      const ex = UI.section(T('tn.data'));
      const ta = h('textarea', { class: 'code', rows: 3, placeholder: 'FCKT1:…' });
      ex.appendChild(h('div', { class: 'row' },
        UI.btn(T('tn.export'), () => { if (!Tn.S) { UI.toast(T('tn.none')); return; } ta.value = Tn.exportText(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => UI.toast(T('copied'))).catch(() => {}); } catch (e) { /* ignore */ } }, 'ghost'),
        UI.btn(T('tn.import'), () => { if (Tn.importText(ta.value)) { UI.toast(T('tn.import.ok')); ta.value = ''; draw(); } else UI.toast(T('tn.import.bad')); }, 'ghost')));
      ex.appendChild(ta);
      body.appendChild(ex);
    };
    draw();
    return el;
  };
  function flagName(nid) { return Tn.nat(nid).flag + ' ' + nm(nid); }

  // ------------------------------------------------------------------ hub
  function scoreText(f) {
    if (!f.done) return '– : –';
    return f.ga + ' : ' + f.gb;
  }
  function fxNote(f) {
    if (!f.done) return '';
    if (f.pens) return T('tn.pens', { a: f.pens[0], b: f.pens[1] });
    if (f.et) return T('tn.et');
    return '';
  }
  function fxRow(S, f, opts) {
    opts = opts || {};
    const mine = S.me && (f.a === S.me || f.b === S.me);
    const row = h('div', { class: 'fxrow' + (mine ? ' mine' : '') + (f.done ? '' : ' open') },
      h('span', { class: 'fxa' }, h('b', { text: nm(f.a) }), ' ', flag(f.a)),
      h('span', { class: 'fxs' }, h('b', { text: scoreText(f) }), fxNote(f) ? h('small', { text: fxNote(f) }) : null),
      h('span', { class: 'fxb' }, flag(f.b), ' ', h('b', { text: nm(f.b) })));
    if (opts.label) row.appendChild(h('small', { class: 'fxl', text: opts.label }));
    return row;
  }

  FCK.Screens.tourneyHub = function () {
    Tn.refreshNames();
    const el = h('div', { class: 'page tourney' });
    let S = Tn.S || Tn.load();
    if (!S) { el.appendChild(UI.header(T('tn.title'), () => UI.back())); el.appendChild(h('p', { class: 'muted center', text: T('tn.none') })); return el; }
    if (S.me) S.r[S.me] = Tn.strength(S.me);
    // after the human player's match: finish the round (and following rounds until his next match)
    if (S.me && !S.done && Tn.isIn(S) && !Tn.myFixture(S)) { Tn.settle(S); }
    if (S.done) Tn.archive(S);
    Tn.save();
    el.appendChild(UI.header(T('tn.kind.' + S.kind), () => { UI.stack = ['home']; UI.show('tourney', null, true); }));
    const body = h('div', { class: 'tn-body' });
    const tabs = UI.chips([{ v: 'home', l: T('tn.tab.home') }, { v: 'groups', l: T('tn.tab.groups') }, { v: 'ko', l: T('tn.tab.ko') }, { v: 'scorers', l: T('tn.tab.scorers') }, { v: 'team', l: T('tn.tab.team') }], ST.tab, (v) => { ST.tab = v; draw(); }, 'scroll tabs');
    el.appendChild(tabs); el.appendChild(body);
    const redraw = () => UI.show('tourneyHub', null, true);
    const draw = () => { body.innerHTML = ''; ({ home: tabHome, groups: tabGroups, ko: tabKo, scorers: tabScorers, team: tabTeam })[ST.tab](body, S, redraw); };
    draw();
    return el;
  };

  function tabHome(body, S, redraw) {
    const R = S.rounds[S.ri];
    // status
    const pct = Math.round((Tn.matchCount(S) / Tn.totalMatches(S)) * 100);
    const head = UI.section(S.done ? T('tn.finished') : roundLabel(S, R));
    head.appendChild(h('div', { class: 'tnbar' }, h('i', { style: { width: pct + '%' } })));
    head.appendChild(h('small', { class: 'fine', text: Tn.matchCount(S) + ' / ' + Tn.totalMatches(S) }));
    if (S.me) head.appendChild(h('div', { class: 'tn-me' }, UI.crestImg(Tn.nationClub(S.me), 36), h('b', { text: flagName(S.me) }), h('span', { class: 'tag', text: placeLabel(S, S.me) })));
    body.appendChild(head);

    if (S.done) {
      const ch = h('section', { class: 'card sect tn-champ' }, h('div', { class: 'trophy', text: '🏆' }), UI.crestImg(Tn.nationClub(S.champ), 84),
        h('h2', { text: flagName(S.champ) }), h('p', { text: T('tn.champ.' + cupOf(S)) }));
      const pod = [[S.second, T('tn.place.F')], [S.third, T('tn.place.T3')], [S.fourth, T('tn.place.T4')]].filter((x) => x[0]);
      pod.forEach((x) => ch.appendChild(h('div', { class: 'pod' }, h('span', { text: x[1] }), h('b', { text: flagName(x[0]) }))));
      const king = Tn.topScorers(S, 1)[0];
      if (king) ch.appendChild(h('div', { class: 'pod' }, h('span', { text: '👟 ' + T('tn.king') }), h('b', { text: king.n + ' (' + nm(king.id) + ') · ' + king.g })));
      if (S.me) ch.appendChild(h('p', { class: 'ok', text: T('tn.you') + ': ' + placeLabel(S, S.me) }));
      ch.appendChild(h('div', { class: 'row center' }, UI.btn(T('tn.again'), () => { Tn.clear(); UI.stack = ['home']; UI.show('tourney', null, true); }, 'primary')));
      body.appendChild(ch);
    } else {
      const mine = Tn.myFixture(S);
      if (mine) {
        const opp = mine.a === S.me ? mine.b : mine.a;
        const v = Tn.venue(S, mine, R);
        const card = h('section', { class: 'card sect tn-next' }, h('h3', { text: T('tn.next') + ' · ' + fxLabel(S, R, mine) }));
        card.appendChild(h('div', { class: 'tn-vs' },
          h('div', { class: 'side' }, UI.crestImg(Tn.nationClub(S.me), 72), h('b', { text: nm(S.me) }), UI.stars(Tn.nationClub(S.me).rating)),
          h('div', { class: 'vs' }, h('b', { text: 'VS' }), mine.ko ? h('small', { text: T('tn.ko.note') }) : null),
          h('div', { class: 'side' }, UI.crestImg(Tn.nationClub(opp), 72), h('b', { text: nm(opp) }), UI.stars(Tn.nationClub(opp).rating))));
        card.appendChild(h('p', { class: 'fine center', text: '🏟 ' + v.name + ' · ' + v.cap.toLocaleString(FCK.settings.lang === 'en' ? 'en-US' : 'de-DE') + ' · ' + T('set.half') + ' ' + S.half + ' min' }));
        card.appendChild(h('div', { class: 'row center' },
          UI.btn('▶ ' + T('tn.play.match'), () => { Tn.save(); Tn.play(S); }, 'primary xl'),
          UI.btn('⏩ ' + T('tn.sim.match'), () => {
            const f = Tn.simMine(S);
            Tn.settle(S);
            UI.toast(nm(f.a) + ' ' + f.ga + ':' + f.gb + ' ' + nm(f.b) + (f.pens ? ' ' + T('tn.pens', { a: f.pens[0], b: f.pens[1] }) : ''), 3200);
            Tn.save(); redraw();
          }, 'ghost')));
        body.appendChild(card);
      } else {
        const box = h('section', { class: 'card sect' });
        if (S.me && S.out[S.me]) box.appendChild(h('p', { class: 'warn', text: T('tn.out', { r: placeLabel(S, S.me) }) }));
        else if (!S.me) box.appendChild(h('p', { class: 'muted', text: T('tn.spectator.hint') }));
        box.appendChild(h('div', { class: 'row center' },
          UI.btn('⏩ ' + T('tn.sim.round'), () => { Tn.settle(S); Tn.save(); redraw(); }, 'primary'),
          UI.btn('⏭ ' + T('tn.sim.all'), () => { Tn.settle(S, { all: true }); Tn.save(); redraw(); }, 'ghost')));
        body.appendChild(box);
      }
    }

    // last round results
    if (S.closed != null && S.rounds[S.closed]) {
      const LR = S.rounds[S.closed];
      const sec = UI.section(T('tn.last') + ' · ' + roundLabel(S, LR));
      LR.fx.forEach((f) => sec.appendChild(fxRow(S, f, { label: LR.type === 'group' ? T('tn.group', { g: Tn.letter(f.g) }) : f.bronze ? T('tn.ko.B') : null })));
      body.appendChild(sec);
    }
    // my path
    if (S.me) {
      const mine = [];
      S.rounds.forEach((r) => r.fx.forEach((f) => { if (f.done && (f.a === S.me || f.b === S.me)) mine.push([r, f]); }));
      if (mine.length) {
        const sec = UI.section(T('tn.path'));
        mine.forEach(([r, f]) => {
          const w = Tn.winnerOf(f);
          const res = w === S.me ? 'W' : w ? 'L' : 'D';
          const row = fxRow(S, f, { label: fxLabel(S, r, f) });
          row.classList.add('res' + res);
          sec.appendChild(row);
        });
        body.appendChild(sec);
      }
    }
  }

  function tabGroups(body, S) {
    const fmt = Tn.FORMATS[S.kind];
    const opts = [{ v: 'all', l: T('all') }].concat(S.groups.map((g, i) => ({ v: String(i), l: Tn.letter(i) })));
    const mineG = S.me ? S.groups.findIndex((g) => g.includes(S.me)) : -1;
    body.appendChild(UI.chips(opts, ST.grp, (v) => { ST.grp = v; fill(); }, 'scroll'));
    const holder = h('div', { class: 'grid2 tn-groups' });
    body.appendChild(holder);
    const settled = Tn.groupsDone(S);
    const thirds = fmt.thirds ? S.groups.map((g, gi) => Object.assign({ gi }, Tn.table(S, gi)[fmt.adv])) : [];
    const fill = () => {
      holder.innerHTML = '';
      S.groups.forEach((g, gi) => {
        const tab = Tn.table(S, gi);
        if (ST.grp !== 'all' && ST.grp !== String(gi)) return;
        const tb = h('table', { class: 'ptable gtable' });
        tb.appendChild(h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: T('tn.team') }), h('th', { text: T('tn.p') }), h('th', { text: T('tn.gd') }), h('th', { text: T('tn.pts') }))));
        const tbody = h('tbody');
        tab.forEach((r, i) => {
          const q = i < fmt.adv ? 'q1' : (fmt.thirds && i === fmt.adv ? 'q3' : '');
          tbody.appendChild(h('tr', { class: (r.id === S.me ? 'me ' : '') + q },
            h('td', { text: String(i + 1) }), h('td', null, flag(r.id), ' ', h('b', { text: nm(r.id) })), h('td', { text: String(r.p) }), h('td', { text: (r.gd > 0 ? '+' : '') + r.gd }), h('td', null, h('b', { text: String(r.pts) }))));
        });
        tb.appendChild(tbody);
        holder.appendChild(h('section', { class: 'card sect' + (gi === mineG ? ' mineg' : '') }, h('h3', { text: T('tn.group', { g: Tn.letter(gi) }) }), h('div', { class: 'scrollx' }, tb)));
      });
    };
    fill();
    if (fmt.thirds) {
      thirds.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);
      const tb = h('table', { class: 'ptable gtable' });
      tb.appendChild(h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: T('tn.team') }), h('th', { text: T('tn.p') }), h('th', { text: T('tn.gd') }), h('th', { text: T('tn.pts') }))));
      const tbody = h('tbody');
      thirds.forEach((r, i) => tbody.appendChild(h('tr', { class: (r.id === S.me ? 'me ' : '') + (i < fmt.thirds ? 'q3' : '') }, h('td', { text: String(i + 1) }), h('td', null, flag(r.id), ' ', h('b', { text: nm(r.id) }), h('small', { text: ' ' + Tn.letter(r.gi) })), h('td', { text: String(r.p) }), h('td', { text: (r.gd > 0 ? '+' : '') + r.gd }), h('td', null, h('b', { text: String(r.pts) })))));
      tb.appendChild(tbody);
      body.appendChild(h('section', { class: 'card sect' }, h('h3', { text: T('tn.thirds', { n: fmt.thirds }) }), h('div', { class: 'scrollx' }, tb), h('p', { class: 'fine', text: settled ? T('tn.thirds.done') : T('tn.thirds.live') })));
    }
    body.appendChild(h('p', { class: 'fine', text: T('tn.tiebreak') }));
  }

  function tabKo(body, S) {
    const ko = S.rounds.filter((r) => r.type === 'ko');
    if (!ko.length) { body.appendChild(h('p', { class: 'muted center', text: T('tn.ko.later') })); return; }
    ko.slice().reverse().forEach((R) => {
      const sec = UI.section(T('tn.ko.' + R.key));
      R.fx.forEach((f) => sec.appendChild(fxRow(S, f, { label: f.bronze ? T('tn.ko.B') : null })));
      body.appendChild(sec);
    });
  }

  function tabScorers(body, S) {
    const top = Tn.topScorers(S, 20);
    const sec = UI.section(T('tn.scorers'));
    if (!top.length) sec.appendChild(h('p', { class: 'muted', text: T('tn.scorers.none') }));
    top.forEach((x, i) => sec.appendChild(h('div', { class: 'crow' + (x.id === S.me ? ' mine' : '') }, h('b', { class: 'rk', text: String(i + 1) }), flag(x.id), h('div', { class: 'mr-n' }, h('b', { text: x.n }), h('small', { text: nm(x.id) })), h('b', { class: 'big', text: '⚽ ' + x.g }))));
    body.appendChild(sec);
  }

  function tabTeam(body, S, redraw) {
    if (S.me) {
      const club = Tn.nationClub(S.me);
      const sec = UI.section(T('tn.your'));
      sec.appendChild(h('div', { class: 'tn-me' }, UI.crestImg(club, 48), h('b', { class: 'big', text: flagName(S.me) }), UI.stars(club.rating)));
      sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('formation') }), UI.select(FCK.FORMATION_NAMES, S.form, (v) => { S.form = v; Tn.save(); fillXI(); }, T('formation'))));
      sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('style') }), UI.chips(FCK.STYLE_KEYS.map((k) => ({ v: k, l: T('style.' + k) })), S.style, (v) => { S.style = v; Tn.save(); }, 'scroll')));
      sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('k.level') }), UI.chips(LEVELS.map((k) => ({ v: k, l: T('level.' + k) })), S.level, (v) => { S.level = v; Tn.save(); }, 'scroll')));
      sec.appendChild(UI.slider(T('set.half'), 1, 10, 1, S.half, (v) => { S.half = v; Tn.save(); }, (v) => v + ' min'));
      sec.appendChild(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('setup.players') }), UI.chips(['p1', 'p2co', 'cpu'].map((k) => ({ v: k, l: T('k.pre.' + k) })), S.preset, (v) => { S.preset = v; Tn.save(); }, 'scroll')));
      sec.appendChild(FCK.PadNav.controlLine(() => S.preset));
      const xi = h('div', { class: 'xi' });
      const fillXI = () => {
        xi.innerHTML = '';
        const sq = FCK.pickSquad(W.squad(club, 1), S.form);
        sq.lineup.forEach((p) => xi.appendChild(h('div', { class: 'xirow' }, h('span', { class: 'pos', text: FCK.posL(p.pos) }), h('b', { text: p.name }), h('span', { class: 'ovr', text: String(p.ovr) }))));
        xi.appendChild(h('div', { class: 'xirow bench' }, h('span', { class: 'pos', text: T('tn.bench') }), h('small', { text: sq.bench.map((p) => p.sname).join(', ') })));
      };
      fillXI();
      sec.appendChild(xi);
      sec.appendChild(h('div', { class: 'row' }, UI.btn(T('ed.players.edit'), () => UI.show('editorSquad', { id: club.id }), 'ghost'), UI.btn(T('tn.edit.look'), () => UI.show('editorClub', { id: club.id }), 'ghost')));
      sec.appendChild(h('p', { class: 'fine', text: T('tn.edit.hint') }));
      body.appendChild(sec);
    }
    // the field
    const f = UI.section(T('tn.field', { n: S.teams.length }));
    const sorted = S.teams.slice().sort((a, b) => S.r[b] - S.r[a]);
    sorted.forEach((id, i) => {
      const gi = S.groups.findIndex((g) => g.includes(id));
      f.appendChild(h('div', { class: 'crow' + (id === S.me ? ' mine' : '') }, h('b', { class: 'rk', text: String(i + 1) }), flag(id), h('div', { class: 'mr-n' }, h('b', { text: nm(id) }), h('small', { text: Tn.nat(id).conf + ' · ' + T('tn.group', { g: Tn.letter(gi) }) + ' · ' + placeLabel(S, id) })), UI.stars(Tn.nationClub(id).rating)));
    });
    body.appendChild(f);
  }

  // ------------------------------------------------------------------ result box inside the match result screen
  FCK.TourneyUI.resultBox = function (m) {
    const ctx = m.tourneyCtx, S = Tn.S;
    if (!ctx || !S) return null;
    const R = S.rounds[ctx.ri], f = R && R.fx[ctx.fi];
    if (!f || !f.done) return null;
    const w = Tn.winnerOf(f);
    const res = w === ctx.me ? 'W' : w ? 'L' : 'D';
    const box = h('section', { class: 'card sect cres' }, h('h3', { text: T('tn.kind.' + S.kind) + ' · ' + fxLabel(S, R, f) }));
    box.appendChild(h('div', { class: 'row' }, h('b', { class: 'big', text: T('tn.res.' + res) })));
    if (R.type === 'ko') box.appendChild(h('p', { class: res === 'W' ? 'ok' : 'warn', text: res === 'W' ? (R.key === 'F' ? T('tn.res.champion.' + cupOf(S)) : f.bronze ? T('tn.res.bronze') : T('tn.res.next')) : (f.bronze ? T('tn.res.bronze.lost') : T('tn.res.out')) }));
    else {
      const tab = Tn.table(S, f.g), row = tab.find((r) => r.id === ctx.me);
      box.appendChild(h('p', { class: 'fine', text: T('tn.res.table', { g: Tn.letter(f.g), p: row.pos, pts: row.pts }) }));
    }
    return box;
  };
})((globalThis.FCK = globalThis.FCK || {}));
