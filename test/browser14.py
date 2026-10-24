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
    ctx=b.new_context(viewport={'width':390,'height':1800} if MOBILE else {'width':1180,'height':1500}, locale='de-DE')
    pg=ctx.new_page()
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html'))
    pg.wait_for_timeout(1000)
    def hs(tag): print(tag, 'hscroll', pg.evaluate("(()=>{const s=document.getElementById('screen');return s.scrollWidth>s.clientWidth+1})()"))
    pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(400)
    pg.click('.mitem:has-text("Duell per Code")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'u1_duel.png', full_page=True); hs('duel')
    # challenger "Anna" with a club team
    pg.fill('.duel input[aria-label="Dein Spielername"]', 'Anna'); pg.wait_for_timeout(200)
    pg.click('.duel button:has-text("Code erzeugen")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'u2_code.png')
    code = pg.evaluate("document.querySelector('#modal textarea').value")
    print('challenge code length', len(code), code[:12])
    pg.click('#modal button:has-text("Schließen")'); pg.wait_for_timeout(200)
    # friend "Ben" pastes the code
    pg.fill('.duel input[aria-label="Dein Spielername"]', 'Ben'); pg.wait_for_timeout(200)
    pg.fill('.duel textarea.code', code)
    pg.click('.duel button:has-text("Prüfen")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'u3_accept.png')
    # pick another team for Ben via the club picker
    pg.click('#modal button:has-text("Mein Team ändern")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'u3a_choose.png')
    pg.click('#modal button:has-text("Verein")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'u3b_picker.png')
    (pg.click('.pick >> nth=3') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(700)
    pg.screenshot(path=OUT+P+'u3c_accept2.png')
    pg.click('#modal .chip:has-text("Anfänger")'); pg.wait_for_timeout(200)
    pg.click('#modal button:has-text("Anstoß")'); pg.wait_for_function("FCK.game.m && FCK.game.m.mode==='play' && FCK.game.m.clock>10", timeout=60000)
    print('match', pg.evaluate("FCK.game.m.teams[0].name+' vs '+FCK.game.m.teams[1].name+' / '+FCK.game.m.teams[1].players.slice(0,3).map(p=>p.name+':'+p.ovr).join(',')+' ko='+FCK.game.m.set.knockout+' half='+FCK.game.m.set.halfMins"))
    pg.screenshot(path=OUT+P+'u4_match.png')
    pg.evaluate("""(()=>{const m=FCK.game.m; m.autoProceed=true; let n=0; while(m.mode!=='over'&&n<600000){ m.update(1/60); n++; } return n;})()""")
    pg.evaluate("FCK.game.replay=null")
    pg.wait_for_function("FCK.UI.cur==='result'", timeout=20000); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'u5_result.png', full_page=True)
    rcode = pg.evaluate("document.querySelector('.cres textarea').value")
    print('result code', len(rcode), rcode[:8], 'hist', pg.evaluate("JSON.stringify(FCK.Duel.D.hist.map(e=>[e.role,e.opp,e.gf,e.ga]))"))
    pg.click('button:has-text("Zum Duell-Menü")'); pg.wait_for_timeout(500)
    # back to Anna, enter result
    pg.fill('.duel input[aria-label="Dein Spielername"]', 'Anna'); pg.wait_for_timeout(200)
    pg.fill('.duel textarea.code', rcode)
    pg.click('.duel button:has-text("Prüfen")'); pg.wait_for_timeout(600)
    print('after enter', pg.evaluate("JSON.stringify(FCK.Duel.D.hist.map(e=>[e.role,e.opp,e.gf,e.ga]))"), 'open', pg.evaluate("Object.keys(FCK.Duel.D.open).length"))
    pg.screenshot(path=OUT+P+'u6_balance.png', full_page=True); hs('balance')
    # duplicate + garbage
    pg.fill('.duel textarea.code', rcode); pg.click('.duel button:has-text("Prüfen")'); pg.wait_for_timeout(300)
    print('toast dup:', pg.evaluate("Array.from(document.querySelectorAll('.toast-item')).map(t=>t.textContent).join(' | ')"))
    pg.fill('.duel textarea.code', 'FCKD1:abc'); pg.click('.duel button:has-text("Prüfen")'); pg.wait_for_timeout(300)
    pg.fill('.duel textarea.code', rcode.replace('FCKD1:','FCKD1:A')); pg.click('.duel button:has-text("Prüfen")'); pg.wait_for_timeout(300)
    print('toasts:', pg.evaluate("Array.from(document.querySelectorAll('.toast-item')).map(t=>t.textContent).join(' | ')"))
    pg.reload(); pg.wait_for_timeout(1000)
    print('after reload', pg.evaluate("(FCK.Duel.load(), FCK.Duel.D.hist.length+' '+FCK.Duel.D.name)"))
    print('errors:', errs if errs else 'none')
    b.close()
