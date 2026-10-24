import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# shared helpers for the tpad_* gamepad tests: fake gamepad, press helpers, page launcher
import os, sys
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = 'file://' + ROOT + '/dist/FCK.html'
OUT = _OUT
os.makedirs(OUT, exist_ok=True)

FAKE_PAD = """
(() => {
  const mk = () => ({ connected: true, id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', index: 0, mapping: 'standard',
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), timestamp: 0 });
  window.__pad = mk(); window.__padOn = false;
  navigator.getGamepads = () => (window.__padOn ? [window.__pad, null, null, null] : [null, null, null, null]);
})();
"""
BTN = dict(A=0, B=1, X=2, Y=3, LB=4, RB=5, LT=6, RT=7, BACK=8, START=9, UP=12, DOWN=13, LEFT=14, RIGHT=15)

class Rig:
    def __init__(self, p, w=1180, h=900, lang='de-DE', pad=True, touch=False):
        self.b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
        self.ctx = self.b.new_context(viewport={'width': w, 'height': h}, locale=lang, has_touch=touch, is_mobile=touch)
        self.pg = self.ctx.new_page()
        self.errs = []
        self.pg.on('console', lambda m: self.errs.append(m.type + ': ' + m.text) if m.type in ('error',) and 'ERR_FAILED' not in m.text and 'Failed to load resource' not in m.text else None)
        self.pg.on('pageerror', lambda e: self.errs.append('PAGEERR ' + str(e)))
        self.pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        self.pg.add_init_script(FAKE_PAD)
        if not os.environ.get('FCK_3D'): self.pg.add_init_script("try { localStorage.setItem('fck.settings', JSON.stringify({ gfx3d: '2d' })); } catch (e) {}")
        self.pg.goto(HTML)
        self.pg.wait_for_function('window.FCK_READY === true')
        self.pg.wait_for_timeout(300)
        if pad: self.pad_on()

    def pad_on(self):
        self.pg.evaluate("window.__padOn = true; window.dispatchEvent(new Event('gamepadconnected'))")
        self.pg.wait_for_timeout(100)

    def frames(self, n=3):
        # wait for n rendered frames (so that a press is always seen by the poller, even when a frame is slow)
        self.pg.evaluate("(n) => new Promise((res) => { const f = () => (--n <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); })", n)

    def hold(self, name, ms=0):
        i = BTN[name]
        self.pg.evaluate(f"window.__pad.buttons[{i}] = {{pressed:true, value:1}}")
        self.frames(3)

    def release(self, name, ms=0):
        i = BTN[name]
        self.pg.evaluate(f"window.__pad.buttons[{i}] = {{pressed:false, value:0}}")
        self.frames(3)

    def press(self, name, n=1):
        for _ in range(n):
            self.hold(name); self.release(name)

    def axes(self, ax=0, ay=0, rx=0, ry=0):
        self.pg.evaluate(f"window.__pad.axes = [{ax},{ay},{rx},{ry}]")

    def stick(self, ax, ay, ms=120):
        self.axes(ax, ay); self.pg.wait_for_timeout(ms); self.axes(0, 0); self.pg.wait_for_timeout(ms)

    def wake(self):
        # the first pad input after mouse use only reveals the focus ring
        self.press('LT') if False else None
        self.press('RT') if False else None
        self.hold('LB'); self.release('LB')

    def cur(self):
        return self.pg.evaluate("""(() => { const c = FCK.PadNav.cur(); if (!c) return null;
          const t = c.tagName === 'SELECT' ? 'select:' + c.getAttribute('aria-label') : (c.textContent || c.getAttribute('aria-label') || c.getAttribute('title') || c.className).replace(/\\s+/g, ' ').trim().slice(0, 40);
          return t; })()""")

    def shot(self, name, full=False):
        self.pg.screenshot(path=OUT + name + '.png', full_page=full)

    def close(self):
        self.b.close()

def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: check.failed += 1
check.failed = 0

# reachability crawler: can every control of the current layer be reached from the initial focus using direction presses only?
REACH_JS = """
(() => {
  const PN = FCK.PadNav, root = PN.layerRoot();
  if (!root) return { err: 'no layer' };
  const cands = PN.collect(root);
  if (!cands.length) return { n: 0, unreachable: [] };
  PN.memo(true);
  PN.focus(null); const first = PN.initial(root, cands);
  const seen = new Set([first]), q = [first];
  while (q.length) {
    const c = q.shift();
    for (const d of ['up', 'down', 'left', 'right']) {
      const t = PN.next(c, d, cands);
      if (t && t !== 'value' && !seen.has(t)) { seen.add(t); q.push(t); }
    }
  }
  const lab = (el) => (el.tagName + ':' + (el.getAttribute('aria-label') || el.textContent || el.className).replace(/\\s+/g, ' ').trim().slice(0, 30));
  // controls that are only changed through a value step (select/slider rows) count as reached when their row mate is
  PN.memo(false);
  return { n: cands.length, reached: seen.size, unreachable: cands.filter((c) => !seen.has(c)).map(lab) };
})()
"""

PATH_JS = """
(pred) => {
  const PN = FCK.PadNav, root = PN.layerRoot(); if (!root) return null;
  const cands = PN.collect(root); PN.memo(true);
  const f = eval('(' + pred + ')');
  const start = PN.cur(); if (!start) { PN.memo(false); return null; }
  if (f(start)) { PN.memo(false); return []; }
  const prev = new Map([[start, null]]), q = [start];
  while (q.length) {
    const c = q.shift();
    for (const d of ['up', 'down', 'left', 'right']) {
      const t = PN.next(c, d, cands);
      if (!t || t === 'value' || prev.has(t)) continue;
      prev.set(t, [c, d]);
      if (f(t)) { const path = []; let x = t; while (prev.get(x)) { const [pc, pd] = prev.get(x); path.unshift(pd); x = pc; } PN.memo(false); return path; }
      q.push(t);
    }
  }
  PN.memo(false); return null;
}
"""

def nav_to(r, pred_js):
    """walk the pad cursor to the first control matching pred_js using real direction presses along the shortest path"""
    path = r.pg.evaluate(PATH_JS, pred_js)
    if path is None: return False
    for d in path: r.press(d.upper())
    return bool(r.pg.evaluate("(p) => { const c = FCK.PadNav.cur(); return !!c && (%s)(c); }" % pred_js))
