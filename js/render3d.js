/* FCK - render3d.js : 3D match view (three.js r128). Drop-in alternative to render.js:
   FCK.Renderer3D extends FCK.Renderer, so every property/method main.js uses on the 2D renderer still works.
   Real matches and archive replays are drawn in WebGL; the menu demo background stays 2D.
   World mapping: game (x, y, height) -> three (X = x, Y = height, Z = y). The default TV camera sits on the +Z side and
   looks along -Z, so screen right = +x and screen up = -y exactly like the 2D view (stick directions need no change). */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const P = FCK.PITCH;
  const L = P.L, W = P.W, GY = P.cy, HG = P.goalW / 2;
  const HAS_THREE = typeof THREE !== 'undefined' && !!THREE && !!THREE.WebGLRenderer && !!FCK.Renderer;
  const CAMS = ['tv', 'high', 'goal', 'top'];
  const QUALS = ['low', 'mid', 'high'];
  const SLOT_COLORS = FCK.SLOT_COLORS || ['#3de0ff', '#ff9f3d', '#ff5fa8', '#ffe14d'];
  if (FCK.DEFAULTS) Object.assign(FCK.DEFAULTS, { gfx3d: '3d', cam3d: 'tv', q3d: (function () { try { return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'low' : 'mid'; } catch (e) { return 'mid'; } })() });
  FCK.R3D_CAMS = CAMS; FCK.R3D_QUALS = QUALS;

  if (!HAS_THREE) {
    FCK.Renderer3D = null; FCK.view3dFields = () => null; FCK.rotInput = () => {};
    return;
  }

  const PM = 7; // metres of grass drawn around the pitch lines
  const AD_OFF = 3.5; // ad boards: distance from the lines
  const SO = 8.5; // stands: distance of the first row from the lines
  const ROWS = 9, ROW_D = 0.85, ROW_H = 0.55, ROW_H0 = 1.1;
  const SC = 1.12; // player scale (slightly chunky for readability)
  const BALL_R = 0.28;
  const HEMI = Math.PI / 2;

  // ---------------------------------------------------------------- small helpers
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n += n << 3; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const colCache = {};
  function col(c) { if (c && c.isColor) return c; return colCache[c] || (colCache[c] = new THREE.Color(c)); }
  function mixCol(a, b, t) { return new THREE.Color(col(a)).lerp(col(b), t); }
  function shade(c, k) { const o = new THREE.Color(col(c)); o.r = Math.min(1, o.r * k); o.g = Math.min(1, o.g * k); o.b = Math.min(1, o.b * k); return o; }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = U.clamp;
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
  function canvasTex(w, h, draw, opts) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (opts) Object.assign(t, opts);
    return t;
  }

  // ---------------------------------------------------------------- geometry builder (flat shaded, vertex coloured, optional rigid skinning)
  const ATLAS_N = 16; // 16 x 16 cells of 64 px: numbers 0..99, cell 255 = opaque white
  const WU = (ATLAS_N - 0.5) / ATLAS_N, WV = 1 - (ATLAS_N - 0.5) / ATLAS_N;
  class GB {
    constructor(skinned) { this.pos = []; this.col = []; this.uv = []; this.si = []; this.skinned = !!skinned; this.bone = 0; }
    vert(p, c, u, v) {
      this.pos.push(p[0], p[1], p[2]); this.col.push(c.r, c.g, c.b);
      if (this.skinned) { this.uv.push(u === undefined ? WU : u, v === undefined ? WV : v); this.si.push(this.bone); }
    }
    tri(a, b, c, k) { k = col(k); this.vert(a, k); this.vert(b, k); this.vert(c, k); }
    quad(a, b, c, d, k) { this.tri(a, b, c, k); this.tri(a, c, d, k); }
    // quad whose normal is flipped automatically to face (nx, ny, nz)
    quadN(a, b, c, d, k, nx, ny, nz) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * nx + cy * ny + cz * nz >= 0) this.quad(a, b, c, d, k); else this.quad(a, d, c, b, k);
    }
    box(x0, y0, z0, x1, y1, z1, k) {
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], k);
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], k);
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], k);
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], k);
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], k);
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], k);
    }
    // tapered box: bottom half sizes (bx, bz) at y0, top half sizes (tx, tz) at y1, centre (cx, cz) (top centre may shift by dx)
    taper(cx, cz, y0, y1, bx, bz, tx, tz, k, dx) {
      dx = dx || 0;
      const B = (sx, sz) => [cx + sx * bx, y0, cz + sz * bz], T = (sx, sz) => [cx + dx + sx * tx, y1, cz + sz * tz];
      this.quad(B(1, 1), B(1, -1), T(1, -1), T(1, 1), k);
      this.quad(B(-1, -1), B(-1, 1), T(-1, 1), T(-1, -1), k);
      this.quad(T(-1, 1), T(1, 1), T(1, -1), T(-1, -1), k);
      this.quad(B(-1, -1), B(1, -1), B(1, 1), B(-1, 1), k);
      this.quad(B(-1, 1), B(1, 1), T(1, 1), T(-1, 1), k);
      this.quad(B(1, -1), B(-1, -1), T(-1, -1), T(1, -1), k);
    }
    // thin prism between two points
    bar(a, b, t, k) {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      let ux = dx / l, uy = dy / l, uz = dz / l;
      // any perpendicular
      let px = -uz, py = 0, pz = ux; let pl = Math.sqrt(px * px + pz * pz);
      if (pl < 1e-4) { px = 1; py = 0; pz = 0; pl = 1; }
      px = (px / pl) * t; py = 0; pz = (pz / pl) * t;
      const qx = (uy * pz - uz * py), qy = (uz * px - ux * pz), qz = (ux * py - uy * px); // u x p
      const ql = Math.sqrt(qx * qx + qy * qy + qz * qz) || 1, sx = (qx / ql) * t, sy = (qy / ql) * t, sz = (qz / ql) * t;
      const C = (e, s1, s2) => [e[0] + px * s1 + sx * s2, e[1] + py * s1 + sy * s2, e[2] + pz * s1 + sz * s2];
      const A = [C(a, 1, 1), C(a, -1, 1), C(a, -1, -1), C(a, 1, -1)], B = [C(b, 1, 1), C(b, -1, 1), C(b, -1, -1), C(b, 1, -1)];
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quadN(A[i], A[j], B[j], B[i], k, (A[i][0] + A[j][0]) / 2 - a[0], (A[i][1] + A[j][1]) / 2 - a[1], (A[i][2] + A[j][2]) / 2 - a[2]); }
      this.quadN(A[0], A[1], A[2], A[3], k, -ux, -uy, -uz); this.quadN(B[0], B[1], B[2], B[3], k, ux, uy, uz);
    }
    // ellipsoid; rows i0..i1 of hSeg (top to bottom), theta from 0 (= +x) around y
    sphere(cx, cy, cz, rx, ry, rz, wSeg, hSeg, k, i0, i1) {
      i0 = i0 || 0; i1 = i1 === undefined ? hSeg : i1;
      const pt = (i, j) => { const ph = (i / hSeg) * Math.PI, th = (j / wSeg) * Math.PI * 2; return [cx + rx * Math.sin(ph) * Math.cos(th), cy + ry * Math.cos(ph), cz + rz * Math.sin(ph) * Math.sin(th)]; };
      for (let i = i0; i < i1; i++) for (let j = 0; j < wSeg; j++) {
        const a = pt(i, j), b = pt(i, j + 1), c = pt(i + 1, j + 1), d = pt(i + 1, j);
        if (i === 0) this.tri(a, c, d, k); else if (i === hSeg - 1) this.tri(a, b, c, k); else this.quad(a, b, c, d, k);
      }
    }
    build() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      if (this.skinned) {
        const n = this.si.length, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { idx[i * 4] = this.si[i]; wt[i * 4] = 1; }
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
        g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
      }
      g.computeVertexNormals();
      return g;
    }
  }

  // dynamic ground decals (guides, rings, markers): quads written into a preallocated buffer every frame
  class QuadBatch {
    constructor(maxQuads, opacity, order) {
      this.max = maxQuads; this.n = 0;
      this.pos = new Float32Array(maxQuads * 12); this.col = new Float32Array(maxQuads * 12);
      const idx = new Uint16Array(maxQuads * 6);
      for (let i = 0; i < maxQuads; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.setDrawRange(0, 0);
      this.geo = g;
      this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
    }
    begin() { this.n = 0; }
    quad(ax, az, bx, bz, cx, cz, dx, dz, y, c) {
      if (this.n >= this.max) return;
      const o = this.n * 12, p = this.pos, k = this.col;
      p[o] = ax; p[o + 1] = y; p[o + 2] = az; p[o + 3] = bx; p[o + 4] = y; p[o + 5] = bz; p[o + 6] = cx; p[o + 7] = y; p[o + 8] = cz; p[o + 9] = dx; p[o + 10] = y; p[o + 11] = dz;
      for (let i = 0; i < 4; i++) { k[o + i * 3] = c.r; k[o + i * 3 + 1] = c.g; k[o + i * 3 + 2] = c.b; }
      this.n++;
    }
    seg(x1, z1, x2, z2, w, y, c) {
      const dx = x2 - x1, dz = z2 - z1, l = Math.sqrt(dx * dx + dz * dz); if (l < 1e-6) return;
      const nx = (-dz / l) * w / 2, nz = (dx / l) * w / 2;
      this.quad(x1 + nx, z1 + nz, x1 - nx, z1 - nz, x2 - nx, z2 - nz, x2 + nx, z2 + nz, y, c);
    }
    dashed(x1, z1, x2, z2, w, dash, gap, y, c) {
      const dx = x2 - x1, dz = z2 - z1, l = Math.sqrt(dx * dx + dz * dz); if (l < 1e-6) return;
      const ux = dx / l, uz = dz / l;
      for (let s = 0; s < l; s += dash + gap) { const e = Math.min(l, s + dash); this.seg(x1 + ux * s, z1 + uz * s, x1 + ux * e, z1 + uz * e, w, y, c); }
    }
    ring(cx, cz, r, w, y, c, a0, a1, segs, dashEvery) {
      a0 = a0 || 0; a1 = a1 === undefined ? Math.PI * 2 : a1; segs = segs || 32;
      const r0 = r - w / 2, r1 = r + w / 2;
      for (let i = 0; i < segs; i++) {
        if (dashEvery && (i % (dashEvery * 2)) >= dashEvery) continue;
        const t0 = a0 + ((a1 - a0) * i) / segs, t1 = a0 + ((a1 - a0) * (i + 1)) / segs, c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
        this.quad(cx + c0 * r0, cz + s0 * r0, cx + c0 * r1, cz + s0 * r1, cx + c1 * r1, cz + s1 * r1, cx + c1 * r0, cz + s1 * r0, y, c);
      }
    }
    disc(cx, cz, r, y, c, segs) {
      segs = segs || 20;
      for (let i = 0; i < segs; i++) {
        const t0 = (i / segs) * Math.PI * 2, t1 = ((i + 1) / segs) * Math.PI * 2;
        this.quad(cx, cz, cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r, cx, cz, y, c);
      }
    }
    end() { this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; this.geo.setDrawRange(0, this.n * 6); }
  }

  // ---------------------------------------------------------------- textures
  let ATLAS = null, BLOB = null, BALLTEX = null, NETTEX = null, GLOW = null, DOT = null;
  function texAtlas() {
    if (ATLAS) return ATLAS;
    ATLAS = canvasTex(1024, 1024, (g) => {
      g.clearRect(0, 0, 1024, 1024);
      g.fillStyle = '#fff'; g.fillRect(15 * 64, 15 * 64, 64, 64);
      g.font = '800 46px "Arial Black", Impact, "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
      for (let n = 0; n < 100; n++) g.fillText(String(n), (n % ATLAS_N) * 64 + 32, Math.floor(n / ATLAS_N) * 64 + 35);
    });
    ATLAS.anisotropy = 4;
    return ATLAS;
  }
  function texBlob() {
    return BLOB || (BLOB = canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(0.55, 'rgba(0,0,0,0.5)'); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    }));
  }
  function texBall() {
    return BALLTEX || (BALLTEX = canvasTex(256, 128, (g) => {
      g.fillStyle = '#f7f7f7'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#1b2233';
      const spots = [[20, 30], [84, 20], [150, 36], [212, 24], [48, 92], [112, 100], [180, 88], [236, 104], [128, 64], [60, 60], [200, 58]];
      spots.forEach((s) => { g.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; g.lineTo(s[0] + Math.cos(a) * 15, s[1] + Math.sin(a) * 15); } g.closePath(); g.fill(); });
    }));
  }
  function texNet() {
    return NETTEX || (NETTEX = canvasTex(64, 64, (g) => {
      g.clearRect(0, 0, 64, 64); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
    }, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping }));
  }
  function texGlow() {
    return GLOW || (GLOW = canvasTex(64, 64, (g) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, 'rgba(255,248,225,1)'); r.addColorStop(0.25, 'rgba(255,240,200,0.55)'); r.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    }));
  }
  function texDot() {
    return DOT || (DOT = canvasTex(32, 32, (g) => {
      const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.6, 'rgba(255,255,255,0.9)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, 0, 32, 32);
    }));
  }

  // ---------------------------------------------------------------- environment (time of day x weather)
  const TOD = {
    day: { sky: '#6fb4ff', hor: '#d4e8ff', hemiS: '#dcecff', hemiG: '#6d8a58', hemiI: 0.56, sun: '#fff3dc', sunI: 0.62, dir: [0.4, 1, -0.3], stand: 1, flood: 0 },
    evening: { sky: '#3a3470', hor: '#ff9d60', hemiS: '#ffd2aa', hemiG: '#5a4a52', hemiI: 0.56, sun: '#ffa868', sunI: 0.92, dir: [-1.15, 0.55, -0.4], stand: 0.85, flood: 0.4 },
    night: { sky: '#060b20', hor: '#1d2e58', hemiS: '#8aa0d4', hemiG: '#1a2434', hemiI: 0.5, sun: '#ecf3ff', sunI: 0.9, dir: [0.18, 1, 0.12], stand: 0.55, flood: 1 },
  };
  const WEATHER = {
    clear: { sunK: 1, hemiK: 1, grey: 0, greyC: '#9aa6b4', fogN: 150, fogF: 520 },
    cloudy: { sunK: 0.55, hemiK: 1.2, grey: 0.5, greyC: '#a4aebb', fogN: 130, fogF: 470 },
    rain: { sunK: 0.4, hemiK: 1.12, grey: 0.7, greyC: '#6f7c8a', fogN: 100, fogF: 360 },
    storm: { sunK: 0.28, hemiK: 0.95, grey: 0.8, greyC: '#3d4755', fogN: 80, fogF: 300 },
    snow: { sunK: 0.55, hemiK: 1.3, grey: 0.6, greyC: '#cdd6df', fogN: 90, fogF: 330 },
    fog: { sunK: 0.5, hemiK: 1.22, grey: 0.85, greyC: '#c4cad0', fogN: 55, fogF: 200 },
  };
  function envFor(tod, weather) {
    const t = TOD[tod] || TOD.day, w = WEATHER[weather] || WEATHER.clear;
    const greyC = tod === 'night' ? mixCol(w.greyC, '#0a1020', 0.78) : tod === 'evening' ? mixCol(w.greyC, '#7a5a60', 0.45) : w.greyC;
    return {
      sky: mixCol(t.sky, greyC, w.grey), hor: mixCol(t.hor, greyC, w.grey),
      hemiS: mixCol(t.hemiS, greyC, w.grey * 0.45), hemiG: col(t.hemiG), hemiI: t.hemiI * w.hemiK,
      sun: col(t.sun), sunI: t.sunI * w.sunK, dir: t.dir, stand: t.stand, flood: t.flood, fogN: w.fogN, fogF: w.fogF,
    };
  }
  const GRASS3 = {
    clear: ['#2f8a3a', '#3b9d47'], cloudy: ['#2d8037', '#388f43'], rain: ['#277032', '#2d7f39'], storm: ['#236330', '#2a7336'],
    snow: ['#dfe9e4', '#eef5f1'], fog: ['#2d7d37', '#368a41'],
  };

  // pitch + surroundings texture, covers x in [-PM, L+PM], y in [-PM, W+PM]
  function makeGrassTexture(weather, pst) {
    return canvasTex(2048, 1024, (g, cw, ch) => {
      const sx = cw / (L + 2 * PM), sy = ch / (W + 2 * PM);
      const X = (x) => (x + PM) * sx, Y = (y) => (y + PM) * sy;
      const gr = GRASS3[weather] || GRASS3.clear;
      const gs = (pst && pst.grass) || 'stripes';
      g.fillStyle = mixCol(gr[0], '#1a3d22', weather === 'snow' ? 0.08 : 0.22).getStyle(); g.fillRect(0, 0, cw, ch);
      const nS = gs === 'wide' ? 8 : 14, sw = L / nS;
      if (gs === 'checks') {
        const nY = 8, sh = W / nY;
        for (let i = 0; i < nS; i++) for (let j = 0; j < nY; j++) { g.fillStyle = gr[(i + j) % 2]; g.fillRect(X(i * sw), Y(j * sh), sw * sx + 1, sh * sy + 1); }
      } else if (gs === 'plain') {
        g.fillStyle = gr[0]; g.fillRect(X(0), Y(0), L * sx, W * sy);
      } else if (gs === 'diag') {
        g.fillStyle = gr[0]; g.fillRect(X(0), Y(0), L * sx, W * sy);
        g.save(); g.beginPath(); g.rect(X(0), Y(0), L * sx, W * sy); g.clip(); g.fillStyle = gr[1];
        for (let i = -6; i < 22; i++) { const x0 = X(i * 6); g.beginPath(); g.moveTo(x0, Y(0)); g.lineTo(x0 + 3 * sx, Y(0)); g.lineTo(x0 + 3 * sx - W * sx * 0.6, Y(W)); g.lineTo(x0 - W * sx * 0.6, Y(W)); g.closePath(); g.fill(); }
        g.restore();
      } else {
        for (let i = 0; i < nS; i++) { g.fillStyle = gr[i % 2]; g.fillRect(X(i * sw), Y(0), sw * sx + 1, W * sy); }
      }
      const rnd = U.makeRng(77);
      for (let i = 0; i < 16000; i++) {
        const x = rnd.range(-PM, L + PM), y = rnd.range(-PM, W + PM);
        g.fillStyle = rnd.chance(0.5) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
        g.fillRect(X(x), Y(y), 2 + rnd.next() * 4, 1.5);
      }
      if (weather === 'rain' || weather === 'storm') { g.fillStyle = 'rgba(10,30,60,0.12)'; g.fillRect(0, 0, cw, ch); }
    }, { anisotropy: 4 });
  }

  // ---------------------------------------------------------------- static scene pieces
  function buildLines(snow) {
    const gb = new GB(), Y = 0.02, w = 0.13, c = snow ? '#f08a2c' : '#ffffff';
    const seg = (x1, z1, x2, z2, ext) => {
      const dx = x2 - x1, dz = z2 - z1, l = Math.sqrt(dx * dx + dz * dz); if (l < 1e-6) return;
      const ux = dx / l, uz = dz / l, e = ext ? w / 2 : 0, nx = -uz * w / 2, nz = ux * w / 2;
      const ax = x1 - ux * e, az = z1 - uz * e, bx = x2 + ux * e, bz = z2 + uz * e;
      gb.quadN([ax + nx, Y, az + nz], [ax - nx, Y, az - nz], [bx - nx, Y, bz - nz], [bx + nx, Y, bz + nz], c, 0, 1, 0);
    };
    const arc = (cx, cz, r, a0, a1, n) => { for (let i = 0; i < n; i++) { const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n; seg(cx + Math.cos(t0) * r, cz + Math.sin(t0) * r, cx + Math.cos(t1) * r, cz + Math.sin(t1) * r, false); } };
    const spot = (cx, cz, r) => { for (let i = 0; i < 14; i++) { const t0 = (i / 14) * Math.PI * 2, t1 = ((i + 1) / 14) * Math.PI * 2; gb.quadN([cx, Y, cz], [cx + Math.cos(t0) * r, Y, cz + Math.sin(t0) * r], [cx + Math.cos(t1) * r, Y, cz + Math.sin(t1) * r], [cx, Y, cz], c, 0, 1, 0); } };
    const rect = (x0, z0, x1, z1) => { seg(x0, z0, x1, z0, true); seg(x1, z0, x1, z1, true); seg(x1, z1, x0, z1, true); seg(x0, z1, x0, z0, true); };
    rect(0, 0, L, W);
    seg(L / 2, 0, L / 2, W, false);
    arc(L / 2, GY, P.circleR, 0, Math.PI * 2, 64);
    spot(L / 2, GY, 0.26);
    [0, 1].forEach((side) => {
      const dir = side === 0 ? 1 : -1, gx = side === 0 ? 0 : L;
      const bx = side === 0 ? P.boxD : L - P.boxD, sxx = side === 0 ? P.sixD : L - P.sixD;
      seg(gx, GY - P.boxW / 2, bx, GY - P.boxW / 2, true); seg(bx, GY - P.boxW / 2, bx, GY + P.boxW / 2, true); seg(bx, GY + P.boxW / 2, gx, GY + P.boxW / 2, true);
      seg(gx, GY - P.sixW / 2, sxx, GY - P.sixW / 2, true); seg(sxx, GY - P.sixW / 2, sxx, GY + P.sixW / 2, true); seg(sxx, GY + P.sixW / 2, gx, GY + P.sixW / 2, true);
      const px = gx + dir * P.penSpot;
      spot(px, GY, 0.26);
      const a0 = Math.acos((P.boxD - P.penSpot) / P.circleR);
      if (side === 0) arc(px, GY, P.circleR, -a0, a0, 28); else arc(px, GY, P.circleR, Math.PI - a0, Math.PI + a0, 28);
    });
    [[0, 0, 0, Math.PI / 2], [L, 0, Math.PI / 2, Math.PI], [L, W, Math.PI, Math.PI * 1.5], [0, W, Math.PI * 1.5, Math.PI * 2]].forEach((a) => arc(a[0], a[1], 1, a[2], a[3], 8));
    return gb.build();
  }

  function buildGoalFrames(snow) {
    const gb = new GB(), wh = '#f4f6fa', gr = '#b8bec8', H = P.goalH, D = P.goalDepth, Hb = H * 0.8, t = 0.065;
    [0, 1].forEach((side) => {
      const gx = side === 0 ? 0 : L, s = side === 0 ? -1 : 1, bxx = gx + s * D, z0 = GY - HG, z1 = GY + HG;
      // posts and crossbar (square section reads fine from afar)
      gb.box(gx - t, 0, z0 - t, gx + t, H + t, z0 + t, wh);
      gb.box(gx - t, 0, z1 - t, gx + t, H + t, z1 + t, wh);
      gb.box(gx - t, H - t, z0 - t, gx + t, H + t, z1 + t, wh);
      // rear frame
      gb.box(bxx - 0.03, 0, z0 - 0.03, bxx + 0.03, Hb, z0 + 0.03, gr); gb.box(bxx - 0.03, 0, z1 - 0.03, bxx + 0.03, Hb, z1 + 0.03, gr);
      gb.box(bxx - 0.03, Hb - 0.03, z0, bxx + 0.03, Hb + 0.03, z1, gr);
      gb.bar([gx, H, z0], [bxx, Hb, z0], 0.025, gr); gb.bar([gx, H, z1], [bxx, Hb, z1], 0.025, gr);
      gb.box(Math.min(gx, bxx), 0, z0 - 0.025, Math.max(gx, bxx), 0.05, z0 + 0.025, gr); gb.box(Math.min(gx, bxx), 0, z1 - 0.025, Math.max(gx, bxx), 0.05, z1 + 0.025, gr);
    });
    // corner flags
    [[0, 0], [L, 0], [L, W], [0, W]].forEach((c) => {
      gb.box(c[0] - 0.025, 0, c[1] - 0.025, c[0] + 0.025, 1.6, c[1] + 0.025, '#f4f6fa');
    });
    return gb.build();
  }
  function buildFlags() {
    const gb = new GB();
    [[0, 0, 1, 1], [L, 0, -1, 1], [L, W, -1, -1], [0, W, 1, -1]].forEach((c) => {
      const x = c[0], z = c[1];
      gb.tri([x, 1.6, z], [x, 1.2, z], [x + c[2] * 0.42, 1.4, z + c[3] * 0.1], '#ffd23c');
    });
    return gb.build();
  }
  function buildNets() {
    const pos = [], uv = [], H = P.goalH, D = P.goalDepth, Hb = H * 0.8, K = 1 / 0.45;
    const tri = (a, b, c, ua, ub, uc) => { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
    [0, 1].forEach((side) => {
      const gx = side === 0 ? 0 : L, s = side === 0 ? -1 : 1, bxx = gx + s * D, z0 = GY - HG, z1 = GY + HG;
      // back
      tri([bxx, 0, z0], [bxx, 0, z1], [bxx, Hb, z1], [z0 * K, 0], [z1 * K, 0], [z1 * K, Hb * K]); tri([bxx, 0, z0], [bxx, Hb, z1], [bxx, Hb, z0], [z0 * K, 0], [z1 * K, Hb * K], [z0 * K, Hb * K]);
      // top
      tri([gx, H, z0], [gx, H, z1], [bxx, Hb, z1], [z0 * K, 0], [z1 * K, 0], [z1 * K, D * K]); tri([gx, H, z0], [bxx, Hb, z1], [bxx, Hb, z0], [z0 * K, 0], [z1 * K, D * K], [z0 * K, D * K]);
      // sides
      [z0, z1].forEach((z) => {
        tri([gx, 0, z], [bxx, 0, z], [bxx, Hb, z], [0, 0], [D * K, 0], [D * K, Hb * K]);
        tri([gx, 0, z], [bxx, Hb, z], [gx, H, z], [0, 0], [D * K, Hb * K], [0, H * K]);
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }

  // ad boards: one canvas strip per side
  function adCanvas(w, texts, seed) {
    const adC = ['#ff4d6d', '#ffd24d', '#2dff8f', '#3de0ff', '#ff9f3d', '#b58bff'];
    return canvasTex(w, 64, (g, cw, ch) => {
      g.fillStyle = '#0a0e17'; g.fillRect(0, 0, cw, ch);
      const n = Math.max(3, Math.round(cw / 200)), pw = cw / n;
      g.font = '700 38px "Chakra Petch", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        g.fillStyle = '#121a2c'; g.fillRect(i * pw + 3, 4, pw - 6, ch - 8);
        g.fillStyle = adC[(i + seed) % adC.length]; g.fillText(texts[(i + seed) % texts.length], i * pw + pw / 2, ch / 2 + 2, pw - 20);
      }
    }, { anisotropy: 4 });
  }

  // concentric stands (tread/riser rings) + back wall: one geometry per side (0 N, 1 E, 2 S, 3 W) so the side behind the camera can be hidden
  function buildStandGeos(seatCol, snow) {
    const gbs = [new GB(), new GB(), new GB(), new GB()];
    const concrete = snow ? '#aab4bf' : '#3a4256', conc2 = snow ? '#9aa6b2' : '#2f3648', wall = snow ? '#8b97a4' : '#262c3c';
    const sA = col(seatCol), sB = shade(seatCol, 0.86);
    const ringPts = (o) => [[-o, -o], [L + o, -o], [L + o, W + o], [-o, W + o]];
    for (let r = 0; r < ROWS; r++) {
      const oi = SO + r * ROW_D, oo = oi + ROW_D, h = ROW_H0 + r * ROW_H, hp = r === 0 ? 0 : ROW_H0 + (r - 1) * ROW_H;
      const I = ringPts(oi), O = ringPts(oo);
      for (let s = 0; s < 4; s++) {
        const gb = gbs[s], a = I[s], b = I[(s + 1) % 4];
        const inward = [(L / 2 - (a[0] + b[0]) / 2), 0, (GY - (a[1] + b[1]) / 2)];
        gb.quadN([a[0], hp, a[1]], [b[0], hp, b[1]], [b[0], h, b[1]], [a[0], h, a[1]], conc2, inward[0], 0, inward[2]);
        const c = O[(s + 1) % 4], d = O[s];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / 6));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const P0 = [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0)], P1 = [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1)], Q0 = [lerp(d[0], c[0], t0), lerp(d[1], c[1], t0)], Q1 = [lerp(d[0], c[0], t1), lerp(d[1], c[1], t1)];
          const aisle = k % 4 === 3;
          gb.quadN([P0[0], h, P0[1]], [P1[0], h, P1[1]], [Q1[0], h, Q1[1]], [Q0[0], h, Q0[1]], aisle ? concrete : ((k + r) % 2 ? sA : sB), 0, 1, 0);
        }
      }
    }
    const oW = SO + ROWS * ROW_D, hW = ROW_H0 + (ROWS - 1) * ROW_H;
    const WP = ringPts(oW);
    for (let s = 0; s < 4; s++) {
      const a = WP[s], b = WP[(s + 1) % 4];
      const inward = [(L / 2 - (a[0] + b[0]) / 2), 0, (GY - (a[1] + b[1]) / 2)];
      gbs[s].quadN([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], hW + 2.4, b[1]], [a[0], hW + 2.4, a[1]], wall, inward[0], 0, inward[2]);
    }
    return gbs.map((g) => g.build());
  }

  // seat positions around the bowl, per side (0 N, 1 E, 2 S, 3 W)
  function seatSlots() {
    const out = [[], [], [], []], sp = 0.62;
    for (let r = 0; r < ROWS; r++) {
      const oc = SO + r * ROW_D + ROW_D * 0.55, h = ROW_H0 + r * ROW_H;
      const edges = [[-oc, -oc, L + oc, -oc], [L + oc, -oc + sp, L + oc, W + oc - sp], [-oc, W + oc, L + oc, W + oc], [-oc, -oc + sp, -oc, W + oc - sp]];
      edges.forEach((e, side) => {
        const len = Math.hypot(e[2] - e[0], e[3] - e[1]), n = Math.floor(len / sp);
        for (let i = 0; i < n; i++) {
          if (i % 28 === 27) continue; // aisle gaps
          const t = (i + 0.5) / n;
          out[side].push({ x: lerp(e[0], e[2], t), z: lerp(e[1], e[3], t), y: h, r });
        }
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- player model (one skinned, vertex-coloured mesh with 11 bones)
  const B = { HIPS: 0, CHEST: 1, HEAD: 2, ARM_L: 3, FORE_L: 4, ARM_R: 5, FORE_R: 6, THIGH_L: 7, SHIN_L: 8, THIGH_R: 9, SHIN_R: 10 };
  const BONE_POS = [
    [0, 0.95, 0], [0, 0.05, 0], [0, 0.52, 0],
    [0, 0.47, -0.31], [0, -0.3, 0], [0, 0.47, 0.31], [0, -0.3, 0],
    [0, -0.03, -0.11], [0, -0.46, 0], [0, -0.03, 0.11], [0, -0.46, 0],
  ];
  const BOOTS = ['#151515', '#151515', '#151515', '#f2f2f2', '#ff6a1a', '#2dd1ff', '#ffd23c'];

  function torsoColor(pattern, A, Bc, j, k, N) {
    // j sector (0..N-1, sector j spans [j, j+1]*360/N degrees, 0 = front centre line), k ring band (0 low .. 2 high)
    const thc = ((j + 0.5) / N) * 360; // degrees, centre of sector
    switch (pattern) {
      case 'stripesV': return Math.floor(((j + 1) % N) / 2) % 2 ? Bc : A;
      case 'hoops': return k % 2 ? Bc : A;
      case 'halves': return j < N / 2 ? Bc : A;
      case 'band': return (j === N - 1 || j === 0 || j === N / 2 - 1 || j === N / 2) ? Bc : A;
      case 'sash': {
        const sashTh = lerp(60, -60, k / 2) ; // degrees: right shoulder -> left hip
        let d = thc > 180 ? thc - 360 : thc; return Math.abs(d - sashTh) < 20 ? Bc : A;
      }
      default: return A;
    }
  }

  function addHair(gb, look) {
    const hair = look.hair, st = look.hairStyle;
    const cx = 0.0, cy = 1.78, rx = 0.19, ry = 0.21, rz = 0.185;
    if (st === 'bald') return;
    if (st === 'buzz' || st === 'fade') { gb.sphere(cx - 0.01, cy + 0.005, 0, rx * 1.04, ry * 1.03, rz * 1.04, 8, 6, hair, 0, 3); return; }
    if (st === 'mohawk') { gb.box(cx - 0.14, cy + 0.17, -0.035, cx + 0.12, cy + 0.3, 0.035, hair); return; }
    // cap with a hairline over the forehead: skip the front-most column by pushing the cap back
    gb.sphere(cx - 0.035, cy + 0.02, 0, rx * 1.1, ry * 1.08, rz * 1.12, 8, 6, hair, 0, 3);
    gb.box(cx - 0.2, cy - 0.12, -0.15, cx - 0.1, cy + 0.12, 0.15, hair);
    if (st === 'long') gb.box(cx - 0.22, cy - 0.36, -0.17, cx - 0.1, cy + 0.08, 0.17, hair);
    if (st === 'curly') { gb.sphere(cx - 0.04, cy + 0.08, 0, rx * 1.28, ry * 1.1, rz * 1.3, 8, 6, hair, 0, 4); }
    if (st === 'bun') gb.sphere(cx - 0.17, cy + 0.17, 0, 0.09, 0.09, 0.09, 6, 4, hair);
    if (st === 'afro') gb.sphere(cx - 0.02, cy + 0.07, 0, rx * 1.55, ry * 1.4, rz * 1.6, 8, 6, hair, 0, 4);
    if (st === 'ponytail') { gb.sphere(cx - 0.2, cy + 0.02, 0, 0.06, 0.06, 0.06, 6, 4, hair); gb.box(cx - 0.3, cy - 0.3, -0.04, cx - 0.17, cy, 0.04, hair); }
    if (st === 'quiff') gb.box(cx - 0.02, cy + 0.14, -0.13, cx + 0.2, cy + 0.27, 0.13, hair);
    if (st === 'undercut') gb.box(cx - 0.14, cy + 0.17, -0.12, cx + 0.12, cy + 0.26, 0.12, hair);
    if (st === 'braids') { gb.box(cx - 0.22, cy - 0.3, -0.17, cx - 0.14, cy + 0.02, -0.1, hair); gb.box(cx - 0.22, cy - 0.3, 0.1, cx - 0.14, cy + 0.02, 0.17, hair); gb.box(cx - 0.22, cy - 0.34, -0.03, cx - 0.14, cy + 0.02, 0.03, hair); }
    if (st === 'curtains') { gb.box(cx - 0.05, cy - 0.06, -0.2, cx + 0.12, cy + 0.12, -0.14, hair); gb.box(cx - 0.05, cy - 0.06, 0.14, cx + 0.12, cy + 0.12, 0.2, hair); }
    if (look.f && look.f.band) gb.box(cx - 0.2, cy + 0.07, -0.19, cx + 0.2, cy + 0.12, 0.19, look.f.band);
  }

  function buildPlayerGeo(kit, look, num, isGK, ref, bootCol) {
    const gb = new GB(true);
    const gkSleeve = isGK;
    const A = isGK ? kit.gk : kit.shirt, Bc = isGK ? kit.gk : (kit.shirt2 || kit.shirt);
    const shorts = isGK ? kit.gkShorts : kit.shorts, socks = isGK ? kit.gk : kit.socks;
    const pattern = isGK || ref ? (ref ? 'solid' : 'solid') : (kit.pattern || 'solid');
    const skin = look.skin;
    const sleeveCol = kit.pattern === 'sleeves' && !isGK ? Bc : A;
    // hips: pelvis
    gb.bone = B.HIPS;
    gb.taper(0, 0, 0.78, 1.02, 0.135, 0.205, 0.125, 0.19, shorts);
    // chest: patterned lathe, N sectors x 3 bands
    gb.bone = B.CHEST;
    const N = 16, ring = [[0.98, 0.205, 0.13], [1.15, 0.235, 0.135], [1.33, 0.27, 0.14], [1.5, 0.3, 0.13]];
    const rp = (k, j) => { const th = (j / N) * Math.PI * 2; return [ring[k][2] * Math.cos(th), ring[k][0], ring[k][1] * Math.sin(th)]; };
    for (let k = 0; k < 3; k++) for (let j = 0; j < N; j++) {
      const c = torsoColor(pattern, A, Bc, j, k, N);
      gb.quad(rp(k, j), rp(k, j + 1), rp(k + 1, j + 1), rp(k + 1, j), c);
    }
    // shoulders cap
    for (let j = 0; j < N; j++) { const th0 = (j / N) * Math.PI * 2, th1 = ((j + 1) / N) * Math.PI * 2; gb.tri([0, 1.52, 0], [ring[3][2] * Math.cos(th1), 1.5, ring[3][1] * Math.sin(th1)], [ring[3][2] * Math.cos(th0), 1.5, ring[3][1] * Math.sin(th0)], A); }
    gb.box(-0.05, 1.5, -0.06, 0.06, 1.6, 0.06, skin); // neck
    // back number (decal quad with atlas uv)
    if (num >= 0 && num < 100 && !ref) {
      const cell = num, c0 = cell % ATLAS_N, r0 = Math.floor(cell / ATLAS_N), u0 = c0 / ATLAS_N, u1 = (c0 + 1) / ATLAS_N, v1 = 1 - r0 / ATLAS_N, v0 = 1 - (r0 + 1) / ATLAS_N;
      const nc = col(A).r * 0.299 + col(A).g * 0.587 + col(A).b * 0.114 > 0.55 ? col('#1b2233') : col('#ffffff');
      const x = -0.1425, hw = 0.13, y0 = 1.08, y1 = 1.4;
      // slightly above the lathe back (lathe depth ~0.135 at those heights)
      const xs = -0.15;
      gb.vert([xs, y0, -hw], nc, u0, v0); gb.vert([xs, y0, hw], nc, u1, v0); gb.vert([xs, y1, hw], nc, u1, v1);
      gb.vert([xs, y0, -hw], nc, u0, v0); gb.vert([xs, y1, hw], nc, u1, v1); gb.vert([xs, y1, -hw], nc, u0, v1);
    }
    // head
    gb.bone = B.HEAD;
    gb.sphere(0.0, 1.78, 0, 0.19, 0.21, 0.185, 8, 6, skin);
    gb.box(0.165, 1.72, -0.085, 0.2, 1.79, -0.035, '#1b1b22'); gb.box(0.165, 1.72, 0.035, 0.2, 1.79, 0.085, '#1b1b22'); // eyes -> shows facing
    if (look.beard) {
      const bs = look.beardStyle || 'full', bcol = look.beardCol || look.hair;
      if (bs === 'full') gb.box(0.07, 1.6, -0.11, 0.19, 1.72, 0.11, bcol);
      else if (bs === 'stubble') gb.box(0.07, 1.62, -0.1, 0.17, 1.7, 0.1, mixCol(look.skin, bcol, 0.45));
      else if (bs === 'goatee') gb.box(0.1, 1.6, -0.04, 0.19, 1.7, 0.04, bcol);
      else if (bs === 'mustache') gb.box(0.15, 1.72, -0.08, 0.2, 1.75, 0.08, bcol);
    }
    addHair(gb, look);
    // arms
    [[B.ARM_L, B.FORE_L, -1], [B.ARM_R, B.FORE_R, 1]].forEach((a) => {
      const z = a[2] * 0.31;
      gb.bone = a[0];
      gb.taper(0, z, 1.17, 1.49, 0.062, 0.062, 0.09, 0.085, sleeveCol);
      gb.bone = a[1];
      if (gkSleeve) { gb.taper(0, z, 0.93, 1.17, 0.052, 0.052, 0.062, 0.062, A); gb.box(-0.055, 0.82, z - 0.062, 0.07, 0.94, z + 0.062, '#e9edf5'); } else { gb.taper(0, z, 0.9, 1.17, 0.048, 0.048, 0.058, 0.058, skin); gb.box(-0.045, 0.84, z - 0.05, 0.05, 0.92, z + 0.05, skin); }
    });
    // legs
    [[B.THIGH_L, B.SHIN_L, -1], [B.THIGH_R, B.SHIN_R, 1]].forEach((l) => {
      const z = l[2] * 0.11;
      gb.bone = l[0];
      gb.taper(0, z, 0.64, 1.0, 0.1, 0.1, 0.115, 0.115, shorts);
      gb.taper(0, z, 0.46, 0.64, 0.085, 0.085, 0.095, 0.095, skin);
      gb.bone = l[1];
      gb.taper(0, z, 0.1, 0.46, 0.065, 0.065, 0.085, 0.085, socks);
      gb.box(-0.08, 0.0, z - 0.06, 0.2, 0.1, z + 0.06, bootCol);
    });
    return gb.build();
  }

  class PlayerModel {
    constructor(r3d, p, kit, ref) {
      this.key = '';
      this.ref = !!ref;
      const geo = buildPlayerGeo(kit, p.look || { skin: '#e5b998', hair: '#2b2b2b', hairStyle: 'short', beard: false }, ref ? -1 : p.num, !!p.isGK, ref, BOOTS[(strHash(String(p.sname || 'x')) >>> 3) % BOOTS.length]);
      this.geo = geo;
      const mesh = new THREE.SkinnedMesh(geo, r3d.matPlayer);
      mesh.frustumCulled = false; mesh.castShadow = true;
      const bones = [];
      BONE_POS.forEach((bp) => { const b = new THREE.Bone(); b.position.set(bp[0], bp[1], bp[2]); bones.push(b); });
      bones[B.HIPS].add(bones[B.CHEST]); bones[B.CHEST].add(bones[B.HEAD]);
      bones[B.CHEST].add(bones[B.ARM_L]); bones[B.ARM_L].add(bones[B.FORE_L]);
      bones[B.CHEST].add(bones[B.ARM_R]); bones[B.ARM_R].add(bones[B.FORE_R]);
      bones[B.HIPS].add(bones[B.THIGH_L]); bones[B.THIGH_L].add(bones[B.SHIN_L]);
      bones[B.HIPS].add(bones[B.THIGH_R]); bones[B.THIGH_R].add(bones[B.SHIN_R]);
      mesh.add(bones[B.HIPS]);
      const group = new THREE.Group(); group.add(mesh); group.scale.setScalar(SC);
      group.updateMatrixWorld(true);
      const skel = new THREE.Skeleton(bones);
      mesh.bind(skel, mesh.matrixWorld);
      this.group = group; this.mesh = mesh; this.bones = bones;
      // animation state
      this.ph = Math.random() * 6; this.lie = 0; this.drop = 0; this.celeb = 0; this.holdA = 0; this.thrw = 0; this.look = 0; this.kick = -1; this.lean = 0; this.gk = !!p.isGK;
      this.seed = Math.random() * 10; this.used = 0; this.px = p.x; this.py = p.y;
      this.lastSpd = 0;
    }
    dispose() { this.geo.dispose(); }

    // procedural pose from the player's sim state; p = { x, y, ang, spd, state, isGK }
    pose(p, dt, t, ctx) {
      const bn = this.bones, st = p.state || 'idle';
      const spd = Math.min(p.spd || 0, 10);
      const run = clamp(spd / 6.5, 0, 1.15);
      // targets
      let tLie = 0, tDrop = 0, rate = 9;
      if (st === 'slide') { tLie = 1.22; tDrop = 0.62; rate = 16; }
      else if (st === 'dive') { tLie = -1.32; tDrop = 0.5; rate = 14; }
      else if (st === 'down') { tLie = 1.45; tDrop = 0.7; rate = 12; }
      else if (st === 'getup') { tLie = 0.45; tDrop = 0.3; rate = 7; }
      else rate = 7;
      this.lie = damp(this.lie, tLie, rate, dt); this.drop = damp(this.drop, tDrop, rate, dt);
      const lying = Math.min(1, Math.abs(this.lie));
      const celeb = st === 'celebrate' ? 1 : 0; this.celeb = damp(this.celeb, celeb, 10, dt);
      const holdTgt = (st === 'hold' || ctx.gkHolds) ? 1 : 0; this.holdA = damp(this.holdA, holdTgt, 12, dt);
      this.thrw = damp(this.thrw, ctx.throwIn ? 1 : 0, 10, dt);
      // stride
      const cyc = 3.7;
      if (dt > 0 && lying < 0.5) this.ph += (spd / cyc) * Math.PI * 2 * dt;
      const ph = this.ph, s = Math.sin(ph), c = Math.cos(ph);
      const amp = (0.28 + 0.5 * run) * (spd < 0.35 ? spd / 0.35 : 1);
      const freeze = 1 - lying;
      // legs
      let thL = s * amp * freeze, thR = -s * amp * freeze;
      let knL = (0.1 + (0.2 + 0.95 * run) * Math.max(0, c)) * (spd < 0.35 ? 0.2 : 1) * freeze, knR = (0.1 + (0.2 + 0.95 * run) * Math.max(0, -c)) * (spd < 0.35 ? 0.2 : 1) * freeze;
      // idle keeper crouch
      let crouch = 0;
      if (this.gk && st !== 'slide' && st !== 'dive' && st !== 'down' && spd < 3) crouch = 0.14;
      thL += crouch * 1.1; thR += crouch * 1.1; knL += crouch * 2; knR += crouch * 2;
      // slide: lead leg out, trailing leg bent; dive: legs trail
      if (st === 'slide') { thR += 0.25; knR += 0.2; thL -= 0.35; knL += 1.1; }
      if (st === 'dive') { thL = -0.25; thR = 0.2; knL = 0.5; knR = 0.35; }
      if (st === 'down') { thL = 0.2 + 0.25 * Math.sin(t * 3 + this.seed); thR = -0.1; knL = 0.6; knR = 0.2; }
      // kick (right leg)
      let kickW = 0, lean = -(0.04 + 0.2 * run) * freeze - crouch * 0.8;
      if (this.kick >= 0) {
        this.kick += dt;
        const kt = this.kick, K = 0.46;
        if (kt >= K) this.kick = -1;
        else {
          let phi, kn;
          if (kt < 0.13) { const q = smooth(kt / 0.13); phi = lerp(0, -0.85, q); kn = lerp(0.2, 1.35, q); }
          else if (kt < 0.23) { const q = smooth((kt - 0.13) / 0.1); phi = lerp(-0.85, 1.3, q); kn = lerp(1.35, 0.1, q); }
          else { const q = smooth((kt - 0.23) / (K - 0.23)); phi = lerp(1.3, 0, q); kn = lerp(0.1, 0.2, q); }
          kickW = kt < 0.04 ? kt / 0.04 : kt > K - 0.1 ? (K - kt) / 0.1 : 1;
          thR = lerp(thR, phi, kickW); knR = lerp(knR, kn, kickW);
          lean = lerp(lean, kt < 0.2 ? 0.12 : -0.2, kickW * 0.7);
        }
      }
      // hips (root of the skeleton)
      const bounce = Math.abs(s) * 0.05 * run * freeze + (this.celeb > 0.02 ? Math.abs(Math.sin(t * 9 + this.seed)) * 0.28 * this.celeb : 0);
      const hip = bn[B.HIPS];
      const jmp = p.jumpT > 0 ? Math.sin(Math.min(1, (0.45 - p.jumpT) / 0.45) * Math.PI) * 0.4 : 0;
      hip.position.y = BONE_POS[0][1] + bounce + jmp - this.drop - crouch * 0.2;
      hip.rotation.set(0, 0, this.lie);
      // torso
      const ch = bn[B.CHEST];
      ch.rotation.set(0, Math.sin(ph) * 0.12 * run * freeze, lean + this.thrw * 0.18 - this.holdA * 0.05);
      // head looks at the ball (limited)
      const tgtLook = clamp(ctx.lookYaw || 0, -1.0, 1.0) * (1 - lying * 0.8);
      this.look = damp(this.look, tgtLook, 8, dt);
      bn[B.HEAD].rotation.set(0, -this.look * 0.85 - Math.sin(ph) * 0.1 * run * freeze, -lean * 0.6 + (this.lie < 0 ? 0.9 * Math.min(1, -this.lie) : 0));
      // legs
      bn[B.THIGH_L].rotation.set(0, 0, thL); bn[B.SHIN_L].rotation.set(0, 0, -knL);
      bn[B.THIGH_R].rotation.set(0, 0, thR); bn[B.SHIN_R].rotation.set(0, 0, -knR);
      // arms
      const swing = 0.3 + 0.75 * run, elbow = 0.3 + 0.95 * run;
      let aL = -s * swing * freeze, aR = s * swing * freeze, fL = elbow * freeze, fR = elbow * freeze, spL = 0.1 + 0.04 * Math.sin(t * 1.7 + this.seed), spR = spL;
      if (st === 'slide') { aL = 2.5; aR = 2.2; fL = 0.2; fR = 0.2; spL = 0.7; spR = 0.7; }
      if (st === 'dive') { aL = 2.95; aR = 2.95; fL = 0.1; fR = 0.1; spL = 0.18; spR = 0.18; }
      if (st === 'down') { aL = 0.4 + Math.sin(t * 2 + this.seed) * 0.2; aR = -0.3; fL = 0.5; fR = 0.3; spL = 0.7; spR = 0.7; }
      if (this.gk && lying < 0.2 && spd < 3.5) { aL = lerp(aL, 0.5, 0.8); aR = lerp(aR, 0.5, 0.8); fL = 0.9; fR = 0.9; spL = 0.5; spR = 0.5; }
      if (kickW > 0) { spL = lerp(spL, 0.65, kickW); spR = lerp(spR, 0.65, kickW); aL = lerp(aL, 0.1, kickW); aR = lerp(aR, -0.2, kickW); }
      if (this.holdA > 0.01) { aL = lerp(aL, 1.15, this.holdA); aR = lerp(aR, 1.15, this.holdA); fL = lerp(fL, 1.3, this.holdA); fR = lerp(fR, 1.3, this.holdA); spL = lerp(spL, 0.05, this.holdA); spR = lerp(spR, 0.05, this.holdA); }
      if (this.thrw > 0.01) { aL = lerp(aL, 2.85, this.thrw); aR = lerp(aR, 2.85, this.thrw); fL = lerp(fL, 0.45, this.thrw); fR = lerp(fR, 0.45, this.thrw); spL = lerp(spL, 0.18, this.thrw); spR = lerp(spR, 0.18, this.thrw); }
      if (this.celeb > 0.01) {
        const pump = Math.sin(t * 12 + this.seed) * 0.25;
        aL = lerp(aL, 2.7 + pump, this.celeb); aR = lerp(aR, 2.7 - pump, this.celeb); fL = lerp(fL, 0.2, this.celeb); fR = lerp(fR, 0.2, this.celeb); spL = lerp(spL, 0.5, this.celeb); spR = lerp(spR, 0.5, this.celeb);
      }
      bn[B.ARM_L].rotation.set(spL * Math.cos(aL), 0, aL); bn[B.FORE_L].rotation.set(0, 0, fL);
      bn[B.ARM_R].rotation.set(-spR * Math.cos(aR), 0, aR); bn[B.FORE_R].rotation.set(0, 0, fR);
    }
  }

  // ---------------------------------------------------------------- the renderer
  const QCFG = {
    low: { pr: 1, crowd: 0.45, shadow: false, rain: 380, snow: 380, aa: false },
    mid: { pr: 1.5, crowd: 1, shadow: false, rain: 750, snow: 650, aa: true },
    high: { pr: 2, crowd: 1, shadow: true, rain: 1200, snow: 950, aa: true },
  };
  const CAMP = {
    tv: { fov: 32, pitch: 38, k: 1.0 },
    high: { fov: 34, pitch: 54, k: 1.3 },
    top: { fov: 36, pitch: 86, k: 1.5 },
  };
  const DEG = Math.PI / 180;
  const SLOT_COL = SLOT_COLORS.map((c) => col(c));
  const WHITE = col('#ffffff'), SOFTW = col('#e8f0ff');
  const REF_KIT = { shirt: '#17171c', shirt2: '#ffd24d', shorts: '#17171c', socks: '#17171c', pattern: 'sleeves', gk: '#17171c', gkShorts: '#17171c' };
  const T = (k, v) => FCK.T(k, v);

  class Renderer3D extends FCK.Renderer {
    constructor(canvas) {
      super(canvas);
      this.ok = false; this.mode3d = false; this.dead = false;
      this.q = 'mid'; this.camMode = 'tv'; this.gfxPref = '3d';
      this.scene = null; this.camera = null; this.models = new Map(); this.frameId = 0;
      this.camBlend = 1; this.camFrom = null; this.zmS = 1; this.frameMs = 16; this.resScale = 1; this.adaptT = 0; this.slowT = 0; this.warned = false; this.adapt = true;
      this.srcLive = null; this.prevBall = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sp: 0, ok: false }; this.padPrev = false;
      this.m3 = null; this.lastCamPos = new THREE.Vector3();
      this.confettiN = 0;
      try { this.initGL(canvas); this.ok = true; } catch (e) { this.ok = false; if (typeof console !== 'undefined') console.warn('[FCK 3D] not available:', e && e.message); }
      this._ready = true;
      if (this.ok) this.initKeys();
    }

    static supported() { return HAS_THREE; }
    available() { return this.ok && !this.dead; }

    // ------------------------------------------------------------ GL setup
    initGL(canvas) {
      // probe first so that three.js does not log a console error when WebGL is missing
      try {
        const pc = document.createElement('canvas'), pg = pc.getContext('webgl') || pc.getContext('experimental-webgl');
        if (!pg) throw new Error('WebGL not supported');
        const lose = pg.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      } catch (e) { throw new Error(e && e.message ? e.message : 'WebGL not supported'); }
      const wrap = canvas.parentNode;
      const S = FCK.settings || FCK.DEFAULTS || {};
      const q0 = QUALS.includes(S.q3d) ? S.q3d : 'mid';
      const cv3 = document.createElement('canvas'); cv3.id = 'cv3d'; cv3.setAttribute('aria-label', 'Football pitch 3D');
      const ov = document.createElement('canvas'); ov.id = 'cv3dov'; ov.setAttribute('aria-hidden', 'true');
      wrap.insertBefore(ov, canvas.nextSibling); wrap.insertBefore(cv3, canvas.nextSibling);
      let gl;
      try {
        gl = new THREE.WebGLRenderer({ canvas: cv3, antialias: QCFG[q0].aa, alpha: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.FCK_R3D_PRESERVE });
      } catch (e) { cv3.remove(); ov.remove(); throw e; }
      if (!gl.getContext()) { cv3.remove(); ov.remove(); throw new Error('no WebGL context'); }
      gl.setClearColor(0x0a0e17, 1);
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
      this.gl = gl; this.cv3 = cv3; this.ov = ov; this.ovx = ov.getContext('2d');
      this.q = q0;
      try {
        const ext = gl.getContext().getExtension('WEBGL_debug_renderer_info');
        this.gpu = ext ? String(gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      } catch (e) { this.gpu = ''; }
      this.software = /swiftshader|llvmpipe|software|softpipe/i.test(this.gpu || '');
      cv3.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost(); });
      this.matPlayer = new THREE.MeshLambertMaterial({ vertexColors: true, map: texAtlas(), alphaTest: 0.5, skinning: true });
      this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.8, 900);
      // camera button (touch + mouse), shown while a 3D match is on screen
      const btn = document.createElement('button'); btn.id = 'cam3d'; btn.type = 'button'; btn.hidden = true;
      btn.className = 'hud-btn cam3d'; btn.innerHTML = '<i>&#127909;</i><b></b>';
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.cycleCam(1); });
      wrap.appendChild(btn); this.camBtn = btn;
      this.show3d(false);
    }

    contextLost() { this.fail(new Error('context lost'), 'gfx3d.lost'); }

    fail(err, toastKey) {
      if (typeof console !== 'undefined') console.warn('[FCK 3D] switching to 2D:', err && err.message ? err.message : err);
      const was = this.mode3d;
      this.dead = true; this.ok = false; this.mode3d = false;
      try { this.show3d(false); } catch (e) { /* ignore */ }
      if (was && this.m) { try { super.resize(); super.setMatch(this.m); } catch (e) { /* ignore */ } }
      if (toastKey && FCK.UI && FCK.UI.toast) FCK.UI.toast(T(toastKey), 3800);
    }

    show3d(on) {
      this.cv.style.visibility = on ? 'hidden' : '';
      if (!this.cv3) return;
      this.cv3.style.display = on ? 'block' : 'none'; this.ov.style.display = on ? 'block' : 'none';
      document.body.classList.toggle('gfx3d', !!on);
      if (this.camBtn) this.camBtn.hidden = !on;
      if (on) this.updateCamBtn();
    }

    // ------------------------------------------------------------ settings
    prefs() {
      const S = FCK.settings || {};
      return { gfx: S.gfx3d === '2d' ? '2d' : '3d', q: QUALS.includes(S.q3d) ? S.q3d : 'mid', cam: CAMS.includes(S.cam3d) ? S.cam3d : 'tv' };
    }
    resize() {
      super.resize();
      if (this._ready && this.mode3d) this.resize3d();
    }
    updateScale() {
      super.updateScale();
      if (!this._ready) return;
      const pr = this.prefs();
      if (pr.cam !== this.camMode) { this.camMode = pr.cam; this.onCamChanged(); }
      const g = FCK.game;
      const live = g && g.kind === 'match' && this.m && this.m === g.m;
      if (pr.q !== this.q) {
        this.q = pr.q;
        if (this.mode3d) { try { this.resize3d(); this.buildScene(this.m); } catch (e) { this.fail(e); } }
      }
      if (live) {
        if (pr.gfx === '2d' && this.mode3d) this.enter2d(this.m);
        else if (pr.gfx === '3d' && !this.mode3d && this.shouldUse3d(this.m)) this.enter3d(this.m);
      }
      this.gfxPref = pr.gfx;
    }
    shouldUse3d(m) {
      if (!this.ok || this.dead || !m || !m.teams) return false;
      if ((FCK.settings || {}).gfx3d === '2d') return false;
      if (m.slots !== undefined && m.autoProceed) return false; // menu demo stays 2D
      return true;
    }
    effCam(view) {
      let c = this.camMode;
      if (c === 'goal') {
        const m = this.m;
        if (!m || !m.slots || !this.srcLive) return 'tv'; // replays/archive: TV
        const hs = [m.teams[0].humans.length > 0, m.teams[1].humans.length > 0];
        if (hs[0] && hs[1]) return 'tv';
      }
      return c;
    }
    humanTeam() {
      const m = this.m; if (!m || !m.teams) return null;
      return m.teams[0].humans.length > 0 ? m.teams[0] : m.teams[1].humans.length > 0 ? m.teams[1] : m.teams[0];
    }
    cycleCam(step) {
      if (!this.mode3d) return;
      const S = FCK.settings; if (!S) return;
      const m = this.m;
      const two = m && m.teams && m.teams[0].humans && m.teams[0].humans.length > 0 && m.teams[1].humans.length > 0;
      let list = CAMS.filter((c) => !(c === 'goal' && (two || !this.srcLive)));
      let i = list.indexOf(this.camMode); if (i < 0) i = 0;
      const nxt = list[(i + (step || 1) + list.length) % list.length];
      S.cam3d = nxt; FCK.saveSettings && FCK.saveSettings();
      this.camMode = nxt; this.onCamChanged();
      if (FCK.UI && FCK.UI.toast) FCK.UI.toast(T('cam3d.toast', { n: T('cam3d.' + nxt) }), 1100);
    }
    onCamChanged() {
      if (this.camera && this.mode3d) {
        this.camFrom = { p: this.camera.position.clone(), l: this.lookAt ? this.lookAt.clone() : new THREE.Vector3(this.cam.x, 0, this.cam.y), f: this.camera.fov };
        this.camBlend = 0;
      }
      this.updateCamBtn();
    }
    updateCamBtn() {
      if (!this.camBtn) return;
      const b = this.camBtn.querySelector('b'); if (b) b.textContent = T('cam3d.' + this.camMode);
      this.camBtn.title = T('cam3d.hint');
      this.camBtn.setAttribute('aria-label', T('cam3d.hint'));
    }
    initKeys() {
      window.addEventListener('keydown', (e) => {
        if (!this.mode3d || e.repeat) return;
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const g = FCK.game; if (!g || (g.kind !== 'match' && g.kind !== 'archive')) return;
        if (FCK.UI && FCK.UI.modalOpen) return;
        let hit = e.code === 'KeyB' || e.code === 'Tab';
        if (e.code === 'KeyC') { // C is the through-pass key for a single keyboard player
          const sl = (FCK.input && FCK.input.slots) || [];
          hit = !sl.some((s) => s.map && s.map === (FCK.KEYMAPS && FCK.KEYMAPS.solo));
        }
        if (!hit) return;
        e.preventDefault(); this.cycleCam(e.shiftKey ? -1 : 1);
      });
    }
    pollPad() {
      const g = FCK.game; if (!g || g.kind !== 'match' || !navigator.getGamepads) return;
      let pressed = false;
      const pads = navigator.getGamepads() || [];
      for (let i = 0; i < pads.length; i++) { const p = pads[i]; if (p && p.connected && p.buttons[8] && p.buttons[8].pressed) pressed = true; }
      if (pressed && !this.padPrev && !(FCK.UI && FCK.UI.modalOpen)) this.cycleCam(1);
      this.padPrev = pressed;
    }
    // stick direction -> world direction for the end-zone camera (called by main.js for every slot input)
    inputRot(inp) {
      if (!inp || !this.mode3d || !this.srcLive || this.effCam() !== 'goal') return;
      const d = this.goalDir(); if (!d) return;
      const dx = inp.dx, dy = inp.dy;
      if (d > 0) { inp.dx = -dy; inp.dy = dx; } else { inp.dx = dy; inp.dy = -dx; }
    }
    goalDir() { const t = this.humanTeam(); return t ? t.dir : 0; }

    // ------------------------------------------------------------ mode switching
    setMatch(m) {
      this.m = m;
      if (this.shouldUse3d(m)) this.enter3d(m); else this.enter2d(m);
    }
    enter2d(m) {
      const was = this.mode3d;
      this.mode3d = false;
      this.show3d(false);
      if (was) super.resize();
      super.setMatch(m);
    }
    enter3d(m) {
      try {
        this.m = m;
        this.mode3d = true;
        const pr = this.prefs(); this.q = pr.q; this.camMode = pr.cam;
        this.show3d(true);
        this.resize3d();
        this.buildScene(m);
        this.cam.x = L / 2; this.cam.y = GY;
        this.camBlend = 1; this.camFrom = null; this.snapCam = true; this.srcLive = null; this.zmS = 1;
        this.trail.length = 0; this.confetti.length = 0; this.prevBall.ok = false;
        this.frameMs = 16; this.slowT = 0; this.adaptT = 0; this.frames = 0;
      } catch (e) { this.fail(e, 'gfx3d.lost'); super.setMatch(m); }
    }

    resize3d() {
      if (!this.gl) return;
      const r = this.cv3.getBoundingClientRect();
      const w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
      const cfg = QCFG[this.q] || QCFG.mid;
      const dpr = Math.min(cfg.pr, window.devicePixelRatio || 1);
      this.w3 = w; this.h3 = h;
      this.gl.setPixelRatio(Math.max(0.5, dpr * this.resScale));
      this.gl.setSize(w, h, false);
      const od = Math.min(2, window.devicePixelRatio || 1);
      this.ov.width = Math.round(w * od); this.ov.height = Math.round(h * od);
      this.ovx.setTransform(od, 0, 0, od, 0, 0);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }

    // ------------------------------------------------------------ scene
    track(o) { this.owned.push(o); return o; }
    add(o) { this.scene.add(o); return o; }

    disposeScene() {
      if (this.models) { this.models.forEach((M) => { M.dispose(); }); this.models.clear(); }
      if (this.scene) {
        this.scene.traverse((o) => {
          if (o.geometry && !o.userData.keepGeo) o.geometry.dispose();
          const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          mats.forEach((mm) => { if (mm !== this.matPlayer) mm.dispose(); });
        });
      }
      (this.owned || []).forEach((t) => { if (t && t.dispose) t.dispose(); });
      this.owned = []; this.scene = null;
    }

    buildScene(m) {
      this.disposeScene();
      const q = this.q, cfg = QCFG[q] || QCFG.mid;
      const hc = m.teams[0].club, pst = hc.pitch || {};
      const weather = m.weather || 'clear', tod = m.tod || 'day';
      const env = envFor(tod, weather), snow = weather === 'snow';
      this.env = env; this.owned = [];
      const scene = new THREE.Scene(); this.scene = scene;
      scene.background = env.hor.clone();
      scene.fog = new THREE.Fog(env.hor.getHex(), env.fogN, env.fogF);
      // lights
      this.hemi = this.add(new THREE.HemisphereLight(env.hemiS, env.hemiG, env.hemiI));
      const sun = new THREE.DirectionalLight(env.sun, env.sunI);
      const dv = new THREE.Vector3(env.dir[0], env.dir[1], env.dir[2]).normalize();
      this.sunDir = dv; sun.position.copy(dv).multiplyScalar(90); sun.target.position.set(L / 2, 0, GY);
      this.add(sun); this.add(sun.target); this.sun = sun;
      this.shadowOn = !!cfg.shadow;
      this.gl.shadowMap.enabled = this.shadowOn;
      if (this.shadowOn) {
        sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
        const sc = sun.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 5; sc.far = 220;
        sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
      }
      // sky dome
      {
        const g = new THREE.SphereGeometry(500, 16, 10), cs = [], p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i) / 500, t = clamp(y * 1.6, 0, 1), c = y < 0 ? env.hor.clone().multiplyScalar(0.8) : env.hor.clone().lerp(env.sky, Math.pow(t, 0.7));
          cs.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
        const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
        sky.renderOrder = -10; sky.frustumCulled = false; this.sky = this.add(sky);
        if (tod === 'night' && weather !== 'fog') {
          const n = 260, sp = new Float32Array(n * 3), rnd = U.makeRng(99);
          for (let i = 0; i < n; i++) { const a = rnd.range(0, Math.PI * 2), e = rnd.range(0.12, 1.3); sp[i * 3] = Math.cos(a) * Math.cos(e) * 480; sp[i * 3 + 1] = Math.sin(e) * 480; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 480; }
          const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
          const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: weather === 'clear' ? 0.8 : 0.25, depthWrite: false }));
          stars.renderOrder = -9; stars.frustumCulled = false; this.stars = this.add(stars);
        } else this.stars = null;
      }
      // ground
      {
        const gc = snow ? '#b9c6cf' : tod === 'night' ? '#2a3140' : '#4a5566';
        const g = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: gc }));
        g.rotation.x = -Math.PI / 2; g.position.set(L / 2, -0.06, GY); g.receiveShadow = false; this.add(g);
      }
      // pitch
      {
        const tex = this.track(makeGrassTexture(weather, pst));
        tex.anisotropy = Math.min(this.gl.capabilities.getMaxAnisotropy(), q === 'low' ? 2 : 8);
        const pm = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * PM, W + 2 * PM), new THREE.MeshLambertMaterial({ map: tex }));
        pm.rotation.x = -Math.PI / 2; pm.position.set(L / 2, 0, GY); pm.receiveShadow = true; this.add(pm);
        const lm = new THREE.Mesh(buildLines(snow), new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        lm.renderOrder = 1; this.add(lm);
      }
      // goals, flags
      this.add(new THREE.Mesh(buildGoalFrames(snow), new THREE.MeshLambertMaterial({ vertexColors: true })));
      this.add(new THREE.Mesh(buildFlags(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
      {
        const net = new THREE.Mesh(buildNets(), new THREE.MeshBasicMaterial({ map: texNet(), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.05 }));
        net.renderOrder = 2; this.add(net);
      }
      // ad boards
      {
        const ads = pst.ad ? [pst.ad, 'FCK', pst.ad, 'GOAL!', pst.ad, 'FAIR PLAY'] : ['FCK', 'KIDS CUP', 'GOAL!', 'FAIR PLAY', 'FCK', 'TEAMWORK'];
        const dim = tod === 'night' ? 0.95 : tod === 'evening' ? 0.92 : 0.88;
        const mk = (len, texts, seed, x, z, rotY) => {
          const tex = this.track(adCanvas(len > 90 ? 2048 : 1024, texts, seed));
          const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.95), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(dim, dim, dim) }));
          pl.position.set(x, 0.5, z); pl.rotation.y = rotY; this.add(pl);
          const back = new THREE.Mesh(new THREE.BoxGeometry(len, 1.0, 0.1), new THREE.MeshLambertMaterial({ color: '#0a0e17' }));
          back.position.set(x, 0.5, z); back.rotation.y = rotY;
          const off = new THREE.Vector3(0, 0, -0.07).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY); back.position.add(off); this.add(back);
        };
        const lenX = L + 2 * AD_OFF, lenZ = W + 2 * AD_OFF;
        mk(lenX, ads, 0, L / 2, -AD_OFF, 0);
        mk(lenX, ads, 2, L / 2, W + AD_OFF, Math.PI);
        mk(lenZ, ads.slice().reverse(), 1, -AD_OFF, GY, Math.PI / 2);
        mk(lenZ, ads.slice().reverse(), 3, L + AD_OFF, GY, -Math.PI / 2);
      }
      // stands + crowd
      {
        const seatCol = pst.seat === 'club' ? mixCol(hc.colors.p, '#141a2a', 0.45) : col('#27355a');
        const geos = buildStandGeos(seatCol, snow);
        const sm = new THREE.MeshLambertMaterial({ vertexColors: true, color: new THREE.Color(env.stand, env.stand, env.stand) });
        this.stands = geos.map((g) => { const me = new THREE.Mesh(g, sm); this.add(me); return me; });
        this.buildCrowd3(m, env, cfg);
      }
      // floodlight towers
      this.buildFloods(env, tod);
      // dynamic objects
      this.buildDynamic(m, env, cfg);
      this.buildWeather(m, weather, cfg);
      this.frameId = 0;
    }

    buildCrowd3(m, env, cfg) {
      const rnd = U.makeRng(4242), slots = seatSlots();
      let total = 0; slots.forEach((s) => { total += s.length; });
      const att = (m.crowd && m.crowd.att) || 20000, cap = (m.crowd && m.crowd.cap) || att;
      const target = clamp(att / 15, 800, 5200) * cfg.crowd;
      const fill = Math.min(0.95, target / total) * (0.55 + 0.45 * clamp(att / cap, 0.3, 1));
      const cA = m.teams[0].kit.shirt, cB = m.teams[1].kit.shirt;
      const pal = [cA, cA, cA, cA, cB, '#e8edf7', '#f2c14e', '#7aa2ff', '#ff7a7a', '#2a3350'];
      const palAway = [cB, cB, cB, cB, cB, cB, cA, '#e8edf7'];
      const bodyGeo = new THREE.BoxGeometry(0.42, 0.52, 0.3); bodyGeo.translate(0, 0.3, 0);
      const headGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22); headGeo.translate(0, 0.72, 0);
      const mk = (geo) => {
        const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(env.stand, env.stand, env.stand) });
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uT = this.uT; sh.uniforms.uA = this.uA;
          sh.vertexShader = 'attribute float aPh;\nuniform float uT;\nuniform float uA;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.y += max(0.0, sin(uT * (5.0 + aPh * 0.6) + aPh * 6.2831)) * uA * (0.45 + 0.55 * fract(aPh * 7.31));');
        };
        return mat;
      };
      this.uT = { value: 0 }; this.uA = { value: 0.02 };
      this.crowd3 = [];
      const tmp = new THREE.Matrix4(), cc = new THREE.Color();
      for (let s = 0; s < 4; s++) {
        const pick = [];
        slots[s].forEach((st) => { const bias = (1.3 - st.r * 0.075) * (s === 1 || s === 3 ? 0.92 : 1); if (rnd.next() < fill * bias) pick.push(st); });
        if (!pick.length) continue;
        const bm = new THREE.InstancedMesh(bodyGeo, mk(), pick.length), hm = new THREE.InstancedMesh(headGeo, mk(), pick.length);
        const ph = new Float32Array(pick.length);
        pick.forEach((st, i) => {
          const sc = 0.92 + rnd.next() * 0.18;
          tmp.makeScale(1, sc, 1); tmp.setPosition(st.x, st.y, st.z);
          bm.setMatrixAt(i, tmp); hm.setMatrixAt(i, tmp);
          const awaySide = s === 1 && st.z > GY - 10 && st.r < 6;
          bm.setColorAt(i, cc.set(rnd.pick(awaySide ? palAway : pal)));
          hm.setColorAt(i, cc.set(FCK.SKIN[rnd.int(0, FCK.SKIN.length - 1)]));
          ph[i] = rnd.next();
        });
        bm.geometry = bodyGeo.clone(); hm.geometry = headGeo.clone();
        bm.geometry.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1)); hm.geometry.setAttribute('aPh', new THREE.InstancedBufferAttribute(ph, 1));
        bm.frustumCulled = false; hm.frustumCulled = false;
        this.add(bm); this.add(hm);
        this.crowd3[s] = [bm, hm];
      }
      this.track(bodyGeo); this.track(headGeo);
    }

    buildFloods(env, tod) {
      const gb = new GB(), cols = [];
      const spots = [[-22, -22], [L + 22, -22], [L + 22, W + 22], [-22, W + 22]];
      spots.forEach((s) => { gb.box(s[0] - 0.5, 0, s[1] - 0.5, s[0] + 0.5, 34, s[1] + 0.5, '#6b7280'); });
      this.add(new THREE.Mesh(gb.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
      const lampTex = this.track(canvasTex(128, 64, (g) => {
        g.fillStyle = '#2a2f3a'; g.fillRect(0, 0, 128, 64);
        g.fillStyle = '#fff6dc';
        for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(14 + i * 25, 12 + j * 20, 8, 0, 7); g.fill(); }
      }));
      const k = 0.55 + 0.45 * env.flood;
      const pm = new THREE.MeshBasicMaterial({ map: lampTex, color: new THREE.Color(k, k, k), side: THREE.DoubleSide });
      this.glows = [];
      spots.forEach((s) => {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), pm);
        pl.position.set(s[0], 35.5, s[1]); pl.lookAt(L / 2, 12, GY); this.add(pl);
        if (env.flood > 0.2) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(), color: 0xffffff, transparent: true, opacity: 0.35 + 0.6 * env.flood, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
          sp.position.set(s[0], 35.5, s[1]); sp.scale.set(26, 26, 1); this.add(sp);
        }
      });
    }

    buildDynamic(m, env, cfg) {
      // blob shadows (players + referee), ball shadow
      const bg = new THREE.CircleGeometry(1, 14); bg.rotateX(-Math.PI / 2);
      const bm = new THREE.MeshBasicMaterial({ map: texBlob(), transparent: true, opacity: cfg.shadow ? 0.3 : 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      this.blobs = new THREE.InstancedMesh(bg, bm, 28); this.blobs.frustumCulled = false; this.blobs.renderOrder = 3; this.blobs.count = 0; this.add(this.blobs);
      this.ballShadow = new THREE.Mesh(bg, bm.clone()); this.ballShadow.renderOrder = 3; this.ballShadow.frustumCulled = false; this.add(this.ballShadow);
      // ball
      const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 14, 10), new THREE.MeshLambertMaterial({ map: texBall() }));
      ball.castShadow = true; this.ball = this.add(ball); this.ballQ = new THREE.Quaternion();
      // decal batches
      this.gA = new QuadBatch(2600, 0.95, 5); this.gB = new QuadBatch(900, 0.55, 4); this.gC = new QuadBatch(900, 0.24, 4);
      this.add(this.gA.mesh); this.add(this.gB.mesh); this.add(this.gC.mesh);
      // controlled-player arrows (one per slot)
      this.arrows = SLOT_COL.map((c) => {
        const g = new THREE.ConeGeometry(0.34, 0.6, 4); g.rotateX(Math.PI);
        const a = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.95, fog: false }));
        a.renderOrder = 20; a.visible = false; a.frustumCulled = false; this.add(a); return a;
      });
      // confetti
      const N = 220, pos = new Float32Array(N * 3), cs = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) pos[i * 3 + 1] = -50;
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); cg.setAttribute('color', new THREE.BufferAttribute(cs, 3));
      this.confPts = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false, fog: false }));
      this.confPts.frustumCulled = false; this.confPts.renderOrder = 8; this.add(this.confPts);
      this.confN = N; this.confP = new Float32Array(N * 6); this.confL = new Float32Array(N);
    }

    buildWeather(m, weather, cfg) {
      this.rainLines = null; this.snowPts = null;
      if (!this.particles) return;
      if (weather === 'rain' || weather === 'storm') {
        const N = Math.round(cfg.rain * (weather === 'storm' ? 1.5 : 1));
        const g = new THREE.BufferGeometry(); const arr = new Float32Array(N * 6);
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3).setUsage(THREE.DynamicDrawUsage));
        const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: this.env.sky.clone().lerp(new THREE.Color('#ffffff'), 0.75), transparent: true, opacity: m.tod === 'night' ? 0.4 : 0.34, depthWrite: false }));
        ls.frustumCulled = false; ls.renderOrder = 9; this.add(ls); this.rainLines = ls;
        this.rainP = new Float32Array(N * 3); const rnd = U.makeRng(7);
        for (let i = 0; i < N; i++) { this.rainP[i * 3] = rnd.range(-60, 60); this.rainP[i * 3 + 1] = rnd.range(0, 26); this.rainP[i * 3 + 2] = rnd.range(-50, 50); }
        this.rainN = N;
      } else if (weather === 'snow') {
        const N = cfg.snow;
        const g = new THREE.BufferGeometry(); const arr = new Float32Array(N * 3);
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3).setUsage(THREE.DynamicDrawUsage));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.34, map: texDot(), transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true }));
        pts.frustumCulled = false; pts.renderOrder = 9; this.add(pts); this.snowPts = pts;
        this.snowP = new Float32Array(N * 4); const rnd = U.makeRng(8);
        for (let i = 0; i < N; i++) { this.snowP[i * 4] = rnd.range(-60, 60); this.snowP[i * 4 + 1] = rnd.range(0, 26); this.snowP[i * 4 + 2] = rnd.range(-50, 50); this.snowP[i * 4 + 3] = rnd.range(0, 6.28); }
        this.snowN = N;
      }
    }

    // ------------------------------------------------------------ per frame
    draw(view, dt, opts) {
      if (!this.mode3d) { super.draw(view, dt, opts); return; }
      try { this.draw3d(view, dt, opts || {}); } catch (e) {
        this.fail(e);
        if (this.m) { try { super.draw(view, dt, opts); } catch (e2) { /* ignore */ } }
      }
    }

    framing(view, opts) {
      const b = view.ball, mm = opts.match;
      const fr = { x: b.x, y: b.y, zm: this.srcLive ? 1 : 0.82, lead: 1 };
      if (!mm) return fr;
      const rs = mm.restart;
      if ((mm.mode === 'goal' || mm.mode === 'goalwait') && mm.lastGoal && mm.lastGoal.scorer) {
        const sc = mm.lastGoal.scorer; fr.x = sc.x; fr.y = sc.y; fr.zm = 0.7; fr.lead = 0;
      } else if ((mm.mode === 'restart' || mm.mode === 'shootout') && rs) {
        const gxx = rs.x < L / 2 ? 0 : L;
        if (rs.type === 'corner') { fr.x = lerp(rs.x, gxx, 0.2); fr.y = lerp(rs.y, GY, 0.4); fr.zm = 0.84; fr.lead = 0; }
        else if (rs.type === 'penalty') { fr.x = lerp(rs.x, gxx, 0.55); fr.y = GY; fr.zm = 0.68; fr.lead = 0; }
        else if (rs.type === 'freekick') {
          const tg = mm.teams[rs.team].goalX;
          if (Math.abs(rs.x - tg) < 34) { fr.x = lerp(rs.x, tg, 0.33); fr.y = lerp(rs.y, GY, 0.35); fr.zm = 0.86; fr.lead = 0; }
        }
      }
      return fr;
    }

    draw3d(view, dt, opts) {
      const m = this.m, b = view.ball;
      this.t += dt; this.frames = (this.frames || 0) + 1;
      const live = !!opts.match;
      if (this.srcLive !== live) { this.srcLive = live; this.snapCam = true; this.prevBall.ok = false; if (!live && this.camMode === 'goal') this.camBlend = 1; }
      this.shake = Math.max(0, this.shake - dt * 1.5);
      if (opts.shake) this.shake = Math.max(this.shake, opts.shake);
      this.roar = Math.max(0, this.roar - dt * 0.5);
      this.pollPad();
      this.frameId++;
      this.perf(dt);
      this.updateCamera(view, dt, opts);
      this.updateBall(view, dt);
      this.updateModels(view, dt, opts);
      this.updateDecals(view, dt, opts);
      this.updateParticles(view, dt);
      this.uT.value = this.t; this.uA.value = 0.012 + this.mood * 0.05 + this.roar * 0.42;
      this.updateVisibility();
      this.updateLight();
      this.gl.render(this.scene, this.camera);
      this.drawOverlay(view, dt, opts);
    }

    perf(dt) {
      if (dt <= 0) return;
      this.frameMs = this.frameMs * 0.94 + dt * 1000 * 0.06;
      if (!this.adapt || this.frames < 90) return;
      this.adaptT += dt;
      if (this.adaptT < 1.6) return;
      if (this.frameMs > 27 && this.resScale > 0.55) { this.adaptT = 0; this.resScale = Math.max(0.55, this.resScale * 0.85); this.resize3d(); }
      else if (this.frameMs < 13.5 && this.resScale < 1) { this.adaptT = 0; this.resScale = Math.min(1, this.resScale * 1.1); this.resize3d(); }
      if (this.frameMs > 45 && this.resScale <= 0.56) { this.slowT += 1.6; if (this.slowT > 6 && !this.warned) { this.warned = true; if (FCK.UI && FCK.UI.toast) FCK.UI.toast(T('gfx3d.slow'), 5000); } } else this.slowT = Math.max(0, this.slowT - 1.6);
    }

    // ------------------------------------------------------------ camera
    updateCamera(view, dt, opts) {
      const cam = this.cam, cm = this.camera, b = view.ball;
      const mode = this.effCam();
      const aspect = this.w3 / this.h3 || 16 / 9;
      const fr = this.framing(view, opts);
      this.zmS = damp(this.zmS, fr.zm, this.snapCam ? 99 : 2.2, dt);
      let tx = fr.x + (fr.lead ? (b.vx || 0) * 0.28 : 0), ty = fr.y + (fr.lead ? (b.vy || 0) * 0.28 : 0);
      const k = this.snapCam || opts.snap ? 1 : 1 - Math.exp(-dt * 3.4);
      let pos, look, fov;
      if (mode === 'goal') {
        cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
        const dir = this.goalDir() || 1, own = dir > 0 ? 0 : L;
        const s = clamp(dir > 0 ? cam.x / L : 1 - cam.x / L, 0, 1);
        const cx = own + dir * (-16 + 56 * s), cy = 8.5 + 7 * s * 0.8;
        const cz = GY + (cam.y - GY) * 0.35;
        pos = new THREE.Vector3(cx, cy, cz);
        look = new THREE.Vector3(cam.x + dir * 4, 0.5, lerp(GY, cam.y, 0.8));
        fov = aspect < 1.2 ? 62 : 46;
      } else {
        const P3 = CAMP[mode] || CAMP.tv;
        fov = P3.fov;
        const th = Math.tan(fov * DEG / 2), pitch = P3.pitch * DEG;
        const vw = ({ far: 88, mid: 64, near: 48 }[this.zoom] || 64) * P3.k * this.zmS;
        let d = (vw / 2) / (th * aspect);
        const dH = (66 * P3.k * this.zmS / 2) * Math.sin(pitch) / th;
        d = Math.max(14, Math.min(d, dH));
        const halfW = d * th * aspect, halfD = (d * th) / Math.sin(pitch);
        const mx = 10, minX = halfW - mx, maxX = L + mx - halfW, minY = halfD - mx, maxY = W + mx - halfD;
        tx = minX > maxX ? L / 2 : clamp(tx, minX, maxX);
        ty = minY > maxY ? GY : clamp(ty, minY, maxY);
        cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
        look = new THREE.Vector3(cam.x, 0, cam.y);
        pos = new THREE.Vector3(cam.x, Math.sin(pitch) * d, cam.y + Math.cos(pitch) * d);
      }
      if (this.debugCam) { pos.set(...this.debugCam.pos); look.set(...this.debugCam.look); fov = this.debugCam.fov || 40; }
      else if (this.camBlend < 1 && this.camFrom) {
        this.camBlend = Math.min(1, this.camBlend + dt / 0.9);
        const e = smooth(this.camBlend);
        pos.lerpVectors(this.camFrom.p, pos, e); look.lerpVectors(this.camFrom.l, look, e); fov = lerp(this.camFrom.f, fov, e);
      }
      if (this.shake > 0) { const s = this.shake * 0.5; pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; pos.z += (Math.random() - 0.5) * s; }
      cm.position.copy(pos); cm.fov = fov; cm.updateProjectionMatrix();
      cm.lookAt(look); cm.updateMatrixWorld(true);
      this.lookAt = look; this.snapCam = false;
      this.effMode = mode;
      this.sky.position.copy(pos);
      if (this.stars) this.stars.position.copy(pos);
    }

    updateVisibility() {
      const p = this.camera.position, hide = [false, false, false, false];
      const lo = SO - 3, hi = SO + ROWS * ROW_D + 3;
      const dN = -p.z, dE = p.x - L, dS = p.z - W, dW = -p.x;
      const inB = (d) => d > lo && d < hi;
      hide[0] = inB(dN); hide[1] = inB(dE); hide[2] = inB(dS); hide[3] = inB(dW);
      for (let s = 0; s < 4; s++) {
        if (this.stands[s]) this.stands[s].visible = !hide[s];
        if (this.crowd3[s]) { this.crowd3[s][0].visible = !hide[s]; this.crowd3[s][1].visible = !hide[s]; }
      }
    }

    updateLight() {
      if (!this.sun) return;
      const c = this.cam, d = this.sunDir;
      let tx = c.x, tz = c.y;
      if (this.shadowOn) { const q = 0.5; tx = Math.round(tx / q) * q; tz = Math.round(tz / q) * q; }
      this.sun.target.position.set(tx, 0, tz);
      this.sun.position.set(tx + d.x * 90, d.y * 90, tz + d.z * 90);
      this.sun.target.updateMatrixWorld();
      const fl = this.flash > 0 ? this.flash : 0;
      this.hemi.intensity = this.env.hemiI * (1 + fl * 0.8);
    }

    // ------------------------------------------------------------ ball
    updateBall(view, dt) {
      const b = view.ball, ball = this.ball, pb = this.prevBall;
      ball.position.set(b.x, b.z + BALL_R, b.y);
      // 3D velocity from positions (works for live matches and replays)
      let vx = 0, vy = 0, vz = 0;
      if (pb.ok && dt > 0) { vx = (b.x - pb.x) / dt; vy = (b.y - pb.y) / dt; vz = (b.z - pb.z) / dt; }
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz), jump = Math.abs(b.x - pb.x) + Math.abs(b.y - pb.y) > 8;
      if (pb.ok && dt > 0 && !jump && sp > 0.05) {
        const axv = new THREE.Vector3(vy, 0, -vx); // v = (vx, vz, vy) in three coords; axis = up x v = (vy, 0, -vx)
        const l = axv.length();
        if (l > 1e-4) { axv.multiplyScalar(1 / l); this.ballQ.setFromAxisAngle(axv, (Math.sqrt(vx * vx + vy * vy) * dt) / BALL_R); ball.quaternion.premultiply(this.ballQ); }
      }
      // kick detection: ball suddenly faster and a player is next to it
      this.kickCand = null;
      if (pb.ok && dt > 0 && !jump && sp > pb.sp + 4.5 && sp > 6.5) this.kickCand = { x: pb.x, y: pb.y, z: pb.z };
      pb.x = b.x; pb.y = b.y; pb.z = b.z; pb.sp = sp * 0.5 + pb.sp * 0.5; pb.vx = vx; pb.vy = vy; pb.vz = vz; pb.ok = true;
      // shadow
      const h = Math.max(0, b.z), sd = this.sunDir;
      const off = Math.min(1.2, h * 0.5);
      const sx = b.x - (sd.x / sd.y) * h * 0.55 * Math.min(1, off + 0.2), sz = b.y - (sd.z / sd.y) * h * 0.55 * Math.min(1, off + 0.2);
      this.ballShadow.position.set(sx, 0.03, sz);
      const sc = 0.42 + h * 0.06; this.ballShadow.scale.set(sc, 1, sc);
      this.ballShadow.material.opacity = (this.shadowOn ? 0.3 : 0.62) / (1 + h * 0.28);
      // trail on hard shots
      const hs = Math.sqrt(vx * vx + vy * vy);
      if (hs > 17 && b.z < 2 && this.particles) this.trail.push({ x: b.x, y: b.y, a: 1 });
    }

    // ------------------------------------------------------------ players
    model(p, ref) {
      const ti = p.ti !== undefined ? p.ti : p.team && p.team.idx;
      const key = ref ? 'ref' : ti + ':' + p.num + ':' + p.sname + ':' + (p.isGK ? 'g' : 'f');
      let M = this.models.get(key);
      if (!M) {
        M = new PlayerModel(this, p, ref ? REF_KIT : p.team.kit, ref);
        M.key = key; this.scene.add(M.group); this.models.set(key, M);
      }
      return M;
    }

    updateModels(view, dt, opts) {
      const b = view.ball, ps = view.players, fid = this.frameId, t = this.t;
      const rs = opts.restart;
      const cand = this.kickCand;
      // who kicked?
      let kicker = null;
      if (cand) {
        const lt = b.lastTouch;
        if (lt && Math.hypot(lt.x - cand.x, lt.y - cand.y) < 3.2) kicker = lt;
        else { let bd = 2.4; for (let i = 0; i < ps.length; i++) { const d = Math.hypot(ps[i].x - cand.x, ps[i].y - cand.y); if (d < bd) { bd = d; kicker = ps[i]; } } }
      }
      let nb = 0;
      const blobs = this.blobs, mt = this._mt || (this._mt = new THREE.Matrix4()), sd = this.sunDir;
      const stretch = 1 + Math.max(0, 1 - sd.y) * 0.9;
      const bx = (-sd.x / sd.y) * 0.5, bz = (-sd.z / sd.y) * 0.5;
      const bl = Math.hypot(bx, bz), bk = bl > 0.9 ? 0.9 / bl : 1;
      const blobFor = (p) => {
        if (nb >= 28) return;
        const a = Math.atan2(bz, bx);
        mt.makeRotationY(-a); mt.scale(this._sv.set(0.78 * stretch, 1, 0.58)); mt.setPosition(p.x + bx * bk, 0.028, p.y + bz * bk);
        blobs.setMatrixAt(nb++, mt);
      };
      this._sv = this._sv || new THREE.Vector3();
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.onPitch === false) continue;
        const M = this.model(p, false);
        M.used = fid;
        if (kicker === p) M.kick = 0;
        this.placeModel(M, p, dt, t, b, rs, false);
        if (!this.shadowOn) blobFor(p);
        else M.mesh.castShadow = true;
      }
      if (view.ref) {
        const r = view.ref, M = this.model(r, true);
        M.used = fid;
        const spd = Math.hypot(r.vx || 0, r.vy || 0);
        const rr = { x: r.x, y: r.y, ang: spd > 0.3 ? Math.atan2(r.vy, r.vx) : (M.refAng || 0), spd, state: 'idle', isGK: false };
        M.refAng = rr.ang;
        this.placeModel(M, rr, dt, t, b, null, true);
        if (!this.shadowOn) blobFor(r);
      }
      this.models.forEach((M) => { M.group.visible = M.used === fid; });
      blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    }

    placeModel(M, p, dt, t, b, rs, isRef) {
      const g = M.group;
      g.position.set(p.x, 0, p.y);
      g.rotation.y = -(p.ang || 0);
      const dxb = b.x - p.x, dyb = b.y - p.y;
      const db = Math.sqrt(dxb * dxb + dyb * dyb);
      let ly = 0;
      if (db > 0.8) ly = U.angDiff(p.ang || 0, Math.atan2(dyb, dxb));
      const ctx = { lookYaw: ly, throwIn: !!(rs && rs.type === 'throwin' && rs.taker === p && b.z > 1.2) };
      M.pose(p, dt, t, ctx);
    }

    // ------------------------------------------------------------ decals: markers, aim guides, controlled rings
    updateDecals(view, dt, opts) {
      const A = this.gA, Bb = this.gB, C = this.gC, t = this.t, YD = 0.04;
      A.begin(); Bb.begin(); C.begin();
      const m = opts.match, r = opts.restart;
      // restart markers
      if (r) {
        const pulse = 0.9 + Math.sin(t * 5) * 0.12;
        if (r.type === 'freekick' || r.type === 'corner' || r.type === 'throwin' || r.type === 'goalkick' || r.type === 'kickoff') {
          Bb.ring(r.x, r.y, pulse, 0.12, YD, WHITE, 0, Math.PI * 2, 24); C.disc(r.x, r.y, pulse, YD, WHITE, 16);
        }
        if (r.type === 'freekick' && r.phase !== 'free') Bb.ring(r.x, r.y, 9.15, 0.1, YD, WHITE, 0, Math.PI * 2, 72, 1);
        if (r.type === 'throwin') {
          const inward = r.y < P.cy ? 1 : -1;
          Bb.seg(r.x - 1.6, r.y, r.x + 1.6, r.y, 0.14, YD, WHITE);
          Bb.seg(r.x, r.y + inward * 1.2, r.x - 0.5, r.y + inward * 2.2, 0.14, YD, WHITE); Bb.seg(r.x, r.y + inward * 1.2, r.x + 0.5, r.y + inward * 2.2, 0.14, YD, WHITE);
        }
      }
      // ball trail
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const q = this.trail[i]; q.a -= dt * 3.5;
        if (q.a <= 0) this.trail.splice(i, 1); else C.disc(q.x, q.y, 0.2 * q.a + 0.06, YD, WHITE, 8);
      }
      // controlled players: ring + arrow
      const seen = [false, false, false, false];
      for (let i = 0; i < view.players.length; i++) {
        const p = view.players[i];
        if (p.ctrl === undefined || p.ctrl < 0) continue;
        const si = p.ctrl % 4, c = SLOT_COL[si];
        seen[si] = true;
        A.ring(p.x, p.y, 1.05 + Math.sin(t * 6) * 0.05, 0.17, YD, c, 0, Math.PI * 2, 28);
        const ar = this.arrows[si]; ar.visible = true;
        ar.position.set(p.x, 3.05 + Math.sin(t * 7) * 0.16, p.y); ar.rotation.y = t * 2;
      }
      for (let s = 0; s < 4; s++) if (!seen[s]) this.arrows[s].visible = false;
      // aim guides for human players (same logic as the 2D renderer)
      if (m && m.slots) this.drawAim3(A, m);
      A.end(); Bb.end(); C.end();
    }

    drawAim3(A, m) {
      const t = this.t, YD = 0.045;
      m.slots.forEach((s) => {
        const p = s.player; if (!p) return;
        const c = SLOT_COL[s.i % 4], inp = s.input, hasBall = m.ball.owner === p, rst = m.restart;
        const taking = m.mode === 'restart' && rst && rst.taker === p && rst.phase === 'ready';
        if (taking || (m.mode === 'shootout' && m.shootout && m.shootout.shooter === p)) {
          const aim = (rst && rst.aim) || (inp ? { x: inp.dx, y: inp.dy } : null);
          let ax = aim ? aim.x : p.team.dir, ay = aim ? aim.y : 0;
          if (Math.abs(ax) + Math.abs(ay) < 0.2) { ax = p.team.dir; ay = 0; }
          const [nx, ny] = U.norm(ax, ay);
          A.dashed(p.x, p.y, p.x + nx * 12, p.y + ny * 12, 0.2, 0.6, 0.5, YD, c);
          if (rst && rst.type !== 'penalty' && m.mode === 'restart') {
            const hasAim = aim && Math.abs(aim.x) + Math.abs(aim.y) > 0.2;
            const tg = hasAim ? m.pickTarget(p, ax, ay, rst.type === 'goalkick' || rst.type === 'corner' ? 'lob' : 'pass') : null;
            if (tg) A.ring(tg.x, tg.y, 1.1 + Math.sin(t * 8) * 0.12, 0.16, YD, c, 0, Math.PI * 2, 26);
            if (rst.type === 'freekick' && rst.wall && rst.wall.length) {
              const gx = p.team.goalX, f = Math.abs(gx - p.x);
              if (nx * (gx - p.x) > 0.05) {
                const yHit = p.y + ny * ((gx - p.x) / nx), off = yHit - P.cy;
                if (Math.abs(off) > 0.8) {
                  const sg = Math.sign(off); let lx = p.x, ly = p.y;
                  for (let i = 1; i <= 12; i++) { const q = i / 12, px = p.x + (gx - p.x) * q, py = p.y + (yHit - p.y) * q + sg * Math.sin(q * Math.PI) * Math.min(4, f * 0.09); if (i % 2) A.seg(lx, ly, px, py, 0.14, YD, c); lx = px; ly = py; }
                }
              }
            }
          }
        }
        if (hasBall && inp && (Math.abs(inp.dx) + Math.abs(inp.dy)) > 0.2 && m.mode === 'play') {
          const tg = m.pickTarget(p, inp.dx, inp.dy, 'pass');
          if (tg) A.ring(tg.x, tg.y, 1.0 + Math.sin(t * 8) * 0.1, 0.13, YD, c, 0, Math.PI * 2, 24);
        }
      });
    }

    // ------------------------------------------------------------ weather + confetti
    celebrate(x, y, c1, c2) {
      if (!this.particles) { this.roar = 1; this.flash = 0.8; return; }
      if (this.mode3d && this.confP) {
        const cols = [col(c1), col(c2), col('#ffffff'), col('#ffd24d')], cs = this.confPts.geometry.attributes.color;
        for (let i = 0; i < this.confN; i++) {
          const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 7, o = i * 6;
          this.confP[o] = x + (Math.random() - 0.5) * 6; this.confP[o + 1] = 1 + Math.random() * 2.5; this.confP[o + 2] = y + (Math.random() - 0.5) * 8;
          const inward = x < L / 2 ? 1 : -1;
          this.confP[o + 3] = Math.cos(a) * sp * 0.5 + inward * (1 + Math.random() * 6); this.confP[o + 4] = 6 + Math.random() * 11; this.confP[o + 5] = Math.sin(a) * sp * 0.7;
          this.confL[i] = 1.8 + Math.random() * 2.2;
          const c = cols[i % 4]; cs.setXYZ(i, c.r, c.g, c.b);
        }
        cs.needsUpdate = true;
      }
      this.roar = 1; this.flash = 0.8;
    }

    updateParticles(view, dt) {
      const cx = this.cam.x, cz = this.cam.y, t = this.t, m = this.m;
      // confetti
      if (this.confP) {
        const pos = this.confPts.geometry.attributes.position, P6 = this.confP;
        let any = false;
        for (let i = 0; i < this.confN; i++) {
          const o = i * 6;
          if (this.confL[i] > 0) {
            this.confL[i] -= dt; any = true;
            P6[o + 3] *= 1 - dt * 0.9; P6[o + 5] *= 1 - dt * 0.9; P6[o + 4] -= 9 * dt * 0.8;
            P6[o] += P6[o + 3] * dt; P6[o + 1] += P6[o + 4] * dt; P6[o + 2] += P6[o + 5] * dt;
            if (P6[o + 1] < 0.05) { P6[o + 1] = 0.05; P6[o + 3] = P6[o + 4] = P6[o + 5] = 0; }
            pos.setXYZ(i, P6[o], P6[o + 1], P6[o + 2]);
            if (this.confL[i] <= 0) pos.setY(i, -50);
          }
        }
        if (any) pos.needsUpdate = true;
      }
      if (this.rainLines && dt > 0) {
        const N = this.rainN, rp = this.rainP, pa = this.rainLines.geometry.attributes.position.array, wnd = m.wind || { x: 0, y: 0 };
        const vx = wnd.x * 1.6 + 2.5, vz = wnd.y * 1.6, vy = -27;
        for (let i = 0; i < N; i++) {
          let x = rp[i * 3] + vx * dt, y = rp[i * 3 + 1] + vy * dt, z = rp[i * 3 + 2] + vz * dt;
          if (y < 0) { y += 26; x = Math.random() * 120 - 60 + (cx - 0); z = Math.random() * 100 - 50 + cz; }
          // keep the volume centred on the focus
          if (x - cx > 60) x -= 120; else if (x - cx < -60) x += 120;
          if (z - cz > 50) z -= 100; else if (z - cz < -50) z += 100;
          rp[i * 3] = x; rp[i * 3 + 1] = y; rp[i * 3 + 2] = z;
          const o = i * 6;
          pa[o] = x; pa[o + 1] = y; pa[o + 2] = z; pa[o + 3] = x - vx * 0.03; pa[o + 4] = y + 0.85; pa[o + 5] = z - vz * 0.03;
        }
        this.rainLines.geometry.attributes.position.needsUpdate = true;
        if (m.weather === 'storm' && Math.random() < dt * 0.12) this.flash = 0.35;
      }
      if (this.snowPts && dt > 0) {
        const N = this.snowN, sp = this.snowP, pa = this.snowPts.geometry.attributes.position.array, wnd = m.wind || { x: 0, y: 0 };
        for (let i = 0; i < N; i++) {
          let x = sp[i * 4] + (Math.sin(t * 0.9 + sp[i * 4 + 3]) * 0.7 + wnd.x * 0.6) * dt, y = sp[i * 4 + 1] - (1.5 + (sp[i * 4 + 3] % 1.2)) * dt, z = sp[i * 4 + 2] + (Math.cos(t * 0.7 + sp[i * 4 + 3]) * 0.6 + wnd.y * 0.6) * dt;
          if (y < 0) y += 26;
          if (x - cx > 60) x -= 120; else if (x - cx < -60) x += 120;
          if (z - cz > 50) z -= 100; else if (z - cz < -50) z += 100;
          sp[i * 4] = x; sp[i * 4 + 1] = y; sp[i * 4 + 2] = z;
          pa[i * 3] = x; pa[i * 3 + 1] = y; pa[i * 3 + 2] = z;
        }
        this.snowPts.geometry.attributes.position.needsUpdate = true;
      }
    }

    // ------------------------------------------------------------ overlay (2D canvas on top): radar, names, charge bars, flash
    proj(x, h, z) {
      const v = this._pv || (this._pv = new THREE.Vector3());
      v.set(x, h, z).project(this.camera);
      this.px = (v.x * 0.5 + 0.5) * this.w3; this.py = (-v.y * 0.5 + 0.5) * this.h3;
      return v.z < 1 && v.z > -1;
    }

    drawOverlay(view, dt, opts) {
      const g = this.ovx, w = this.w3, h = this.h3;
      g.clearRect(0, 0, w, h);
      const m = opts.match;
      // names + charge bars for human-controlled players
      view.players.forEach((p) => {
        if (p.ctrl === undefined || p.ctrl < 0) return;
        if (!this.proj(p.x, 0, p.y)) return;
        const sx = this.px, sy = this.py;
        this.proj(p.x, 2.2, p.y); const hpx = Math.abs(this.py - sy);
        if (hpx < 22) return;
        g.save();
        const fs = Math.round(clamp(hpx * 0.2, 10, 15));
        g.font = '600 ' + fs + 'px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
        const tw = g.measureText(p.sname).width + 10, th = fs + 6;
        g.fillStyle = 'rgba(8,12,22,0.72)'; g.fillRect(sx - tw / 2, sy + 4, tw, th);
        g.fillStyle = SLOT_COLORS[p.ctrl % 4]; g.fillText(p.sname, sx, sy + 7);
        g.restore();
        if (m && m.slots) {
          const s = m.slots.find((q) => q.player === p);
          if (s && s.charge > 0.02 && (m.ball.owner === p || (m.mode === 'restart' && m.restart && m.restart.taker === p) || m.mode === 'shootout')) {
            const bw = clamp(hpx * 0.9, 34, 70), bh = 7, by = sy + 8 + th;
            g.fillStyle = 'rgba(8,12,22,0.78)'; g.fillRect(sx - bw / 2, by, bw, bh);
            g.fillStyle = s.charge > 0.85 ? '#ff4d6d' : s.chargeKind === 3 ? '#ffd24d' : SLOT_COLORS[s.i % 4];
            g.fillRect(sx - bw / 2 + 1, by + 1, (bw - 2) * s.charge, bh - 2);
          }
        }
      });
      if (opts.radar) this.drawRadar3(g, view, opts);
      if (this.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.35) + ')'; g.fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - dt * 2.2); }
    }

    drawRadar3(g, view, opts) {
      const rw = Math.min(170, this.w3 * 0.24), rh = rw * (W / L);
      const x0 = 12, y0 = this.h3 - rh - 12 - (opts.radarLift || 0);
      g.save();
      g.globalAlpha = 0.86;
      g.fillStyle = 'rgba(8,12,22,0.78)'; this.rr(g, x0 - 4, y0 - 4, rw + 8, rh + 8, 6); g.fill();
      g.fillStyle = 'rgba(30,110,60,0.55)'; g.fillRect(x0, y0, rw, rh);
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.strokeRect(x0, y0, rw, rh);
      g.beginPath(); g.moveTo(x0 + rw / 2, y0); g.lineTo(x0 + rw / 2, y0 + rh); g.stroke();
      const sx = rw / L, sy = rh / W;
      // camera footprint on the ground
      const cm = this.camera, v = this._rv || (this._rv = new THREE.Vector3()), cp = cm.position;
      g.save(); g.beginPath(); g.rect(x0, y0, rw, rh); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach((c, i) => {
        v.set(c[0], c[1], 0.5).unproject(cm).sub(cp);
        let tt = v.y < -0.02 ? -cp.y / v.y : 400; if (tt > 400) tt = 400;
        const gx = cp.x + v.x * tt, gz = cp.z + v.z * tt;
        if (i === 0) g.moveTo(x0 + gx * sx, y0 + gz * sy); else g.lineTo(x0 + gx * sx, y0 + gz * sy);
      });
      g.closePath(); g.stroke(); g.restore();
      view.players.forEach((p) => {
        g.fillStyle = p.team.kit.shirt;
        g.strokeStyle = p.ctrl >= 0 ? SLOT_COLORS[p.ctrl % 4] : 'rgba(0,0,0,0.8)'; g.lineWidth = p.ctrl >= 0 ? 2 : 1;
        g.beginPath(); g.arc(x0 + clamp(p.x, 0, L) * sx, y0 + clamp(p.y, 0, W) * sy, p.ctrl >= 0 ? 3.4 : 2.6, 0, 7); g.fill(); g.stroke();
      });
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x0 + clamp(view.ball.x, 0, L) * sx, y0 + clamp(view.ball.y, 0, W) * sy, 2.2, 0, 7); g.fill();
      g.restore();
    }

    // ------------------------------------------------------------ diagnostics
    info3d() {
      const i = this.gl ? this.gl.info : null;
      return i ? { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, frameMs: Math.round(this.frameMs * 10) / 10, resScale: this.resScale, gpu: this.gpu, q: this.q, cam: this.effMode, mode3d: this.mode3d } : null;
    }
  }

  // settings widgets used by the settings screen and the in-match quick menu (one line each in ui.js / matchui.js)
  FCK.view3dFields = (apply) => {
    const UI = FCK.UI, h = FCK.h, S = FCK.settings;
    if (!UI || !h || !S) return null;
    const r = FCK.game && FCK.game.r;
    const ok = !!(r && r.available && r.available());
    const chips = (key, def, list, lab) => UI.chips(list.map((v) => ({ v, l: T(lab + v) })), list.includes(S[key]) ? S[key] : def, (v) => { S[key] = v; apply(); });
    const out = [h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.gfx3d') }), UI.chips([{ v: '3d', l: T('gfx3d.3d') }, { v: '2d', l: T('gfx3d.2d') }], S.gfx3d === '2d' ? '2d' : '3d', (v) => { S.gfx3d = v; apply(); }))];
    if (!ok) { out.push(h('p', { class: 'fine', text: T('gfx3d.unavailable') })); return out; }
    out.push(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.cam3d') }), chips('cam3d', 'tv', CAMS, 'cam3d.')));
    out.push(h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.q3d') }), chips('q3d', 'mid', QUALS, 'q3d.')));
    out.push(h('p', { class: 'fine', text: T('cam3d.keys') }));
    return out;
  };
  FCK.rotInput = (inp) => { const r = FCK.game && FCK.game.r; if (r && r.mode3d && r.inputRot) r.inputRot(inp); };
  FCK.Renderer3D = Renderer3D;
  // standalone player model for other 3D scenes (Ultimate Team pack opening): p = { look, num, isGK, sname }, kit as in a match
  FCK.R3D_makePlayer = function (p, kit) {
    const r = { matPlayer: new THREE.MeshLambertMaterial({ vertexColors: true, map: texAtlas(), alphaTest: 0.5, skinning: true }) };
    const M = new PlayerModel(r, { x: 0, y: 0, ang: 0, num: p.num || 9, isGK: !!p.isGK, sname: p.sname || 'x', look: p.look }, kit, false);
    M.dispose2 = () => { M.dispose(); r.matPlayer.dispose(); };
    return M;
  };
  FCK.R3D_B = B;
  FCK.R3D_ball = () => new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshLambertMaterial({ map: texBall() }));
})((globalThis.FCK = globalThis.FCK || {}));
