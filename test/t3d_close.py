# close-up debug shots: players (run / kick / slide / dive / celebrate), goal, stands (uses r.debugCam)
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
tag = sys.argv[1] if len(sys.argv) > 1 else 'cl'
with sync_playwright() as p:
    b = launch(p)
    pg = new_page(b)
    open_game(pg)
    start_match(pg, weather='clear', tod='day')
    run_sim(pg, 25)
    pg.evaluate("FCK.game.paused = true")   # freeze the sim, we pose players by hand
    def cam(pos, look, fov=40):
        pg.evaluate("([p,l,f])=>{FCK.game.r.debugCam={pos:p,look:l,fov:f};}", [pos, look, fov])
        frame(pg, 4)
    # line up players for a pose lineup in front of the camera
    pg.evaluate("""()=>{
      const m = FCK.game.m, ps = m.players.filter(p=>!p.isGK);
      const gk = m.players.find(p=>p.isGK);
      const states = ['idle','run','slide','dive','down','celebrate','hold','getup'];
      const pick = [ps[0], ps[1], ps[11], ps[12], ps[2], ps[3], gk, ps[13]];
      pick.forEach((p, i) => { p.x = 40 + i * 3.2; p.y = 34; p.ang = Math.PI / 2 * 0 - 0.0; p.vx=p.vy=0; p.spd = 0; p.state = 'idle'; });
      pick[1].spd = 7.5; pick[1].state = 'idle';
      pick[2].state = 'slide'; pick[3].state = 'dive'; pick[4].state = 'down'; pick[5].state = 'celebrate'; pick[6].state = 'hold'; pick[7].state = 'getup';
      pick[0].spd = 3.2;
      window.__pick = pick;
      m.ball.x = 37; m.ball.y = 34; m.ball.owner = null;
    }""")
    pg.evaluate("FCK.game.r.adapt=false")
    # step animation: need dt>0 draws; paused game draws with dt 0, so drive frames manually
    pg.evaluate("""()=>{ window.__loop = setInterval(()=>{ const m=FCK.game.m; window.__pick.forEach((p,i)=>{ if (i===1||i===0) p.spd = i===1?7.5:3.2; }); FCK.game.r.draw({ball:m.ball, players:m.players, ref:m.ref}, 1/30, {match:m, restart:null, radar:false}); }, 33); }""")
    pg.wait_for_timeout(600)
    cam([53, 3.0, 40], [53, 1.0, 34], 38)
    shot(pg, tag + '_lineup')
    cam([45, 2.2, 38], [45, 1.1, 34], 30)
    shot(pg, tag + '_run')
    cam([58, 2.0, 38], [58, 0.9, 34], 30)
    shot(pg, tag + '_slide_dive')
    cam([66, 2.0, 38], [66, 1.0, 34], 32)
    shot(pg, tag + '_down_celebrate')
    # goal
    cam([12, 3.5, 42], [0, 1.2, 34], 45)
    shot(pg, tag + '_goal')
    # back of a player (number)
    pg.evaluate("window.__pick.forEach(p=>{p.ang=Math.PI/2})")
    pg.wait_for_timeout(300)
    cam([46, 2.4, 28], [46, 1.3, 34], 30)
    shot(pg, tag + '_front')
    pg.evaluate("window.__pick.forEach(p=>{p.ang=-Math.PI/2})")
    pg.wait_for_timeout(300)
    cam([46, 2.4, 28], [46, 1.3, 34], 30)
    shot(pg, tag + '_back')
    # stands
    cam([52, 8, 76], [52, 4, 100], 45)
    shot(pg, tag + '_stand_s')
    print('errs', pg.errs)
    b.close()
