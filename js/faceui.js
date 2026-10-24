/* FCK - faceui.js : face designer widget (live portrait + options), used when creating a pro player and in his career */
(function (FCK) {
  'use strict';
  const UI = FCK.UI;
  const h = FCK.h;
  const Face = FCK.Face;
  const T = (k, v) => FCK.T(k, v);

  function swatches(list, current, onPick, custom) {
    const wrap = h('div', { class: 'swatches' });
    const btns = [];
    const mark = (c) => btns.forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === String(c).toLowerCase()));
    list.forEach((c) => {
      const b = h('button', { class: 'swatch', type: 'button', style: 'background:' + c, 'aria-label': c });
      b.dataset.c = c;
      b.addEventListener('click', () => { UI.sfx('click'); mark(c); onPick(c); });
      btns.push(b); wrap.appendChild(b);
    });
    if (custom) {
      const inp = h('input', { type: 'color', class: 'swatch-in', 'aria-label': T('face.custom'), value: /^#[0-9a-f]{6}$/i.test(current) ? current : '#888888' });
      inp.addEventListener('input', () => { mark(inp.value); onPick(inp.value); });
      wrap.appendChild(inp);
    }
    mark(current);
    return wrap;
  }

  // look is edited in place; onChange(look) after every change
  UI.lookEditor = function (look, onChange, opts) {
    opts = opts || {};
    Face.norm(look); // fills defaults on the object itself
    Object.assign(look, Face.norm(look));
    const f = look.f;
    const root = h('div', { class: 'face-ed' });
    const img = h('img', { class: 'face-prev', alt: '', width: 150, height: 180 });
    const update = () => { Object.assign(look, Face.norm(look)); img.src = Face.url(look, 300); if (onChange) onChange(look); };
    const field = (label, ...kids) => h('div', { class: 'field' }, h('span', { class: 'lbl', text: T(label) }), ...kids);
    const chips = (opts2, cur, set, cls) => UI.chips(opts2, cur, (v) => { set(v); update(); }, cls || 'scroll');
    const rnd = UI.btn('🎲 ' + T('face.random'), () => {
      const r = Face.random({ int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)), chance: (p) => Math.random() < p }, FCK.settings.profile === 'kids');
      Object.keys(look).forEach((k) => delete look[k]); Object.assign(look, r);
      UI.sfx('ok'); update(); rebuild();
    }, 'ghost sm');
    const body = h('div', { class: 'face-opts' });
    function rebuild() {
      body.innerHTML = '';
      const l = look, ff = look.f;
      body.appendChild(h('h4', { class: 'face-h', text: T('face.h.face') }));
      body.appendChild(field('face.shape', chips(Face.SHAPES.map((k) => ({ v: k, l: T('face.shape.' + k) })), ff.shape, (v) => { ff.shape = v; })));
      body.appendChild(field('pro.skin', swatches(Face.SKIN, l.skin, (c) => { l.skin = c; update(); })));
      body.appendChild(field('face.eyes', swatches(Face.EYES, ff.eye, (c) => { ff.eye = c; update(); })));
      body.appendChild(field('face.brows', chips(Face.BROWS.map((k) => ({ v: k, l: T('face.brows.' + k) })), ff.brows, (v) => { ff.brows = v; })));
      body.appendChild(field('face.nose', chips(Face.NOSES.map((k) => ({ v: k, l: T('face.nose.' + k) })), ff.nose, (v) => { ff.nose = v; })));
      body.appendChild(field('face.mouth', chips(Face.MOUTHS.map((k) => ({ v: k, l: T('face.mouth.' + k) })), ff.mouth, (v) => { ff.mouth = v; })));
      body.appendChild(UI.toggle(T('face.freckles'), !!ff.freckles, (v) => { ff.freckles = v; update(); }));
      body.appendChild(h('h4', { class: 'face-h', text: T('face.h.hair') }));
      body.appendChild(field('pro.hairstyle', chips(Face.HAIR_STYLES.map((k) => ({ v: k, l: T('pro.hs.' + k) })), l.hairStyle, (v) => { l.hairStyle = v; })));
      body.appendChild(field('pro.haircolor', swatches(Face.HAIR, l.hair, (c) => { if (l.beardCol === l.hair) l.beardCol = c; l.hair = c; update(); }, true)));
      body.appendChild(h('h4', { class: 'face-h', text: T('face.h.beard') }));
      body.appendChild(field('pro.beard', chips(Face.BEARDS.map((k) => ({ v: k, l: T('face.beard.' + k) })), l.beard ? l.beardStyle : 'none', (v) => { l.beard = v !== 'none'; l.beardStyle = v; })));
      body.appendChild(field('face.beardcol', swatches(Face.HAIR, l.beardCol, (c) => { l.beardCol = c; update(); }, true)));
      body.appendChild(h('h4', { class: 'face-h', text: T('face.h.extra') }));
      body.appendChild(UI.toggle(T('face.band'), !!ff.band, (v) => { ff.band = v ? (ff.band || Face.BANDS[0]) : null; update(); rebuild(); }));
      if (ff.band) body.appendChild(field('face.bandcol', swatches(Face.BANDS, ff.band, (c) => { ff.band = c; update(); })));
    }
    rebuild();
    img.src = Face.url(look, 300);
    root.appendChild(h('div', { class: 'face-top' }, img, rnd));
    root.appendChild(body);
    return root;
  };
})((globalThis.FCK = globalThis.FCK || {}));
