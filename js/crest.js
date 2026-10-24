/* FCK - crest.js : generated crests, kits, shirts (all own artwork, no club logos) */
(function (FCK) {
  'use strict';

  function rgb(h) {
    const s = h.replace('#', '');
    const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  function cdist(a, b) {
    const x = rgb(a), y = rgb(b);
    const rm = (x[0] + y[0]) / 2;
    const dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2];
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    const c = (i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, '0');
    return '#' + c(0) + c(1) + c(2);
  }
  function lum(h) { const x = rgb(h); return (0.299 * x[0] + 0.587 * x[1] + 0.114 * x[2]) / 255; }
  FCK.color = { rgb, cdist, mix, lum };

  const THIRD = ['#12182b', '#f5f5f5', '#ffd400', '#16b36a', '#ff6b00', '#7a3df0'];
  const GKS = ['#2fd05a', '#ff7a1a', '#7a3df0', '#1ec6d4', '#e8e8e8', '#111111', '#d94bd0', '#ffd400'];

  function homeKit(club) {
    const c = club.colors;
    let shorts = c.t;
    if (cdist(shorts, c.p) < 90) shorts = c.s;
    if (cdist(shorts, c.p) < 90) shorts = lum(c.p) > 0.55 ? '#1b1f2e' : '#f4f4f4';
    return { shirt: c.p, shirt2: c.s, trim: c.t, shorts, socks: shorts, pattern: club.kit || 'solid', name: 'home' };
  }
  function awayKit(club) {
    const c = club.colors;
    let shirt = c.s;
    if (cdist(shirt, c.p) < 120) shirt = lum(c.p) > 0.5 ? '#14213d' : '#f4f4f4';
    const shorts = lum(shirt) > 0.5 ? '#14213d' : '#f4f4f4';
    return { shirt, shirt2: c.p, trim: c.t, shorts, socks: shirt, pattern: 'solid', name: 'away' };
  }

  FCK.makeKits = function (a, b) {
    const ka = homeKit(a);
    let kb = homeKit(b);
    if (cdist(ka.shirt, kb.shirt) < 130) {
      kb = awayKit(b);
      if (cdist(ka.shirt, kb.shirt) < 130) {
        let best = THIRD[0], bd = -1;
        THIRD.forEach((c) => { const d = Math.min(cdist(c, ka.shirt), cdist(c, b.colors.p)); if (d > bd) { bd = d; best = c; } });
        kb = { shirt: best, shirt2: b.colors.p, trim: b.colors.t, shorts: lum(best) > 0.5 ? '#14213d' : '#f4f4f4', socks: best, pattern: 'solid', name: 'third' };
      }
    }
    [ka, kb].forEach((k, i) => {
      let best = GKS[0], bd = -1;
      GKS.forEach((c) => { const d = Math.min(cdist(c, ka.shirt), cdist(c, kb.shirt)); if (d > bd) { bd = d; best = c; } });
      k.gk = best;
      k.gkShorts = lum(best) > 0.6 ? '#1b1f2e' : '#1b1f2e';
    });
    return [ka, kb];
  };

  // ---------- drawing helpers ----------
  function star(ctx, cx, cy, r, pts) {
    ctx.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const a = (-Math.PI / 2) + (i * Math.PI) / pts;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function crestPath(ctx, shape, x, y, s) {
    const r = s / 2;
    ctx.beginPath();
    if (shape === 'shield') {
      ctx.moveTo(x - r * 0.88, y - r * 0.92);
      ctx.lineTo(x + r * 0.88, y - r * 0.92);
      ctx.lineTo(x + r * 0.88, y + r * 0.12);
      ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.7, x, y + r * 1.02);
      ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.7, x - r * 0.88, y + r * 0.12);
      ctx.closePath();
    } else if (shape === 'diamond') {
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.85, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.85, y); ctx.closePath();
    } else {
      ctx.arc(x, y, r * 0.95, 0, Math.PI * 2);
    }
  }

  function emblem(ctx, kind, x, y, s, col) {
    const r = s * 0.2;
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * 0.04);
    if (kind === 'star') { star(ctx, x, y + r * 0.1, r * 1.25, 5); ctx.fill(); }
    else if (kind === 'ball') {
      ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      star(ctx, x, y, r * 0.55, 5); ctx.fill();
    } else if (kind === 'crown') {
      ctx.beginPath();
      ctx.moveTo(x - r * 1.2, y + r * 0.8); ctx.lineTo(x - r * 1.2, y - r * 0.5); ctx.lineTo(x - r * 0.5, y + r * 0.1);
      ctx.lineTo(x, y - r * 0.9); ctx.lineTo(x + r * 0.5, y + r * 0.1); ctx.lineTo(x + r * 1.2, y - r * 0.5);
      ctx.lineTo(x + r * 1.2, y + r * 0.8); ctx.closePath(); ctx.fill();
    } else if (kind === 'bolt') {
      ctx.beginPath();
      ctx.moveTo(x + r * 0.5, y - r * 1.3); ctx.lineTo(x - r * 0.8, y + r * 0.2); ctx.lineTo(x - r * 0.05, y + r * 0.2);
      ctx.lineTo(x - r * 0.5, y + r * 1.3); ctx.lineTo(x + r * 0.9, y - r * 0.3); ctx.lineTo(x + r * 0.1, y - r * 0.3); ctx.closePath(); ctx.fill();
    } else if (kind === 'ring') {
      ctx.beginPath(); ctx.arc(x, y, r * 1.0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'tower') {
      ctx.fillRect(x - r * 0.7, y - r * 0.4, r * 1.4, r * 1.5);
      for (let i = 0; i < 3; i++) ctx.fillRect(x - r * 0.7 + i * r * 0.6, y - r * 0.95, r * 0.4, r * 0.55);
    } else if (kind === 'leaf') {
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i - 1) * 1.15; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.5 + r * 0.2, r * 0.6, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillRect(x - r * 0.12, y + r * 0.3, r * 0.24, r * 0.9);
    }
  }

  // club crest into ctx, centered at x,y, bounding size s
  FCK.drawCrest = function (ctx, club, x, y, s) {
    const c = club.colors, cr = club.crest || { shape: 'round', pattern: 'plain', emblem: 'star' };
    ctx.save();
    crestPath(ctx, cr.shape, x, y, s);
    ctx.fillStyle = c.p; ctx.fill();
    ctx.save();
    crestPath(ctx, cr.shape, x, y, s); ctx.clip();
    const r = s / 2;
    if (cr.pattern === 'halves') { ctx.fillStyle = c.s; ctx.fillRect(x, y - r, r, s); }
    else if (cr.pattern === 'stripesV') { ctx.fillStyle = c.s; for (let i = 0; i < 5; i += 2) ctx.fillRect(x - r + (i * s) / 5, y - r, s / 5, s); }
    else if (cr.pattern === 'chevron') { ctx.fillStyle = c.s; ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.1); ctx.lineTo(x, y - r * 0.8); ctx.lineTo(x + r, y - r * 0.1); ctx.lineTo(x + r, y + r * 0.35); ctx.lineTo(x, y - r * 0.35); ctx.lineTo(x - r, y + r * 0.35); ctx.closePath(); ctx.fill(); }
    else if (cr.pattern === 'bend') { ctx.fillStyle = c.s; ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.5); ctx.lineTo(x - r * 0.3, y - r); ctx.lineTo(x + r, y + r * 0.5); ctx.lineTo(x + r * 0.3, y + r); ctx.lineTo(x - r, y - r * 0.2); ctx.closePath(); ctx.fill(); }
    else if (cr.pattern === 'cross') { ctx.fillStyle = c.s; ctx.fillRect(x - r * 0.14, y - r, r * 0.28, s); ctx.fillRect(x - r, y - r * 0.14, s, r * 0.28); }
    ctx.restore();
    // emblem with contrast color
    const ec = FCK.color.lum(cr.pattern === 'halves' || cr.pattern === 'plain' ? c.p : c.s) > 0.55 ? '#14213d' : '#ffffff';
    const eFill = cr.pattern === 'plain' ? (FCK.color.lum(c.p) > 0.55 ? c.t : c.s) : ec;
    emblem(ctx, cr.emblem, x, y + s * 0.02, s, FCK.color.cdist(eFill, c.p) < 60 ? ec : eFill);
    crestPath(ctx, cr.shape, x, y, s);
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.strokeStyle = FCK.color.lum(c.t) < 0.3 || FCK.color.cdist(c.t, c.p) < 60 ? 'rgba(10,14,26,0.85)' : c.t;
    ctx.stroke();
    ctx.restore();
  };

  // T-shirt preview centered at x,y; size s = width
  FCK.drawShirt = function (ctx, kit, x, y, s) {
    const u = s / 100;
    const X = (v) => x + (v - 50) * u, Y = (v) => y + (v - 52) * u;
    ctx.save();
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(X(36), Y(8)); ctx.quadraticCurveTo(X(50), Y(18), X(64), Y(8));
      ctx.lineTo(X(84), Y(18)); ctx.lineTo(X(98), Y(42)); ctx.lineTo(X(82), Y(50)); ctx.lineTo(X(74), Y(40));
      ctx.lineTo(X(74), Y(96)); ctx.lineTo(X(26), Y(96)); ctx.lineTo(X(26), Y(40)); ctx.lineTo(X(18), Y(50));
      ctx.lineTo(X(2), Y(42)); ctx.lineTo(X(16), Y(18)); ctx.closePath();
    };
    path(); ctx.fillStyle = kit.shirt; ctx.fill();
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = kit.shirt2;
    if (kit.pattern === 'stripesV') for (let i = 0; i < 7; i += 2) ctx.fillRect(X(2 + i * 14), Y(0), 14 * u, 100 * u);
    else if (kit.pattern === 'hoops') for (let i = 0; i < 6; i += 2) ctx.fillRect(X(0), Y(12 + i * 14), 100 * u, 14 * u);
    else if (kit.pattern === 'halves') ctx.fillRect(X(50), Y(0), 50 * u, 100 * u);
    else if (kit.pattern === 'sleeves') { ctx.fillRect(X(0), Y(0), 26 * u, 60 * u); ctx.fillRect(X(74), Y(0), 26 * u, 60 * u); }
    else if (kit.pattern === 'band') ctx.fillRect(X(0), Y(44), 100 * u, 16 * u);
    else if (kit.pattern === 'sash') { ctx.beginPath(); ctx.moveTo(X(16), Y(18)); ctx.lineTo(X(36), Y(8)); ctx.lineTo(X(84), Y(96)); ctx.lineTo(X(60), Y(96)); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    path(); ctx.lineWidth = Math.max(1, u * 1.6); ctx.strokeStyle = 'rgba(10,14,26,0.6)'; ctx.stroke();
    // collar
    ctx.beginPath(); ctx.moveTo(X(36), Y(8)); ctx.quadraticCurveTo(X(50), Y(18), X(64), Y(8));
    ctx.lineWidth = Math.max(1.4, u * 3); ctx.strokeStyle = kit.trim; ctx.stroke();
    ctx.restore();
  };

  // cached small canvases (browser only)
  const cache = {};
  FCK.crestCanvas = function (club, size) {
    if (typeof document === 'undefined') return null;
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const cr0 = club.crest || {}; const key = club.id + ':' + size + ':' + dpr + ':' + club.colors.p + club.colors.s + club.colors.t + (cr0.shape || '') + (cr0.pattern || '') + (cr0.emblem || '') + (club.short || '');
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    FCK.drawCrest(ctx, club, size / 2, size / 2, size * 0.92);
    cache[key] = c;
    return c;
  };
  FCK.crestDataUrl = function (club, size) {
    const c = FCK.crestCanvas(club, size);
    return c ? c.toDataURL() : '';
  };
  FCK.kitDataUrl = function (kit, size) {
    if (typeof document === 'undefined') return '';
    const c = document.createElement('canvas');
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    c.width = c.height = Math.ceil(size * dpr);
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    FCK.drawShirt(ctx, kit, size / 2, size / 2, size * 0.9);
    return c.toDataURL();
  };
})((globalThis.FCK = globalThis.FCK || {}));
