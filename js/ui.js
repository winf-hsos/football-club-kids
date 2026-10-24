/* FCK - ui.js : DOM helpers, welcome / home / settings / help / saves / highlights screens */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const T = (k, v) => FCK.T(k, v);

  // ---------- DOM helpers ----------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    const add = (c) => {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) c.forEach(add);
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    };
    kids.forEach(add);
    return el;
  }

  const UI = {
    root: null, screenEl: null, modalEl: null, toastEl: null, cur: null, stack: [],
    h,

    init(root) {
      this.root = root;
      this.screenEl = root.querySelector('#screen');
      this.modalEl = root.querySelector('#modal');
      this.toastEl = root.querySelector('#toast');
    },

    sfx(n) { FCK.Audio.play(n); },

    toast(msg, ms) {
      const t = h('div', { class: 'toast-item', text: msg });
      this.toastEl.appendChild(t);
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms || 2400);
    },

    // ---------- components ----------
    btn(label, onClick, cls, opts) {
      const b = h('button', { class: 'btn ' + (cls || ''), type: 'button' }, label);
      b.addEventListener('click', (e) => { FCK.Audio.init(); this.sfx(cls && cls.includes('back') ? 'back' : cls && cls.includes('primary') ? 'ok' : 'click'); onClick(e); });
      if (opts && opts.disabled) b.disabled = true;
      return b;
    },
    chips(options, value, onChange, cls) {
      const wrap = h('div', { class: 'chips ' + (cls || ''), role: 'group' });
      options.forEach((o) => {
        const val = typeof o === 'object' ? o.v : o, label = typeof o === 'object' ? o.l : o;
        const c = h('button', { class: 'chip' + (val === value ? ' on' : ''), type: 'button' }, label);
        c.addEventListener('click', () => {
          FCK.Audio.init(); this.sfx('tick');
          wrap.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); c.classList.add('on');
          onChange(val);
        });
        wrap.appendChild(c);
      });
      if (cls && cls.indexOf('tabs') >= 0) setTimeout(() => { const on = wrap.querySelector('.chip.on'); if (on && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = Math.max(0, on.offsetLeft - wrap.clientWidth / 2 + on.offsetWidth / 2); }, 0);
      return wrap;
    },
    slider(label, min, max, step, value, onChange, fmt) {
      const out = h('output', { text: fmt ? fmt(value) : value });
      const inp = h('input', { type: 'range', min, max, step, value, 'aria-label': label });
      inp.addEventListener('input', () => { const v = parseFloat(inp.value); out.textContent = fmt ? fmt(v) : v; onChange(v); });
      return h('label', { class: 'field sl' }, h('span', { class: 'lbl', text: label }), inp, out);
    },
    toggle(label, value, onChange) {
      const inp = h('input', { type: 'checkbox' });
      inp.checked = !!value;
      inp.addEventListener('change', () => { this.sfx('tick'); onChange(inp.checked); });
      return h('label', { class: 'toggle' }, inp, h('span', { class: 'sw' }), h('span', { class: 'lbl', text: label }));
    },
    select(options, value, onChange, label) {
      const s = h('select', { 'aria-label': label || '' });
      options.forEach((o) => {
        const val = typeof o === 'object' ? o.v : o, lab = typeof o === 'object' ? o.l : o;
        const op = h('option', { value: val, text: lab }); if (val === value) op.selected = true; s.appendChild(op);
      });
      s.addEventListener('change', () => onChange(s.value));
      return s;
    },
    crestImg(club, size, cls) {
      const img = h('img', { class: 'crest ' + (cls || ''), alt: '', width: size, height: size });
      img.src = FCK.crestDataUrl(club, Math.round(size * 2));
      return img;
    },
    section(title, ...kids) { return h('section', { class: 'card sect' }, h('h3', { text: title }), ...kids); },
    stars(rating) { // 55..90 -> 0..5 stars
      const n = U.clamp((rating - 55) / 7, 0.5, 5);
      const full = Math.floor(n), half = n - full >= 0.5;
      let s = '★'.repeat(full) + (half ? '⯨' : '');
      return h('span', { class: 'stars', title: String(rating), 'aria-label': rating + ' / 100' }, s || '☆');
    },

    // ---------- screens ----------
    show(name, data, noStack) {
      if (this.cur && !noStack && this.cur !== name && this.cur !== 'welcome') this.stack.push(this.cur);
      this.cur = name;
      if (FCK.Career && FCK.Career.syncCustom) FCK.Career.syncCustom(name);
      if (this._spy) { this.screenEl.removeEventListener('scroll', this._spy); this._spy = null; }
      this.screenEl.innerHTML = '';
      this.screenEl.className = 'screen s-' + name;
      this.screenEl.hidden = false;
      const fn = this['screen_' + name] || (FCK.Screens && FCK.Screens[name]);
      const el = fn.call(this, data);
      this.screenEl.appendChild(el);
      this.screenEl.scrollTop = 0;
      document.body.classList.toggle('home-bg', name === 'home' || name === 'welcome');
    },
    back() {
      const prev = this.stack.pop() || 'home';
      this.show(prev, null, true);
    },
    hide() { this.screenEl.hidden = true; this.screenEl.innerHTML = ''; this.cur = null; },
    header(title, onBack, right) {
      return h('header', { class: 'topbar' },
        onBack ? this.btn('‹ ' + T('back'), onBack, 'ghost back') : h('span'),
        h('h2', { text: title }), right || h('span'));
    },

    // --- welcome (first start): language + profile ---
    screen_welcome() {
      const S = FCK.settings;
      const el = h('div', { class: 'welcome' });
      const draw = () => {
        el.innerHTML = '';
        el.appendChild(this.logo(true));
        el.appendChild(h('p', { class: 'lead', text: T('welcome.lead') }));
        el.appendChild(h('div', { class: 'row center' }, this.chips([{ v: 'de', l: 'Deutsch' }, { v: 'en', l: 'English' }], S.lang, (v) => { S.lang = v; FCK.saveSettings(); draw(); }, 'big')));
        el.appendChild(h('h3', { class: 'center', text: T('welcome.profile') }));
        const mk = (k, icon, title, desc) => {
          const c = h('button', { class: 'pcard' + (S.profile === k ? ' on' : ''), type: 'button' },
            h('div', { class: 'pic', text: icon }), h('b', { text: title }), h('span', { text: desc }));
          c.addEventListener('click', () => { S.profile = k; FCK.applyProfile(); FCK.saveSettings(); this.sfx('ok'); draw(); });
          return c;
        };
        el.appendChild(h('div', { class: 'pcards' },
          mk('kids', '🧒', T('profile.kids'), T('profile.kids.desc')),
          mk('normal', '🎮', T('profile.normal'), T('profile.normal.desc'))));
        el.appendChild(h('div', { class: 'row center' }, this.btn(T('welcome.go'), () => { S.welcomed = true; FCK.saveSettings(); FCK.Audio.init(); this.stack = []; this.cur = null; this.show('home'); }, 'primary xl')));
        el.appendChild(h('p', { class: 'fine', text: T('welcome.fine') }));
        el.appendChild(this.buildTag());
      };
      draw();
      return el;
    },

    donateLink() {
      const url = 'https://paypal.me/Meseth';
      const b = h('button', { class: 'donate-link', type: 'button', text: '\u2665 ' + T('donate') });
      b.addEventListener('click', () => {
        this.sfx('click');
        this.modal(T('donate.t'), h('div', null, h('p', { text: T('donate.txt') }), h('p', { class: 'fine', text: T('donate.parents') }),
          h('div', { class: 'row' },
            this.btn(T('donate.go'), () => { this.closeModal(); try { window.open(url, '_blank', 'noopener,noreferrer'); } catch (e) { /* blocked */ } }, 'primary'),
            this.btn(T('cancel'), () => this.closeModal(), 'ghost'))));
      });
      return b;
    },
    buildTag() { return h('div', { class: 'build-tag', text: FCK.BUILD ? 'v ' + FCK.BUILD : '' }); },

    logo(big) {
      return h('div', { class: 'logo' + (big ? ' big' : '') },
        h('div', { class: 'logo-mark' }, h('span', { text: 'FCK' })),
        h('div', { class: 'logo-sub', text: 'Football Club Kids' }));
    },

    // --- home ---
    screen_home() {
      const el = h('div', { class: 'home fh' });
      const secs = {};
      const tile = (icon, key, screen, hue, cls) => {
        const b = h('button', { class: 'mitem tile ' + (cls || ''), type: 'button', style: { '--hue': hue } },
          h('span', { class: 'tl-ic', 'aria-hidden': 'true', text: icon }), h('span', { class: 'tl-tx' }, h('b', { text: T(key) }), h('small', { text: T(key + '.sub') })));
        b.addEventListener('click', () => { FCK.Audio.init(); this.sfx('click'); this.show(screen); });
        return b;
      };
      const section = (id, title, ...tiles) => { const s = h('section', { class: 'fh-sec', 'data-sec': id }, h('h2', { class: 'fh-st', text: title }), h('div', { class: 'tiles' }, ...tiles)); secs[id] = s; return s; };
      const TABS = [{ v: 'play', l: T('home.t.play') }, { v: 'tour', l: T('home.t.tour') }, { v: 'more', l: T('home.t.more') }];
      const tabs = this.chips(TABS, 'play', (v) => { go(v); }, 'tabs fh-tabs');
      const go = (v) => { const sec = secs[v]; if (!sec) return; this.screenEl.scrollTo({ top: Math.max(0, sec.offsetTop - 84), behavior: 'smooth' }); mark(v); };
      const mark = (v) => { Array.from(tabs.children).forEach((c, i) => c.classList.toggle('on', TABS[i].v === v)); };
      const bar = h('header', { class: 'fh-bar' }, h('div', { class: 'fh-logo' }, h('b', { text: 'FCK' }), h('small', { text: 'Football Club Kids' })), tabs);
      el.appendChild(bar);
      el.appendChild(section('play', T('home.t.play'),
        tile('⚽', 'home.quick', 'setup', 150, 'hero primary'),
        tile('🏟', 'home.career', 'careerMenu', 215), tile('⭐', 'home.pro', 'proMenu', 45), tile('🃏', 'home.cards', 'cards', 285)));
      el.appendChild(section('tour', T('home.t.tour'),
        tile('🌍', 'home.tourney', 'tourney', 175), tile('🏆', 'home.comp', 'comp', 25), tile('🤝', 'home.duel', 'duel', 330)));
      el.appendChild(section('more', T('home.t.more'),
        tile('🛠', 'home.editor', 'editor', 195, 'sm'), tile('🎬', 'home.hl', 'highlights', 260, 'sm'), tile('💾', 'home.saves', 'saves', 120, 'sm'),
        tile('⚙', 'home.settings', 'settings', 215, 'sm'), tile('❓', 'home.help', 'help', 60, 'sm')));
      // highlight the tab of the section in view
      const sc = this.screenEl;
      const spy = () => { let cur = 'play'; ['play', 'tour', 'more'].forEach((k) => { if (secs[k].offsetTop - 120 <= sc.scrollTop) cur = k; }); if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) cur = 'more'; mark(cur); };
      this._spy = spy; sc.addEventListener('scroll', spy, { passive: true });
      const fs = h('button', { class: 'fs-btn', type: 'button', title: T('fullscreen'), 'aria-label': T('fullscreen') }, '⛶');
      fs.addEventListener('click', () => { this.sfx('click'); try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* not available */ } });
      el.appendChild(fs);
      el.appendChild(this.buildTag());
      el.appendChild(this.donateLink());
      mark('play');
      return el;
    },

    // --- settings (global) ---
    screen_settings() {
      const S = FCK.settings;
      const A = FCK.Audio;
      const apply = () => { FCK.saveSettings(); A.set({ master: S.master, sfx: S.sfx, music: S.music, crowd: S.crowd, speech: S.speech }, S.muted); FCK.onSettings && FCK.onSettings(); };
      const el = h('div', { class: 'page' });
      el.appendChild(this.header(T('settings'), () => this.back()));
      const grid = h('div', { class: 'grid2' });
      grid.appendChild(this.section(T('set.general'),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.lang') }), this.chips([{ v: 'de', l: 'Deutsch' }, { v: 'en', l: 'English' }], S.lang, (v) => { S.lang = v; apply(); this.show('settings', null, true); })),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.profile') }), this.chips([{ v: 'kids', l: T('profile.kids') }, { v: 'normal', l: T('profile.normal') }], S.profile, (v) => { S.profile = v; FCK.applyProfile(); apply(); })),
        h('p', { class: 'fine', text: T('set.profile.hint') }),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('ui.style') }), this.chips(['mix', 'f22', 'f24', 'f27'].map((k) => ({ v: k, l: T('ui.s.' + k) })), S.uiStyle || 'mix', (v) => { S.uiStyle = v; apply(); }, 'scroll')),
        h('p', { class: 'fine', text: T('ui.style.hint') }),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.touch') }), this.chips([{ v: 'auto', l: T('auto') }, { v: 'on', l: T('on') }, { v: 'off', l: T('off') }], S.touch, (v) => { S.touch = v; apply(); }))));
      grid.appendChild(this.section(T('set.sound'),
        this.toggle(T('set.mute'), S.muted, (v) => { S.muted = v; apply(); }),
        this.slider(T('set.master'), 0, 1, 0.05, S.master, (v) => { S.master = v; apply(); }, (v) => Math.round(v * 100) + '%'),
        this.slider(T('set.sfx'), 0, 1, 0.05, S.sfx, (v) => { S.sfx = v; apply(); }, (v) => Math.round(v * 100) + '%'),
        this.slider(T('set.music'), 0, 1, 0.05, S.music, (v) => { S.music = v; apply(); }, (v) => Math.round(v * 100) + '%'),
        this.slider(T('set.crowd'), 0, 1, 0.05, S.crowd, (v) => { S.crowd = v; apply(); }, (v) => Math.round(v * 100) + '%'),
        this.toggle(T('set.musicGame'), S.musicInGame, (v) => { S.musicInGame = v; apply(); })));
      grid.appendChild(this.section(T('set.comm'),
        this.toggle(T('set.commText'), S.commentary, (v) => { S.commentary = v; apply(); }),
        this.toggle(T('set.commSpeech'), S.speech_on, (v) => { S.speech_on = v; apply(); if (v) A.speak(T('set.speechTest'), S.lang, true); }),
        this.slider(T('set.speechVol'), 0, 1, 0.05, S.speech, (v) => { S.speech = v; apply(); }, (v) => Math.round(v * 100) + '%')));
      grid.appendChild(this.section(T('set.view'),
        h('div', { class: 'field' }, h('span', { class: 'lbl', text: T('set.zoom') }), this.chips([{ v: 'far', l: T('zoom.far') }, { v: 'mid', l: T('zoom.mid') }, { v: 'near', l: T('zoom.near') }], S.zoom, (v) => { S.zoom = v; apply(); })),
        FCK.view3dFields && FCK.view3dFields(apply),
        this.toggle(T('set.radar'), S.radar, (v) => { S.radar = v; apply(); }),
        this.toggle(T('set.particles'), S.particles, (v) => { S.particles = v; apply(); }),
        this.toggle(T('set.demo'), S.demoBg !== false, (v) => { S.demoBg = v; apply(); })));
      if (FCK.PadNav) grid.appendChild(FCK.PadNav.settingsSection());
      el.appendChild(grid);
      const danger = h('section', { class: 'card sect' }, h('h3', { text: T('set.data') }));
      let armed = false;
      const rb = this.btn(T('set.reset'), () => {
        if (!armed) { armed = true; rb.textContent = T('set.reset.sure'); rb.classList.add('danger'); setTimeout(() => { armed = false; rb.textContent = T('set.reset'); rb.classList.remove('danger'); }, 4000); return; }
        FCK.resetAll(); this.stack = []; this.cur = null; this.show('welcome');
      }, 'ghost');
      danger.appendChild(h('p', { class: 'fine', text: T('set.data.hint') }));
      danger.appendChild(rb);
      el.appendChild(danger);
      return el;
    },

    // --- help ---
    screen_help() {
      const el = h('div', { class: 'page' });
      el.appendChild(this.header(T('help'), () => this.back()));
      const k = (a, b) => h('tr', null, h('td', null, h('kbd', { text: a })), h('td', { text: b }));
      const ctl = (title, rows) => h('section', { class: 'card sect' }, h('h3', { text: title }), h('table', { class: 'keys' }, h('tbody', null, rows)));
      const acts = [T('act.pass'), T('act.shot'), T('act.through'), T('act.lob')];
      const actsDef = [T('act.pass.def'), T('act.shot.def'), T('act.through.def'), T('act.lob.def')];
      const grid = h('div', { class: 'grid2' });
      grid.appendChild(ctl(T('help.kb1'), [
        k('W A S D', T('help.move')), k('Shift', T('help.sprint')),
        k('Q', acts[0] + ' / ' + T('help.switch')), k('E', acts[1] + ' (' + T('help.hold') + ')'), k('R', acts[2]), k('F', acts[3] + ' (' + T('help.hold') + ')'), k('Esc / P', T('help.pause'))]));
      grid.appendChild(ctl(T('help.kb2'), [
        k('← ↑ ↓ →', T('help.move')), k('Shift ⇧ (' + T('help.right') + ')', T('help.sprint')),
        k(',', acts[0]), k('.', acts[1]), k('-  (/)', acts[2]), k('Ö  (;)', acts[3])]));
      grid.appendChild(ctl(T('help.solo'), [k('WASD / ←↑↓→', T('help.move')), k('Shift', T('help.sprint')), k('Q / Space', acts[0]), k('E / X', acts[1]), k('R / C', acts[2]), k('F / V', acts[3])]));
      grid.appendChild(ctl(T('help.pad'), [
        k('L-Stick / D-Pad', T('help.move')), k('LB RB LT RT', T('help.sprint')), k('A / ✕', acts[0] + ' / ' + T('help.switch')), k('B / ○', acts[1]), k('Y / △', acts[2]), k('X / □', acts[3]), k('Start / Back', T('help.pause'))]));
      if (FCK.PadNav) grid.appendChild(FCK.PadNav.helpSection());
      grid.appendChild(ctl(T('help.touch'), [k(T('help.touch.stick'), T('help.move')), k('A', acts[0]), k('B', acts[1]), k('C', acts[2]), k('D', acts[3]), k('»', T('help.sprint'))]));
      grid.appendChild(h('section', { class: 'card sect' }, h('h3', { text: T('help.actions') }),
        h('dl', { class: 'dl' }, ...acts.flatMap((a, i) => [h('dt', { text: a }), h('dd', { text: actsDef[i] })]))));
      el.appendChild(grid);
      el.appendChild(h('section', { class: 'card sect' }, h('h3', { text: T('help.tips') }),
        h('ul', { class: 'tips' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => h('li', { text: T('help.tip' + i) })))));
      return el;
    },

    // --- save slots ---
    screen_saves() {
      const el = h('div', { class: 'page' });
      el.appendChild(this.header(T('saves'), () => this.back()));
      el.appendChild(h('p', { class: 'fine', text: T('saves.hint') }));
      const list = h('div', { class: 'slots' });
      const draw = () => {
        list.innerHTML = '';
        FCK.Saves.list().forEach((s, i) => {
          const card = h('div', { class: 'slot card' });
          card.appendChild(h('div', { class: 'slot-n', text: i + 1 }));
          if (s) {
            card.appendChild(h('div', { class: 'slot-i' }, h('b', { text: s.name }), h('small', { text: new Date(s.date).toLocaleString(FCK.settings.lang === 'de' ? 'de-DE' : 'en-GB') + ' · ' + (s.data && s.data.note ? s.data.note : '') })));
          } else card.appendChild(h('div', { class: 'slot-i muted' }, h('b', { text: T('saves.empty') })));
          const act = h('div', { class: 'slot-a' });
          act.appendChild(this.btn(T('saves.save'), () => {
            const nameIn = prompt_(T('saves.name'), s ? s.name : 'FCK ' + (i + 1));
            nameIn.then((nm) => { if (nm === null) return; FCK.Saves.save(i, nm, FCK.snapshot()); this.toast(T('saves.saved')); draw(); });
          }, 'ghost'));
          if (s) {
            act.appendChild(this.btn(T('saves.load'), () => { FCK.restore(s.data); this.toast(T('saves.loaded')); }, 'ghost'));
            act.appendChild(this.btn(T('saves.export'), () => this.exportDialog(i), 'ghost'));
            let armed = false;
            const del = this.btn('✕', () => { if (!armed) { armed = true; del.classList.add('danger'); setTimeout(() => { armed = false; del.classList.remove('danger'); }, 3000); return; } FCK.Saves.remove(i); draw(); }, 'ghost');
            del.title = T('delete'); act.appendChild(del);
          }
          card.appendChild(act);
          list.appendChild(card);
        });
      };
      draw();
      el.appendChild(list);
      el.appendChild(h('div', { class: 'row' }, this.btn(T('saves.import'), () => this.importDialog(draw), 'ghost')));
      return el;
    },
    exportDialog(i) {
      const txt = FCK.Saves.exportText(i);
      const ta = h('textarea', { class: 'code', readonly: true, rows: 6 }); ta.value = txt;
      const m = this.modal(T('saves.export'), h('div', null, h('p', { class: 'fine', text: T('saves.export.hint') }), ta,
        h('div', { class: 'row' }, this.btn(T('copy'), () => { ta.select(); try { navigator.clipboard.writeText(txt).then(() => this.toast(T('copied'))).catch(() => { document.execCommand && document.execCommand('copy'); }); } catch (e) { /* ignore */ } }, 'primary'),
          this.btn(T('close'), () => this.closeModal(), 'ghost'))));
      setTimeout(() => ta.select(), 50);
      return m;
    },
    importDialog(done) {
      const ta = h('textarea', { class: 'code', rows: 6, placeholder: 'FCK1:…' });
      const slotSel = this.select([0, 1, 2, 3, 4].map((i) => ({ v: String(i), l: T('saves.slot') + ' ' + (i + 1) })), '0', () => {}, 'slot');
      this.modal(T('saves.import'), h('div', null, h('p', { class: 'fine', text: T('saves.import.hint') }), ta,
        h('div', { class: 'row' }, slotSel,
          this.btn(T('saves.import.go'), () => { if (FCK.Saves.importText(parseInt(slotSel.value, 10), ta.value)) { this.toast(T('saves.imported')); this.closeModal(); done(); } else this.toast(T('saves.import.bad')); }, 'primary'),
          this.btn(T('close'), () => this.closeModal(), 'ghost'))));
    },

    // --- highlights ---
    screen_highlights() {
      const el = h('div', { class: 'page' });
      el.appendChild(this.header(T('hl'), () => this.back()));
      const list = h('div', { class: 'hl-list' });
      const draw = () => {
        list.innerHTML = '';
        const clips = FCK.Archive.list();
        if (!clips.length) list.appendChild(h('p', { class: 'muted center', text: T('hl.empty') }));
        clips.forEach((c) => {
          const card = h('div', { class: 'hl card' });
          card.appendChild(h('div', { class: 'hl-crests' }, this.crestImg(c.teams[0].club, 34), h('b', { class: 'hl-score', text: c.score[0] + ':' + c.score[1] }), this.crestImg(c.teams[1].club, 34)));
          card.appendChild(h('div', { class: 'hl-i' },
            h('b', { text: (c.og ? T('hl.og') + ' ' : '⚽ ') + (c.title || c.teams[c.team].short) + " " + c.minute + "'" }),
            h('small', { text: c.teams[0].short + ' – ' + c.teams[1].short + ' · ' + new Date(c.date).toLocaleDateString(FCK.settings.lang === 'de' ? 'de-DE' : 'en-GB') })));
          const act = h('div', { class: 'slot-a' });
          act.appendChild(this.btn('▶ ' + T('hl.play'), () => FCK.playArchive(c), 'primary'));
          let armed = false;
          const del = this.btn('✕', () => { if (!armed) { armed = true; del.classList.add('danger'); setTimeout(() => { armed = false; del.classList.remove('danger'); }, 3000); return; } FCK.Archive.remove(c.id); draw(); }, 'ghost');
          act.appendChild(del);
          card.appendChild(act);
          list.appendChild(card);
        });
      };
      draw();
      el.appendChild(list);
      return el;
    },

    // ---------- modal ----------
    modal(title, body, opts) {
      this.closeModal();
      const wrap = h('div', { class: 'modal-wrap' + (opts && opts.cls ? ' ' + opts.cls : ''), role: 'dialog', 'aria-modal': 'true' });
      const box = h('div', { class: 'modal card' });
      if (title) box.appendChild(h('h3', { class: 'modal-t', text: title }));
      box.appendChild(body);
      wrap.appendChild(box);
      if (!opts || !opts.sticky) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) this.closeModal(); });
      this.modalEl.appendChild(wrap);
      this.modalEl.hidden = false;
      this.modalOpen = true;
      return wrap;
    },
    closeModal() { this.modalEl.innerHTML = ''; this.modalEl.hidden = true; this.modalOpen = false; if (this.onModalClose) { const f = this.onModalClose; this.onModalClose = null; f(); } },
  };

  // text prompt without window.prompt (blocked in artifacts)
  function prompt_(title, def) {
    return new Promise((res) => {
      const inp = h('input', { type: 'text', class: 'txt', maxlength: 24 }); inp.value = def || '';
      const ok = () => { UI.closeModal(); res(inp.value.trim() || def); };
      const body = h('div', null, inp, h('div', { class: 'row' }, UI.btn(T('ok'), ok, 'primary'), UI.btn(T('cancel'), () => { UI.closeModal(); res(null); }, 'ghost')));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
      UI.modal(title, body);
      setTimeout(() => { inp.focus(); inp.select(); }, 50);
    });
  }

  FCK.UI = UI; FCK.h = h; FCK.promptText = prompt_;
})((globalThis.FCK = globalThis.FCK || {}));
