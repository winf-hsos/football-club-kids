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
    pg.screenshot(path=OUT+P+'s0_menu.png', full_page=True)
    # ---------------- editor
    pg.click('.mitem:has-text("Editor")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'s1_editor.png', full_page=True); hs('editor')
    pg.click('button:has-text("Neuer Verein")'); pg.wait_for_timeout(300)
    pg.fill('#modal input.txt', 'FC Sternenstadt')
    pg.screenshot(path=OUT+P+'s1b_new.png')
    pg.click('#modal button:has-text("Erstellen")'); pg.wait_for_timeout(600)
    pg.screenshot(path=OUT+P+'s2_club.png', full_page=True); hs('club')
    pg.click('.swatches >> nth=0 >> .swatch >> nth=3'); pg.wait_for_timeout(200)
    pg.click('.chips >> text="Karo"'); pg.click('.chips >> text="Vereinsfarbe"'); pg.wait_for_timeout(200)
    pg.fill('input[aria-label^="Werbebande"]', 'sternen'); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT+P+'s2b_club_edit.png', full_page=True)
    print('club', pg.evaluate("JSON.stringify(FCK.Editor.data.clubs.map(c=>({n:c.name,s:c.short,p:c.pitch,col:c.colors.p,recs:c.recs.length})))"))
    pg.click('button:has-text("Spieler bearbeiten")'); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'s3_squad.png', full_page=True); hs('squad')
    pg.fill('.edrow >> nth=0 >> input[type=text]', 'Torwart Tim')
    pg.fill('.edrow >> nth=21 >> input[type=number]', '95'); pg.wait_for_timeout(600)
    pg.click('button:has-text("Fertig")'); pg.wait_for_timeout(300)
    print('after squad edit', pg.evaluate("JSON.stringify({gk:FCK.Editor.data.clubs[0].recs[0].name, st:FCK.Editor.data.clubs[0].recs[21].ovr, rating:FCK.World.byId[FCK.Editor.data.clubs[0].id].rating})"))
    # adjust a real club
    pg.click('button:has-text("‹ Zurück")'); pg.wait_for_timeout(300)
    pg.click('.chips.tabs .chip:has-text("Bestehende")'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(500)
    pg.fill('#modal input[type=search]', 'Bayern'); pg.wait_for_timeout(300)
    (pg.click('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(500)
    pg.fill('.editor input[aria-label="Stadionname"]', 'Meine Arena'); pg.wait_for_timeout(200)
    pg.screenshot(path=OUT+P+'s4_adjust.png', full_page=True)
    print('override', pg.evaluate("JSON.stringify(FCK.Editor.data.over)"))
    # friendly match with the own club -> start quickly, spectate
    pg.evaluate("FCK.setup.home=FCK.Editor.data.clubs[0].id; FCK.setup.away='fcb'; FCK.setup.preset='cpu'; FCK.setup.slots=FCK.presetSlots('cpu'); FCK.setup.match.halfMins=1; FCK.saveSetup()")
    pg.evaluate("FCK.UI.stack=['home']; FCK.UI.show('setup')"); pg.wait_for_timeout(500)
    pg.screenshot(path=OUT+P+'s5_setup.png', full_page=True)
    pg.click('button:has-text("Anstoß")'); pg.wait_for_function("FCK.game.m && FCK.game.m.mode==='play' && FCK.game.m.clock>10", timeout=60000)
    pg.screenshot(path=OUT+P+'s6_match_stadium.png')
    print('home club in match', pg.evaluate("FCK.game.m.teams[0].name + ' / ' + FCK.game.m.teams[0].club.stadium + ' / ' + FCK.game.m.teams[0].players.map(p=>p.name).slice(0,2).join(',')"))
    pg.evaluate("FCK.game.quit()"); pg.wait_for_timeout(600)
    # persistence
    pg.reload(); pg.wait_for_timeout(1200)
    print('after reload', pg.evaluate("JSON.stringify({clubs:FCK.Editor.data.clubs.length, inTeams: !!FCK.TEAMS.find(t=>t.custom), over:Object.keys(FCK.Editor.data.over), bay: FCK.World.byId.fcb.stadium})"))
    print('errors:', errs if errs else 'none')
    b.close()
