# every interactive control on every screen / dialog must be reachable with direction presses only
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpad_common import *

SCREENS = ['home', 'setup', 'careerMenu', 'cards', 'tourney', 'editor', 'duel', 'highlights', 'saves', 'settings', 'help']
with sync_playwright() as p:
    for (w, h, tag) in [(1180, 900, 'desktop'), (390, 800, 'phone')]:
        r = Rig(p, w=w, h=h); pg = r.pg
        pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(300)
        pg.evaluate("FCK.UI.stack = ['home']")
        def crawl(label):
            pg.wait_for_timeout(350)
            res = pg.evaluate(REACH_JS)
            ok = 'unreachable' in res and not res['unreachable']
            check(ok, f'[{tag}] {label}: {res.get("reached")}/{res.get("n")} reachable' + ('' if ok else ' MISSING ' + str(res.get('unreachable'))))
        for s in SCREENS:
            pg.evaluate(f"FCK.UI.show('{s}', null, true)"); crawl('screen ' + s)
        # dialogs
        pg.evaluate("FCK.UI.show('setup', null, true)"); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('.tcard .btn').click()"); crawl('club picker')
        pg.evaluate("FCK.UI.closeModal()")
        pg.evaluate("FCK.Lineup && document.querySelectorAll('.tcard .btn')[1].click()"); crawl('lineup editor')
        pg.evaluate("FCK.UI.closeModal()")
        pg.evaluate("FCK.UI.show('saves', null, true)"); pg.wait_for_timeout(200)
        pg.evaluate("FCK.UI.importDialog(() => {})"); crawl('import dialog')
        pg.evaluate("FCK.UI.closeModal(); void FCK.promptText('Name', 'x')"); crawl('text prompt')
        pg.evaluate("FCK.UI.closeModal()")
        # deeper screens: new career, career hub + all its tabs, cards hub tabs, tournament hub, editor club / squad
        pg.evaluate("FCK.World.build(); FCK.UI.show('careerNew', null, true)"); crawl('careerNew')
        pg.evaluate("FCK.careerDraft = null; FCK.Career.create({ clubId: FCK.World.clubs[3].id, preset: 'p1', halfMins: 2 }); FCK.Career.tab = 'home'; FCK.UI.show('career', null, true)"); pg.wait_for_timeout(300)
        tabs = pg.evaluate("Array.from(document.querySelectorAll('.hub .chips.tabs')[0].querySelectorAll('.chip')).map(c => c.textContent)")
        for i, t in enumerate(tabs):
            pg.evaluate(f"document.querySelectorAll('.hub .chips.tabs')[0].querySelectorAll('.chip')[{i}].click()"); crawl('career tab ' + t)
            # the tab body may hold a dialog opener: open the first clickable table row / card as a dialog
        pg.evaluate("FCK.UI.show('cards', null, true)"); pg.wait_for_timeout(300)
        tabs = pg.evaluate("Array.from(document.querySelectorAll('.cardsmode .chips.tabs .chip')).map(c => c.textContent)")
        for i, t in enumerate(tabs):
            pg.evaluate(f"document.querySelectorAll('.cardsmode .chips.tabs .chip')[{i}].click()"); crawl('cards tab ' + t)
        pg.evaluate("(() => { const S = FCK.Tourney.create({ kind: 'wm48', me: 'GER', half: 1, level: 'rookie', preset: 'p1' }); FCK.Tourney.install(S); FCK.UI.show('tourneyHub', null, true); })()"); crawl('tourneyHub')
        pg.evaluate("(() => { const c = FCK.Editor.newClub({ name: 'Test FC' }); FCK.UI.show('editorClub', { id: c.id }, true); })()"); crawl('editorClub')
        pg.evaluate("(() => { const c = FCK.Editor.data.clubs[0]; FCK.UI.show('editorSquad', { id: c.id }, true); })()"); crawl('editorSquad')
        pg.evaluate("FCK.UI.show('editor', null, true)"); pg.wait_for_timeout(200)
        pg.evaluate("Array.from(document.querySelectorAll('.btn')).find(b => b.textContent.includes('Neuer Verein')).click()"); crawl('editor new club dialog')
        pg.evaluate("FCK.UI.closeModal()")
        print('errors', r.errs)
        check(not r.errs, f'[{tag}] no console errors')
        r.close()
print('FAILED' if check.failed else 'ALL OK', check.failed)
