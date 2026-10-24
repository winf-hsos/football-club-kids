import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
import sys
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for mob in (False, True):
        P='m_' if mob else 'd_'
        ctx=b.new_context(viewport={'width':390,'height':1800} if mob else {'width':1180,'height':1500}, locale='en-GB')
        pg=ctx.new_page(); errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        pg.goto(('file://' + _ROOT + '/dist/artifact.html')); pg.wait_for_timeout(1000)
        pg.click('.pcard >> nth=0'); pg.click('.btn.primary >> nth=0'); pg.wait_for_timeout(500)
        print('kids?', pg.evaluate("FCK.settings.profile"), 'lang', pg.evaluate("FCK.settings.lang"))
        pg.screenshot(path=OUT+P+'v1_home.png', full_page=True)
        print('home items', pg.evaluate("Array.from(document.querySelectorAll('.mitem')).map(e=>e.textContent.trim().slice(0,22)).join(' | ')"))
        print('hscroll', pg.evaluate("(()=>{const s=document.getElementById('screen');return s.scrollWidth>s.clientWidth+1})()"))
        # each stage-5 screen in EN
        for name in ('editor','tourney','duel'):
            pg.evaluate(f"FCK.UI.show('{name}')"); pg.wait_for_timeout(400)
            pg.screenshot(path=OUT+P+f'v2_{name}.png', full_page=True)
            print(name, 'hscroll', pg.evaluate("(()=>{const s=document.getElementById('screen');return s.scrollWidth>s.clientWidth+1})()"))
        # snapshot includes editor + tourney
        print('snapshot keys', pg.evaluate("Object.keys(FCK.snapshot())"))
        print('errors', errs or 'none')
        ctx.close()
    b.close()
