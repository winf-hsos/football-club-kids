# set pieces, goal, weather: screenshots in TV camera (usage: python3 t3d_events.py [tag] [cam])
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
tag = sys.argv[1] if len(sys.argv) > 1 else 'e'
cam = sys.argv[2] if len(sys.argv) > 2 else 'tv'
with sync_playwright() as p:
    b = launch(p)
    pg = new_page(b)
    open_game(pg, {'cam3d': cam})
    start_match(pg, weather='clear', tod='day')
    pg.wait_for_timeout(300)
    advance(pg, 1.0, every=3)
    shot(pg, f'{tag}_01_kickoff')
    run_sim(pg, 38); advance(pg, 2, every=3)
    shot(pg, f'{tag}_02_play')
    def setpiece(kind, team, x, y, name, secs=5):
        pg.evaluate("([k,t,x,y]) => { const m = FCK.game.m; m.mode = 'play'; m.setRestart(k, t, x, y); }", [kind, team, x, y])
        advance(pg, secs, stop="m.mode==='restart' && m.restart && m.restart.phase==='ready'", every=4)
        advance(pg, 1.5, every=3)
        shot(pg, f'{tag}_{name}')
    setpiece('corner', 0, 105, 0, '03_corner')
    setpiece('freekick', 0, 80, 22, '04_freekick', 7)
    setpiece('throwin', 1, 60, 0, '05_throwin')
    setpiece('goalkick', 1, 99.5, 34, '06_goalkick')
    setpiece('penalty', 0, 94, 34, '07_penalty', 8)
    print('errs', pg.errs)
    b.close()
