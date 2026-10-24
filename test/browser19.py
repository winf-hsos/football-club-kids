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
    pg=ctx.new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(1000)
    def hs(tag): print(tag, 'hscroll', pg.evaluate("(()=>{const s=document.getElementById('screen');return s.scrollWidth>s.clientWidth+1})()"))
    pg.click('.pcard >> nth=1'); pg.click('.btn.primary >> nth=0'); pg.wait_for_timeout(400)
    pg.evaluate("FCK.Editor.newClub({name:'FC Testhausen', short:'FCT', group:'de', r:72})")
    pg.click('.mitem:has-text("Karriere")'); pg.wait_for_timeout(400)
    pg.click('.mitem:has-text("Neue Karriere")'); pg.wait_for_timeout(500)
    pg.click('.chips .chip:has-text("Eigener Verein")'); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT+P+'o1_pick.png', full_page=True); hs('own pick')
    print('draft', pg.evaluate("JSON.stringify(FCK.careerDraft)"))
    pg.click('button:has-text("Karriere starten"), .sticky-actions .btn.primary'); pg.wait_for_timeout(900)
    pg.screenshot(path=OUT+P+'o2_hub.png', full_page=True); hs('hub')
    print('club', pg.evaluate("FCK.World.clubs[FCK.Career.cur.idx].name+' | '+FCK.Career.cur.custom.rec.name"))
    pg.click('.chips.tabs .chip:has-text("Kader")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'o3_squad.png', full_page=True)
    # play one match and check the name in the match
    pg.click('.chips.tabs .chip:has-text("Übersicht")'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Spielen")'); pg.wait_for_function("FCK.game.m && FCK.game.m.clock>3", timeout=60000)
    print('match', pg.evaluate("FCK.game.m.teams.map(t=>t.name).join(' - ')"))
    pg.evaluate("""(()=>{const m=FCK.game.m; m.autoProceed=true; let n=0; while(m.mode!=='over'&&n<600000){ m.update(1/60); n++; } return n;})()""")
    pg.wait_for_function("FCK.UI.cur==='result'", timeout=20000); pg.wait_for_timeout(400)
    # leave to home -> real club back
    pg.evaluate("FCK.UI.stack=[]; FCK.UI.show('home')"); pg.wait_for_timeout(300)
    print('home sync', pg.evaluate("FCK.World.clubs[FCK.Career.cur.idx].name+' active='+FCK.Career.customActive()"))
    pg.evaluate("FCK.UI.show('careerMenu')"); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT+P+'o4_menu.png', full_page=True)
    print('menu', pg.evaluate("[...document.querySelectorAll('.mitem')].map(e=>e.innerText.replace(/\\n/g,' / ')).join(' | ')+' auto='+!!FCK.U.store.get('cauto',null)"))
    pg.click('.mitem:has-text("Weiterspielen")'); pg.wait_for_timeout(700)
    print('continue', pg.evaluate("FCK.UI.cur+' '+FCK.World.clubs[FCK.Career.cur.idx].name+' log='+FCK.Career.cur.log.length"))
    print('ERRS', errs[:8])
    b.close()
