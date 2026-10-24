/* FCK - packfx.js : 3D pack opening animation for Ultimate Team (three.js). Plays before the card reveal; falls back silently without WebGL. */
(function (FCK) {
  'use strict';
  const FX = {};
  FCK.PackFX = FX;
  const T = (k, v) => FCK.T(k, v);
  const h = FCK.h;

  // [light, dark] foil colours per pack and glow colour per rarity (best card in the pack)
  const FOIL = { bronze: ['#e0a46c', '#7a4a22'], silver: ['#f4f7fc', '#8390ab'], gold: ['#fff0a0', '#c98f10'], prem: ['#9a88ff', '#18267f'], legend: ['#4a3a1a', '#0a0805'] };
  const GLOW = [0xd99a63, 0xdfe8f5, 0xffd24a, 0x8f7bff, 0xfff1b8];
  const NAMES = { bronze: 'BRONZE', silver: 'SILBER', gold: 'GOLD', prem: 'PREMIUM', legend: 'ICON' };

  FX.available = function () {
    try {
      if (typeof THREE === 'undefined' || !THREE.WebGLRenderer) return false;
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
    const dark = id === 'legend' || id === 'prem';
    g.fillStyle = dark ? '#ffe9a8' : '#1a1a2a';
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

  // play({ id, cards, name, sfx }, onDone) -> true when started, false when unavailable (caller then shows the reveal directly)
  FX.play = function (o, onDone) {
    if (!FX.available()) return false;
    let renderer;
    const host = document.getElementById('app') || document.body;
    const wrap = h('div', { class: 'packfx3d', role: 'dialog', 'aria-modal': 'true' });
    const cv = h('canvas', { class: 'pfx-cv' });
    const prompt = h('button', { class: 'pfx-open', type: 'button', text: T('k.fx.tap') });
    const skip = h('button', { class: 'pfx-skip', type: 'button', text: T('k.fx.skip') });
    wrap.appendChild(cv); wrap.appendChild(prompt); wrap.appendChild(skip);
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    } catch (e) { return false; }
    host.appendChild(wrap);
    const sfx = o.sfx || (() => {});
    const best = o.cards.reduce((a, c) => Math.max(a, c.r), 0);
    const glow = new THREE.Color(GLOW[best]);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070b16); scene.fog = new THREE.Fog(0x070b16, 8, 18);
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 40); cam.position.set(0, 0.1, 6.2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(2, 3, 5); scene.add(key);
    const pl = new THREE.PointLight(glow, 0, 12); pl.position.set(0, 0, 2.2); scene.add(pl);
    const disposables = [];
    const track = (x) => { disposables.push(x); return x; };

    // floor glow disc
    const dot = track(dotTexture()), rayT = track(rayTexture());
    const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: dot, color: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    halo.scale.set(7, 7, 1); halo.position.z = -1.2; scene.add(halo);
    // light rays behind the pack
    const rays = new THREE.Group(); rays.position.z = -1;
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.5, 11)), track(new THREE.MeshBasicMaterial({ map: rayT, color: glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      m.rotation.z = (i / 9) * Math.PI; rays.add(m);
    }
    scene.add(rays);

    // the pack: body + top crimp (tears off)
    const tex = track(foilTexture(o.id, NAMES[o.id] || String(o.name || '')));
    const foil = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.55, roughness: 0.32, transparent: true });
    const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color((FOIL[o.id] || FOIL.bronze)[1]), metalness: 0.6, roughness: 0.4, transparent: true });
    track(foil); track(edge);
    const pack = new THREE.Group(); scene.add(pack);
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 1.95, 0.2)), [edge, edge, edge, edge, foil, foil]);
    body.position.y = -0.08; pack.add(body);
    const crimp = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.2, 0.26)), edge); crimp.position.y = 1.0; pack.add(crimp);
    const crimp2 = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.12, 0.26)), edge); crimp2.position.y = -1.12; pack.add(crimp2);

    // particles
    const NP = 260, ppos = new Float32Array(NP * 3), pvel = new Float32Array(NP * 3);
    const pg = track(new THREE.BufferGeometry()); pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    const pm = track(new THREE.PointsMaterial({ map: dot, color: glow, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; scene.add(pts);

    // cards fanning out of the pack (backs, with a glow in the colour of their rarity)
    const back = track(foilTexture('prem', ''));
    const cardMat = track(new THREE.MeshStandardMaterial({ map: back, metalness: 0.4, roughness: 0.4, transparent: true, opacity: 0 }));
    const cards = o.cards.map((c, i) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(0.78, 1.1)), cardMat); g.add(m);
      const gl = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: dot, color: GLOW[c.r], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
      gl.scale.set(c.r >= 3 ? 2.6 : c.r >= 2 ? 2.1 : 1.5, c.r >= 3 ? 3 : c.r >= 2 ? 2.5 : 1.9, 1); gl.position.z = -0.02; g.add(gl);
      g.userData = { gl, c, i }; g.visible = false; scene.add(g); return g;
    });
    const n = cards.length;

    function resize() {
      const w = wrap.clientWidth || 800, hh = wrap.clientHeight || 600;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, hh, false);
      cam.aspect = w / hh; cam.fov = w / hh < 0.8 ? 58 : 42; cam.updateProjectionMatrix();
    }
    resize(); window.addEventListener('resize', resize);

    let phase = 'idle', t0 = performance.now(), last = t0, finished = false, raf = 0;
    const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
    const go = (p) => { phase = p; t0 = performance.now(); };
    function burst() {
      for (let i = 0; i < NP; i++) {
        const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.3) * Math.PI, s = 2 + Math.random() * 5.5;
        ppos[i * 3] = 0; ppos[i * 3 + 1] = 0; ppos[i * 3 + 2] = 0.3;
        pvel[i * 3] = Math.cos(a) * Math.cos(b) * s; pvel[i * 3 + 1] = Math.sin(b) * s + 1.5; pvel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * s * 0.4;
      }
      pg.attributes.position.needsUpdate = true;
    }
    function start() {
      if (phase !== 'idle') return;
      prompt.hidden = true; go('shake'); sfx('whistle');
    }
    function finish() {
      if (finished) return; finished = true;
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('keydown', onKey, true);
      disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* ignore */ } });
      try { foil.dispose(); edge.dispose(); renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) { /* ignore */ }
      wrap.classList.add('out'); setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 250);
      onDone();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
      else if ((e.key === 'Enter' || e.key === ' ') && phase === 'idle') { e.preventDefault(); e.stopPropagation(); start(); }
    }
    document.addEventListener('keydown', onKey, true);
    cv.addEventListener('click', start); prompt.addEventListener('click', start); skip.addEventListener('click', finish);
    setTimeout(() => { try { prompt.focus(); } catch (e) { /* ignore */ } }, 50);

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      rays.rotation.z += dt * (phase === 'idle' ? 0.05 : 0.35);
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
        pl.intensity = 3.5 + (1 - k) * 8; pm.opacity = 1;
        rays.children.forEach((r) => { r.material.opacity = 0.35 + (1 - k) * 0.5; });
        cam.position.z = 5.3 + k * 0.7;
        for (let i = 0; i < NP; i++) {
          pvel[i * 3 + 1] -= 4.5 * dt;
          ppos[i * 3] += pvel[i * 3] * dt; ppos[i * 3 + 1] += pvel[i * 3 + 1] * dt; ppos[i * 3 + 2] += pvel[i * 3 + 2] * dt;
        }
        pg.attributes.position.needsUpdate = true;
        if (t > 0.55) { pack.visible = false; crimp.visible = crimp2.visible = false; go('cards'); }
      } else if (phase === 'cards') {
        pm.opacity = Math.max(0, 1 - t / 1.6); pl.intensity = Math.max(0.6, 2.4 - t * 2);
        for (let i = 0; i < NP; i++) {
          pvel[i * 3 + 1] -= 4.5 * dt;
          ppos[i * 3] += pvel[i * 3] * dt; ppos[i * 3 + 1] += pvel[i * 3 + 1] * dt; ppos[i * 3 + 2] += pvel[i * 3 + 2] * dt;
        }
        pg.attributes.position.needsUpdate = true;
        cardMat.opacity = ease(t / 0.4);
        const spread = n > 1 ? 1 : 0;
        cards.forEach((g, i) => {
          const d = ease((t - i * 0.12) / 0.7);
          g.visible = d > 0;
          const f = n > 1 ? (i - (n - 1) / 2) : 0;
          const mob = cam.aspect < 0.8;
          g.position.set(f * (mob ? 0.52 : 0.95) * d * spread, (mob ? 0.3 : 0.15) * d - Math.abs(f) * 0.06 * d, 0.5 * d + i * 0.01);
          g.rotation.z = -f * 0.09 * d; g.rotation.y = (1 - d) * 3.1;
          const sc = (mob ? 0.8 : 1.15) * (0.4 + d * 0.6) * (i === n - 1 ? 1.12 : 1);
          g.scale.setScalar(sc);
          g.userData.gl.material.opacity = d * (g.userData.c.r >= 2 ? 0.85 : 0.35) * (0.8 + Math.sin(now / 220 + i) * 0.2);
        });
        halo.material.opacity = 0.7;
        cam.position.z += (6.0 - cam.position.z) * 0.08;
        if (t > 2.2) { finish(); return; }
      }
      renderer.render(scene, cam);
    }
    raf = requestAnimationFrame(frame);
    return true;
  };
})((globalThis.FCK = globalThis.FCK || {}));
