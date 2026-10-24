/* FCK - sim.js : match core (entities, physics, ball, kicks, human control, stats) */
(function (FCK) {
  FCK.PC = { lead: true, k: 0.95, cap: 21, r1: 1.7, r2: 1.2 };
  'use strict';
  const U = FCK.U;
  const P = FCK.PITCH;
  const L = P.L, W = P.W, GY = P.cy, HG = P.goalW / 2;
  const G = 9.81;

  const SURFACE = {
    clear: { mu: 3.2, spd: 1.0, err: 0, wind: 0 },
    cloudy: { mu: 3.2, spd: 1.0, err: 0, wind: 1.2 },
    rain: { mu: 2.4, spd: 0.99, err: 0.008, wind: 1.5 },
    storm: { mu: 2.0, spd: 0.97, err: 0.016, wind: 5 },
    snow: { mu: 5.2, spd: 0.94, err: 0.01, wind: 0.8 },
    fog: { mu: 3.2, spd: 1.0, err: 0.003, wind: 0.5 },
  };

  class Player {
    constructor(m, team, d, slotIdx) {
      this.m = m; this.team = team; this.ti = team.idx; this.d = d; this.id = d.id;
      this.name = d.name; this.sname = d.sname; this.num = d.num; this.look = d.look;
      this.a = d.a; this.role = d.role; this.pos = d.pos;
      this.abx = d.ab && d.ab.length && FCK.Abilities ? FCK.Abilities.fx(d.ab) : null; // special abilities (pro career)
      this.slot = slotIdx;
      this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.wx = 0; this.wy = 0;
      this.fx = team.dir; this.fy = 0; this.ang = team.dir > 0 ? 0 : Math.PI;
      this.stam = 1; this.sprint = false;
      this.state = 'idle'; this.stT = 0; // idle|slide|getup|down|dive|celebrate|hold
      this.noCtl = 0; this.tackleCd = 0; this.aiT = Math.random() * 0.3; this.runT = 0;
      this.yellow = 0; this.red = false; this.injured = false; this.limp = false; this.onPitch = true;
      this.ctrl = -1; // human slot index
      this.runPhase = Math.random() * 6; this.spd = 0;
      this.tx = 0; this.ty = 0; this.runTarget = null;
      this.diveDir = 0; this.diveDone = false; this.holdT = 0;
      this.st = { goals: 0, assists: 0, shots: 0, sot: 0, passes: 0, passOk: 0, tackles: 0, tackleWon: 0, saves: 0, fouls: 0, cards: 0, og: 0, dist: 0, touches: 0, conceded: 0, mins: 0 };
      this.heat = null;
      this.isGK = d.role === 'GK';
    }
    get cap() {
      const m = this.m;
      let s = 6.0 + 3.0 * (this.a.pac / 100);
      s *= m.surf.spd * (0.82 + 0.18 * Math.pow(Math.max(this.stam, 0.05), 0.7));
      if (this.limp) s *= 0.7;
      if (this.isGK) s *= 0.85;
      if (this.abx) { s *= this.abx.speed || 1; if (this.abx.carry && m.ball.owner === this) s *= this.abx.carry; if (this.abx.pressSpd && m.ball.owner && m.ball.owner.ti !== this.ti) s *= this.abx.pressSpd; }
      if (!this.ctrlHuman) s *= this.team.tempoMul;
      return s;
    }
    get ctrlHuman() { return this.ctrl >= 0; }
  }

  class Team {
    constructor(idx, club, dir) {
      this.idx = idx; this.club = club; this.dir = dir; this.name = club.name; this.short = club.short;
      this.players = []; this.bench = []; this.subbed = []; this.sentOff = [];
      this.formation = '4-4-2'; this.style = 'balanced'; this.tactic = Object.assign({}, FCK.STYLES.balanced);
      this.subsLeft = 5; this.score = 0; this.humans = []; this.tempoMul = 1;
      this.plan = { pressers: [], marks: {}, offLine: 0.5, t: 0 };
      this.stats = { shots: 0, sot: 0, passes: 0, passOk: 0, fouls: 0, yellow: 0, red: 0, corners: 0, offsides: 0, saves: 0, poss: 0, tackles: 0, tackleWon: 0 };
      this.heat = new Uint16Array(21 * 14);
      this.kit = null;
    }
    get goalX() { return this.dir > 0 ? L : 0; }
    get ownGoalX() { return this.dir > 0 ? 0 : L; }
    depth(x) { return this.dir > 0 ? x / L : 1 - x / L; }
    toX(fx) { return this.dir > 0 ? fx * L : L - fx * L; }
    toY(fy) { return this.dir > 0 ? fy * W : W - fy * W; }
  }

  class Match {
    constructor(cfg) {
      const seed = cfg.seed != null ? cfg.seed : (Math.random() * 4294967296) >>> 0;
      this.rng = U.makeRng(seed);
      this.set = Object.assign({}, FCK.DEFAULT_MATCH, cfg.settings || {});
      const w = this.set.weather === 'random' ? this.rng.pick(['clear', 'cloudy', 'rain', 'snow', 'fog']) : this.set.weather;
      this.weather = w;
      this.surf = SURFACE[w] || SURFACE.clear;
      this.tod = this.set.tod === 'random' ? this.rng.pick(FCK.TIMES) : this.set.tod;
      const wa = this.rng.range(0, Math.PI * 2);
      this.wind = { x: Math.cos(wa) * this.surf.wind, y: Math.sin(wa) * this.surf.wind };
      this.rate = 2700 / (U.clamp(this.set.halfMins, 1, 10) * 60);
      this.listeners = [];
      this.events = [];
      this.time = 0; this.clock = 0; this.period = 1; this.periodEnd = 2700; this.added = 0; this.addedShown = false;
      this.mode = 'restart'; this.restart = null; this.modeT = 0; this.breakKind = null;
      this.poss = -1; this.possT = 0; this.lastTouchTeam = -1; this.kickTeam0 = 0;
      this.adv = null; this.pendingOffside = null; this.fxState = { shake: 0, flash: 0 };
      this.stoppageAcc = 0; this.hT = 0; this.planT = 0; this.assignT = 0;
      this.shootout = null; this.winner = -1; this.result = null; this.seed = seed;
      this.gkOverride = null; this.callFor = null;
      this.goals = []; // {team, scorer, assist, minute, og, period}
      this.rec = { n: 0, cap: 540, frames: [], head: 0 };

      const clubs = cfg.clubs;
      this.teams = [new Team(0, clubs[0], 1), new Team(1, clubs[1], -1)];
      const kits = FCK.makeKits(clubs[0], clubs[1]);
      this.teams.forEach((t, i) => {
        t.kit = kits[i];
        t.formation = this.set[i === 0 ? 'homeFormation' : 'awayFormation'];
        t.style = this.set[i === 0 ? 'homeStyle' : 'awayStyle'];
        t.tactic = Object.assign({}, FCK.STYLES[t.style] || FCK.STYLES.balanced);
        const sq = (cfg.squads && cfg.squads[i]) || FCK.makeSquad(clubs[i], t.formation, this.rng);
        sq.lineup.forEach((d, k) => { d.slotFy = FCK.FORMATIONS[t.formation][k].fy; });
        t.bench = sq.bench.slice();
        t.players = sq.lineup.map((d, k) => new Player(this, t, d, k));
        t.all = t.players.slice();
      });
      // humans
      this.slots = (cfg.slots || []).map((s, i) => ({
        i, dev: s.dev, team: s.team, player: null, input: null, prev: null, holdSwitch: 0, charge: 0, chargeKind: 0, color: i,
      }));
      this.slots.forEach((s) => this.teams[s.team].humans.push(s));
      // pro career: one human slot is tied to a single player of the squad (cfg.lock = {team, sqi, setp, at})
      this.lock = cfg.lock ? Object.assign({ at: null, setp: [], done: false }, cfg.lock) : null;
      this.lockSlot = null;
      if (this.lock) { this.lockSlot = this.slots.find((s) => s.team === this.lock.team) || null; if (this.lockSlot) this.lockSlot.lock = this.lock; else this.lock = null; }
      // CPU tuning: applied to teams without humans (or all CPU-driven players)
      this.applyDifficulty();
      this.ref = { x: L / 2, y: GY + 6, vx: 0, vy: 0, name: this.rng.pick(FCK.REF_NAMES), strict: 0.5 };
      const rf = this.set.referee;
      this.ref.strict = rf === 'lenient' ? 0.2 : rf === 'strict' ? 0.85 : rf === 'random' ? this.rng.range(0.1, 0.95) : 0.5;
      this.ball = { x: L / 2, y: GY, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, prevTouch: null, lastKind: '', touchT: 0, offsideSet: null, offsideTeam: -1, passTarget: null, shotBy: null, rest: false };
      this.crowd = { cap: Math.max(clubs[0].cap, 1000), mood: 0.3, att: Math.round(clubs[0].cap * this.rng.range(0.82, 1.0)) };
      this.rebuild();
      this.kickoffTeam = 0;
      this.startKickoff(0);
      if (this.restart && this.restart.targets) this.restart.targets.forEach((tg, p) => { p.x = tg.x; p.y = tg.y; p.vx = p.vy = 0; });
    }

    // ---------- plumbing ----------
    on(fn) { this.listeners.push(fn); }
    emit(type, data) {
      const e = Object.assign({ type, t: this.clock, period: this.period, rt: this.time }, data || {});
      this.events.push(e);
      for (let i = 0; i < this.listeners.length; i++) this.listeners[i](e);
      return e;
    }
    minute() { return Math.floor(this.clock / 60) + 1; }
    applyDifficulty() {
      const s = this.set;
      this.diff = { react: s.react, passAcc: s.passAcc, aggr: s.aggr, tempo: s.tempo };
      this.teams.forEach((t) => { t.tempoMul = this.diff.tempo; });
    }
    rebuild() {
      this.players = this.teams[0].players.concat(this.teams[1].players);
      this.players.forEach((p) => { if (!p.heat) p.heat = new Uint16Array(21 * 14); });
    }
    allPlayers() { return this.teams[0].all.concat(this.teams[1].all); }
    opp(team) { return this.teams[1 - team.idx]; }
    keeperOf(team) { return team.players.find((p) => p.isGK && p.onPitch) || null; }
    humanTeam(t) { return this.teams[t].humans.length > 0; }
    // the tied player of the pro career (on the pitch) or null
    lockPlayer(team) {
      const L = this.lock; if (!L || this.teams[L.team] !== team) return null;
      return team.players.find((p) => p.onPitch && p.d && p.d.sqi === L.sqi) || null;
    }
    // true while the pro waits on the bench (the loop may run faster)
    get fastForward() {
      const L = this.lock; if (!L || L.done || L.at == null || this.mode === 'over') return false;
      return !this.lockPlayer(this.teams[L.team]);
    }
    // human slot that controls this player in a penalty shoot-out
    humanFor(teamIdx, player) {
      const hs = this.teams[teamIdx].humans;
      return hs.find((s) => !s.lock) || hs.find((s) => s.lock && player && player.d && player.d.sqi === s.lock.sqi) || null;
    }

    // ---------- geometry helpers ----------
    inBox(x, y, team) { // is point inside the penalty area that team DEFENDS
      const gx = team.ownGoalX;
      const dxg = Math.abs(x - gx);
      return dxg <= P.boxD && Math.abs(y - GY) <= P.boxW / 2;
    }
    clampPitch(p, margin) {
      p.x = U.clamp(p.x, -margin, L + margin);
      p.y = U.clamp(p.y, -margin, W + margin);
    }
    pressure(p) {
      let md = 99;
      const o = this.teams[1 - p.ti].players;
      for (let i = 0; i < o.length; i++) {
        const d = U.dist2(p.x, p.y, o[i].x, o[i].y);
        if (d < md) md = d;
      }
      return U.clamp(1 - md / 5.5, 0, 1);
    }
    pressureOf(p) { const v = this.pressure(p); return p.abx && p.abx.pressure ? v * p.abx.pressure : v; }
    nearestOpp(p) {
      let best = null, bd = 99;
      const o = this.teams[1 - p.ti].players;
      for (let i = 0; i < o.length; i++) {
        const d = U.dist2(p.x, p.y, o[i].x, o[i].y);
        if (d < bd) { bd = d; best = o[i]; }
      }
      return { p: best, d: bd };
    }

    // ---------- movement ----------
    moveTo(p, tx, ty, frac) {
      const dx = tx - p.x, dy = ty - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.15) { p.wx = 0; p.wy = 0; p.sprint = false; return d; }
      const cap = p.cap * (this.ball.owner === p ? 0.9 : 1);
      let sp = cap * U.clamp(frac, 0.2, 1.02);
      if (d < 2.2) sp *= Math.max(0.25, d / 2.2);
      p.wx = (dx / d) * sp; p.wy = (dy / d) * sp;
      p.sprint = frac > 0.8;
      return d;
    }
    stop(p) { p.wx = 0; p.wy = 0; p.sprint = false; }

    // where a loose ball will be at time t (ground roll uses the same friction as updateBall, air flight is almost linear)
    ballAt(t) {
      const b = this.ball, mu = this.surf.mu;
      let x = b.x, y = b.y, z = b.z, vx = b.vx, vy = b.vy, vz = b.vz, tt = 0;
      const st = 0.04;
      while (tt < t) {
        const dt = Math.min(st, t - tt); tt += dt;
        if (z > 0.02 || vz > 0.01) {
          vz -= G * dt; z += vz * dt;
          if (z <= 0) { z = 0; vz = vz < -1.6 ? -vz * 0.52 : 0; if (vz) { vx *= 0.9; vy *= 0.9; } }
        } else {
          const sp = Math.sqrt(vx * vx + vy * vy);
          if (sp > 0) { const ns = Math.max(0, sp - (mu + sp * 0.09) * dt); vx *= ns / sp; vy *= ns / sp; if (ns < 0.05) { vx = vy = 0; } }
        }
        x += vx * dt; y += vy * dt;
      }
      return { x: U.clamp(x, -1, L + 1), y: U.clamp(y, -1, W + 1), z };
    }
    // point where player p can meet the loose ball: first moment the player can be there (ball low enough to play)
    interceptFor(p) {
      const spd = Math.max(5, p.cap) * 0.97;
      let last = null;
      for (let t = 0.1; t <= 3; t += 0.1) {
        const q = this.ballAt(t); last = q;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (q.z < 1.2 && d <= spd * t + 0.3) return q;
      }
      return last || { x: this.ball.x, y: this.ball.y, z: 0 };
    }

    integrate(p, dt) {
      const m = this;
      p.noCtl = Math.max(0, p.noCtl - dt); p.tackleCd = Math.max(0, p.tackleCd - dt);
      let wx = p.wx, wy = p.wy, acc = 26;
      if (p.state === 'slide') {
        p.stT -= dt;
        wx = 0; wy = 0; acc = 7;
        if (p.stT <= 0) { p.state = 'getup'; p.stT = 0.55; }
      } else if (p.state === 'dive') {
        p.stT -= dt; wx = 0; wy = 0; acc = 4;
        if (p.stT <= 0) { p.state = 'getup'; p.stT = 0.7; }
      } else if (p.state === 'down') {
        p.stT -= dt; wx = 0; wy = 0; acc = 30;
        if (p.stT <= 0) { p.state = 'getup'; p.stT = 0.5; }
      } else if (p.state === 'getup') {
        p.stT -= dt; wx *= 0.25; wy *= 0.25;
        if (p.stT <= 0) p.state = 'idle';
      } else if (p.state === 'celebrate') {
        p.stT -= dt;
        if (p.stT <= 0) p.state = 'idle';
      } else if (p.state === 'hold') {
        wx = 0; wy = 0;
      }
      const dvx = wx - p.vx, dvy = wy - p.vy;
      const dl = Math.sqrt(dvx * dvx + dvy * dvy);
      const a = (dl > 0 && wx * wx + wy * wy < p.vx * p.vx + p.vy * p.vy ? acc * 1.3 : acc) * dt;
      if (dl <= a) { p.vx = wx; p.vy = wy; } else { p.vx += (dvx / dl) * a; p.vy += (dvy / dl) * a; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      p.spd = sp;
      p.st.dist += sp * dt;
      if (sp > 0.8 && p.state !== 'slide' && p.state !== 'dive') {
        const ta = Math.atan2(p.vy, p.vx);
        const turn = (m.ball.owner === p ? 7 : 10) * dt;
        const dA = U.angDiff(p.ang, ta);
        p.ang += U.clamp(dA, -turn, turn);
        p.fx = Math.cos(p.ang); p.fy = Math.sin(p.ang);
      } else if (p.state === 'slide' || p.state === 'dive') {
        p.fx = Math.cos(p.ang); p.fy = Math.sin(p.ang);
      }
      p.runPhase += sp * dt * 1.5;
      // stamina
      if (p.state === 'idle') {
        if (p.sprint && sp > 5.5) p.stam -= 0.045 * dt * (1.2 - p.a.phy / 200) * (p.abx && p.abx.stam || 1);
        else if (sp < 4) p.stam += 0.022 * dt;
        else p.stam += 0.006 * dt;
        p.stam = U.clamp(p.stam, 0, 1);
      }
      if (!m.set.stamina && false) p.stam = 1;
      if (p.state !== 'hold') m.clampPitch(p, 5);
    }

    separate() {
      const ps = this.players;
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i];
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 0.64 && d2 > 1e-6) {
            if (a.state === 'slide' || b.state === 'slide' || a.state === 'dive' || b.state === 'dive') continue;
            const d = Math.sqrt(d2), push = (0.8 - d) * 0.5;
            const nx = dx / d, ny = dy / d;
            a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
          }
        }
      }
    }

    // ---------- ball ----------
    setBallAt(x, y) {
      const b = this.ball;
      b.x = x; b.y = y; b.z = 0; b.vx = b.vy = b.vz = 0; b.owner = null;
    }
    touch(p, kind) {
      const b = this.ball;
      if (b.lastTouch !== p) {
        if (b.lastTouch && b.lastTouch.ti === p.ti) b.prevTouch = b.lastTouch;
        else if (b.lastTouch) b.prevTouch = null;
      }
      b.lastTouch = p; b.lastKind = kind || ''; b.touchT = this.clock;
      if (b.restartBy && b.restartBy !== p) b.restartBy = null;
      this.lastTouchTeam = p.ti; p.st.touches++;
    }

    updateBall(dt) {
      const b = this.ball, m = this;
      if (b.owner) {
        const o = b.owner;
        if (!o.onPitch || o.state === 'slide' || o.state === 'down' || o.state === 'dive' && !o.isGK) { b.owner = null; return; }
        const sp = Math.min(1, o.spd / 8);
        const off = 0.62 + 0.38 * sp;
        let tx = o.x + o.fx * off, ty = o.y + o.fy * off;
        if (o.isGK || o.state === 'hold') { tx = o.x + o.fx * 0.35; ty = o.y + o.fy * 0.35; }
        const k = Math.min(1, dt * 22);
        b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.z = o.isGK ? 0.9 : 0;
        b.vx = o.vx; b.vy = o.vy; b.vz = 0;
        return;
      }
      const wet = m.surf;
      // air
      if (b.z > 0.02 || b.vz > 0.01) {
        b.vz -= G * dt;
        b.z += b.vz * dt;
        if (b.z > 0.4) { b.vx += m.wind.x * dt * 0.12; b.vy += m.wind.y * dt * 0.12; }
        const dr = 1 - 0.035 * dt;
        b.vx *= dr; b.vy *= dr;
        if (b.curl) { const a = b.curl * dt, ca = Math.cos(a), sa = Math.sin(a), vx = b.vx; b.vx = vx * ca - b.vy * sa; b.vy = vx * sa + b.vy * ca; }
        if (b.z <= 0) {
          b.z = 0;
          b.curl = 0;
          if (b.vz < -1.6) { b.vz = -b.vz * 0.52; b.vx *= 0.9; b.vy *= 0.9; } else b.vz = 0;
        }
      } else {
        b.z = 0; b.vz = 0;
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > 0) {
          const dec = (wet.mu + sp * 0.09) * dt;
          const ns = Math.max(0, sp - dec);
          b.vx *= ns / sp; b.vy *= ns / sp;
          if (ns < 0.05) { b.vx = 0; b.vy = 0; }
        }
      }
      const px = b.x, py = b.y;
      b.x += b.vx * dt; b.y += b.vy * dt;
      this.ballWoodwork(px, py);
    }

    ballWoodwork(px, py) {
      const b = this.ball;
      // crossbar + posts at both ends
      for (let side = 0; side < 2; side++) {
        const gx = side === 0 ? 0 : L;
        const crossed = (px - gx) * (b.x - gx) <= 0 && Math.abs(px - b.x) > 1e-9;
        if (crossed) {
          const t = (gx - px) / (b.x - px);
          const yy = py + (b.y - py) * t;
          const zz = b.z;
          if (Math.abs(yy - GY) < HG + 0.05) {
            if (zz > 2.3 && zz < 2.75) { // bar
              b.x = gx + (side === 0 ? 0.25 : -0.25);
              b.vx = -b.vx * 0.45; b.vz = -Math.abs(b.vz) * 0.4 - 1.2 + 1.8; b.z = 2.2;
              this.emit('woodwork', { kind: 'bar', team: side === 0 ? 1 : 0, by: b.lastTouch });
              this.fxState.shake = Math.max(this.fxState.shake, 0.4);
              return;
            }
          } else if (Math.abs(Math.abs(yy - GY) - HG) < 0.16 && zz < 2.5) { // post
            b.x = gx + (side === 0 ? 0.3 : -0.3);
            b.vx = -b.vx * 0.5; b.vy = (yy > GY ? 1 : -1) * Math.abs(b.vx) * 0.5 + b.vy * 0.2;
            this.emit('woodwork', { kind: 'post', team: side === 0 ? 1 : 0, by: b.lastTouch });
            this.fxState.shake = Math.max(this.fxState.shake, 0.4);
            return;
          }
        }
      }
    }

    // ---------- kicks ----------
    // low-level: launch the ball
    launch(p, dx, dy, speed, vz, kind) {
      const b = this.ball;
      const [nx, ny] = U.norm(dx, dy);
      b.owner = null; b.curl = 0;
      b.x = p.x + nx * 0.55; b.y = p.y + ny * 0.55; b.z = 0.02;
      b.vx = nx * speed; b.vy = ny * speed; b.vz = vz;
      p.noCtl = 0.38 * (p.abx && p.abx.quick || 1); p.ang = Math.atan2(ny, nx); p.fx = nx; p.fy = ny;
      if (p.state === 'hold') p.state = 'idle';
      this.touch(p, kind);
      b.passTarget = null; b.shotBy = null;
      this.hT = 0;
    }

    passError(p, extra, type, dd) {
      const m = this;
      const x = p.abx;
      const press = m.pressureOf(p) * (x && x.passPress || 1);
      let sig = 0.012 + (1 - p.a.pas / 100) * 0.07 + press * 0.022 + (p.sprint ? 0.012 : 0) + m.surf.err + (extra || 0);
      if (x) {
        sig *= (x.passErr || 1) * (type === 'through' ? (x.throughErr || 1) : type === 'lob' ? (x.crossErr || 1) : 1) * (dd != null && dd < 18 && x.shortErr || 1);
      }
      if (!p.ctrlHuman) sig /= Math.max(0.4, m.diff.passAcc * 1.15);
      else sig *= 0.3; // pass assist for human players: passes should arrive
      return m.rng.gauss() * sig;
    }

    // type: 'pass' | 'through' | 'lob'
    passTo(p, target, type, power) {
      const m = this, b = this.ball;
      if (!target) return false;
      const d = U.dist(p, target);
      let ax = target.x, ay = target.y;
      if (type === 'through') {
        const lead = 0.55 + d / 22;
        ax += target.vx * lead + p.team.dir * 3.2; ay += target.vy * lead;
      } else if (type === 'pass') {
        // aim where the receiver will be when the ball arrives (ball slows down on the way)
        const v0 = U.clamp(6.5 + d * FCK.PC.k, 9, FCK.PC.cap) * (power != null ? 0.8 + power * 0.4 : 1);
        const lead = FCK.PC.lead ? Math.min(FCK.PC.lmax || 0.85, d / Math.max(6, v0 * 0.82)) : Math.min(0.4, d / 24);
        ax += target.vx * lead; ay += target.vy * lead;
      } else {
        ax += target.vx * 0.5; ay += target.vy * 0.5;
      }
      ax = U.clamp(ax, 0.5, L - 0.5); ay = U.clamp(ay, 0.5, W - 0.5);
      let dx = ax - p.x, dy = ay - p.y;
      const dd = Math.sqrt(dx * dx + dy * dy) || 1;
      const err = this.passError(p, type === 'lob' ? 0.012 : 0, type, dd);
      const ca = Math.cos(err), sa = Math.sin(err);
      const ndx = (dx * ca - dy * sa) / dd, ndy = (dx * sa + dy * ca) / dd;
      this.markOffside(p, type === 'through' ? 'through' : type);
      let speed, vz = 0;
      if (type === 'lob') {
        const T = U.clamp(0.62 + dd * 0.042, 0.9, 2.8);
        speed = dd / T; vz = 0.5 * G * T * (power != null ? 0.9 + power * 0.2 : 1);
        speed *= 0.97;
      } else {
        speed = U.clamp(6.5 + dd * (type === 'through' ? 1.12 : FCK.PC.k), 9, type === 'through' ? 25 : FCK.PC.cap) * (type === 'through' ? 1.08 : 1) * (power != null ? 0.8 + power * 0.4 : 1);
        if (dd < 4) speed = Math.min(speed, 11);
      }
      this.launch(p, ndx, ndy, speed, vz, type);
      b.passTarget = target; b.passer = p;
      p.team.stats.passes++; p.st.passes++;
      this.emit('kick', { kind: type, by: p, power: speed });
      return true;
    }

    // power01 in 0..1. dir = [x,y] intended direction; assist 0..1
    shoot(p, dirx, diry, power, assist, kind) {
      const m = this, b = this.ball, team = p.team;
      let [nx, ny] = U.norm(dirx, diry);
      if (nx === 0 && ny === 0) { nx = p.fx; ny = p.fy; }
      const gx = team.goalX;
      // aim assist towards goal mouth
      if (assist > 0 && (gx - p.x) * nx > 0.05) {
        const t = (gx - p.x) / nx;
        const yHit = p.y + ny * t;
        const dg = Math.abs(gx - p.x);
        if (Math.abs(yHit - GY) < HG + 7 && dg < 42) {
          const kp = m.keeperOf(m.opp(team));
          let ty = U.clamp(yHit, GY - HG + 0.55, GY + HG - 0.55);
          if (kp && Math.abs(ty - kp.y) < 1.6) ty = kp.y < GY ? GY + HG - 0.7 : GY - HG + 0.7;
          const [tx2, ty2] = U.norm(gx - p.x, ty - p.y);
          const k = assist * 0.85;
          [nx, ny] = U.norm(nx * (1 - k) + tx2 * k, ny * (1 - k) + ty2 * k);
        }
      }
      const X = p.abx;
      const press = m.pressureOf(p);
      const distG = Math.abs(gx - p.x);
      let sig = 0.018 + (1 - p.a.sho / 100) * 0.1 + press * 0.03 * (X && X.shotPress || 1) + power * power * 0.04 + m.surf.err + Math.max(0, distG - 22) * 0.0016 * (X && X.shotLong || 1);
      if (X) sig *= (X.shotErr || 1) * (kind === 'lobshot' ? (X.lobErr || 1) : 1) * (kind === 'fk' ? (X.fkErr || 1) : 1);
      if (p.sprint) sig += 0.01;
      if (!p.ctrlHuman) sig /= Math.max(0.4, m.diff.passAcc * 0.9 + 0.1);
      const err = m.rng.gauss() * sig;
      const ca = Math.cos(err), sa = Math.sin(err);
      const fdx = nx * ca - ny * sa, fdy = nx * sa + ny * ca;
      const speed = (11 + power * 13.5) * (0.9 + (p.a.sho / 100) * 0.2) * (X && X.shotPow || 1);
      let vz = 0.6 + power * 1.1 + m.rng.range(-0.3, 0.6);
      if (kind === 'lobshot') vz = 3.8 + power * 1.4;
      if (power > 0.9 && !(X && X.noSky) && m.rng.chance(0.18 + press * 0.15)) vz += m.rng.range(1.5, 4.5);
      this.launch(p, fdx, fdy, speed, vz, 'shot');
      b.shotBy = p;
      b.offsideSet = null;
      team.stats.shots++; p.st.shots++;
      // predicted on-target flag
      const tg = (gx - p.x) / (fdx || 1e-6);
      if (tg > 0 && (gx - p.x) * fdx > 0) {
        const yy = p.y + fdy * tg;
        const tflight = Math.abs(gx - p.x) / Math.max(1, Math.abs(fdx) * speed);
        const zz = 0.02 + vz * tflight - 0.5 * G * tflight * tflight;
        // low drives bounce and keep rolling, so only a high ball can be over the bar
        b.shotOn = Math.abs(yy - GY) < HG && (vz < 3.2 || (zz < 2.44 && zz > 0));
      } else b.shotOn = false;
      if (b.shotOn) { team.stats.sot++; p.st.sot++; }
      this.emit('shot', { by: p, power, on: b.shotOn, dist: distG, team });
      return true;
    }

    // ---------- offside ----------
    markOffside(p, kind) {
      const b = this.ball;
      b.offsideSet = null;
      if (this.noOffsideNext) { this.noOffsideNext = false; return; }
      if (!this.set.offside) return;
      const team = p.team, opp = this.teams[1 - team.idx];
      // second-last opponent (incl. GK) in team's attack depth
      const ds = opp.players.map((q) => team.depth(q.x)).sort((a, c) => c - a);
      const line = ds.length > 1 ? ds[1] : 0.5;
      const bd = Math.max(team.depth(this.ball.x), team.depth(p.x));
      const set = [];
      team.players.forEach((q) => {
        if (q === p || !q.onPitch) return;
        const qd = team.depth(q.x);
        if (qd > 0.5 && qd > line + 0.002 && qd > bd + 0.002) set.push(q.id);
      });
      b.offsideSet = set.length ? set : null;
      b.offsideTeam = team.idx;
      b.offsideSpotBall = { x: this.ball.x, y: this.ball.y };
    }

    // ---------- control & contacts ----------
    updateContacts(dt) {
      const b = this.ball, m = this;
      if (b.owner) {
        const o = b.owner;
        // keeper hold timers & tackle contact are handled in rules/ai
        return;
      }
      // keepers with extended reach first
      let best = null, bs = -1e9;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (!p.onPitch || p.noCtl > 0 || p === b.restartBy) continue;
        if (p.state === 'down' || p.state === 'getup' && p.stT > 0.25) continue;
        if (this.mode !== 'play') continue;
        const d = U.dist2(p.x, p.y, b.x, b.y);
        let reach = 0.95;
        if (!p.isGK && b.passTarget === p) reach = FCK.PC.r1; // intended receiver: generous first touch
        else if (!p.isGK && b.lastTouch && b.lastTouch.ti === p.ti && b.lastTouch !== p && /^(pass|through|lob)$/.test(b.lastKind)) reach = FCK.PC.r2;
        if (p.isGK) reach = (p.state === 'dive' ? 2.1 : 1.15) + (p.abx && p.abx.gkReach || 0);
        if (p.state === 'slide') reach = 1.25;
        if (p.abx && !p.isGK) reach += (p.abx.reachLoose || 0) + (b.passTarget === p ? (p.abx.touch || 0) : 0);
        const hmax = p.isGK ? 2.45 : 1.15;
        if (b.z > hmax) continue;
        if (d > reach) continue;
        const sc = (p.a.dri / 100) * 0.4 + this.rng.next() * 0.6 - d * 0.25 + (p.isGK ? 0.3 : 0);
        if (sc > bs) { bs = sc; best = p; }
      }
      if (!best) return;
      const p = best;
      if (p.isGK && b.lastTouch && b.lastTouch.ti !== p.ti || (p.isGK && sp > 9)) {
        this.keeperTouch(p);
        return;
      }
      // field player
      const rel = Math.sqrt((b.vx - p.vx) * (b.vx - p.vx) + (b.vy - p.vy) * (b.vy - p.vy));
      const skill = (p.a.dri * 0.6 + p.a.pas * 0.4) / 100;
      const recvOk = b.passTarget === p || (b.lastTouch && b.lastTouch.ti === p.ti && /^(pass|through|lob)$/.test(b.lastKind));
      if (!(p.abx && p.abx.noDeflect) && rel > (recvOk ? 22 : 17) && this.rng.next() > skill * 0.9 + (recvOk ? 0.25 : 0) - (rel - (recvOk ? 22 : 17)) * 0.03) {
        // deflection / bad touch
        const [nx, ny] = U.norm(b.vx + this.rng.range(-3, 3), b.vy + this.rng.range(-3, 3));
        const s2 = Math.max(4, sp * 0.45);
        b.vx = nx * s2; b.vy = ny * s2; b.vz = Math.max(b.vz, 0.5);
        this.touch(p, 'deflect');
        p.noCtl = 0.3;
        this.checkOffsideOnTouch(p);
        return;
      }
      this.gainControl(p);
    }

    gainControl(p) {
      const b = this.ball;
      const prev = b.lastTouch;
      if (!this.checkOffsideOnTouch(p)) return;
      // pass completion
      if (prev && prev.ti === p.ti && prev !== p && b.lastKind !== 'deflect' && (b.lastKind === 'pass' || b.lastKind === 'through' || b.lastKind === 'lob')) {
        p.team.stats.passOk++; prev.st.passOk++;
      }
      b.owner = p; b.vx = b.vy = b.vz = 0; b.z = 0;
      b.shotBy = null; b.passTarget = null;
      this.touch(p, 'control');
      b.lastKind = 'control';
      p.holdT = 0;
      this.hT = 0;
      b.offsideSet = null;
      if (this.adv && this.adv.team !== p.ti) { /* possession lost, handled in rules */ }
    }

    // returns false if offside was called (play stopped)
    checkOffsideOnTouch(p) {
      const b = this.ball;
      if (b.offsideSet && this.mode === 'play') {
        if (p.ti === b.offsideTeam && b.offsideSet.indexOf(p.id) >= 0) {
          b.offsideSet = null;
          this.callOffside(p);
          return false;
        }
        if (p.ti !== b.offsideTeam || true) b.offsideSet = null;
      }
      return true;
    }

    keeperTouch(k) {
      const b = this.ball, m = this;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const skill = k.a.gk / 100;
      const fromOpp = !b.lastTouch || b.lastTouch.ti !== k.ti;
      const dive = k.state === 'dive';
      const catchLimit = 10 + skill * 13 - (dive ? 3 : 0) - (b.z > 1.5 ? 2 : 0) - (this.surf.mu < 2.6 ? 1.5 : 0);
      let pCatch = U.clamp(0.4 + skill * 0.55 - Math.max(0, sp - 11) * 0.035 + (k.abx && k.abx.gkCatch || 0), 0.05, 0.97);
      if (!fromOpp) pCatch = 0.0; // back-pass: play with feet (no hand)
      if (!fromOpp) {
        // keeper controls with feet
        if (sp < 14 || true) { this.gainControl(k); return; }
      }
      if (b.shotBy) { /* counted below */ }
      if (sp <= catchLimit && m.rng.next() < pCatch) {
        k.team.stats.saves += b.shotBy || fromOpp && sp > 7 ? 1 : 0;
        if (sp > 7) k.st.saves++;
        const wasShot = !!b.shotBy || sp > 8;
        b.owner = k; b.vx = b.vy = b.vz = 0; b.z = 0.9; b.offsideSet = null;
        this.touch(k, 'catch');
        k.state = k.state === 'dive' ? 'getup' : 'hold'; k.stT = 0.5; k.holdT = 0;
        if (k.state === 'getup') { k.stT = 0.6; }
        b.shotBy = null; b.passTarget = null;
        this.hT = 0;
        if (wasShot) this.emit('save', { by: k, kind: 'catch', team: k.ti });
        k.holdingSince = this.time;
        if (k.state !== 'hold') k.pendingHold = true;
        return;
      }
      // parry
      const wasShot = !!b.shotBy || sp > 8;
      const side = b.y < k.y ? -1 : 1;
      const [nx, ny] = U.norm(-b.vx * 0.3 + this.rng.range(-3, 3) + k.team.dir * 4, b.vy * 0.2 + side * (3 + this.rng.range(0, 5)));
      b.vx = nx * Math.max(5, sp * 0.4); b.vy = ny * Math.max(5, sp * 0.4); b.vz = this.rng.range(1.2, 4.2);
      if (fromOpp && this.rng.chance(0.3)) { // tipped behind the goal line -> corner
        b.vx = -k.team.dir * this.rng.range(5, 9); b.vy = side * this.rng.range(5, 9); b.vz = this.rng.range(0.5, 2.5);
      }
      this.touch(k, 'parry'); k.noCtl = 0.5;
      b.shotBy = null; b.offsideSet = null;
      if (wasShot) { k.team.stats.saves++; k.st.saves++; this.emit('save', { by: k, kind: 'parry', team: k.ti }); }
    }

    // ---------- human control ----------
    inputFor(s) { return s.input || { dx: 0, dy: 0, sprint: false, held: [false, false, false, false], pressed: [false, false, false, false], released: [false, false, false, false], pause: false }; }

    assignHumans(dt) {
      const b = this.ball;
      for (let ti = 0; ti < 2; ti++) {
        const team = this.teams[ti];
        if (!team.humans.length) continue;
        const takenIds = new Set();
        // tied slot (pro career): always exactly its own player, nobody else
        const free = team.humans.filter((s) => !s.lock);
        team.humans.forEach((s) => {
          if (!s.lock) return;
          s.player = this.lockPlayer(team);
          if (s.player) { takenIds.add(s.player.id); s.lock.done = true; }
        });
        if (!free.length) { team.players.forEach((q) => { q.ctrl = -1; }); team.humans.forEach((s) => { if (s.player) s.player.ctrl = s.i; }); continue; }
        free.forEach((s) => {
          s.holdSwitch = Math.max(0, s.holdSwitch - dt);
          if (s.player && (!s.player.onPitch || s.player.team !== team)) s.player = null;
        });
        // restart taker
        const r = this.restart;
        free.forEach((s, hi) => {
          let want = null;
          if (this.mode === 'restart' && r && r.team === ti && r.taker && hi === 0) want = r.taker;
          else if (this.gkOverride && this.gkOverride.team === ti && hi === 0 && this.set.gkManual && this.mode !== 'restart') want = this.keeperOf(team);
          else if (b.owner && b.owner.ti === ti && hi === 0 && s.holdSwitch <= 0 && this.mode !== 'restart') want = b.owner;
          s.forced = want;
        });
        // forced assignments
        free.forEach((s) => {
          if (s.forced) {
            if (s.player !== s.forced) { s.player = s.forced; }
            takenIds.add(s.player.id);
          }
        });
        // ball reference point
        let bx = b.x + b.vx * 0.4, by = b.y + b.vy * 0.4;
        if (this.mode === 'restart' && r) { bx = r.x; by = r.y; }
        free.forEach((s) => {
          if (s.forced) return;
          const cur = s.player && !takenIds.has(s.player.id) ? s.player : null;
          let best = null, bd = 1e9;
          for (let i = 0; i < team.players.length; i++) {
            const q = team.players[i];
            if (!q.onPitch || takenIds.has(q.id)) continue;
            if (q.isGK && !(this.gkOverride && this.gkOverride.team === ti)) continue;
            if (q.ctrl >= 0 && q.ctrl !== s.i) continue;
            const d = U.dist2(q.x, q.y, bx, by);
            if (d < bd) { bd = d; best = q; }
          }
          let pick = cur;
          if (!cur) pick = best;
          else if (s.holdSwitch <= 0) {
            const curD = U.dist2(cur.x, cur.y, bx, by);
            const noBall = !b.owner || b.owner.ti !== ti;
            if (best && best !== cur && noBall && curD - bd > 2.8) pick = best;
            if (cur.state === 'down') pick = best || cur;
            if (b.owner && b.owner.ti === ti && cur !== b.owner && cur.isGK) pick = best || cur;
          }
          if (pick) takenIds.add(pick.id);
          s.player = pick;
        });
        // write back ctrl flags
        team.players.forEach((q) => { q.ctrl = -1; });
        team.humans.forEach((s) => { if (s.player) s.player.ctrl = s.i; });
      }
    }

    humanSwitch(s, dirx, diry) {
      if (s.lock) return;
      const team = this.teams[s.team], b = this.ball;
      const cur = s.player;
      let best = null, bs = -1e9;
      for (let i = 0; i < team.players.length; i++) {
        const q = team.players[i];
        if (!q.onPitch || q === cur || (q.isGK && !this.set.gkManual) || (q.ctrl >= 0 && q.ctrl !== s.i)) continue;
        const dB = U.dist2(q.x, q.y, b.x, b.y);
        let sc = -dB;
        if (dirx || diry) {
          const [nx, ny] = U.norm(q.x - (cur ? cur.x : b.x), q.y - (cur ? cur.y : b.y));
          sc += (nx * dirx + ny * diry) * 12;
        }
        if (sc > bs) { bs = sc; best = q; }
      }
      if (best) { if (cur) cur.ctrl = -1; s.player = best; best.ctrl = s.i; s.holdSwitch = 0.9; this.emit('switch', { slot: s.i, to: best }); }
    }

    updateHumans(dt) {
      const m = this, b = this.ball;
      for (let si = 0; si < this.slots.length; si++) {
        const s = this.slots[si];
        const inp = this.inputFor(s);
        const p = s.player;
        if (!p || !p.onPitch) continue;
        const team = this.teams[s.team];
        // ----- movement -----
        const mag = Math.min(1, Math.sqrt(inp.dx * inp.dx + inp.dy * inp.dy));
        const inRestart = this.mode === 'restart' && this.restart && this.restart.taker === p;
        if (inRestart && this.restart.phase === 'setup') continue; // walks to the spot by itself
        if (p.state === 'hold' || inRestart) {
          this.stop(p);
        } else if (!b.owner && b.passTarget === p && this.mode === 'play' && /^(pass|through|lob)$/.test(b.lastKind) && (mag < 0.5 || (b.passer && b.passer.ti === p.ti))) {
          // receiver assist: the intended receiver meets the ball by itself (the stick only nudges it)
          const ip = this.interceptFor(p);
          this.moveTo(p, ip.x + (mag > 0.12 ? inp.dx * 0.8 : 0), ip.y + (mag > 0.12 ? inp.dy * 0.8 : 0), 1);
        } else if (mag > 0.12) {
          const sprint = inp.sprint && p.stam > 0.04;
          const sp = p.cap * (sprint ? 1 : 0.72) * (b.owner === p ? 0.95 : 1) * mag;
          const [nx, ny] = U.norm(inp.dx, inp.dy);
          p.wx = nx * sp; p.wy = ny * sp; p.sprint = sprint;
        } else this.stop(p);
        // ----- actions -----
        this.humanActions(s, p, inp, team);
      }
    }

    humanActions(s, p, inp, team) {
      const m = this, b = this.ball;
      const pr = inp.pressed, rel = inp.released, held = inp.held;
      const dirx = inp.dx, diry = inp.dy;
      const hasDir = Math.abs(dirx) + Math.abs(diry) > 0.25;
      const r = this.restart;
      const taking = this.mode === 'restart' && r && r.taker === p && r.phase === 'ready';
      // charge handling (a2 shoot, a4 lob)
      [1, 3].forEach((k) => {
        if (held[k] && (b.owner === p || taking)) { s.charge = Math.min(1, (s.chargeKind === k ? s.charge : 0) + (1 / 0.85) * (1 / 60)); s.chargeKind = k; }
      });
      if (!held[1] && !held[3] && !pr[1] && !pr[3]) { /* keep until release */ }
      if (taking) { this.humanTake(s, p, inp, hasDir); return; }
      if (b.owner === p && this.mode === 'play') {
        const d = hasDir ? [dirx, diry] : [p.fx, p.fy];
        if (pr[0]) { // short pass
          const t = this.pickTarget(p, d[0], d[1], 'pass');
          if (t) { this.passTo(p, t, 'pass'); this.afterPassSwitch(s, t); }
          else this.launch(p, d[0], d[1], 12, 0, 'pass');
        } else if (pr[2]) {
          const t = this.pickTarget(p, d[0], d[1], 'through');
          if (t) { this.passTo(p, t, 'through'); this.afterPassSwitch(s, t); }
        }
        if (rel[1] && s.chargeKind === 1) {
          const pw = Math.max(0.2, s.charge);
          this.shoot(p, d[0], d[1], pw, this.assistLevel(), 'shot'); s.charge = 0; s.chargeKind = 0;
        } else if (rel[3] && s.chargeKind === 3) {
          const pw = Math.max(0.15, s.charge);
          const t = this.pickTarget(p, d[0], d[1], 'lob');
          if (t) { this.passTo(p, t, 'lob', pw); this.afterPassSwitch(s, t); }
          else this.launch(p, d[0], d[1], 8 + pw * 14, 3 + pw * 4, 'lob');
          s.charge = 0; s.chargeKind = 0;
        }
        if (!held[1] && !held[3] && !rel[1] && !rel[3]) s.charge = Math.max(0, s.charge - 0.05);
        return;
      }
      s.charge = held[1] || held[3] ? s.charge : 0;
      // ---- not in possession ----
      if (this.mode !== 'play') return;
      const oppHas = b.owner && b.owner.ti !== p.ti;
      if (p.isGK) {
        // manual keeper: any action triggers a dive in the stick direction
        if ((pr[0] || pr[1] || pr[2] || pr[3]) && p.state !== 'dive' && p.state !== 'getup') {
          this.keeperDive(p, hasDir ? dirx : 0, hasDir ? diry : (p.team.dir * -1) * 0.0);
        }
        return;
      }
      if (b.owner && b.owner.ti === p.ti && pr[0]) {
        this.callFor = { p, t: 1.2 }; return;
      }
      if (pr[0]) this.humanSwitch(s, hasDir ? dirx : 0, hasDir ? diry : 0);
      if (pr[1]) this.tackle(p, inp.sprint ? 'slide' : 'stand');
      if (pr[2]) this.callPress(p.team);
      if (pr[3]) this.callKeeperRush(p.team);
    }

    assistLevel() {
      const base = this.set.assist;
      return FCK.profile === 'kids' ? Math.min(1, base + 0.3) : base;
    }

    afterPassSwitch(s, t) {
      if (s.lock) return;
      if (t && t.team === this.teams[s.team] && t.ctrl < 0) {
        if (s.player) s.player.ctrl = -1;
        s.player = t; t.ctrl = s.i; s.holdSwitch = 0.8;
      }
    }

    // choose pass target from input direction
    pickTarget(p, dx, dy, type) {
      const team = p.team;
      let [nx, ny] = U.norm(dx, dy);
      if (nx === 0 && ny === 0) { nx = p.fx; ny = p.fy; }
      let best = null, bs = -1e9;
      const opp = this.teams[1 - team.idx];
      for (let i = 0; i < team.players.length; i++) {
        const q = team.players[i];
        if (q === p || !q.onPitch) continue;
        const vx = q.x - p.x, vy = q.y - p.y;
        const d = Math.sqrt(vx * vx + vy * vy);
        if (d < 2.2) continue;
        const cs = (vx * nx + vy * ny) / d;
        if (cs < 0.3) continue;
        if (type === 'pass' && d > 45) continue;
        let sc = cs * 14 - d * (type === 'lob' ? 0.05 : type === 'through' ? 0.05 : 0.2);
        // lane safety
        if (type !== 'lob') {
          let md = 99;
          for (let k = 0; k < opp.players.length; k++) {
            const o = opp.players[k];
            md = Math.min(md, U.segDist(o.x, o.y, p.x, p.y, q.x, q.y));
          }
          sc += Math.min(md, 4) * 0.9;
        }
        if (type === 'through') sc += (team.depth(q.x) - team.depth(p.x)) * 18;
        if (q.isGK) sc -= 10;
        if (sc > bs) { bs = sc; best = q; }
      }
      return best;
    }

    // human restart actions (throw-in, corner, free kick, penalty, goal kick, kickoff)
    humanTake(s, p, inp, hasDir) {
      const m = this, r = this.restart, pr = inp.pressed, rel = inp.released, held = inp.held;
      const team = p.team;
      const d = hasDir ? [inp.dx, inp.dy] : [team.dir, 0];
      r.aim = { x: d[0], y: d[1] };
      if (r.type === 'penalty') {
        if (rel[1] && s.chargeKind === 1) {
          const pw = Math.max(0.45, s.charge);
          this.takePenaltyShot(p, hasDir ? inp.dx : 0, hasDir ? inp.dy : 0, pw, true);
          s.charge = 0; s.chargeKind = 0;
        }
        return;
      }
      if (pr[0]) { // short
        const t = this.pickTarget(p, d[0], d[1], 'pass');
        this.restartKick(p, t, 'pass', null);
        if (t) this.afterPassSwitch(s, t);
      } else if (pr[2]) {
        const t = this.pickTarget(p, d[0], d[1], 'through');
        this.restartKick(p, t, 'through', null);
        if (t) this.afterPassSwitch(s, t);
      }
      if (rel[1] && s.chargeKind === 1) {
        const pw = Math.max(0.3, s.charge);
        if (r.type === 'freekick') {
          this.restartShot(p, d[0], d[1], pw);
        } else this.restartKick(p, this.pickTarget(p, d[0], d[1], 'lob'), 'lob', pw);
        s.charge = 0; s.chargeKind = 0;
      } else if (rel[3] && s.chargeKind === 3) {
        const pw = Math.max(0.2, s.charge);
        this.restartKick(p, this.pickTarget(p, d[0], d[1], 'lob'), 'lob', pw);
        s.charge = 0; s.chargeKind = 0;
      }
    }

    // ---------- tackles ----------
    tackle(p, kind) {
      if (p.tackleCd > 0 || p.state !== 'idle' || this.mode !== 'play') return false;
      const m = this, b = this.ball;
      if (kind === 'slide') {
        if (p.stam < 0.05) return false;
        p.state = 'slide'; p.stT = 0.55; p.tackleCd = 1.6; p.slideHit = false;
        let dx = p.vx, dy = p.vy;
        if (dx * dx + dy * dy < 1) { dx = p.fx; dy = p.fy; }
        const [nx, ny] = U.norm(dx, dy);
        p.ang = Math.atan2(ny, nx); p.fx = nx; p.fy = ny;
        const sp = Math.max(6.5, p.cap * 1.15);
        p.vx = nx * sp; p.vy = ny * sp;
        p.sprint = false;
        return true;
      }
      p.tackleCd = 0.9;
      // standing tackle: poke at ball / carrier in front
      const o = b.owner;
      let target = null;
      if (o && o.ti !== p.ti && U.dist(o, p) < 1.55) target = o;
      if (target) {
        const win = U.clamp(0.36 + (p.a.def - target.a.dri) / 190 + (p.ctrlHuman ? 0.05 : m.diff.aggr * 0.08) - (target.spd > 6 ? 0.08 : 0) + (p.abx ? p.abx.tackleWin || 0 : 0) - (target.abx ? Math.min(0.25, target.abx.shield || 0) : 0), 0.1, 0.78);
        p.team.stats.tackles++; p.st.tackles++;
        const behind = (target.fx * (target.x - p.x) + target.fy * (target.y - p.y)) > 0.3 && (target.fx * p.fx + target.fy * p.fy) > 0.5;
        if (m.rng.next() < win) {
          p.team.stats.tackleWon++; p.st.tackleWon++;
          this.dispossess(target, p, 5 + m.rng.range(0, 3));
          this.emit('tackle', { by: p, victim: target, ok: true });
          if (behind && m.rng.chance(0.07 * (0.5 + m.ref.strict))) this.callFoul(p, target, m.rng.range(0.1, 0.5));
        } else {
          p.stT = 0; p.noCtl = 0.35;
          if (m.rng.chance((behind ? 0.28 : 0.1) * (0.5 + m.ref.strict) * (p.abx ? (p.abx.foul || 1) : 1))) this.callFoul(p, target, m.rng.range(0.1, 0.55));
        }
      }
      return true;
    }

    dispossess(victim, by, kickSpeed) {
      const b = this.ball;
      b.owner = null;
      let dx = by.x - victim.x + this.rng.range(-0.8, 0.8), dy = by.y - victim.y + this.rng.range(-0.8, 0.8);
      const [nx, ny] = U.norm(dx + victim.fx * 0.8, dy + victim.fy * 0.8);
      b.x = victim.x + victim.fx * 0.4; b.y = victim.y + victim.fy * 0.4;
      b.vx = nx * kickSpeed; b.vy = ny * kickSpeed; b.vz = 0.4;
      victim.noCtl = 0.5; victim.stT = 0.3;
      this.touch(by, 'tackle'); by.noCtl = 0.12;
    }

    updateSlides() {
      const b = this.ball;
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i];
        if (p.state !== 'slide' || p.slideHit) continue;
        const opp = this.teams[1 - p.ti].players;
        for (let k = 0; k < opp.length; k++) {
          const q = opp[k];
          if (!q.onPitch || q.state === 'down') continue;
          const d = U.dist2(p.x, p.y, q.x, q.y);
          const ballNear = !b.owner && U.dist2(p.x, p.y, b.x, b.y) < 1.1;
          if (d < 1.15) {
            p.slideHit = true;
            const hasBall = b.owner === q;
            const behind = (q.fx * p.fx + q.fy * p.fy) > 0.45;
            const winP = U.clamp(0.4 + (p.a.def - q.a.dri) / 150 + (p.ctrlHuman ? 0.04 : 0) + (p.abx ? (p.abx.slideWin || 0) + (p.abx.tackleWin || 0) * 0.5 : 0) - (q.abx ? Math.min(0.25, (q.abx.shield || 0) + (q.abx.slideShield || 0)) : 0), 0.1, 0.85);
            p.team.stats.tackles++; p.st.tackles++;
            if (hasBall && this.rng.next() < winP) {
              p.team.stats.tackleWon++; p.st.tackleWon++;
              this.dispossess(q, p, 6 + this.rng.range(0, 4));
              q.state = 'down'; q.stT = 0.5;
              this.emit('tackle', { by: p, victim: q, ok: true, slide: true });
              if (behind && this.rng.chance(0.2 * (0.4 + this.ref.strict))) this.callFoul(p, q, this.rng.range(0.25, 0.7));
            } else {
              // contact without winning ball -> foul (probability depends on referee)
              const sev = U.clamp(this.rng.range(0.2, 0.75) + (behind ? 0.2 : 0) + (p.spd > 7 ? 0.08 : 0), 0, 1);
              q.state = 'down'; q.stT = 0.8; q.vx *= 0.2; q.vy *= 0.2;
              if (hasBall) { b.owner = null; b.vx = p.vx * 0.5; b.vy = p.vy * 0.5; q.noCtl = 0.6; this.touch(p, 'tackle'); }
              if (this.rng.next() < (0.45 + this.ref.strict * 0.5) * (p.abx ? (p.abx.foul || 1) * (p.abx.slideFoul || 1) : 1)) this.callFoul(p, q, sev);
              else this.emit('tackle', { by: p, victim: q, ok: false, slide: true });
            }
            break;
          } else if (ballNear && !b.owner && d < 1.8) {
            // slide gets the ball loose
            p.slideHit = true;
            this.touch(p, 'tackle');
            const [nx, ny] = U.norm(p.fx + this.rng.range(-0.3, 0.3), p.fy + this.rng.range(-0.3, 0.3));
            b.vx = nx * 7; b.vy = ny * 7; p.noCtl = 0.2;
            break;
          }
        }
      }
    }

    // ---------- keeper dive (shared) ----------
    keeperDive(k, dx, dy, need) {
      if (k.state === 'dive') return;
      let [nx, ny] = U.norm(dx, dy);
      if (nx === 0 && ny === 0) { nx = k.team.dir; ny = 0; }
      k.state = 'dive'; k.stT = 0.65; k.ang = Math.atan2(ny, nx); k.fx = nx; k.fy = ny;
      let sp = 5.5 + (k.a.gk / 100) * 3.5;
      const dvm = k.abx && k.abx.gkDive || 1;
      if (need != null) sp = U.clamp((need + 0.85) / 0.65, 4, 6 + (k.a.gk / 100) * 4);
      sp *= dvm;
      k.vx = nx * sp; k.vy = ny * sp;
    }
    // keeper throws himself at the feet of a dribbler in the box
    keeperSmother(k, target) {
      const b = this.ball;
      if (k.state !== 'idle' || b.owner !== target || this.mode !== 'play') return;
      const [nx, ny] = U.norm(target.x - k.x, target.y - k.y);
      k.state = 'dive'; k.stT = 0.6; k.tackleCd = 1.2; k.ang = Math.atan2(ny, nx); k.fx = nx; k.fy = ny;
      k.vx = nx * 6; k.vy = ny * 6;
      const win = U.clamp(0.45 + (k.a.gk - target.a.dri) / 160 - (target.spd > 6 ? 0.1 : 0) + (k.abx && k.abx.gkCatch || 0), 0.2, 0.85);
      k.team.stats.tackles++; k.st.tackles++;
      if (this.rng.next() < win) {
        k.team.stats.tackleWon++; k.st.tackleWon++;
        b.owner = k; b.vx = b.vy = b.vz = 0; b.z = 0.9; b.offsideSet = null;
        b.shotBy = null; b.passTarget = null;
        this.touch(k, 'catch');
        k.holdingSince = this.time; k.holdT = 0; k.pendingHold = true;
        k.st.saves++; k.team.stats.saves++;
        this.emit('save', { by: k, kind: 'catch', team: k.ti });
      } else {
        // ball squirts loose, sometimes it is a foul
        this.dispossess(target, k, 4 + this.rng.range(0, 3));
        if (this.rng.chance(0.18 * (0.5 + this.ref.strict))) this.callFoul(k, target, this.rng.range(0.2, 0.6));
      }
    }
    callPress(team) { team.pressCall = 2.5; }
    callKeeperRush(team) { team.rushCall = 1.5; }

    // ---------- crowd ----------
    updateCrowd(dt) {
      const c = this.crowd, b = this.ball;
      const gx = this.poss >= 0 ? this.teams[this.poss].goalX : L / 2;
      const prox = this.poss >= 0 ? U.clamp(1 - Math.abs(b.x - gx) / 40, 0, 1) : 0;
      const target = 0.25 + prox * 0.4;
      c.mood += (target - c.mood) * dt * 0.4;
    }

    // ---------- stats sampling ----------
    sample(dt) {
      this.hT += dt;
      if (this.poss >= 0) this.teams[this.poss].stats.poss += dt;
      this.heatT = (this.heatT || 0) + dt;
      if (this.heatT >= 0.25) {
        this.heatT = 0;
        for (let i = 0; i < this.players.length; i++) {
          const p = this.players[i];
          const gx = U.clamp(Math.floor((p.x / L) * 21), 0, 20), gy = U.clamp(Math.floor((p.y / W) * 14), 0, 13);
          p.heat[gy * 21 + gx]++;
          p.team.heat[gy * 21 + gx]++;
        }
      }
    }

    // ---------- replay recording ----------
    record() {
      const r = this.rec;
      const n = this.players.length;
      let f = r.frames[r.head];
      if (!f) f = r.frames[r.head] = new Float32Array(3 + n * 5);
      f[0] = this.ball.x; f[1] = this.ball.y; f[2] = this.ball.z;
      for (let i = 0; i < n; i++) {
        const p = this.players[i], o = 3 + i * 5;
        const st = p.state === 'slide' ? 1 : p.state === 'down' ? 2 : p.state === 'dive' ? 3 : p.state === 'celebrate' ? 4 : p.state === 'hold' ? 5 : 0;
        f[o] = p.x; f[o + 1] = p.y; f[o + 2] = p.ang; f[o + 3] = p.spd; f[o + 4] = st;
      }
      r.head = (r.head + 1) % r.cap; r.n = Math.min(r.n + 1, r.cap);
    }
    // returns array of Float32Array frames (oldest->newest), recorded at 30 Hz
    getClip(seconds) {
      const r = this.rec;
      const cnt = Math.min(r.n, Math.round(seconds * 30));
      const out = [];
      for (let i = cnt; i >= 1; i--) {
        const idx = (r.head - i + r.cap * 2) % r.cap;
        out.push(r.frames[idx]);
      }
      return out;
    }
  }

  FCK.Player = Player; FCK.Team = Team; FCK.Match = Match;
  FCK.SURFACE = SURFACE;
})((globalThis.FCK = globalThis.FCK || {}));
