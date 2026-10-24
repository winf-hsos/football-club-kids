# frame cost per quality tier: average ms of renderer.draw (+ gl.finish) over N frames, draw calls/triangles (usage: python3 t3d_perf.py [N] [cam])
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
N = int(sys.argv[1]) if len(sys.argv) > 1 else 300
cam = sys.argv[2] if len(sys.argv) > 2 else 'tv'
with sync_playwright() as p:
    b = launch(p)
    for q in ['low', 'mid', 'high']:
        pg = new_page(b)
        open_game(pg, {'cam3d': cam, 'q3d': q})
        start_match(pg)
        pg.wait_for_timeout(300)
        advance(pg, 1.0, every=3); run_sim(pg, 20); advance(pg, 1.0, every=3)
        res = pg.evaluate("""(N) => {
          const g = FCK.game, m = g.m, r = g.r, S = FCK.settings; g.paused = true;
          const gl = r.gl.getContext(); let js = 0, mx = 0; const px = new Uint8Array(4); const T0 = performance.now();
          for (let i = 0; i < N; i++) {
            for (let s = 0; s < m.slots.length; s++) m.slots[s].input = g.input.consume(s);
            m.update(1 / 60); if (i % 2) m.update(1 / 60);
            const t0 = performance.now();
            r.draw({ ball: m.ball, players: m.players, ref: m.ref }, 1 / 30, { match: m, restart: m.restart, radar: S.radar });
            const t1 = performance.now(); js += t1 - t0; mx = Math.max(mx, t1 - t0);
          }
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // forces a GPU sync so queued frames are counted
          const wall = performance.now() - T0;
          return { avgMsSubmit: js / N, avgMsWall: wall / N, maxSubmitMs: mx, info: r.info3d(), cv: [r.gl.domElement.width, r.gl.domElement.height] };
        }""", N)
        # CPU-only cost of draw() (scene update, animation, camera, overlay) with the GL submit stubbed out: what a real GPU would add on top of
        js = pg.evaluate("""(N) => {
          const g = FCK.game, m = g.m, r = g.r, S = FCK.settings; const orig = r.gl.render; r.gl.render = function () {};
          let t = 0;
          for (let i = 0; i < N; i++) {
            for (let s = 0; s < m.slots.length; s++) m.slots[s].input = g.input.consume(s);
            m.update(1 / 60); m.update(1 / 60);
            const t0 = performance.now();
            r.draw({ ball: m.ball, players: m.players, ref: m.ref }, 1 / 30, { match: m, restart: m.restart, radar: S.radar });
            t += performance.now() - t0;
          }
          r.gl.render = orig; return t / N;
        }""", N)
        res['avgMsJsOnly'] = js
        print(q, json.dumps(res), flush=True)
        shot(pg, f'perf_{q}')
        print(q, 'errs', pg.errs, flush=True)
        pg.context.close()
    b.close()
