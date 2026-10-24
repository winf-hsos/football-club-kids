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
    pg.click('.mitem:has-text("WM & EM")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'t1_menu.png', full_page=True); hs('tmenu')
    pg.click('.tn-team button >> nth=0'); pg.wait_for_timeout(400)
    pg.screenshot(path=OUT+P+'t1b_picker.png')
    pg.fill('#modal input[type=search]', 'Deutschland'); pg.wait_for_timeout(300)
    (pg.click('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('.tn-menu input[type=range]').value=1; document.querySelector('.tn-menu input[type=range]').dispatchEvent(new Event('input'))")
    pg.click('.chips >> text="Anfänger"'); 
    pg.click('button:has-text("Turnier starten")'); pg.wait_for_timeout(800)
    pg.screenshot(path=OUT+P+'t2_hub.png', full_page=True); hs('hub')
    print('S', pg.evaluate("JSON.stringify({kind:FCK.Tourney.S.kind, me:FCK.Tourney.S.me, ri:FCK.Tourney.S.ri, my:FCK.Tourney.myFixture(FCK.Tourney.S)})"))
    pg.click('.chips.tabs .chip:has-text("Gruppen")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'t3_groups.png', full_page=True); hs('groups')
    pg.click('.chips.tabs .chip:has-text("Team")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'t4_team.png', full_page=True); hs('team')
    pg.click('.chips.tabs .chip:has-text("Start")'); pg.wait_for_timeout(300)
    # play match 1 (spectate speed: finish headless)
    pg.click('button:has-text("Spielen")'); pg.wait_for_function("FCK.game.m && FCK.game.m.mode==='play' && FCK.game.m.clock>10", timeout=60000)
    pg.screenshot(path=OUT+P+'t5_match.png')
    print('match', pg.evaluate("FCK.game.m.teams[0].name+' vs '+FCK.game.m.teams[1].name+' @ '+FCK.game.m.teams[0].club.stadium+' ko='+FCK.game.m.set.knockout"))
    pg.evaluate("""(()=>{const m=FCK.game.m; m.autoProceed=true; let n=0; while(m.mode!=='over'&&n<600000){ m.update(1/60); n++; } return n;})()""")
    pg.evaluate("FCK.game.replay=null")
    pg.wait_for_function("FCK.UI.cur==='result'", timeout=20000); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'t6_result.png', full_page=True)
    print('recorded', pg.evaluate("JSON.stringify(FCK.Tourney.S.rounds[0].fx.filter(f=>f.mine).map(f=>[f.a,f.b,f.ga,f.gb]))"))
    pg.click('button:has-text("Weiter im Turnier")'); pg.wait_for_timeout(800)
    pg.screenshot(path=OUT+P+'t7_after.png', full_page=True)
    print('ri', pg.evaluate("FCK.Tourney.S.ri"), 'closed', pg.evaluate("FCK.Tourney.S.closed"))
    # simulate own matches until the group stage is over, then check ko
    for i in range(6):
        if pg.locator('button:has-text("Simulieren")').count() and pg.locator('button:has-text("Simulieren")').first.is_visible():
            pg.click('button:has-text("Simulieren")'); pg.wait_for_timeout(500)
        elif pg.locator('button:has-text("Nächste Runde simulieren")').count():
            pg.click('button:has-text("Nächste Runde simulieren")'); pg.wait_for_timeout(400)
    print('after sims', pg.evaluate("JSON.stringify({ri:FCK.Tourney.S.ri, done:FCK.Tourney.S.done, out:FCK.Tourney.S.out[FCK.Tourney.S.me], rounds:FCK.Tourney.S.rounds.map(r=>r.key)})"))
    pg.screenshot(path=OUT+P+'t8_progress.png', full_page=True)
    pg.click('.chips.tabs .chip:has-text("K.o.")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'t9_ko.png', full_page=True); hs('ko')
    # to the end
    pg.click('.chips.tabs .chip:has-text("Start")'); pg.wait_for_timeout(300)
    if pg.locator('button:has-text("Bis zum Ende simulieren")').count():
        pg.click('button:has-text("Bis zum Ende simulieren")'); pg.wait_for_timeout(800)
    pg.screenshot(path=OUT+P+'t10_end.png', full_page=True)
    print('end', pg.evaluate("JSON.stringify({done:FCK.Tourney.S.done, champ:FCK.Tourney.S.champ, hist:FCK.Tourney.history().length})"))
    pg.click('.chips.tabs .chip:has-text("Torjäger")'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+P+'t11_scorers.png', full_page=True)
    # reload keeps the tournament
    pg.reload(); pg.wait_for_timeout(1200)
    print('after reload', pg.evaluate("(FCK.Tourney.load(), FCK.Tourney.S && FCK.Tourney.S.champ)"))
    # english + menu
    pg.evaluate("FCK.settings.lang='en'; FCK.saveSettings(); FCK.onSettings(); FCK.UI.stack=['home']; FCK.UI.show('tourneyHub')"); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'t12_en.png', full_page=True)
    print('errors:', errs if errs else 'none')
    b.close()
