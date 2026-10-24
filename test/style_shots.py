import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# screenshots of the main screens: python3 test/style_shots.py [tag] [ui style]
from playwright.sync_api import sync_playwright
import sys
OUT=_OUT
TAG=sys.argv[1] if len(sys.argv)>1 else 'base'
STYLE=sys.argv[2] if len(sys.argv)>2 else None
VPS=[('d',{'width':1280,'height':760},False),('m',{'width':390,'height':780},True)]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for name,vp,touch in VPS:
        ctx=b.new_context(viewport=vp, locale='de-DE', has_touch=touch, is_mobile=touch)
        pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
        pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(1200)
        pg.evaluate("FCK.settings.welcomed=true; FCK.saveSettings(); FCK.UI.stack=[]; FCK.UI.show('home', null, true)"); pg.wait_for_timeout(400)
        if STYLE: pg.evaluate(f"FCK.settings.uiStyle='{STYLE}'; FCK.saveSettings(); FCK.onSettings&&FCK.onSettings()"); pg.wait_for_timeout(300)
        def shot(n): pg.wait_for_timeout(500); pg.screenshot(path=OUT+f'{TAG}_{name}_{n}.png')
        pg.evaluate("FCK.settings.gfx3d='2d'; FCK.saveSettings()")
        shot('home')
        for scr,n in [('setup','setup'),('careerMenu','career'),('cards','cards'),('settings','settings')]:
            pg.evaluate(f"FCK.UI.stack=['home']; FCK.UI.show('{scr}', null, true)"); shot(n)
        # match
        pg.evaluate("FCK.UI.stack=['home']; FCK.UI.show('setup', null, true)")
        pg.evaluate("FCK.setup.preset='cpu'; FCK.setup.match.halfMins=2; FCK.startMatch(FCK.buildMatchConfig(FCK.setup))")
        pg.wait_for_function("FCK.game.m && FCK.game.m.clock>8", timeout=60000); shot('match')
        pg.evaluate("FCK.game.hud.flash('TOR!','goal',6000,\"M. Petrov 41'\", FCK.game.m.teams[0])"); pg.wait_for_timeout(700); shot('goal')
        pg.evaluate("FCK.game.hud.clearBanners()")
        pg.evaluate("(()=>{const m=FCK.game.m; m.autoProceed=true; let n=0; while(m.mode!=='over'&&n<500000){m.update(1/60);n++}})()")
        try: pg.wait_for_function("FCK.game.kind==='result'", timeout=60000)
        except Exception as e: print('timeout waiting for result', pg.evaluate("FCK.game.kind"))
        pg.wait_for_timeout(1500); shot('over')
        print(name,'errors', errs or 'none'); ctx.close()
