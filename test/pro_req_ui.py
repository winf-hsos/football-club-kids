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
    ctx=b.new_context(viewport={'width':390,'height':800} if MOBILE else {'width':1180,'height':900}, locale='de-DE', has_touch=MOBILE, is_mobile=MOBILE)
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    def choose():
        pg.click('#modal .pick >> nth=0'); pg.wait_for_timeout(250)
        if pg.query_selector('#modal .pk-ok'): pg.click('#modal .pk-ok')
        pg.wait_for_timeout(500)
    pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(1000)
    pg.evaluate("FCK.settings.welcomed=true; FCK.saveSettings(); FCK.UI.stack=[]; FCK.UI.show('home', null, true)"); pg.wait_for_timeout(300)
    pg.click('.mitem:has-text("Profikarriere")'); pg.wait_for_timeout(400)
    pg.click('.mitem:has-text("Neuer Spieler")'); pg.wait_for_timeout(400)
    pg.fill('input.txt', 'Wechsel Tester')
    pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(300)
    pg.fill('#modal input[type=search]', 'Osnabr'); pg.wait_for_timeout(300)
    choose()
    pg.click('button:has-text("Karriere starten")'); pg.wait_for_timeout(700)
    pg.click('.chips.tabs .chip:has-text("Laufbahn")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'req1_tab.png')
    old = pg.evaluate("FCK.Career.cur.clubId")
    for attempt in range(3):
        if not pg.query_selector('button:has-text("Verein wechseln")'): break
        pg.click('button:has-text("Verein wechseln")'); pg.wait_for_timeout(500)
        pg.fill('#modal input[type=search]', 'Bayern'); pg.wait_for_timeout(300)
        choose()
        pg.screenshot(path=OUT+P+f'req2_result{attempt}.png')
        if pg.query_selector('.offer'):
            pg.click('#modal button:has-text("Annehmen")'); pg.wait_for_timeout(500); break
        pg.click('#modal button:has-text("OK")'); pg.wait_for_timeout(300)
        # try another, easier club
        pg.click('button:has-text("Verein wechseln")') if pg.query_selector('button:has-text("Verein wechseln")') else None
        pg.wait_for_timeout(400)
        pg.fill('#modal input[type=search]', 'Meppen'); pg.wait_for_timeout(300)
        choose()
        pg.screenshot(path=OUT+P+f'req3_result{attempt}.png')
        if pg.query_selector('.offer'):
            pg.click('#modal button:has-text("Annehmen")'); pg.wait_for_timeout(500); break
        pg.click('#modal button:has-text("OK")'); pg.wait_for_timeout(300); break
    print('club', old, '->', pg.evaluate("FCK.Career.cur.clubId"), 'req', pg.evaluate("JSON.stringify(FCK.Career.cur.pro.req)"))
    pg.screenshot(path=OUT+P+'req4_after.png')
    print('errors', errs or 'none')
