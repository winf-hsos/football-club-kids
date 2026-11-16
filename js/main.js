/* FCK - main.js : app bootstrap, settings, game loop (match, replay, archive, demo background) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);
  const STEP = 1 / 60;

  // ---------------- settings & persistence ----------------
  FCK.isTouchDevice = () => {
    try { return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
  };
  FCK.saveSettings = () => U.store.set('settings', FCK.settings);
  FCK.saveSetup = () => U.store.set('setup', FCK.setup);
  FCK.applyProfile = () => {
    FCK.profile = FCK.settings.profile;
    document.body.classList.toggle('kids', FCK.profile === 'kids');
    document.body.dataset.ui = ['mix', 'f22', 'f24', 'f27'].includes(FCK.settings.uiStyle) ? FCK.settings.uiStyle : 'mix';
    if (FCK.setup && !FCK.setup.touched) {
      const m = FCK.setup.match;
      const lv = FCK.profile === 'kids' ? 'rookie' : 'pro';
      m.level = lv; Object.assign(m, FCK.LEVELS[lv]);
    }
  };
  FCK.snapshot = () => ({ v: 1, settings: FCK.settings, setup: FCK.setup, cards: FCK.Cards && FCK.Cards.S ? FCK.Cards.pack() : undefined, editor: FCK.Editor && FCK.Editor.data && FCK.Editor.count() ? FCK.Editor.data : undefined, tourney: FCK.Tourney && FCK.Tourney.S ? FCK.Tourney.S : undefined, comp: FCK.Comp && (FCK.Comp.S || FCK.Comp.hasSaved()) ? (FCK.Comp.S || FCK.Comp.load(), FCK.Comp.S ? FCK.Comp.pack() : undefined) : undefined, note: (FCK.settings.profile === 'kids' ? 'Kids' : 'Normal') + ' · ' + FCK.teamById(FCK.setup.home).short + '–' + FCK.teamById(FCK.setup.away).short });
  FCK.restore = (d) => {
    if (!d) return;
    if (d.settings) FCK.settings = Object.assign({}, FCK.DEFAULTS, d.settings);
    if (d.setup) FCK.setup = normalizeSetup(d.setup);
    if (d.cards && FCK.Cards && FCK.Cards.valid(d.cards)) { FCK.Cards.install(d.cards); FCK.Cards.save(); }
    if (d.editor && FCK.Editor && FCK.Editor.valid(d.editor)) FCK.Editor.install(d.editor);
    if (d.tourney && FCK.Tourney && FCK.Tourney.valid(d.tourney)) FCK.Tourney.install(d.tourney);
    if (d.comp && FCK.Comp) { const cs = FCK.Comp.unpack(d.comp); if (cs) { FCK.Comp.S = cs; FCK.Comp.save(); } }
    FCK.saveSettings(); FCK.saveSetup(); FCK.applyProfile(); FCK.onSettings();
  };
  FCK.resetAll = () => {
    ['settings', 'setup', 'clips', 'slots', 'history', 'editor', 'tourney', 'tourney_hist', 'duel', 'comp', 'comp_hist'].forEach((k) => U.store.del(k));
    if (FCK.Comp) FCK.Comp.S = null;
    if (FCK.Editor) FCK.Editor.load();
    if (FCK.Tourney) FCK.Tourney.S = null;
    FCK.settings = Object.assign({}, FCK.DEFAULTS, { lang: guessLang() });
    FCK.setup = FCK.defaultSetup();
    FCK.applyProfile();
  };
  function guessLang() { try { return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en'; } catch (e) { return 'de'; } }
  function normalizeSetup(s) {
    const d = FCK.defaultSetup();
    const o = Object.assign(d, s || {});
    o.match = Object.assign({}, FCK.DEFAULT_MATCH, (s && s.match) || {});
    if (!FCK.TEAMS.find((t) => t.id === o.home)) o.home = 'fcb';
    if (!FCK.TEAMS.find((t) => t.id === o.away)) o.away = 'mci';
    if (!Array.isArray(o.slots) || o.slots.length < 4) { o.slots = (o.slots || []).concat([{ dev: 'none', team: 0 }, { dev: 'none', team: 1 }, { dev: 'none', team: 0 }, { dev: 'none', team: 1 }]).slice(0, 4); }
    return o;
  }

  // ---------------- game ----------------
  class Game {
    constructor(canvas, hudEl, touchEl) {
      this.cv = canvas;
      this.r = new (FCK.Renderer3D || FCK.Renderer)(canvas);
      this.input = new FCK.Input();
      FCK.input = this.input;
      this.touchUI = new FCK.TouchUI(touchEl, this.input);
      this.hud = new FCK.MatchUI(hudEl);
      this.kind = 'idle'; this.m = null; this.paused = false; this.replay = null;
      this.acc = 0; this.last = performance.now(); this.pendingSubs = [];
      this.breakShown = false; this.finished = false; this.demoReset = 0;
      this.archive = null;
      window.addEventListener('resize', () => { this.r.resize(); });
      window.addEventListener('orientationchange', () => setTimeout(() => this.r.resize(), 200));
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.kind === 'match' && !this.paused && !this.replay) this.pause(); });
      window.addEventListener('gamepadconnected', () => UI.toast(T('pad.connected')));
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyM' && this.kind === 'match' && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) { FCK.settings.muted = !FCK.settings.muted; FCK.saveSettings(); FCK.Audio.set({}, FCK.settings.muted); UI.toast(FCK.settings.muted ? T('muted') : T('unmuted'), 1200); }
        if (this.replay && !this.replay.archive && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) { this.skipReplay(); }
      });
      requestAnimationFrame((t) => this.frame(t));
    }

    // ----- lifecycle -----
    applyRenderSettings() {
      const S = FCK.settings;
      this.r.zoom = S.zoom; this.r.particles = S.particles; this.r.updateScale();
    }

    startDemo() {
      if (this.kind === 'match' || this.kind === 'archive') return;
      const ids = FCK.TEAMS.map((t) => t.id);
      const rng = U.makeRng((Math.random() * 1e9) | 0);
      const a = rng.pick(ids); let b; do { b = rng.pick(ids); } while (b === a);
      const m = new FCK.Match({ clubs: [FCK.teamById(a), FCK.teamById(b)], settings: { halfMins: 3, weather: rng.pick(['clear', 'clear', 'rain', 'cloudy', 'snow']), tod: rng.pick(['day', 'evening', 'night']), homeFormation: rng.pick(FCK.FORMATION_NAMES), awayFormation: rng.pick(FCK.FORMATION_NAMES) }, slots: [] });
      m.autoProceed = true;
      this.m = m; this.kind = 'demo';
      this.r.zoom = 'far'; this.r.particles = FCK.settings.particles; this.r.updateScale(); this.r.setMatch(m);
      this.r.cam.x = 52; this.r.cam.y = 34;
      this.acc = 0;
    }

    startMatch(cfg) {
      FCK.Audio.init();
      UI.hide(); UI.closeModal();
      const S = FCK.settings;
      const slots = cfg.slots.map((s) => Object.assign({}, s));
      if (S.touch === 'on' && slots.length && !slots.some((s) => s.dev === 'touch')) slots[0].dev = 'touch';
      if (S.touch === 'off') slots.forEach((s) => { if (s.dev === 'touch') s.dev = 'kb1'; });
      const m = new FCK.Match({ clubs: cfg.clubs, settings: cfg.settings, slots, squads: cfg.squads, lock: cfg.lock });
      m.autoProceed = false; m.careerCtx = cfg.career || null; m.cardsCtx = cfg.cards || null; m.tourneyCtx = cfg.tourney || null; m.duelCtx = cfg.duel || null; m.hook = cfg.hook || null;
      this.m = m; this.cfg = cfg; this.kind = 'match'; this.paused = false; this.replay = null; this.archive = null;
      this.pendingSubs = []; this.breakShown = false; this.finished = false; this.overTimer = 0;
      this.input.setup(slots); this.input.captureKeys = true; this.input.clearEdges();
      this.applyRenderSettings(); this.r.setMatch(m);
      this.r.cam.x = 52.5; this.r.cam.y = 34;
      this.hud.build(m, this);
      this.touchUI.setLabels([T('tb.pass'), T('tb.shot'), T('tb.through'), T('tb.lob')]);
      this.touchUI.show(slots.some((s) => s.dev === 'touch'));
      document.body.classList.add('in-match');
      document.body.classList.toggle('touch-on', slots.some((s) => s.dev === 'touch'));
      this.com = new FCK.Commentary(m, { lang: S.lang, kids: S.profile === 'kids', out: (line) => this.onLine(line) });
      m.on((e) => this.onEvent(e));
      FCK.Audio.set({}, S.muted);
      if (S.musicInGame) FCK.Audio.startMusic('game'); else FCK.Audio.stopMusic();
      const t0 = m.teams[0], t1 = m.teams[1];
      this.hud.flash(t0.name + '  –  ' + t1.name, 'info', 2600, t0.club.stadium + ' · ' + T('weather.' + m.weather) + ' · ' + T('tod.' + m.tod));
      this.com.kickoff();
      this.acc = 0; this.last = performance.now();
      this.prevVz = 0;
    }

    endMatch() {
      this.touchUI.show(false); this.input.captureKeys = false;
      this.hud.hide(); UI.closeModal();
      document.body.classList.remove('in-match', 'touch-on');
      FCK.Audio.stopMusic(); FCK.Audio.silence(); FCK.Audio.stopSpeech();
      this.m = null; this.kind = 'idle'; this.replay = null; this.archive = null; this.paused = false;
      this.startDemoSoon();
    }
    startDemoSoon() { if (FCK.settings.demoBg !== false) setTimeout(() => { if (this.kind === 'idle') this.startDemo(); }, 200); }

    // ----- pause -----
    pause() {
      if (this.kind !== 'match' || this.paused || this.replay || this.m.mode === 'over') return;
      if (this.breakShown) return;
      this.paused = true; FCK.pauseMenu(this); FCK.Audio.ambience(0.1, this.m.weather, true);
    }
    resume() { UI.closeModal(); this.paused = false; this.acc = 0; this.last = performance.now(); this.input.clearEdges(); this.redrawTactics = null; }
    quit() { const hk = this.cfg && this.cfg.hook; if (hk && hk.quit) { this.endMatch(); UI.stack = []; UI.cur = null; hk.quit(); return; } const cr = this.cfg && this.cfg.career, cd = this.cfg && this.cfg.cards, tn = this.cfg && this.cfg.tourney, du = this.cfg && this.cfg.duel; this.endMatch(); UI.stack = []; UI.cur = null; if (cr && FCK.Career && FCK.Career.cur) { UI.stack = ['home']; UI.show(FCK.Career.cur.pro ? 'proHub' : 'career'); } else if (cd && FCK.Cards) { UI.stack = ['home']; UI.show('cards'); } else if (tn && FCK.Tourney && FCK.Tourney.S) { UI.stack = ['home', 'tourney']; UI.show('tourneyHub'); } else if (du && FCK.Duel) { UI.stack = ['home']; UI.show('duel'); } else UI.show('home'); }

    // ----- substitutions -----
    queueSub(team, outP, inData) {
      const m = this.m;
      if (!outP.onPitch || team.subsLeft <= 0) return;
      if (m.canSub(team)) { if (m.substitute(team, outP, inData)) { FCK.Audio.play('sub'); UI.toast(T('sub.done', { a: outP.sname, b: inData.sname }), 1800); } return; }
      this.pendingSubs = this.pendingSubs.filter((x) => x.outP !== outP && x.inData !== inData);
      this.pendingSubs.push({ team, outP, inData });
      UI.toast(T('sub.queued'), 1800);
    }
    applyPendingSubs() {
      const m = this.m;
      for (let i = this.pendingSubs.length - 1; i >= 0; i--) {
        const q = this.pendingSubs[i];
        if (!q.outP.onPitch || q.team.subsLeft <= 0 || !q.team.bench.includes(q.inData)) { this.pendingSubs.splice(i, 1); continue; }
        if (m.canSub(q.team) && m.mode !== 'injury') { m.substitute(q.team, q.outP, q.inData); this.pendingSubs.splice(i, 1); FCK.Audio.play('sub'); }
      }
    }

    // ----- breaks -----
    continueBreak() {
      UI.closeModal(); this.breakShown = false; this.paused = false;
      this.m.proceed(); this.input.clearEdges(); this.acc = 0;
      if (this.m.mode === 'play' || this.m.mode === 'restart') FCK.Audio.play('whistle');
    }

    // ----- events -----
    onLine(line) {
      this.hud.commentLine(line);
      const S = FCK.settings;
      if (S.speech_on && line.prio >= 2) FCK.Audio.speak(line.text.replace(/⚽/g, ''), S.lang, line.prio >= 3);
    }

    onEvent(e) {
      const m = this.m, A = FCK.Audio, hud = this.hud;
      if (!m || this.kind !== 'match') return;
      if (m.fastForward && !['sub', 'halftime', 'end', 'period', 'goal', 'extratime'].includes(e.type)) return;
      switch (e.type) {
        case 'kick': A.play(e.power < 11 ? 'soft' : 'kick', U.clamp(e.power / 22, 0.4, 1)); break;
        case 'shot': A.play('shot', U.clamp((e.power || 0.6) * 1, 0.5, 1)); break;
        case 'woodwork': A.play('post'); hud.flash(e.kind === 'bar' ? T('bn.bar') : T('bn.post'), 'info', 900); break;
        case 'save': A.play(e.kind === 'catch' ? 'catch' : 'save'); if (e.kind !== 'catch') A.play('ooh'); break;
        case 'tackle': A.play(e.slide ? 'slide' : 'tackle'); break;
        case 'goal': {
          A.play('goal'); A.play('net');
          const b = m.ball;
          const sc = e.scorer || e.goal.ogBy;
          this.r.celebrate(b.x < 52 ? 1 : 103, b.y, e.team.kit.shirt, e.team.kit.shirt2 || e.team.kit.shirt);
          hud.flash(T('bn.goal'), 'goal', 2600, e.og ? T('bn.og') : sc ? sc.name + " " + e.goal.minute + "'" : '', e.team);
          break;
        }
        case 'foul': A.play('whistle'); if (e.penalty) { hud.flash(T('bn.penalty'), 'warn', 1800); A.play('ooh'); } break;
        case 'offside': A.play('whistle'); hud.flash(T('bn.offside'), 'info', 1300); break;
        case 'card': A.play('card'); hud.flash(e.kind === 'yellow' ? T('bn.yellow') : e.kind === 'red' ? T('bn.red') : T('bn.yellow2'), e.kind === 'yellow' ? 'yellow' : 'red', 1700, e.by.name); break;
        case 'injury': A.play('whistle2'); hud.flash(T('bn.injury'), 'warn', 1700, e.by.name); break;
        case 'sub': if (!e.auto || true) { hud.flash(T('bn.sub'), 'info', 1400, e.in.sname + ' ⇄ ' + e.out.sname); } break;
        case 'added': hud.flash(T('bn.added', { n: e.mins }), 'info', 2000); break;
        case 'halftime': A.play('whistle3'); hud.flash(e.et ? T('bn.etHalf') : T('bn.half'), 'info', 1800); break;
        case 'extratime': A.play('whistle3'); hud.flash(T('bn.extra'), 'info', 1800); break;
        case 'penaltiesNext': A.play('whistle3'); hud.flash(T('bn.pens'), 'warn', 1800); break;
        case 'end': A.play('whistle3'); hud.flash(T('bn.full'), 'info', 2200); break;
        case 'restart': if (['corner', 'freekick', 'kickoff'].includes(e.kind) && this.m.mode !== 'shootout' && this.m.time > 2) hud.flash(T('rs.' + e.kind), 'info', 900, ((e.team && e.team.club) ? e.team : this.m.teams[e.team]).club.short); break;
        case 'curl': A.play('ooh'); break;
        case 'restartReady': if (e.restart && (e.restart.type === 'kickoff' || e.restart.type === 'penalty')) A.play('whistle'); break;
        case 'penalty': A.play(e.scored ? 'goal' : 'groan'); hud.flash(e.scored ? T('bn.penGoal') : T('bn.penMiss'), e.scored ? 'goal' : 'warn', 1500, e.shooter.sname); break;
        case 'shootoutStart': break;
        case 'goalwait': this.startReplay(); break;
        case 'period': hud.flash(T('bn.secondHalf'), 'info', 1300); break;
        default: break;
      }
    }

    // ----- replay of a fresh goal -----
    startReplay() {
      const m = this.m;
      if (m.fastForward) { m.proceed(); return; }
      const frames = m.getClip(10.5);
      if (frames.length < 90) { m.proceed(); return; }
      try { FCK.Archive.save(FCK.Archive.fromMatch(m, frames, m.lastGoal, FCK.settings.lang)); } catch (e) { /* storage full */ }
      const meta = m.players.map((p) => ({ team: p.ti, num: p.num, sname: p.sname, look: p.look, isGK: !!p.isGK }));
      const rp = new FCK.ReplayPlayer(frames, 30, meta, m.teams);
      this.replay = { rp, speed: 0.75, hold: 0, archive: false };
      this.hud.showReplay(true); this.hud.clearBanners();
      FCK.Audio.play('whooshReplay');
      this.r.cam.x = rp.ball.x; this.r.cam.y = rp.ball.y;
      this.hud.setHint('');
    }
    skipReplay() { if (this.replay && !this.replay.archive) this.endReplay(); }
    endReplay() {
      const wasArchive = this.replay && this.replay.archive;
      this.replay = null; this.hud.showReplay(false);
      if (!wasArchive && this.m) { this.m.proceed(); this.input.clearEdges(); this.acc = 0; this.r.cam.x = this.m.ball.x; this.r.cam.y = this.m.ball.y; }
    }

    // ----- archive playback -----
    playArchive(entry) {
      FCK.Audio.init();
      const o = FCK.Archive.open(entry);
      UI.hide();
      this.kind = 'archive';
      this.archive = { entry, rp: o.rp, speed: 0.75, playing: true, fake: o.fake };
      this.r.zoom = FCK.settings.zoom; this.r.particles = FCK.settings.particles; this.r.updateScale();
      this.r.setMatch(o.fake);
      this.r.cam.x = o.rp.ball.x; this.r.cam.y = o.rp.ball.y;
      this.buildArchiveBar();
    }
    buildArchiveBar() {
      const a = this.archive, el = this.hud.el;
      el.innerHTML = ''; el.hidden = false;
      const bar = h('div', { class: 'arch-bar' });
      const prog = h('input', { type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Timeline' });
      prog.addEventListener('input', () => { a.playing = false; a.rp.seek((prog.value / 1000) * a.rp.dur); playBtn.textContent = '▶'; });
      const playBtn = h('button', { class: 'btn ghost sm', type: 'button' }, '❚❚');
      playBtn.addEventListener('click', () => { a.playing = !a.playing; if (a.playing && a.rp.t >= a.rp.dur - 0.05) a.rp.seek(0); playBtn.textContent = a.playing ? '❚❚' : '▶'; });
      const speed = UI.chips([{ v: 0.25, l: '0.25×' }, { v: 0.5, l: '0.5×' }, { v: 0.75, l: '0.75×' }, { v: 1, l: '1×' }], a.speed, (v) => { a.speed = v; }, 'scroll');
      const close = h('button', { class: 'btn primary sm', type: 'button' }, '✕ ' + T('close'));
      close.addEventListener('click', () => this.closeArchive());
      bar.appendChild(h('div', { class: 'arch-t' }, h('i'), h('b', { text: T('replay') }), h('span', { text: ' ' + a.entry.teams[0].short + ' ' + a.entry.score[0] + ':' + a.entry.score[1] + ' ' + a.entry.teams[1].short })));
      bar.appendChild(h('div', { class: 'arch-c' }, playBtn, prog, speed, close));
      el.appendChild(bar);
      a.prog = prog; a.playBtn = playBtn;
    }
    closeArchive() {
      this.hud.hide(); this.archive = null; this.kind = 'idle';
      this.startDemoSoon();
      UI.show('highlights', null, true);
    }

    // ----- main loop -----
    frame(ts) {
      requestAnimationFrame((t) => this.frame(t));
      let dt = (ts - this.last) / 1000; this.last = ts;
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      const r = this.r;
      if (this.kind === 'match') this.frameMatch(dt);
      else if (this.kind === 'archive') this.frameArchive(dt);
      else if (this.kind === 'demo') this.frameDemo(dt);
      else if ((this.kind === 'idle' || this.kind === 'result') && FCK.settings.demoBg !== false && !UI.screenEl.hidden) { this.startDemo(); }
    }

    frameDemo(dt) {
      if (!document.body.classList.contains('home-bg')) return;
      const m = this.m;
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 4) { m.update(STEP); this.acc -= STEP; n++; }
      if (this.acc > 0.2) this.acc = 0;
      if (m.mode === 'over') { this.kind = 'idle'; this.startDemo(); return; }
      this.r.mood = m.crowd.mood;
      this.r.draw({ ball: m.ball, players: m.players, ref: m.ref }, dt, { match: null, hud: false, radar: false });
    }

    frameArchive(dt) {
      const a = this.archive; if (!a) return;
      if (a.playing) { const end = a.rp.step(dt, a.speed); if (end) { a.playing = false; a.playBtn.textContent = '▶'; } a.prog.value = Math.round((a.rp.t / a.rp.dur) * 1000); }
      this.r.mood = 0.7;
      this.r.draw(a.rp.view, dt, { hud: false, radar: false });
    }

    frameMatch(dt) {
      const m = this.m, r = this.r, S = FCK.settings, A = FCK.Audio;
      this.input.poll();
      const pauseReq = this.input.takePause();
      if (pauseReq) {
        if (this.replay) this.skipReplay();
        else if (this.paused && !this.breakShown) this.resume();
        else this.pause();
      }
      // replay
      if (this.replay) {
        const rp = this.replay.rp;
        if (this.input.anyAction()) { this.input.clearEdges(); this.skipReplay(); return; }
        const end = rp.step(dt, this.replay.speed);
        this.hud.replayProgress(rp.t / rp.dur);
        r.mood = 0.7;
        r.draw(rp.view, dt, { hud: true, radar: false });
        if (end) { this.replay.hold += dt; if (this.replay.hold > 0.5) this.endReplay(); }
        return;
      }
      if (this.paused || UI.modalOpen) {
        r.draw({ ball: m.ball, players: m.players, ref: m.ref }, 0, { match: m, restart: m.restart, radar: S.radar });
        return;
      }
      // simulation
      const ff = m.fastForward ? 8 : 1; // the pro waits on the bench: skip ahead
      this.acc += dt * ff;
      let n = 0;
      while (this.acc >= STEP && n < 6 * ff) {
        for (let i = 0; i < m.slots.length; i++) { m.slots[i].input = this.input.consume(i); if (FCK.rotInput) FCK.rotInput(m.slots[i].input); }
        m.update(STEP);
        this.acc -= STEP; n++;
        if (m.mode === 'goalwait' && !this.replay) break;
      }
      if (this.acc > 0.25 * ff) this.acc = 0;
      this.com.tick(dt);
      this.applyPendingSubs();

      // bounce sound
      const b = m.ball;
      if (this.prevVz < -2.5 && b.vz >= 0 && b.z < 0.4) A.play('bounce', U.clamp(-this.prevVz / 10, 0.2, 1));
      this.prevVz = b.vz;

      // break / end handling
      if (m.mode === 'break' && !this.breakShown && m.modeT > 1.2) {
        this.breakShown = true; this.paused = true; FCK.breakMenu(this);
      }
      if (m.mode === 'over' && !this.finished) {
        this.finished = true;
        setTimeout(() => { if (this.kind === 'match' && this.m === m) this.showResult(); }, 2600);
      }
      // hint bar
      let hint = '';
      const rs = m.restart;
      if (m.mode === 'restart' && rs && rs.phase === 'ready' && rs.taker && rs.taker.ctrl >= 0) {
        const kind = rs.type === 'penalty' ? 'penalty' : (['kickoff','throwin','goalkick','corner','freekick'].includes(rs.type) ? rs.type : 'restart');
        const sl = m.slots[rs.taker.ctrl];
        hint = T((sl && sl.dev === 'touch' && ['kickoff','throwin','goalkick','corner','freekick'].includes(kind) ? 'hint.t.' : 'hint.') + kind);
      }
      else if (m.mode === 'shootout' && m.shootout && m.shootout.state === 'ready' && m.shootout.shooter && m.shootout.shooter.ctrl >= 0) hint = T('hint.penalty');
      if (m.lock && m.fastForward) hint = T('pro.hint.bench', { n: Math.round(m.lock.at) });
      if (this.cacheHint !== hint) { this.cacheHint = hint; this.hud.setHint(hint); }

      // audio ambience, camera effects
      A.ambience(m.crowd.mood, m.weather, m.mode === 'break');
      r.mood = m.crowd.mood;
      if (m.fxState.flash > 0.6) r.flash = Math.max(r.flash, 0.35);
      this.hud.update(m, dt);
      const view = { ball: m.ball, players: m.players, ref: m.ref };
      r.draw(view, dt, { match: m, restart: m.restart, radar: S.radar, shake: m.fxState.shake * 0.35, radarLift: 0 });
    }

    showResult() {
      const m = this.m;
      if (!m || !m.result) return;
      try {
        const hist = U.store.get('history', []);
        hist.unshift({ d: Date.now(), h: m.teams[0].short, a: m.teams[1].short, s: m.result.score, p: m.result.pens });
        U.store.set('history', hist.slice(0, 30));
      } catch (e) { /* ignore */ }
      this.touchUI.show(false); this.input.captureKeys = false;
      this.hud.hide();
      document.body.classList.remove('in-match', 'touch-on');
      FCK.Audio.stopMusic(); FCK.Audio.silence(); FCK.Audio.stopSpeech();
      if (m.careerCtx && FCK.Career) { try { FCK.Career.onResult(m); } catch (e) { console.error(e); } }
      if (m.cardsCtx && FCK.Cards) { try { FCK.Cards.onResult(m); } catch (e) { console.error(e); } }
      if (m.tourneyCtx && FCK.Tourney) { try { FCK.Tourney.onResult(m); } catch (e) { console.error(e); } }
      if (m.duelCtx && FCK.Duel) { try { FCK.Duel.onResult(m); } catch (e) { console.error(e); } }
      if (m.hook && m.hook.onResult) { try { m.hook.onResult(m); } catch (e) { console.error(e); } }
      const keep = m;
      this.kind = 'result';
      UI.stack = ['home'];
      UI.cur = null;
      UI.show('result', { m: keep }, true);
      this.lastMatch = keep;
    }
  }

  // ---------------- globals ----------------
  FCK.startMatch = (cfg) => FCK.game.startMatch(cfg);
  FCK.rematch = () => {
    FCK.game.kind = 'idle';
    FCK.game.startMatch(FCK.buildMatchConfig(FCK.setup));
  };
  FCK.playArchive = (entry) => FCK.game.playArchive(entry);
  FCK.onSettings = () => {
    if (FCK.Tourney && FCK.Tourney.refreshNames && FCK.World.ready) FCK.Tourney.refreshNames();
    if (FCK.game) FCK.game.applyRenderSettings();
    document.documentElement.lang = FCK.settings.lang;
    FCK.applyProfile();
  };

  function boot() {
    FCK.World.build();
    FCK.Tourney.register();
    FCK.Editor.load();
    const stored = U.store.get('settings', null);
    FCK.settings = Object.assign({}, FCK.DEFAULTS, stored || { lang: guessLang() });
    FCK.setup = normalizeSetup(U.store.get('setup', null));
    FCK.applyProfile();
    const root = document.getElementById('app');
    UI.init(root);
    FCK.game = new Game(document.getElementById('cv'), document.getElementById('hud'), document.getElementById('touch'));
    FCK.onSettings();
    FCK.Audio.set({ master: FCK.settings.master, sfx: FCK.settings.sfx, music: FCK.settings.music, crowd: FCK.settings.crowd, speech: FCK.settings.speech }, FCK.settings.muted);
    // first user gesture unlocks audio and starts menu music
    const unlock = () => {
      FCK.Audio.init();
      document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
    FCK.game.startDemo();
    if (!FCK.settings.welcomed) UI.show('welcome'); else UI.show('home');
    // Esc closes simple modals (not sticky ones)
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && UI.modalOpen && FCK.game.kind !== 'match') UI.closeModal(); });
    window.FCK_READY = true;
  }

  FCK.boot = boot;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})((globalThis.FCK = globalThis.FCK || {}));
