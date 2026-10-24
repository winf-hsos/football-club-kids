import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
import sys
OUT=_OUT
MOBILE = len(sys.argv)>1 and sys.argv[1]=='m'
P = 'm_' if MOBILE else 'd_'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':1800} if MOBILE else {'width':1180,'height':1900}, locale='de-DE')
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(1000)
    pg.click('.pcard >> nth=1'); pg.click('.btn.primary >> nth=0'); pg.wait_for_timeout(400)
    pg.click('.mitem:has-text("Profikarriere")'); pg.wait_for_timeout(400)
    pg.click('.mitem:has-text("Neuer Spieler")'); pg.wait_for_timeout(400)
    pg.fill('input.txt', 'Abi Tester')
    pg.click('.chips .chip:has-text("Torjäger")') if pg.query_selector('.chips .chip:has-text("Torjäger")') else None
    pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(300)
    pg.fill('#modal input[type=search]', 'Osnabr'); pg.wait_for_timeout(300)
    (pg.click('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(300)
    pg.click('button:has-text("Karriere starten")'); pg.wait_for_timeout(700)
    print('start ab', pg.evaluate("JSON.stringify(FCK.Career.cur.pro.ab)"))
    pg.click('.chips.tabs .chip:has-text("Spieler")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'ab1_mine.png', full_page=True)
    pg.evaluate("FCK.Career.cur.pro.sp = 20; FCK.Career.cur.pro.a.sho = 80; FCK.Career.cur.pro.a.pas = 80; FCK.UI.show('proHub', null, true)"); pg.wait_for_timeout(300)
    pg.click('.chips.tabs .chip:has-text("Spieler")'); pg.wait_for_timeout(300)
    pg.click('.chips.scroll .chip:has-text("Pass")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'ab2_pass.png', full_page=True)
    n0 = pg.evaluate("FCK.Career.cur.pro.ab.length")
    pg.click('.abrow:not(.own) .btn:not([disabled]) >> nth=0'); pg.wait_for_timeout(300)
    print('unlock', n0, '->', pg.evaluate("FCK.Career.cur.pro.ab.length"), pg.evaluate("FCK.Career.cur.pro.sp"))
    hs = pg.evaluate("(()=>{const s=document.getElementById('screen');return s.scrollWidth>s.clientWidth+1})()")
    print('hscroll', hs)
    # play: engine receives ability set
    pg.click('.chips.tabs .chip:has-text("Übersicht")'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Spielen"), button:has-text("Zuschauen")'); pg.wait_for_function("FCK.game.m && FCK.game.m.clock>3", timeout=60000)
    pg.evaluate("(()=>{const m=FCK.game.m; m.autoProceed=true; let n=0; while(!(m.teams.some(t=>t.players.some(p=>p.d&&p.d.pro&&p.onPitch)))&&m.mode!=='over'&&n<400000){ m.update(1/60); n++; } })()")
    print('engine abx', pg.evaluate("JSON.stringify(FCK.game.m.teams.flatMap(t=>t.all).filter(q=>q.d&&q.d.pro).map(q=>[q.name,q.abx]))"))
    print('errors', errs or 'none')
    b.close()
