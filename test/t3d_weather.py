# weather / time of day screenshots (usage: python3 t3d_weather.py [tag] [cam] [w:t ...])
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
tag = sys.argv[1] if len(sys.argv) > 1 else 'w'
cam = sys.argv[2] if len(sys.argv) > 2 else 'tv'
combos = sys.argv[3:] or ['rain:night', 'snow:day', 'fog:day', 'storm:night', 'clear:evening', 'cloudy:day', 'snow:night', 'rain:day']
with sync_playwright() as p:
    b = launch(p)
    for c in combos:
        w, t = c.split(':')
        pg = new_page(b)
        open_game(pg, {'cam3d': cam})
        start_match(pg, weather=w, tod=t)
        pg.wait_for_timeout(300)
        advance(pg, 1.0, every=3); run_sim(pg, 20); advance(pg, 2.5, every=3)
        shot(pg, f'{tag}_{w}_{t}')
        print(c, 'errs', pg.errs, flush=True)
        pg.context.close()
    b.close()
