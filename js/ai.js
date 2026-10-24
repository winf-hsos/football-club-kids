/* FCK - ai.js : team planning, player behaviour, goalkeeper, CPU restarts */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const P = FCK.PITCH;
  const L = P.L, W = P.W, GY = P.cy, HG = P.goalW / 2;
  const AI = {};

  // ---------- formation position ----------
  AI.formationPos = function (m, p, bx, by, attacking) {
    const team = p.team, tac = team.tactic;
    const form = FCK.FORMATIONS[team.formation];
    const slot = form[p.slot] || form[Math.min(p.slot, form.length - 1)] || form[0];
    const b = team.depth(bx);
    const roleF = p.role === 'GK' ? 0.1 : p.role === 'DF' ? 0.5 : p.role === 'MF' ? 0.78 : 0.95;
    let depth = slot.fx;
    depth += (b - 0.45) * 0.42 * roleF;
    depth += (tac.line - 0.5) * 0.22 * (p.role === 'DF' ? 1 : p.role === 'MF' ? 0.8 : 0.5);
    if (attacking) depth += 0.03 + tac.risk * 0.05 * (p.role === 'FW' ? 1.5 : 0.6);
    else depth -= 0.03 * (1 - tac.line);
    const maxD = p.role === 'GK' ? 0.12 : p.role === 'DF' ? (attacking ? 0.64 : 0.54) : p.role === 'MF' ? 0.86 : 0.97;
    const minD = p.role === 'GK' ? 0.02 : p.role === 'DF' ? 0.1 : 0.2;
    depth = U.clamp(depth, minD, maxD);
    const ballFy = team.dir > 0 ? by / W : 1 - by / W;
    let fy = slot.fy + (ballFy - 0.5) * (0.3 + (1 - tac.width) * 0.3) * (p.role === 'GK' ? 0.4 : 1);
    if (attacking) fy = 0.5 + (fy - 0.5) * (1 + 0.2 * tac.width);
    else fy = 0.5 + (fy - 0.5) * (1 - 0.12 * (1 - tac.width));
    fy = U.clamp(fy, 0.04, 0.96);
    return { x: team.toX(depth), y: team.toY(fy) };
  };

  // direct full-speed movement without arrival slowdown (keeper reactions)
  FCK.Match.prototype.moveFast = function (p, tx, ty) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.05) { p.wx = 0; p.wy = 0; return; }
    const sp = Math.min(p.cap * 1.05, d * 9);
    p.wx = (dx / d) * sp; p.wy = (dy / d) * sp; p.sprint = true;
  };

  FCK.Match.prototype.setFormation = function (team, name) {
    const form = FCK.FORMATIONS[name];
    if (!form) return;
    const rank = { GK: 0, DF: 1, MF: 2, FW: 3 };
    const old = FCK.FORMATIONS[team.formation];
    const players = team.players.filter((p) => p.onPitch);
    const gk = players.find((p) => p.isGK);
    const field = players.filter((p) => p !== gk).sort((a, c) => rank[a.role] - rank[c.role] || ((old[a.slot] || { fy: 0.5 }).fy - (old[c.slot] || { fy: 0.5 }).fy));
    let slots = form.map((s, i) => ({ s, i })).filter((o) => o.s.pos !== 'GK');
    while (slots.length > field.length) {
      let wi = 0;
      slots.forEach((o, i) => { if (o.s.fx > slots[wi].s.fx) wi = i; });
      slots.splice(wi, 1);
    }
    slots.sort((a, c) => rank[FCK.ROLE_OF[a.s.pos]] - rank[FCK.ROLE_OF[c.s.pos]] || a.s.fy - c.s.fy);
    field.forEach((p, k) => {
      const o = slots[k];
      p.slot = o.i; p.pos = o.s.pos; p.role = FCK.ROLE_OF[o.s.pos]; p.slotFy = o.s.fy;
    });
    if (gk) { gk.slot = 0; }
    team.formation = name;
  };

  FCK.Match.prototype.setStyle = function (team, key) {
    if (!FCK.STYLES[key]) return;
    team.style = key;
    team.tactic = Object.assign({}, FCK.STYLES[key]);
  };

  // ---------- team plan ----------
  function plan(m, team) {
    const opp = m.teams[1 - team.idx], b = m.ball, pl = team.plan;
    const owner = b.owner;
    const ds = opp.players.map((q) => team.depth(q.x)).sort((a, c) => c - a);
    pl.offLine = ds.length > 1 ? ds[1] : 0.5;
    pl.pressers = []; pl.marks = {}; pl.chasers = [];
    const field = team.players.filter((p) => p.onPitch && !p.isGK && p.state !== 'down');
    if (owner && owner.ti !== team.idx) {
      const press = team.tactic.press + (team.pressCall > 0 ? 0.25 : 0);
      let n = 1 + (press > 0.55 ? 1 : 0) + (press > 0.8 ? 1 : 0);
      const bd = team.depth(owner.x);
      if (bd < 0.3) n = Math.min(n, 2);
      const px = owner.x + owner.vx * 0.3, py = owner.y + owner.vy * 0.3;
      const cand = field.slice().sort((a, c) => U.dist2(a.x, a.y, px, py) - U.dist2(c.x, c.y, px, py));
      for (let i = 0; i < cand.length && pl.pressers.length < n; i++) {
        const p = cand[i];
        const d = U.dist2(p.x, p.y, px, py);
        if (p.role === 'DF' && d > 16 && pl.pressers.length >= 1) continue;
        if (d > 32 && pl.pressers.length >= 1) continue;
        pl.pressers.push(p);
      }
      // marking
      const rest = field.filter((p) => pl.pressers.indexOf(p) < 0).sort((a, c) => (a.role === 'DF' ? 0 : a.role === 'MF' ? 1 : 2) - (c.role === 'DF' ? 0 : c.role === 'MF' ? 1 : 2));
      const threats = opp.players.filter((q) => !q.isGK && q !== owner && team.depth(q.x) < 0.66);
      const taken = new Set();
      rest.forEach((p) => {
        if (p.role === 'FW') return;
        const base = AI.formationPos(m, p, b.x, b.y, false);
        let best = null, bd2 = 1e9;
        threats.forEach((q) => {
          if (taken.has(q.id)) return;
          const d = U.dist2(base.x, base.y, q.x, q.y);
          if (d < (p.role === 'DF' ? 14 : 11) && d < bd2) { bd2 = d; best = q; }
        });
        if (best) { taken.add(best.id); pl.marks[p.id] = best; }
      });
    } else if (!owner) {
      const tt = 0.5;
      const px = b.x + b.vx * tt, py = b.y + b.vy * tt;
      const press = team.tactic.press;
      const cand = field.slice().sort((a, c) => U.dist2(a.x, a.y, px, py) / (a.cap) - U.dist2(c.x, c.y, px, py) / (c.cap));
      const nc = press > 0.65 ? 2 : 1;
      for (let i = 0; i < Math.min(nc, cand.length); i++) pl.chasers.push(cand[i]);
      if (b.passTarget && b.passTarget.ti === team.idx && pl.chasers.indexOf(b.passTarget) < 0) pl.chasers.unshift(b.passTarget);
    }
  }

  // ---------- main update ----------
  AI.update = function (m, dt) {
    if (m.mode === 'goal' || m.mode === 'shootout' || m.mode === 'break' || m.mode === 'over') return;
    if (m.mode === 'play') {
      m.teams.forEach((t) => {
        t.plan.t -= dt;
        if (t.plan.t <= 0) { t.plan.t = 0.14; plan(m, t); }
      });
    }
    for (let i = 0; i < m.players.length; i++) {
      const p = m.players[i];
      if (!p.onPitch) continue;
      if (m.mode === 'restart') { restartMove(m, p); continue; }
      if (m.mode !== 'play') { m.stop(p); continue; }
      if (p.ctrl >= 0) continue;
      if (p.state === 'slide' || p.state === 'dive' || p.state === 'down' || p.state === 'celebrate') continue;
      if (p.isGK) keeperAI(m, p, dt); else playerAI(m, p, dt);
    }
  };

  function restartMove(m, p) {
    const r = m.restart;
    if (!r) return;
    if (p.ctrl >= 0 && !(p === r.taker && r.phase === 'setup')) return;
    if (p.state === 'down' || p.state === 'getup') return;
    const tg = r.targets.get(p);
    if (tg) m.moveTo(p, tg.x, tg.y, 0.85);
    else if (p !== r.taker) m.stop(p);
    if (p === r.taker) {
      if (r.phase === 'ready' && p.ctrl < 0) m.stop(p);
      // taker walks to the ball
      if (r.phase === 'setup' && !tg) m.moveTo(p, r.x, r.y, 0.85);
    }
    // face the ball while waiting
    if (p.spd < 0.5) { const [nx, ny] = U.norm(r.x - p.x, r.y - p.y); if (nx || ny) { p.ang = Math.atan2(ny, nx); p.fx = nx; p.fy = ny; } }
  }

  // ---------- outfield player ----------
  function interceptPoint(m, p) {
    const b = m.ball;
    const d = U.dist2(p.x, p.y, b.x, b.y);
    const t = U.clamp(d / Math.max(4, p.cap), 0, 1.3);
    return { x: U.clamp(b.x + b.vx * t * 0.8, -1, L + 1), y: U.clamp(b.y + b.vy * t * 0.8, -1, W + 1) };
  }

  function playerAI(m, p, dt) {
    const b = m.ball, team = p.team, opp = m.teams[1 - team.idx], pl = team.plan;
    p.aiT -= dt;
    if (b.owner === p) { carrierAI(m, p, dt); return; }
    const owner = b.owner;
    const attacking = m.poss === team.idx;
    // intended receiver of a pass
    if (!owner && b.passTarget === p) {
      const ip = m.interceptFor(p);
      m.moveTo(p, ip.x, ip.y, 1);
      return;
    }
    if (owner && owner.ti !== team.idx) {
      // ---- defending ----
      if (pl.pressers.indexOf(p) >= 0) {
        const tx = owner.x + owner.vx * 0.25 + (team.ownGoalX - owner.x) * 0.03, ty = owner.y + owner.vy * 0.25 + (GY - owner.y) * 0.02;
        const d = m.moveTo(p, tx, ty, 1.02);
        const dd = U.dist(p, owner);
        // tackles
        if (p.tackleCd <= 0 && p.state === 'idle') {
          const aggr = m.diff.aggr * (team.humans.length ? 0.8 : 1);
          if (dd < 1.9 && p.aiT <= 0) {
            p.aiT = 0.25 + m.rng.range(0, 0.35);
            if (m.rng.chance(0.18 + aggr * 0.45)) m.tackle(p, 'stand');
          } else if (dd > 1.8 && dd < 3.6 && p.spd > 4.2 && owner.spd > 1) {
            const toO = U.norm(owner.x - p.x, owner.y - p.y);
            const ahead = toO[0] * p.fx + toO[1] * p.fy;
            if (ahead > 0.8 && m.rng.next() < (0.06 + aggr * 0.28) * dt * (m.inBox(p.x, p.y, team) ? 0.35 : 1)) m.tackle(p, 'slide');
          }
        }
        return;
      }
      const mk = pl.marks[p.id];
      let base = AI.formationPos(m, p, b.x, b.y, false);
      if (mk) {
        const [gx, gy] = U.norm(team.ownGoalX - mk.x, GY - mk.y);
        base = { x: mk.x + gx * 1.8, y: mk.y + gy * 1.8 };
      }
      m.moveTo(p, base.x, base.y, mk ? 0.9 : 0.78);
      return;
    }
    if (!owner) {
      // ---- loose ball ----
      if (pl.chasers.indexOf(p) >= 0) {
        const ip = interceptPoint(m, p);
        m.moveTo(p, ip.x, ip.y, 1);
        // contested loose ball: slide occasionally
        const d = U.dist2(p.x, p.y, b.x, b.y);
        return;
      }
      const base = AI.formationPos(m, p, b.x, b.y, attacking);
      m.moveTo(p, base.x, base.y, 0.78);
      return;
    }
    // ---- we have the ball: support ----
    supportMove(m, p, dt, owner);
  }

  function supportMove(m, p, dt, carrier) {
    const team = p.team, b = m.ball, pl = team.plan, tac = team.tactic;
    let base = AI.formationPos(m, p, b.x, b.y, true);
    p.runT -= dt;
    if (p.runT <= 0) {
      p.runTarget = null;
      if ((p.role === 'FW' || (p.role === 'MF' && p.pos !== 'CDM')) && team.depth(carrier.x) > 0.36 && m.rng.chance(0.22 + tac.risk * 0.3) && U.dist(p, carrier) > 7) {
        const dx = team.toX(Math.min(0.96, pl.offLine - 0.02)) ;
        const lat = U.clamp(p.y + m.rng.range(-9, 9), 5, W - 5);
        p.runTarget = { x: dx, y: lat };
        p.runT = m.rng.range(1.6, 3);
      } else p.runT = m.rng.range(0.8, 1.8);
    }
    let tx = base.x, ty = base.y;
    if (p.runTarget && p.runT > 0) { tx = p.runTarget.x; ty = p.runTarget.y; }
    // keep some air around the carrier
    const dC = U.dist2(tx, ty, carrier.x, carrier.y);
    if (dC < 5) { const [nx, ny] = U.norm(tx - carrier.x, ty - carrier.y); tx = carrier.x + (nx || 0.5) * 6; ty = carrier.y + ny * 6; }
    // stay onside
    if (m.set.offside && p.role !== 'GK') {
      const dep = team.depth(tx), lim = pl.offLine - 0.012;
      if (dep > lim && dep > team.depth(b.x)) tx = team.toX(lim);
    }
    tx = U.clamp(tx, 1.5, L - 1.5); ty = U.clamp(ty, 1.5, W - 1.5);
    m.moveTo(p, tx, ty, p.runTarget && p.runT > 0 ? 0.95 : 0.78);
  }

  // ---------- ball carrier ----------
  function laneClear(m, p, q) {
    const o = m.teams[1 - p.ti].players;
    let md = 99;
    for (let i = 0; i < o.length; i++) {
      const d = U.segDist(o[i].x, o[i].y, p.x, p.y, q.x, q.y);
      if (d < md) md = d;
    }
    return md;
  }
  function openness(m, p, q) {
    const o = m.teams[1 - p.ti].players;
    let md = 99;
    for (let i = 0; i < o.length; i++) {
      const d = U.dist2(o[i].x, o[i].y, q.x, q.y);
      if (d < md) md = d;
    }
    return md;
  }

  function bestPass(m, p, opts) {
    const team = p.team, tac = team.tactic, pl = team.plan;
    let best = null, bs = -1e9, bt = 'pass';
    const dd = team.depth(p.x);
    for (let i = 0; i < team.players.length; i++) {
      const q = team.players[i];
      if (q === p || !q.onPitch || q.state === 'down') continue;
      const d = U.dist(p, q);
      if (d < 3.2 || d > 44) continue;
      const qd = team.depth(q.x);
      const progress = (qd - dd) * L;
      const lane = laneClear(m, p, q);
      const open = openness(m, p, q);
      let sc = (progress / 30) * (0.55 + tac.risk) + U.clamp((lane - 0.8) / 3.2, 0, 1) * 1.15 + U.clamp((open - 1.5) / 5, 0, 1) * 0.8 - Math.abs(d - 14) / 70;
      if (lane < 1.1) sc -= 1.6;
      if (q.isGK) sc -= opts && opts.clear ? 0 : 1.4;
      if (m.set.offside && qd > 0.5 && qd > pl.offLine + 0.001 && qd > dd) sc -= 4;
      if (m.callFor && m.callFor.p === q) sc += 0.7;
      if (opts && opts.clear) sc += progress / 25;
      if (sc > bs) {
        bs = sc; best = q;
        bt = progress > 16 && lane > 2.4 && d > 12 && d < 36 && q.spd > 1.5 ? 'through' : (d > 30 || (opts && opts.clear && d > 22)) ? 'lob' : 'pass';
      }
    }
    return best ? { q: best, score: bs, type: bt } : null;
  }

  function carrierAI(m, p, dt) {
    const team = p.team, tac = team.tactic, pl = team.plan;
    const gx = team.goalX;
    const distG = Math.abs(gx - p.x);
    const press = m.pressure(p);
    p.holdT += dt;
    // continuous dribble movement
    if (p.aiT > 0) {
      if (p.dribble) {
        steer(m, p, press);
        return;
      }
    }
    p.aiT = Math.max(0.12, m.diff.react * m.rng.range(0.45, 1.1));
    const minHold = 0.8 + m.diff.react * 2.2 + (1 - press) * 0.7;
    const settled = p.holdT >= minHold || press > 0.62;
    if (p.holdT < 0.3) { p.dribble = true; steer(m, p, press); return; }
    const inBox = m.inBox(p.x, p.y, team);
    // ----- shot -----
    const angleOk = Math.abs(p.y - GY) < distG * 1.05 + 5;
    if (distG < 29 && angleOk && !m.inBox(p.x, p.y, team) && (settled || distG < 14)) {
      const lane = (() => { let md = 99; m.teams[1 - team.idx].players.forEach((o) => { if (o.isGK) return; const d = U.segDist(o.x, o.y, p.x, p.y, gx, GY); if (d < md) md = d; }); return md; })();
      const sc = (1 - distG / 33) * 0.95 + U.clamp((lane - 0.8) / 3, 0, 1) * 0.35 + (p.a.sho - 60) / 120 - press * 0.28 + tac.risk * 0.1;
      const thr = distG < 16 ? 0.4 : distG < 22 ? 0.58 : 0.78;
      if (sc > thr && m.rng.chance(distG < 16 ? 0.7 : distG < 22 ? 0.4 : 0.18)) {
        const side = m.rng.pick([-1, 1]);
        const ty = GY + side * HG * m.rng.range(0.3, 1.3);
        m.shoot(p, gx - p.x, ty - p.y, m.rng.range(0.65, 1.0), 0.0, 'shot');
        p.dribble = false;
        return;
      }
    }
    // ----- pass options -----
    const wide = Math.abs(p.y - GY) > 20 && team.depth(p.x) > 0.74;
    const bp = bestPass(m, p, { clear: inBox && press > 0.55 });
    // dribble value
    let dv = 0.45 + (1 - press) * 0.55 + (p.a.dri - 60) / 140 - tac.tempo * 0.1;
    if (team.depth(p.x) > 0.8) dv += 0.2;
    if (press > 0.65) dv -= 0.45;
    // cross from wide positions
    if (wide) {
      const inbox = team.players.filter((q) => q !== p && q.onPitch && Math.abs(q.x - gx) < 14 && Math.abs(q.y - GY) < 14);
      if (inbox.length && m.rng.chance(0.5)) {
        const tgt = inbox.sort((a, c) => c.a.phy - a.a.phy)[0];
        m.passTo(p, tgt, 'lob', 0.8);
        p.dribble = false;
        return;
      }
    }
    if (!settled) { p.dribble = true; steer(m, p, press); return; }
    if (bp && (bp.score > dv || press > 0.8)) {
      const t = bp.q;
      m.passTo(p, t, bp.type, bp.type === 'lob' ? 0.85 : null);
      p.dribble = false;
      return;
    }
    if (inBox && press > 0.5 && !bp) {
      // clear the danger
      m.launch(p, team.dir, (GY - p.y) * 0.05, 20, 5, 'lob');
      p.dribble = false;
      return;
    }
    p.dribble = true;
    steer(m, p, press);
  }

  function steer(m, p, press) {
    const team = p.team, gx = team.goalX;
    let ax = gx - p.x, ay = (GY - p.y) * 0.45;
    let [anx, any] = U.norm(ax, ay);
    let rx = 0, ry = 0;
    const o = m.teams[1 - team.idx].players;
    let nearest = 99;
    for (let i = 0; i < o.length; i++) {
      const dx = o[i].x - p.x, dy = o[i].y - p.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearest) nearest = d;
      if (d < 8 && d > 0.1) {
        const dot = (dx * anx + dy * any) / d;
        if (dot > -0.2) { rx -= (dx / d) * (1 - d / 8) * 1.8; ry -= (dy / d) * (1 - d / 8) * 1.8; }
      }
    }
    // keep off the touchline
    if (p.y < 4) ry += 1; else if (p.y > W - 4) ry -= 1;
    const [dx, dy] = U.norm(anx + rx, any + ry);
    const tx = U.clamp(p.x + dx * 12, 1, L - 1), ty = U.clamp(p.y + dy * 12, 1, W - 1);
    m.moveTo(p, tx, ty, nearest > 4 ? 0.98 : 0.9);
    p.sprint = nearest > 4;
  }

  // ---------- goalkeeper ----------
  function keeperAI(m, k, dt) {
    const team = k.team, b = m.ball, gx = team.ownGoalX, into = team.dir;
    if (b.owner === k) { m.stop(k); return; }
    if (k.state === 'getup' || k.state === 'hold') { return; }
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const toward = (gx - b.x) * b.vx > 0 && sp > 6.5 && !b.owner;
    // shot reaction
    if (toward && b.lastTouch && b.lastTouch.ti !== k.ti) {
      const tg = (gx - b.x) / b.vx;
      if (tg > 0 && tg < 2.2) {
        const yAt = b.y + b.vy * tg;
        const zAt = b.z + b.vz * tg - 0.5 * 9.81 * tg * tg;
        if (Math.abs(yAt - GY) < HG + 1.5 && zAt < 2.9) {
          if (k.shotId !== b.touchT) {
            k.shotId = b.touchT;
            k.reactT = (0.04 + (1 - k.a.gk / 100) * 0.3 + m.diff.react * 0.1) * (k.team.humans.length ? 0.8 : 1);
            k.aimErr = m.rng.gauss() * (0.2 + (1 - k.a.gk / 100) * 1.3);
          }
          k.reactT -= dt;
          if (k.reactT <= 0) {
            // where the ball crosses the keeper's own plane
            const tk = Math.max(0.02, (k.x - b.x) / b.vx);
            const yK = b.y + b.vy * tk;
            const ty = U.clamp(yK + k.aimErr, GY - HG - 1, GY + HG + 1);
            const need = Math.abs(ty - k.y);
            if (need > 1.1 && tk < 0.85 && k.state === 'idle') {
              m.keeperDive(k, 0, ty > k.y ? 1 : -1, need);
            } else if (need > 0.12) {
              m.moveFast(k, k.x, ty);
            } else m.stop(k);
          } else m.stop(k);
          return;
        }
      }
    }
    // loose ball inside own box: claim it
    const dBall = U.dist2(k.x, k.y, b.x, b.y);
    if (!b.owner && m.inBox(b.x, b.y, team) && sp < 7 && (b.lastTouch ? b.lastTouch.ti !== k.ti || sp < 3 : true)) {
      let near = 99;
      m.teams[1 - team.idx].players.forEach((o) => { near = Math.min(near, U.dist2(o.x, o.y, b.x, b.y)); });
      if (dBall < near * 1.05 + 1.0 || dBall < 5) {
        const ip = interceptPoint(m, k);
        m.moveTo(k, ip.x, ip.y, 1);
        return;
      }
    }
    // high ball / cross: come and claim
    if (!b.owner && b.z > 1.2 && m.inBox(b.x + b.vx * 0.4, b.y + b.vy * 0.4, team) && dBall < 14) {
      const lx = b.x + b.vx * 0.5, ly = b.y + b.vy * 0.5;
      m.moveTo(k, U.clamp(lx, Math.min(gx, gx + into * 12), Math.max(gx, gx + into * 12)), ly, 0.95);
      return;
    }
    // positioning
    const bx = b.x, by = b.y;
    const dg = U.dist2(bx, by, gx, GY);
    const dpos = U.clamp(1.3 + dg * 0.085, 1.3, 7);
    const [ux, uy] = U.norm(bx - gx, by - GY);
    let tx = gx + ux * dpos, ty = GY + uy * dpos * 0.9;
    ty = U.clamp(ty, GY - HG - 2, GY + HG + 2);
    // rush out
    const own = b.owner && b.owner.ti !== k.ti ? b.owner : null;
    if (own && U.dist2(own.x, own.y, gx, GY) < 22 && U.dist(own, k) < 14 && (team.rushCall > 0 || m.diff.aggr > 0.4)) {
      let defs = 0;
      team.players.forEach((q) => { if (q !== k && team.depth(q.x) < team.depth(own.x) + 0.01 && U.dist(q, own) < 9) defs++; });
      if (defs === 0 && m.rng.chance(0.02 + m.diff.aggr * 0.02)) { k.rush = 1.2; }
    }
    if (k.rush > 0) {
      k.rush -= dt;
      if (own) { m.moveTo(k, own.x + (gx - own.x) * 0.15, own.y, 1); return; }
    }
    m.moveTo(k, tx, ty, 0.7);
  }

  AI.keeperRelease = function (m, k) {
    const team = k.team;
    const bp = bestPass(m, k, { clear: true });
    m.noOffsideNext = true;
    k.state = 'idle';
    if (!bp) { m.launch(k, team.dir, 0, 22, 6, 'lob'); m.noOffsideNext = false; return; }
    const short = bp.q.role === 'DF' && U.dist(k, bp.q) < 24 && m.rng.chance(0.5);
    if (short) m.passTo(k, bp.q, 'pass');
    else {
      const far = team.players.filter((q) => q !== k && q.onPitch && !q.isGK && team.depth(q.x) > 0.4).sort((a, c) => (c.a.phy - openness(m, k, c) * -0) - a.a.phy)[0] || bp.q;
      m.passTo(k, far, 'lob', 0.9);
    }
    m.noOffsideNext = false;
  };

  // ---------- CPU restarts ----------
  AI.takeRestart = function (m, r) {
    const p = r.taker, T = p.team;
    const type = r.type;
    const dg = U.dist2(r.x, r.y, T.goalX, GY);
    const mates = T.players.filter((q) => q !== p && q.onPitch);
    const open = (q) => Math.min(openness(m, p, q), 8) - U.dist(p, q) * 0.12;
    if (type === 'penalty') { m.takePenaltyShot(p, 0, 0, m.rng.range(0.55, 0.95), false); return; }
    if (type === 'kickoff') {
      const t = mates.filter((q) => !q.isGK).sort((a, c) => U.dist(p, a) - U.dist(p, c))[1] || mates[0];
      m.restartKick(p, t, 'pass', null); return;
    }
    if (type === 'throwin') {
      const t = mates.filter((q) => !q.isGK && U.dist(p, q) < 28).sort((a, c) => open(c) - open(a))[0] || mates[0];
      m.restartKick(p, t, 'lob', 0.3); return;
    }
    if (type === 'goalkick') {
      if (m.rng.chance(0.45)) {
        const t = mates.filter((q) => q.role === 'DF').sort((a, c) => open(c) - open(a))[0];
        if (t) { m.restartKick(p, t, 'pass', null); return; }
      }
      const t = mates.filter((q) => !q.isGK && T.depth(q.x) > 0.4).sort((a, c) => (c.a.phy + open(c) * 3) - (a.a.phy + open(a) * 3))[0] || mates[0];
      m.restartKick(p, t, 'lob', 0.9); return;
    }
    if (type === 'corner') {
      const inbox = mates.filter((q) => Math.abs(q.x - T.goalX) < 16 && Math.abs(q.y - GY) < 16).sort((a, c) => c.a.phy - a.a.phy);
      const t = inbox[m.rng.int(0, Math.min(2, inbox.length - 1))] || mates[0];
      m.restartKick(p, t, 'lob', 0.85); return;
    }
    // free kick
    if (dg < 30 && !r.indirect && m.rng.chance(0.65)) {
      const side = m.rng.pick([-1, 1]);
      const ty = GY + side * (HG - 0.8);
      m.restartShot(p, T.goalX - p.x, ty - p.y, m.rng.range(0.72, 0.95)); return;
    }
    const cands = mates.filter((q) => !q.isGK).sort((a, c) => (T.depth(c.x) - T.depth(a.x)) * 8 + open(c) - open(a));
    const t = cands.slice(0, 4).sort((a, c) => open(c) - open(a))[0] || mates[0];
    const kind = dg < 42 && T.depth(r.x) > 0.7 ? 'lob' : 'pass';
    m.restartKick(p, t, kind, kind === 'lob' ? 0.8 : null);
  };

  FCK.AI = AI;
})((globalThis.FCK = globalThis.FCK || {}));
