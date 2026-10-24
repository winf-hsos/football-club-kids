import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# usage: python3 test/shots.py [m] screen1 screen2 ...   (screens: FCK.UI.show names, 'home' for the menu)
from playwright.sync_api import sync_playwright
import sys
args=sys.argv[1:]
mob = bool(args) and args[0]=='m'
if mob: args=args[1:]
OUT=_OUT
P='m_' if mob else 'd_'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':1700} if mob else {'width':1180,'height':1300}, locale='de-DE')
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(900)
    pg.click('.pcard >> nth=1'); pg.click('.btn.primary >> nth=0'); pg.wait_for_timeout(500)
    for a in args:
        if a=='home': pass
        else: pg.evaluate(f"FCK.UI.show('{a}')"); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT+P+'s_'+a+'.png', full_page=True)
        print(a, 'hscroll', pg.evaluate("(()=>{const s=document.getElementById('screen');return s.scrollWidth>s.clientWidth+1})()"))
    print('errors', errs or 'none')
    b.close()
