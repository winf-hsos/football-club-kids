import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1280,'height':720})
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text))
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if 'http' in r.request.url[:5] else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html'))
    pg.wait_for_timeout(1500)
    pg.screenshot(path=OUT+'0.png')
    print(pg.evaluate("document.getElementById('screen').innerHTML.slice(0,300)"))
    print('\n'.join(errs[:20]))
    b.close()
