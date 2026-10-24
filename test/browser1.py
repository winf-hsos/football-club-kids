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
    pg.wait_for_timeout(1500)
    pg.click('text=Los geht')
    pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT+'2_home.png')
    pg.click('text=Freundschaftsspiel')
    pg.wait_for_timeout(800)
    pg.screenshot(path=OUT+'3_setup.png')
    pg.click('text=Anstoß')
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT+'4_match0.png')
    pg.keyboard.down('d'); pg.keyboard.down('Shift')
    pg.wait_for_timeout(6000)
    pg.screenshot(path=OUT+'5_match1.png')
    pg.keyboard.up('d'); pg.keyboard.up('Shift')
    print('\n'.join(errs[:20]) or 'no errors')
    b.close()
