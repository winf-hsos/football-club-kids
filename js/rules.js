/* FCK - rules.js : game flow, restarts, fouls/cards, offside, goals, substitutions, periods, shootout */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const P = FCK.PITCH;
  const L = P.L, W = P.W, GY = P.cy, HG = P.goalW / 2;
  const M = FCK.Match.prototype;

  Object.assign(M, {
    // ================= main loop =================
    update(dt) {
      if (this.mode === 'over') return;
      this.time += dt;
      this.fxState.shake = Math.max(0, this.fxState.shake - dt * 1.4);
      this.fxState.flash = Math.max(0, this.fxState.flash - dt * 2);
      if (this.callFor) { this.callFor.t -= dt; if (this.callFor.t <= 0) this.callFor = null; }
      this.teams.forEach((t) => { if (t.pressCall > 0) t.pressCall -= dt; if (t.rushCall > 0) t.rushCall -= dt; });
      switch (this.mode) {
        case 'play': this.stepPlay(dt); break;
        case 'restart': this.stepRestart(dt); break;
        case 'goal': this.stepGoal(dt); break;
        case 'injury': this.stepInjury(dt); break;
        case 'break': this.stepBreak(dt); break;
        case 'goalwait': this.stepIdle(dt); break;
        case 'shootout': this.stepShootout(dt); break;
        default: break;
      }
      this.recAcc = (this.recAcc || 0) + dt;
      while (this.recAcc >= 1 / 30) { this.recAcc -= 1 / 30; if (this.mode !== 'break') this.record(); }
    },

    simCommon(dt, live) {
      this.assignHumans(dt);
      FCK.AI.update(this, dt);
      this.updateHumans(dt);
      for (let i = 0; i < this.players.length; i++) this.integrate(this.players[i], dt);
      this.separate();
      this.updateBall(dt);
      if (live) { this.updateContacts(dt); this.updateSlides(); }
      const b = this.ball;
      if (b.owner) this.poss = b.owner.ti;
      else if (this.lastTouchTeam >= 0 && this.clock - b.touchT < 3) this.poss = this.lastTouchTeam;
      this.sample(dt);
      this.updateCrowd(dt);
      this.updateRef(dt);
    },

    stepPlay(dt) {
      this.clock += dt * this.rate;
      this.simCommon(dt, true);
      if (this.mode !== 'play') return;
      this.holdKeeper(dt);
      this.checkBounds();
      if (this.mode !== 'play') return;
      this.updateAdvantage(dt);
      this.checkPeriodEnd();
      if (this.mode === 'play') this.autoSubs();
    },

    stepIdle(dt) { this.simCommon(dt, false); },

    stepGoal(dt) {
      this.modeT += dt;
      const g = this.lastGoal;
      // celebration: scoring team runs to scorer, others stand still
      this.players.forEach((p) => { this.stop(p); });
      if (g && g.scorer) {
        const sc = g.scorer;
        this.teams[g.team].players.forEach((p) => {
          if (p === sc || p.state === 'celebrate') return;
          if (this.modeT < 3.2) this.moveTo(p, sc.x + (p.id % 3) * 0.9 - 0.9, sc.y + ((p.id >> 1) % 3) * 0.9 - 0.9, 0.55);
        });
        if (this.modeT < 0.2 && sc.state !== 'celebrate') { sc.state = 'celebrate'; sc.stT = 2.5; }
        if (this.modeT < 3.0 && sc.state === 'celebrate') {
          // scorer runs towards the nearest corner flag
          const cx = sc.x < L / 2 ? 2 : L - 2, cy = sc.y < GY ? 2 : W - 2;
          this.moveTo(sc, cx, cy, 0.7);
        }
      }
      this.simCommon(dt, false);
      if (this.modeT > 4.2) {
        if (this.autoProceed) this.proceed();
        else { this.mode = 'goalwait'; this.emit('goalwait', { goal: this.lastGoal }); }
      }
    },

    stepInjury(dt) {
      this.modeT += dt;
      this.simCommon(dt, false);
      const inj = this.injuryP;
      if (inj) { inj.state = 'down'; inj.stT = 2; }
      if (this.modeT > 3.4) this.resolveInjury();
    },

    stepBreak(dt) {
      this.modeT += dt;
      this.players.forEach((p) => { this.stop(p); p.vx *= 0.9; p.vy *= 0.9; });
      if (this.autoProceed && this.modeT > 0.5) this.proceed();
    },

    proceed() {
      if (this.mode === 'goalwait' || this.mode === 'goal') {
        this.emit('resume', {});
        this.startKickoff(this.kickoffTeam);
      } else if (this.mode === 'break') {
        const k = this.breakKind;
        if (k === 'pen') { this.startShootout(); return; }
        this.teams.forEach((t) => { t.dir = -t.dir; });
        this.added = 0; this.addedShown = false; this.stoppageAcc = 0;
        if (k === 'half') { this.period = 2; this.periodEnd = 5400; this.clock = 2700; this.startKickoff(1); }
        else if (k === 'et') { this.period = 3; this.periodEnd = 6300; this.clock = 5400; this.etFirst = this.rng.int(0, 1); this.startKickoff(this.etFirst); }
        else if (k === 'etHalf') { this.period = 4; this.periodEnd = 7200; this.clock = 6300; this.startKickoff(1 - this.etFirst); }
        this.emit('period', { period: this.period });
      }
    },

    // ================= bounds, goals =================
    checkBounds() {
      const b = this.ball;
      if (b.x >= 0 && b.x <= L && b.y >= 0 && b.y <= W) return;
      if (b.owner && b.owner.isGK && this.inBox(b.owner.x, b.owner.y, b.owner.team)) return;
      if (b.y < 0 || b.y > W) {
        if (b.x < 0 || b.x > L) { /* corner region: fall through to end line */ } else {
          if (this.resolveAdvOnStop()) return;
          const t = this.lastTouchTeam < 0 ? 0 : this.lastTouchTeam;
          this.emit('out', { kind: 'side', last: b.lastTouch });
          this.setRestart('throwin', 1 - t, U.clamp(b.x, 1, L - 1), b.y < 0 ? 0 : W);
          return;
        }
      }
      // end line
      const side = b.x < 0 ? 0 : L;
      const inGoal = Math.abs(b.y - GY) < HG && b.z < P.goalH;
      if (b.x < 0 || b.x > L) {
        if (inGoal) { this.goal(side); return; }
        if (this.resolveAdvOnStop()) return;
        const def = this.teams.find((t) => t.ownGoalX === side);
        const att = this.teams[1 - def.idx];
        const last = this.lastTouchTeam < 0 ? att.idx : this.lastTouchTeam;
        this.emit('out', { kind: 'end', last: b.lastTouch });
        if (last === def.idx) {
          const cy = b.y < GY ? 0.2 : W - 0.2;
          this.setRestart('corner', att.idx, side === 0 ? 0.2 : L - 0.2, cy);
          att.stats.corners++;
        } else {
          this.setRestart('goalkick', def.idx, side === 0 ? P.sixD : L - P.sixD, GY);
        }
      }
    },

    goal(side) {
      const b = this.ball;
      const att = this.teams.find((t) => t.goalX === side);
      const def = this.teams[1 - att.idx];
      const by = b.lastTouch;
      const og = !!by && by.ti === def.idx;
      att.score++;
      let scorer = by, assist = null;
      if (og) { by.st.og++; scorer = null; }
      else {
        if (by) by.st.goals++;
        const pt = b.prevTouch;
        if (pt && pt !== by && pt.ti === att.idx && this.clock - b.touchT < 8) { assist = pt; pt.st.assists++; }
      }
      def.players.forEach((p) => { if (p.isGK) p.st.conceded++; });
      const g = { team: att.idx, scorer, assist, og, ogBy: og ? by : null, minute: this.minute(), clock: this.clock, period: this.period };
      this.goals.push(g); this.lastGoal = g;
      this.stoppageAcc += 28;
      this.adv = null;
      this.mode = 'goal'; this.modeT = 0;
      this.kickoffTeam = def.idx;
      this.fxState.shake = 1; this.fxState.flash = 1;
      this.crowd.mood = 1;
      this.emit('goal', { goal: g, team: att, scorer, assist, og, score: [this.teams[0].score, this.teams[1].score] });
      // net: ball slows
      b.vx *= 0.25; b.vy *= 0.25; b.shotBy = null; b.offsideSet = null;
    },

    // ================= referee =================
    updateRef(dt) {
      const r = this.ref, b = this.ball;
      let tx = b.x - (this.teams[0].dir) * 0 + 6, ty = b.y + 7;
      if (this.mode === 'restart' && this.restart) { tx = this.restart.x + 5; ty = this.restart.y + (this.restart.y < GY ? 4 : -4); }
      tx = U.clamp(tx, 3, L - 3); ty = U.clamp(ty, 2, W - 2);
      const dx = tx - r.x, dy = ty - r.y, d = Math.sqrt(dx * dx + dy * dy);
      const sp = Math.min(6.5, d * 1.5);
      if (d > 0.2) { r.vx = (dx / d) * sp; r.vy = (dy / d) * sp; } else { r.vx = r.vy = 0; }
      r.x += r.vx * dt; r.y += r.vy * dt;
    },

    // ================= keeper holding / distribution =================
    holdKeeper(dt) {
      const b = this.ball;
      const o = b.owner;
      if (!o || !o.isGK) return;
      if (o.state === 'getup' && o.pendingHold && o.stT <= 0.05) { o.state = 'hold'; o.pendingHold = false; }
      if (o.state !== 'hold' && o.state !== 'idle') return;
      if (o.state === 'idle') o.state = 'hold';
      o.holdT += dt;
      if (o.ctrl >= 0) {
        if (o.holdT > 6) FCK.AI.keeperRelease(this, o);
        return;
      }
      if (o.holdT > 1.6 + this.diff.react * 2) FCK.AI.keeperRelease(this, o);
    },

    // ================= restarts =================
    startKickoff(teamIdx) {
      this.ball.offsideSet = null; this.ball.lastTouch = null; this.lastTouchTeam = -1;
      this.setRestart('kickoff', teamIdx, L / 2, GY);
    },

    pickTaker(type, team, x, y) {
      const ps = team.players.filter((p) => p.onPitch);
      const field = ps.filter((p) => !p.isGK);
      // pro career: the tied player takes the set pieces the coach gave him
      const lk = this.lockPlayer(team);
      if (lk && !lk.isGK && this.lock.setp && this.lock.setp.indexOf(type) >= 0 && (type !== 'throwin' || U.dist2(lk.x, lk.y, x, y) < 900)) return lk;
      if (type === 'goalkick') return this.keeperOf(team) || field[0];
      if (type === 'kickoff') {
        return field.slice().sort((a, c) => team.depth(c.x) - team.depth(a.x) || (c.slot - a.slot))[0] || field[0];
      }
      if (type === 'throwin') {
        return field.slice().sort((a, c) => U.dist2(a.x, a.y, x, y) - U.dist2(c.x, c.y, x, y))[0];
      }
      if (type === 'corner') {
        // one of the three nearest outfield players, the best passer of them (nobody has to run across the pitch)
        const near = field.slice().sort((a, c) => U.dist2(a.x, a.y, x, y) - U.dist2(c.x, c.y, x, y)).slice(0, 3);
        return near.sort((a, c) => c.a.pas - a.a.pas)[0] || field[0];
      }
      if (type === 'penalty') {
        return field.slice().sort((a, c) => c.a.sho - a.a.sho)[0];
      }
      // free kick: the best shooter / passer within reach of the spot
      const dg = U.dist2(x, y, team.goalX, GY);
      const reach = field.filter((q) => U.dist2(q.x, q.y, x, y) < 26);
      return (reach.length ? reach : field).slice().sort((a, c) => {
        const sa = (dg < 32 ? a.a.sho : a.a.pas) - U.dist2(a.x, a.y, x, y) * 0.5;
        const sc = (dg < 32 ? c.a.sho : c.a.pas) - U.dist2(c.x, c.y, x, y) * 0.5;
        return sc - sa;
      })[0];
    },

    setRestart(type, teamIdx, x, y, opts) {
      const team = this.teams[teamIdx];
      this.adv = null; this.pendingOffside = null;
      this.ball.offsideSet = null;
      this.mode = 'restart'; this.modeT = 0;
      // sub-goalie fix for goalkick
      const b = this.ball;
      this.setBallAt(x, y);
      b.restartBy = null;
      const taker = this.pickTaker(type, team, x, y);
      // nobody runs half a pitch for a corner: a far-away taker is brought in close to the spot (a cut, like on TV)
      if (taker && type !== 'kickoff' && type !== 'goalkick' && U.dist2(taker.x, taker.y, x, y) > 16) {
        const [ux, uy] = U.norm(taker.x - x, taker.y - y);
        taker.x = U.clamp(x + ux * 11, 0.5, L - 0.5); taker.y = U.clamp(y + uy * 11, 0.5, W - 0.5);
        taker.vx = taker.vy = 0; taker.spd = 0; if (taker.state !== 'idle') { taker.state = 'idle'; taker.stT = 0; }
      }
      const r = { type, team: teamIdx, x, y, phase: 'setup', t: 0, taker, wall: [], aim: null, delay: 0.35 + this.rng.range(0, 0.4) + this.diff.react * 0.6, targets: new Map(), indirect: !!(opts && opts.indirect), spotKeeper: null };
      this.restart = r;
      this.planRestart(r);
      r.ess = this.essentialSet(r);
      if (type === 'kickoff' || type === 'penalty') this.snapToTargets(r);
      this.autoSubsAtStop();
      this.emit('restart', { kind: type, team, taker, x, y });
      this.players.forEach((p) => { if (p.state === 'hold') p.state = 'idle'; });
    },

    // players that really have to be in place before a restart may be taken (the rest keeps jogging into shape)
    essentialSet(r) {
      const ess = new Set([r.taker]);
      const O = this.teams[1 - r.team];
      if (r.type === 'penalty' || r.type === 'kickoff') { r.targets.forEach((tg, p) => ess.add(p)); return ess; }
      r.wall.forEach((p) => ess.add(p));
      const rad = r.type === 'freekick' ? 13 : r.type === 'corner' ? 9.8 : r.type === 'throwin' ? 2.5 : 0;
      if (rad) O.players.forEach((p) => { if (p.onPitch && !p.isGK && U.dist2(p.x, p.y, r.x, r.y) < rad + 0.6) ess.add(p); });
      if (r.type === 'goalkick') {
        const gx = this.teams[r.team].ownGoalX;
        O.players.forEach((p) => { if (p.onPitch && Math.abs(p.x - gx) < P.boxD + 3 && Math.abs(p.y - GY) < P.boxW / 2 + 3) ess.add(p); });
      }
      return ess;
    },

    // a kick-off is a cut (after a goal or at the start of a half): everyone is placed straight away
    snapToTargets(r) {
      r.targets.forEach((tg, p) => {
        if (r.type === 'penalty' && (p === r.taker || p.isGK)) return;
        p.x = tg.x; p.y = tg.y; p.vx = p.vy = 0; p.spd = 0;
        if (p.state !== 'idle') { p.state = 'idle'; p.stT = 0; }
        const [nx, ny] = U.norm(r.x - p.x, r.y - p.y);
        if (nx || ny) { p.ang = Math.atan2(ny, nx); p.fx = nx; p.fy = ny; }
      });
      if (r.type === 'kickoff') r.delay = 0.9;
      this.emit('cut', { kind: r.type });
    },

    planRestart(r) {
      const m = this;
      const T = this.teams[r.team], O = this.teams[1 - r.team];
      const tg = r.targets;
      const ball = { x: r.x, y: r.y };
      const form = (p, bx, by) => FCK.AI.formationPos(m, p, bx, by, p.ti === T.idx);
      const set = (p, x, y) => { tg.set(p, { x, y }); };
      const free = (team) => team.players.filter((p) => p.onPitch && p !== r.taker);
      const awayFromBall = (x, y, rad) => {
        const dx = x - ball.x, dy = y - ball.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d >= rad) return [x, y];
        if (d < 0.01) return [x + rad, y];
        return [ball.x + (dx / d) * rad, ball.y + (dy / d) * rad];
      };
      if (r.type === 'kickoff') {
        T.players.forEach((p) => {
          if (p === r.taker) { set(p, L / 2 - T.dir * 0.5, GY); return; }
          let q = form(p, L / 2, GY);
          const maxd = 0.47;
          if (T.depth(q.x) > maxd) q.x = T.toX(maxd);
          set(p, q.x, q.y);
        });
        const helper = free(T).filter((p) => !p.isGK).sort((a, c) => T.depth(c.x) - T.depth(a.x))[0];
        if (helper) set(helper, L / 2 - T.dir * 0.8, GY + 2.2);
        O.players.forEach((p) => {
          let q = form(p, L / 2, GY);
          if (O.depth(q.x) > 0.47) q.x = O.toX(0.47);
          const [ax, ay] = awayFromBall(q.x, q.y, 10);
          // stay in own half
          const lim = O.dir > 0 ? Math.min(ax, L / 2 - 0.2) : Math.max(ax, L / 2 + 0.2);
          set(p, lim, ay);
        });
      } else if (r.type === 'throwin') {
        const inward = r.y < GY ? 1 : -1;
        set(r.taker, r.x, r.y + (r.y < GY ? -0.4 : 0.4));
        const mates = free(T).filter((p) => !p.isGK).sort((a, c) => U.dist2(a.x, a.y, r.x, r.y) - U.dist2(c.x, c.y, r.x, r.y));
        const offs = [[T.dir * 8, inward * 5], [-T.dir * 5, inward * 9], [T.dir * 15, inward * 2.5], [T.dir * 3, inward * 15]];
        for (let i = 0; i < Math.min(4, mates.length); i++) set(mates[i], U.clamp(r.x + offs[i][0], 2, L - 2), U.clamp(r.y + offs[i][1], 1, W - 1));
        T.players.forEach((p) => { if (!tg.has(p)) { const q = form(p, r.x, r.y); set(p, q.x, q.y); } });
        O.players.forEach((p) => { const q = form(p, r.x, r.y); const [ax, ay] = awayFromBall(q.x, q.y, 3); set(p, ax, ay); });
      } else if (r.type === 'goalkick') {
        const gx = T.ownGoalX;
        set(r.taker, gx + T.dir * P.sixD, GY);
        T.players.forEach((p) => {
          if (p === r.taker) return;
          let q = form(p, T.toX(0.25), GY);
          if (T.depth(q.x) > 0.62) q.x = T.toX(0.62);
          set(p, q.x, q.y);
        });
        O.players.forEach((p) => {
          let q = form(p, T.toX(0.3), GY);
          // outside the box of T's goal
          const dxg = Math.abs(q.x - gx);
          if (dxg < P.boxD + 2 && Math.abs(q.y - GY) < P.boxW / 2 + 2) q.x = gx + T.dir * (P.boxD + 3);
          set(p, q.x, q.y);
        });
      } else if (r.type === 'corner') {
        const gx = T.goalX, dirIn = -T.dir; // from goal line into the pitch
        set(r.taker, r.x, r.y);
        const spots = [[11, 0], [5.5, -3.2], [7.5, 3.4], [9, -8], [9.5, 8], [17, -11], [17, 11], [15, 0]];
        const att = free(T).filter((p) => !p.isGK && p !== r.taker);
        att.sort((a, c) => T.depth(c.x) - T.depth(a.x));
        const stay = att.filter((p) => p.role === 'DF').slice(-2);
        const use = att.filter((p) => stay.indexOf(p) < 0);
        const pool = spots.slice();
        use.forEach((p) => {
          if (!pool.length) return;
          let bi = 0, bd = 1e9;
          pool.forEach((s, i) => { const d = U.dist2(p.x, p.y, gx + dirIn * s[0], GY + s[1]); if (d < bd) { bd = d; bi = i; } });
          const s = pool.splice(bi, 1)[0];
          set(p, gx + dirIn * s[0], GY + s[1]);
        });
        stay.forEach((p) => set(p, T.toX(0.5), p.y < GY ? GY - 10 : GY + 10));
        const tgtList = [];
        T.players.forEach((p) => { if (tg.has(p) && p !== r.taker && !stay.includes(p) && !p.isGK) tgtList.push(p); });
        const ogx = O.ownGoalX;
        O.players.forEach((p) => {
          if (p.isGK) { set(p, ogx + O.dir * 0.8, GY + (r.y < GY ? -1.3 : 1.3)); return; }
        });
        const defs = O.players.filter((p) => !p.isGK).sort((a, c) => O.depth(c.x) - O.depth(a.x));
        const nearPost = defs[0], farPost = defs[1];
        if (nearPost) set(nearPost, ogx + O.dir * 0.7, GY + (r.y < GY ? -HG + 0.3 : HG - 0.3));
        if (farPost) set(farPost, ogx + O.dir * 0.7, GY + (r.y < GY ? HG - 0.3 : -HG + 0.3));
        const rest = defs.filter((p) => p !== nearPost && p !== farPost);
        const unmarked = tgtList.slice();
        rest.forEach((p, i) => {
          if (i >= rest.length - 2 && unmarked.length === 0) { set(p, O.toX(0.46), p.y); return; }
          let bi = -1, bd = 1e9;
          unmarked.forEach((a, k) => { const d = U.dist2(p.x, p.y, tg.get(a).x, tg.get(a).y); if (d < bd) { bd = d; bi = k; } });
          if (bi < 0) { set(p, O.toX(0.46), p.y); return; }
          const a = unmarked.splice(bi, 1)[0]; const at = tg.get(a);
          set(p, at.x + O.dir * -0.0 + (O.ownGoalX - at.x) * 0.06, at.y + (GY - at.y) * 0.08);
        });
      } else if (r.type === 'freekick') {
        const gx = T.goalX;
        const dg = U.dist2(r.x, r.y, gx, GY);
        set(r.taker, r.x - T.dir * 0.8, r.y);
        const dirG = U.norm(gx - r.x, GY - r.y);
        const nearGoal = dg < 38;
        // wall
        if (nearGoal) {
          const n = dg < 20 ? 5 : dg < 27 ? 4 : dg < 32 ? 3 : 2;
          const wc = { x: r.x + dirG[0] * 9.3, y: r.y + dirG[1] * 9.3 };
          const perp = [-dirG[1], dirG[0]];
          const cand = O.players.filter((p) => !p.isGK).sort((a, c) => U.dist2(a.x, a.y, wc.x, wc.y) - U.dist2(c.x, c.y, wc.x, wc.y)).slice(0, n);
          cand.forEach((p, i) => {
            const off = (i - (n - 1) / 2) * 0.9;
            set(p, wc.x + perp[0] * off, wc.y + perp[1] * off);
            r.wall.push(p);
          });
        }
        const boxSpots = [[11, 0], [8, -4], [8, 4], [14, -8], [14, 8], [6, 0]];
        if (dg < 40) {
          const att = free(T).filter((p) => !p.isGK).sort((a, c) => T.depth(c.x) - T.depth(a.x)).slice(0, 4);
          att.forEach((p, i) => { const s = boxSpots[i]; set(p, gx - T.dir * s[0], GY + s[1]); });
        }
        T.players.forEach((p) => { if (!tg.has(p)) { const q = form(p, r.x, r.y); if (T.depth(q.x) < T.depth(r.x) - 0.35 && !p.isGK) q.x = T.toX(T.depth(r.x) - 0.3); set(p, q.x, q.y); } });
        O.players.forEach((p) => {
          if (tg.has(p)) return;
          if (p.isGK) { set(p, O.ownGoalX + O.dir * 1.2, GY + (r.y - GY) * 0.12); return; }
          const q = form(p, r.x, r.y);
          const [ax, ay] = awayFromBall(q.x, q.y, 9.6);
          set(p, ax, ay);
        });
      } else if (r.type === 'penalty') {
        const gx = T.goalX;
        const spotX = gx - T.dir * P.penSpot;
        set(r.taker, spotX - T.dir * 2.2, GY);
        const keeper = this.keeperOf(O);
        if (keeper) set(keeper, O.ownGoalX + O.dir * 0.4, GY);
        const lineX = gx - T.dir * (P.boxD + 3.2);
        const others = this.players.filter((p) => p !== r.taker && p !== keeper && p.onPitch);
        others.forEach((p, i) => { set(p, lineX + (p.ti === T.idx ? -T.dir * 0.2 : T.dir * -0.2) * 0, GY + (i - (others.length - 1) / 2) * 1.9); });
      }
    },

    stepRestart(dt) {
      const r = this.restart;
      if (!r) { this.mode = 'play'; return; }
      r.t += dt;
      this.simCommon(dt, false);
      if (this.restart !== r) return; // a human already took it during this step
      const b = this.ball;
      // keep the ball on its spot
      if (!b.owner && r.phase !== 'free') { b.x = r.x; b.y = r.y; b.z = (r.type === 'throwin' && r.phase === 'ready') ? 2.0 : 0; b.vx = b.vy = b.vz = 0; b.curl = 0; }
      // move non-taker players to targets (AI handles via AI.update using r.targets)
      if (r.phase === 'setup') {
        const quick = r.type === 'throwin' || r.type === 'goalkick' || r.type === 'kickoff';
        const hum = r.taker && r.taker.ctrl >= 0;
        const tol = quick ? 3.2 : 1.6;
        const ess = r.ess || new Set([r.taker]);
        let ready = true, maxd = 0;
        ess.forEach((p) => {
          const tg = r.targets.get(p); if (!tg || !p.onPitch) return;
          const d = U.dist2(p.x, p.y, tg.x, tg.y);
          maxd = Math.max(maxd, d);
          if (p === r.taker ? d > 1.2 : d > tol) ready = false;
        });
        // time to walk there (about 5.5 m/s), but never an endless wait
        const base = quick ? (hum ? 0.9 : 1.2) : (hum ? 2.0 : 2.6);
        if (r.limit == null) r.limit = base + U.clamp(maxd / 5.5, 0, r.type === 'penalty' ? 3.2 : 3);
        const limit = r.limit;
        if (ready || r.t > limit) {
          // only the players that must be in place are moved, and only when they are close; the rest keeps running
          if (!ready) ess.forEach((p) => { const tg = r.targets.get(p); if (tg && p.onPitch && U.dist2(p.x, p.y, tg.x, tg.y) > 1.2) { p.x = tg.x; p.y = tg.y; p.vx = p.vy = 0; } });
          // human-controlled team mates do not walk by themselves: bring the ones near the spot onto their marks
          r.targets.forEach((tg, p) => { if (p.ctrl >= 0 && p !== r.taker && p.onPitch && U.dist2(p.x, p.y, r.x, r.y) < 14 && U.dist2(p.x, p.y, tg.x, tg.y) > 2.5) { p.x = tg.x; p.y = tg.y; p.vx = p.vy = 0; } });
          r.phase = 'ready'; r.t = 0;
          this.emit('restartReady', { restart: r });
        }
      } else if (r.phase === 'ready') {
        const humanTaker = r.taker.ctrl >= 0;
        if (humanTaker && r.t < 14) return; // wait for the player
        if (r.t >= r.delay + (humanTaker ? 0 : 0)) {
          if (humanTaker) FCK.AI.takeRestart(this, r); // timeout -> CPU takes it
          else FCK.AI.takeRestart(this, r);
        }
      }
    },

    // ---- kicks taken from restarts ----
    endRestart() {
      const r = this.restart;
      this.restart = null;
      this.mode = 'play';
      if (r) this.ball.restartBy = r.taker;
      this.hT = 0;
    },

    restartKick(p, target, type, power) {
      const r = this.restart; if (!r) return;
      const rt = r.type;
      if (!target) {
        const T = p.team;
        target = T.players.filter((q) => q !== p && q.onPitch && !q.isGK).sort((a, c) => U.dist2(a.x, a.y, r.x, r.y) - U.dist2(c.x, c.y, r.x, r.y))[0];
        if (!target) target = T.players.find((q) => q !== p);
      }
      const noOff = rt === 'throwin' || rt === 'goalkick' || rt === 'corner' || rt === 'kickoff';
      this.endRestart();
      if (noOff) this.noOffsideNext = true;
      if (rt === 'throwin') {
        // short throw along the ground-ish, long throw as a flat arc; the range depends on strength
        const reach = 14 + p.a.phy * 0.17;
        const far = U.dist(p, target) > reach;
        if (type === 'lob' && (power == null || power > 0.35)) this.passTo(p, target, 'lob', 0.3 + (power || 0) * 0.3);
        else this.passTo(p, target, 'pass', 0.2);
        const b = this.ball;
        b.z = 1.9; b.vz = Math.min(b.vz, type === 'lob' ? 4.6 : 2.2);
        // the throw leaves the hands just inside the line (the thrower stands a little outside), never straight out again
        b.y = U.clamp(b.y, 0.25, W - 0.25);
        if (far) { const f = reach / U.dist(p, target); b.vx *= Math.max(0.6, f); b.vy *= Math.max(0.6, f); }
      } else if (rt === 'goalkick' && type === 'lob') {
        this.passTo(p, target, 'lob', power != null ? Math.max(0.6, power) : 0.8);
      } else if (rt === 'kickoff') {
        // the first touch is a gentle pass, a charged kick is a long ball upfield
        this.passTo(p, target, type === 'lob' ? 'lob' : 'pass', power);
      } else this.passTo(p, target, type, power);
      this.noOffsideNext = false;
      p.team.stats.passes += 0;
      if (rt === 'corner') this.emit('corner', { by: p });
    },

    restartShot(p, dx, dy, power) {
      const r = this.restart; if (!r) return;
      const T = p.team;
      const hasWall = r.wall && r.wall.length > 0;
      // curl: start outside the wall and bend back towards the aimed side of the goal
      let k = 0;
      const [nx, ny] = U.norm(dx, dy);
      if (hasWall && (T.goalX - p.x) * nx > 0.05) {
        const yHit = p.y + ny * ((T.goalX - p.x) / nx);
        const off = yHit - GY;
        if (Math.abs(off) > 0.8 && !FCK.NO_CURL) k = -Math.sign(off) * T.dir * (0.2 + 0.28 * (p.a.sho / 100)) * (0.55 + 0.45 * power);
      }
      this.endRestart();
      const T0 = Math.abs(T.goalX - p.x) / (11 + power * 13.5);
      if (k) { const a = -k * T0 * 0.5, ca = Math.cos(a), sa = Math.sin(a); const rx = nx * ca - ny * sa, ry = nx * sa + ny * ca; dx = rx; dy = ry; }
      this.shoot(p, dx, dy, power, k ? 0 : Math.max(0.5, this.assistLevel()), 'fk');
      const b = this.ball;
      if (k) { b.curl = k; this.emit('curl', { by: p }); }
      if (hasWall) {
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const t = Math.abs(T.goalX - p.x) / Math.max(8, speed);
        b.vz = U.clamp((1.0 + 4.905 * t * t) / t, 3.5, 8);
      }
    },

    takePenaltyShot(p, dx, dy, power, human) {
      const r = this.restart; if (!r) return;
      const T = p.team, O = this.opp(T);
      const m = this, b = this.ball;
      this.endRestart();
      const keeper = this.keeperOf(O);
      let ty;
      if (human) ty = GY + U.clamp(dy, -1, 1) * (HG - 0.55) * (Math.abs(dy) > 0.25 ? 1 : 0.0);
      else ty = GY + this.rng.pick([-1, -0.85, -0.4, 0.4, 0.85, 1]) * (HG - 0.55);
      const gx = T.goalX;
      const sig = (0.014 + (1 - p.a.sho / 100) * 0.07 + (power > 0.9 ? 0.02 : 0)) * (p.abx && p.abx.penErr || 1);
      let [nx, ny] = U.norm(gx - p.x, ty - p.y);
      const err = this.rng.gauss() * sig;
      const ca = Math.cos(err), sa = Math.sin(err);
      const fx = nx * ca - ny * sa, fy = nx * sa + ny * ca;
      const speed = 17 + power * 9;
      this.launch(p, fx, fy, speed, 0.5 + power * 0.9 + this.rng.range(0, 0.6), 'shot');
      b.shotBy = p; b.shotOn = true; T.stats.shots++; T.stats.sot++; p.st.shots++; p.st.sot++;
      this.emit('shot', { by: p, power, on: true, dist: P.penSpot, team: T, penalty: true });
      // keeper decision
      if (keeper) {
        let dir;
        if (keeper.ctrl >= 0 && this.set.gkManual) {
          const inp = this.inputFor(this.slots[keeper.ctrl]);
          dir = Math.abs(inp.dy) > 0.3 ? Math.sign(inp.dy) : (m.rng.chance(0.5) ? 1 : -1);
        } else {
          const correct = m.rng.chance(0.42 + (keeper.a.gk / 100) * 0.2 + (keeper.abx ? keeper.abx.gkPen || 0 : 0) - (p.abx && p.abx.penErr ? 0.04 : 0));
          const trueSide = ty >= GY ? 1 : -1;
          dir = Math.abs(ty - GY) < 0.9 ? (m.rng.chance(0.25) ? 0 : (m.rng.chance(0.5) ? 1 : -1)) : (correct ? trueSide : -trueSide);
        }
        keeper.diveDelay = 0.1 + m.rng.range(0, 0.07);
        keeper.diveDir = dir;
        keeper.penDive = true;
      }
    },

    // ================= fouls, cards, advantage =================
    callFoul(off, victim, sev) {
      if (this.mode !== 'play') return;
      const strict = this.ref.strict;
      off.st.fouls++; off.team.stats.fouls++;
      let card = null;
      if (this.set.cards) {
        if (sev > 0.94 - strict * 0.12) card = 'red';
        else if (sev > 0.62 - strict * 0.3) card = 'yellow';
      }
      const inBox = this.inBox(victim.x, victim.y, off.team);
      const spot = { x: victim.x, y: victim.y };
      const vt = victim.team;
      const keepPoss = this.ball.owner ? this.ball.owner.ti === vt.idx : (this.lastTouchTeam === vt.idx && this.ball.z === 0);
      if (this.set.advantage && !inBox && !card && sev < 0.62 && keepPoss && !this.adv && this.ball.owner && this.ball.owner !== victim) {
        this.adv = { team: vt.idx, off, victim, spot, card, t: 2.8, sev };
        this.emit('advantage', { by: off, victim });
        return;
      }
      this.awardFoul(off, victim, spot, card, sev);
    },

    awardFoul(off, victim, spot, card, sev) {
      const vt = victim.team, ot = off.team;
      const inBox = this.inBox(spot.x, spot.y, ot);
      this.emit('foul', { by: off, victim, spot, card, penalty: inBox });
      if (card) this.giveCard(off, card);
      this.stoppageAcc += 12;
      if (this.set.injuries && sev > 0.5 && this.rng.chance(0.18 * (victim.abx && victim.abx.injury || 1)) && FCK.profile !== 'kids') {
        this.pendingInjury = victim;
      }
      this.fxState.shake = Math.max(this.fxState.shake, 0.2);
      if (inBox) {
        const gx = ot.ownGoalX;
        this.setRestart('penalty', vt.idx, gx + (gx === 0 ? P.penSpot : -P.penSpot), GY);
      } else {
        this.setRestart('freekick', vt.idx, U.clamp(spot.x, 0.5, L - 0.5), U.clamp(spot.y, 0.5, W - 0.5));
      }
      if (this.pendingInjury) { const v = this.pendingInjury; this.pendingInjury = null; this.startInjury(v); }
    },

    giveCard(p, card) {
      const t = p.team;
      if (card === 'yellow') {
        p.yellow++;
        if (p.yellow >= 2) { this.emit('card', { by: p, kind: 'yellow2red' }); t.stats.yellow++; p.st.cards++; this.sendOff(p); return; }
        t.stats.yellow++; p.st.cards++;
        this.emit('card', { by: p, kind: 'yellow' });
      } else {
        this.emit('card', { by: p, kind: 'red' });
        t.stats.red++; p.st.cards += 2;
        this.sendOff(p);
      }
    },

    sendOff(p) {
      const t = p.team;
      p.red = true; p.onPitch = false;
      t.players = t.players.filter((q) => q !== p);
      t.sentOff.push(p);
      if (p.ctrl >= 0) { this.slots[p.ctrl].player = null; p.ctrl = -1; }
      if (this.ball.owner === p) this.ball.owner = null;
      if (p.isGK) {
        const bgk = t.bench.find((d) => d.role === 'GK');
        if (bgk && t.subsLeft > 0) {
          const worst = t.players.filter((q) => !q.isGK).sort((a, c) => a.d.ovr - c.d.ovr)[0];
          if (worst) this.substitute(t, worst, bgk, true);
        } else {
          const cand = t.players.filter((q) => q.role === 'DF').sort((a, c) => U.dist2(a.x, a.y, t.ownGoalX, GY) - U.dist2(c.x, c.y, t.ownGoalX, GY))[0] || t.players[0];
          cand.isGK = true; cand.role = 'GK'; cand.pos = 'GK'; cand.a = Object.assign({}, cand.a, { gk: 52 });
        }
      }
      this.rebuild(); this.rec.n = 0;
      this.emit('sentOff', { by: p, team: t });
    },

    resolveAdvOnStop() {
      const a = this.adv;
      if (!a) return false;
      this.adv = null;
      this.awardFoul(a.off, a.victim, a.spot, a.card, a.sev);
      return true;
    },

    updateAdvantage(dt) {
      const a = this.adv;
      if (!a) return;
      a.t -= dt;
      const b = this.ball;
      const lost = b.owner && b.owner.ti !== a.team;
      if (lost) { this.adv = null; this.awardFoul(a.off, a.victim, a.spot, a.card, a.sev); return; }
      if (a.t <= 0) { this.adv = null; this.emit('advantageOver', {}); if (a.card) this.giveCard(a.off, a.card); }
    },

    callOffside(p) {
      const t = p.team;
      t.stats.offsides++;
      const spot = { x: p.x, y: p.y };
      this.emit('offside', { by: p });
      this.setRestart('freekick', 1 - t.idx, U.clamp(spot.x, 0.5, L - 0.5), U.clamp(spot.y, 0.5, W - 0.5), { indirect: true });
    },

    // ================= injuries / subs =================
    startInjury(p) {
      p.injured = true; p.state = 'down'; p.stT = 3; p.vx = p.vy = 0;
      this.injuryP = p; this.mode = 'injury'; this.modeT = 0;
      this.stoppageAcc += 40;
      this.emit('injury', { by: p });
    },

    resolveInjury() {
      const p = this.injuryP; this.injuryP = null;
      if (!p) { this.mode = 'play'; return; }
      const t = p.team;
      const r0 = this.restart;
      let sub = false;
      if (t.subsLeft > 0 && t.bench.length) {
        const cand = t.bench.filter((d) => d.role === p.role).sort((a, c) => c.ovr - a.ovr)[0] || t.bench.sort((a, c) => c.ovr - a.ovr)[0];
        if (cand) { this.substitute(t, p, cand, true); sub = true; }
      }
      if (!sub) { p.limp = true; p.state = 'getup'; p.stT = 0.5; }
      this.mode = 'restart';
      if (this.restart) this.restart.t = 0;
      if (!this.restart) this.mode = 'play';
    },

    substitute(team, outP, inData, quiet) {
      if (!outP || !inData || !outP.onPitch) return false;
      const np = new FCK.Player(this, team, inData, outP.slot);
      np.heat = new Uint16Array(21 * 14);
      np.x = outP.x; np.y = outP.y; np.ang = outP.ang; np.fx = outP.fx; np.fy = outP.fy;
      np.pos = outP.pos; np.role = outP.role; inData.pos = outP.pos; inData.role = outP.role; np.slotFy = outP.slotFy;
      inData.slotFy = outP.d.slotFy;
      np.isGK = outP.isGK ? true : inData.role === 'GK';
      np.stam = 1;
      outP.onPitch = false;
      np.enter = this.clock; outP.leave = this.clock;
      const idx = team.players.indexOf(outP);
      if (idx >= 0) team.players[idx] = np; else team.players.push(np);
      team.all.push(np);
      team.bench = team.bench.filter((d) => d !== inData);
      team.subbed.push(outP);
      team.subsLeft--;
      if (outP.ctrl >= 0) { const s = this.slots[outP.ctrl]; s.player = np; np.ctrl = s.i; outP.ctrl = -1; }
      if (this.ball.owner === outP) this.ball.owner = null;
      if (this.restart) {
        if (this.restart.taker === outP) this.restart.taker = np;
        if (this.restart.targets.has(outP)) { this.restart.targets.set(np, this.restart.targets.get(outP)); this.restart.targets.delete(outP); }
      }
      this.stoppageAcc += 18;
      this.rebuild(); this.rec.n = 0;
      this.emit('sub', { team, out: outP, in: np, auto: !!quiet });
      return true;
    },

    // human or UI substitution (only at dead ball)
    canSub(team) {
      return team.subsLeft > 0 && (this.mode === 'restart' || this.mode === 'break' || this.mode === 'goalwait' || this.mode === 'injury');
    },

    // CPU substitutions during dead balls
    autoSubsAtStop() {
      if (this.mode === 'shootout') return;
      // pro career: the tied player comes on from the bench at the planned minute
      const L = this.lock;
      if (L && !L.done) {
        const t = this.teams[L.team];
        if (this.lockPlayer(t)) L.done = true;
        else if (L.at != null && this.clock / 60 >= L.at && t.subsLeft > 0) {
          const d = t.bench.find((x) => x.sqi === L.sqi);
          if (!d) L.done = true;
          else {
            const cand = t.players.filter((p) => p.onPitch && !p.isGK && p.role === d.role).sort((a, c) => a.stam - c.stam)[0] || t.players.filter((p) => p.onPitch && !p.isGK).sort((a, c) => a.stam - c.stam)[0];
            if (cand) { t.lastSubClock = this.clock; this.substitute(t, cand, d, false); L.done = true; }
          }
        }
      }
      this.teams.forEach((t) => {
        if (t.humans.some((s) => !s.lock) || t.subsLeft <= 0 || !t.bench.length) return;
        const min = this.clock / 60;
        if (min < 58) return;
        if (this.clock - (t.lastSubClock || -999) < 420) return;
        const lkp = this.lockPlayer(t);
        const tired = t.players.filter((p) => !p.isGK && p !== lkp).sort((a, c) => a.stam - c.stam)[0];
        if (tired && tired.stam < 0.55 || min > 70) {
          const out = tired;
          const cand = t.bench.filter((d) => d.role === out.role && d.role !== 'GK').sort((a, c) => c.ovr - a.ovr)[0] || t.bench.filter((d) => d.role !== 'GK')[0];
          if (cand && out) { t.lastSubClock = this.clock; this.substitute(t, out, cand, true); }
        }
      });
    },
    autoSubs() { /* CPU substitutions happen at dead balls (autoSubsAtStop) */ },

    // ================= periods =================
    checkPeriodEnd() {
      if (this.mode !== 'play') return;
      const lim = this.periodEnd;
      if (!this.addedShown && this.clock >= lim - 25) {
        this.added = U.clamp(this.stoppageAcc + this.rng.range(15, 55), 30, 300);
        this.addedShown = true;
        this.emit('added', { mins: Math.max(1, Math.round(this.added / 60)) });
      }
      if (this.clock >= lim + (this.addedShown ? this.added : 0) && this.addedShown) {
        const b = this.ball;
        const dangerous = (b.owner || this.poss >= 0) && (this.inBox(b.x, b.y, this.teams[0]) || this.inBox(b.x, b.y, this.teams[1])) && (this.poss >= 0);
        if (!dangerous || this.clock > lim + this.added + 18) this.endPeriod();
      }
    },

    endPeriod() {
      this.emit('whistle', { kind: 'period', period: this.period });
      this.restart = null;
      const s0 = this.teams[0].score, s1 = this.teams[1].score;
      this.modeT = 0;
      if (this.period === 1) { this.mode = 'break'; this.breakKind = 'half'; this.emit('halftime', {}); }
      else if (this.period === 2) {
        if (this.set.knockout && s0 + (this.set.aggLead || 0) === s1) { this.mode = 'break'; this.breakKind = 'et'; this.emit('extratime', {}); }
        else this.finish();
      } else if (this.period === 3) { this.mode = 'break'; this.breakKind = 'etHalf'; this.emit('halftime', { et: true }); }
      else if (this.period === 4) {
        if (s0 + (this.set.aggLead || 0) === s1) { this.mode = 'break'; this.breakKind = 'pen'; this.emit('penaltiesNext', {}); }
        else this.finish();
      }
    },

    finish() {
      this.mode = 'over';
      const s0 = this.teams[0].score, s1 = this.teams[1].score;
      this.winner = this.shootout && this.shootout.winner >= 0 ? this.shootout.winner : (s0 + (this.set.aggLead || 0) > s1 ? 0 : s1 > s0 + (this.set.aggLead || 0) ? 1 : -1);
      this.computeResult();
      this.emit('end', { result: this.result });
    },

    // ================= penalty shootout =================
    startShootout() {
      this.mode = 'shootout';
      const first = this.rng.int(0, 1);
      const order = this.teams.map((t) => t.players.filter((p) => p.onPitch && !p.isGK).sort((a, c) => c.a.sho - a.a.sho));
      this.shootout = { turn: first, first, kicks: [[], []], scored: [0, 0], order, taken: [0, 0], state: 'setup', t: 0, winner: -1, shooter: null, keeper: null, orderIdx: [0, 0] };
      this.emit('shootoutStart', { first });
      this.nextPenalty();
    },

    nextPenalty() {
      const so = this.shootout;
      const T = this.teams[so.turn], O = this.teams[1 - so.turn];
      T.dir = 1; O.dir = -1;
      const lst = so.order[so.turn];
      const shooter = lst[so.orderIdx[so.turn] % lst.length];
      so.orderIdx[so.turn]++;
      const keeper = this.keeperOf(O);
      so.shooter = shooter; so.keeper = keeper; so.state = 'setup'; so.t = 0; so.flightT = 0;
      this.setBallAt(L - P.penSpot, GY);
      this.ball.lastTouch = null; this.ball.shotBy = null;
      // placement
      this.players.forEach((p) => {
        p.state = 'idle'; p.stT = 0; p.vx = p.vy = 0; p.penDive = false; p.diveDelay = 0;
        if (p === shooter) { p.x = L - P.penSpot - 4; p.y = GY; p.ang = 0; p.fx = 1; p.fy = 0; }
        else if (p === keeper) { p.x = L - 0.4; p.y = GY; p.ang = Math.PI; p.fx = -1; p.fy = 0; }
        else { p.x = L / 2 + (p.ti === 0 ? -3 : 3); p.y = GY + ((p.slot % 11) - 5) * 1.6; p.ang = 0; }
      });
      this.restart = { type: 'penalty', team: so.turn, x: L - P.penSpot, y: GY, phase: 'ready', t: 0, taker: shooter, wall: [], targets: new Map(), delay: 1.1 + this.diff.react, shootout: true };
      this.slots.forEach((s) => { s.player = null; });
      this.teams.forEach((t) => t.players.forEach((p) => { p.ctrl = -1; }));
      // human control
      const ts = this.humanFor(so.turn, shooter);
      if (ts) { ts.player = shooter; shooter.ctrl = ts.i; }
      const ks = this.humanFor(1 - so.turn, keeper);
      if (ks && keeper && this.set.gkManual) { ks.player = keeper; keeper.ctrl = ks.i; }
      this.emit('penaltyUp', { shooter, keeper, team: T });
    },

    stepShootout(dt) {
      const so = this.shootout, b = this.ball;
      so.t += dt;
      this.teams.forEach((t) => { if (t.pressCall > 0) t.pressCall -= dt; });
      if (so.state === 'setup') {
        // walk-up; then ready
        this.players.forEach((p) => { this.integrate(p, dt); });
        this.updateRef(dt);
        if (so.t > 1.6) {
          so.state = 'ready'; so.t = 0;
        }
      } else if (so.state === 'ready') {
        this.players.forEach((p) => { if (p.ctrl >= 0) return; this.stop(p); this.integrate(p, dt); });
        // human shooter input
        const r = this.restart;
        const sh = so.shooter;
        if (sh.ctrl >= 0) {
          const s = this.slots[sh.ctrl];
          const inp = this.inputFor(s);
          const held = inp.held[1], rel = inp.released[1];
          if (held) { s.charge = Math.min(1, (s.chargeKind === 1 ? s.charge : 0) + dt / 0.85); s.chargeKind = 1; }
          r.aim = { x: inp.dx, y: inp.dy };
          if (rel && s.chargeKind === 1) {
            this.shootoutKick(Math.max(0.45, s.charge), inp.dx, inp.dy, true);
            s.charge = 0; s.chargeKind = 0;
          } else if (so.t > 15) this.shootoutKick(0.7, 0, 0, false);
        } else if (so.t > r.delay) this.shootoutKick(0.55 + this.rng.range(0, 0.35), 0, 0, false);
        // human keeper: move laterally
        const kp = so.keeper;
        if (kp && kp.ctrl >= 0) {
          const inp = this.inputFor(this.slots[kp.ctrl]);
          kp.y = U.clamp(kp.y + inp.dy * 3 * dt, GY - 1.4, GY + 1.4);
        }
      } else if (so.state === 'flight') {
        so.flightT += dt;
        this.players.forEach((p) => {
          if (p === so.keeper) {
            if (p.penDive && p.diveDelay > 0) { p.diveDelay -= dt; if (p.diveDelay <= 0) { this.keeperDive(p, 0.0, p.diveDir === 0 ? 0.001 : p.diveDir); if (p.diveDir === 0) { p.vx = 0; p.vy = 0; } } }
          }
          this.integrate(p, dt);
        });
        this.updateBall(dt);
        this.updateContactsShootout();
        // resolve
        const side = L;
        if (b.x > side && Math.abs(b.y - GY) < HG && b.z < P.goalH) return this.penaltyResolved(true);
        if (b.x > L + 0.1 || b.x < L - 25 || b.y < -2 || b.y > W + 2) return this.penaltyResolved(false);
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (so.flightT > 0.4 && (sp < 0.6 || b.owner)) return this.penaltyResolved(false);
        if (so.flightT > 3.5) return this.penaltyResolved(false);
      } else if (so.state === 'result') {
        this.players.forEach((p) => { this.integrate(p, dt); });
        this.updateBall(dt);
        if (so.t > 2.2) {
          if (so.over) { this.finish(); return; }
          so.turn = 1 - so.turn;
          this.nextPenalty();
        }
      }
    },

    updateContactsShootout() {
      const b = this.ball, so = this.shootout;
      if (b.owner) return;
      const k = so.keeper; if (!k) return;
      const d = U.dist2(k.x, k.y, b.x, b.y);
      const reach = k.state === 'dive' ? 2.15 : 1.1;
      if (d < reach && b.z < 2.45) {
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (sp > 0.5 && !so.keeperTouched) {
          so.keeperTouched = true;
          this.mode = 'shootout';
          this.keeperTouch(k);
          if (this.ball.owner === k) { this.ball.owner = null; this.ball.vx = 0; this.ball.vy = 0; }
          so.saved = true;
        }
      }
    },

    shootoutKick(power, dx, dy, human) {
      const so = this.shootout, r = this.restart;
      const sh = so.shooter;
      so.keeperTouched = false; so.saved = false;
      const prevMode = this.mode;
      this.mode = 'shootout';
      // reuse penalty routine
      this.restart = r;
      const rr = this.restart;
      const save = this.endRestart; // endRestart sets mode to play; keep shootout
      this.endRestart = () => { this.restart = null; };
      this.takePenaltyShot(sh, dx, dy, power, human);
      this.endRestart = save;
      this.mode = 'shootout';
      so.state = 'flight'; so.flightT = 0;
    },

    penaltyResolved(scored) {
      const so = this.shootout;
      const T = this.teams[so.turn];
      so.kicks[so.turn].push(scored ? 1 : 0);
      so.taken[so.turn]++;
      if (scored) so.scored[so.turn]++;
      so.state = 'result'; so.t = 0;
      so.lastScored = scored;
      if (scored) { this.fxState.shake = 0.8; this.fxState.flash = 0.7; }
      // decide
      const a = so.scored, tk = so.taken;
      const remA = Math.max(0, 5 - tk[0]), remB = Math.max(0, 5 - tk[1]);
      let over = false;
      if (tk[0] <= 5 && tk[1] <= 5) {
        if (a[0] > a[1] + remB) over = true;
        else if (a[1] > a[0] + remA) over = true;
      }
      if (!over && tk[0] === tk[1] && tk[0] >= 5 && a[0] !== a[1]) over = true;
      if (over) { so.over = true; so.winner = a[0] > a[1] ? 0 : 1; }
      this.emit('penalty', { team: T, scored, shooter: so.shooter, score: [a[0], a[1]], saved: so.saved });
    },

    // ================= result / ratings =================
    computeResult() {
      const t0 = this.teams[0], t1 = this.teams[1];
      const all = this.allPlayers();
      const res = { score: [t0.score, t1.score], winner: this.winner, pens: this.shootout ? this.shootout.scored.slice() : null, goals: this.goals.slice(), players: [] };
      const tot = t0.stats.poss + t1.stats.poss || 1;
      res.poss = [Math.round((t0.stats.poss / tot) * 100), 100 - Math.round((t0.stats.poss / tot) * 100)];
      all.forEach((p) => {
        const s = p.st;
        let r = 6.1;
        r += s.goals * 1.1 + s.assists * 0.7 + s.og * -1.2;
        if (s.passes > 4) r += (s.passOk / s.passes - 0.75) * 1.6;
        r += s.tackleWon * 0.18 + s.saves * 0.35 - Math.max(0, s.tackles - s.tackleWon) * 0.04;
        r -= s.fouls * 0.12 + s.cards * 0.3;
        r += s.sot * 0.08;
        if (p.isGK) r -= s.conceded * 0.25; else if (p.role === 'DF') r -= this.teams[p.ti].score !== undefined ? this.teams[1 - p.ti].score * 0.1 : 0;
        const won = this.winner === p.ti, lost = this.winner >= 0 && this.winner !== p.ti;
        r += won ? 0.35 : lost ? -0.25 : 0;
        r = U.clamp(r, 3, 10);
        res.players.push({ p, team: p.ti, rating: Math.round(r * 10) / 10 });
      });
      res.players.sort((a, b) => b.rating - a.rating);
      res.motm = res.players[0] || null;
      this.result = res;
    },
  });
})((globalThis.FCK = globalThis.FCK || {}));
