# phone viewports (touch, 800x390 landscape and 390x800 portrait) in all cameras (usage: python3 t3d_phone.py [tag])
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
tag = sys.argv[1] if len(sys.argv) > 1 else 'ph'
with sync_playwright() as p:
    b = launch(p)
    for (w, h, n) in [(800, 390, 'land'), (390, 800, 'port')]:
        pg = new_page(b, w, h, mobile=True, dpr=2)
        open_game(pg, {'cam3d': 'tv', 'touch': 'on'} if False else {'cam3d': 'tv'})
        start_match(pg)
        pg.wait_for_timeout(300)
        advance(pg, 1.0, every=3); run_sim(pg, 15); advance(pg, 1.5, every=3)
        for cam in ['tv', 'high', 'goal', 'top']:
            pg.evaluate("(c) => { FCK.settings.cam3d = c; FCK.onSettings && FCK.onSettings(); }", cam)
            advance(pg, 2.0, every=3)
            shot(pg, f'{tag}_{n}_{cam}')
        print(n, 'errs', pg.errs, flush=True)
        pg.context.close()
    b.close()
