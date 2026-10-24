/* FCK - matchui.js : in-match HUD, banners, commentary ticker, pause / tactics / break menus, result screen */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const LU = FCK.Lineup;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);

  class MatchUI {
    constructor(hudEl) {
      this.el = hudEl; this.q = []; this.bannerBusy = false; this.lines = []; this.cache = {};
    }

    build(m, game) {
      this.m = m; this.game = game; this.cache = {};
      const el = this.el; el.innerHTML = ''; el.hidden = false;
      const t0 = m.teams[0], t1 = m.teams[1];
      this.sb = {};
      const sb = h('div', { class: 'sb', style: { '--c0': t0.kit ? t0.kit.shirt : '#e33', '--c1': t1.kit ? t1.kit.shirt : '#39f' } },
        h('div', { class: 'sb-team home' }, UI.crestImg(t0.club, 34), h('span', { class: 'sb-name', text: t0.short })),
        h('div', { class: 'sb-mid' },
          h('div', { class: 'sb-score' }, this.sb.s0 = h('b', { text: '0' }), h('i', { text: ':' }), this.sb.s1 = h('b', { text: '0' })),
          h('div', { class: 'sb-clock' }, this.sb.clk = h('span', { class: 'clk', text: '0:00' }), this.sb.add = h('span', { class: 'add' }), this.sb.per = h('span', { class: 'per' }))),
        h('div', { class: 'sb-team away' }, h('span', { class: 'sb-name', text: t1.short }), UI.crestImg(t1.club, 34)));
      el.appendChild(sb);
      this.sb.pens = h('div', { class: 'sb-pens' }, this.sb.p0 = h('div', { class: 'pens' }), this.sb.p1 = h('div', { class: 'pens' }));
      el.appendChild(this.sb.pens);
      this.sb.scorers = h('div', { class: 'sb-scorers' }, this.sb.g0 = h('div', { class: 'gl l' }), this.sb.g1 = h('div', { class: 'gl r' }));
      el.appendChild(this.sb.scorers);
      // pause button
      const pb = h('button', { class: 'hud-btn pause', type: 'button', 'aria-label': T('pause') }, '❚❚');
      pb.addEventListener('click', () => game.pause());
      el.appendChild(pb);
      // players
      this.pills = h('div', { class: 'pills' });
      el.appendChild(this.pills);
      this.pillEls = [];
      m.slots.forEach((s, i) => {
        const dot = h('span', { class: 'pdot', style: { background: FCK.SLOT_COLORS[i] } });
        const name = h('span', { class: 'pname' });
        const bar = h('i', { class: 'pbar' }, h('u'));
        const pill = h('div', { class: 'pill' }, dot, name, bar);
        this.pills.appendChild(pill);
        this.pillEls.push({ pill, name, bar: bar.firstChild });
      });
      this.banner = h('div', { class: 'banner', 'aria-live': 'assertive' });
      el.appendChild(this.banner);
      this.ticker = h('div', { class: 'ticker', 'aria-live': 'polite' });
      el.appendChild(this.ticker);
      this.replayEl = h('div', { class: 'replay-ov', hidden: true },
        h('div', { class: 'rp-tag' }, h('i'), h('b', { text: T('replay') })),
        h('div', { class: 'rp-bar' }, this.rpBar = h('u')),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => game.skipReplay() }, T('replay.skip') + ' ›'));
      el.appendChild(this.replayEl);
      this.hint = h('div', { class: 'hint-bar', hidden: true });
      el.appendChild(this.hint);
      this.q = []; this.lines = [];
    }

    hide() { this.el.hidden = true; this.el.innerHTML = ''; }

    setText(node, key, v) { if (this.cache[key] !== v) { this.cache[key] = v; node.textContent = v; } }

    update(m, dt) {
      const sb = this.sb;
      if (!sb || !sb.s0) return;
      this.setText(sb.s0, 's0', m.teams[0].score); this.setText(sb.s1, 's1', m.teams[1].score);
      const shoot = m.mode === 'shootout' || (m.mode === 'over' && m.shootout);
      let clock = m.clock;
      if (shoot) { this.setText(sb.clk, 'clk', T('per.pens')); this.setText(sb.add, 'add', ''); this.setText(sb.per, 'per', ''); }
      else {
        const base = Math.min(clock, m.periodEnd);
        this.setText(sb.clk, 'clk', U.fmtClock(base));
        this.setText(sb.add, 'add', clock > m.periodEnd ? '+' + Math.max(1, Math.ceil((clock - m.periodEnd) / 60)) : (m.addedShown ? '(+' + Math.max(1, Math.round(m.added / 60)) + ')' : ''));
        this.setText(sb.per, 'per', T('per.' + m.period));
      }
      // penalties
      sb.pens.hidden = !m.shootout;
      if (m.shootout) {
        const so = m.shootout;
        [0, 1].forEach((i) => {
          const key = 'p' + i + so.kicks[i].join('');
          if (this.cache[key] === undefined) {
            this.cache['pk' + i] = key;
            const box = sb['p' + i]; box.innerHTML = '';
            const n = Math.max(5, so.kicks[i].length);
            for (let k = 0; k < n; k++) box.appendChild(h('span', { class: 'pk ' + (so.kicks[i][k] === 1 ? 'g' : so.kicks[i][k] === 0 ? 'm' : '') }));
            this.cache[key] = 1;
          }
        });
      }
      // goal list
      const gk = 'goals' + m.goals.length;
      if (this.cache.gk !== gk) {
        this.cache.gk = gk;
        [0, 1].forEach((i) => {
          const box = sb['g' + i]; box.innerHTML = '';
          m.goals.filter((g) => g.team === i).forEach((g) => {
            const nm = g.og ? (g.ogBy ? g.ogBy.sname : '') + ' (' + T('og') + ')' : g.scorer ? g.scorer.sname : '';
            box.appendChild(h('div', { text: '⚽ ' + nm + ' ' + g.minute + "'" }));
          });
        });
      }
      // pills
      m.slots.forEach((s, i) => {
        const pe = this.pillEls[i]; if (!pe) return;
        const p = s.player;
        this.setText(pe.name, 'pn' + i, p ? p.num + ' ' + p.sname : '–');
        pe.bar.style.width = p ? Math.round(p.stam * 100) + '%' : '0%';
        pe.bar.className = p && p.stam < 0.3 ? 'low' : '';
      });
      // ticker fade
      const now = performance.now();
      for (let i = this.lines.length - 1; i >= 0; i--) {
        if (now - this.lines[i].t > (this.lines[i].prio >= 3 ? 9000 : 6000)) { this.lines[i].el.classList.add('out'); const e = this.lines[i].el; setTimeout(() => e.remove(), 500); this.lines.splice(i, 1); }
      }
    }

    commentLine(line) {
      if (!FCK.settings.commentary) return;
      const el = h('div', { class: 'tl p' + line.prio }, h('b', { text: line.minute + "' " }), line.text);
      this.ticker.appendChild(el);
      this.lines.push({ el, t: performance.now(), prio: line.prio });
      while (this.lines.length > 3) { const o = this.lines.shift(); o.el.remove(); }
    }

    // banners: sequential big messages
    flash(text, kind, ms, sub, team) { this.q.push({ text, kind: kind || 'info', ms: ms || 1800, sub, team }); if (!this.bannerBusy) this.nextBanner(); }
    nextBanner() {
      const b = this.q.shift();
      if (!b) { this.bannerBusy = false; return; }
      this.bannerBusy = true;
      this.banner.className = 'banner show ' + b.kind;
      this.banner.innerHTML = '';
      if (b.team && b.team.kit) this.banner.style.setProperty('--bc', b.team.kit.shirt); else this.banner.style.removeProperty('--bc');
      this.banner.appendChild(h('div', { class: 'bn-band' }));
      if (b.team && b.team.club && b.kind === 'goal') this.banner.appendChild(UI.crestImg(b.team.club, 72, 'bn-crest'));
      this.banner.appendChild(h('div', { class: 'bn-t', text: b.text }));
      if (b.sub) this.banner.appendChild(h('div', { class: 'bn-s', text: b.sub }));
      setTimeout(() => { this.banner.classList.remove('show'); setTimeout(() => this.nextBanner(), 220); }, b.ms);
    }
    clearBanners() { this.q.length = 0; this.banner.className = 'banner'; this.bannerBusy = false; }

    showReplay(on) { this.replayEl.hidden = !on; }
    replayProgress(f) { this.rpBar.style.width = Math.round(f * 100) + '%'; }
    setHint(text) { this.hint.hidden = !text; this.hint.textContent = text || ''; }
  }

  // ======================= pause / break menus =======================
  function pauseMenu(game) {
    const m = game.m;
    const body = h('div', { class: 'menu-col' });
    body.appendChild(UI.btn('▶ ' + T('pause.resume'), () => game.resume(), 'primary xl'));
    body.appendChild(UI.btn(T('tactics.title'), () => tacticsMenu(game, () => pauseMenu(game)), 'ghost'));
    body.appendChild(UI.btn(T('pause.sound'), () => quickSound(game), 'ghost'));
    body.appendChild(UI.btn(T('help'), () => helpOverlay(game), 'ghost'));
    let armed = false;
    const q = UI.btn(T('pause.quit'), () => {
      if (!armed) { armed = true; q.textContent = T('pause.quit.sure'); q.classList.add('danger'); setTimeout(() => { armed = false; q.textContent = T('pause.quit'); q.classList.remove('danger'); }, 3500); return; }
      game.quit();
    }, 'ghost');
    body.appendChild(q);
    UI.modal(T('pause'), body, { sticky: true, cls: 'pause' });
  }

  function quickSound(game) {
    const S = FCK.settings;
    const apply = () => { FCK.saveSettings(); FCK.Audio.set({ master: S.master, sfx: S.sfx, music: S.music, crowd: S.crowd, speech: S.speech }, S.muted); FCK.onSettings && FCK.onSettings(); };
    const body = h('div', { class: 'menu-col' },
      UI.toggle(T('set.mute'), S.muted, (v) => { S.muted = v; apply(); }),
      UI.slider(T('set.master'), 0, 1, 0.05, S.master, (v) => { S.master = v; apply(); }, (v) => Math.round(v * 100) + '%'),
      UI.slider(T('set.sfx'), 0, 1, 0.05, S.sfx, (v) => { S.sfx = v; apply(); }, (v) => Math.round(v * 100) + '%'),
      UI.slider(T('set.crowd'), 0, 1, 0.05, S.crowd, (v) => { S.crowd = v; apply(); }, (v) => Math.round(v * 100) + '%'),
      UI.slider(T('set.music'), 0, 1, 0.05, S.music, (v) => { S.music = v; apply(); }, (v) => Math.round(v * 100) + '%'),
      UI.toggle(T('set.musicGame'), S.musicInGame, (v) => { S.musicInGame = v; apply(); }),
      UI.toggle(T('set.commText'), S.commentary, (v) => { S.commentary = v; apply(); }),
      UI.toggle(T('set.commSpeech'), S.speech_on, (v) => { S.speech_on = v; apply(); }),
      UI.toggle(T('set.radar'), S.radar, (v) => { S.radar = v; apply(); }),
      FCK.view3dFields && FCK.view3dFields(apply),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.zoom') }), UI.chips([{ v: 'far', l: T('zoom.far') }, { v: 'mid', l: T('zoom.mid') }, { v: 'near', l: T('zoom.near') }], S.zoom, (v) => { S.zoom = v; apply(); })),
      UI.btn('‹ ' + T('back'), () => pauseMenu(game), 'ghost back'));
    UI.modal(T('pause.sound'), body, { sticky: true, cls: 'pause' });
  }

  function helpOverlay(game) {
    const k = (a, b) => h('tr', null, h('td', null, h('kbd', { text: a })), h('td', { text: b }));
    const acts = [T('act.pass'), T('act.shot'), T('act.through'), T('act.lob')];
    const hasKb2 = game.m.slots.some((s) => s.dev === 'kb2');
    const kb = game.m.slots.filter((s) => s.dev === 'kb1' || s.dev === 'kb2').length;
    const body = h('div', { class: 'menu-col' },
      h('table', { class: 'keys' }, h('tbody', null,
        kb === 1 ? [k('WASD / ←↑↓→', T('help.move')), k('Shift', T('help.sprint')), k('Q / Space', acts[0]), k('E / X', acts[1] + ' (' + T('help.hold') + ')'), k('R / C', acts[2]), k('F / V', acts[3] + ' (' + T('help.hold') + ')')]
          : [k('WASD · Shift', T('help.kb1')), k('Q · E · R · F', acts.join(' · ')), hasKb2 ? k('←↑↓→ · ⇧', T('help.kb2')) : null, hasKb2 ? k(', · . · - · Ö', acts.join(' · ')) : null],
        k('Esc / P', T('help.pause')), FCK.PadNav ? FCK.PadNav.helpRows(game.m.slots) : null)),
      h('dl', { class: 'dl' }, ...acts.flatMap((a, i) => [h('dt', { text: a }), h('dd', { text: T(['act.pass.def', 'act.shot.def', 'act.through.def', 'act.lob.def'][i]) })])),
      UI.btn('‹ ' + T('back'), () => pauseMenu(game), 'ghost back'));
    UI.modal(T('help'), body, { sticky: true, cls: 'pause' });
  }

  // ======================= tactics & substitutions =======================
  function formationPreview(name, color) {
    const c = h('canvas', { class: 'fprev', width: 120, height: 150 });
    const g = c.getContext('2d');
    g.fillStyle = '#1b6a34'; g.fillRect(0, 0, 120, 150);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.strokeRect(3, 3, 114, 144);
    g.beginPath(); g.moveTo(3, 75); g.lineTo(117, 75); g.stroke();
    g.beginPath(); g.arc(60, 75, 14, 0, 7); g.stroke();
    g.strokeRect(30, 3, 60, 24); g.strokeRect(30, 123, 60, 24);
    (FCK.FORMATIONS[name] || []).forEach((s) => {
      const x = 8 + s.fy * 104, y = 147 - 6 - s.fx * 132;
      g.fillStyle = color; g.beginPath(); g.arc(x, y, 5.5, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
    });
    return c;
  }

  function tacticsMenu(game, onBack) {
    const m = game.m;
    let ti = m.slots.length ? m.slots[0].team : 0;
    const multi = new Set(m.slots.map((s) => s.team)).size !== 1;
    let selOut = null, selIn = null;
    const body = h('div', { class: 'tactics' });
    const draw = () => {
      const team = m.teams[ti];
      body.innerHTML = '';
      if (multi || !m.slots.length) {
        body.appendChild(UI.chips([{ v: 0, l: m.teams[0].short }, { v: 1, l: m.teams[1].short }], ti, (v) => { ti = v; selOut = selIn = null; draw(); }));
      }
      const tabs = h('div', { class: 'tab-body' });
      // formation + style
      const form = FCK.FORMATIONS[team.formation];
      const onField = team.players.filter((p) => p.onPitch);
      const slotsArr = form.map((sl, i) => { const p = onField.find((q) => q.slot === i); return p ? { name: p.name, sname: p.sname, num: p.num, ovr: p.d.ovr, pos: p.pos, pos0: p.d.pos0 || p.pos, stam: p.stam, yellow: p.yellow, limp: p.limp, red: false, _p: p } : null; });
      const selIdx = slotsArr.findIndex((x) => x && x._p === selOut);
      tabs.appendChild(h('div', { class: 'tac-top' },
        LU.pitch({ formation: team.formation, color: team.kit.shirt, slots: slotsArr, sel: selIdx >= 0 ? selIdx : null, showFit: true, onSlot: (i) => { const x = slotsArr[i]; if (!x) return; selOut = selOut === x._p ? null : x._p; UI.sfx('tick'); trySub(); } }),
        h('div', { class: 'tac-opts' },
          h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('formation') }), UI.chips(FCK.FORMATION_NAMES, team.formation, (v) => { m.setFormation(team, v); UI.sfx('click'); draw(); }, 'scroll')),
          h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('style') }), UI.chips(FCK.STYLE_KEYS.map((k) => ({ v: k, l: T('style.' + k) })), team.style, (v) => { m.setStyle(team, v); }, 'scroll')),
          h('p', { class: 'fine', text: T('style.' + team.style + '.d') }))));
      // substitutions
      const can = m.canSub(team);
      tabs.appendChild(h('h4', { text: T('subs.title') + ' · ' + T('subs.left', { n: team.subsLeft }) }));
      if (team.subsLeft <= 0) tabs.appendChild(h('p', { class: 'fine', text: T('subs.none') }));
      else tabs.appendChild(h('p', { class: 'fine', text: (can ? T('subs.now') : T('subs.queue')) + ' · ' + T('lu.sub.hint') }));
      const cols = h('div', { class: 'subcols one' });
      const pitch = null;
      const bench = h('div', { class: 'subcol' }, h('h5', { text: T('subs.bench') }));
      team.bench.forEach((d) => {
        const q = (game.pendingSubs || []).find((x) => x.inData === d);
        const b = h('button', { class: 'prow' + (selIn === d ? ' on' : '') + (q ? ' queued' : ''), type: 'button' },
          h('span', { class: 'pos', text: FCK.posL(d.pos) }), h('b', { text: d.num + ' ' + d.sname }), h('span', { class: 'ovr', text: d.ovr }), q ? h('span', { text: '⏳' }) : null);
        b.addEventListener('click', () => { selIn = selIn === d ? null : d; UI.sfx('tick'); trySub(); });
        bench.appendChild(b);
      });
      cols.appendChild(bench);
      tabs.appendChild(cols);
      body.appendChild(tabs);
      body.appendChild(h('div', { class: 'row' }, UI.btn('‹ ' + T('back'), () => { onBack(); }, 'ghost back')));
      const trySub = () => {
        if (selOut && selIn && team.subsLeft > 0) {
          game.queueSub(team, selOut, selIn);
          selOut = selIn = null;
        }
        draw();
      };
    };
    draw();
    UI.modal(T('tactics.title'), body, { sticky: true, cls: 'pause wide' });
    game.redrawTactics = draw;
  }

  // ======================= half-time / break =======================
  function breakMenu(game) {
    const m = game.m, k = m.breakKind;
    const title = k === 'half' ? T('break.half') : k === 'et' ? T('break.et') : k === 'etHalf' ? T('break.etHalf') : T('break.pen');
    const t0 = m.teams[0], t1 = m.teams[1];
    const body = h('div', { class: 'break' });
    body.appendChild(h('div', { class: 'bk-score' }, UI.crestImg(t0.club, 52), h('b', { text: t0.score + ' : ' + t1.score }), UI.crestImg(t1.club, 52)));
    const goals = h('div', { class: 'bk-goals' });
    [0, 1].forEach((i) => {
      const d = h('div', { class: 'col' });
      m.goals.filter((g) => g.team === i).forEach((g) => d.appendChild(h('div', { text: '⚽ ' + (g.og ? (g.ogBy ? g.ogBy.sname : '') + ' (' + T('og') + ')' : g.scorer ? g.scorer.sname : '') + ' ' + g.minute + "'" })));
      goals.appendChild(d);
    });
    body.appendChild(goals);
    const tot = (t0.stats.poss + t1.stats.poss) || 1;
    const poss0 = Math.round((t0.stats.poss / tot) * 100);
    body.appendChild(statRow(T('st.poss'), poss0 + '%', (100 - poss0) + '%', poss0));
    body.appendChild(statRow(T('st.shots'), t0.stats.shots, t1.stats.shots));
    body.appendChild(statRow(T('st.sot'), t0.stats.sot, t1.stats.sot));
    body.appendChild(h('div', { class: 'menu-col' },
      UI.btn(T('tactics.title'), () => tacticsMenu(game, () => breakMenu(game)), 'ghost'),
      UI.btn('▶ ' + (k === 'pen' ? T('break.go.pen') : T('break.go')), () => game.continueBreak(), 'primary xl')));
    UI.modal(title, body, { sticky: true, cls: 'pause' });
  }

  function statRow(label, a, b, pct) {
    const av = typeof a === 'number' ? a : parseFloat(a), bv = typeof b === 'number' ? b : parseFloat(b);
    const p = pct !== undefined ? pct : (av + bv > 0 ? (av / (av + bv)) * 100 : 50);
    return h('div', { class: 'strow' }, h('b', { class: 'sv l', text: a }), h('div', { class: 'sbar' }, h('div', { class: 'sl', style: { width: p + '%' } }), h('div', { class: 'sr', style: { width: (100 - p) + '%' } }), h('span', { class: 'slabel', text: label })), h('b', { class: 'sv r', text: b }));
  }

  // ======================= result screen =======================
  FCK.Screens = FCK.Screens || {};
  FCK.Screens.result = function (data) {
    const m = data.m, res = m.result;
    const t0 = m.teams[0], t1 = m.teams[1];
    const el = h('div', { class: 'page result' });
    let tab = data.tab || 'sum';
    const head = h('div', { class: 'res-head card' });
    const winner = res.winner;
    head.appendChild(h('div', { class: 'res-teams' },
      h('div', { class: 'rt' + (winner === 0 ? ' win' : '') }, UI.crestImg(t0.club, 64), h('b', { text: t0.name })),
      h('div', { class: 'res-score' }, h('b', { text: t0.score + ' : ' + t1.score }),
        res.pens ? h('small', { text: T('res.pens', { a: res.pens[0], b: res.pens[1] }) }) : null,
        h('small', { text: winner < 0 ? T('res.draw') : T('res.winner', { t: m.teams[winner].name }) })),
      h('div', { class: 'rt' + (winner === 1 ? ' win' : '') }, UI.crestImg(t1.club, 64), h('b', { text: t1.name }))));
    el.appendChild(head);
    const tabs = UI.chips([{ v: 'sum', l: T('res.sum') }, { v: 'stats', l: T('res.stats') }, { v: 'players', l: T('res.players') }, { v: 'heat', l: T('res.heat') }], tab, (v) => { tab = v; draw(); }, 'scroll tabs');
    el.appendChild(tabs);
    const body = h('div', { class: 'res-body' });
    el.appendChild(body);

    const draw = () => {
      body.innerHTML = '';
      if (tab === 'sum') {
        // goals timeline
        const sec = h('section', { class: 'card sect' }, h('h3', { text: T('res.goals') }));
        if (!m.goals.length) sec.appendChild(h('p', { class: 'muted', text: T('res.nogoals') }));
        m.goals.forEach((g) => {
          const nm = g.og ? (g.ogBy ? g.ogBy.sname : '') + ' (' + T('og') + ')' : g.scorer ? g.scorer.sname : '';
          sec.appendChild(h('div', { class: 'goalrow t' + g.team }, h('span', { class: 'gm', text: g.minute + "'" }), UI.crestImg(m.teams[g.team].club, 22), h('b', { text: nm }), g.assist ? h('small', { text: T('res.assist') + ' ' + g.assist.sname }) : null));
        });
        body.appendChild(sec);
        // motm
        if (res.motm) {
          const p = res.motm.p;
          const cv = h('canvas', { width: 96, height: 96, class: 'avatar' });
          const g = cv.getContext('2d');
          g.fillStyle = m.teams[p.ti].kit.shirt; g.beginPath(); g.arc(48, 100, 52, 0, 7); g.fill();
          g.save(); g.translate(48, 46); g.scale(1, 1);
          FCK.Renderer.prototype.drawHead.call({}, g, p.look, 30); g.restore();
          body.appendChild(h('section', { class: 'card sect motm' }, cv, h('div', null, h('small', { text: T('res.motm') }), h('b', { class: 'big', text: p.name }), h('span', { text: m.teams[p.ti].name + ' · ' + FCK.posL(p.pos) + ' · ' + T('res.rating') + ' ' + res.motm.rating.toFixed(1) }))));
        }
        const topScorers = res.players.filter((x) => x.p.st.goals > 0);
        if (topScorers.length) {
          const s2 = h('section', { class: 'card sect' }, h('h3', { text: T('res.scorers') }));
          topScorers.sort((a, b) => b.p.st.goals - a.p.st.goals).forEach((x) => s2.appendChild(h('div', { class: 'goalrow' }, UI.crestImg(m.teams[x.team].club, 20), h('b', { text: x.p.name }), h('span', { class: 'gm', text: '⚽ ' + x.p.st.goals }))));
          body.appendChild(s2);
        }
      } else if (tab === 'stats') {
        const a = t0.stats, b = t1.stats;
        const sec = h('section', { class: 'card sect' });
        sec.appendChild(h('div', { class: 'st-head' }, UI.crestImg(t0.club, 28), h('b', { text: t0.short }), h('span'), h('b', { text: t1.short }), UI.crestImg(t1.club, 28)));
        sec.appendChild(statRow(T('st.poss'), res.poss[0] + '%', res.poss[1] + '%', res.poss[0]));
        sec.appendChild(statRow(T('st.shots'), a.shots, b.shots));
        sec.appendChild(statRow(T('st.sot'), a.sot, b.sot));
        sec.appendChild(statRow(T('st.passes'), a.passes, b.passes));
        sec.appendChild(statRow(T('st.passacc'), (a.passes ? Math.round((a.passOk / a.passes) * 100) : 0) + '%', (b.passes ? Math.round((b.passOk / b.passes) * 100) : 0) + '%', a.passes + b.passes ? ((a.passOk / Math.max(1, a.passes)) / ((a.passOk / Math.max(1, a.passes)) + (b.passOk / Math.max(1, b.passes)) || 1)) * 100 : 50));
        sec.appendChild(statRow(T('st.tackles'), a.tackleWon + '/' + a.tackles, b.tackleWon + '/' + b.tackles, (a.tackleWon + b.tackleWon) ? (a.tackleWon / (a.tackleWon + b.tackleWon)) * 100 : 50));
        sec.appendChild(statRow(T('st.fouls'), a.fouls, b.fouls));
        sec.appendChild(statRow(T('st.yellow'), a.yellow, b.yellow));
        sec.appendChild(statRow(T('st.red'), a.red, b.red));
        sec.appendChild(statRow(T('st.corners'), a.corners, b.corners));
        sec.appendChild(statRow(T('st.offsides'), a.offsides, b.offsides));
        sec.appendChild(statRow(T('st.saves'), a.saves, b.saves));
        body.appendChild(sec);
      } else if (tab === 'players') {
        const grid = h('div', { class: 'grid2' });
        [0, 1].forEach((ti) => {
          const sec = h('section', { class: 'card sect' }, h('h3', null, UI.crestImg(m.teams[ti].club, 22), ' ' + m.teams[ti].name));
          const tb = h('table', { class: 'ptable' });
          tb.appendChild(h('thead', null, h('tr', null, h('th', { text: '#' }), h('th', { text: T('res.player') }), h('th', { text: 'G' }), h('th', { text: 'A' }), h('th', { text: T('res.rating') }))));
          const tbody = h('tbody');
          res.players.filter((x) => x.team === ti).sort((a, b) => b.rating - a.rating).forEach((x) => {
            const cls = x.rating >= 8 ? 'r-hi' : x.rating >= 6.8 ? 'r-mid' : 'r-lo';
            tbody.appendChild(h('tr', null, h('td', { text: x.p.num }), h('td', null, h('b', { text: x.p.sname }), h('small', { text: ' ' + FCK.posL(x.p.pos) }), x.p.st.cards ? h('span', { class: x.p.red ? 'rcard' : 'ycard' }) : null), h('td', { text: x.p.st.goals || '' }), h('td', { text: x.p.st.assists || '' }), h('td', null, h('span', { class: 'rate ' + cls, text: x.rating.toFixed(1) }))));
          });
          tb.appendChild(tbody); sec.appendChild(h('div', { class: 'scrollx' }, tb)); grid.appendChild(sec);
        });
        body.appendChild(grid);
      } else if (tab === 'heat') {
        const grid = h('div', { class: 'grid2' });
        [0, 1].forEach((ti) => {
          const cv = h('canvas', { width: 420, height: 272, class: 'heat' });
          FCK.drawHeat(cv, m.teams[ti].heat, m.teams[ti].kit.shirt);
          grid.appendChild(h('section', { class: 'card sect' }, h('h3', null, UI.crestImg(m.teams[ti].club, 22), ' ' + m.teams[ti].name), cv));
        });
        body.appendChild(grid);
        body.appendChild(h('p', { class: 'fine', text: T('res.heat.hint') }));
      }
    };
    draw();
    if (m.cardsCtx && FCK.CardsUI) {
      const cb = FCK.CardsUI.resultBox(m); if (cb) el.insertBefore(cb, tabs);
      el.appendChild(h('div', { class: 'row center sticky-actions' },
        UI.btn(T('k.res.continue'), () => { FCK.game.kind = 'idle'; UI.stack = ['home']; UI.show('cards', null, true); }, 'primary xl'),
        m.cardsCtx.kind === 'friendly' ? UI.btn('↻ ' + T('k.res.again'), () => { const o = FCK.World.byId[m.cardsCtx.opp]; if (o) { const e = FCK.Cards.play('friendly', o); if (e) UI.toast(T('k.err.' + e)); } }, 'ghost') : null));
    } else if (m.tourneyCtx && FCK.TourneyUI) {
      const tb = FCK.TourneyUI.resultBox(m); if (tb) el.insertBefore(tb, tabs);
      el.appendChild(h('div', { class: 'row center sticky-actions' },
        UI.btn(T('tn.continue'), () => { FCK.game.kind = 'idle'; UI.stack = ['home', 'tourney']; UI.show('tourneyHub', null, true); }, 'primary xl')));
    } else if (m.hook && m.hook.resultBox) {
      const hb = m.hook.resultBox(m); if (hb) el.insertBefore(hb, tabs);
      el.appendChild(h('div', { class: 'row center sticky-actions' },
        UI.btn(m.hook.continueLabel ? m.hook.continueLabel() : T('career.continue'), () => { FCK.game.kind = 'idle'; m.hook.next(); }, 'primary xl')));
    } else if (m.duelCtx && FCK.DuelUI) {
      const db = FCK.DuelUI.resultBox(m); if (db) el.insertBefore(db, tabs);
      el.appendChild(h('div', { class: 'row center sticky-actions' },
        UI.btn(T('du.back'), () => { FCK.game.kind = 'idle'; UI.stack = ['home']; UI.show('duel', null, true); }, 'primary xl')));
    } else if (m.careerCtx) {
      el.appendChild(h('div', { class: 'row center sticky-actions' },
        UI.btn(T('career.continue'), () => { FCK.game.kind = 'idle'; UI.stack = ['home']; UI.show('career', null, true); }, 'primary xl')));
    } else {
    el.appendChild(h('div', { class: 'row center sticky-actions' },
      UI.btn('↻ ' + T('res.rematch'), () => FCK.rematch(), 'primary'),
      UI.btn(T('res.setup'), () => { UI.stack = ['home']; UI.show('setup', null, true); }, 'ghost'),
      UI.btn(T('res.home'), () => { UI.stack = []; UI.show('home', null, true); }, 'ghost')));
    }
    return el;
  };

  FCK.MatchUI = MatchUI;
  FCK.pauseMenu = pauseMenu; FCK.breakMenu = breakMenu; FCK.tacticsMenu = tacticsMenu;
})((globalThis.FCK = globalThis.FCK || {}));
