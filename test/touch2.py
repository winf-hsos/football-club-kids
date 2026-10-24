import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# touch device: every mode starts its human match with the touch slot and shows the overlay
import sys, os
from playwright.sync_api import sync_playwright
HTML=('file://' + _ROOT + '/dist/FCK.html')
ok=[0,0]
def check(c,m):
    ok[0 if c else 1]+=1; print(('PASS ' if c else 'FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':844,'height':390}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='de-DE')
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'Failed to load' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.add_init_script("try{localStorage.setItem('fck.settings', JSON.stringify({gfx3d:'2d'}))}catch(e){}")
    pg.goto(HTML); pg.wait_for_function('window.FCK_READY===true'); pg.wait_for_timeout(500)
    pg.tap('.pcard >> nth=1'); pg.tap('text=Los geht'); pg.wait_for_timeout(400)
    def probe(tag):
        pg.wait_for_function("FCK.game.m && FCK.game.m.clock>2", timeout=60000)
        r=pg.evaluate("(()=>{const m=FCK.game.m;return {devs:m.slots.map(s=>s.dev),show:document.getElementById('touch').classList.contains('show'),lock:!!m.lock}})()")
        check(r['devs'] and r['devs'][0]=='touch' and r['show'], tag+' -> '+str(r))
        pg.evaluate("FCK.game.quit ? FCK.game.quit() : (FCK.UI.stack=['home'], FCK.UI.show('home'))")
        pg.wait_for_timeout(500)
    # career
    pg.evaluate("FCK.World.build(); FCK.Career.create({ clubId: FCK.World.clubs[3].id, preset: 'p1', halfMins: 2 }); FCK.UI.show('career', null, true)"); pg.wait_for_timeout(500)
    pg.tap('button:has-text("Spielen")'); probe('career')
    # pro career
    pg.evaluate("FCK.UI.stack=['home']; FCK.UI.show('proNew', null, true)"); pg.wait_for_timeout(400)
    pg.fill('input.txt','Touch Tester'); pg.tap('button:has-text("Verein wählen")'); pg.wait_for_timeout(300)
    pg.fill('#modal input[type=search]','Osnabr'); pg.wait_for_timeout(300); (pg.tap('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.tap('#modal .pk-ok')); pg.wait_for_timeout(300)
    pg.tap('button:has-text("Karriere starten")'); pg.wait_for_timeout(700)
    pg.tap('button:has-text("Spielen"), button:has-text("Zuschauen")'); probe('pro career')
    # tournament
    pg.evaluate("(() => { const S = FCK.Tourney.create({ kind: 'wm48', me: 'GER', half: 1, level: 'rookie', preset: 'p1' }); FCK.Tourney.install(S); FCK.UI.stack=['home']; FCK.UI.show('tourneyHub', null, true); })()"); pg.wait_for_timeout(500)
    pg.tap('button:has-text("Spielen")'); probe('tournament')
    # competition
    pg.evaluate("FCK.UI.stack=['home']; FCK.UI.show('comp', null, true)"); pg.wait_for_timeout(400)
    pg.tap('button:has-text("Verein wählen")'); pg.wait_for_timeout(300); (pg.tap('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.tap('#modal .pk-ok')); pg.wait_for_timeout(300)
    pg.tap('button:has-text("Wettbewerb starten")'); pg.wait_for_timeout(600)
    pg.tap('button:has-text("Spielen")'); probe('competition')
    print('errors', errs or 'none')
    b.close()
print('FAILED' if ok[1] else 'ALL OK', ok)
