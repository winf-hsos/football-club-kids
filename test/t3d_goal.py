# goal scene, live replay and archive playback in 3D (usage: python3 t3d_goal.py [tag] [cam])
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
tag = sys.argv[1] if len(sys.argv) > 1 else 'g'
cam = sys.argv[2] if len(sys.argv) > 2 else 'tv'
with sync_playwright() as p:
    b = launch(p)
    pg = new_page(b)
    open_game(pg, {'cam3d': cam})
    start_match(pg)
    pg.wait_for_timeout(300)
    advance(pg, 1.0, every=3)
    run_sim(pg, 30); advance(pg, 1.5, every=3)
    # force a goal for team 0 with a field player as scorer
    pg.evaluate("""() => { const m = FCK.game.m; m.mode = 'play'; const t = m.teams[0]; const sc = t.players.find((p) => !p.isGK && p.num === 9) || t.players[5];
      sc.x = t.goalX === 0 ? 8 : 97; sc.y = 36; const b = m.ball; b.x = t.goalX === 0 ? -0.5 : 105.5; b.y = 34; b.z = 0.5; b.vx = 0; b.vy = 0; b.vz = 0; b.lastTouch = sc; m.goal(t.goalX); }""")
    print('mode', pg.evaluate("FCK.game.m.mode"), 'score', pg.evaluate("FCK.game.m.teams.map(t=>t.score)"))
    advance(pg, 0.8, every=3); shot(pg, f'{tag}_01_goal_early')
    advance(pg, 1.5, every=3); shot(pg, f'{tag}_02_goal_mid')
    advance(pg, 2.0, every=3); shot(pg, f'{tag}_03_goal_late')
    run_sim(pg, 20, until="m.mode==='goalwait'")
    print('mode2', pg.evaluate("FCK.game.m.mode"))
    pg.evaluate("() => { const g = FCK.game; g.paused = false; g.startReplay(); }")
    pg.wait_for_timeout(2500); shot(pg, f'{tag}_04_replay_a')
    pg.wait_for_timeout(3500); shot(pg, f'{tag}_05_replay_b')
    print('replay', pg.evaluate("!!FCK.game.replay"))
    pg.evaluate("() => { if (FCK.game.replay) FCK.game.skipReplay(); }")
    pg.wait_for_timeout(800); shot(pg, f'{tag}_06_after')
    # archive playback
    pg.evaluate("""() => { const g = FCK.game, m = g.m; const fr = m.getClip(10.5); const e = FCK.Archive.fromMatch(m, fr, m.lastGoal, 'de'); g.playArchive(e); }""")
    pg.wait_for_timeout(3000); shot(pg, f'{tag}_07_archive')
    print('kind', pg.evaluate("FCK.game.kind"))
    print('errs', pg.errs)
    b.close()
