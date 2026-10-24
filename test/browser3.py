import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# mobile layout + touch + kids + 2 players keyboard checks
import time
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':844,'height':390}, locale='de-DE', has_touch=True, is_mobile=True, device_scale_factor=2)
    pg=ctx.new_page()
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html'))
    pg.wait_for_timeout(800)
    pg.tap('.pcard >> nth=0'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'m0_welcome.png'); pg.tap('text=Los geht'); pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT+'m1_home.png')
    pg.tap('text=Freundschaftsspiel'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+'m2_setup.png')
    print(pg.evaluate("JSON.stringify(FCK.setup.slots)"))
    pg.tap('text=Anstoß'); pg.wait_for_timeout(2500)
    pg.screenshot(path=OUT+'m3_match.png')
    print(pg.evaluate("JSON.stringify({touch:document.getElementById('touch').className, kids:FCK.profile, lvl:FCK.setup.match.level})"))
    print('\n'.join(errs[:20]) or 'no errors')
    b.close()
