# walk through every menu with the fake gamepad only
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpad_common import *

GRID = {'Freundschaftsspiel': (0, 0), 'Karriere': (1, 0), 'Profikarriere': (1, 1), 'Karten-Modus': (2, 0), 'WM & EM': (2, 1), 'Wettbewerbe': (3, 0), 'Duell per Code': (3, 1), 'Editor': (4, 0),
        'Highlights': (5, 0), 'Spielstände': (5, 1), 'Einstellungen': (6, 0), 'Hilfe': (6, 1)}

def goto(r, txt, tries=40):
    """move the pad cursor (pad inputs only) until its label contains txt; feedback loop using the real tile positions"""
    pg = r.pg
    for n in range(tries):
        c = r.cur() or ''
        if txt in c: return True
        d = pg.evaluate("""(txt) => { const cur = FCK.PadNav.cur(); const t = [...document.querySelectorAll('.mitem')].find(e => e.textContent.includes(txt));
          if (!cur || !t) return null; const a = cur.getBoundingClientRect(), b = t.getBoundingClientRect();
          return [b.left + b.width / 2 - (a.left + a.width / 2), b.top + b.height / 2 - (a.top + a.height / 2)]; }""", txt)
        if d is None: r.press('DOWN'); continue
        dx, dy = d
        vert = abs(dy) > 8 and (n % 3 != 2 or abs(dx) < 8)
        if vert: r.press('DOWN' if dy > 0 else 'UP')
        else: r.press('RIGHT' if dx > 0 else 'LEFT')
    return txt in (r.cur() or '')

with sync_playwright() as p:
    r = Rig(p)
    pg = r.pg
    # welcome screen -> Start = primary action
    check(pg.evaluate('FCK.UI.cur') == 'welcome', 'boots on welcome')
    r.press('DOWN')  # first press only reveals the ring
    check(pg.evaluate("document.documentElement.classList.contains('padmode')"), 'pad press switches pad mode on')
    r.press('START'); pg.wait_for_timeout(300)
    check(pg.evaluate('FCK.UI.cur') == 'home', 'Start on welcome -> home')
    check('Freundschaftsspiel' in (r.cur() or ''), 'home: first item pre-focused: ' + str(r.cur()))
    r.shot('menus_home')
    screens = [('Freundschaftsspiel', 'setup'), ('Karriere', 'careerMenu'), ('Profikarriere', 'proMenu'), ('Karten-Modus', 'cards'), ('WM & EM', 'tourney'), ('Wettbewerbe', 'comp'), ('Duell per Code', 'duel'), ('Editor', 'editor'),
               ('Highlights', 'highlights'), ('Spielstände', 'saves'), ('Einstellungen', 'settings'), ('Hilfe', 'help')]
    for label, scr in screens:
        if pg.evaluate('FCK.UI.cur') != 'home': r.press('B'); pg.wait_for_timeout(200)
        ok = goto(r, label)
        check(ok, 'reach home item ' + label)
        r.press('A'); pg.wait_for_timeout(350)
        check(pg.evaluate('FCK.UI.cur') == scr, f'A opens {scr} (got {pg.evaluate("FCK.UI.cur")})')
        r.press('DOWN'); r.press('DOWN')  # make sure something is focused and scrolling works
        r.shot('menus_' + scr)
        c = r.cur()
        check(c is not None, f'{scr}: has focus ({c})')
        r.press('B'); pg.wait_for_timeout(300)
        check(pg.evaluate('FCK.UI.cur') == 'home', f'B returns from {scr}')
        check(label.split()[0] in (r.cur() or ''), f'home remembers focus on {label}: {r.cur()}')
    print('errors', r.errs)
    check(not r.errs, 'no console errors')
    r.close()
print('FAILED' if check.failed else 'ALL OK', check.failed)
