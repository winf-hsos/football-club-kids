/* FCK - input.js : keyboard (2 layouts), gamepads (4), touch controls -> per-slot input objects */
(function (FCK) {
  'use strict';
  const U = FCK.U;

  // devices: 'kb1' | 'kb2' | 'pad0'..'pad3' | 'touch'
  const KB1 = {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], sprint: ['ShiftLeft'],
    a: [['KeyQ'], ['KeyE'], ['KeyR'], ['KeyF']],
  };
  const KB2 = {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], sprint: ['ShiftRight'],
    a: [['Comma'], ['Period'], ['Slash'], ['Semicolon']],
  };
  // single keyboard player gets both layouts + comfortable extras
  const KB_SOLO = {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    a: [['KeyQ', 'Space', 'Comma'], ['KeyE', 'KeyX', 'Period'], ['KeyR', 'KeyC', 'Slash'], ['KeyF', 'KeyV', 'Semicolon']],
  };

  class Pad { constructor() { this.held = [false, false, false, false]; } }

  class Input {
    constructor() {
      this.keys = new Set();
      this.slots = []; // [{dev, held[], prevHeld[], pressedL[], releasedL[], dx, dy, sprint, pause}]
      this.pauseLatch = false;
      this.touch = { dx: 0, dy: 0, sprint: false, held: [false, false, false, false] };
      this.lastDevice = null;
      this.anyPress = false;
      this.onPause = null;
      this._kd = (e) => this.keydown(e);
      this._ku = (e) => this.keyup(e);
      this._blur = () => { this.keys.clear(); };
      window.addEventListener('keydown', this._kd);
      window.addEventListener('keyup', this._ku);
      window.addEventListener('blur', this._blur);
      this.padState = [new Pad(), new Pad(), new Pad(), new Pad()];
      this.padPrevStart = [false, false, false, false];
      this.captureKeys = false; // true while a match is on screen (prevents page scroll)
    }

    keydown(e) {
      if (e.repeat) { if (this.captureKeys && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault(); return; }
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      this.keys.add(e.code);
      this.anyPress = true;
      if (this.captureKeys && (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Slash' || e.code === 'Tab')) e.preventDefault();
      if (e.code === 'Escape' || e.code === 'KeyP') { this.pauseLatch = true; }
    }
    keyup(e) { this.keys.delete(e.code); }

    // configure for a match; slots: [{dev, team}]
    setup(slotsCfg) {
      const kbCount = slotsCfg.filter((s) => s.dev === 'kb1' || s.dev === 'kb2').length;
      this.slots = slotsCfg.map((s) => {
        let map = null;
        if (s.dev === 'kb1') map = kbCount === 1 ? KB_SOLO : KB1;
        else if (s.dev === 'kb2') map = KB2;
        return {
          dev: s.dev, map, held: [false, false, false, false], prev: [false, false, false, false],
          pl: [false, false, false, false], rl: [false, false, false, false], dx: 0, dy: 0, sprint: false,
        };
      });
      this.pauseLatch = false;
      this.primePads();
    }

    // mark the pad buttons that are down right now as already seen: a press that was used by a menu (A / Start that launched the match,
    // resumed it or left half-time) must not fire an action or a pause in the match input afterwards
    primePads() {
      this.slots.forEach((s, i) => {
        const gp = s.dev && s.dev.startsWith('pad') ? this.getPad(parseInt(s.dev.slice(3), 10)) : null;
        if (!gp) return;
        const bp = (k) => !!(gp.buttons[k] && (gp.buttons[k].pressed || gp.buttons[k].value > 0.5));
        s.prev = [bp(0), bp(1), bp(3), bp(2)]; this.padPrevStart[i] = bp(9) || bp(8);
      });
      this.pauseLatch = false;
    }

    keyDown(list) { for (let i = 0; i < list.length; i++) if (this.keys.has(list[i])) return true; return false; }

    getPad(idx) {
      const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
      let n = -1;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) { n++; if (n === idx) return pads[i]; }
      }
      return null;
    }
    padCount() {
      const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
      let n = 0;
      for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) n++;
      return n;
    }

    // poll once per rendered frame; latches edges until consumed by a sim step
    poll() {
      for (let i = 0; i < this.slots.length; i++) {
        const s = this.slots[i];
        let dx = 0, dy = 0, sprint = false;
        const h = [false, false, false, false];
        if (s.map) {
          const m = s.map;
          if (this.keyDown(m.left)) dx -= 1;
          if (this.keyDown(m.right)) dx += 1;
          if (this.keyDown(m.up)) dy -= 1;
          if (this.keyDown(m.down)) dy += 1;
          sprint = this.keyDown(m.sprint);
          for (let k = 0; k < 4; k++) h[k] = this.keyDown(m.a[k]);
          if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
        } else if (s.dev && s.dev.startsWith('pad')) {
          const gp = this.getPad(parseInt(s.dev.slice(3), 10));
          if (gp) {
            let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            const mag = Math.sqrt(ax * ax + ay * ay);
            if (mag < 0.18) { ax = 0; ay = 0; } else { const k = Math.min(1, (mag - 0.18) / 0.72) / mag; ax *= k; ay *= k; }
            const b = gp.buttons;
            const bp = (i) => !!(b[i] && (b[i].pressed || b[i].value > 0.5));
            if (bp(14)) ax = -1; if (bp(15)) ax = 1; if (bp(12)) ay = -1; if (bp(13)) ay = 1;
            dx = ax; dy = ay;
            sprint = bp(7) || bp(5) || bp(6) || bp(4);
            h[0] = bp(0); h[1] = bp(1); h[2] = bp(3); h[3] = bp(2);
            const st = bp(9) || bp(8); // Start or Back pauses
            if (st && !this.padPrevStart[i]) this.pauseLatch = true;
            this.padPrevStart[i] = st;
          }
        } else if (s.dev === 'touch') {
          dx = this.touch.dx; dy = this.touch.dy; sprint = this.touch.sprint;
          for (let k = 0; k < 4; k++) h[k] = this.touch.held[k];
        }
        for (let k = 0; k < 4; k++) {
          if (h[k] && !s.prev[k]) s.pl[k] = true;
          if (!h[k] && s.prev[k]) s.rl[k] = true;
          s.prev[k] = h[k];
        }
        s.held = h; s.dx = dx; s.dy = dy; s.sprint = sprint;
      }
    }

    // build per-step input for slot i, consuming latched edges
    consume(i) {
      const s = this.slots[i];
      const out = {
        dx: s.dx, dy: s.dy, sprint: s.sprint, held: s.held.slice(),
        pressed: s.pl.slice(), released: s.rl.slice(), pause: false,
      };
      s.pl = [false, false, false, false]; s.rl = [false, false, false, false];
      return out;
    }

    takePause() { const p = this.pauseLatch; this.pauseLatch = false; return p; }

    // any button on any device pressed (used for "skip replay", "continue")
    anyAction() {
      let r = false;
      for (let i = 0; i < this.slots.length; i++) {
        const s = this.slots[i];
        if (s.pl[0] || s.pl[1] || s.pl[2] || s.pl[3]) r = true;
      }
      return r;
    }
    clearEdges() { this.slots.forEach((s) => { s.pl = [false, false, false, false]; s.rl = [false, false, false, false]; }); this.anyPress = false; }
  }

  // ---------------- touch overlay ----------------
  class TouchUI {
    constructor(root, input) {
      this.root = root; this.input = input; this.on = false;
      root.innerHTML = '';
      const stickZone = document.createElement('div'); stickZone.className = 'tz-stick';
      const base = document.createElement('div'); base.className = 'tz-base';
      const knob = document.createElement('div'); knob.className = 'tz-knob';
      base.appendChild(knob); stickZone.appendChild(base);
      root.appendChild(stickZone);
      const btns = document.createElement('div'); btns.className = 'tz-btns';
      const names = [['A', 'tb-a'], ['B', 'tb-b'], ['C', 'tb-c'], ['D', 'tb-d']];
      this.btnEls = names.map((n, i) => {
        const b = document.createElement('button'); b.className = 'tb ' + n[1]; b.textContent = n[0]; b.dataset.k = i; b.setAttribute('aria-label', 'Aktion ' + n[0]);
        btns.appendChild(b); return b;
      });
      const sp = document.createElement('button'); sp.className = 'tb tb-s'; sp.textContent = '»'; sp.setAttribute('aria-label', 'Sprint');
      btns.appendChild(sp);
      root.appendChild(btns);
      this.stickZone = stickZone; this.base = base; this.knob = knob; this.sp = sp;
      this.stickId = null; this.origin = null;
      const t = input.touch;
      stickZone.addEventListener('pointerdown', (e) => {
        if (this.stickId !== null) return;
        this.stickId = e.pointerId; stickZone.setPointerCapture(e.pointerId);
        const r = stickZone.getBoundingClientRect();
        this.origin = { x: e.clientX, y: e.clientY };
        base.style.display = 'block';
        base.style.left = (e.clientX - r.left - 55) + 'px'; base.style.top = (e.clientY - r.top - 55) + 'px';
        knob.style.transform = 'translate(0px,0px)';
        e.preventDefault();
      });
      stickZone.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.stickId) return;
        let dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
        const R = 52, d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) { this.origin.x += (dx / d) * (d - R); this.origin.y += (dy / d) * (d - R); dx = (dx / d) * R; dy = (dy / d) * R; }
        const mag = Math.min(1, d / R);
        t.dx = dx / R; t.dy = dy / R;
        t.sprint = sp.classList.contains('on') || mag > 0.97;
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        e.preventDefault();
      });
      const end = (e) => {
        if (e.pointerId !== this.stickId) return;
        this.stickId = null; t.dx = 0; t.dy = 0; t.sprint = sp.classList.contains('on');
        base.style.display = 'none';
      };
      stickZone.addEventListener('pointerup', end); stickZone.addEventListener('pointercancel', end);
      this.btnEls.forEach((b, i) => {
        b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); t.held[i] = true; b.classList.add('on'); e.preventDefault(); });
        const up = (e) => { t.held[i] = false; b.classList.remove('on'); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      });
      sp.addEventListener('pointerdown', (e) => { sp.setPointerCapture(e.pointerId); sp.classList.add('on'); t.sprint = true; e.preventDefault(); });
      const spUp = () => { sp.classList.remove('on'); t.sprint = false; };
      sp.addEventListener('pointerup', spUp); sp.addEventListener('pointercancel', spUp); sp.addEventListener('lostpointercapture', spUp);
      root.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    show(v) { this.root.classList.toggle('show', !!v); this.on = !!v; if (!v) { const t = this.input.touch; t.dx = t.dy = 0; t.sprint = false; t.held = [false, false, false, false]; } }
    setLabels(arr) { this.btnEls.forEach((b, i) => { if (arr[i] !== undefined) b.textContent = arr[i]; }); }
  }

  FCK.Input = Input; FCK.TouchUI = TouchUI;
  FCK.KEYMAPS = { kb1: KB1, kb2: KB2, solo: KB_SOLO };
})((globalThis.FCK = globalThis.FCK || {}));
