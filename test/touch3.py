import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='de-DE')
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.add_init_script("try{localStorage.setItem('fck.settings', JSON.stringify({gfx3d:'2d'}))}catch(e){}")
    pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_function('window.FCK_READY===true')
    pg.tap('.pcard >> nth=1'); pg.tap('text=Los geht'); pg.wait_for_timeout(400)
    pg.tap('.mitem:has-text("Freundschaftsspiel")'); pg.wait_for_timeout(400); pg.tap('button:has-text("Anstoß")')
    pg.wait_for_function("FCK.game.m && FCK.game.m.clock>2", timeout=30000)
    pg.tap('.hud-btn'); pg.wait_for_timeout(300); pg.tap('button:has-text("Taktik")'); pg.wait_for_timeout(500)
    r=pg.evaluate("(()=>{const m=document.querySelector('#modal .modal, #modal > div');const b=m.getBoundingClientRect();const sc=Array.from(document.querySelectorAll('#modal *')).find(e=>e.scrollHeight>e.clientHeight+2&&getComputedStyle(e).overflowY!=='visible');return {top:b.top,bottom:b.bottom,h:innerHeight,scrollable:!!sc}})()")
    print('tactics modal', r)
    pg.screenshot(path=OUT+'t_land_tactics.png')
    print('errs', errs)
    b.close()
