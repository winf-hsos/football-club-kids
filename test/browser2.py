import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
import sys, time
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':1280,'height':720}, locale='de-DE')
    pg=ctx.new_page()
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html'))
    pg.wait_for_timeout(1000)
    pg.click('text=Los geht')
    pg.wait_for_timeout(500)
    pg.click('text=Freundschaftsspiel')
    pg.wait_for_timeout(300)
    pg.click('text=Zuschauen')
    pg.evaluate("FCK.setup.match.halfMins=1; FCK.setup.match.weather='rain'; FCK.setup.match.tod='night'; FCK.setup.match.knockout=false")
    pg.click('text=Anstoß')
    seen=set(); t0=time.time(); shots=0
    while time.time()-t0<240:
        pg.wait_for_timeout(500)
        st=pg.evaluate("(()=>{const g=FCK.game;return {kind:g.kind,mode:g.m&&g.m.mode,replay:!!g.replay,brk:g.breakShown,clock:g.m&&Math.round(g.m.clock)}})()")
        if st['replay'] and 'replay' not in seen:
            seen.add('replay'); pg.wait_for_timeout(1200); pg.screenshot(path=OUT+'6_replay.png')
        if st['brk'] and 'break' not in seen:
            seen.add('break'); pg.wait_for_timeout(500); pg.screenshot(path=OUT+'7_break.png')
            pg.click('text=Taktik'); pg.wait_for_timeout(400); pg.screenshot(path=OUT+'8_tactics.png')
            pg.click('text=Zurück'); pg.wait_for_timeout(300)
            pg.click('text=Weiterspielen'); pg.wait_for_timeout(300)
        if st['kind']=='result':
            pg.wait_for_timeout(800); pg.screenshot(path=OUT+'9_result.png')
            for tab,name in [('Statistik','10_stats'),('Spieler','11_players'),('Heatmap','12_heat')]:
                pg.click('text='+tab+'',); pg.wait_for_timeout(400); pg.screenshot(path=OUT+name+'.png')
            break
        if st['mode'] and 'play' not in seen and st['mode']=='play':
            seen.add('play'); pg.screenshot(path=OUT+'5b_play.png')
    print(seen, st)
    print('\n'.join(errs[:20]) or 'no errors')
    b.close()
