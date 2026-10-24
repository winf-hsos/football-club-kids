/* FCK - stats.js : highlight archive (compact clips in localStorage), replay player, save slots, heatmap drawing */
(function (FCK) {
  'use strict';
  const U = FCK.U;
  const P = FCK.PITCH;

  // ================= clip encoding =================
  const STATE_NAMES = ['idle', 'slide', 'down', 'dive', 'celebrate', 'hold'];

  function b64FromInt16(arr) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function int16FromB64(b64) {
    const s = atob(b64);
    const buf = new ArrayBuffer(s.length);
    const u = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return new Int16Array(buf);
  }

  // frames: array of Float32Array (30 Hz), n players -> compact { hz:15, n, data(b64) }
  function encodeClip(frames, n) {
    const step = 2, out = [];
    for (let i = 0; i < frames.length; i += step) out.push(frames[i]);
    const w = 3 + n * 5;
    const arr = new Int16Array(out.length * w);
    for (let f = 0; f < out.length; f++) {
      const src = out[f], o = f * w;
      arr[o] = Math.round(src[0] * 50); arr[o + 1] = Math.round(src[1] * 50); arr[o + 2] = Math.round(src[2] * 100);
      for (let i = 0; i < n; i++) {
        const a = 3 + i * 5;
        arr[o + a] = Math.round(src[a] * 50); arr[o + a + 1] = Math.round(src[a + 1] * 50);
        arr[o + a + 2] = Math.round(Math.atan2(Math.sin(src[a + 2]), Math.cos(src[a + 2])) * 1000);
        arr[o + a + 3] = Math.round(src[a + 3] * 100); arr[o + a + 4] = src[a + 4];
      }
    }
    return { hz: 15, n, w, count: out.length, data: b64FromInt16(arr) };
  }
  function decodeClip(c) {
    const arr = int16FromB64(c.data), w = c.w, n = c.n, frames = [];
    for (let f = 0; f < c.count; f++) {
      const o = f * w, fr = new Float32Array(w);
      fr[0] = arr[o] / 50; fr[1] = arr[o + 1] / 50; fr[2] = arr[o + 2] / 100;
      for (let i = 0; i < n; i++) {
        const a = 3 + i * 5;
        fr[a] = arr[o + a] / 50; fr[a + 1] = arr[o + a + 1] / 50; fr[a + 2] = arr[o + a + 2] / 1000; fr[a + 3] = arr[o + a + 3] / 100; fr[a + 4] = arr[o + a + 4];
      }
      frames.push(fr);
    }
    return { frames, hz: c.hz, n };
  }

  // ================= replay player =================
  // meta.players: [{team, num, sname, look, isGK}], meta.teams: [{kit, club, short}]
  class ReplayPlayer {
    constructor(frames, hz, players, teams) {
      this.frames = frames; this.hz = hz; this.t = 0; this.dur = (frames.length - 1) / hz;
      this.teams = teams;
      this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, owner: null };
      this.players = players.map((p) => ({
        team: teams[p.team], ti: p.team, num: p.num, sname: p.sname, look: p.look, isGK: p.isGK,
        x: 0, y: 0, ang: 0, spd: 0, state: 'idle', ctrl: -1, runPhase: Math.random() * 6, onPitch: true,
      }));
      this.view = { ball: this.ball, players: this.players, ref: null };
      this.px = 0; this.py = 0;
      this.apply(0, 0);
    }
    apply(t, dt) {
      const hz = this.hz, fr = this.frames;
      const f = U.clamp(t * hz, 0, fr.length - 1.0001);
      const i = Math.floor(f), k = f - i;
      const a = fr[i], b = fr[Math.min(i + 1, fr.length - 1)];
      const lerp = (x, y) => x + (y - x) * k;
      const nx = lerp(a[0], b[0]), ny = lerp(a[1], b[1]);
      const bl = this.ball;
      if (dt > 0) { bl.vx = (nx - bl.x) / dt; bl.vy = (ny - bl.y) / dt; }
      bl.x = nx; bl.y = ny; bl.z = Math.max(0, lerp(a[2], b[2]));
      for (let p = 0; p < this.players.length; p++) {
        const o = 3 + p * 5, pl = this.players[p];
        pl.x = lerp(a[o], b[o]); pl.y = lerp(a[o + 1], b[o + 1]);
        let da = b[o + 2] - a[o + 2]; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        pl.ang = a[o + 2] + da * k;
        pl.spd = lerp(a[o + 3], b[o + 3]);
        pl.state = STATE_NAMES[a[o + 4] | 0] || 'idle';
        pl.runPhase += pl.spd * dt * 1.5;
      }
    }
    step(dt, speed) {
      this.t = Math.min(this.dur, this.t + dt * speed);
      this.apply(this.t, dt * speed);
      return this.t >= this.dur;
    }
    seek(t) { this.t = U.clamp(t, 0, this.dur); this.apply(this.t, 0); }
  }

  // ================= archive =================
  const KEY = 'clips';
  const Archive = {
    list() { return U.store.get(KEY, []); },
    save(entry) {
      let all = this.list();
      all.unshift(entry);
      while (all.length > 10) all.pop();
      let ok = U.store.set(KEY, all);
      while (!ok && all.length > 1) { all.pop(); ok = U.store.set(KEY, all); }
      return ok;
    },
    remove(id) { U.store.set(KEY, this.list().filter((c) => c.id !== id)); },
    clear() { U.store.set(KEY, []); },
    // make an entry from a running match
    fromMatch(m, frames, goal, lang) {
      const players = m.players.map((p) => ({ team: p.ti, num: p.num, sname: p.sname, look: p.look, isGK: !!p.isGK }));
      const teams = m.teams.map((t) => ({ kit: t.kit, club: t.club, short: t.short, name: t.name }));
      return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        date: Date.now(),
        title: goal && goal.scorer ? goal.scorer.sname : '',
        minute: goal ? goal.minute : 0, og: !!(goal && goal.og),
        team: goal ? goal.team : 0, score: [m.teams[0].score, m.teams[1].score],
        weather: m.weather, tod: m.tod, crowd: { att: m.crowd.att, cap: m.crowd.cap },
        teams, players, clip: encodeClip(frames, m.players.length),
      };
    },
    // rebuild everything needed for playback
    open(entry) {
      const dec = decodeClip(entry.clip);
      const rp = new ReplayPlayer(dec.frames, dec.hz, entry.players, entry.teams);
      const fake = {
        weather: entry.weather, tod: entry.tod, wind: { x: 0.5, y: 0 }, crowd: entry.crowd, teams: entry.teams,
      };
      return { rp, fake };
    },
  };

  // ================= save slots (settings + setup + later career data) =================
  const Saves = {
    SLOTS: 5,
    list() { const a = U.store.get('slots', []); const out = []; for (let i = 0; i < this.SLOTS; i++) out.push(a[i] || null); return out; },
    save(i, name, payload) {
      const a = this.list();
      a[i] = { name: name || ('Slot ' + (i + 1)), date: Date.now(), v: 1, data: payload };
      return U.store.set('slots', a);
    },
    remove(i) { const a = this.list(); a[i] = null; U.store.set('slots', a); },
    load(i) { const s = this.list()[i]; return s ? s.data : null; },
    exportText(i) {
      const s = this.list()[i]; if (!s) return '';
      return 'FCK1:' + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
    },
    importText(i, txt) {
      try {
        txt = (txt || '').trim();
        if (!txt.startsWith('FCK1:')) return false;
        const s = JSON.parse(decodeURIComponent(escape(atob(txt.slice(5)))));
        if (!s || !s.data) return false;
        const a = this.list(); a[i] = s; U.store.set('slots', a);
        return true;
      } catch (e) { return false; }
    },
  };

  // ================= heatmap =================
  function drawHeat(canvas, heat, color) {
    const w = canvas.width, h = canvas.height, g = canvas.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1b6a34'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 10; i += 2) g.fillRect((w / 10) * i, 0, w / 10, h);
    let max = 1;
    for (let i = 0; i < heat.length; i++) if (heat[i] > max) max = heat[i];
    const cw = w / 21, ch = h / 14;
    const rgb = FCK.color.rgb(color);
    // soft blobs
    g.globalCompositeOperation = 'lighter';
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 21; x++) {
        const v = heat[y * 21 + x] / max;
        if (v < 0.03) continue;
        const gr = g.createRadialGradient((x + 0.5) * cw, (y + 0.5) * ch, 0, (x + 0.5) * cw, (y + 0.5) * ch, cw * 1.6);
        const a = Math.min(0.9, v * 0.9);
        gr.addColorStop(0, 'rgba(255,' + Math.round(220 - v * 150) + ',' + Math.round(60 - v * 40) + ',' + a + ')');
        gr.addColorStop(1, 'rgba(255,120,0,0)');
        g.fillStyle = gr; g.fillRect((x - 1.6) * cw, (y - 1.6) * ch, cw * 4.2, ch * 4.2);
      }
    }
    g.globalCompositeOperation = 'source-over';
    // pitch lines
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2;
    const sx = w / P.L, sy = h / P.W;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, P.circleR * sy, 0, Math.PI * 2); g.stroke();
    g.strokeRect(0, (P.cy - P.boxW / 2) * sy, P.boxD * sx, P.boxW * sy);
    g.strokeRect(w - P.boxD * sx, (P.cy - P.boxW / 2) * sy, P.boxD * sx, P.boxW * sy);
    g.strokeRect(0, (P.cy - P.sixW / 2) * sy, P.sixD * sx, P.sixW * sy);
    g.strokeRect(w - P.sixD * sx, (P.cy - P.sixW / 2) * sy, P.sixD * sx, P.sixW * sy);
  }

  FCK.Archive = Archive; FCK.Saves = Saves; FCK.ReplayPlayer = ReplayPlayer; FCK.drawHeat = drawHeat;
  FCK.encodeClip = encodeClip; FCK.decodeClip = decodeClip;
})((globalThis.FCK = globalThis.FCK || {}));
