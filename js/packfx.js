/* FCK - packfx.js : 3D pack opening for Ultimate Team (three.js).
   The pack tears open, then every card is revealed one by one: the player runs up to his card and celebrates with a pose, ball tricks, a spin jump or a backflip - the better the card, the bigger the show.
   Falls back silently (returns false) without WebGL or with "reduce motion". */
(function (FCK) {
  'use strict';
  const FX = {};
  FCK.PackFX = FX;
  const T = (k, v) => FCK.T(k, v);
  const h = FCK.h;

  // [light, dark] foil colours per pack
  const FOIL = { bronze: ['#e0a46c', '#7a4a22'], silver: ['#f4f7fc', '#8390ab'], gold: ['#fff0a0', '#c98f10'], prem: ['#9a88ff', '#18267f'], legend: ['#4a3a1a', '#0a0805'] };
  const NAMES = { bronze: 'BRONZE', silver: 'SILBER', gold: 'GOLD', prem: 'PREMIUM', legend: 'ICON' };
  // card palettes (same look as the .fc cards): c1, c2, ink, edge
  const PAL = { 0: ['#d99a63', '#8a5428', '#2b1707', '#f0c08c'], 1: ['#eef2f8', '#8c99b2', '#182033', '#ffffff'], 2: ['#ffe98a', '#cf9416', '#3a2a05', '#fff3b8'], 3: ['#7a5cff', '#151a66', '#ffffff', '#8ff0ff'], 4: ['#fff4cf', '#c9a247', '#3a2706', '#fff8dc'] };
  const SKP = { otw: ['#14424a', '#04161b', '#7ffcf0', '#2fe0d0'], totw: ['#2c2c33', '#060608', '#f6d77e', '#d9b04a'], tots: ['#2f7bff', '#06194d', '#ffffff', '#8fd8ff'], hero: ['#ff9d42', '#5e2204', '#fff2de', '#ffd28f'], potm: ['#ff55a6', '#3b0a47', '#ffffff', '#ffb7dc'], toty: ['#0f2a8f', '#020822', '#ffe28a', '#f4cb4f'] };
  const palOf = (c) => (c.sk && SKP[c.sk]) || PAL[c.r] || PAL[0];
  const tierOf = (c) => (c.sk ? Math.max(3, c.r) : c.r); // special styles always get at least the elite show
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  FX.available = function () {
    try {
      if (typeof THREE === 'undefined' || !THREE.WebGLRenderer || !FCK.R3D_makePlayer) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return true;
    } catch (e) { return false; }
  };

  function foilTexture(id, label) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 720;
    const g = c.getContext('2d'), f = FOIL[id] || FOIL.bronze;
    const gr = g.createLinearGradient(0, 0, 512, 720); gr.addColorStop(0, f[0]); gr.addColorStop(1, f[1]);
    g.fillStyle = gr; g.fillRect(0, 0, 512, 720);
    g.globalAlpha = 0.16; g.fillStyle = '#fff';
    for (let i = -6; i < 12; i++) { g.save(); g.translate(i * 90, 0); g.rotate(0.35); g.fillRect(0, -100, 34, 1000); g.restore(); }
    g.globalAlpha = 1;
    g.fillStyle = id === 'legend' || id === 'prem' ? '#ffe9a8' : '#1a1a2a';
    g.textAlign = 'center';
    g.font = '800 150px Chakra Petch, Barlow, sans-serif'; g.fillText('FCK', 256, 300);
    g.font = '700 38px Chakra Petch, Barlow, sans-serif'; g.fillText('ULTIMATE TEAM', 256, 360);
    g.font = '800 64px Chakra Petch, Barlow, sans-serif'; g.fillText(label, 256, 520);
    g.beginPath(); g.arc(256, 620, 38, 0, Math.PI * 2); g.lineWidth = 6; g.strokeStyle = g.fillStyle; g.stroke();
    g.font = '60px sans-serif'; g.fillText('⚽', 256, 642);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function dotTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  function rayTexture() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 256;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 32, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
    return new THREE.CanvasTexture(c);
  }
  function ringTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 40, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }

  // the card face as a canvas texture; portrait and crest are loaded asynchronously and the texture is refreshed when they arrive
  function cardFace(c, o) {
    const W = 360, H = 504, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const pal = palOf(c);
    const imgs = {};
    const draw = () => {
      g.clearRect(0, 0, W, H);
      const rt = 50, rb = 118;
      g.beginPath(); g.moveTo(rt, 0); g.lineTo(W - rt, 0); g.quadraticCurveTo(W, 0, W, rt); g.lineTo(W, H - rb); g.quadraticCurveTo(W, H, W - rb, H); g.lineTo(rb, H); g.quadraticCurveTo(0, H, 0, H - rb); g.lineTo(0, rt); g.quadraticCurveTo(0, 0, rt, 0); g.closePath();
      const gr = g.createLinearGradient(0, 0, W * 0.6, H); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
      g.fillStyle = gr; g.fill(); g.lineWidth = 9; g.strokeStyle = pal[3]; g.stroke();
      g.save(); g.clip(); g.globalAlpha = 0.14; g.fillStyle = '#fff';
      for (let i = -3; i < 8; i++) { g.save(); g.translate(i * 80, 0); g.rotate(0.35); g.fillRect(0, -100, 26, 800); g.restore(); } g.restore();
      if (imgs.face) g.drawImage(imgs.face, W * 0.42, H * 0.06, W * 0.56, W * 0.56);
      g.fillStyle = pal[2]; g.textAlign = 'left';
      g.font = '800 96px Chakra Petch, Barlow, sans-serif'; g.fillText(String(c.o), 26, 112);
      g.font = '700 42px Chakra Petch, Barlow, sans-serif'; g.fillText(FCK.posL ? FCK.posL(c.pos) : c.pos, 30, 160);
      if (c.sk || c.r === 4) { g.font = '800 24px Chakra Petch, Barlow, sans-serif'; g.fillText(T('k.sk.' + (c.sk || 'icon') + '.s'), 30, 196); }
      g.textAlign = 'center'; g.font = '800 46px Chakra Petch, Barlow, sans-serif';
      let nm = (c.n.split(' ').pop() || c.n).toUpperCase(); while (g.measureText(nm).width > W - 40 && nm.length > 3) nm = nm.slice(0, -1);
      g.fillText(nm, W / 2, 312);
      g.globalAlpha = 0.5; g.fillRect(40, 326, W - 80, 3); g.globalAlpha = 1;
      if (imgs.crest) g.drawImage(imgs.crest, W / 2 - 54, 344, 40, 40);
      g.font = '40px sans-serif'; g.fillText(o.flag ? o.flag(c) : '', W / 2 + 34, 378);
      const st = o.statsFor ? o.statsFor(c) : [];
      g.font = '700 26px Chakra Petch, Barlow, sans-serif';
      st.forEach((s, i) => { const x = 44 + (i % 3) * 104, y = 424 + Math.floor(i / 3) * 34; g.textAlign = 'left'; g.fillText(String(s[1]), x, y); g.globalAlpha = 0.75; g.font = '600 18px Chakra Petch, Barlow, sans-serif'; g.fillText(s[0], x + 36, y); g.globalAlpha = 1; g.font = '700 26px Chakra Petch, Barlow, sans-serif'; });
      tex.needsUpdate = true;
    };
    const load = (key, url) => { if (!url) return; const im = new Image(); im.onload = () => { imgs[key] = im; draw(); }; im.src = url; };
    draw();
    load('face', o.faceUrl && o.faceUrl(c)); load('crest', o.crestUrl && o.crestUrl(c));
    return tex;
  }

  // play(o, onDone): o = { id, cards (sorted weakest first), name, sfx, faceUrl, crestUrl, kitFor, lookFor, statsFor, flag, rarName }
  // -> true when started, false when unavailable (the caller then shows its normal reveal)
  FX.play = function (o, onDone) {
    if (!FX.available()) return false;
    let renderer;
    const host = document.getElementById('app') || document.body;
    const wrap = h('div', { class: 'packfx3d', role: 'dialog', 'aria-modal': 'true' });
    const cv = h('canvas', { class: 'pfx-cv' });
    const prompt = h('button', { class: 'pfx-open', type: 'button', text: T('k.fx.tap') });
    const skip = h('button', { class: 'pfx-skip', type: 'button', text: T('k.fx.skip') });
    const info = h('div', { class: 'pfx-info', hidden: true });
    wrap.appendChild(cv); wrap.appendChild(info); wrap.appendChild(prompt); wrap.appendChild(skip);
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); } catch (e) { return false; }
    host.appendChild(wrap);
    const sfx = o.sfx || (() => {});
    const cards = o.cards, n = cards.length;
    const best = cards.reduce((a, c) => Math.max(a, tierOf(c)), 0);
    const glowOf = (c) => new THREE.Color(palOf(c)[3]);
    const glow = glowOf(cards.find((c) => tierOf(c) === best) || cards[n - 1]);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070b16); scene.fog = new THREE.Fog(0x070b16, 9, 22);
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 40); cam.position.set(0, 0.1, 6.2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(2, 4, 5); scene.add(key);
    const pl = new THREE.PointLight(glow, 0, 14); pl.position.set(0, 0.5, 2.6); scene.add(pl);
    const disposables = [], players = [];
    const track = (x) => { disposables.push(x); return x; };
    const dot = track(dotTexture()), rayT = track(rayTexture()), ringT = track(ringTexture());
    const additive = (map, color, op) => track(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: op || 0, blending: THREE.AdditiveBlending, depthWrite: false }));

    const halo = new THREE.Sprite(additive(dot, glow, 0)); halo.scale.set(8, 8, 1); halo.position.z = -1.5; scene.add(halo);
    const rays = new THREE.Group(); rays.position.z = -1.2;
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.5, 12)), track(new THREE.MeshBasicMaterial({ map: rayT, color: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      m.rotation.z = (i / 9) * Math.PI; rays.add(m);
    }
    scene.add(rays);

    // ---- the pack
    const tex = track(foilTexture(o.id, NAMES[o.id] || String(o.name || '')));
    const foil = track(new THREE.MeshStandardMaterial({ map: tex, metalness: 0.55, roughness: 0.32, transparent: true }));
    const edge = track(new THREE.MeshStandardMaterial({ color: new THREE.Color((FOIL[o.id] || FOIL.bronze)[1]), metalness: 0.6, roughness: 0.4, transparent: true }));
    const pack = new THREE.Group(); scene.add(pack);
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 1.95, 0.2)), [edge, edge, edge, edge, foil, foil]); body.position.y = -0.08; pack.add(body);
    const crimp = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.2, 0.26)), edge); crimp.position.y = 1.0; pack.add(crimp);
    const crimp2 = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.12, 0.26)), edge); crimp2.position.y = -1.12; pack.add(crimp2);

    // ---- particles (burst, then reused for confetti / sparks)
    const NP = 320, ppos = new Float32Array(NP * 3), pvel = new Float32Array(NP * 3), pg = track(new THREE.BufferGeometry());
    pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    const pm = track(new THREE.PointsMaterial({ map: dot, color: glow, size: 0.2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; scene.add(pts);
    function emit(x, y, z, speed, up, count) {
      for (let k = 0; k < (count || NP); k++) {
        const i = k % NP, a = Math.random() * Math.PI * 2, b = (Math.random() - 0.3) * Math.PI, s = speed * (0.3 + Math.random() * 0.9);
        ppos[i * 3] = x; ppos[i * 3 + 1] = y; ppos[i * 3 + 2] = z;
        pvel[i * 3] = Math.cos(a) * Math.cos(b) * s; pvel[i * 3 + 1] = Math.sin(b) * s + up; pvel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s * 0.4;
      }
      pg.attributes.position.needsUpdate = true; pm.opacity = 1;
    }
    function stepParticles(dt, fade) {
      for (let i = 0; i < NP; i++) {
        pvel[i * 3 + 1] -= 4.5 * dt;
        ppos[i * 3] += pvel[i * 3] * dt; ppos[i * 3 + 1] += pvel[i * 3 + 1] * dt; ppos[i * 3 + 2] += pvel[i * 3 + 2] * dt;
      }
      pg.attributes.position.needsUpdate = true; pm.opacity = Math.max(0, pm.opacity - dt * fade);
    }

    // ---- stage: floor ring + shock rings
    const floor = new THREE.Sprite(additive(ringT, glow, 0)); floor.scale.set(5, 5, 1); scene.add(floor);
    const shocks = [0, 1].map(() => { const s = new THREE.Sprite(additive(ringT, glow, 0)); s.visible = false; scene.add(s); return s; });
    const flash = new THREE.Sprite(additive(dot, 0xffffff, 0)); flash.scale.set(30, 30, 1); flash.position.z = 3; scene.add(flash);

    // ---- cards: back + front on one holder each
    const backTex = track(foilTexture('prem', ''));
    const backMat = track(new THREE.MeshBasicMaterial({ map: backTex, transparent: true, opacity: 0 }));
    const CW = 0.78, CH = 1.1;
    const cardObjs = cards.map((c, i) => {
      const g = new THREE.Group(), fm = new THREE.MeshBasicMaterial({ map: track(cardFace(c, o)), transparent: true, opacity: 1, side: THREE.FrontSide });
      track(fm);
      const front = new THREE.Mesh(track(new THREE.PlaneGeometry(CW, CH)), fm); front.position.z = 0.002;
      const back = new THREE.Mesh(track(new THREE.PlaneGeometry(CW, CH)), backMat); back.rotation.y = Math.PI; back.position.z = -0.002;
      g.add(front); g.add(back);
      const gl = new THREE.Sprite(additive(dot, glowOf(c), 0)); gl.position.z = -0.05; g.add(gl);
      g.rotation.y = Math.PI; g.visible = false; scene.add(g);
      return { g, gl, c, fm, i, tier: tierOf(c), pos: new THREE.Vector3(), sc: 1, ry: Math.PI };
    });

    // ---- the footballer + ball (one model per card, built when needed)
    const ball = FCK.R3D_ball(); ball.visible = false; scene.add(ball); track(ball.geometry); track(ball.material);
    const B = FCK.R3D_B;
    let cur = null; // current reveal state

    function layout() {
      const w = wrap.clientWidth || 800, hh = wrap.clientHeight || 600;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, hh, false);
      cam.aspect = w / hh; cam.fov = w / hh < 0.8 ? 60 : 42; cam.updateProjectionMatrix();
    }
    layout(); window.addEventListener('resize', layout);
    const mob = () => cam.aspect < 0.8;
    const FLOOR = -1.55;
    const stageCard = () => ({ x: mob() ? 0.7 : 1.5, y: mob() ? 0.0 : -0.2, s: mob() ? 1.55 : 2.1 });
    const stagePlayer = () => ({ x: mob() ? -0.95 : -1.5 });
    const queuePos = (i) => { const gap = mob() ? 0.5 : 0.8; return { x: (i - (n - 1) / 2) * gap, y: mob() ? 2.55 : 2.15, s: mob() ? 0.34 : 0.5 }; };

    let phase = 'idle', t0 = performance.now(), last = t0, finished = false, raf = 0, ticks = 0;
    const go = (p) => { phase = p; t0 = performance.now(); };
    function burst() { emit(0, 0, 0.3, 5.5, 1.5, NP); }

    // ---- reveal sequence
    function beginReveal(i) {
      const co = cardObjs[i], c = co.c, tier = co.tier;
      const kit = o.kitFor ? o.kitFor(c) : { shirt: '#d4162a', shirt2: '#d4162a', shorts: '#ffffff', socks: '#d4162a', gk: '#18b46b', gkShorts: '#111', pattern: 'solid' };
      const M = FCK.R3D_makePlayer({ look: o.lookFor ? o.lookFor(c) : null, num: 1 + (i * 7) % 98, isGK: c.pos === 'GK', sname: c.n }, kit);
      const holder = new THREE.Group(); holder.add(M.group); M.group.position.y = -0.95; scene.add(holder); players.push(M);
      const sp = stagePlayer();
      const dur = [1.9, 2.3, 3.3, 4.4, 5.6][tier];
      cur = { i, co, c, tier, M, holder, t: 0, dur, sp, from: { x: sp.x - (mob() ? 3.6 : 5.2) }, shock: 0, fired: {}, ballT: 0, cardFrom: co.g.position.clone(), cardFromS: co.g.scale.x, flip: 0 };
      holder.position.set(cur.from.x, FLOOR + 0.95, 0.4);
      co.g.visible = true; co.gl.material.opacity = 0;
      info.hidden = false;
      info.innerHTML = '';
      info.appendChild(h('div', { class: 'pfx-n', text: (i + 1) + ' / ' + n }));
      info.appendChild(h('b', { class: 'pfx-name', text: c.n }));
      info.appendChild(h('div', { class: 'pfx-sub', text: c.o + ' · ' + (FCK.posL ? FCK.posL(c.pos) : c.pos) + ' · ' + (o.rarName ? o.rarName(c) : '') }));
      info.classList.remove('show'); void info.offsetWidth;
      prompt.hidden = false; prompt.textContent = i === n - 1 ? T('k.fx.done') : T('k.fx.next');
      sfx('tick');
    }
    function endReveal() {
      if (!cur) return;
      const co = cur.co, q = queuePos(cur.i);
      co.pos.set(q.x, q.y, 0); co.sc = q.s; co.ry = 0; co.g.position.copy(co.pos); co.g.scale.setScalar(co.sc); co.g.rotation.set(0, 0, 0); co.gl.material.opacity = 0.35 * (co.tier >= 2 ? 2 : 1);
      scene.remove(cur.holder); cur.M.dispose2(); players.splice(players.indexOf(cur.M), 1); ball.visible = false;
      cur = null;
    }
    function nextReveal() {
      if (cur) { const i = cur.i; endReveal(); if (i + 1 < n) beginReveal(i + 1); else { go('outro'); info.hidden = true; prompt.hidden = true; } } else beginReveal(0);
    }

    function setArms(bn, aL, fL, spL, aR, fR, spR) {
      bn[B.ARM_L].rotation.set(spL * Math.cos(aL), 0, aL); bn[B.FORE_L].rotation.set(0, 0, fL);
      bn[B.ARM_R].rotation.set(-spR * Math.cos(aR), 0, aR); bn[B.FORE_R].rotation.set(0, 0, fR);
    }
    function shockwave(k, y) {
      const s = shocks[k % 2]; s.visible = true; s.userData = { t: 0, y }; s.position.set(cur ? cur.holder.position.x : 0, y, 0.2);
    }

    // one frame of the reveal: card flight + flip, player run-in, then the performance for the card's tier
    function stepReveal(dt, now) {
      const R = cur, M = R.M, bn = M.bones, tier = R.tier, co = R.co;
      R.t += dt;
      const t = R.t, sc = stageCard(), sp = R.sp;
      // card: flies to the stage and turns around
      const fly = ease(t / 0.7);
      co.g.position.set(lerp(R.cardFrom.x, sc.x, fly), lerp(R.cardFrom.y, sc.y, fly) + Math.sin(fly * Math.PI) * 0.5, lerp(R.cardFrom.z, 0.3, fly));
      co.g.scale.setScalar(lerp(R.cardFromS, sc.s, fly));
      const flipP = ease((t - 0.35) / 0.55);
      co.g.rotation.y = lerp(Math.PI, 0, flipP) + (tier >= 3 ? Math.sin(now / 600) * 0.12 * flipP : Math.sin(now / 900) * 0.05 * flipP);
      co.g.rotation.z = Math.sin(fly * Math.PI * 2) * 0.12 * (1 - flipP);
      if (!R.fired.flip && flipP > 0.5) { R.fired.flip = 1; sfx(tier >= 3 ? 'goal' : tier === 2 ? 'ok' : 'tick'); }
      const glowK = ease((t - 0.5) / 0.6);
      co.gl.material.opacity = glowK * (0.3 + tier * 0.17) * (0.85 + Math.sin(now / 180) * 0.15);
      co.gl.scale.set(lerp(1.6, 3.2 + tier * 0.5, glowK) * sc.s * 0.7, lerp(2, 4 + tier * 0.6, glowK) * sc.s * 0.7, 1);
      floor.material.color.copy(co.gl.material.color); floor.material.opacity = glowK * (0.4 + tier * 0.12); floor.position.set(sp.x * 0.5 + sc.x * 0.5, FLOOR + 0.02, 0.2); floor.scale.set(6.5, 6.5, 1);
      pl.color.copy(co.gl.material.color); pl.intensity = 1.0 + glowK * (0.6 + tier * 0.5);
      halo.material.color.copy(co.gl.material.color); halo.material.opacity = 0.15 + glowK * (0.06 + tier * 0.05);
      rays.children.forEach((r) => { r.material.color.copy(co.gl.material.color); r.material.opacity = tier >= 2 ? glowK * (0.06 + tier * 0.04) : 0; });
      if (tier >= 2 && !R.fired.sparks && t > 0.8) { R.fired.sparks = 1; emit(sc.x, sc.y, 0.5, 2 + tier, 1, 60 + tier * 60); }
      // player
      const run = 0.5 + tier * 0.12, tRun = 1.0 / run, arrive = clamp(t / tRun, 0, 1);
      const px = lerp(R.from.x, sp.x, ease(arrive));
      const pose = { x: 0, y: 0, ang: 0, spd: arrive < 1 ? 6.4 + tier * 0.4 : 0, state: 'idle', isGK: false };
      let yaw = lerp(0, -Math.PI / 2, ease((t - tRun + 0.15) / 0.35)); // run to the right, then turn to the camera
      let hy = FLOOR + 0.95, hrx = 0, hz = 0.4, ballOn = false;
      const pt = t - tRun; // performance time
      const D = R.dur - tRun;
      M.pose(pose, dt, now / 1000, { lookYaw: 0 });
      if (pt > 0) {
        const u = pt / D;
        if (tier === 0) {
          // casual: hands on hips, nod
          setArms(bn, 0.55, 1.9, 0.9, 0.55, 1.9, 0.9); bn[B.HEAD].rotation.set(0, 0, 0.1 * Math.sin(pt * 5));
        } else if (tier === 1) {
          // points at the card, then waves
          const pointing = pt < 0.8;
          if (pointing) { const q = ease(pt / 0.25); setArms(bn, 0.1, 0.1, 0.1, lerp(0.1, 1.55, q), 0.05, 0.05); yaw = lerp(yaw, -Math.PI * 0.2, q); }
          else setArms(bn, 2.5 + Math.sin(pt * 9) * 0.25, 0.3, 0.3, 0.1, 0.3, 0.1);
        } else if (tier === 2) {
          // ball tricks: juggling, then a cheer
          const jt = pt, bounce = 0.5; ballOn = jt < D - 0.7;
          const ph = (jt % bounce) / bounce, hh = Math.sin(ph * Math.PI);
          if (ballOn) {
            ball.visible = true; ball.position.set(px + 0.38 + Math.sin(jt * 3) * 0.05, FLOOR + 0.35 + hh * 1.3, 0.7); ball.rotation.x += dt * 8; ball.rotation.z += dt * 5;
            const lift = 1 - Math.abs(ph - 0.05) * 6; const k = clamp(lift, 0, 1);
            bn[B.THIGH_R].rotation.set(0, 0, 0.2 + k * 1.1); bn[B.SHIN_R].rotation.set(0, 0, -(0.15 + k * 1.2));
            setArms(bn, 0.5, 0.8, 0.7, -0.15, 0.4, 0.5); yaw = lerp(yaw, -Math.PI / 2 + 0.15, 0.6);
          } else {
            ball.visible = false; const q = ease((jt - (D - 0.7)) / 0.2); setArms(bn, lerp(0.3, 2.7, q) + Math.sin(jt * 14) * 0.2 * q, 0.2, 0.5, lerp(0.3, 2.7, q) - Math.sin(jt * 14) * 0.2 * q, 0.2, 0.5);
            hy += Math.abs(Math.sin(jt * 9)) * 0.25 * q;
          }
        } else if (tier === 3) {
          // spin jump with a fist, ball flick, shockwave on landing
          const jumpAt = 0.5, jd = 0.8;
          if (pt > jumpAt && pt < jumpAt + jd) {
            const q = (pt - jumpAt) / jd; hy += Math.sin(q * Math.PI) * 1.1; yaw += q * Math.PI * 2;
            setArms(bn, 2.9, 0.15, 0.3, 2.9, 0.15, 0.3);
            bn[B.THIGH_L].rotation.set(0, 0, 0.6); bn[B.SHIN_L].rotation.set(0, 0, -0.9); bn[B.THIGH_R].rotation.set(0, 0, -0.3); bn[B.SHIN_R].rotation.set(0, 0, -1.2);
            if (!R.fired.j1) { R.fired.j1 = 1; sfx('whistle'); }
          } else if (pt >= jumpAt + jd) {
            if (!R.fired.land) { R.fired.land = 1; shockwave(0, FLOOR + 0.05); emit(px, FLOOR + 0.1, 0.4, 5, 1, 120); flash.material.opacity = 0.3; sfx('goal'); R.shake = 0.4; }
            const q = pt - jumpAt - jd; setArms(bn, 2.7 + Math.sin(q * 12) * 0.3, 0.2, 0.5, 0.15 + Math.max(0, 1 - q * 2) * 2.5, 0.3, 0.2); hy += Math.abs(Math.sin(q * 8)) * 0.22;
          } else { const q = ease(pt / jumpAt); setArms(bn, 0.5 + q * 0.4, 1.0, 0.7, 0.5 + q * 0.4, 1.0, 0.7); hy -= q * 0.18; }
        } else {
          // icon walk-out: sprint, backflip, land with crossed arms, big shockwave
          const fl = 0.35, fd = 1.0;
          if (pt > fl && pt < fl + fd) {
            const q = (pt - fl) / fd; hy += Math.sin(q * Math.PI) * 1.5; hrx = -q * Math.PI * 2;
            bn[B.THIGH_L].rotation.set(0, 0, 1.2); bn[B.SHIN_L].rotation.set(0, 0, -1.7); bn[B.THIGH_R].rotation.set(0, 0, 1.3); bn[B.SHIN_R].rotation.set(0, 0, -1.8); setArms(bn, 1.0, 1.7, 0.5, 1.0, 1.7, 0.5);
            if (!R.fired.j1) { R.fired.j1 = 1; sfx('whistle'); }
          } else if (pt >= fl + fd) {
            if (!R.fired.land) { R.fired.land = 1; shockwave(0, FLOOR + 0.05); R.fired.sw2 = pt; emit(px, FLOOR + 0.1, 0.4, 7, 2, 200); flash.material.opacity = 0.45; sfx('goal'); R.shake = 0.8; }
            if (!R.fired.sw2b && pt > fl + fd + 0.3) { R.fired.sw2b = 1; shockwave(1, FLOOR + 0.05); emit(sc.x, sc.y + 0.5, 0.5, 6, 3, 160); }
            const q = ease((pt - fl - fd) / 0.35); setArms(bn, lerp(0.2, 1.05, q), lerp(0.2, 2.3, q), 0.9, lerp(0.2, 1.05, q), lerp(0.2, 2.3, q), 0.9); hy -= q * 0.1;
            bn[B.HEAD].rotation.set(0, 0, 0.05);
          } else { const q = ease(pt / fl); setArms(bn, 0.5, 1.2, 0.8, 0.5, 1.2, 0.8); hy -= q * 0.25; }
        }
      }
      M.group.rotation.y = yaw;
      R.holder.position.set(px, hy, hz);
      R.holder.rotation.x = hrx;
      // slow dolly + shake on the big ones
      const camZ = lerp(6.2, (mob() ? 6.2 : 5.5) - tier * 0.15, ease(t / 1.2));
      cam.position.z += (camZ - cam.position.z) * 0.1;
      const orbit = tier >= 3 ? Math.sin(t * 0.9) * 0.45 * ease((t - 1.2) / 1.0) : 0;
      cam.position.x += ((orbit) - cam.position.x) * 0.08;
      cam.position.y += ((0.35 + (tier >= 4 ? Math.sin(t * 1.4) * 0.25 : 0)) - cam.position.y) * 0.08;
      if (R.shake > 0) { cam.position.x += (Math.random() - 0.5) * R.shake * 0.25; cam.position.y += (Math.random() - 0.5) * R.shake * 0.25; R.shake = Math.max(0, R.shake - dt * 1.4); }
      cam.lookAt(0, 0.15, 0);
      if (!info.classList.contains('show') && t > 0.9) info.classList.add('show');
      if (t >= R.dur) nextReveal();
    }

    function stepShocks(dt) {
      shocks.forEach((s) => {
        if (!s.visible) return;
        const u = s.userData; u.t += dt; const k = u.t / 0.9;
        if (k >= 1) { s.visible = false; return; }
        s.scale.set(1 + k * 10, 1 + k * 10, 1); s.position.y = u.y; s.material.opacity = (1 - k) * 0.8;
      });
      if (flash.material.opacity > 0) flash.material.opacity = Math.max(0, flash.material.opacity - dt * 3);
    }

    function start() {
      if (phase !== 'idle') return;
      prompt.hidden = true; go('shake'); sfx('whistle');
    }
    function advance() { if (phase === 'reveal' && cur) { cur.t = Math.max(cur.t, cur.dur); } }
    function finish() {
      if (finished) return; finished = true;
      cancelAnimationFrame(raf); window.removeEventListener('resize', layout); document.removeEventListener('keydown', onKey, true);
      players.forEach((m) => { try { m.dispose2(); } catch (e) { /* ignore */ } });
      disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* ignore */ } });
      try { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) { /* ignore */ }
      wrap.classList.add('out'); setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 250);
      onDone(phase !== 'idle' && phase !== 'shake' && phase !== 'burst');
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (phase === 'idle') start(); else advance(); }
    }
    document.addEventListener('keydown', onKey, true);
    const tap = () => { if (phase === 'idle') start(); else advance(); };
    cv.addEventListener('click', tap); prompt.addEventListener('click', tap); skip.addEventListener('click', finish);
    setTimeout(() => { try { prompt.focus(); } catch (e) { /* ignore */ } }, 50);

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; ticks++;
      const t = (now - t0) / 1000;
      rays.rotation.z += dt * (phase === 'idle' ? 0.05 : 0.3);
      stepShocks(dt);
      if (phase === 'idle') {
        pack.position.y = Math.sin(now / 700) * 0.08; pack.rotation.y = Math.sin(now / 1300) * 0.45; pack.rotation.x = Math.sin(now / 1700) * 0.06;
        halo.material.opacity = 0.25 + Math.sin(now / 500) * 0.05; halo.material.color.set(0x4a6bff);
      } else if (phase === 'shake') {
        const k = ease(t / 1.5);
        pack.rotation.y *= 0.9; pack.rotation.z = Math.sin(now / 24) * 0.12 * k; pack.position.x = Math.sin(now / 31) * 0.09 * k; pack.position.y = Math.sin(now / 700) * 0.08;
        pack.scale.setScalar(1 + k * 0.18);
        pl.intensity = k * 3.5; halo.material.opacity = 0.3 + k * 0.7; halo.material.color.copy(glow);
        rays.children.forEach((r) => { r.material.opacity = k * 0.35; });
        cam.position.z = 6.2 - k * 0.9;
        if (t > 1.5) { go('burst'); burst(); sfx(best >= 3 ? 'goal' : best === 2 ? 'ok' : 'tick'); }
      } else if (phase === 'burst') {
        const k = ease(t / 0.55);
        crimp.position.y = 1.0 + t * 5; crimp.rotation.z = t * 6; crimp.rotation.x = t * 4;
        crimp2.position.y = -1.12 - t * 4; crimp2.rotation.z = -t * 5;
        foil.opacity = edge.opacity = 1 - k; pack.scale.setScalar(1.18 + k * 0.5); pack.rotation.z *= 0.8; pack.position.x *= 0.8;
        pl.intensity = 3.5 + (1 - k) * 8; stepParticles(dt, 0.25);
        rays.children.forEach((r) => { r.material.opacity = 0.35 + (1 - k) * 0.5; });
        cam.position.z = 5.3 + k * 0.9;
        if (t > 0.55) { pack.visible = false; go('fan'); }
      } else if (phase === 'fan') {
        // the cards fly out of the pack and line up in a row at the top
        stepParticles(dt, 0.6); pl.intensity = Math.max(1, 3.5 - t * 2.5);
        backMat.opacity = ease(t / 0.4);
        cardObjs.forEach((co, i) => {
          const d = ease((t - i * 0.1) / 0.6), q = queuePos(i);
          co.g.visible = d > 0;
          const f = n > 1 ? (i - (n - 1) / 2) : 0;
          const fx = f * (mob() ? 0.5 : 0.95), fy = (mob() ? 0.2 : 0.1) - Math.abs(f) * 0.06;
          const qd = ease((t - 0.9) / 0.7);
          co.pos.set(lerp(fx * d, q.x, qd), lerp(fy * d, q.y, qd), 0.4 * d);
          co.sc = lerp((mob() ? 0.8 : 1.15) * (0.4 + d * 0.6), q.s, qd);
          co.g.position.copy(co.pos); co.g.scale.setScalar(co.sc); co.g.rotation.set(0, Math.PI + (1 - d) * 3.1 * -1, -f * 0.09 * d * (1 - qd));
          co.gl.material.opacity = d * (co.tier >= 2 ? 0.7 : 0.25) * (0.8 + Math.sin(now / 220 + i) * 0.2) * (1 - qd * 0.6);
          co.gl.scale.set(co.tier >= 3 ? 2.6 : co.tier >= 2 ? 2.1 : 1.5, co.tier >= 3 ? 3 : co.tier >= 2 ? 2.5 : 1.9, 1);
        });
        cam.position.z += (6.2 - cam.position.z) * 0.08;
        if (t > 1.7) { go('reveal'); nextReveal(); }
      } else if (phase === 'reveal') {
        stepParticles(dt, 0.5);
        if (cur) stepReveal(dt, now);
      } else if (phase === 'outro') {
        stepParticles(dt, 0.8); pl.intensity = Math.max(0, pl.intensity - dt * 2);
        if (t > 0.5) { finish(); return; }
      }
      renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);
    return true;
  };
})((globalThis.FCK = globalThis.FCK || {}));
