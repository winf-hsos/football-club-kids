import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
import time
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':720}, locale='de-DE')
    pg=ctx.new_page()
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html'))
    pg.wait_for_timeout(800)
    pg.click('.pcard >> nth=0'); pg.click('text=Los geht'); pg.wait_for_timeout(400)
    pg.click('text=Freundschaftsspiel'); pg.wait_for_timeout(300)
    pg.evaluate("FCK.setup.match.halfMins=2")
    pg.click('text=Anstoß')
    pg.wait_for_function("FCK.game.m && FCK.game.m.mode==='restart'", timeout=5000)
    # kick off with pass
    pg.wait_for_function("FCK.game.m.restart && FCK.game.m.restart.phase==='ready'", timeout=15000)
    pg.keyboard.down('d'); pg.keyboard.press('q'); pg.wait_for_timeout(300)
    t0=time.time(); ev={'shot':0,'pass':0}
    pg.evaluate("window.__ev=[];FCK.game.m.on(e=>{if(['shot','kick','goal','tackle','foul','corner'].includes(e.type)&&(!e.by||e.by.ctrl>=0||e.by.team&&e.by.team.humans.length))window.__ev.push(e.type)})")
    for i in range(40):
        pg.keyboard.down('Shift')
        pg.wait_for_timeout(400)
        pg.keyboard.press('q'); pg.wait_for_timeout(150)
        pg.keyboard.down('e'); pg.wait_for_timeout(250); pg.keyboard.up('e')
        pg.keyboard.press('e')
        pg.keyboard.up('Shift')
        if i%5==0:
            pg.keyboard.up('d'); pg.keyboard.down('a'); pg.wait_for_timeout(300); pg.keyboard.up('a'); pg.keyboard.down('d')
    pg.screenshot(path=OUT+'h1.png')
    print(pg.evaluate("JSON.stringify({ev:window.__ev.reduce((a,x)=>(a[x]=(a[x]||0)+1,a),{}),score:[FCK.game.m.teams[0].score,FCK.game.m.teams[1].score],stats:FCK.game.m.teams[0].stats,pl:FCK.game.m.slots[0].player&&FCK.game.m.slots[0].player.sname})"))
    print('\n'.join(errs[:20]) or 'no errors')
    b.close()
