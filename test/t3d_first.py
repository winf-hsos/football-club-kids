import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
with sync_playwright() as p:
    b = launch(p)
    pg = new_page(b)
    open_game(pg)
    print('renderer', pg.evaluate("FCK.game.r.constructor.name + ' ok=' + FCK.game.r.ok + ' gpu=' + FCK.game.r.gpu"))
    start_match(pg)
    pg.wait_for_timeout(500)
    frame(pg, 5)
    print('mode3d', pg.evaluate("FCK.game.r.mode3d"), pg.evaluate("JSON.stringify(FCK.game.r.info3d())"))
    shot(pg, 'first_kickoff')
    print('errs', pg.errs)
    b.close()
