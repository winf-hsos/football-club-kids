/* FCK - face.js : face designer data and a front-view portrait renderer (look = { skin, hair, hairStyle, beard, beardStyle, beardCol, f: { shape, eye, brows, nose, mouth, freckles, band } }).
   Every new field is optional, so looks of generated players and old saves keep working (Face.norm fills the defaults). */
(function (FCK) {
  'use strict';
  const Face = {};
  FCK.Face = Face;

  Face.SKIN = ['#fbe0cf', '#f6d5bd', '#eac0a0', '#e0b08c', '#d6a57e', '#c8956c', '#b9855d', '#a5714b', '#8f5e3d', '#7a4d31', '#6a4228', '#583522', '#4a2c1b', '#3a2316'];
  Face.HAIR = ['#0d0a08', '#1c1410', '#2e2018', '#4a3322', '#6b4a2f', '#8a5a2b', '#a8793f', '#c9a05a', '#d9b36a', '#ecd9a0', '#c0562b', '#9a9a9a', '#e8e8e8', '#2a4fb0', '#c02a7a', '#2a9a5a'];
  Face.EYES = ['#3b2a1a', '#6b4a2f', '#2f6fb5', '#3a8a5a', '#6a8f3a', '#7a7f86'];
  Face.HAIR_STYLES = ['short', 'buzz', 'fade', 'sidepart', 'quiff', 'undercut', 'curtains', 'long', 'ponytail', 'bun', 'curly', 'afro', 'braids', 'mohawk', 'bald'];
  Face.BEARDS = ['none', 'stubble', 'full', 'goatee', 'mustache'];
  Face.SHAPES = ['round', 'oval', 'square'];
  Face.BROWS = ['thin', 'normal', 'thick'];
  Face.NOSES = ['small', 'medium', 'big'];
  Face.MOUTHS = ['smile', 'neutral', 'grin'];
  Face.BANDS = ['#ffffff', '#d4162a', '#1565c0', '#111111', '#ffd800', '#2e7d32'];

  Face.norm = function (look) {
    const l = Object.assign({ skin: Face.SKIN[2], hair: Face.HAIR[2], hairStyle: 'short', beard: false }, look || {});
    const f = Object.assign({ shape: 'oval', eye: Face.EYES[0], brows: 'normal', nose: 'medium', mouth: 'smile', freckles: false, band: null }, l.f || {});
    l.f = f;
    l.beardStyle = l.beard ? (l.beardStyle && l.beardStyle !== 'none' ? l.beardStyle : 'full') : 'none';
    l.beard = l.beardStyle !== 'none';
    l.beardCol = l.beardCol || l.hair;
    return l;
  };
  Face.random = function (rng, kids) {
    const pick = (a) => a[rng.int(0, a.length - 1)];
    const hairs = kids ? Face.HAIR.slice(0, 13) : Face.HAIR;
    return Face.norm({
      skin: pick(Face.SKIN), hair: pick(hairs.slice(0, 12)), hairStyle: pick(Face.HAIR_STYLES), beard: !kids && rng.chance(0.25), beardStyle: pick(Face.BEARDS.slice(1)),
      f: { shape: pick(Face.SHAPES), eye: pick(Face.EYES), brows: pick(Face.BROWS), nose: pick(Face.NOSES), mouth: pick(Face.MOUTHS), freckles: rng.chance(0.15), band: rng.chance(0.12) ? pick(Face.BANDS) : null },
    });
  };

  const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(c)); const n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; };
  const lum = (c) => { const [r, g, b] = hex(c); return (r * 0.299 + g * 0.587 + b * 0.114) / 255; };

  // draws into a 100 x 120 box scaled to the canvas size
  Face.draw = function (ctx, look, size) {
    const l = Face.norm(look), f = l.f, s = size / 100;
    ctx.save(); ctx.scale(s, s);
    const skin = l.skin, dark = shade(skin, 0.82), hair = l.hair, hdark = shade(hair, 0.7);
    const rx = f.shape === 'round' ? 31 : f.shape === 'square' ? 30 : 28, ry = f.shape === 'round' ? 31 : f.shape === 'square' ? 32 : 37, cx = 50, cy = 54;
    const headPath = () => {
      ctx.beginPath();
      if (f.shape === 'square') { const x = cx - rx, y = cy - ry, w = rx * 2, h = ry * 2, r = 13; ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r + 6); ctx.arcTo(x, y + h, x, y, r + 6); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); } else ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    };
    const top = cy - ry; // top of the head
    // --- hair behind the head
    ctx.fillStyle = hair;
    const st = l.hairStyle;
    if (st === 'long') { ctx.beginPath(); ctx.moveTo(cx - rx - 5, top + 14); ctx.quadraticCurveTo(cx - rx - 8, 112, cx - rx + 4, 112); ctx.lineTo(cx + rx - 4, 112); ctx.quadraticCurveTo(cx + rx + 8, 112, cx + rx + 5, top + 14); ctx.quadraticCurveTo(cx, top - 14, cx - rx - 5, top + 14); ctx.fill(); }
    if (st === 'afro') { ctx.beginPath(); ctx.ellipse(cx, top + 14, rx + 11, ry * 0.78, 0, 0, Math.PI * 2); ctx.fill(); }
    if (st === 'ponytail') { ctx.beginPath(); ctx.ellipse(cx + rx + 6, cy + 10, 6, 17, 0.25, 0, Math.PI * 2); ctx.fill(); }
    if (st === 'bun') { ctx.beginPath(); ctx.arc(cx, top - 4, 10, 0, Math.PI * 2); ctx.fill(); }
    // --- neck + shoulders
    ctx.fillStyle = dark; ctx.fillRect(cx - 11, cy + ry - 8, 22, 22);
    ctx.fillStyle = '#2a3347'; ctx.beginPath(); ctx.moveTo(8, 122); ctx.quadraticCurveTo(10, cy + ry + 6, cx - 12, cy + ry + 8); ctx.lineTo(cx + 12, cy + ry + 8); ctx.quadraticCurveTo(90, cy + ry + 6, 92, 122); ctx.closePath(); ctx.fill();
    // --- ears + head
    ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(cx - rx - 1, cy + 3, 4.5, 7, 0, 0, Math.PI * 2); ctx.ellipse(cx + rx + 1, cy + 3, 4.5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skin; headPath(); ctx.fill();
    const g = ctx.createRadialGradient(cx - 8, cy - 14, 4, cx, cy, ry + 6); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,.14)');
    ctx.fillStyle = g; headPath(); ctx.fill();
    // --- freckles, cheeks
    if (f.freckles) { ctx.fillStyle = shade(skin, 0.72); [[-14, 8], [-10, 11], [-17, 12], [-7, 7], [14, 8], [10, 11], [17, 12], [7, 7]].forEach((p) => { ctx.beginPath(); ctx.arc(cx + p[0], cy + p[1], 0.9, 0, Math.PI * 2); ctx.fill(); }); }
    // --- eyes
    const ey = cy - 3, ex = 12;
    [-1, 1].forEach((d) => {
      ctx.fillStyle = '#fbfbfb'; ctx.beginPath(); ctx.ellipse(cx + d * ex, ey, 5.4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = f.eye; ctx.beginPath(); ctx.arc(cx + d * ex, ey, 2.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10131a'; ctx.beginPath(); ctx.arc(cx + d * ex, ey, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(cx + d * ex + 1, ey - 1, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.ellipse(cx + d * ex, ey, 5.4, 3.5, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      // brows
      ctx.strokeStyle = hdark; ctx.lineCap = 'round'; ctx.lineWidth = f.brows === 'thick' ? 3.2 : f.brows === 'thin' ? 1.2 : 2.1;
      ctx.beginPath(); ctx.moveTo(cx + d * (ex - 6), ey - 8 + (d < 0 ? 0.8 : 0.8)); ctx.quadraticCurveTo(cx + d * ex, ey - 11.5, cx + d * (ex + 6), ey - 8); ctx.stroke();
    });
    // --- nose
    ctx.strokeStyle = shade(skin, 0.7); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    const nw = f.nose === 'big' ? 6 : f.nose === 'small' ? 3.2 : 4.4, nl = f.nose === 'big' ? 13 : f.nose === 'small' ? 8 : 10.5;
    ctx.beginPath(); ctx.moveTo(cx, cy - 2); ctx.lineTo(cx - 1, cy - 2 + nl); ctx.moveTo(cx - nw, cy + nl - 1.5); ctx.quadraticCurveTo(cx, cy + nl + 2.5, cx + nw, cy + nl - 1.5); ctx.stroke();
    // --- beard (behind mouth)
    const my = cy + 21;
    const bc = l.beardCol, bs = l.beardStyle;
    if (bs !== 'none') {
      ctx.fillStyle = bc;
      if (bs === 'stubble') { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(cx, cy + 14, rx - 1, ry - 14, 0, 0.12, Math.PI - 0.12); ctx.fill(); ctx.globalAlpha = 1; }
      if (bs === 'full') { ctx.beginPath(); ctx.moveTo(cx - rx + 1, cy + 4); ctx.quadraticCurveTo(cx - rx - 1, cy + ry + 3, cx, cy + ry + 3); ctx.quadraticCurveTo(cx + rx + 1, cy + ry + 3, cx + rx - 1, cy + 4); ctx.quadraticCurveTo(cx + 14, cy + 12, cx, cy + 12); ctx.quadraticCurveTo(cx - 14, cy + 12, cx - rx + 1, cy + 4); ctx.fill(); }
      if (bs === 'goatee') { ctx.beginPath(); ctx.ellipse(cx, cy + ry - 8, 8, 8, 0, 0, Math.PI * 2); ctx.fill(); }
      if (bs === 'goatee' || bs === 'mustache') { ctx.beginPath(); ctx.moveTo(cx - 11, my - 5); ctx.quadraticCurveTo(cx, my - 9, cx + 11, my - 5); ctx.quadraticCurveTo(cx, my - 1.5, cx - 11, my - 5); ctx.fill(); }
      if (bs === 'full') { ctx.fillStyle = shade(bc, 0.9); }
    }
    // --- mouth
    ctx.lineCap = 'round';
    if (f.mouth === 'grin') { ctx.fillStyle = '#fafafa'; ctx.strokeStyle = shade(skin, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 8, my - 1); ctx.quadraticCurveTo(cx, my + 8, cx + 8, my - 1); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    else { ctx.strokeStyle = bs !== 'none' && bs !== 'stubble' ? shade(bc, 0.45) : shade(skin, 0.5); ctx.lineWidth = 1.5; ctx.beginPath(); if (f.mouth === 'smile') { ctx.moveTo(cx - 7, my - 1); ctx.quadraticCurveTo(cx, my + 4.5, cx + 7, my - 1); } else { ctx.moveTo(cx - 6, my + 1); ctx.lineTo(cx + 6, my + 1); } ctx.stroke(); }
    // --- hair in front
    ctx.fillStyle = hair;
    const cap = (low, side) => { // cap over the top of the head, hairline at y = top + low
      ctx.beginPath(); ctx.moveTo(cx - rx - 1, cy - 4); ctx.quadraticCurveTo(cx - rx - 4, top - 4, cx, top - 4); ctx.quadraticCurveTo(cx + rx + 4, top - 4, cx + rx + 1, cy - 4);
      ctx.lineTo(cx + rx - (side || 3), cy - 14); ctx.quadraticCurveTo(cx, top + low, cx - rx + (side || 3), cy - 14); ctx.closePath(); ctx.fill();
    };
    if (st === 'short') cap(12);
    else if (st === 'buzz') { ctx.globalAlpha = 0.7; cap(8); ctx.globalAlpha = 1; }
    else if (st === 'fade') { ctx.globalAlpha = 0.5; cap(10, 1); ctx.globalAlpha = 1; ctx.beginPath(); ctx.ellipse(cx, top + 2, rx - 6, 8, 0, Math.PI, 0); ctx.fill(); }
    else if (st === 'sidepart') { cap(13); ctx.beginPath(); ctx.moveTo(cx - 8, top - 3); ctx.quadraticCurveTo(cx + 8, top + 6, cx + rx - 2, cy - 12); ctx.lineTo(cx + rx + 1, cy - 4); ctx.quadraticCurveTo(cx + rx + 4, top - 4, cx + 2, top - 5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = hdark; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(cx - 8, top - 2); ctx.quadraticCurveTo(cx - 6, top + 7, cx - 14, cy - 14); ctx.stroke(); }
    else if (st === 'quiff') { cap(10); ctx.beginPath(); ctx.moveTo(cx - rx + 2, top + 9); ctx.quadraticCurveTo(cx - 6, top - 16, cx + rx - 2, top + 4); ctx.quadraticCurveTo(cx + 6, top - 4, cx - rx + 2, top + 9); ctx.fill(); }
    else if (st === 'undercut') { ctx.globalAlpha = 0.45; cap(9, 1); ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(cx - rx + 7, top + 8); ctx.quadraticCurveTo(cx - 4, top - 14, cx + rx - 7, top + 8); ctx.quadraticCurveTo(cx, top + 3, cx - rx + 7, top + 8); ctx.fill(); }
    else if (st === 'curtains') { cap(8); ctx.beginPath(); ctx.moveTo(cx, top - 3); ctx.quadraticCurveTo(cx - rx - 2, top + 4, cx - rx - 1, cy + 4); ctx.lineTo(cx - rx + 8, cy - 8); ctx.quadraticCurveTo(cx - 8, top + 18, cx, top - 3); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx, top - 3); ctx.quadraticCurveTo(cx + rx + 2, top + 4, cx + rx + 1, cy + 4); ctx.lineTo(cx + rx - 8, cy - 8); ctx.quadraticCurveTo(cx + 8, top + 18, cx, top - 3); ctx.fill(); }
    else if (st === 'long') { cap(13); ctx.beginPath(); ctx.moveTo(cx - rx - 1, cy - 6); ctx.lineTo(cx - rx - 2, cy + 22); ctx.lineTo(cx - rx + 5, cy + 22); ctx.lineTo(cx - rx + 3, cy - 10); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx + rx + 1, cy - 6); ctx.lineTo(cx + rx + 2, cy + 22); ctx.lineTo(cx + rx - 5, cy + 22); ctx.lineTo(cx + rx - 3, cy - 10); ctx.fill(); }
    else if (st === 'ponytail' || st === 'bun') cap(11);
    else if (st === 'curly') { for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (rx - 1), cy - 6 + Math.sin(a) * (ry - 8), 7.5, 0, Math.PI * 2); ctx.fill(); } cap(14); }
    else if (st === 'afro') { cap(14); ctx.beginPath(); ctx.ellipse(cx, top + 6, rx + 4, 12, 0, Math.PI, 0); ctx.fill(); }
    else if (st === 'braids') { cap(11); ctx.strokeStyle = hair; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { const x = cx - rx + 4 + i * ((rx * 2 - 8) / 5); ctx.beginPath(); ctx.moveTo(x, top + 2); ctx.lineTo(x + (i < 3 ? -2 : 2), cy + 20 + (i % 2) * 6); ctx.stroke(); } }
    else if (st === 'mohawk') { ctx.beginPath(); ctx.moveTo(cx - 6, top + 8); ctx.quadraticCurveTo(cx - 7, top - 10, cx, top - 12); ctx.quadraticCurveTo(cx + 7, top - 10, cx + 6, top + 8); ctx.closePath(); ctx.fill(); }
    // --- headband
    if (f.band) { ctx.fillStyle = f.band; ctx.fillRect(cx - rx - 0.5, cy - 20, rx * 2 + 1, 6); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(cx - rx - 0.5, cy - 15, rx * 2 + 1, 1.2); }
    ctx.restore();
  };

  const cache = new Map();
  // data URL of the portrait (cached by look and size)
  Face.url = function (look, size) {
    const key = JSON.stringify(Face.norm(look)) + '@' + size;
    let u = cache.get(key);
    if (u) return u;
    if (typeof document === 'undefined') return '';
    try {
      const cv = document.createElement('canvas'); cv.width = size; cv.height = Math.round(size * 1.2);
      Face.draw(cv.getContext('2d'), look, size);
      u = cv.toDataURL();
    } catch (e) { u = ''; }
    if (cache.size > 200) cache.clear();
    cache.set(key, u);
    return u;
  };
})((globalThis.FCK = globalThis.FCK || {}));
