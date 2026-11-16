/* FCK - intro3d.js : short 3D scenes before a match (fans walking through the street to the stadium, the players in the tunnel, the walk-out).
   Needs WebGL (falls back to "no intro"); any key / tap skips. Uses the footballer model of the 3D match view (FCK.R3D_makePlayer). */
(function (FCK) {
  'use strict';
  const Intro = {};
  FCK.Intro = Intro;
  const T = (k, v) => FCK.T(k, v);
  const h = FCK.h;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  Intro.available = function () {
    try {
      if (navigator.webdriver) return false; // automated tests start matches directly
      if (typeof THREE === 'undefined' || !THREE.WebGLRenderer || !FCK.R3D_makePlayer) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return FCK.settings && FCK.settings.intro3d !== false;
    } catch (e) { return false; }
  };

  function windowsTexture(seed) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d'); g.fillStyle = '#1b2030'; g.fillRect(0, 0, 128, 256);
    let s = seed;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let y = 8; y < 248; y += 22) for (let x = 8; x < 120; x += 20) { g.fillStyle = rnd() < 0.55 ? (rnd() < 0.5 ? '#ffd88a' : '#f4e9c8') : '#2b3348'; g.fillRect(x, y, 12, 14); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), q = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.35, 'rgba(255,255,255,.55)'); q.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = q; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  }
  function crestTexture(club) {
    const im = new Image(), t = new THREE.Texture(im);
    im.onload = () => { t.needsUpdate = true; };
    try { im.src = FCK.crestDataUrl(club, 128); } catch (e) { /* no crest */ }
    return t;
  }

  // play({ home, away, kits, stadium, sfx }, onDone) -> true when started
  Intro.play = function (o, onDone) {
    if (!Intro.available()) return false;
    let renderer;
    const host = document.getElementById('app') || document.body;
    const wrap = h('div', { class: 'intro3d', role: 'dialog', 'aria-modal': 'true' });
    const cv = h('canvas', { class: 'in-cv' });
    const title = h('div', { class: 'in-title' }, h('b', { text: o.home.name + '  –  ' + o.away.name }), h('small', { text: o.stadium || '' }));
    const skip = h('button', { class: 'in-skip', type: 'button', text: T('intro.skip') });
    wrap.appendChild(cv); wrap.appendChild(title); wrap.appendChild(skip);
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); } catch (e) { return false; }
    host.appendChild(wrap);
    const F = FCK.Face, U = FCK.U, rng = U.makeRng(FCK.World ? FCK.World.hash(o.home.name + o.away.name) : 7);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
    const disposables = [], players = [];
    const track = (x) => { disposables.push(x); return x; };
    scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x2a2a35, 0.85));
    const sun = new THREE.DirectionalLight(0xffe6c0, 0.7); sun.position.set(-6, 10, 8); scene.add(sun);
    const mkPlayer = (kit, num, club, scale, isKid) => {
      const look = F.random(rng, isKid);
      const M = FCK.R3D_makePlayer({ look, num, isGK: false, sname: 'i' + num + rng.int(0, 1e6), last: '' }, kit, null);
      if (scale) M.group.scale.multiplyScalar(scale);
      scene.add(M.group); players.push(M); return M;
    };
    const glowT = track(glowTexture());
    const glow = (x, y, z, s, c, op) => { const sp = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowT, color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }))); sp.position.set(x, y, z); sp.scale.set(s, s, 1); scene.add(sp); return sp; };

    // ================= scene 1: the street to the stadium (z from 5 down to -80) =================
    const street = new THREE.Group(); scene.add(street);
    const asphalt = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 240)), track(new THREE.MeshLambertMaterial({ color: 0x2b2e38 }))); asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(0, 0, -90); street.add(asphalt);
    const walk = track(new THREE.MeshLambertMaterial({ color: 0x5d6270 }));
    [-1, 1].forEach((d) => { const w = new THREE.Mesh(track(new THREE.BoxGeometry(6, 0.18, 240)), walk); w.position.set(d * 6.5, 0.09, -90); street.add(w); });
    const lineM = track(new THREE.MeshBasicMaterial({ color: 0xcfd3dc }));
    for (let z = 4; z > -100; z -= 7) { const l = new THREE.Mesh(track(new THREE.PlaneGeometry(0.25, 3.2)), lineM); l.rotation.x = -Math.PI / 2; l.position.set(0, 0.02, z); street.add(l); }
    // buildings with lit windows
    for (let side = -1; side <= 1; side += 2) {
      for (let z = 8, i = 0; z > -100; z -= 12 + rng.range(0, 4), i++) {
        const hh = rng.range(14, 30), w = rng.range(9, 12), tex = track(windowsTexture(i * 7 + (side > 0 ? 3 : 0))); tex.repeat.set(w / 12, hh / 18);
        const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, hh, 11)), track(new THREE.MeshLambertMaterial({ map: tex, color: new THREE.Color().setHSL(0.6, 0.08, rng.range(0.55, 0.9)) })));
        m.position.set(side * (11.5 + w / 2), hh / 2, z); street.add(m);
      }
    }
    // street lamps
    for (let z = 2; z > -100; z -= 14) [-1, 1].forEach((d) => {
      const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.08, 0.1, 6.2, 8)), track(new THREE.MeshLambertMaterial({ color: 0x3a3f4c }))); pole.position.set(d * 9.6, 3.1, z); street.add(pole);
      glow(d * 9.6, 6.3, z, 3.2, 0xffe0a0, 0.9);
    });
    // the stadium at the end of the street: a dark bowl with a glowing rim, floodlights and banners
    const stad = new THREE.Group(); stad.position.set(0, 0, -96); street.add(stad);
    const bowl = new THREE.Mesh(track(new THREE.CylinderGeometry(46, 52, 22, 48, 1, true)), track(new THREE.MeshLambertMaterial({ color: 0x2c3242, side: THREE.DoubleSide }))); bowl.position.y = 11; stad.add(bowl);
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(47, 0.7, 8, 64)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(o.home.colors ? o.home.colors.p : '#d4162a') }))); rim.rotation.x = Math.PI / 2; rim.position.y = 22.5; stad.add(rim);
    [-1, 1].forEach((d) => { const tw = new THREE.Mesh(track(new THREE.BoxGeometry(1, 36, 1)), track(new THREE.MeshLambertMaterial({ color: 0x40485a }))); tw.position.set(d * 30, 18, 38); stad.add(tw); glow(d * 30, 36, 38, 22, 0xfff3d8, 1); });
    glow(0, 24, 44, 70, 0xfff0d0, 0.55);
    const crT = track(crestTexture(o.home));
    const crest = new THREE.Mesh(track(new THREE.PlaneGeometry(18, 18)), new THREE.MeshBasicMaterial({ map: crT, transparent: true })); crest.position.set(0, 12, 45); stad.add(crest);
    // fans walking to the stadium (home and away colours, scarves up, some with flags)
    const fans = [];
    const fanKits = [o.kits[0], o.kits[0], o.kits[0], o.kits[1]];
    for (let i = 0; i < 46; i++) {
      const kit = fanKits[i % 4];
      const M = mkPlayer({ shirt: kit.shirt, shirt2: kit.shirt2, shorts: i % 3 ? '#2b3247' : kit.shorts, socks: kit.socks, gk: kit.gk, gkShorts: kit.gkShorts, pattern: kit.pattern }, 1 + (i % 99), null, i % 9 === 0 ? 0.7 : 1, i % 9 === 0);
      const side = i % 2 ? 1 : -1, z0 = 4 - (i * 1.9) % 70 + rng.range(-1, 1);
      M.fan = { x: side * rng.range(4.2, 8.4), z: z0, sp: rng.range(1.1, 2.2), up: rng.next() < 0.4, side, flag: rng.next() < 0.25 };
      M.group.rotation.y = Math.PI / 2 + rng.range(-0.15, 0.15);
      fans.push(M);
    }
    // flags and scarves above the crowd
    const flagM = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(o.home.colors ? o.home.colors.p : '#d4162a'), side: THREE.DoubleSide }));
    const flags = fans.filter((f) => f.fan.flag).map((f) => { const g = new THREE.Group(); const pole = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 6)), track(new THREE.MeshLambertMaterial({ color: 0xdddddd }))); pole.position.y = 1.3; const cl = new THREE.Mesh(track(new THREE.PlaneGeometry(0.9, 0.6)), flagM); cl.position.set(0.45, 2.3, 0); g.add(pole, cl); g.userData = { cl }; scene.add(g); return { f, g }; });

    // ================= scene 2: the tunnel (a corridor along -z at x = 500) =================
    const TX = 500;
    const tun = new THREE.Group(); tun.position.set(TX, 0, 0); scene.add(tun);
    const conc = track(new THREE.MeshLambertMaterial({ color: 0x4a4f5c })), ceil = track(new THREE.MeshLambertMaterial({ color: 0x2a2e38 })), floorM = track(new THREE.MeshStandardMaterial({ color: 0x20232c, roughness: 0.25, metalness: 0.2 }));
    const wl = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 4.2, 40)), conc); wl.position.set(-2.2, 2.1, -14); tun.add(wl);
    const wr = wl.clone(); wr.position.x = 2.2; tun.add(wr);
    const fl = new THREE.Mesh(track(new THREE.BoxGeometry(4.4, 0.2, 40)), floorM); fl.position.set(0, 0, -14); tun.add(fl);
    const cl2 = new THREE.Mesh(track(new THREE.BoxGeometry(4.6, 0.3, 40)), ceil); cl2.position.set(0, 4.2, -14); tun.add(cl2);
    const stripM = track(new THREE.MeshBasicMaterial({ color: 0xfff1d0 }));
    for (let z = 4; z > -32; z -= 3.2) { const s = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 0.06, 0.5)), stripM); s.position.set(0, 4.03, z); tun.add(s); }
    [o.home, o.away].forEach((cb, i) => { const t = track(crestTexture(cb)); const cr = new THREE.Mesh(track(new THREE.PlaneGeometry(1.4, 1.4)), new THREE.MeshBasicMaterial({ map: t, transparent: true })); cr.position.set(i ? 2.04 : -2.04, 2.4, -6); cr.rotation.y = i ? -Math.PI / 2 : Math.PI / 2; tun.add(cr); });
    const lightEnd = glow(TX, 1.8, -34, 14, 0xffffff, 1); lightEnd.position.set(TX, 2, -33);
    const tunPlayers = [];
    [0, 1].forEach((tm) => {
      const kit = o.kits[tm];
      // a kid mascot in front of the line, then the eleven
      const kid = mkPlayer(kit, 0, null, 0.58, true); kid.group.position.set(TX + (tm ? 1.0 : -1.0), 0, -1.2); kid.group.rotation.y = Math.PI / 2; tunPlayers.push(kid);
      for (let i = 0; i < 11; i++) {
        const M = mkPlayer(kit, i === 0 ? 1 : i + 1, null, 1, false);
        M.group.position.set(TX + (tm ? 1.0 : -1.0), 0, -2.4 - i * 1.15); M.group.rotation.y = Math.PI / 2 + (tm ? -0.05 : 0.05); tunPlayers.push(M);
      }
    });
    // ================= scene 3: the pitch light at the end =================
    const flash = glow(TX, 2, -30, 1, 0xffffff, 0);

    function layout() {
      const w = wrap.clientWidth || 800, hh = wrap.clientHeight || 600;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, hh, false);
      cam.aspect = w / hh; cam.fov = w / hh < 0.8 ? 66 : 48; cam.updateProjectionMatrix();
    }
    layout(); window.addEventListener('resize', layout);

    const DUR = [3.6, 3.6, 1.8]; const TOT = DUR[0] + DUR[1] + DUR[2];
    let t = 0, last = performance.now(), raf = 0, finished = false;
    function finish() {
      if (finished) return; finished = true;
      cancelAnimationFrame(raf); window.removeEventListener('resize', layout); document.removeEventListener('keydown', onKey, true);
      players.forEach((m) => { try { m.dispose2(); } catch (e) { /* ignore */ } });
      disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* ignore */ } });
      try { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); } catch (e) { /* ignore */ }
      wrap.classList.add('out'); setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 300);
      onDone();
    }
    function onKey(e) { e.preventDefault(); e.stopPropagation(); finish(); }
    document.addEventListener('keydown', onKey, true);
    cv.addEventListener('click', finish); skip.addEventListener('click', finish);
    const gpPoll = setInterval(() => { try { const gps = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of gps) if (g && g.buttons.some((b) => b.pressed)) { clearInterval(gpPoll); finish(); } } catch (e) { /* ignore */ } }, 200);
    const old = finish;

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const tt = now / 1000;
      if (t < DUR[0]) {
        // --- street: fly along the avenue
        const u = t / DUR[0];
        cam.position.set(Math.sin(u * 1.5) * 1.2, lerp(1.7, 3.6, ease(u)), lerp(6, -22, u)); cam.lookAt(0, 2.2 + u * 3, -60);
        title.classList.toggle('show', u > 0.15);
      } else if (t < DUR[0] + DUR[1]) {
        // --- tunnel: slow push between the two lines
        const u = (t - DUR[0]) / DUR[1];
        cam.position.set(TX + Math.sin(u * 2) * 0.25, lerp(1.45, 1.6, u), lerp(3.2, -6.5, ease(u))); cam.lookAt(TX, 1.5, -30);
        title.classList.remove('show');
      } else {
        // --- walk-out: into the light
        const u = (t - DUR[0] - DUR[1]) / DUR[2];
        cam.position.set(TX, 1.6, lerp(-6.5, -17, ease(u))); cam.lookAt(TX, 1.6, -34);
        flash.scale.setScalar(lerp(14, 220, u * u)); flash.material.opacity = lerp(1, 1, u);
      }
      // fans keep walking
      fans.forEach((M) => {
        const f = M.fan; f.z -= f.sp * dt; if (f.z < -78) f.z = 8;
        M.group.position.set(f.x, 0, f.z);
        M.pose({ x: 0, y: 0, ang: 0, spd: f.sp * 1.6, state: f.up && ((tt * 0.8 + f.x) % 3) < 1.2 ? 'celebrate' : 'idle', isGK: false }, dt, tt, { lookYaw: 0 });
      });
      flags.forEach((F) => { F.g.position.set(F.f.fan.x + 0.35, 0, F.f.fan.z); F.g.userData.cl.rotation.y = Math.sin(tt * 5 + F.f.fan.x) * 0.5; });
      tunPlayers.forEach((M, i) => { M.pose({ x: 0, y: 0, ang: 0, spd: 0, state: 'idle', isGK: false }, dt, tt + i, { lookYaw: 0 }); M.group.position.y = Math.sin(tt * 2 + i) * 0.01; });
      renderer.render(scene, cam);
      if (t > TOT) finish();
    }
    scene.background = new THREE.Color(0x0d1220); scene.fog = new THREE.Fog(0x0d1220, 30, 150);
    raf = requestAnimationFrame(frame);
    void old;
    return true;
  };
})((globalThis.FCK = globalThis.FCK || {}));
