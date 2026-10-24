/* FCK - setup.js : friendly-match setup screen (teams, controllers, rules, CPU) + team picker */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);

  FCK.Screens = FCK.Screens || {};

  const LEVEL_KEYS = ['rookie', 'amateur', 'pro', 'world', 'legend'];

  function devList() {
    const pads = FCK.input ? FCK.input.padCount() : 0;
    const l = [{ v: 'none', l: T('dev.none') }, { v: 'kb1', l: T('dev.kb1') }, { v: 'kb2', l: T('dev.kb2') }];
    for (let i = 0; i < 4; i++) l.push({ v: 'pad' + i, l: T('dev.pad') + ' ' + (i + 1) + (i < pads ? ' ✓' : '') });
    l.push({ v: 'touch', l: T('dev.touch') });
    return l;
  }
  function autoDevices() {
    if (FCK.autoDevices) return FCK.autoDevices(); // padnav.js: honours the controller + pref_dev setting
    const pads = FCK.input ? FCK.input.padCount() : 0;
    const padDevs = []; for (let i = 0; i < pads; i++) padDevs.push('pad' + i);
    const touch = FCK.isTouchDevice();
    let order;
    if (touch && !pads) order = ['touch', 'kb1', 'kb2', 'pad0'];
    else if (pads) order = ['kb1'].concat(padDevs, ['kb2']);
    else order = ['kb1', 'kb2', 'pad0', 'pad1'];
    const all = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3'];
    all.forEach((d) => { if (!order.includes(d)) order.push(d); });
    return order.slice(0, 4);
  }
  function presetSlots(p) {
    const d = autoDevices();
    const none = { dev: 'none', team: 0 };
    switch (p) {
      case 'p1': return [{ dev: d[0], team: 0 }, { dev: 'none', team: 1 }, none, none];
      case 'p2vs': return [{ dev: d[0], team: 0 }, { dev: d[1], team: 1 }, { dev: 'none', team: 0 }, { dev: 'none', team: 1 }];
      case 'p2co': return [{ dev: d[0], team: 0 }, { dev: d[1], team: 0 }, { dev: 'none', team: 1 }, { dev: 'none', team: 1 }];
      case 'p4': return [{ dev: d[0], team: 0 }, { dev: d[1], team: 0 }, { dev: d[2], team: 1 }, { dev: d[3], team: 1 }];
      case 'cpu': default: return [{ dev: 'none', team: 0 }, { dev: 'none', team: 1 }, { dev: 'none', team: 0 }, { dev: 'none', team: 1 }];
    }
  }
  FCK.presetSlots = presetSlots;

  FCK.defaultSetup = function () {
    return {
      home: 'fcb', away: 'mci', preset: 'p1', slots: presetSlots('p1'), touched: false,
      match: Object.assign({}, FCK.DEFAULT_MATCH),
    };
  };

  // build the final match config from the setup
  FCK.buildMatchConfig = function (setup) {
    const kids = FCK.settings.profile === 'kids';
    const set = Object.assign({}, FCK.DEFAULT_MATCH, setup.match);
    if (kids) { set.injuries = false; if (set.referee === 'normal') set.referee = 'lenient'; }
    const preset = ['p1', 'p2vs', 'p2co', 'p4', 'cpu'].includes(setup.preset) ? presetSlots(setup.preset) : setup.slots; // presets follow the controller that is connected right now
    const slots = preset.filter((s) => s.dev && s.dev !== 'none').map((s) => ({ dev: s.dev, team: s.team }));
    const clubs = [FCK.teamById(setup.home), FCK.teamById(setup.away)];
    const squads = clubs.map((c, i) => {
      if (!c.world) return null;
      const f = i === 0 ? set.homeFormation : set.awayFormation, pool = FCK.World.squad(c, 1);
      const x = setup.xi && setup.xi[i === 0 ? 'home' : 'away'];
      const manual = x && x.id === c.id && x.f === f && FCK.Mgr ? FCK.Mgr.pickManual(pool, f, x.ids) : null;
      return manual || FCK.pickSquad(pool, f);
    });
    return { clubs, settings: set, slots, squads };
  };

  let sideSels = [];
  function teamCard(setup, idx, redraw, cards) {
    const key = idx === 0 ? 'home' : 'away';
    const fKey = idx === 0 ? 'homeFormation' : 'awayFormation';
    const sKey = idx === 0 ? 'homeStyle' : 'awayStyle';
    const card = h('div', { class: 'tcard card side' + idx });
    card.appendChild(h('div', { class: 'tc-tag', text: idx === 0 ? T('home') : T('away') }));
    const dyn = h('div', { class: 'tc-dyn' });
    // EA-FC-style selector: country on top, club in the middle, league below (one at a time)
    const sel = FCK.ClubSelector({
      pool: FCK.TEAMS, current: setup[key], compact: true,
      onChange: (t) => { setup[key] = t.id; setup.touched = true; FCK.saveSetup(); cards.forEach((c) => c.upd()); sideSels.forEach((sl) => { if (sl.options.length > 1) { sl.options[0].textContent = FCK.teamById(setup.home).short; sl.options[1].textContent = FCK.teamById(setup.away).short; } }); },
    });
    card.appendChild(sel.el);
    card.appendChild(dyn);
    card.upd = () => {
      const club = FCK.teamById(setup[key]);
      const kits = FCK.makeKits(FCK.teamById(setup.home), FCK.teamById(setup.away));
      dyn.innerHTML = '';
      const kit = h('img', { class: 'kit', alt: '', width: 48, height: 48 }); kit.src = FCK.kitDataUrl(kits[idx], 96);
      dyn.appendChild(h('div', { class: 'tc-meta' }, kit, h('span', { text: club.stadium || '' })));
      dyn.appendChild(h('div', { class: 'row tight' }, UI.btn('🔍 ' + T('team.change'), () => teamPicker(setup, idx, redraw), 'ghost'),
        club.world ? UI.btn('⚽ ' + T('lu.view'), () => lineupSetup(setup, idx, redraw), 'ghost') : null,
        setup.xi && setup.xi[key] && setup.xi[key].id === club.id ? h('span', { class: 'ci eu', text: T('lu.manual') }) : null));
    };
    card.sel = sel;
    const f = h('div', { class: 'tc-opts' },
      h('label', { class: 'mini' }, h('span', { text: T('formation') }), UI.select(FCK.FORMATION_NAMES, setup.match[fKey], (v) => { setup.match[fKey] = v; setup.touched = true; FCK.saveSetup(); }, T('formation'))),
      h('label', { class: 'mini' }, h('span', { text: T('style') }), UI.select(FCK.STYLE_KEYS.map((k) => ({ v: k, l: T('style.' + k) })), setup.match[sKey], (v) => { setup.match[sKey] = v; setup.touched = true; FCK.saveSetup(); }, T('style'))));
    card.appendChild(f);
    cards.push(card);
    return card;
  }

  function lineupSetup(setup, idx, redraw) {
    const key = idx === 0 ? 'home' : 'away', fKey = idx === 0 ? 'homeFormation' : 'awayFormation';
    const club = FCK.teamById(setup[key]);
    const f = setup.match[fKey];
    const pool = FCK.World.squad(club, 1);
    const x = setup.xi && setup.xi[key];
    FCK.Lineup.edit({
      title: T('lu.title') + ' · ' + club.name + ' · ' + f, formation: f, color: club.colors.p, pool,
      ids: x && x.id === club.id && x.f === f ? x.ids : null, pick: (pl, ff, ids) => FCK.Mgr.pickManual(pl, ff, ids),
      onSave: (ids) => { setup.xi = setup.xi || {}; setup.xi[key] = { id: club.id, f, ids }; setup.touched = true; FCK.saveSetup(); UI.closeModal(); redraw(); },
      onReset: () => { if (setup.xi) delete setup.xi[key]; FCK.saveSetup(); UI.closeModal(); redraw(); },
    });
  }

  function teamPicker(setup, idx, redraw) {
    const key = idx === 0 ? 'home' : 'away';
    const other = idx === 0 ? setup.away : setup.home;
    FCK.clubPicker({ current: setup[key], other, onPick: (t) => { setup[key] = t.id; setup.touched = true; FCK.saveSetup(); redraw(); } });
  }

  FCK.Screens.setup = function () {
    const setup = FCK.setup;
    const m = setup.match;
    if (['p1', 'p2vs', 'p2co', 'p4', 'cpu'].includes(setup.preset)) setup.slots = presetSlots(setup.preset); // a controller may have been connected since the last visit
    const el = h('div', { class: 'page setup' });
    const body = h('div', { class: 'setup-body' });
    const startBtn = UI.btn('▶ ' + T('setup.start'), () => {
      const err = validate(setup);
      if (err) { UI.toast(err); return; }
      FCK.Audio.init(); FCK.startMatch(FCK.buildMatchConfig(setup));
    }, 'primary xl');
    el.appendChild(UI.header(T('home.quick'), () => UI.back(), startBtn));

    const redraw = () => {
      body.innerHTML = '';
      // teams
      const teams = h('div', { class: 'teams' });
      const cards = []; sideSels = [];
      teams.appendChild(teamCard(setup, 0, redraw, cards));
      const mid = h('div', { class: 'vs' }, h('b', { text: 'VS' }),
        UI.btn('⇄', () => { const t = setup.home; setup.home = setup.away; setup.away = t; const f = m.homeFormation; m.homeFormation = m.awayFormation; m.awayFormation = f; const s = m.homeStyle; m.homeStyle = m.awayStyle; m.awayStyle = s; FCK.saveSetup(); redraw(); }, 'ghost round'),
        UI.btn('🎲', () => { const a = U.makeRng((Math.random() * 1e9) | 0); const ids = FCK.TEAMS.map((t) => t.id); setup.home = a.pick(ids); do { setup.away = a.pick(ids); } while (setup.away === setup.home); FCK.saveSetup(); redraw(); }, 'ghost round'));
      mid.querySelectorAll('button')[0].title = T('team.swap'); mid.querySelectorAll('button')[1].title = T('team.random');
      teams.appendChild(mid);
      teams.appendChild(teamCard(setup, 1, redraw, cards));
      cards.forEach((c) => c.upd());
      body.appendChild(teams);

      const grid = h('div', { class: 'grid2' });
      // controllers
      const ctl = UI.section(T('setup.players'));
      ctl.appendChild(UI.chips([
        { v: 'p1', l: T('preset.p1') }, { v: 'p2vs', l: T('preset.p2vs') }, { v: 'p2co', l: T('preset.p2co') }, { v: 'p4', l: T('preset.p4') }, { v: 'cpu', l: T('preset.cpu') },
      ], setup.preset, (v) => { setup.preset = v; setup.slots = presetSlots(v); setup.touched = true; FCK.saveSetup(); redraw(); }, 'scroll'));
      ctl.appendChild(FCK.PadNav.controlLine(() => setup.slots, () => { if (setup.preset !== 'custom') { setup.slots = presetSlots(setup.preset); FCK.saveSetup(); } redraw(); }));
      const rows = h('div', { class: 'slotrows' });
      const homeS = FCK.teamById(setup.home).short, awayS = FCK.teamById(setup.away).short;
      setup.slots.forEach((s, i) => {
        rows.appendChild(h('div', { class: 'srow' },
          h('span', { class: 'sdot', style: { background: FCK.SLOT_COLORS[i] } }), h('b', { text: T('player') + ' ' + (i + 1) }),
          UI.select(devList(), s.dev, (v) => { s.dev = v; setup.preset = 'custom'; FCK.saveSetup(); redraw(); }, T('device')),
          (() => { const sl = UI.select([{ v: '0', l: homeS }, { v: '1', l: awayS }], String(s.team), (v) => { s.team = parseInt(v, 10); setup.preset = 'custom'; FCK.saveSetup(); }, T('side')); sideSels.push(sl); return sl; })()));
      });
      ctl.appendChild(rows);
      const active = setup.slots.filter((s) => s.dev !== 'none').length;
      ctl.appendChild(h('p', { class: 'fine', text: active ? T('setup.players.hint') : T('setup.spectate') }));
      grid.appendChild(ctl);

      // match
      grid.appendChild(UI.section(T('setup.match'),
        UI.slider(T('set.half'), 1, 10, 1, m.halfMins, (v) => { m.halfMins = v; FCK.saveSetup(); }, (v) => v + ' min'),
        UI.toggle(T('set.knockout'), m.knockout, (v) => { m.knockout = v; FCK.saveSetup(); }),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.weather') }), UI.chips(['random'].concat(FCK.WEATHERS).map((w) => ({ v: w, l: T('weather.' + w) })), m.weather, (v) => { m.weather = v; FCK.saveSetup(); }, 'scroll')),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.tod') }), UI.chips(['random'].concat(FCK.TIMES).map((w) => ({ v: w, l: T('tod.' + w) })), m.tod, (v) => { m.tod = v; FCK.saveSetup(); }, 'scroll'))));

      // CPU
      const cpu = UI.section(T('setup.cpu'));
      const lvl = LEVEL_KEYS.includes(m.level) ? m.level : 'custom';
      cpu.appendChild(UI.chips(LEVEL_KEYS.map((k) => ({ v: k, l: T('level.' + k) })).concat(lvl === 'custom' ? [{ v: 'custom', l: T('level.custom') }] : []), lvl, (v) => {
        if (v === 'custom') return;
        m.level = v; Object.assign(m, FCK.LEVELS[v]); FCK.saveSetup(); redraw();
      }, 'scroll'));
      const adv = h('details', { class: 'adv' }, h('summary', { text: T('setup.adv') }),
        UI.slider(T('cpu.react'), 0.1, 0.8, 0.02, m.react, (v) => { m.react = v; m.level = 'custom'; FCK.saveSetup(); }, (v) => v.toFixed(2) + ' s'),
        UI.slider(T('cpu.pass'), 0.5, 1.4, 0.02, m.passAcc, (v) => { m.passAcc = v; m.level = 'custom'; FCK.saveSetup(); }, (v) => Math.round(v * 100) + '%'),
        UI.slider(T('cpu.aggr'), 0, 1, 0.02, m.aggr, (v) => { m.aggr = v; m.level = 'custom'; FCK.saveSetup(); }, (v) => Math.round(v * 100) + '%'),
        UI.slider(T('cpu.tempo'), 0.8, 1.2, 0.01, m.tempo, (v) => { m.tempo = v; m.level = 'custom'; FCK.saveSetup(); }, (v) => Math.round(v * 100) + '%'));
      cpu.appendChild(adv);
      grid.appendChild(cpu);

      const more = h('div', { class: 'grid2' });
      // rules
      more.appendChild(UI.section(T('setup.rules'),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.referee') }), UI.chips(['lenient', 'normal', 'strict', 'random'].map((r) => ({ v: r, l: T('ref.' + r) })), m.referee, (v) => { m.referee = v; FCK.saveSetup(); }, 'scroll')),
        UI.toggle(T('rule.offside'), m.offside, (v) => { m.offside = v; FCK.saveSetup(); }),
        UI.toggle(T('rule.advantage'), m.advantage, (v) => { m.advantage = v; FCK.saveSetup(); }),
        UI.toggle(T('rule.cards'), m.cards, (v) => { m.cards = v; FCK.saveSetup(); }),
        UI.toggle(T('rule.injuries'), m.injuries, (v) => { m.injuries = v; FCK.saveSetup(); }),
        FCK.settings.profile === 'kids' ? h('p', { class: 'fine', text: T('rule.kids') }) : null));

      // aids
      more.appendChild(UI.section(T('setup.aid'),
        UI.slider(T('set.assist'), 0, 1, 0.05, m.assist, (v) => { m.assist = v; FCK.saveSetup(); }, (v) => Math.round(v * 100) + '%'),
        UI.toggle(T('set.gkManual'), m.gkManual, (v) => { m.gkManual = v; FCK.saveSetup(); }),
        h('p', { class: 'fine', text: T('set.gkManual.hint') })));
      body.appendChild(grid);
      body.appendChild(h('details', { class: 'adv big' }, h('summary', { text: T('setup.more') }), more));
    };
    redraw();
    el.appendChild(body);
    return el;
  };

  function validate(setup) {
    const used = setup.slots.filter((s) => s.dev !== 'none');
    const seen = new Set();
    for (const s of used) { if (seen.has(s.dev)) return T('setup.err.dup'); seen.add(s.dev); }
    if (setup.home === setup.away) return T('setup.err.same');
    return null;
  }
})((globalThis.FCK = globalThis.FCK || {}));
