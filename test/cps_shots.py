import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for name,vp,touch in [('d',{'width':1180,'height':900},False),('m',{'width':390,'height':800},True),('l',{'width':780,'height':360},True)]:
        ctx=b.new_context(viewport=vp, locale='de-DE', has_touch=touch, is_mobile=touch)
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
        pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(900)
        pg.evaluate("FCK.UI.stack=['home']; FCK.UI.show('setup', null, true)"); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT+f'cps_{name}_1.png')
        # country arrow on home card -> next country, league arrow, club arrow
        c0=pg.evaluate("FCK.setup.home")
        pg.click('.tcard.side0 .cps-c .cps-ar >> nth=1'); pg.wait_for_timeout(200)
        c1=pg.evaluate("FCK.setup.home")
        pg.click('.tcard.side0 .cps-t .cps-ar >> nth=1'); pg.wait_for_timeout(200)
        c2=pg.evaluate("FCK.setup.home")
        pg.click('.tcard.side1 .cps-l .cps-ar >> nth=1'); pg.wait_for_timeout(200)
        print(name,'home',c0,c1,c2,'away',pg.evaluate("FCK.setup.away"), 'sides', pg.evaluate("[...document.querySelectorAll('.srow select:last-of-type')].map(s=>s.options[0].text+'/'+s.options[1].text).slice(0,1)"))
        pg.screenshot(path=OUT+f'cps_{name}_2.png')
        print(name,'hscroll', pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"))
        pg.click('.tcard.side0 button:has-text("Verein")') if False else pg.click('.tcard.side0 .tc-dyn button >> nth=0'); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT+f'cps_{name}_3.png')
        pg.fill('#modal input[type=search]','Hilal'); pg.wait_for_timeout(300)
        print(name,'search results', pg.evaluate("document.querySelectorAll('#modal .pick').length"))
        pg.click('#modal .pick >> nth=0'); pg.wait_for_timeout(300)
        print(name,'picked', pg.evaluate("FCK.setup.home"), 'card', pg.evaluate("document.querySelector('.tcard.side0 .cps-name').textContent"))
        print(name,'errors', errs or 'none'); ctx.close()
