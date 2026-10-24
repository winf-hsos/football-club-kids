/* FCK: Football Club Kids - util.js : math, RNG, storage */
(function (FCK) {
  'use strict';

  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.len = (x, y) => Math.sqrt(x * x + y * y);
  U.dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  U.dist2 = (ax, ay, bx, by) => Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
  U.norm = (x, y) => {
    const l = Math.sqrt(x * x + y * y);
    return l < 1e-9 ? [0, 0] : [x / l, y / l];
  };
  U.angDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.fmtClock = (sec) => {
    const m = Math.floor(sec / 60);
    return m + ':' + String(Math.floor(sec % 60)).padStart(2, '0');
  };
  // distance from point to segment
  U.segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 < 1e-9 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cy = ay + dy * t;
    return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
  };

  // Seeded RNG (mulberry32)
  U.makeRng = function (seed) {
    let a = (seed >>> 0) || 123456789;
    const r = {};
    r.next = function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (lo, hi) => lo + (hi - lo) * r.next();
    r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r.next());
    r.chance = (p) => r.next() < p;
    r.pick = (arr) => arr[Math.floor(r.next() * arr.length)];
    r.gauss = () => {
      let u = 0, v = 0;
      while (u === 0) u = r.next();
      while (v === 0) v = r.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    r.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    r.seed = seed;
    return r;
  };

  // Safe storage (localStorage may be missing or throw)
  const mem = {};
  U.store = {
    get(key, def) {
      try {
        const v = window.localStorage.getItem('fck.' + key);
        if (v === null || v === undefined) return key in mem ? mem[key] : def;
        return JSON.parse(v);
      } catch (e) {
        return key in mem ? mem[key] : def;
      }
    },
    set(key, val) {
      mem[key] = val;
      try {
        window.localStorage.setItem('fck.' + key, JSON.stringify(val));
        return true;
      } catch (e) {
        return false;
      }
    },
    del(key) {
      delete mem[key];
      try { window.localStorage.removeItem('fck.' + key); } catch (e) { /* ignore */ }
    },
  };

  // Pitch constants (meters)
  FCK.PITCH = {
    L: 105, W: 68, goalW: 7.32, goalH: 2.44, goalDepth: 2.4,
    boxD: 16.5, boxW: 40.32, sixD: 5.5, sixW: 18.32, penSpot: 11, circleR: 9.15,
    cy: 34,
  };

  FCK.U = U;
})((globalThis.FCK = globalThis.FCK || {}));
