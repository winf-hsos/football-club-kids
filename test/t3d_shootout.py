# knockout match driven into the penalty shootout, screenshots of the shootout in 3D (usage: python3 t3d_shootout.py [cam])
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
cam = sys.argv[1] if len(sys.argv) > 1 else 'tv'
with sync_playwright() as p:
    b = launch(p); pg = new_page(b)
    open_game(pg, {'cam3d': cam})
    start_match(pg, half=1, extra={'knockout': True})
    pg.wait_for_timeout(300)
    run_sim(pg, 20); advance(pg, 1.0, every=3)
    pg.evaluate("() => { const m = FCK.game.m; m.mode = 'play'; m.startShootout(); }")
    print('mode', pg.evaluate("FCK.game.m.mode"))
    advance(pg, 3.0, every=3); shot(pg, 'so_1')
    advance(pg, 6.0, every=4); shot(pg, 'so_2')
    print('mode', pg.evaluate("FCK.game.m.mode"), 'errs', pg.errs)
    b.close()
