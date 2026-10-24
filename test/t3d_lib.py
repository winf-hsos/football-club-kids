import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# shared helpers for the 3D view tests (Playwright, chromium with software WebGL)
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = _OUT
# WebGL in headless chromium: the default build already provides ANGLE/SwiftShader; these flags make it explicit
GL_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

def launch(p):
    return p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=GL_ARGS)

def new_page(b, w=1280, h=720, mobile=False, dpr=1):
    ctx = b.new_context(viewport={'width': w, 'height': h}, locale='de-DE', device_scale_factor=dpr, has_touch=mobile, is_mobile=mobile)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') and 'ERR_FAILED' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR ' + str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.errs = errs
    return pg

def open_game(pg, settings=None):
    pg.add_init_script("window.FCK_R3D_PRESERVE = true;")
    pg.goto('file://' + ROOT + '/dist/FCK.html')
    pg.wait_for_function('window.FCK_READY === true', timeout=20000)
    # skip welcome
    pg.evaluate("(()=>{ FCK.settings.welcomed = true; FCK.saveSettings(); })()")
    if settings:
        pg.evaluate("(s)=>{ Object.assign(FCK.settings, s); FCK.saveSettings(); FCK.onSettings(); }", settings)

def start_match(pg, home='fcb', away='mci', weather='clear', tod='day', slots=None, half=4, extra=None):
    pg.evaluate("""([home, away, weather, tod, slots, half, extra]) => {
      const st = FCK.defaultSetup(); st.home = home; st.away = away;
      st.match.weather = weather; st.match.tod = tod; st.match.halfMins = half;
      if (extra) Object.assign(st.match, extra);
      if (slots) st.slots = slots;
      FCK.setup = st;
      FCK.startMatch(FCK.buildMatchConfig(st));
      if (FCK.game.r) FCK.game.r.adapt = false;
    }""", [home, away, weather, tod, slots, half, extra])

def run_sim(pg, secs=0, until=None):
    """advance the simulation without waiting for real time"""
    return pg.evaluate("""([secs, until]) => {
      const m = FCK.game.m; let n = 0; const dt = 1/60;
      const target = secs * 60;
      while (n < target) {
        for (let i = 0; i < m.slots.length; i++) m.slots[i].input = FCK.input.consume(i);
        m.update(dt); n++;
        if (until && eval(until)) break;
      }
      return n;
    }""", [secs, until])

def frame(pg, n=3):
    pg.evaluate("""(n) => new Promise((res) => { let k = 0; const f = () => { if (++k >= n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); })""", n)

def shot(pg, name):
    pg.screenshot(path=OUT + name + '.png')

def advance(pg, secs, hz=30, stop=None, every=1):
    """deterministic loop: pause the real-time loop, then step sim + HUD + renderer ourselves (works at any swiftshader fps)"""
    return pg.evaluate("""([secs, hz, stop, every]) => {
      const g = FCK.game, m = g.m, r = g.r, S = FCK.settings; g.paused = true;
      const n = Math.round(secs * hz); let i = 0, acc = 0;
      for (; i < n; i++) {
        g.input.poll();
        for (let k = 0; k < Math.round(60 / hz); k++) {
          for (let s = 0; s < m.slots.length; s++) { m.slots[s].input = g.input.consume(s); FCK.rotInput && FCK.rotInput(m.slots[s].input); }
          m.update(1 / 60);
        }
        g.hud.update(m, 1 / hz);
        r.mood = m.crowd.mood; if (m.fxState.flash > 0.6) r.flash = Math.max(r.flash, 0.35);
        acc += 1 / hz;
        if (i % every !== 0 && i < n - 2) continue;
        const dtd = acc; acc = 0;
        r.draw({ ball: m.ball, players: m.players, ref: m.ref }, dtd, { match: m, restart: m.restart, radar: S.radar, shake: m.fxState.shake * 0.35 });
        if (stop && eval(stop)) break;
      }
      return i;
    }""", [secs, hz, stop, every])
