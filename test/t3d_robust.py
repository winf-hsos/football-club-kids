# robustness of the 3D view: 2D start, THREE missing, WebGL missing, context loss, runtime switching, camera key, full short match
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
fails = []
def check(name, cond, info=''):
    print(('PASS ' if cond else 'FAIL ') + name, info, flush=True)
    if not cond: fails.append(name)

def vis(pg):
    return pg.evaluate("""() => { const a = document.getElementById('cv3d'), c = document.getElementById('cv');
      return { gl: !!a && getComputedStyle(a).display !== 'none', cv2: getComputedStyle(c).visibility !== 'hidden', is3d: !!(FCK.game.r && FCK.game.r.mode3d), cls: document.body.classList.contains('gfx3d') }; }""")

with sync_playwright() as p:
    b = launch(p)
    # 1) explicit 2D setting
    pg = new_page(b); open_game(pg, {'gfx3d': '2d'}); start_match(pg); pg.wait_for_timeout(300); advance(pg, 1.0, every=3)
    v = vis(pg); check('2d setting -> 2D canvas', (not v['gl']) and v['cv2'] and not v['is3d'], v)
    shot(pg, 'rb_2d')
    # runtime switch 2D -> 3D -> 2D
    pg.evaluate("() => { FCK.settings.gfx3d = '3d'; FCK.onSettings(); }"); advance(pg, 0.5, every=3)
    v = vis(pg); check('switch to 3D mid-match', v['gl'] and v['is3d'] and not v['cv2'], v)
    pg.evaluate("() => { FCK.settings.gfx3d = '2d'; FCK.onSettings(); }"); advance(pg, 0.5, every=3)
    v = vis(pg); check('switch back to 2D mid-match', (not v['gl']) and v['cv2'] and not v['is3d'], v)
    check('no console errors (switching)', not pg.errs, pg.errs)
    pg.context.close()

    # 2) THREE missing
    pg = new_page(b)
    pg.add_init_script("Object.defineProperty(window, 'THREE', { get() { return undefined; }, set() {}, configurable: true });")
    open_game(pg, {}); start_match(pg); pg.wait_for_timeout(300); advance(pg, 1.0, every=3)
    v = vis(pg); check('THREE missing -> 2D fallback', (not v['gl']) and v['cv2'] and not v['is3d'] and pg.evaluate("FCK.Renderer3D === null"), v)
    check('no console errors (no THREE)', not pg.errs, pg.errs)
    pg.context.close()

    # 3) WebGL unavailable
    pg = new_page(b)
    pg.add_init_script("""(() => { const o = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, a) { if (/webgl/i.test(t)) return null; return o.call(this, t, a); }; })();""")
    open_game(pg, {}); start_match(pg); pg.wait_for_timeout(300); advance(pg, 1.0, every=3)
    v = vis(pg); check('WebGL unavailable -> 2D fallback', (not v['gl']) and v['cv2'] and not v['is3d'], v)
    check('no console errors (no WebGL)', not [e for e in pg.errs if e.startswith('error') or e.startswith('PAGEERR')], pg.errs)
    pg.context.close()

    # 4) context loss in 3D
    pg = new_page(b); open_game(pg, {}); start_match(pg); pg.wait_for_timeout(300); advance(pg, 1.0, every=3)
    v = vis(pg); check('3D active by default', v['gl'] and v['is3d'], v)
    pg.evaluate("() => { const e = FCK.game.r.gl.getContext().getExtension('WEBGL_lose_context'); e.loseContext(); }")
    pg.wait_for_timeout(500); advance(pg, 0.5, every=3)
    v = vis(pg); check('context loss -> 2D fallback', (not v['gl']) and v['cv2'] and not v['is3d'], v)
    toast = pg.evaluate("() => document.body.innerText.includes('WebGL') || document.body.innerText.includes('2D')")
    check('context loss toast shown', toast)
    shot(pg, 'rb_lost')
    pg.context.close()

    # 5) camera key / button, persistence
    pg = new_page(b); open_game(pg, {'cam3d': 'tv'}); start_match(pg); pg.wait_for_timeout(300); advance(pg, 0.5, every=3)
    seq = []
    for k in ['KeyB', 'KeyB', 'Tab', 'KeyB']:
        pg.keyboard.press(k.replace('Key', '')) if k != 'Tab' else pg.keyboard.press('Tab')
        seq.append(pg.evaluate("FCK.settings.cam3d"))
    check('camera key cycles tv->high->goal->top->tv', seq == ['high', 'goal', 'top', 'tv'], seq)
    pg.click('#cam3d'); check('camera button cycles', pg.evaluate("FCK.settings.cam3d") == 'high')
    stored = pg.evaluate("() => JSON.stringify(Object.keys(localStorage).map((k) => localStorage.getItem(k)).filter((s) => s && s.includes('cam3d')).length)")
    check('cam3d persisted in storage', stored != '0', stored)
    check('no console errors (camera)', not pg.errs, pg.errs)
    pg.context.close()

    # 6) full short match (1 minute halves), 3D, with the replay/proceed flow driven manually
    for gfx in ['3d', '2d']:
        pg = new_page(b); open_game(pg, {'gfx3d': gfx}); start_match(pg, half=1)
        pg.wait_for_timeout(300)
        res = pg.evaluate("""() => {
          const g = FCK.game, m = g.m, r = g.r, S = FCK.settings; g.paused = true;
          let n = 0, goals = 0, draws = 0, sawModes = {};
          while (m.mode !== 'over' && n < 60 * 60 * 6) {
            for (let s = 0; s < m.slots.length; s++) m.slots[s].input = g.input.consume(s);
            m.update(1 / 60); n++; sawModes[m.mode] = 1;
            if (m.mode === 'goalwait' || (m.mode === 'break' && m.modeT > 1.2)) m.proceed();
            if (n % 45 === 0) { g.hud.update(m, 0.75); r.draw({ ball: m.ball, players: m.players, ref: m.ref }, 0.75, { match: m, restart: m.restart, radar: S.radar }); draws++; }
          }
          return { n, mode: m.mode, score: m.teams.map((t) => t.score), draws, modes: Object.keys(sawModes) };
        }""")
        print(gfx, res)
        check(f'full short match runs to the end ({gfx})', res['mode'] == 'over', res)
        check(f'no console errors in full match ({gfx})', not pg.errs, pg.errs)
        pg.context.close()
    b.close()
print('FAILED:' if fails else 'ALL PASSED', fails)
