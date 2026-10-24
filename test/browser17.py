import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
import sys
OUT=_OUT
MOBILE = len(sys.argv)>1 and sys.argv[1]=='m'
P = 'm_' if MOBILE else 'd_'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844} if MOBILE else {'width':1180,'height':760}, locale='de-DE')
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(1000)
    pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(400)
    pg.click('.mitem >> nth=0'); pg.wait_for_timeout(500)
    pg.click('button:has-text("Anstoß")'); pg.wait_for_function("FCK.game.m && FCK.game.m.mode==='restart'", timeout=30000)
    specs = [('throwin',0,45,0.0),('corner',0,104.8,0.2),('freekick',0,82,26),('goalkick',1,99.5,34),('kickoff',1,52.5,34),('penalty',0,94,34)]
    for typ, team, x, y in specs:
        pg.evaluate(f"""(()=>{{const m=FCK.game.m; m.autoProceed=true; m.mode='play'; m.restart=null; m.setRestart('{typ}',{team},{x},{y}); let n=0; while(!(m.restart&&m.restart.phase==='ready')&&n<1200){{m.update(1/60);n++;}} if(m.restart){{m.restart.delay=99;}} }})()""")
        pg.wait_for_timeout(700)
        pg.screenshot(path=OUT+P+'x_'+typ+'.png')
        print('shot', typ, 'phase', pg.evaluate("FCK.game.m.restart&&FCK.game.m.restart.phase"), 'taker ctrl', pg.evaluate("FCK.game.m.restart&&FCK.game.m.restart.taker.ctrl"), 'hint', pg.evaluate("(document.querySelector('.hint')||{}).textContent"))
        pg.evaluate("(()=>{const m=FCK.game.m; if(m.restart){m.restart.delay=0; FCK.AI.takeRestart(m,m.restart);} })()")
    print('types', pg.evaluate('JSON.stringify(window.__types)'))
    print('errors', errs or 'none')
    b.close()
