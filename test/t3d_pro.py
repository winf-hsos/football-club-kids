import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# pro career match in 3D with pad: controlled pro player is marked, screenshots
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpad_common import *
OUT3=_OUT
with sync_playwright() as p:
    r = Rig(p, w=1180, h=720); pg = r.pg
    pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(300)
    pg.evaluate("FCK.World.build(); FCK.UI.show('proNew', null, true)"); pg.wait_for_timeout(300)
    pg.fill('input.txt', 'Pad Tester'); pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(300)
    pg.fill('#modal input[type=search]', 'Osnabr'); pg.wait_for_timeout(300)
    (pg.click('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(300)
    pg.click('button:has-text("Karriere starten")'); pg.wait_for_timeout(700)
    pg.click('button:has-text("Spielen"), button:has-text("Zuschauen")')
    pg.wait_for_function("FCK.game.m && FCK.game.m.clock>3", timeout=90000)
    print(pg.evaluate("JSON.stringify({is3d:document.body.classList.contains('gfx3d'), lock:!!FCK.game.m.lock, ctrl:FCK.game.m.teams.map(t=>t.players.filter(p=>p.ctrl>=0).map(p=>p.name)), ff:FCK.game.m.fastForward})"))
    pg.evaluate("window.FCK_pause && 0")
    n = pg.evaluate("(()=>{const m=FCK.game.m; m.autoProceed=true; let n=0; while(!(m.teams.some(t=>t.players.some(p=>p.ctrl>=0)))&&m.mode!=='over'&&n<400000){ m.update(1/60); n++; } return n;})()")
    print('stepped', n, pg.evaluate("JSON.stringify({ctrl:FCK.game.m.teams.map(t=>t.players.filter(p=>p.ctrl>=0).map(p=>p.name)), clock:FCK.game.m.clock})"))
    pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT3+'3d_pro.png', timeout=90000)
    print('errors', r.errs)
    r.close()
