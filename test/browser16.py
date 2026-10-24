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
    pg.screenshot(path=OUT+P+'w0_home.png', full_page=True); hs('home')
    pg.click('.mitem:has-text("Wettbewerbe")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'w1_menu.png', full_page=True); hs('menu')
    # league: default Germany; choose my club
    pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT+P+'w2_pick.png')
    pg.fill('#modal input[type=search]', 'Bayern'); pg.wait_for_timeout(300)
    (pg.click('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT+P+'w3_chosen.png', full_page=True)
    pg.click('button:has-text("Wettbewerb starten")'); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT+P+'w4_hub.png', full_page=True); hs('hub')
    print('state', pg.evaluate("JSON.stringify({k:FCK.Comp.S.kind,id:FCK.Comp.S.id,me:FCK.Comp.S.me,md:FCK.Comp.main().md,M:FCK.Comp.main().M})"))
    # play a match
    pg.click('button:has-text("Spielen")'); pg.wait_for_function("FCK.game.m && FCK.game.m.mode==='play' && FCK.game.m.clock>5", timeout=60000)
    pg.evaluate("""(()=>{const m=FCK.game.m; m.autoProceed=true; let n=0; while(m.mode!=='over'&&n<600000){ m.update(1/60); n++; } return n;})()""")
    pg.wait_for_function("FCK.UI.cur==='result'", timeout=20000); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'w5_result.png', full_page=True)
    print('after match', pg.evaluate("JSON.stringify({md:FCK.Comp.main().md,log:FCK.Comp.S.log.map(e=>[e.g[0],e.g[1],e.res]),label:FCK.Comp.S.log[0]&&FCK.Comp.S.log[0].label})"))
    pg.click('button:has-text("Weiter im Turnier")'); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT+P+'w6_hub2.png', full_page=True)
    for tab in ['Tabelle','Spielplan','Torjäger','Mein Team']:
        pg.click('.chips.tabs .chip:has-text("%s")'%tab); pg.wait_for_timeout(300)
        pg.screenshot(path=OUT+P+'w7_'+tab[:4]+'.png', full_page=True); hs(tab)
    pg.click('.chips.tabs .chip:has-text("Start")'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Dieses Spiel simulieren")'); pg.wait_for_timeout(500)
    print('after sim', pg.evaluate("FCK.Comp.main().md"))
    pg.click('button:has-text("Bis zum Ende simulieren")'); pg.click('button:has-text("Wirklich alles simulieren")'); pg.wait_for_timeout(800)
    pg.screenshot(path=OUT+P+'w8_done.png', full_page=True)
    print('done', pg.evaluate("JSON.stringify({done:FCK.Comp.S.done,champ:FCK.Comp.result().champ>=0&&FCK.World.clubs[FCK.Comp.result().champ].name,mine:FCK.Comp.result().mine,hist:FCK.Comp.history().length})"))
    # reload keeps it
    pg.reload(); pg.wait_for_timeout(1000)
    print('reload', pg.evaluate("(FCK.Comp.load(), FCK.Comp.S && FCK.Comp.S.done)"))
    # euro: watch only
    pg.evaluate("FCK.UI.stack=['home']; FCK.UI.show('comp')"); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT+P+'w9_menu2.png', full_page=True)
    pg.click('.chips >> text=Europapokal'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Nur zuschauen")'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Wettbewerb starten")'); pg.wait_for_timeout(600)
    pg.click('button:has-text("simulieren") >> nth=0'); pg.wait_for_timeout(400)
    pg.click('.chips.tabs .chip >> nth=1'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'wa_euro.png', full_page=True); hs('euro')
    print('euro', pg.evaluate("JSON.stringify({kind:FCK.Comp.S.kind,id:FCK.Comp.S.id,md:FCK.Comp.main().md})"))
    # cup
    pg.evaluate("FCK.UI.stack=['home']; FCK.UI.show('comp')"); pg.wait_for_timeout(400)
    pg.click('.chips >> text=Pokal'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(300); (pg.click('#modal .pick >> nth=2') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(300)
    pg.click('button:has-text("Wettbewerb starten")'); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT+P+'wb_cup.png', full_page=True); hs('cup')
    print('cup', pg.evaluate("JSON.stringify({kind:FCK.Comp.S.kind,id:FCK.Comp.S.id,R:FCK.Comp.main().R})"))
    print('errors', errs or 'none')
    b.close()
