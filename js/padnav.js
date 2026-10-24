/* FCK - padnav.js : gamepad navigation for every menu / dialog (spatial focus, select lists, on-screen keyboard, hint bar) + device helpers (devicesFor) */
(function (FCK) {
  'use strict';
  const UI = FCK.UI;
  const h = FCK.h;
  const T = (k, v) => FCK.T(k, v);

  // ====================================================================
  // 1. devices: which controller does player 1.. use?  (shared by every mode)
  // ====================================================================
  FCK.DEFAULTS.pref_dev = 'auto'; // 'auto' | 'kb' | 'pad' | 'touch'

  function padList() {
    const l = (navigator.getGamepads && navigator.getGamepads()) || [];
    const out = [];
    for (let i = 0; i < l.length; i++) if (l[i] && l[i].connected) out.push(l[i]);
    return out;
  }
  function padName(p) {
    let s = String(p && p.id || '').replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*Vendor:.*$/i, '').trim();
    if (s.length > 34) s = s.slice(0, 32) + '…';
    return s || 'Gamepad';
  }
  const PRESET_COUNT = { p1: 1, p2vs: 2, p2co: 2, p4: 4, cpu: 0 };

  // ordered list of device ids (max 4) for human players, honouring FCK.settings.pref_dev
  function deviceOrder(pref) {
    const pads = FCK.input ? FCK.input.padCount() : 0;
    const padDevs = []; for (let i = 0; i < pads; i++) padDevs.push('pad' + i);
    const touch = FCK.isTouchDevice();
    pref = pref || (FCK.settings && FCK.settings.pref_dev) || 'auto';
    let order;
    if (pref === 'kb') order = ['kb1'].concat(padDevs, ['kb2']);
    else if (pref === 'touch') order = ['touch', 'kb1'].concat(padDevs, ['kb2']);
    else if (pref === 'pad' && pads) order = padDevs.concat(['kb1', 'kb2']);
    else if (pads) order = padDevs.concat(touch ? ['touch'] : [], ['kb1', 'kb2']); // auto: a detected controller wins
    else if (touch) order = ['touch', 'kb1', 'kb2', 'pad0'];
    else order = ['kb1', 'kb2', 'pad0', 'pad1'];
    ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3'].forEach((d) => { if (!order.includes(d)) order.push(d); });
    return order.slice(0, 4);
  }
  // devicesFor('p1') -> ['pad0']; devicesFor('p2vs') -> ['pad0','kb1']; devicesFor('cpu') -> []; devicesFor(3) -> first 3 devices
  FCK.devicesFor = function (preset, pref) {
    const n = typeof preset === 'number' ? preset : (PRESET_COUNT[preset] !== undefined ? PRESET_COUNT[preset] : 1);
    return deviceOrder(pref).slice(0, n);
  };
  FCK.autoDevices = () => deviceOrder();
  FCK.primaryDevice = () => deviceOrder()[0];
  FCK.deviceLabel = function (dev) {
    if (!dev || dev === 'none') return T('dev.none');
    if (dev.startsWith('pad')) {
      const n = parseInt(dev.slice(3), 10), p = padList()[n];
      return T('dev.pad') + ' ' + (n + 1) + (p ? ' (' + padName(p) + ')' : '');
    }
    return T('dev.' + dev);
  };

  // ====================================================================
  // 2. registry of elements that have a JS click handler (the UI uses lots of divs/rows)
  // ====================================================================
  const clickable = new WeakSet();
  const origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (type === 'click' && this instanceof Element) clickable.add(this);
    return origAdd.call(this, type, fn, opts);
  };

  // ====================================================================
  // 3. navigation
  // ====================================================================
  const NATIVE = 'button, a[href], input, select, textarea, summary, [tabindex], [role="button"], [role="checkbox"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"], [role="link"]';
  const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  const TEXTY = /^(text|search|email|url|tel|password|number)$/;

  const S = {
    mode: 'mouse', cur: null, last: null, mem: {}, key: '', ov: null, wasActive: false, prev: [], prevLen: 17,
    dir: null, dirNext: 0, t: 0, padN: 0, padStyle: 'xbox', hintKey: '', hintT: 0, pendingPause: false, ptr: { x: -1, y: -1 }, ovId: 0,
  };
  let hintEl = null, ovRoot = null;

  const sfx = (n) => { try { FCK.Audio.play(n); } catch (e) { /* audio not ready */ } };
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

  // ---- layer (what the pad currently controls) ----
  function layerRoot() {
    if (S.ov) return S.ov.el;
    if (UI.modalOpen && UI.modalEl && !UI.modalEl.hidden) return UI.modalEl;
    if (UI.screenEl && !UI.screenEl.hidden) return UI.screenEl;
    const g = FCK.game;
    if (g && g.kind === 'archive' && g.hud && g.hud.el && !g.hud.el.hidden) return g.hud.el.querySelector('.arch-bar') || g.hud.el;
    return null;
  }
  function layerKey(root) {
    if (S.ov) return 'o:' + S.ov.id;
    if (root === UI.modalEl) { const t = root.querySelector('.modal-t'); return 'm:' + (t ? t.textContent : ''); }
    if (root === UI.screenEl) return 's:' + UI.cur;
    return 'a';
  }

  // ---- candidates ----
  // the element that gets the focus ring (a hidden checkbox is represented by its label, a slider by its row)
  function ringOf(el) {
    if (el.tagName === 'INPUT') {
      const t = el.type;
      if (t === 'checkbox' || t === 'radio' || t === 'range') return el.closest('label') || el;
    }
    return el;
  }
  let rectMemo = null; // test helper: cache rects while crawling a static layout
  const rectOf = (el) => { if (rectMemo) { let r = rectMemo.get(el); if (!r) rectMemo.set(el, r = ringOf(el).getBoundingClientRect()); return r; } return ringOf(el).getBoundingClientRect(); };
  function disabled(el) { return !!el.disabled || el.getAttribute('aria-disabled') === 'true'; }

  function isCand(el) {
    if (!(el.matches(NATIVE) || clickable.has(el))) return false;
    if (el.getAttribute('tabindex') === '-1' && !clickable.has(el)) return false;
    if (el.classList.contains('modal-wrap')) return false;
    if (el.tagName === 'INPUT' && (el.type === 'hidden')) return false;
    if (el.tagName === 'TEXTAREA' && el.readOnly) return false;
    if (el.tagName === 'A' && !el.getAttribute('href') && !clickable.has(el)) return false;
    return !disabled(el);
  }
  function visible(el) {
    const r = ringOf(el);
    if (!r.isConnected) return false;
    const rc = r.getBoundingClientRect();
    if (rc.width < 2 || rc.height < 2) return false;
    const cs = getComputedStyle(r);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || cs.display === 'none') return false;
    if (r.closest('[hidden], [inert]')) return false;
    const det = r.closest('details:not([open])');
    if (det) { const sm = r.closest('summary'); if (!(sm && sm.parentElement === det)) return false; }
    return true;
  }
  function collect(root) {
    const out = [], seen = new Set();
    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (!isCand(el) || !visible(el)) continue;
      const r = ringOf(el);
      if (seen.has(r)) continue;
      seen.add(r); out.push(el);
    }
    // drop huge click-containers that merely wrap other candidates
    const rr = root.getBoundingClientRect(), area = rr.width * rr.height;
    return out.filter((el) => {
      if (el.matches('button, a[href], input, select, textarea, summary')) return true;
      const q = rectOf(el);
      if (q.width * q.height < area * 0.8) return true;
      return !out.some((o) => o !== el && el.contains(o));
    });
  }
  function valid(el, root) { return !!el && el.isConnected && root.contains(el) && !disabled(el) && visible(el); }

  // ---- identity of an element (survives a re-render of the screen) ----
  function sigOf(el) {
    const r = rectOf(el);
    return {
      tag: el.tagName, text: el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? '' : (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      label: el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '', cx: r.left + r.width / 2, cy: r.top + r.height / 2,
    };
  }
  function matchSig(cands, sig, loose) {
    let best = null, bd = Infinity;
    const d2 = (c) => { const r = rectOf(c); return Math.pow(r.left + r.width / 2 - sig.cx, 2) + Math.pow(r.top + r.height / 2 - sig.cy, 2); };
    for (const c of cands) {
      const s = sigOf(c);
      if (s.tag === sig.tag && s.text === sig.text && s.label === sig.label) { const d = d2(c); if (d < bd) { bd = d; best = c; } }
    }
    if (best || !loose) return best;
    for (const c of cands) { const d = d2(c); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  // ---- first focus on a new screen / dialog ----
  function initialFocus(root, cands) {
    const pref = root.querySelector('[data-padfocus]');
    if (pref && cands.includes(pref)) return pref;
    const texty = (c) => (c.tagName === 'INPUT' && TEXTY.test(c.type)) || c.tagName === 'TEXTAREA';
    const inModal = root === UI.modalEl;
    if (inModal) {
      const pk = cands.find((c) => c.classList.contains('pick') && c.classList.contains('on')) || cands.find((c) => c.classList.contains('pick'));
      if (pk) return pk;
    }
    const fits = (c) => { const r = rectOf(c); return r.top >= 0 && r.bottom <= innerHeight - 70; }; // a primary button that needs scrolling is not worth the jump
    const prim = cands.find((c) => c.matches('.btn.primary, .mitem.primary') && !c.closest('.topbar') && fits(c));
    if (prim) return prim;
    const body = cands.find((c) => !c.closest('.topbar') && !c.classList.contains('back') && !texty(c) && !c.classList.contains('fs-btn'));
    return body || cands.find((c) => !texty(c)) || cands[0];
  }

  // ---- focus ring ----
  function clearRing() { document.querySelectorAll('.padfocus').forEach((n) => n.classList.remove('padfocus')); }
  function setCur(el, o) {
    clearRing();
    S.cur = el || null;
    if (!el) return;
    const r = ringOf(el);
    r.classList.add('padfocus');
    S.last = sigOf(el); S.mem[S.key] = S.last;
    if (!(o && o.noScroll)) {
      try { r.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* old browser */ }
      [document.documentElement, document.body, UI.root].forEach((n) => { if (n && (n.scrollTop || n.scrollLeft)) { n.scrollTop = 0; n.scrollLeft = 0; } });
    }
    S.hintKey = '';
  }
  function ensureFocus() {
    const root = layerRoot();
    if (!root) { if (S.cur) { clearRing(); S.cur = null; } return; }
    const key = layerKey(root);
    const changed = key !== S.key;
    S.key = key;
    if (!changed && S.cur && valid(S.cur, root)) return;
    const cands = collect(root);
    if (!cands.length) { if (S.cur) { clearRing(); S.cur = null; } return; }
    const sig = changed ? S.mem[key] : S.last;
    let t = sig ? matchSig(cands, sig, !changed) : null;
    if (!t) t = initialFocus(root, cands);
    setCur(t);
  }

  // ---- scrolling ----
  function scrollParent(el) {
    for (let p = el && el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 2) return p;
    }
    return null;
  }
  function mainScroller(root) {
    const sp = S.cur ? scrollParent(ringOf(S.cur)) : null;
    if (sp) return sp;
    if (root.scrollHeight > root.clientHeight + 2) return root;
    const m = root.querySelector('.modal, .padbox, .padlist');
    return m && m.scrollHeight > m.clientHeight + 2 ? m : null;
  }
  function inView(el, sc) {
    const r = rectOf(el), v = sc ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    return r.bottom > v.top + 8 && r.top < v.bottom - 8;
  }
  // after the content scrolled away from the focus: take the nearest visible element at the matching edge
  function repick(root, sc, dir) {
    const cands = collect(root);
    const v = sc ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    const vis = cands.filter((c) => { const r = rectOf(c); return r.top >= v.top - 2 && r.bottom <= v.bottom + 2; });
    if (!vis.length) return false;
    const cr = S.cur ? rectOf(S.cur) : { left: 0, width: 0 };
    const cx = cr.left + cr.width / 2;
    vis.sort((a, b) => {
      const ra = rectOf(a), rb = rectOf(b);
      const ya = dir === 'up' || dir === 'pgup' ? -ra.bottom : ra.top, yb = dir === 'up' || dir === 'pgup' ? -rb.bottom : rb.top;
      if (Math.abs(ya - yb) > 6) return ya - yb;
      return Math.abs(ra.left + ra.width / 2 - cx) - Math.abs(rb.left + rb.width / 2 - cx);
    });
    setCur(vis[0], { noScroll: true });
    return true;
  }
  function page(dir) {
    const root = layerRoot(); if (!root) return;
    const sc = mainScroller(root); if (!sc) return;
    const before = sc.scrollTop;
    sc.scrollTop += (dir === 'pgdn' ? 1 : -1) * sc.clientHeight * 0.8;
    if (sc.scrollTop !== before) { repick(root, sc, dir); sfx('tick'); }
  }

  // ---- spatial movement ----
  function pickDir(from, dir, cands, needRowMate, relaxed) {
    const r = rectOf(from);
    const horiz = dir === 'left' || dir === 'right';
    const sgn = dir === 'right' || dir === 'down' ? 1 : -1;
    const c0 = horiz ? (r.left + r.right) / 2 : (r.top + r.bottom) / 2;
    const x0 = horiz ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2;
    const e0 = horiz ? (sgn > 0 ? r.right : r.left) : (sgn > 0 ? r.bottom : r.top);
    let best = null, bs = Infinity;
    for (const c of cands) {
      if (c === from) continue;
      const q = rectOf(c);
      const qc = horiz ? (q.left + q.right) / 2 : (q.top + q.bottom) / 2;
      const qx = horiz ? (q.top + q.bottom) / 2 : (q.left + q.right) / 2;
      const qe = horiz ? (sgn > 0 ? q.left : q.right) : (sgn > 0 ? q.top : q.bottom);
      if (relaxed ? (horiz ? (sgn > 0 ? q.left - r.left : r.right - q.right) : (sgn > 0 ? q.top - r.top : r.bottom - q.bottom)) <= 1 : (qc - c0) * sgn <= 1) continue;
      const a0 = horiz ? r.top : r.left, a1 = horiz ? r.bottom : r.right;
      const b0 = horiz ? q.top : q.left, b1 = horiz ? q.bottom : q.right;
      const ov = Math.min(a1, b1) - Math.max(a0, b0);
      if (needRowMate && ov < Math.min(a1 - a0, b1 - b0) * 0.4) continue;
      const prim = Math.max(0, (qe - e0) * sgn) + Math.abs(qc - c0) * 0.15;
      const cross = ov > 0 ? Math.abs(qx - x0) * 0.35 : 120 + -ov * 3 + Math.abs(qx - x0) * 0.5;
      const sc = prim + cross + (horiz ? q.top : q.left) * 0.05; // tie: reading order
      if (sc < bs) { bs = sc; best = c; }
    }
    return best;
  }
  function spatial(dir) {
    const root = layerRoot(); if (!root) return;
    if (!S.cur || !valid(S.cur, root)) { ensureFocus(); return; }
    const sc = mainScroller(root);
    if (!inView(S.cur, sc) && (dir === 'up' || dir === 'down') && repick(root, sc, dir)) return;
    const cands = collect(root);
    let t = pickDir(S.cur, dir, cands, false, false) || pickDir(S.cur, dir, cands, false, true);
    if (t) { setCur(t); sfx('tick'); return; }
    // nothing there: let long read-only pages scroll
    if ((dir === 'up' || dir === 'down') && sc) {
      const before = sc.scrollTop;
      sc.scrollTop += (dir === 'down' ? 1 : -1) * sc.clientHeight * 0.6;
      if (sc.scrollTop !== before) sfx('tick');
    }
  }

  // ---- value controls ----
  function rangeParams(inp) {
    const min = inp.min === '' ? 0 : parseFloat(inp.min), max = inp.max === '' ? 100 : parseFloat(inp.max);
    const step = !inp.step || inp.step === 'any' ? 1 : parseFloat(inp.step);
    return { min, max, step };
  }
  function stepNumeric(inp, d) {
    const p = rangeParams(inp);
    const steps = (p.max - p.min) / p.step;
    const mult = inp.type === 'range' && steps > 120 ? Math.ceil(steps / 60) : 1;
    const dec = (String(p.step).split('.')[1] || '').length;
    const cur = parseFloat(inp.value);
    let v = (isNaN(cur) ? p.min : cur) + d * p.step * mult;
    v = Math.min(p.max, Math.max(p.min, Math.round((v - p.min) / p.step) * p.step + p.min));
    v = parseFloat(v.toFixed(Math.max(dec, 0) + 1));
    if (!isNaN(cur) && Math.abs(v - cur) < 1e-9) return false;
    inp.value = String(v);
    fire(inp, 'input'); fire(inp, 'change');
    sfx('tick');
    return true;
  }
  function stepSelect(sel, d) {
    let i = sel.selectedIndex;
    do { i += d; } while (i >= 0 && i < sel.options.length && sel.options[i].disabled);
    if (i < 0 || i >= sel.options.length) return false;
    sel.selectedIndex = i;
    fire(sel, 'input'); fire(sel, 'change');
    sfx('tick');
    return true;
  }
  // a chip group where exactly one chip is selected acts like a segmented control
  function chipGroup(el) {
    if (!el.classList.contains('chip')) return null;
    const g = el.closest('.chips');
    return g && g.querySelectorAll('.chip.on').length === 1 ? g : null;
  }
  // what would a direction press on c do?  -> 'value' (steps a slider / number / select), an element (focus moves there) or null
  function dirPlan(c, dir, root, cands) {
    if (dir === 'left' || dir === 'right') {
      if (c.tagName === 'INPUT' && c.type === 'range') return 'value';
      if (c.tagName === 'SELECT' && !pickDir(c, dir, cands, true, false)) return 'value';
    }
    return pickDir(c, dir, cands, false, false) || pickDir(c, dir, cands, false, true);
  }
  function onDir(dir, fresh) {
    const root = layerRoot(); if (!root) return;
    if (!S.cur || !valid(S.cur, root)) { ensureFocus(); return; }
    const c = S.cur;
    if (dir === 'left' || dir === 'right') {
      const d = dir === 'right' ? 1 : -1;
      if (c.tagName === 'INPUT' && c.type === 'range') { if (stepNumeric(c, d) || !fresh) return; } // at the end a fresh press leaves sideways
      else if (c.tagName === 'SELECT' && dirPlan(c, dir, root, collect(root)) === 'value') { if (stepSelect(c, d) || !fresh) return; }
    }
    spatial(dir);
  }

  // ---- activation ----
  function activate(el) {
    if (!el) return;
    if (el.tagName === 'SELECT') return openSelect(el);
    if (el.tagName === 'INPUT') {
      if (el.type === 'range') return;
      if (TEXTY.test(el.type)) return openText(el);
    }
    if (el.tagName === 'TEXTAREA') return openText(el);
    el.click();
  }

  // ---- back / tabs / start ----
  function visibleBtn(root, sel) {
    return Array.from(root.querySelectorAll(sel)).find((b) => !disabled(b) && visible(b)) || null;
  }
  // a "‹ Back" style button: .btn.back, or any visible button whose label starts with ‹ (the hub screens use a round one)
  function findBack(root) {
    return visibleBtn(root, '.btn.back') || Array.from(root.querySelectorAll('button')).find((b) => /^‹/.test(b.textContent.trim()) && !disabled(b) && visible(b)) || null;
  }
  function back() {
    if (S.ov) { S.ov.cancel(); return; }
    const g = FCK.game, root = layerRoot(); if (!root) return;
    if (root === UI.modalEl) {
      const bk = findBack(root);
      if (bk) { bk.click(); return; }
      const words = [T('cancel'), T('close'), T('back')];
      const hit = Array.from(root.querySelectorAll('button')).filter((b) => !disabled(b) && visible(b)).reverse()
        .find((b) => words.some((w) => { const t = b.textContent.trim(); return t === w || t.endsWith(' ' + w); }));
      if (hit) { hit.click(); return; }
      const wrap = root.querySelector('.modal-wrap');
      if (g && g.kind === 'match' && g.paused && !g.breakShown && wrap && wrap.classList.contains('pause')) { g.resume(); return; }
      if (wrap && !wrap._sticky) UI.closeModal();
      return;
    }
    const bk = findBack(root);
    if (bk) { bk.click(); return; }
    if (g && g.kind === 'archive') g.closeArchive();
  }
  function tabs(d) {
    const root = layerRoot(); if (!root) return;
    let grp = null;
    const all = Array.from(root.querySelectorAll('.chips.tabs')).filter((g) => { const f = g.querySelector('.chip'); return f && visible(f); });
    if (all.length) {
      grp = all.find((g) => S.cur && g.contains(S.cur));
      if (!grp) { const cy = S.cur ? rectOf(S.cur).top : 0; grp = all.slice().sort((a, b) => Math.abs(a.getBoundingClientRect().top - cy) - Math.abs(b.getBoundingClientRect().top - cy))[0]; }
    } else if (S.cur) grp = S.cur.closest('.chips');
    if (!grp) return;
    const chips = Array.from(grp.querySelectorAll('.chip')).filter((c) => !c.disabled);
    let i = chips.findIndex((c) => c.classList.contains('on')); if (i < 0) i = 0;
    const n = chips[i + d];
    if (!n) return;
    if (S.cur && grp.contains(S.cur)) setCur(n);
    else try { n.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) { /* ignore */ }
    n.click(); sfx('tick');
  }
  function primaryBtn(root) {
    return visibleBtn(root, '.topbar .btn.primary') || visibleBtn(root, '.btn.primary.xl') || visibleBtn(root, '.btn.primary') || visibleBtn(root, '.mitem.primary');
  }
  function ctx(letter) {
    const root = layerRoot(); if (!root) return;
    const el = visibleBtn(root, '[data-pad-' + letter + ']');
    if (el) { el.click(); return; }
    if (letter === 'x') { // quick access to a search box
      const s = Array.from(root.querySelectorAll('input[type=search], input[type=text]')).find((i) => visible(i) && !i.readOnly);
      if (s) openText(s);
    }
  }

  // ====================================================================
  // 4. overlays: option list for <select>, on-screen keyboard
  // ====================================================================
  function ensureDom() {
    if (ovRoot || !UI.root) return;
    ovRoot = h('div', { id: 'padui' });
    hintEl = h('div', { class: 'padhints', hidden: true, 'aria-hidden': 'true' });
    ovRoot.appendChild(hintEl);
    UI.root.appendChild(ovRoot);
  }
  function openOverlay(kind, box, extra) {
    ensureDom();
    closeOverlay(true);
    const el = h('div', { class: 'padov ' + kind, role: 'dialog', 'aria-modal': 'true' }, box);
    const ov = Object.assign({ id: ++S.ovId, el, kind, cancel: () => closeOverlay() }, extra);
    el.addEventListener('pointerdown', (e) => { if (e.target === el) ov.cancel(); });
    ovRoot.appendChild(el);
    S.ov = ov; S.under = S.cur;
    document.documentElement.classList.add('padov-open');
    S.key = ''; // force a fresh focus choice
    ensureFocus();
    return ov;
  }
  function closeOverlay(quiet) {
    if (!S.ov) return;
    S.ov.el.remove(); S.ov = null;
    document.documentElement.classList.remove('padov-open');
    if (!quiet) { S.key = ''; ensureFocus(); }
  }

  // pad friendly replacement for the native select popup
  function openList(o) {
    const list = h('div', { class: 'padlist' });
    o.options.forEach((op) => {
      const b = h('button', { class: 'padopt' + (op.v === o.value ? ' on' : ''), type: 'button', disabled: op.disabled ? true : null, 'data-padfocus': op.v === o.value ? '1' : null }, op.l);
      b.addEventListener('click', () => { sfx('ok'); closeOverlay(); o.onPick(op.v); });
      list.appendChild(b);
    });
    const box = h('div', { class: 'padbox card' }, o.title ? h('h3', { class: 'modal-t', text: o.title }) : null, list,
      h('div', { class: 'row center' }, (() => { const c = h('button', { class: 'btn ghost sm', type: 'button' }, T('cancel')); c.addEventListener('click', () => closeOverlay()); return c; })()));
    openOverlay('list', box);
  }
  function openSelect(sel) {
    const options = Array.from(sel.options).map((op) => ({ v: op.value, l: op.textContent, disabled: op.disabled }));
    openList({
      title: sel.getAttribute('aria-label') || '', options, value: sel.value,
      onPick: (v) => { sel.value = v; fire(sel, 'input'); fire(sel, 'change'); },
    });
  }

  // minimal on-screen keyboard for text inputs
  function openText(inp) {
    if (inp.readOnly || inp.disabled) return;
    const numeric = inp.type === 'number';
    const maxLen = inp.maxLength > 0 ? inp.maxLength : (numeric ? 9 : 120);
    let val = String(inp.value || ''), shift = !val && !numeric;
    const prev = h('div', { class: 'osk-prev' });
    const keys = h('div', { class: 'osk-keys' });
    const render = () => { prev.textContent = ''; prev.appendChild(h('span', { text: val })); prev.appendChild(h('i', { class: 'osk-caret' })); prev.appendChild(h('small', { text: val.length + '/' + maxLen })); };
    const put = (ch) => { if (val.length < maxLen) { val += ch; if (shift) { shift = false; relabel(); } render(); sfx('tick'); } };
    const del = () => { val = val.slice(0, -1); render(); sfx('tick'); };
    const done = () => {
      if (numeric && val !== '' && isNaN(parseFloat(val))) val = '';
      inp.value = val; fire(inp, 'input'); fire(inp, 'change'); sfx('ok'); closeOverlay();
    };
    const letterEls = [];
    const relabel = () => letterEls.forEach((k) => { k.el.textContent = shift ? k.ch.toUpperCase() : k.ch; });
    const key = (label, fn, cls, ch) => {
      const b = h('button', { class: 'osk-k' + (cls ? ' ' + cls : ''), type: 'button' }, label);
      b.addEventListener('click', fn);
      if (ch) letterEls.push({ el: b, ch });
      return b;
    };
    const rows = numeric ? ['1234567890', '-.'] : ['1234567890', 'abcdefghij', 'klmnopqrst', 'uvwxyzäöüß', "-_.,!?&@+'"];
    rows.forEach((r, ri) => {
      const row = h('div', { class: 'osk-row' });
      r.split('').forEach((ch, ci) => {
        const isL = /[a-zäöüß]/.test(ch) && ch !== 'ß';
        const k = key(ch, () => put(isL && shift ? ch.toUpperCase() : ch), '', isL ? ch : null);
        if (ri === 0 && ci === 0 || (numeric && ri === 0 && ci === 0)) k.setAttribute('data-padfocus', '1');
        if (!numeric && ri === 1 && ci === 0) k.setAttribute('data-padfocus', '1');
        row.appendChild(k);
      });
      keys.appendChild(row);
    });
    // a single 'data-padfocus': prefer the first letter key on the text keyboard
    if (!numeric) { const f = keys.querySelectorAll('[data-padfocus]'); if (f.length > 1) f[0].removeAttribute('data-padfocus'); }
    const act = h('div', { class: 'osk-row act' });
    if (!numeric) {
      act.appendChild(key('⇧', () => { shift = !shift; relabel(); }, 'wide'));
      act.appendChild(key(T('pad.osk.space'), () => put(' '), 'space'));
    }
    act.appendChild(key('⌫', del, 'wide'));
    act.appendChild(key(T('pad.osk.cancel'), () => closeOverlay(), 'wide'));
    act.appendChild(key(T('pad.osk.ok'), done, 'wide ok'));
    keys.appendChild(act);
    render();
    const title = inp.getAttribute('aria-label') || inp.getAttribute('placeholder') || T('pad.osk.title');
    const box = h('div', { class: 'padbox osk card' }, h('h3', { class: 'modal-t', text: title }), prev, keys);
    openOverlay('osk', box, { x: () => put(' '), y: del, start: done });
    relabel();
  }

  // ====================================================================
  // 5. polling
  // ====================================================================
  function readPads() {
    const list = padList();
    const st = { n: list.length, b: new Array(17).fill(false), ax: 0, ay: 0, ry: 0, startPads: [], id: list[0] ? String(list[0].id || '') : '' };
    list.forEach((p, n) => {
      const bp = (i) => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
      for (let i = 0; i < 17; i++) if (bp(i)) st.b[i] = true;
      if (bp(B.START)) st.startPads.push(n);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0, ry = p.axes[3] || 0;
      if (Math.abs(ax) > Math.abs(st.ax)) st.ax = ax;
      if (Math.abs(ay) > Math.abs(st.ay)) st.ay = ay;
      if (Math.abs(ry) > Math.abs(st.ry)) st.ry = ry;
    });
    return st;
  }
  function dirOf(p) {
    if (p.b[B.UP]) return 'up';
    if (p.b[B.DOWN]) return 'down';
    if (p.b[B.LEFT]) return 'left';
    if (p.b[B.RIGHT]) return 'right';
    const th = S.dir && DIRS[S.dir] ? 0.35 : 0.55; // hysteresis
    const ax = Math.abs(p.ax), ay = Math.abs(p.ay);
    if (Math.max(ax, ay) > th) return ax > ay ? (p.ax < 0 ? 'left' : 'right') : (p.ay < 0 ? 'up' : 'down');
    if (p.b[B.LT]) return 'pgup';
    if (p.b[B.RT]) return 'pgdn';
    return null;
  }
  function setMode(m) {
    if (S.mode === m) return;
    S.mode = m;
    document.documentElement.classList.toggle('padmode', m === 'pad');
    S.hintKey = '';
  }
  function matchOwnsStart(startPads) {
    const g = FCK.game;
    if (!g || g.kind !== 'match' || !g.m || !g.paused || g.breakShown || g.replay) return false;
    return true;
  }
  // returns true when the menu used the press (then the match input must not see it again)
  function onStart(startPads) {
    const g = FCK.game;
    if (S.ov && S.ov.start) { S.ov.start(); return true; }
    if (S.ov) return false;
    if (matchOwnsStart()) {
      // the match input resumes on Start for pads that play; handle spectators / keyboard players here
      const slotPads = g.m.slots.filter((s) => s.dev && s.dev.startsWith('pad')).map((s) => parseInt(s.dev.slice(3), 10));
      if (startPads.every((n) => slotPads.includes(n))) return false;
      g.resume(); return true;
    }
    const root = layerRoot(); if (!root) return false;
    const p = primaryBtn(root);
    if (p) { p.click(); return true; }
    return false;
  }
  function onButton(i, pads) {
    if (i === B.A) { activate(S.cur); return true; }
    if (i === B.B) { back(); return true; }
    if (i === B.X) { if (S.ov && S.ov.x) S.ov.x(); else ctx('x'); return true; }
    if (i === B.Y) { if (S.ov && S.ov.y) S.ov.y(); else ctx('y'); return true; }
    if (i === B.LB) { if (!S.ov) tabs(-1); return true; }
    if (i === B.RB) { if (!S.ov) tabs(1); return true; }
    if (i === B.START) return onStart(pads.startPads);
    return false;
  }

  function tick(ts) {
    requestAnimationFrame(tick);
    if (!UI.root) return;
    ensureDom();
    const now = ts || performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - (S.t || now)) / 1000)); S.t = now;
    const pads = readPads();
    if (pads.n !== S.padN) { S.padN = pads.n; S.hintKey = ''; }
    if (pads.id !== S.padId) { S.padId = pads.id; S.padStyle = /054c|playstation|dualshock|dualsense|sony|wireless controller \(.*(054c)/i.test(pads.id) ? 'ps' : 'xbox'; S.hintKey = ''; }
    // a controller got unplugged during a match: pause as soon as the game can
    if (S.pendingPause) {
      const g = FCK.game;
      if (g && g.kind === 'match' && g.m && !g.replay && !g.paused && !g.breakShown && g.m.mode !== 'over') { g.pause(); S.pendingPause = false; }
      else if (!g || g.kind !== 'match') S.pendingPause = false;
    }
    const root = layerRoot();
    const dirNow = dirOf(pads);
    if (!root || !pads.n) {
      S.wasActive = false; S.prev = pads.b.slice(); S.dir = dirNow; S.dirNext = Infinity;
      if (hintEl && !hintEl.hidden) hintEl.hidden = true;
      return;
    }
    if (!S.wasActive) {
      S.wasActive = true;
      if (S.mode === 'pad') { // menu appeared while the pad was in use (match ended): swallow whatever is still held
        S.prev = pads.b.slice(); S.dir = dirNow; S.dirNext = Infinity;
        ensureFocus(); updateHints();
        return;
      }
      S.prev = []; S.dir = null; // cold start / mouse use: the first press only reveals the focus
    }
    const edges = [];
    for (let i = 0; i < 17; i++) if (pads.b[i] && !S.prev[i]) edges.push(i);
    S.prev = pads.b.slice();
    const activity = edges.length > 0 || dirNow || Math.abs(pads.ry) > 0.5;
    if (activity && S.mode !== 'pad') {
      // first touch after mouse/keyboard use: only show the focus, do not act
      setMode('pad'); ensureFocus(); S.dir = dirNow; S.dirNext = now + 380; updateHints();
      return;
    }
    ensureFocus();
    // buttons
    let acted = false;
    edges.forEach((i) => { if (i !== B.UP && i !== B.DOWN && i !== B.LEFT && i !== B.RIGHT && i !== B.LT && i !== B.RT && onButton(i, pads)) acted = true; });
    // a press used by the menu must not also act in the match input (resume / continue / quit happen while the match loop keeps polling)
    if (acted && FCK.game && FCK.game.kind === 'match' && FCK.input && FCK.input.primePads) FCK.input.primePads();
    // direction with key repeat
    if (dirNow !== S.dir) {
      S.dir = dirNow; S.dirNext = now + 380;
      if (dirNow) dirNow === 'pgup' || dirNow === 'pgdn' ? page(dirNow) : onDir(dirNow, true);
    } else if (dirNow && now >= S.dirNext) {
      S.dirNext = now + 110;
      dirNow === 'pgup' || dirNow === 'pgdn' ? page(dirNow) : onDir(dirNow, false);
    }
    // right stick scrolls long pages / lists
    if (Math.abs(pads.ry) > 0.25) {
      const sc = mainScroller(root);
      if (sc) { sc.scrollTop += pads.ry * 1100 * dt; S.scrolling = now; }
    } else if (S.scrolling && now - S.scrolling > 180) {
      S.scrolling = 0;
      const sc = mainScroller(root);
      if (S.cur && sc && !inView(S.cur, sc)) repick(root, sc, 'down');
    }
    if (now - S.hintT > 400) { S.hintT = now; updateHints(); }
    else if (!S.hintKey) updateHints();
  }

  // ====================================================================
  // 6. hint bar
  // ====================================================================
  const GLYPH = {
    xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', start: 'Start' },
    ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', start: 'Options' },
  };
  function updateHints() {
    if (!hintEl) return;
    const root = layerRoot();
    const show = S.mode === 'pad' && S.padN > 0 && !!root;
    document.documentElement.classList.toggle('padhint', show);
    if (!show) { if (!hintEl.hidden) hintEl.hidden = true; S.hintKey = ''; return; }
    const g = GLYPH[S.padStyle] || GLYPH.xbox;
    const c = S.cur, items = [];
    const add = (btn, label, cls, wrap) => items.push([btn, label, cls, wrap || '']);
    const sc = mainScroller(root);
    if (S.ov && S.ov.kind === 'osk') {
      add(g.a, T('pad.h.select'), 'a'); add(g.y, T('pad.h.del'), 'y'); add(g.x, T('pad.h.space'), 'x'); add(g.b, T('pad.h.cancel'), 'b'); add(g.start, T('pad.h.ok'), 'st');
    } else {
      let aLabel = T('pad.h.select');
      if (c) {
        if (c.tagName === 'SELECT') aLabel = T('pad.h.open');
        else if (c.tagName === 'INPUT' && c.type === 'checkbox') aLabel = T('pad.h.toggle');
        else if (c.tagName === 'INPUT' && TEXTY.test(c.type) || c.tagName === 'TEXTAREA') aLabel = T('pad.h.type');
      }
      const isRange = c && c.tagName === 'INPUT' && c.type === 'range';
      if (!isRange) add(g.a, aLabel, 'a');
      const wrap = root === UI.modalEl ? root.querySelector('.modal-wrap') : null;
      let bLabel = null;
      if (S.ov) bLabel = T('pad.h.cancel');
      else if (root === UI.modalEl) bLabel = wrap && wrap.classList.contains('pause') && FCK.game && FCK.game.paused && !FCK.game.breakShown && !findBack(root) ? T('pad.h.resume') : (findBack(root) ? T('pad.h.back') : (wrap && wrap._sticky && !Array.from(root.querySelectorAll('button')).some((b) => /^(.* )?(Abbrechen|Schließen|Cancel|Close)$/.test(b.textContent.trim())) ? null : T('pad.h.close')));
      else if (findBack(root)) bLabel = T('pad.h.back');
      else if (FCK.game && FCK.game.kind === 'archive') bLabel = T('pad.h.close');
      if (bLabel) add(g.b, bLabel, 'b');
      const canChange = c && ((c.tagName === 'INPUT' && c.type === 'range') || (c.tagName === 'SELECT' && !pickDir(c, 'right', collect(root), true, false) && !pickDir(c, 'left', collect(root), true, false)));
      if (canChange) add('◀ ▶', T('pad.h.change'), 'dp');
      else add('✥', T('pad.h.move'), 'dp', 'mv');
      if (!S.ov && Array.from(root.querySelectorAll('.chips.tabs')).some((t) => t.querySelector('.chip') && visible(t.querySelector('.chip')))) add(g.lb + ' ' + g.rb, T('pad.h.tabs'), 'lr');
      else if (!S.ov && c && chipGroup(c)) add(g.lb + ' ' + g.rb, T('pad.h.change'), 'lr');
      if (sc && sc.scrollHeight > sc.clientHeight + 40) add(g.lt + ' ' + g.rt, T('pad.h.scroll'), 'lr');
      if (!S.ov) {
        const p = primaryBtn(root);
        const own = FCK.game && FCK.game.kind === 'match' && FCK.game.paused && !FCK.game.breakShown;
        if (own) add(g.start, T('pad.h.resume'), 'st');
        else if (p) add(g.start, ((p.querySelector('b') || p).textContent || '').replace(/^[▶↻⚽✓✕›‹\s]+/, '').trim().slice(0, 22) || T('pad.h.start'), 'st');
      }
    }
    const key = S.padStyle + '|' + items.map((i) => i.join('~')).join('|');
    if (key === S.hintKey) { if (hintEl.hidden) hintEl.hidden = false; return; }
    S.hintKey = key;
    hintEl.innerHTML = '';
    items.forEach((it) => hintEl.appendChild(h('span', { class: 'ph ' + it[3] }, h('b', { class: 'pk pk-' + it[2], text: it[0] }), h('span', { text: it[1] }))));
    hintEl.hidden = false;
  }

  // ====================================================================
  // 7. mouse / keyboard / touch switch the focus ring off again
  // ====================================================================
  function initListeners() {
    const d = document;
    d.addEventListener('pointerdown', (e) => {
      setMode(e.pointerType === 'touch' ? 'touch' : 'mouse');
      // the click position becomes the pad cursor: remember the clicked control
      let n = e.target;
      while (n && n.nodeType === 1 && n !== d.body) {
        if (isCand(n) && (n === e.target || n.matches('button, a[href], [role], [tabindex]') || clickable.has(n))) { const r = layerRoot(); if (r && r.contains(n)) { S.key = layerKey(r); setCur(n, { noScroll: true }); } break; }
        n = n.parentElement;
      }
    }, true);
    d.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const moved = Math.abs(e.clientX - S.ptr.x) + Math.abs(e.clientY - S.ptr.y);
      if (S.ptr.x >= 0 && moved > 4) setMode('mouse');
      S.ptr.x = e.clientX; S.ptr.y = e.clientY;
    }, true);
    d.addEventListener('keydown', (e) => { if (e.isTrusted && !e.repeat) setMode('kb'); }, true);
    window.addEventListener('gamepadconnected', () => { S.hintKey = ''; });
    window.addEventListener('gamepaddisconnected', () => {
      S.hintKey = '';
      const g = FCK.game;
      const playing = g && g.kind === 'match' && g.m && g.m.mode !== 'over' && g.m.slots.some((s) => s.dev && s.dev.startsWith('pad'));
      UI.toast(playing ? T('pad.disconnected.pause') : T('pad.disconnected'), 3200);
      if (playing) { if (!g.paused && !g.replay && !g.breakShown) g.pause(); else if (!g.paused) S.pendingPause = true; }
    });
  }

  // ====================================================================
  // 8. UI pieces for other screens
  // ====================================================================
  const refreshers = [];
  function refreshAll() { for (let i = refreshers.length - 1; i >= 0; i--) { if (!refreshers[i].el.isConnected) refreshers.splice(i, 1); else refreshers[i].fn(); } }
  window.addEventListener('gamepadconnected', refreshAll);
  window.addEventListener('gamepaddisconnected', refreshAll);

  const PREFS = () => ['auto', 'kb', 'pad', 'touch'].map((v) => ({ v, l: T('pref.' + v) }));

  // compact "Steuerung" line: which device does player 1 use?  src: () => preset | slots[] ; onChange called after the preference was changed
  function controlLine(src, onChange) {
    const txt = h('span', { class: 'ctl-t' });
    const el = h('div', { class: 'ctl-line' }, h('span', { class: 'ctl-ic', 'aria-hidden': 'true', text: '🎮' }), txt);
    const update = () => {
      const v = src();
      let devs, human = true;
      if (Array.isArray(v)) devs = v.filter((s) => s.dev && s.dev !== 'none').map((s) => s.dev);
      else devs = FCK.devicesFor(v);
      txt.textContent = '';
      txt.appendChild(h('b', { text: T('pad.line') + ': ' }));
      if (!devs.length) { human = false; txt.appendChild(document.createTextNode(T('setup.spectate'))); }
      else txt.appendChild(document.createTextNode(devs.map((d, i) => T('pad.line.p', { n: i + 1, d: FCK.deviceLabel(d) })).join(' · ')));
      if (human && !(FCK.input && FCK.input.padCount())) txt.appendChild(h('small', { class: 'ctl-h', text: ' ' + T('pad.line.hint') }));
    };
    const chg = UI.btn(T('pad.line.change'), () => {
      openList({
        title: T('pad.line.pick'), options: PREFS(), value: FCK.settings.pref_dev || 'auto',
        onPick: (v) => { FCK.settings.pref_dev = v; FCK.saveSettings(); update(); if (onChange) onChange(v); },
      });
    }, 'ghost sm');
    el.appendChild(chg);
    update();
    refreshers.push({ el, fn: update });
    // re-render when the preset chips right above this line change (their handlers ran before this listener)
    setTimeout(() => { const p = el.previousElementSibling; if (p) origAdd.call(p, 'click', () => setTimeout(update, 0)); }, 0);
    return el;
  }

  // settings card: preferred device + live list of detected controllers
  function settingsSection() {
    const list = h('div', { class: 'pad-found' });
    const upd = () => {
      list.innerHTML = '';
      const ps = padList();
      if (!ps.length) { list.appendChild(h('p', { class: 'fine', text: T('pad.set.none') })); return; }
      list.appendChild(h('p', { class: 'fine ok', text: '🎮 ' + T('pad.set.found', { n: ps.length }) }));
      ps.forEach((p, i) => list.appendChild(h('div', { class: 'pad-row' }, h('b', { text: T('pad.set.slot', { n: i + 1 }) }), h('span', { text: padName(p) }))));
    };
    upd();
    const sec = UI.section(T('pad.set.title'),
      h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('pad.set.pref') }), UI.chips(PREFS(), FCK.settings.pref_dev || 'auto', (v) => { FCK.settings.pref_dev = v; FCK.saveSettings(); })),
      h('p', { class: 'fine', text: T('pad.set.help') }), list);
    refreshers.push({ el: sec, fn: upd });
    const iv = setInterval(() => { if (!sec.isConnected) clearInterval(iv); else upd(); }, 1500);
    return sec;
  }

  // help screen: menu + match layout
  function helpSection() {
    const k = (a, b) => h('tr', null, h('td', null, h('kbd', { text: a })), h('td', { text: b }));
    return h('section', { class: 'card sect' }, h('h3', { text: T('pad.help.menu') }), h('table', { class: 'keys' }, h('tbody', null,
      k('✥ / L-Stick', T('pad.help.m.move')), k('A / ✕', T('pad.help.m.ok')), k('B / ○', T('pad.help.m.back')), k('LB RB / L1 R1', T('pad.help.m.tabs')),
      k('LT RT / R-Stick', T('pad.help.m.page')), k('Start', T('pad.help.m.start')), k('◀ ▶', T('pad.help.m.change'))),
    ), h('p', { class: 'fine', text: T('pad.help.m.text') }),
    h('h3', { text: T('pad.help.play') }), h('table', { class: 'keys' }, h('tbody', null,
      k(T('pad.help.p.att'), T('pad.help.p.att.v')), k(T('pad.help.p.def'), T('pad.help.p.def.v')), k(T('pad.help.p.sprint'), T('pad.help.p.sprint.v')), k(T('pad.help.p.pause'), T('pad.help.p.pause.v')))));
  }
  // rows for the in-match help overlay when someone plays with a controller
  function helpRows(slots) {
    if (!slots || !slots.some((s) => s.dev && s.dev.startsWith('pad'))) return [];
    const k = (a, b) => h('tr', null, h('td', null, h('kbd', { text: a })), h('td', { text: b }));
    return [k('🎮 L-Stick / D-Pad', T('help.move')), k('🎮 LB RB LT RT', T('help.sprint')), k('🎮 A B Y X', T('pad.help.p.att.v')), k('🎮 Start', T('help.pause'))];
  }

  // ====================================================================
  // 9. hooks into the UI module (no edits needed in ui.js)
  // ====================================================================
  const origModal = UI.modal;
  UI.modal = function (title, body, opts) {
    const w = origModal.call(this, title, body, opts);
    w._sticky = !!(opts && opts.sticky);
    return w;
  };

  FCK.PadNav = {
    S, controlLine, settingsSection, helpSection, helpRows, openList, openText, collect, layerRoot,
    active: () => !!layerRoot() && S.mode === 'pad', mode: () => S.mode, cur: () => S.cur,
    memo: (on) => { rectMemo = on ? new Map() : null; },
    padName, padList, initial: (root, cands) => initialFocus(root, cands),
    focus: (el) => { S.key = layerKey(layerRoot() || UI.screenEl); setCur(el); },
    press: (i) => onButton(i, { startPads: [0] }), dir: (d) => onDir(d, true),
    // test helper: where does a direction press from el lead? ('value' | element | null) - only meaningful while a layer is open
    next: (el, d, cands) => { const r = layerRoot(); return r ? dirPlan(el, d, r, cands || collect(r)) : null; },
  };

  initListeners();
  requestAnimationFrame(tick);
})((globalThis.FCK = globalThis.FCK || {}));
