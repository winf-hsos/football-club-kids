# screenshots of every camera / zoom at kick-off and in open play (usage: python3 t3d_cams.py [tag])
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
tag = sys.argv[1] if len(sys.argv) > 1 else 'c'
with sync_playwright() as p:
    b = launch(p)
    pg = new_page(b)
    open_game(pg)
    start_match(pg, weather='clear', tod='day')
    pg.wait_for_timeout(300)
    for cam in ['tv', 'high', 'goal', 'top']:
        pg.evaluate("(c)=>{FCK.settings.cam3d=c; FCK.onSettings(); const r=FCK.game.r; r.camBlend=1; r.snapCam=true;}", cam)
        frame(pg, 6)
        shot(pg, f'{tag}_{cam}_ko')
    # open play
    pg.evaluate("FCK.settings.cam3d='tv'; FCK.onSettings();")
    run_sim(pg, 40)
    for z in ['far', 'mid', 'near']:
        pg.evaluate("(z)=>{FCK.settings.zoom=z; FCK.onSettings();}", z)
        frame(pg, 8)
        shot(pg, f'{tag}_tv_play_{z}')
    print(pg.evaluate("JSON.stringify(FCK.game.r.info3d())"))
    print('errs', pg.errs)
    b.close()
