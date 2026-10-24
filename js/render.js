/* FCK - render.js : canvas renderer (pitch, stands, players, ball, weather, effects, radar) */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const P = FCK.PITCH;
  const L = P.L, W = P.W, GY = P.cy, HG = P.goalW / 2;
  const MARGIN = 14; // meters of surroundings drawn around the pitch
  const SLOT_COLORS = ['#3de0ff', '#ff9f3d', '#ff5fa8', '#ffe14d'];
  FCK.SLOT_COLORS = SLOT_COLORS;

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n += n << 3; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

  const GRASS = {
    clear: ['#2c7a35', '#34893e'], cloudy: ['#2b7234', '#327f3b'], rain: ['#25662e', '#2b7335'],
    storm: ['#215a29', '#276530'], snow: ['#c4d4cc', '#d3e1da'], fog: ['#2a7032', '#307b38'],
  };

  class Renderer {
    constructor(canvas) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.cam = { x: L / 2, y: GY, s: 14, vw: 72 };
      this.dpr = 1; this.w = 0; this.h = 0;
      this.pitch = null; this.pitchKey = '';
      this.t = 0; this.parts = []; this.rain = []; this.snow = [];
      this.trail = []; this.shake = 0; this.flash = 0;
      this.crowd = null; this.mood = 0.3; this.roar = 0;
      this.zoom = 'mid'; this.particles = true;
      this.confetti = [];
      this.resize();
    }

    resize() {
      const cv = this.cv;
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.dpr = dpr;
      this.w = Math.max(10, Math.round(r.width)); this.h = Math.max(10, Math.round(r.height));
      cv.width = Math.round(this.w * dpr); cv.height = Math.round(this.h * dpr);
      this.updateScale();
    }

    updateScale() {
      const vw = { far: 88, mid: 64, near: 48 }[this.zoom] || 64;
      let s = this.w / vw;
      if (this.h / s > 66) s = this.h / 66; // tall screens
      this.cam.s = s; this.cam.vw = vw;
    }

    setMatch(m) {
      this.m = m;
      const hc = m.teams[0].club, pst = hc.pitch || null;
      const key = m.weather + ':' + m.tod + ':' + hc.id + ':' + (pst ? JSON.stringify(pst) + hc.colors.p : '');
      if (key !== this.pitchKey) { this.pitchKey = key; this.buildPitch(m.weather, pst, hc); }
      this.buildCrowd(m);
      this.trail.length = 0; this.confetti.length = 0;
      const b = m.ball;
      this.cam.x = L / 2; this.cam.y = GY;
    }

    // ---------------- static pitch ----------------
    buildPitch(weather, pst, hclub) {
      pst = pst || {};
      const PPM = 13;
      const cw = Math.ceil((L + MARGIN * 2) * PPM), ch = Math.ceil((W + MARGIN * 2) * PPM);
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d');
      this.pitchPPM = PPM;
      const X = (x) => (x + MARGIN) * PPM, Y = (y) => (y + MARGIN) * PPM;
      const gr = GRASS[weather] || GRASS.clear;
      const snow = weather === 'snow';
      // surroundings (concrete / stands base)
      g.fillStyle = snow ? '#aab6c2' : '#1a2233';
      g.fillRect(0, 0, cw, ch);
      // stands: concentric rows
      const rows = 8;
      for (let i = 0; i < rows; i++) {
        const o = 3.6 + i * 1.2;
        g.fillStyle = i % 2 ? (snow ? '#98a5b3' : '#18202f') : (snow ? '#a3afbc' : '#1d2638');
        g.fillRect(X(-o), Y(-o), (L + 2 * o) * PPM, (W + 2 * o) * PPM);
        if (pst.seat === 'club' && hclub && hclub.colors) { g.globalAlpha = i % 2 ? 0.32 : 0.2; g.fillStyle = hclub.colors.p; g.fillRect(X(-o), Y(-o), (L + 2 * o) * PPM, (W + 2 * o) * PPM); g.globalAlpha = 1; }
      }
      // aisles
      g.strokeStyle = snow ? 'rgba(60,70,90,0.35)' : 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let k = 1; k < 10; k++) {
        const xx = X((L * k) / 10);
        g.beginPath(); g.moveTo(xx, Y(-12.4)); g.lineTo(xx, Y(-4)); g.moveTo(xx, Y(W + 4)); g.lineTo(xx, Y(W + 12.4)); g.stroke();
      }
      for (let k = 1; k < 6; k++) {
        const yy = Y((W * k) / 6);
        g.beginPath(); g.moveTo(X(-12.4), yy); g.lineTo(X(-4), yy); g.moveTo(X(L + 4), yy); g.lineTo(X(L + 12.4), yy); g.stroke();
      }
      // track / run-off area
      g.fillStyle = snow ? '#b9c8c0' : '#244d2c';
      g.fillRect(X(-3.4), Y(-3.4), (L + 6.8) * PPM, (W + 6.8) * PPM);
      // ad boards
      const ads = pst.ad ? [pst.ad, 'FCK', pst.ad, 'GOAL!', pst.ad, 'FAIR PLAY'] : ['FCK', 'KIDS CUP', 'GOAL!', 'FAIR PLAY', 'FCK', 'TEAMWORK'];
      const adC = ['#ff4d6d', '#ffd24d', '#2dff8f', '#3de0ff', '#ff9f3d', '#b58bff'];
      g.font = '700 ' + Math.round(1.3 * PPM) + 'px "Chakra Petch", sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
      const nAd = 9;
      for (let i = 0; i < nAd; i++) {
        const w1 = (L + 2) / nAd;
        const ax = -1 + i * w1;
        g.fillStyle = '#0a0e17'; g.fillRect(X(ax), Y(-2.9), w1 * PPM - 2, 1.25 * PPM);
        g.fillStyle = adC[i % adC.length]; g.fillText(ads[i % ads.length], X(ax + w1 / 2), Y(-2.28));
        g.fillStyle = '#0a0e17'; g.fillRect(X(ax), Y(W + 1.65), w1 * PPM - 2, 1.25 * PPM);
        g.fillStyle = adC[(i + 3) % adC.length]; g.fillText(ads[(i + 2) % ads.length], X(ax + w1 / 2), Y(W + 2.28));
      }
      // grass with mowing stripes
      const gs = pst.grass || 'stripes';
      const nS = gs === 'wide' ? 8 : 14, sw = L / nS;
      if (gs === 'checks') {
        const nY = 8, sh = W / nY;
        for (let i = 0; i < nS; i++) for (let j = 0; j < nY; j++) { g.fillStyle = gr[(i + j) % 2]; g.fillRect(X(i * sw), Y(j * sh), sw * PPM + 1, sh * PPM + 1); }
      } else if (gs === 'plain') {
        g.fillStyle = gr[0]; g.fillRect(X(0), Y(0), L * PPM, W * PPM);
      } else if (gs === 'diag') {
        g.fillStyle = gr[0]; g.fillRect(X(0), Y(0), L * PPM, W * PPM);
        g.save(); g.beginPath(); g.rect(X(0), Y(0), L * PPM, W * PPM); g.clip(); g.fillStyle = gr[1];
        for (let i = -6; i < 22; i++) { const x0 = X(i * 6); g.beginPath(); g.moveTo(x0, Y(0)); g.lineTo(x0 + 3 * PPM, Y(0)); g.lineTo(x0 + 3 * PPM - W * PPM * 0.6, Y(W)); g.lineTo(x0 - W * PPM * 0.6, Y(W)); g.closePath(); g.fill(); }
        g.restore();
      } else {
        for (let i = 0; i < nS; i++) {
          g.fillStyle = gr[i % 2];
          g.fillRect(X(i * sw), Y(0), sw * PPM + 1, W * PPM);
        }
      }
      // surrounding grass band
      g.fillStyle = gr[0]; g.globalAlpha = 0.55;
      g.fillRect(X(-3.4), Y(-3.4), (L + 6.8) * PPM, 3.4 * PPM);
      g.fillRect(X(-3.4), Y(W), (L + 6.8) * PPM, 3.4 * PPM);
      g.fillRect(X(-3.4), Y(0), 3.4 * PPM, W * PPM);
      g.fillRect(X(L), Y(0), 3.4 * PPM, W * PPM);
      g.globalAlpha = 1;
      // grass texture speckle
      const rnd = U.makeRng(77);
      for (let i = 0; i < 9000; i++) {
        const x = rnd.range(0, L), y = rnd.range(0, W);
        g.fillStyle = rnd.chance(0.5) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
        g.fillRect(X(x), Y(y), 2 + rnd.next() * 3, 1);
      }
      if (weather === 'rain' || weather === 'storm') {
        g.fillStyle = 'rgba(10,30,60,0.12)'; g.fillRect(X(0), Y(0), L * PPM, W * PPM);
      }
      // lines
      g.strokeStyle = snow ? '#f08a2c' : 'rgba(255,255,255,0.92)';
      g.lineWidth = Math.max(2, 0.12 * PPM);
      g.lineCap = 'butt';
      const R = (x, y, w, h) => g.strokeRect(X(x), Y(y), w * PPM, h * PPM);
      R(0, 0, L, W);
      g.beginPath(); g.moveTo(X(L / 2), Y(0)); g.lineTo(X(L / 2), Y(W)); g.stroke();
      g.beginPath(); g.arc(X(L / 2), Y(GY), P.circleR * PPM, 0, Math.PI * 2); g.stroke();
      g.fillStyle = g.strokeStyle;
      g.beginPath(); g.arc(X(L / 2), Y(GY), 0.25 * PPM, 0, Math.PI * 2); g.fill();
      [0, 1].forEach((side) => {
        const dir = side === 0 ? 1 : -1, gx = side === 0 ? 0 : L;
        R(side === 0 ? 0 : L - P.boxD, GY - P.boxW / 2, P.boxD, P.boxW);
        R(side === 0 ? 0 : L - P.sixD, GY - P.sixW / 2, P.sixD, P.sixW);
        const sx = gx + dir * P.penSpot;
        g.beginPath(); g.arc(X(sx), Y(GY), 0.25 * PPM, 0, Math.PI * 2); g.fill();
        // penalty arc
        const a0 = Math.acos((P.boxD - P.penSpot) / P.circleR);
        g.beginPath();
        if (side === 0) g.arc(X(sx), Y(GY), P.circleR * PPM, -a0, a0); else g.arc(X(sx), Y(GY), P.circleR * PPM, Math.PI - a0, Math.PI + a0);
        g.stroke();
        // goal + net
        const gd = P.goalDepth;
        const gx0 = side === 0 ? -gd : L;
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(X(gx0), Y(GY - HG), gd * PPM, P.goalW * PPM);
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
        for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(X(gx0), Y(GY - HG + (P.goalW * i) / 8)); g.lineTo(X(gx0 + gd), Y(GY - HG + (P.goalW * i) / 8)); g.stroke(); }
        for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(X(gx0 + (gd * i) / 4), Y(GY - HG)); g.lineTo(X(gx0 + (gd * i) / 4), Y(GY + HG)); g.stroke(); }
        g.strokeStyle = snow ? '#f08a2c' : 'rgba(255,255,255,0.92)'; g.lineWidth = Math.max(2, 0.12 * PPM);
        g.strokeRect(X(gx0), Y(GY - HG), gd * PPM, P.goalW * PPM);
        g.fillStyle = '#ffffff';
        [GY - HG, GY + HG].forEach((py) => { g.beginPath(); g.arc(X(gx), Y(py), 0.2 * PPM, 0, Math.PI * 2); g.fill(); });
        g.fillStyle = snow ? '#f08a2c' : 'rgba(255,255,255,0.92)';
      });
      // corner arcs
      g.strokeStyle = snow ? '#f08a2c' : 'rgba(255,255,255,0.92)'; g.lineWidth = Math.max(2, 0.12 * PPM);
      [[0, 0, 0, Math.PI / 2], [L, 0, Math.PI / 2, Math.PI], [L, W, Math.PI, Math.PI * 1.5], [0, W, Math.PI * 1.5, Math.PI * 2]].forEach((a) => {
        g.beginPath(); g.arc(X(a[0]), Y(a[1]), 1 * PPM, a[2], a[3]); g.stroke();
      });
      this.pitch = c;
    }

    buildCrowd(m) {
      // crowd dots on the stands, deterministic
      const rnd = U.makeRng(4242);
      const n = Math.round(U.clamp(m.crowd.att / 22, 600, 4200));
      const pts = [];
      const cA = m.teams[0].kit.shirt, cB = m.teams[1].kit.shirt;
      const pal = [cA, cA, cA, cB, '#e8edf7', '#f2c14e', '#7aa2ff', '#ff7a7a'];
      let tries = 0;
      while (pts.length < n && tries < n * 6) {
        tries++;
        const side = rnd.int(0, 3);
        const o = rnd.range(3.8, 12.6);
        let x, y;
        if (side === 0) { x = rnd.range(-o, L + o); y = -o; }
        else if (side === 1) { x = rnd.range(-o, L + o); y = W + o; }
        else if (side === 2) { x = -o; y = rnd.range(-o, W + o); }
        else { x = L + o; y = rnd.range(-o, W + o); }
        // seat grid
        x = Math.round(x * 1.2) / 1.2; y = Math.round(y * 1.2) / 1.2;
        if (rnd.chance(0.12)) continue; // empty seats
        const fill = U.clamp(m.crowd.att / m.crowd.cap, 0.3, 1);
        if (rnd.next() > fill) continue;
        pts.push({ x, y, c: pal[rnd.int(0, pal.length - 1)], ph: rnd.next() * 6.28, side });
      }
      this.crowd = pts;
    }

    // ---------------- camera ----------------
    focus(view, dt, snap) {
      const b = view.ball;
      const cam = this.cam;
      let tx = b.x + (b.vx || 0) * 0.28, ty = b.y + (b.vy || 0) * 0.28;
      const halfW = this.w / cam.s / 2, halfH = this.h / cam.s / 2;
      const mx = MARGIN - 4;
      const minX = halfW - mx, maxX = L + mx - halfW, minY = halfH - mx, maxY = W + mx - halfH;
      tx = minX > maxX ? L / 2 : U.clamp(tx, minX, maxX);
      ty = minY > maxY ? GY : U.clamp(ty, minY, maxY);
      const k = snap ? 1 : 1 - Math.exp(-dt * 3.6);
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    }

    toScreen(x, y) { return [(x - this.cam.x) * this.cam.s + this.w / 2, (y - this.cam.y) * this.cam.s + this.h / 2]; }

    // ---------------- main draw ----------------
    draw(view, dt, opts) {
      opts = opts || {};
      const ctx = this.ctx, m = this.m, cam = this.cam;
      this.t += dt;
      this.shake = Math.max(0, this.shake - dt * 1.5);
      if (opts.shake) this.shake = Math.max(this.shake, opts.shake);
      this.focus(view, dt, opts.snap);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#0a0e17'; ctx.fillRect(0, 0, this.w, this.h);
      ctx.save();
      const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 10 : 0, sy = this.shake > 0 ? (Math.random() - 0.5) * this.shake * 10 : 0;
      ctx.translate(this.w / 2 - cam.x * cam.s + sx, this.h / 2 - cam.y * cam.s + sy);
      ctx.scale(cam.s, cam.s);
      // pitch
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.pitch, -MARGIN, -MARGIN, L + MARGIN * 2, W + MARGIN * 2);
      this.drawCrowd(ctx, view, dt);
      this.drawMarkers(ctx, view, opts);
      // shadows + sorted players
      const ps = view.players.slice().sort((a, c) => a.y - c.y);
      for (let i = 0; i < ps.length; i++) this.drawShadow(ctx, ps[i]);
      this.drawBallShadow(ctx, view.ball);
      for (let i = 0; i < ps.length; i++) this.drawPlayer(ctx, ps[i], view);
      if (view.ref) this.drawRef(ctx, view.ref);
      this.drawBall(ctx, view.ball, dt);
      this.drawAim(ctx, view, opts);
      this.drawConfetti(ctx, dt);
      ctx.restore();
      this.drawAtmosphere(ctx, dt, view);
      if (opts.hud !== false) this.drawRadar(ctx, view, opts);
      if (this.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.35) + ')'; ctx.fillRect(0, 0, this.w, this.h); this.flash = Math.max(0, this.flash - dt * 2.2); }
    }

    drawCrowd(ctx, view, dt) {
      const pts = this.crowd; if (!pts) return;
      const cam = this.cam;
      const x0 = cam.x - this.w / cam.s / 2 - 2, x1 = cam.x + this.w / cam.s / 2 + 2, y0 = cam.y - this.h / cam.s / 2 - 2, y1 = cam.y + this.h / cam.s / 2 + 2;
      const mood = this.mood, t = this.t;
      const byColor = {};
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        const bob = Math.sin(t * (4 + mood * 6) + p.ph) * (0.08 + mood * 0.22 + this.roar * 0.3);
        const dx = p.side >= 2 ? bob : 0, dy = p.side < 2 ? bob : 0;
        (byColor[p.c] || (byColor[p.c] = [])).push(p.x + dx, p.y + dy);
      }
      const sz = 0.62;
      for (const c in byColor) {
        const a = byColor[c];
        ctx.fillStyle = c; ctx.beginPath();
        for (let i = 0; i < a.length; i += 2) ctx.rect(a[i] - sz / 2, a[i + 1] - sz / 2, sz, sz);
        ctx.fill();
      }
      this.roar = Math.max(0, this.roar - dt * 0.5);
    }

    drawMarkers(ctx, view, opts) {
      // restart spot marker + rule helpers (9.15 m circle, kick-off circle, 5.5 m box)
      const r = opts.restart;
      if (!r) return;
      const pulse = 0.9 + Math.sin(this.t * 5) * 0.12;
      ctx.save();
      if (r.type === 'freekick' || r.type === 'corner' || r.type === 'throwin' || r.type === 'goalkick' || r.type === 'kickoff') {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.arc(r.x, r.y, pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      if (r.type === 'freekick' && r.phase !== 'free') {
        ctx.setLineDash([0.5, 0.5]); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.09;
        ctx.beginPath(); ctx.arc(r.x, r.y, 9.15, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (r.type === 'throwin') {
        const inward = r.y < P.cy ? 1 : -1;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.14;
        ctx.beginPath(); ctx.moveTo(r.x - 1.6, r.y); ctx.lineTo(r.x + 1.6, r.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r.x, r.y + inward * 1.2); ctx.lineTo(r.x - 0.5, r.y + inward * 2.2); ctx.moveTo(r.x, r.y + inward * 1.2); ctx.lineTo(r.x + 0.5, r.y + inward * 2.2); ctx.stroke();
      }
      ctx.restore();
    }

    drawShadow(ctx, p) {
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath(); ctx.ellipse(p.x + 0.12, p.y + 0.16, 0.5, 0.34, 0, 0, Math.PI * 2); ctx.fill();
    }
    drawBallShadow(ctx, b) {
      const h = Math.min(b.z, 8);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.32 - Math.min(h, 6) * 0.03) + ')';
      ctx.beginPath(); ctx.ellipse(b.x + 0.1 + h * 0.18, b.y + 0.12 + h * 0.2, 0.24 + h * 0.01, 0.2, 0, 0, Math.PI * 2); ctx.fill();
    }

    drawHead(ctx, look, r) {
      const skin = look.skin, hair = look.hair, st = look.hairStyle;
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hair;
      if (st === 'bald') {
        // nothing
      } else if (st === 'buzz' || st === 'fade') {
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.55, Math.PI * 1.45); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (st === 'short') {
        ctx.beginPath(); ctx.arc(0, 0, r * 1.02, Math.PI * 0.42, Math.PI * 1.58); ctx.lineTo(r * 0.1, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.05, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.42, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      } else if (st === 'long') {
        ctx.beginPath(); ctx.ellipse(-r * 0.7, 0, r * 1.25, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(r * 0.5, 0, r * 0.45, r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      } else if (st === 'curly') {
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.55, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.35, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      } else if (st === 'bun') {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.98, Math.PI * 0.5, Math.PI * 1.5); ctx.lineTo(r * 0.2, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.95, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.4, r * 0.65, 0, 0, Math.PI * 2); ctx.fill();
      } else if (st === 'mohawk') {
        ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      } else if (st === 'afro') {
        ctx.beginPath(); ctx.arc(-r * 0.1, 0, r * 1.38, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(r * 0.62, 0, r * 0.32, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      } else if (st === 'ponytail') {
        ctx.beginPath(); ctx.arc(0, 0, r * 1.0, Math.PI * 0.45, Math.PI * 1.55); ctx.lineTo(r * 0.1, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.05, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-r * 1.25, 0, r * 0.7, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.42, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      } else if (st === 'quiff' || st === 'sidepart' || st === 'curtains' || st === 'undercut' || st === 'braids') {
        ctx.beginPath(); ctx.arc(0, 0, r * 1.02, Math.PI * 0.42, Math.PI * 1.58); ctx.lineTo(r * 0.1, 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.05, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
        if (st === 'quiff') { ctx.beginPath(); ctx.ellipse(r * 0.35, 0, r * 0.38, r * 0.62, 0, 0, Math.PI * 2); ctx.fill(); }
        if (st === 'braids') { ctx.strokeStyle = hair; ctx.lineWidth = r * 0.16; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.3, i * r * 0.32); ctx.lineTo(-r * 1.15, i * r * 0.4); ctx.stroke(); } }
        ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(r * 0.55, 0, r * 0.42, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      }
      const bst = look.beard ? (look.beardStyle || 'full') : 'none';
      if (bst !== 'none') {
        ctx.fillStyle = look.beardCol || hair; ctx.globalAlpha = bst === 'stubble' ? 0.4 : 0.9;
        if (bst === 'goatee') { ctx.beginPath(); ctx.arc(r * 0.78, 0, r * 0.3, 0, Math.PI * 2); ctx.fill(); }
        else if (bst === 'mustache') { ctx.beginPath(); ctx.ellipse(r * 0.8, 0, r * 0.14, r * 0.38, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(r * 0.15, 0, r * 0.98, -Math.PI * 0.42, Math.PI * 0.42); ctx.arc(r * 0.1, 0, r * 0.55, Math.PI * 0.42, -Math.PI * 0.42, true); ctx.closePath(); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      if (look.f && look.f.band) { ctx.strokeStyle = look.f.band; ctx.lineWidth = r * 0.22; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.9, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
    }

    drawPlayer(ctx, p, view) {
      const team = p.team, kit = team.kit;
      const st = p.state;
      let shirt = p.isGK ? kit.gk : kit.shirt;
      const shorts = p.isGK ? kit.gkShorts : kit.shorts;
      const socks = p.isGK ? kit.gk : kit.socks;
      ctx.save();
      ctx.translate(p.x, p.y);
      // controlled ring
      if (p.ctrl >= 0) {
        const col = SLOT_COLORS[p.ctrl % 4];
        ctx.strokeStyle = col; ctx.lineWidth = 0.14;
        ctx.beginPath(); ctx.ellipse(0, 0, 0.95 + Math.sin(this.t * 6) * 0.05, 0.75 + Math.sin(this.t * 6) * 0.04, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(0, -1.6 - Math.sin(this.t * 7) * 0.15); ctx.lineTo(-0.38, -2.2 - Math.sin(this.t * 7) * 0.15); ctx.lineTo(0.38, -2.2 - Math.sin(this.t * 7) * 0.15); ctx.closePath(); ctx.fill();
      }
      const jmp = p.jumpT > 0 ? 1 + Math.sin(Math.min(1, (0.45 - p.jumpT) / 0.45) * Math.PI) * 0.22 : 1;
      ctx.scale(1.18 * jmp, 1.18 * jmp);
      ctx.rotate(p.ang);
      const ph = p.runPhase || 0;
      const run = Math.min(1, (p.spd || 0) / 6);
      const swing = Math.sin(ph * 2.4) * 0.32 * run;
      if (st === 'slide' || st === 'dive') {
        // stretched body
        ctx.fillStyle = socks;
        ctx.beginPath(); ctx.ellipse(0.55, -0.1, 0.55, 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0.55, 0.14, 0.55, 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shorts; ctx.beginPath(); ctx.ellipse(-0.05, 0, 0.3, 0.32, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(-0.5, 0, 0.5, 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(-1.0, 0); this.drawHead(ctx, p.look, 0.2); ctx.restore();
        if (st === 'dive') { ctx.fillStyle = '#e9edf5'; ctx.beginPath(); ctx.ellipse(0.85, -0.12, 0.2, 0.1, 0, 0, 7); ctx.ellipse(0.85, 0.14, 0.2, 0.1, 0, 0, 7); ctx.fill(); }
      } else if (st === 'down') {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, 0, 0.5, 0.3, 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = shorts; ctx.beginPath(); ctx.ellipse(0.45, 0.15, 0.35, 0.2, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(-0.55, -0.15); this.drawHead(ctx, p.look, 0.2); ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        // legs
        ctx.fillStyle = socks;
        ctx.beginPath(); ctx.ellipse(swing, -0.19, 0.2, 0.11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-swing, 0.19, 0.2, 0.11, 0, 0, Math.PI * 2); ctx.fill();
        // shorts
        ctx.fillStyle = shorts;
        ctx.beginPath(); ctx.ellipse(-0.02, 0, 0.26, 0.4, 0, 0, Math.PI * 2); ctx.fill();
        // arms
        ctx.fillStyle = shirt;
        const arm = st === 'celebrate' ? 0.0 : -swing * 0.9;
        ctx.beginPath(); ctx.ellipse(arm, -0.52, 0.14, 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-arm, 0.52, 0.14, 0.1, 0, 0, Math.PI * 2); ctx.fill();
        // torso
        ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.5, 0, 0, Math.PI * 2); ctx.fill();
        if (!p.isGK && kit.pattern !== 'solid') {
          ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.5, 0, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = kit.shirt2;
          if (kit.pattern === 'stripesV') { for (let i = -2; i <= 2; i += 2) ctx.fillRect(-0.3, i * 0.17 - 0.085, 0.6, 0.17); }
          else if (kit.pattern === 'hoops') { ctx.fillRect(-0.12, -0.5, 0.14, 1); }
          else if (kit.pattern === 'halves') { ctx.fillRect(-0.3, 0, 0.6, 0.5); }
          else if (kit.pattern === 'band') { ctx.fillRect(-0.05, -0.5, 0.12, 1); }
          else if (kit.pattern === 'sash') { ctx.fillRect(-0.3, -0.5, 0.6, 0.2); }
          else if (kit.pattern === 'sleeves') { ctx.fillRect(-0.3, -0.5, 0.6, 0.14); ctx.fillRect(-0.3, 0.36, 0.6, 0.14); }
          ctx.restore();
        }
        ctx.save(); ctx.translate(0.03, 0); this.drawHead(ctx, p.look, 0.21); ctx.restore();
        if (st === 'celebrate') {
          ctx.strokeStyle = shirt; ctx.lineWidth = 0.12; ctx.lineCap = 'round';
          const up = 0.5 + Math.sin(this.t * 12) * 0.2;
          ctx.beginPath(); ctx.moveTo(0, -0.4); ctx.lineTo(0.2, -0.4 - up); ctx.moveTo(0, 0.4); ctx.lineTo(0.2, 0.4 + up); ctx.stroke();
        }
      }
      ctx.restore();
      // names / indicators
      if (p.ctrl >= 0 && this.cam.s > 10) {
        ctx.save(); ctx.translate(p.x, p.y);
        ctx.font = '600 0.95px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(8,12,22,0.7)'; const tw = ctx.measureText(p.sname).width + 0.7;
        ctx.fillRect(-tw / 2, 1.0, tw, 1.25);
        ctx.fillStyle = SLOT_COLORS[p.ctrl % 4]; ctx.fillText(p.sname, 0, 1.08);
        ctx.restore();
      }
    }

    drawRef(ctx, r) {
      ctx.save(); ctx.translate(r.x, r.y);
      const ang = Math.atan2(r.vy || 0, r.vx || 1);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.beginPath(); ctx.ellipse(0.1, 0.14, 0.5, 0.34, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.ellipse(0, 0, 0.3, 0.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd24d'; ctx.fillRect(-0.3, -0.12, 0.6, 0.12);
      ctx.fillStyle = '#e5b998'; ctx.beginPath(); ctx.arc(0.03, 0, 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(-0.03, 0, 0.17, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
      ctx.restore();
    }

    drawBall(ctx, b, dt) {
      const speed = Math.sqrt((b.vx || 0) * (b.vx || 0) + (b.vy || 0) * (b.vy || 0));
      if (speed > 17 && b.z < 2) {
        this.trail.push({ x: b.x, y: b.y, a: 1 });
      }
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const t = this.trail[i]; t.a -= dt * 3.5;
        if (t.a <= 0) this.trail.splice(i, 1);
        else { ctx.fillStyle = 'rgba(255,255,255,' + t.a * 0.35 + ')'; ctx.beginPath(); ctx.arc(t.x, t.y, 0.2 * t.a + 0.06, 0, 7); ctx.fill(); }
      }
      const r = 0.3 + Math.min(b.z, 8) * 0.03;
      const px = b.x, py = b.y - b.z * 0.28;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(20,25,40,0.9)'; ctx.lineWidth = 0.05; ctx.stroke();
      this.ballRot = (this.ballRot || 0) + speed * dt * 1.6;
      ctx.fillStyle = '#1b2233';
      for (let i = 0; i < 3; i++) {
        const a = this.ballRot + (i * Math.PI * 2) / 3;
        ctx.beginPath(); ctx.arc(px + Math.cos(a) * r * 0.5, py + Math.sin(a) * r * 0.5, r * 0.26, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawAim(ctx, view, opts) {
      // aiming arrow + charge bars for human players
      const m = opts.match;
      if (!m) return;
      m.slots.forEach((s) => {
        const p = s.player; if (!p) return;
        const col = SLOT_COLORS[s.i % 4];
        const inp = s.input;
        const hasBall = m.ball.owner === p;
        const rst = m.restart;
        const taking = m.mode === 'restart' && rst && rst.taker === p && rst.phase === 'ready';
        if (taking || (m.mode === 'shootout' && m.shootout && m.shootout.shooter === p)) {
          const aim = (rst && rst.aim) || (inp ? { x: inp.dx, y: inp.dy } : null);
          let ax = aim ? aim.x : p.team.dir, ay = aim ? aim.y : 0;
          if (Math.abs(ax) + Math.abs(ay) < 0.2) { ax = p.team.dir; ay = 0; }
          const [nx, ny] = U.norm(ax, ay);
          ctx.strokeStyle = col; ctx.lineWidth = 0.16; ctx.setLineDash([0.6, 0.5]);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + nx * 12, p.y + ny * 12); ctx.stroke(); ctx.setLineDash([]);
          if (rst && rst.type !== 'penalty' && m.mode === 'restart') {
            const hasAim = aim && Math.abs(aim.x) + Math.abs(aim.y) > 0.2;
            const t = hasAim ? m.pickTarget(p, ax, ay, rst.type === 'goalkick' || rst.type === 'corner' ? 'lob' : 'pass') : null;
            if (t) {
              ctx.strokeStyle = col; ctx.lineWidth = 0.12; ctx.globalAlpha = 0.9;
              ctx.beginPath(); ctx.arc(t.x, t.y, 1.1 + Math.sin(this.t * 8) * 0.12, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
            }
            if (rst.type === 'freekick' && rst.wall && rst.wall.length) { // curl hint: bent path towards the aimed side
              const gx = p.team.goalX, f = Math.abs(gx - p.x);
              if (nx * (gx - p.x) > 0.05) {
                const yHit = p.y + ny * ((gx - p.x) / nx), off = yHit - P.cy;
                if (Math.abs(off) > 0.8) {
                  const sg = Math.sign(off);
                  ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(p.x, p.y);
                  for (let i = 1; i <= 12; i++) { const q = i / 12; ctx.lineTo(p.x + (gx - p.x) * q, p.y + (yHit - p.y) * q + sg * Math.sin(q * Math.PI) * Math.min(4, f * 0.09)); }
                  ctx.stroke(); ctx.globalAlpha = 1;
                }
              }
            }
          }
        }
        if (s.charge > 0.02 && (hasBall || taking || (m.mode === 'shootout'))) {
          const w = 2.4, h = 0.34;
          ctx.fillStyle = 'rgba(8,12,22,0.75)'; ctx.fillRect(p.x - w / 2, p.y + 2.45, w, h);
          ctx.fillStyle = s.charge > 0.85 ? '#ff4d6d' : s.chargeKind === 3 ? '#ffd24d' : col;
          ctx.fillRect(p.x - w / 2, p.y + 2.45, w * s.charge, h);
        }
        if (hasBall && inp && (Math.abs(inp.dx) + Math.abs(inp.dy)) > 0.2 && m.mode === 'play') {
          const t = m.pickTarget(p, inp.dx, inp.dy, 'pass');
          if (t) {
            ctx.strokeStyle = col; ctx.lineWidth = 0.1; ctx.globalAlpha = 0.8;
            ctx.beginPath(); ctx.arc(t.x, t.y, 1.0 + Math.sin(this.t * 8) * 0.1, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
          }
        }
      });
    }

    // ---------------- confetti & goal effects ----------------
    celebrate(x, y, c1, c2) {
      if (!this.particles) return;
      for (let i = 0; i < 110; i++) {
        const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 9;
        this.confetti.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.6 + Math.random() * 1.4, c: [c1, c2, '#ffffff', '#ffd24d'][i % 4], r: Math.random() * 6 });
      }
      this.roar = 1; this.flash = 0.8;
    }
    drawConfetti(ctx, dt) {
      for (let i = this.confetti.length - 1; i >= 0; i--) {
        const c = this.confetti[i];
        c.life -= dt;
        if (c.life <= 0) { this.confetti.splice(i, 1); continue; }
        c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 1 - dt * 1.4; c.vy *= 1 - dt * 1.4; c.vy += dt * 4;
        c.r += dt * 9;
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r);
        ctx.globalAlpha = Math.min(1, c.life);
        ctx.fillStyle = c.c; ctx.fillRect(-0.12, -0.07, 0.24, 0.14);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // ---------------- atmosphere (weather, time of day) ----------------
    drawAtmosphere(ctx, dt, view) {
      const m = this.m, w = this.w, h = this.h;
      // time of day tint
      if (m.tod === 'evening') {
        ctx.fillStyle = 'rgba(255,140,60,0.14)'; ctx.fillRect(0, 0, w, h);
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, 'rgba(20,8,30,0)'); g.addColorStop(1, 'rgba(20,8,40,0.38)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      } else if (m.tod === 'night') {
        ctx.fillStyle = 'rgba(4,10,32,0.4)'; ctx.fillRect(0, 0, w, h);
        // floodlight pools around the corners of the pitch
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const pools = [[-6, -6], [L + 6, -6], [-6, W + 6], [L + 6, W + 6], [L / 2, -9], [L / 2, W + 9]];
        pools.forEach((q) => {
          const [sx, sy] = this.toScreen(q[0], q[1]);
          const rad = this.cam.s * 46;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
          g.addColorStop(0, 'rgba(255,244,214,0.20)'); g.addColorStop(1, 'rgba(255,244,214,0)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        });
        ctx.restore();
        // light under ball for readability
      }
      if (m.weather === 'cloudy') { ctx.fillStyle = 'rgba(40,50,70,0.10)'; ctx.fillRect(0, 0, w, h); }
      if (m.weather === 'rain' || m.weather === 'storm') {
        ctx.fillStyle = m.weather === 'storm' ? 'rgba(10,20,40,0.28)' : 'rgba(20,30,50,0.16)'; ctx.fillRect(0, 0, w, h);
        if (this.particles) {
          const n = m.weather === 'storm' ? 260 : 150;
          while (this.rain.length < n) this.rain.push({ x: Math.random() * w, y: Math.random() * h, v: 700 + Math.random() * 500 });
          ctx.strokeStyle = 'rgba(190,215,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
          const wx = (m.wind.x * 14) + 40;
          for (let i = 0; i < this.rain.length; i++) {
            const r = this.rain[i];
            r.y += r.v * dt; r.x += wx * dt * 4;
            if (r.y > h) { r.y = -20; r.x = Math.random() * w; }
            if (r.x > w) r.x = 0; if (r.x < 0) r.x = w;
            ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - wx * 0.03, r.y - 14);
          }
          ctx.stroke();
        }
        if (m.weather === 'storm' && Math.random() < dt * 0.12) this.flash = 0.35;
      }
      if (m.weather === 'snow' && this.particles) {
        while (this.snow.length < 180) this.snow.push({ x: Math.random() * w, y: Math.random() * h, v: 40 + Math.random() * 60, p: Math.random() * 6, r: 1 + Math.random() * 2 });
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        for (let i = 0; i < this.snow.length; i++) {
          const s = this.snow[i];
          s.y += s.v * dt; s.x += Math.sin(this.t * 1.2 + s.p) * 20 * dt + m.wind.x * 4 * dt;
          if (s.y > h) { s.y = -5; s.x = Math.random() * w; }
          ctx.moveTo(s.x + s.r, s.y); ctx.arc(s.x, s.y, s.r, 0, 6.3);
        }
        ctx.fill();
      }
      if (m.weather === 'fog') {
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.62);
        g.addColorStop(0, 'rgba(200,210,220,0.10)'); g.addColorStop(1, 'rgba(200,210,220,0.78)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }

    // ---------------- radar ----------------
    drawRadar(ctx, view, opts) {
      if (!opts.radar) return;
      const rw = Math.min(170, this.w * 0.24), rh = rw * (W / L);
      const x0 = 12, y0 = this.h - rh - 12 - (opts.radarLift || 0);
      ctx.save();
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = 'rgba(8,12,22,0.78)'; this.rr(ctx, x0 - 4, y0 - 4, rw + 8, rh + 8, 6); ctx.fill();
      ctx.fillStyle = 'rgba(30,110,60,0.55)'; ctx.fillRect(x0, y0, rw, rh);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x0, y0, rw, rh);
      ctx.beginPath(); ctx.moveTo(x0 + rw / 2, y0); ctx.lineTo(x0 + rw / 2, y0 + rh); ctx.stroke();
      const sx = rw / L, sy = rh / W;
      // camera frame
      const cw = (this.w / this.cam.s) * sx, ch = (this.h / this.cam.s) * sy;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(x0 + (this.cam.x - this.w / this.cam.s / 2) * sx, y0 + (this.cam.y - this.h / this.cam.s / 2) * sy, cw, ch);
      view.players.forEach((p) => {
        ctx.fillStyle = p.team.kit.shirt;
        ctx.strokeStyle = p.ctrl >= 0 ? SLOT_COLORS[p.ctrl % 4] : 'rgba(0,0,0,0.8)'; ctx.lineWidth = p.ctrl >= 0 ? 2 : 1;
        ctx.beginPath(); ctx.arc(x0 + U.clamp(p.x, 0, L) * sx, y0 + U.clamp(p.y, 0, W) * sy, p.ctrl >= 0 ? 3.4 : 2.6, 0, 7); ctx.fill(); ctx.stroke();
      });
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + U.clamp(view.ball.x, 0, L) * sx, y0 + U.clamp(view.ball.y, 0, W) * sy, 2.2, 0, 7); ctx.fill();
      ctx.restore();
    }
    rr(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
  }

  FCK.Renderer = Renderer;
})((globalThis.FCK = globalThis.FCK || {}));
