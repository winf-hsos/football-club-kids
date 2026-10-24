/* FCK - audio.js : synthesized sound effects, crowd, weather, music, speech */
(function (FCK) {
  'use strict';
  const U = FCK.U;

  const Audio = {
    ctx: null, ok: false, vol: { master: 0.8, sfx: 0.9, music: 0.5, crowd: 0.8, speech: 0.9 }, muted: false,
    nodes: {}, musicOn: false, musicTimer: 0, step: 0, voice: null, speaking: false,

    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        const c = this.ctx = new AC();
        const master = c.createGain(); master.connect(c.destination);
        const sfx = c.createGain(), music = c.createGain(), crowd = c.createGain(), weather = c.createGain();
        sfx.connect(master); music.connect(master); crowd.connect(master); weather.connect(master);
        this.nodes = { master, sfx, music, crowd, weather };
        // noise buffer
        const len = c.sampleRate * 2;
        const nb = c.createBuffer(1, len, c.sampleRate);
        const d = nb.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
        this.noiseBuf = nb;
        // crowd ambience: two filtered noise layers
        const mk = (freq, q, g) => {
          const s = c.createBufferSource(); s.buffer = nb; s.loop = true;
          const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
          const gn = c.createGain(); gn.gain.value = g;
          s.connect(f); f.connect(gn); gn.connect(crowd); s.start();
          return { s, f, gn };
        };
        this.crowdLow = mk(380, 0.5, 0.0);
        this.crowdHigh = mk(1500, 0.7, 0.0);
        // rain
        const rs = c.createBufferSource(); rs.buffer = nb; rs.loop = true;
        const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2400;
        const rg = c.createGain(); rg.gain.value = 0;
        rs.connect(rf); rf.connect(rg); rg.connect(weather); rs.start();
        this.rain = rg;
        this.applyVolumes();
        this.ok = true;
      } catch (e) { this.ok = false; }
    },

    set(vol, muted) {
      Object.assign(this.vol, vol || {});
      if (muted !== undefined) this.muted = muted;
      this.applyVolumes();
    },
    applyVolumes() {
      if (!this.ctx) return;
      const n = this.nodes, v = this.vol, m = this.muted ? 0 : 1;
      const t = this.ctx.currentTime;
      n.master.gain.setTargetAtTime(v.master * m, t, 0.05);
      n.sfx.gain.setTargetAtTime(v.sfx, t, 0.05);
      n.music.gain.setTargetAtTime(v.music * 0.5, t, 0.05);
      n.crowd.gain.setTargetAtTime(v.crowd, t, 0.05);
      n.weather.gain.setTargetAtTime(v.crowd * 0.6, t, 0.05);
    },

    // ----- helpers -----
    env(g, t0, a, d, peak, sus) {
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t0 + a + d);
    },
    noise(dur, type, f0, f1, peak, dest, delay) {
      const c = this.ctx; if (!c) return;
      const t0 = c.currentTime + (delay || 0);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      const g = c.createGain(); this.env(g, t0, 0.005, dur, peak, 0.0001);
      s.connect(f); f.connect(g); g.connect(dest || this.nodes.sfx);
      s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
    },
    tone(type, f0, f1, dur, peak, dest, delay, vib) {
      const c = this.ctx; if (!c) return;
      const t0 = c.currentTime + (delay || 0);
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
      const g = c.createGain(); this.env(g, t0, 0.006, dur, peak, 0.0001);
      if (vib) { const l = c.createOscillator(); l.frequency.value = vib; const lg = c.createGain(); lg.gain.value = f0 * 0.04; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
      o.connect(g); g.connect(dest || this.nodes.sfx);
      o.start(t0); o.stop(t0 + dur + 0.05);
    },

    // ----- sound effects -----
    play(name, a) {
      if (!this.ctx || this.muted) return;
      a = a || 1;
      switch (name) {
        case 'kick': this.noise(0.09, 'lowpass', 900, 200, 0.5 * a); this.tone('sine', 150, 60, 0.12, 0.5 * a); break;
        case 'soft': this.noise(0.06, 'lowpass', 600, 180, 0.22 * a); this.tone('sine', 120, 70, 0.08, 0.2 * a); break;
        case 'shot': this.noise(0.14, 'lowpass', 1400, 150, 0.8 * a); this.tone('sine', 190, 50, 0.16, 0.8 * a); break;
        case 'bounce': this.tone('sine', 110, 55, 0.1, 0.22 * a); break;
        case 'tackle': this.noise(0.12, 'lowpass', 500, 120, 0.5); this.tone('triangle', 90, 50, 0.15, 0.4); break;
        case 'slide': this.noise(0.4, 'bandpass', 2400, 600, 0.3); break;
        case 'post': this.tone('triangle', 880, 700, 0.5, 0.45); this.tone('square', 1320, 1200, 0.25, 0.1); this.noise(0.05, 'highpass', 3000, 3000, 0.4); break;
        case 'net': this.noise(0.5, 'bandpass', 1500, 400, 0.4); break;
        case 'catch': this.noise(0.08, 'lowpass', 700, 300, 0.4); break;
        case 'whistle': this.whistle(0.28 * a, 0); break;
        case 'whistle2': this.whistle(0.2, 0); this.whistle(0.2, 0.28); break;
        case 'whistle3': this.whistle(0.3, 0); this.whistle(0.3, 0.4); this.whistle(0.6, 0.8); break;
        case 'long': this.whistle(0.9, 0); break;
        case 'card': this.tone('square', 660, 660, 0.12, 0.12); this.tone('square', 880, 880, 0.12, 0.12, null, 0.12); break;
        case 'goal': this.roar(1.0, 3.2); this.horn(); break;
        case 'ooh': this.roar(0.55, 1.4, true); break;
        case 'save': this.roar(0.3, 0.9); break;
        case 'groan': this.roar(0.4, 1.3, true, true); break;
        case 'click': this.tone('square', 520, 680, 0.05, 0.08); break;
        case 'back': this.tone('square', 420, 300, 0.06, 0.07); break;
        case 'ok': this.tone('square', 620, 620, 0.06, 0.08); this.tone('square', 930, 930, 0.1, 0.08, null, 0.06); break;
        case 'tick': this.tone('square', 1000, 1000, 0.03, 0.05); break;
        case 'sub': this.tone('triangle', 500, 500, 0.1, 0.15); this.tone('triangle', 750, 750, 0.14, 0.15, null, 0.1); break;
        case 'whooshReplay': this.noise(0.5, 'bandpass', 300, 3000, 0.3); break;
        default: break;
      }
    },
    whistle(dur, delay) {
      this.tone('sine', 3000, 3050, dur, 0.28, null, delay, 38);
      this.tone('sine', 3180, 3220, dur, 0.18, null, delay, 41);
      this.noise(dur, 'bandpass', 3100, 3100, 0.05, null, delay);
    },
    roar(level, dur, short, sad) {
      const c = this.ctx; if (!c) return;
      const t0 = c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
      f.frequency.setValueAtTime(sad ? 700 : 500, t0); f.frequency.linearRampToValueAtTime(sad ? 350 : 1100, t0 + dur * 0.4); f.frequency.linearRampToValueAtTime(500, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.9 * level, t0 + (short ? 0.15 : 0.35)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.nodes.crowd);
      s.start(t0, Math.random()); s.stop(t0 + dur + 0.1);
    },
    horn() {
      this.tone('sawtooth', 220, 220, 0.9, 0.12);
      this.tone('sawtooth', 330, 330, 0.9, 0.1);
      this.tone('square', 110, 110, 0.9, 0.08);
    },

    // ----- ambience -----
    ambience(mood, weather, hush) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const m = U.clamp(mood, 0, 1) * (hush ? 0.3 : 1);
      this.crowdLow.gn.gain.setTargetAtTime(0.18 + m * 0.5, t, 0.3);
      this.crowdHigh.gn.gain.setTargetAtTime(0.03 + m * 0.35, t, 0.3);
      this.crowdLow.f.frequency.setTargetAtTime(330 + m * 250, t, 0.4);
      this.rain.gain.setTargetAtTime(weather === 'rain' ? 0.25 : weather === 'storm' ? 0.5 : 0, t, 0.5);
    },
    silence() { if (this.ctx) { const t = this.ctx.currentTime; this.crowdLow.gn.gain.setTargetAtTime(0, t, 0.2); this.crowdHigh.gn.gain.setTargetAtTime(0, t, 0.2); this.rain.gain.setTargetAtTime(0, t, 0.2); } },

    // ----- music: small generative synthwave loop -----
    startMusic(mode) {
      if (!this.ctx) return;
      this.musicOn = true; this.musicMode = mode || 'menu';
      if (this.musicTimer) return;
      this.nextT = this.ctx.currentTime + 0.1; this.step = 0;
      this.musicTimer = setInterval(() => this.musicTick(), 90);
    },
    stopMusic() { this.musicOn = false; if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = 0; } },
    musicTick() {
      const c = this.ctx; if (!c || !this.musicOn) return;
      const bpm = this.musicMode === 'game' ? 112 : 100, sp = 60 / bpm / 4;
      const roots = [57, 53, 60, 55]; // A3, F3, C4, G3 per bar
      const scale = [0, 3, 7, 10, 12, 15];
      while (this.nextT < c.currentTime + 0.35) {
        const st = this.step, bar = Math.floor(st / 16) % 4, k = st % 16;
        const root = roots[bar];
        const f = (n) => 440 * Math.pow(2, (n - 69) / 12);
        const t = this.nextT, dest = this.nodes.music;
        const tn = (type, fr, dur, pk, del) => {
          const o = c.createOscillator(); o.type = type; o.frequency.value = fr;
          const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + del); g.gain.exponentialRampToValueAtTime(pk, t + del + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + del + dur);
          o.connect(g); g.connect(dest); o.start(t + del); o.stop(t + del + dur + 0.05);
        };
        // bass
        if (k % 4 === 0 || k === 6 || k === 14) tn('sawtooth', f(root - 12), sp * 3, 0.16, 0);
        // arp
        if (k % 2 === 0) tn('square', f(root + 12 + scale[(k / 2 + bar) % scale.length]), sp * 1.6, 0.045, 0);
        // pad
        if (k === 0) { tn('triangle', f(root), sp * 15, 0.06, 0); tn('triangle', f(root + 7), sp * 15, 0.05, 0); tn('triangle', f(root + 12 + 3), sp * 15, 0.04, 0); }
        // drums
        if (k % 4 === 0) { const o = c.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); const g = c.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.2); }
        if (k % 8 === 4) { const s = c.createBufferSource(); s.buffer = this.noiseBuf; const fl = c.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 1800; const g = c.createGain(); g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + 0.14); }
        if (k % 2 === 1) { const s = c.createBufferSource(); s.buffer = this.noiseBuf; const fl = c.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 6500; const g = c.createGain(); g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + 0.06); }
        this.nextT += sp; this.step++;
      }
    },

    // ----- speech -----
    pickVoice(lang) {
      if (!('speechSynthesis' in window)) return null;
      const vs = window.speechSynthesis.getVoices() || [];
      const pre = lang === 'de' ? 'de' : 'en';
      const c = vs.filter((v) => v.lang && v.lang.toLowerCase().startsWith(pre));
      return c.find((v) => /natural|neural|google/i.test(v.name)) || c[0] || null;
    },
    speak(text, lang, force) {
      if (this.muted || !('speechSynthesis' in window)) return;
      try {
        const ss = window.speechSynthesis;
        if (ss.speaking && !force) return;
        if (force) ss.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'de' ? 'de-DE' : 'en-GB';
        const v = this.pickVoice(lang); if (v) u.voice = v;
        u.rate = 1.12; u.pitch = 1.0; u.volume = U.clamp(this.vol.speech * this.vol.master, 0, 1);
        ss.speak(u);
      } catch (e) { /* ignore */ }
    },
    stopSpeech() { try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } },
  };

  FCK.Audio = Audio;
})((globalThis.FCK = globalThis.FCK || {}));
