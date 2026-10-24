# pad reachability for stage-6 screens: pro career, competitions, own club in career, pro match with a pad
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpad_common import *

with sync_playwright() as p:
    for (w, h, tag) in [(1180, 900, 'desktop'), (390, 800, 'phone')]:
        r = Rig(p, w=w, h=h); pg = r.pg
        pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(300)
        pg.evaluate("FCK.UI.stack = ['home']")
        def crawl(label):
            pg.wait_for_timeout(400)
            res = pg.evaluate(REACH_JS)
            ok = 'unreachable' in res and not res['unreachable']
            check(ok, f'[{tag}] {label}: {res.get("reached")}/{res.get("n")} reachable' + ('' if ok else ' MISSING ' + str(res.get('unreachable'))))
        pg.evaluate("FCK.World.build()")
        pg.evaluate("FCK.UI.show('proMenu', null, true)"); crawl('proMenu')
        pg.evaluate("FCK.UI.show('proNew', null, true)"); crawl('proNew')
        pg.evaluate("FCK.UI.show('proNew', null, true)"); pg.wait_for_timeout(300)
        pg.fill('input.txt', 'Pad Tester'); pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(300)
        pg.fill('#modal input[type=search]', 'Osnabr'); pg.wait_for_timeout(300)
        crawl('proNew club picker')
        (pg.click('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(300)
        pg.click('button:has-text("Karriere starten")'); pg.wait_for_timeout(700)
        check(pg.evaluate('FCK.UI.cur') == 'proHub', 'pro hub open: ' + pg.evaluate('FCK.UI.cur'))
        tabs = pg.evaluate("Array.from(document.querySelectorAll('.chips.tabs')[0].querySelectorAll('.chip')).map(c => c.textContent)")
        for i, t in enumerate(tabs):
            pg.evaluate(f"document.querySelectorAll('.chips.tabs')[0].querySelectorAll('.chip')[{i}].click()"); crawl('proHub tab ' + t)
        # pro match with pad: pad0 is the only human slot, locked to the pro
        pg.evaluate("document.querySelectorAll('.chips.tabs')[0].querySelectorAll('.chip')[0].click()"); pg.wait_for_timeout(300)
        pg.click('button:has-text("Spielen"), button:has-text("Zuschauen")')
        try:
            pg.wait_for_function("FCK.game.m && FCK.game.m.clock>3", timeout=60000)
            info = pg.evaluate("JSON.stringify({lock:!!FCK.game.m.lock, slots:FCK.game.m.slots.map(s=>s.dev)})")
            print(tag, 'pro match', info)
            check('pad0' in info, f'[{tag}] pro match uses pad0')
        except Exception as e:
            print('no live match (bench/inj?)', str(e)[:80])
        pg.evaluate("if (FCK.game && FCK.game.m) { try { FCK.game.stop && FCK.game.stop(); } catch (e) {} } FCK.UI.stack=['home']; FCK.UI.show('comp', null, true)"); crawl('comp menu')
        pg.click('button:has-text("Verein wählen")'); pg.wait_for_timeout(300); crawl('comp club picker')
        (pg.click('#modal .pick >> nth=0') if pg.query_selector('#modal .pick') else pg.click('#modal .pk-ok')); pg.wait_for_timeout(300)
        pg.click('button:has-text("Wettbewerb starten")'); pg.wait_for_timeout(600)
        check(pg.evaluate('FCK.UI.cur') == 'compHub', 'comp hub')
        tabs = pg.evaluate("Array.from(document.querySelectorAll('.chips.tabs')[0].querySelectorAll('.chip')).map(c => c.textContent)")
        for i, t in enumerate(tabs):
            pg.evaluate(f"document.querySelectorAll('.chips.tabs')[0].querySelectorAll('.chip')[{i}].click()"); crawl('compHub tab ' + t)
        # own club in career
        pg.evaluate("FCK.Editor.newClub({ name: 'Pad FC' }); FCK.careerDraft = null; FCK.UI.show('careerNew', null, true)"); pg.wait_for_timeout(300)
        crawl('careerNew')
        b = pg.query_selector("button:has-text('Eigener Verein'), .chip:has-text('Eigener Verein'), .chip:has-text('Eigene')")
        if b:
            b.click(); pg.wait_for_timeout(300); crawl('careerNew own club')
        print(tag, 'errors', r.errs)
        check(not r.errs, f'[{tag}] no console errors')
        r.close()
print('FAILED' if check.failed else 'ALL OK', check.failed)
