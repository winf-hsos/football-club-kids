/* FCK - flags.js : national flags drawn as images (own vector-style drawings, 3:2) so they look right on every system (emoji flags are missing on Windows).
   FCK.Flag.url(code) / FCK.Flag.draw(ctx, code, x, y, h) / FCK.Flag.img(code, h); codes are ISO 3166 alpha-2 ('DE'), plus 'ENG', 'SCO', 'WAL', 'NIR'.
   FCK.Flag.fromEmoji(str) maps a flag emoji to its code. h() turns flag emoji inside texts into images automatically. */
(function (FCK) {
  'use strict';
  const Flag = {};
  FCK.Flag = Flag;
  const W = 90, H = 60;
  const R = '#d52b1e', B = '#0a3d91', K = '#111111', Wh = '#ffffff', Y = '#fcd116', G = '#0a7a3b', O = '#f77f00', LB = '#4aa8e8', DR = '#b3122b';

  // ---- builders: every flag is a list of draw operations on a 90 x 60 field
  const rect = (c, x, y, w, h) => ['r', c, x, y, w, h];
  const hs = (cols, ws) => { const t = (ws || cols.map(() => 1)).reduce((a, b) => a + b, 0); let y = 0; return cols.map((c, i) => { const h = (H * (ws ? ws[i] : 1)) / t; const o = rect(c, 0, y, W, h + 0.4); y += h; return o; }); };
  const vs = (cols, ws) => { const t = (ws || cols.map(() => 1)).reduce((a, b) => a + b, 0); let x = 0; return cols.map((c, i) => { const w = (W * (ws ? ws[i] : 1)) / t; const o = rect(c, x, 0, w + 0.4, H); x += w; return o; }); };
  const circle = (c, x, y, r) => ['c', c, x, y, r];
  const star = (c, x, y, r, n, rot) => ['s', c, x, y, r, n || 5, rot || 0];
  const poly = (c, pts) => ['p', c, pts];
  const nordic = (bg, cr, inner) => [rect(bg, 0, 0, W, H), rect(cr, 24, 0, 16, H), rect(cr, 0, 22, W, 16)].concat(inner ? [rect(inner, 28, 0, 8, H), rect(inner, 0, 26, W, 8)] : []);
  const saltire = (c, w) => ['x', c, w || 7];
  const crescent = (c, x, y, r, bg) => [circle(c, x, y, r), circle(bg, x + r * 0.35, y, r * 0.82)];
  const tri = (c, x1, y1, x2, y2, x3, y3) => poly(c, [[x1, y1], [x2, y2], [x3, y3]]);
  const hoist = (c, w) => tri(c, 0, 0, w || 40, 30, 0, 60);
  const cross = (c, x, w) => [rect(c, x - w / 2, 0, w, H), rect(c, 0, H / 2 - w / 2, W, w)];
  const disc = (bg, c, r) => [rect(bg, 0, 0, W, H), circle(c, 45, 30, r)];
  const sun = (c, x, y, r) => { const o = [circle(c, x, y, r * 0.55)]; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; o.push(tri(c, x + Math.cos(a - 0.12) * r * 0.62, y + Math.sin(a - 0.12) * r * 0.62, x + Math.cos(a + 0.12) * r * 0.62, y + Math.sin(a + 0.12) * r * 0.62, x + Math.cos(a) * r, y + Math.sin(a) * r)); } return o; };
  const union = () => [rect('#012169', 0, 0, W, H), ['x', Wh, 9], ['x', '#c8102e', 4], rect(Wh, 36, 0, 18, H), rect(Wh, 0, 21, W, 18), rect('#c8102e', 39, 0, 12, H), rect('#c8102e', 0, 24, W, 12)];
  const stars = (c, n, x0, y0, dx, dy, r) => { const o = []; for (let i = 0; i < n; i++) o.push(star(c, x0 + (i % 6) * dx, y0 + Math.floor(i / 6) * dy, r)); return o; };
  const flat = (...l) => l.reduce((a, b) => a.concat(Array.isArray(b[0]) || typeof b[0] === 'object' ? b : [b]), []);
  const F = {};
  const set = (codes, ops) => codes.split(' ').forEach((c) => { F[c] = ops; });

  // ---- Europe
  set('DE', hs([K, DR, Y])); set('FR', vs(['#0a3d91', Wh, '#ef4135'])); set('IT', vs([G, Wh, '#ce2b37'])); set('BE', vs([K, Y, '#ef3340'])); set('NL', hs(['#ae1c28', Wh, '#21468b']));
  set('ES', hs(['#aa151b', Y, '#aa151b'], [1, 2, 1])); set('PT', flat(vs(['#046a38', '#da291c'], [2, 3]), circle(Y, 36, 30, 9), circle('#da291c', 36, 30, 5.5), circle(Wh, 36, 30, 3)));
  set('AT', hs([R, Wh, R])); set('CH', [rect(R, 0, 0, W, H), rect(Wh, 38, 12, 14, 36), rect(Wh, 27, 23, 36, 14)]); set('LU', hs([R, Wh, LB])); set('LI', flat(hs([B, R]), circle(Y, 18, 15, 5)));
  set('IE', vs([G, Wh, O])); set('GB ENG', [rect(Wh, 0, 0, W, H), rect(R, 38, 0, 14, H), rect(R, 0, 23, W, 14)]); set('GB', union()); set('UK', union());
  set('SCO', [rect('#005eb8', 0, 0, W, H), saltire(Wh, 9)]); set('WAL', flat(hs([Wh, G]), poly('#d30731', [[20, 40], [30, 22], [40, 40], [50, 22], [60, 40], [70, 22], [72, 44], [18, 44]])));
  set('NIR', [rect(Wh, 0, 0, W, H), rect(R, 38, 0, 14, H), rect(R, 0, 23, W, 14), circle(Wh, 45, 30, 9), star('#d52b1e', 45, 30, 7, 6)]);
  set('DK', nordic(R, Wh)); set('NO', nordic('#ba0c2f', '#00205b', Wh)); set('SE', nordic('#006aa7', Y)); set('FI', nordic(Wh, '#003580')); set('IS', nordic('#02529c', Wh, R)); set('FO', nordic(Wh, '#0065bd', R));
  set('PL', hs([Wh, '#dc143c'])); set('CZ', flat(hs([Wh, '#d7141a']), tri('#11457e', 0, 0, 45, 30, 0, 60))); set('SK', flat(hs([Wh, '#0b4ea2', '#ee1c25']), rect('#ee1c25', 18, 14, 18, 24), rect(Wh, 24, 20, 6, 12)));
  set('HU', hs(['#ce2939', Wh, '#477050'])); set('RO', vs(['#002b7f', Y, '#ce1126'])); set('BG', hs([Wh, '#00966e', '#d62612'])); set('GR', flat(hs(['#0d5eaf', Wh, '#0d5eaf', Wh, '#0d5eaf', Wh, '#0d5eaf', Wh, '#0d5eaf']), rect('#0d5eaf', 0, 0, 33, 33), rect(Wh, 13, 0, 7, 33), rect(Wh, 0, 13, 33, 7)));
  set('HR', flat(hs(['#ff0000', Wh, '#171796']), rect('#ff0000', 36, 20, 18, 20), rect(Wh, 36, 20, 6, 10), rect(Wh, 48, 20, 6, 10), rect(Wh, 42, 30, 6, 10)));
  set('SI', flat(hs([Wh, '#0056a4', '#e5101c']), rect('#0056a4', 14, 12, 14, 18), circle(Wh, 21, 21, 4)));
  set('RS', flat(hs(['#c6363c', '#0c4076', Wh]), rect('#c6363c', 22, 18, 18, 24), rect(Y, 27, 24, 8, 10))); set('ME', [rect('#c40308', 0, 0, W, H), rect(Y, 3, 3, 84, 54), rect('#c40308', 6, 6, 78, 48), circle(Y, 45, 30, 8)]);
  set('BA', flat(rect('#002395', 0, 0, W, H), tri(Y, 24, 0, 66, 0, 66, 60), stars(Wh, 6, 12, 8, 8, 8, 2.6))); set('MK', [rect('#d20000', 0, 0, W, H)].concat(sun(Y, 45, 30, 28))); set('AL', [rect('#e41e20', 0, 0, W, H), star(K, 45, 30, 16, 6)]);
  set('XK', flat(rect('#244aa5', 0, 0, W, H), poly('#d0a650', [[22, 40], [30, 20], [60, 20], [68, 40], [45, 48]]), stars(Wh, 6, 25, 10, 8, 8, 2.4)));
  set('UA', hs(['#0057b7', '#ffd700'])); set('BY', flat(hs(['#c8313e', '#4aa657'], [2, 1]), rect(Wh, 0, 0, 10, H))); set('RU', hs([Wh, '#0039a6', '#d52b1e'])); set('MD', flat(vs(['#003da5', Y, '#cc092f']), circle('#8a5a2b', 45, 30, 6)));
  set('LT', hs([Y, G, '#c1272d'])); set('LV', hs(['#9e3039', Wh, '#9e3039'], [2, 1, 2])); set('EE', hs(['#0072ce', K, Wh]));
  set('TR', flat(rect('#e30a17', 0, 0, W, H), crescent(Wh, 36, 30, 14, '#e30a17'), star(Wh, 52, 30, 8))); set('CY', flat(rect(Wh, 0, 0, W, H), ['c', '#d57800', 45, 24, 14], rect(Wh, 30, 30, 30, 4), rect('#4e7a3b', 28, 40, 34, 2.5)));
  set('MT', [rect(Wh, 0, 0, 45, H), rect(R, 45, 0, 45, H), rect('#999', 5, 5, 8, 8)]); set('AD', flat(vs(['#10069f', Y, '#d50032'], [1, 1, 1]), circle('#d50032', 45, 30, 7))); set('SM', flat(hs([Wh, LB]), circle('#e8c700', 45, 30, 8)));
  set('MC', hs([R, Wh])); set('VA', flat(vs([Y, Wh]), circle('#999', 66, 30, 8))); set('GI', flat(hs([Wh, R], [2, 1]), rect('#da000c', 40, 28, 10, 20))); set('GE', [rect(Wh, 0, 0, W, H), rect(R, 38, 0, 14, H), rect(R, 0, 23, W, 14), ...[[19, 11], [71, 11], [19, 49], [71, 49]].map((p) => rect(R, p[0] - 4, p[1] - 1.5, 8, 3))]);
  set('AM', hs(['#d90012', '#0033a0', '#f2a800'])); set('AZ', flat(hs(['#00b5e2', '#ef3340', '#509e2f']), crescent(Wh, 42, 30, 7, '#ef3340'), star(Wh, 52, 30, 3.5, 8))); set('KZ', flat(rect('#00afca', 0, 0, W, H), sun('#fec50c', 45, 24, 12), rect('#fec50c', 14, 46, 62, 3)));
  set('JE GG IM', hs([Wh, R])); set('GL', flat(hs([Wh, R]), circle(R, 38, 30, 12)));

  // ---- Americas
  set('US', flat(hs(['#b22234', Wh, '#b22234', Wh, '#b22234', Wh, '#b22234', Wh, '#b22234', Wh, '#b22234', Wh, '#b22234']), rect('#3c3b6e', 0, 0, 40, 32), stars(Wh, 12, 6, 6, 7, 8, 1.8)));
  set('CA', flat(vs([R, Wh, R], [1, 2, 1]), poly(R, [[45, 12], [49, 22], [57, 20], [52, 30], [56, 38], [47, 36], [45, 48], [43, 36], [34, 38], [38, 30], [33, 20], [41, 22]])));
  set('MX', flat(vs([G, Wh, '#ce1126']), circle('#8a6a2b', 45, 30, 7))); set('BR', flat(rect('#009c3b', 0, 0, W, H), poly(Y, [[45, 5], [84, 30], [45, 55], [6, 30]]), circle('#002776', 45, 30, 13), rect(Wh, 33, 28, 24, 2.5)));
  set('AR', flat(hs(['#74acdf', Wh, '#74acdf']), sun('#f6b40e', 45, 30, 7))); set('UY', flat(hs([Wh, '#0038a8', Wh, '#0038a8', Wh, '#0038a8', Wh, '#0038a8', Wh]), rect(Wh, 0, 0, 33, 33), sun('#fcd116', 16, 16, 12)));
  set('CL', flat(hs([Wh, '#d52b1e']), rect('#0039a6', 0, 0, 30, 30), star(Wh, 15, 15, 9))); set('CO', hs([Y, '#003893', '#ce1126'], [2, 1, 1])); set('VE', flat(hs([Y, '#00247d', '#cf142b']), stars(Wh, 8, 20, 30, 7, 0, 1.8).slice(0, 8)));
  set('PE', vs([R, Wh, R])); set('EC', flat(hs([Y, '#034ea2', '#ed1c24'], [2, 1, 1]), circle('#9a7b4f', 45, 28, 7))); set('BO', hs(['#d52b1e', Y, '#007934'])); set('PY', flat(hs(['#d52b1e', Wh, '#0038a8']), circle('#3a7d44', 45, 30, 5)));
  set('PA', flat(rect(Wh, 0, 0, W, H), rect('#d21034', 45, 0, 45, 30), rect('#005293', 0, 30, 45, 30), star('#005293', 22, 15, 8), star('#d21034', 67, 45, 8)));
  set('CR', hs(['#002b7f', Wh, '#ce1126', Wh, '#002b7f'], [1, 1, 2, 1, 1])); set('NI', hs(['#0067c6', Wh, '#0067c6'])); set('HN', flat(hs(['#0073cf', Wh, '#0073cf']), stars('#0073cf', 5, 36, 30, 5, 0, 1.8).slice(0, 5)));
  set('SV', flat(hs(['#0f47af', Wh, '#0f47af']), circle('#6a8a3a', 45, 30, 6))); set('GT', flat(vs(['#4997d0', Wh, '#4997d0']), circle('#5a8a3a', 45, 30, 6))); set('BZ', flat(hs(['#003f87', '#ce1126', '#003f87'], [1, 6, 1]), rect('#ce1126', 0, 0, W, 6), circle(Wh, 45, 30, 15), circle('#3a7d44', 45, 30, 11)));
  set('CU', flat(hs(['#002a8f', Wh, '#002a8f', Wh, '#002a8f']), tri('#cf142b', 0, 0, 40, 30, 0, 60), star(Wh, 12, 30, 7))); set('DO', flat(rect('#002d62', 0, 0, W, H), rect('#ce1126', 0, 0, 40, 26), rect('#ce1126', 50, 34, 40, 26), rect(Wh, 38, 0, 14, H), rect(Wh, 0, 23, W, 14)));
  set('HT', flat(hs(['#00209f', '#d21034']), rect(Wh, 33, 20, 24, 20))); set('JM', flat(rect(G, 0, 0, W, H), tri(K, 0, 0, 45, 30, 0, 60), tri(K, 90, 0, 45, 30, 90, 60), tri(Y, 0, 0, 14, 0, 90, 60), tri(Y, 0, 60, 14, 60, 90, 0).slice(0, 2)));
  set('JM', [rect(G, 0, 0, W, H), tri(K, 0, 0, 45, 30, 0, 60), tri(K, 90, 0, 45, 30, 90, 60), poly(Y, [[0, 0], [10, 0], [90, 54], [90, 60], [80, 60], [0, 6]]), poly(Y, [[90, 0], [80, 0], [0, 54], [0, 60], [10, 60], [90, 6]])]);
  set('TT', [rect(R, 0, 0, W, H), poly(K, [[0, 0], [14, 0], [90, 52], [90, 60], [76, 60], [0, 8]]), poly(Wh, [[3, 0], [8, 0], [90, 56], [90, 60], [85, 60], [0, 4]]).slice(0, 2)]);
  set('TT', [rect(R, 0, 0, W, H), poly(Wh, [[0, 0], [20, 0], [90, 60], [70, 60]]), poly(K, [[8, 0], [14, 0], [82, 60], [76, 60]])]);
  set('BS', flat(hs(['#00abc9', Y, '#00abc9']), tri(K, 0, 0, 34, 30, 0, 60))); set('BB', flat(vs(['#00267f', Y, '#00267f']), rect(K, 43, 16, 4, 28))); set('CW', flat(rect('#002b7f', 0, 0, W, H), rect(Y, 0, 38, W, 6), star(Wh, 14, 12, 5), star(Wh, 26, 18, 6))); set('PR', flat(hs([R, Wh, R, Wh, R]), tri('#0050f0', 0, 0, 40, 30, 0, 60), star(Wh, 13, 30, 8)));
  set('GY', flat(rect(G, 0, 0, W, H), tri(Wh, 0, 0, 88, 30, 0, 60), tri(Y, 0, 4, 80, 30, 0, 56), tri(K, 0, 0, 40, 30, 0, 60), tri(R, 0, 8, 36, 30, 0, 52))); set('SR', hs([G, Wh, R, Wh, G], [2, 1, 4, 1, 2]).concat([star(Y, 45, 30, 9)]));

  // ---- Africa
  set('MA', [rect('#c1272d', 0, 0, W, H), star('#006233', 45, 30, 14)]); set('DZ', flat(vs([G, Wh]), crescent('#d21034', 45, 30, 12, Wh), star('#d21034', 48, 30, 6))); set('TN', flat(rect('#e70013', 0, 0, W, H), circle(Wh, 45, 30, 16), circle('#e70013', 43, 30, 11), circle('#e70013', 47, 30, 8)));
  set('EG', flat(hs(['#ce1126', Wh, K]), circle('#c09300', 45, 30, 5))); set('LY', flat(hs(['#e70013', K, '#239e46'], [1, 2, 1]), crescent(Wh, 43, 30, 9, K), star(Wh, 50, 30, 4)));
  set('SN', flat(vs([G, Y, '#e31b23']), star(G, 45, 30, 9))); set('ML', vs([G, Y, '#ce1126'])); set('GN', vs(['#ce1126', Y, '#009460'])); set('MR', flat(rect('#006233', 0, 0, W, H), rect('#d01c1f', 0, 0, W, 6), rect('#d01c1f', 0, 54, W, 6), crescent(Y, 45, 28, 12, '#006233'), star(Y, 45, 20, 4)));
  set('CI', vs([O, Wh, '#009e60'])); set('BF', flat(hs(['#ef2b2d', '#009e49']), star(Y, 45, 30, 12))); set('GH', flat(hs(['#ce1126', Y, '#006b3f']), star(K, 45, 30, 10))); set('TG', flat(hs([G, Y, G, Y, G]), rect('#d21034', 0, 0, 36, 36), star(Wh, 18, 18, 9)));
  set('BJ', flat(rect('#fcd116', 0, 0, W, H), rect('#008751', 0, 0, 36, H), rect('#e8112d', 36, 30, 54, 30), rect(Y, 36, 0, 54, 30))); set('NG', vs([G, Wh, G])); set('NE', flat(hs([O, Wh, '#0db02b']), circle(O, 45, 30, 6))); set('TD', vs(['#002664', Y, '#c60c30']));
  set('CM', flat(vs([G, '#ce1126', Y]), star(Y, 45, 30, 9))); set('CF', flat(hs(['#003082', Wh, '#289728', Y]), rect('#d21034', 36, 0, 18, H), star(Y, 8, 8, 5))); set('GQ', flat(hs(['#3e9a00', Wh, '#e32118']), tri('#0073ce', 0, 0, 30, 30, 0, 60)));
  set('GA', hs([G, Y, '#3a75c4'])); set('CG', [rect(Y, 0, 0, W, H), poly(G, [[0, 0], [60, 0], [0, 60]]), poly('#dc241f', [[90, 0], [90, 60], [30, 60]])]); set('CD', flat(rect('#007fff', 0, 0, W, H), poly('#f7d618', [[0, 44], [78, 0], [90, 0], [90, 10], [12, 60], [0, 60]]), poly('#ce1021', [[0, 48], [80, 2], [86, 2], [8, 56], [0, 56]]).slice(0, 2), star('#f7d618', 14, 14, 8)));
  set('AO', flat(hs(['#cc092f', K]), circle(Y, 45, 30, 9))); set('ZM', flat(rect('#198a00', 0, 0, W, H), rect('#de2010', 62, 30, 9, 30), rect(K, 71, 30, 9, 30), rect(O, 80, 30, 10, 30))); set('ZW', flat(hs([G, Y, R, K, R, Y, G]), tri(Wh, 0, 0, 38, 30, 0, 60), star(R, 14, 30, 8)));
  set('MZ', flat(hs([G, K, Y]), tri('#d21034', 0, 0, 38, 30, 0, 60), star(Y, 14, 30, 8))); set('MW', hs([K, '#ce1126', '#339e35'])); set('TZ', [rect('#1eb53a', 0, 0, W, H), rect('#00a3dd', 0, 0, W, H).slice(0, 2), poly('#00a3dd', [[90, 0], [90, 60], [0, 60]]), poly(Y, [[0, 60], [0, 46], [78, 0], [90, 0], [90, 14], [12, 60]]), poly(K, [[0, 56], [0, 50], [80, 2], [86, 2], [86, 6], [6, 56]]).slice(0, 2)]);
  set('TZ', [rect('#1eb53a', 0, 0, W, H), poly('#00a3dd', [[90, 0], [90, 60], [0, 60]]), poly(Y, [[0, 60], [0, 48], [78, 0], [90, 0], [90, 12], [12, 60]]), poly(K, [[0, 60], [0, 52], [80, 2], [90, 2], [90, 8], [10, 60]])]);
  set('KE', flat(hs([K, R, G], [3, 3, 3]), rect(Wh, 0, 18, W, 2), rect(Wh, 0, 40, W, 2), ['c', '#8a1c1c', 45, 30, 12])); set('UG', flat(hs([K, Y, R, K, Y, R]), circle(Wh, 45, 30, 9))); set('RW', flat(hs(['#00a1de', Y, '#20603d'], [2, 1, 1]), sun(Y, 74, 14, 9))); set('BI', [rect('#ce1126', 0, 0, W, H), poly('#1eb53a', [[0, 0], [90, 0], [45, 30]]), poly('#1eb53a', [[0, 60], [90, 60], [45, 30]]), circle(Wh, 45, 30, 14)]);
  set('ET', flat(hs([G, Y, '#da121a']), circle('#0f47af', 45, 30, 12), star(Y, 45, 30, 8))); set('ER', flat(rect('#4189dd', 0, 0, W, H), poly('#ea0437', [[0, 0], [90, 30], [0, 60]]).slice(0, 2), poly('#ea0437', [[0, 0], [90, 0], [90, 30]]), poly('#12ad2b', [[0, 60], [90, 60], [90, 30]]))); set('DJ', flat(hs(['#6ab2e7', '#12ad2b']), tri(Wh, 0, 0, 40, 30, 0, 60), star('#d7141a', 12, 30, 6)));
  set('SO', flat(rect('#4189dd', 0, 0, W, H), star(Wh, 45, 30, 14))); set('SD', flat(hs([R, Wh, K]), tri(G, 0, 0, 36, 30, 0, 60))); set('SS', flat(hs([K, Wh, R, Wh, '#078930'], [3, 1, 3, 1, 3]), tri('#0f47af', 0, 0, 40, 30, 0, 60), star(Y, 12, 30, 6)));
  set('ZA', flat(hs(['#e03c31', '#001489'], [1, 1]), poly(G, [[0, 0], [20, 0], [48, 24], [90, 24], [90, 36], [48, 36], [20, 60], [0, 60]]), poly(Wh, [[0, 6], [14, 6], [44, 28], [90, 28], [90, 32], [44, 32], [14, 54], [0, 54]]), tri(K, 0, 12, 30, 30, 0, 48), tri(Y, 0, 8, 24, 30, 0, 52).slice(0, 2))); set('NA', flat(rect('#009543', 0, 0, W, H), poly('#003580', [[0, 0], [90, 0], [0, 60]]), poly('#d21034', [[90, 60], [90, 0], [0, 60]]), poly(Wh, [[0, 0], [14, 0], [90, 54], [90, 60], [76, 60], [0, 6]])).concat([sun(Y, 16, 14, 9)]));
  set('BW', flat(hs(['#75aadb', Wh, K, Wh, '#75aadb'], [9, 1, 4, 1, 9]))); set('LS', flat(hs([B, Wh, G], [3, 4, 3]), tri(K, 45, 22, 51, 38, 39, 38))); set('SZ', flat(hs([B, Y, '#b10c0c', Y, B], [1, 1, 5, 1, 1]), ['e', 45, 30])); set('MG', flat(rect('#fc3d32', 0, 0, W, H), rect(Wh, 0, 0, 30, H), rect('#007e3a', 30, 30, 60, 30)));
  set('MU', hs(['#ea2839', '#1a206d', Y, '#00a551'])); set('SC', flat(rect('#d62828', 0, 0, W, H), poly(Y, [[0, 60], [0, 40], [90, 0], [90, 20]]).slice(0, 2), poly('#003f87', [[0, 60], [0, 0], [30, 0]]), poly(Y, [[0, 60], [30, 0], [60, 0]]), poly('#d62828', [[0, 60], [60, 0], [90, 0], [90, 20]]), poly(Wh, [[0, 60], [90, 20], [90, 40]]), poly('#007a3d', [[0, 60], [90, 40], [90, 60]]))); set('KM', hs([Y, Wh, R, '#3a75c4']));
  set('CV', flat(hs(['#003893', Wh, '#cf2027', Wh, '#003893'], [8, 1, 1, 1, 6]), stars(Y, 10, 20, 30, 0, 0, 2).slice(0, 0))); set('GM', hs([R, Wh, '#0c1c8c', Wh, G], [6, 1, 4, 1, 6])); set('GW', flat(vs([R]), rect(Y, 0, 0, W, 30), rect('#009e49', 0, 30, W, 30), rect('#ce1126', 0, 0, 30, H), star(K, 15, 30, 9))); set('SL', hs(['#1eb53a', Wh, '#0072c6'])); set('LR', flat(hs([R, Wh, R, Wh, R, Wh, R, Wh, R, Wh, R]), rect('#002868', 0, 0, 28, 28), star(Wh, 14, 14, 9))); set('ST', flat(hs(['#12ad2b', Y, '#12ad2b'], [1, 2, 1]), tri('#d21034', 0, 0, 32, 30, 0, 60), star(K, 52, 30, 5), star(K, 68, 30, 5)));

  // ---- Asia / Oceania
  set('JP', disc(Wh, '#bc002d', 18)); set('KR', flat(rect(Wh, 0, 0, W, H), circle('#cd2e3a', 45, 30, 15), poly('#0047a0', [[30, 30], [60, 30], [45, 45]]).slice(0, 2), ['b', K])); set('KR', [rect(Wh, 0, 0, W, H), circle('#cd2e3a', 45, 30, 14), ['c', '#0047a0', 45, 36, 7], rect(K, 8, 6, 14, 2), rect(K, 8, 10, 14, 2), rect(K, 68, 48, 14, 2), rect(K, 68, 52, 14, 2)]);
  set('CN', flat(rect('#de2910', 0, 0, W, H), star(Y, 15, 14, 9), star(Y, 29, 6, 3), star(Y, 33, 12, 3), star(Y, 33, 19, 3), star(Y, 29, 25, 3))); set('TW', flat(rect('#fe0000', 0, 0, W, H), rect('#000095', 0, 0, 45, 30), sun(Wh, 22, 15, 9))); set('HK MO', flat(rect('#de2910', 0, 0, W, H), star(Wh, 45, 30, 14, 5, 0.2)));
  set('KP', flat(hs(['#024fa2', Wh, '#ed1c27', Wh, '#024fa2'], [6, 1, 9, 1, 6]), circle(Wh, 30, 30, 10), star('#ed1c27', 30, 30, 8))); set('MN', flat(vs(['#c4272f', '#015197', '#c4272f']), circle(Y, 15, 30, 5)));
  set('IN', flat(hs(['#ff9933', Wh, '#138808']), circle('#000080', 45, 30, 7), circle(Wh, 45, 30, 5))); set('PK', flat(rect('#01411c', 0, 0, W, H), rect(Wh, 0, 0, 22, H), crescent(Wh, 56, 30, 14, '#01411c'), star(Wh, 63, 24, 6))); set('BD', flat(rect('#006a4e', 0, 0, W, H), circle('#f42a41', 40, 30, 16))); set('LK', flat(rect('#8d153a', 0, 0, W, H), rect(Y, 4, 4, 82, 52), rect('#8d153a', 6, 6, 78, 48), rect(O, 8, 8, 12, 44), rect('#00534e', 20, 8, 12, 44), rect(Y, 34, 8, 48, 44).slice(0, 2))); set('NP', flat(rect(Wh, 0, 0, W, H), poly('#dc143c', [[10, 4], [64, 30], [34, 30], [64, 56], [10, 56]]), poly('#003893', [[14, 8], [52, 29], [28, 29], [52, 52], [14, 52]]).slice(0, 2)));
  set('NP', [rect('#003893', 0, 0, W, H), poly('#dc143c', [[6, 3], [60, 30], [32, 30], [60, 57], [6, 57]]), circle(Wh, 22, 22, 5), circle(Wh, 22, 42, 5)]); set('BT', flat(rect(Y, 0, 0, W, H), poly(O, [[0, 60], [90, 60], [90, 0]]), circle(Wh, 45, 30, 12))); set('MV', flat(rect('#d21034', 0, 0, W, H), rect('#007e3a', 14, 10, 62, 40), crescent(Wh, 46, 30, 11, '#007e3a')));
  set('AF', [rect(K, 0, 0, 30, H), rect(R, 30, 0, 30, H), rect(G, 60, 0, 30, H), circle(Wh, 45, 30, 9)]); set('IR', flat(hs([G, Wh, '#da0000']), circle('#da0000', 45, 30, 6))); set('IQ', flat(hs(['#ce1126', Wh, K]), rect(G, 30, 24, 30, 12))); set('SY', flat(hs(['#ce1126', Wh, K]), star(G, 30, 30, 6), star(G, 60, 30, 6))); set('LB', flat(hs([R, Wh, R], [1, 2, 1]), circle('#00a651', 45, 30, 12)));
  set('JO', flat(hs([K, Wh, G]), tri(R, 0, 0, 45, 30, 0, 60), star(Wh, 14, 30, 6, 7))); set('IL', flat(hs([Wh, '#0038b8', Wh, Wh, Wh, Wh, '#0038b8', Wh], [1, 1, 3, 0.01, 0.01, 3, 1, 1]), star('#0038b8', 45, 30, 12, 6))); set('IL', [rect(Wh, 0, 0, W, H), rect('#0038b8', 0, 7, W, 7), rect('#0038b8', 0, 46, W, 7), star('#0038b8', 45, 30, 11, 6), star(Wh, 45, 30, 6.5, 6, 0.52)]); set('PS', flat(hs([K, Wh, G]), tri('#ce1126', 0, 0, 40, 30, 0, 60)));
  set('SA', flat(rect('#006c35', 0, 0, W, H), rect(Wh, 22, 22, 46, 3), rect(Wh, 26, 34, 38, 3))); set('YE', hs([R, Wh, K])); set('OM', flat(hs([Wh, R, G]), rect(R, 0, 0, 22, H))); set('AE', flat(hs([G, Wh, K]), rect('#ce1126', 0, 0, 22, H))); set('QA', flat(rect('#8a1538', 0, 0, W, H), poly(Wh, [[0, 0], [26, 0], [34, 6], [26, 12], [34, 18], [26, 24], [34, 30], [26, 36], [34, 42], [26, 48], [34, 54], [26, 60], [0, 60]]))); set('BH', flat(rect(R, 0, 0, W, H), poly(Wh, [[0, 0], [28, 0], [38, 8], [28, 16], [38, 24], [28, 32], [38, 40], [28, 48], [38, 52], [28, 60], [0, 60]]))); set('KW', flat(hs([G, Wh, R]), poly(K, [[0, 0], [24, 18], [24, 42], [0, 60]])));
  set('UZ', flat(hs(['#0099b5', R, Wh, R, '#1eb53a'], [8, 1, 8, 1, 8]), crescent(Wh, 14, 10, 6, '#0099b5'))); set('TM', flat(rect('#00843d', 0, 0, W, H), rect('#d22630', 8, 0, 14, H))); set('TJ', flat(hs([R, Wh, '#006600'], [2, 3, 2]), circle(Y, 45, 30, 6))); set('KG', flat(rect(R, 0, 0, W, H), sun(Y, 45, 30, 16))); 
  set('TH', hs([R, Wh, '#2d2a4a', Wh, R], [1, 1, 2, 1, 1])); set('VN', flat(rect('#da251d', 0, 0, W, H), star(Y, 45, 30, 17))); set('LA', flat(hs(['#ce1126', '#002868', '#ce1126'], [1, 2, 1]), circle(Wh, 45, 30, 9))); set('KH', flat(hs(['#032ea1', '#e00025', '#032ea1'], [1, 2, 1]), rect(Wh, 30, 24, 30, 12)));
  set('MM', flat(hs([Y, '#34b233', '#ea2839']), star(Wh, 45, 30, 17))); set('MY', flat(hs([R, Wh, R, Wh, R, Wh, R, Wh, R, Wh, R, Wh, R, Wh]), rect('#010066', 0, 0, 45, 32), crescent(Y, 17, 16, 9, '#010066'), star(Y, 28, 16, 7, 14))); set('SG', flat(hs([R, Wh]), crescent(Wh, 16, 15, 9, R), stars(Wh, 5, 24, 15, 0, 0, 2).slice(0, 1))); set('ID', hs([R, Wh])); set('PH', flat(hs([B, R]), tri(Wh, 0, 0, 44, 30, 0, 60), star(Y, 11, 30, 6))); set('BN', flat(rect(Y, 0, 0, W, H), poly(Wh, [[0, 8], [90, 28], [90, 36], [0, 16]]), poly(K, [[0, 20], [90, 40], [90, 48], [0, 28]]), circle(R, 45, 30, 9))); set('TL', flat(rect('#dc241f', 0, 0, W, H), poly(Y, [[0, 0], [60, 30], [0, 60]]), poly(K, [[0, 0], [38, 30], [0, 60]]), star(Wh, 12, 30, 7)));
  set('AU', flat(rect('#00008b', 0, 0, W, H), [union().slice(0, 7)].map((x) => x).flat().map((o) => o), star(Wh, 22, 48, 7, 7), star(Wh, 65, 14, 3.5, 7), star(Wh, 76, 28, 3.5, 7), star(Wh, 65, 44, 3.5, 7), star(Wh, 54, 28, 3.5, 7))); set('AU', [rect('#00008b', 0, 0, W, H), ['x', Wh, 3], rect(Wh, 15, 0, 6, 30), rect(Wh, 0, 12, 36, 6), rect(R, 17, 0, 2, 30), rect(R, 0, 14, 36, 2), star(Wh, 18, 46, 8, 7), star(Wh, 66, 12, 3.5, 7), star(Wh, 76, 26, 3.5, 7), star(Wh, 66, 44, 3.5, 7), star(Wh, 56, 26, 3.5, 7)]);
  set('NZ', [rect('#00247d', 0, 0, W, H), rect(Wh, 15, 0, 6, 30), rect(Wh, 0, 12, 36, 6), rect(R, 17, 0, 2, 30), rect(R, 0, 14, 36, 2), star(R, 68, 12, 4), star(R, 76, 28, 4), star(R, 68, 44, 4), star(R, 60, 26, 4)]); set('FJ', [rect('#68bfe5', 0, 0, W, H), rect('#012169', 0, 0, 36, 30), rect(Wh, 15, 0, 6, 30), rect(Wh, 0, 12, 36, 6), rect(R, 17, 0, 2, 30), rect(R, 0, 14, 36, 2)]); set('PG', flat(rect(K, 0, 0, W, H), poly(R, [[0, 0], [90, 0], [90, 60]]), star(Wh, 22, 44, 3), star(Wh, 14, 38, 3), star(Wh, 30, 38, 3), star(Wh, 22, 32, 3), circle(Y, 62, 22, 9))); set('SB', flat(rect('#0051ba', 0, 0, W, H), poly('#215b33', [[0, 60], [90, 0], [90, 60]]), poly(Y, [[0, 60], [4, 56], [86, 0], [90, 0]]), stars(Wh, 5, 12, 10, 6, 6, 2.4).slice(0, 5)));
  set('WS', [rect('#ce1126', 0, 0, W, H), rect('#002b7f', 0, 0, 40, 32), stars(Wh, 5, 12, 12, 7, 6, 2.5)]); set('TO', flat(rect('#c10000', 0, 0, W, H), rect(Wh, 0, 0, 36, 30), rect('#c10000', 15, 6, 6, 18), rect('#c10000', 9, 12, 18, 6))); set('VU', flat(hs([R, G]), poly(K, [[0, 0], [40, 30], [0, 60]]), poly(Y, [[0, 6], [34, 30], [0, 54]]).slice(0, 2), poly(Y, [[0, 12], [90, 30], [0, 48]]))); set('NC', flat(hs(['#0035ad', '#ed1c24', '#009543']), circle(Y, 45, 30, 12))); set('PF', flat(hs([R, Wh, R], [1, 2, 1]), circle(Y, 45, 30, 8)));
  set('GU AS', [rect('#00247d', 0, 0, W, H), rect(R, 4, 4, 82, 52)]);
  set('EU', flat(rect('#003399', 0, 0, W, H), stars(Y, 12, 45, 30, 0, 0, 3).slice(0, 0)));

  // ---- corrections (clean specs for flags with diagonal / layered designs)
  set('CD', [rect('#007fff', 0, 0, W, H), poly('#f7d618', [[0, 46], [80, 0], [90, 0], [90, 10], [12, 60], [0, 60]]), poly('#ce1021', [[0, 50], [82, 2], [88, 2], [10, 58], [0, 58]]), star('#f7d618', 14, 14, 8)]);
  set('ER', [rect('#12ad2b', 0, 0, W, 30), rect('#4189dd', 0, 30, W, 30), poly('#ea0437', [[0, 0], [90, 30], [0, 60]])]);
  set('ZA', [rect('#e03c31', 0, 0, W, 30), rect('#001489', 0, 30, W, 30), poly(Wh, [[0, 0], [24, 0], [52, 22], [90, 22], [90, 38], [52, 38], [24, 60], [0, 60]]), poly('#007749', [[0, 7], [20, 7], [48, 28], [90, 28], [90, 32], [48, 32], [20, 53], [0, 53]]), poly('#ffb612', [[0, 0], [30, 30], [0, 60]]), poly(K, [[0, 9], [20, 30], [0, 51]])]);
  set('SC', [poly('#003f87', [[0, 60], [0, 0], [30, 0]]), poly(Y, [[0, 60], [30, 0], [60, 0]]), poly('#d62828', [[0, 60], [60, 0], [90, 0], [90, 20]]), poly(Wh, [[0, 60], [90, 20], [90, 40]]), poly('#007a3d', [[0, 60], [90, 40], [90, 60]])]);
  set('KM', [hs([Y, Wh, R, '#3a75c4']), tri('#3d8e33', 0, 0, 40, 30, 0, 60), crescent(Wh, 10, 30, 8, '#3d8e33')]);
  set('VU', [rect(R, 0, 0, W, 30), rect('#009543', 0, 30, W, 30), poly(Y, [[0, 0], [46, 30], [0, 60]]), poly(K, [[0, 7], [34, 30], [0, 53]]), poly(Y, [[0, 24], [90, 26], [90, 34], [0, 36]])]);
  set('CV', [rect('#003893', 0, 0, W, H), rect(Wh, 0, 30, W, 4), rect('#cf2027', 0, 34, W, 4), rect(Wh, 0, 38, W, 4)]);
  set('CF', [hs(['#003082', Wh, '#289728', Y]), rect('#d21034', 36, 0, 18, H), star(Y, 8, 8, 5)]);
  set('EU', [rect('#003399', 0, 0, W, H), star(Y, 45, 30, 4)]);

  // ---- drawing
  function starPath(ctx, x, y, r, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2 + (rot || 0), rr = i % 2 ? r * (n === 5 ? 0.4 : 0.5) : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  function run(ctx, ops) {
    for (const o of ops) {
      if (!o) continue;
      if (Array.isArray(o) && Array.isArray(o[0])) { run(ctx, o); continue; }
      if (Array.isArray(o) && typeof o[0] === 'object') { run(ctx, o); continue; }
      switch (o[0]) {
        case 'r': ctx.fillStyle = o[1]; ctx.fillRect(o[2], o[3], o[4], o[5]); break;
        case 'c': ctx.fillStyle = o[1]; ctx.beginPath(); ctx.arc(o[2], o[3], o[4], 0, Math.PI * 2); ctx.fill(); break;
        case 's': ctx.fillStyle = o[1]; starPath(ctx, o[2], o[3], o[4], o[5], o[6]); ctx.fill(); break;
        case 'p': ctx.fillStyle = o[1]; ctx.beginPath(); o[2].forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); break;
        case 'x': ctx.strokeStyle = o[1]; ctx.lineWidth = o[2]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, H); ctx.moveTo(W, 0); ctx.lineTo(0, H); ctx.stroke(); break;
        case 'e': ctx.fillStyle = '#5a3b1e'; ctx.beginPath(); ctx.ellipse(o[1], o[2], 14, 9, 0, 0, Math.PI * 2); ctx.fill(); break;
        default: break;
      }
    }
  }
  const norm = (code) => String(code || '').toUpperCase();
  Flag.has = (code) => !!F[norm(code)];
  // draws the flag with its left edge at x, vertical centre y and height h
  Flag.draw = function (ctx, code, x, y, h) {
    const ops = F[norm(code)];
    const w = (h * 3) / 2, s = h / H;
    ctx.save(); ctx.translate(x, y - h / 2); ctx.scale(s, s);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    if (!ops) { ctx.fillStyle = '#556'; ctx.fillRect(0, 0, W, H); } else run(ctx, ops);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y - h / 2 + 0.5, w - 1, h - 1); ctx.restore();
    return w;
  };
  const cache = {};
  Flag.url = function (code) {
    code = norm(code);
    if (cache[code] !== undefined) return cache[code];
    let u = '';
    if (typeof document !== 'undefined') {
      try { const cv = document.createElement('canvas'); cv.width = 120; cv.height = 80; Flag.draw(cv.getContext('2d'), code, 0, 40, 80); u = cv.toDataURL(); } catch (e) { u = ''; }
    }
    cache[code] = u; return u;
  };
  Flag.img = function (code, h) {
    const img = document.createElement('img');
    img.className = 'flagimg'; img.alt = ''; img.src = Flag.url(code); img.style.height = (h || 16) + 'px';
    return img;
  };
  // regional indicator pair -> 'DE'; England / Scotland / Wales tag sequences -> 'ENG' / 'SCO' / 'WAL'
  const RI = /([\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF])|(🏴(?:\uDB40[\uDC20-\uDC7F])+)/g;
  Flag.RE = RI;
  Flag.fromEmoji = function (str) {
    if (!str) return '';
    const cps = Array.from(str);
    if (cps[0] === '\u{1F3F4}') { const tag = cps.slice(1).map((c) => String.fromCharCode(c.codePointAt(0) - 0xE0000)).join('').replace(/[^a-z]/g, ''); return tag === 'gbeng' ? 'ENG' : tag === 'gbsct' ? 'SCO' : tag === 'gbwls' ? 'WAL' : ''; }
    if (cps.length >= 2) return String.fromCharCode(cps[0].codePointAt(0) - 0x1F1E6 + 65) + String.fromCharCode(cps[1].codePointAt(0) - 0x1F1E6 + 65);
    return '';
  };
  Flag.codes = () => Object.keys(F);
})((globalThis.FCK = globalThis.FCK || {}));
