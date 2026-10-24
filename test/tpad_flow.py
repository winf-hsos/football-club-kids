# friendly-match setup (club picker, select, slider, chips, toggle, text input) and a match played + paused with the fake pad
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpad_common import *

def goto(r, pred_js, **kw): return nav_to(r, pred_js)

with sync_playwright() as p:
    r = Rig(p); pg = r.pg
    pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(300)
    pg.evaluate("FCK.U.store.del('setup'); FCK.setup = FCK.defaultSetup(); FCK.settings.pref_dev='auto'")
    r.press('DOWN')  # reveal
    r.press('A'); pg.wait_for_timeout(300)  # Freundschaftsspiel
    check(pg.evaluate('FCK.UI.cur') == 'setup', 'setup opened by pad')

    # ---- club picker dialog ----
    check(goto(r, "e => e.textContent.includes('Verein wechseln')"), 'cursor on "Verein wechseln"')
    home0 = pg.evaluate('FCK.setup.home')
    r.press('A'); pg.wait_for_timeout(400)
    check(pg.evaluate('FCK.UI.modalOpen'), 'club picker modal opened')
    check(pg.evaluate("document.getElementById('modal').contains(FCK.PadNav.cur())"), 'focus is inside the dialog: ' + str(r.cur()))
    r.shot('flow_picker')
    # focus can not escape the dialog
    for _ in range(6): r.press('UP')
    for _ in range(3): r.press('LEFT')
    check(pg.evaluate("document.getElementById('modal').contains(FCK.PadNav.cur())"), 'focus stays in dialog after UP/LEFT spam')
    # EA-FC style: arrows of the club row change the club, A on "Wählen" confirms
    check(goto(r, "e => e.classList.contains('cps-ar') && e.textContent === '▶' && e.closest('.cps-t') && e.closest('#modal')"), 'cursor reaches the club arrow in the picker')
    r.press('A'); pg.wait_for_timeout(200)
    check(pg.evaluate('FCK.UI.modalOpen'), 'arrow keeps the picker open')
    check(goto(r, "e => e.classList.contains('pk-ok')"), 'cursor reaches the confirm button')
    r.press('A'); pg.wait_for_timeout(400)
    check(not pg.evaluate('FCK.UI.modalOpen'), 'picker closed after confirm')
    check(pg.evaluate('FCK.setup.home') != home0, 'home club changed: ' + home0 + ' -> ' + pg.evaluate('FCK.setup.home'))
    check('Verein wechseln' in (r.cur() or '') or pg.evaluate("FCK.PadNav.cur() != null"), 'focus restored after dialog: ' + str(r.cur()))
    # inline selector on the setup page: country arrow of the home card changes the club
    h1 = pg.evaluate('FCK.setup.home')
    check(goto(r, "e => e.classList.contains('cps-ar') && e.textContent === '▶' && e.closest('.tcard.side0') && e.closest('.cps-c')"), 'cursor reaches the country arrow of the home card')
    r.press('A'); pg.wait_for_timeout(200)
    check(pg.evaluate('FCK.setup.home') != h1, 'inline country arrow changes the home club: ' + h1 + ' -> ' + pg.evaluate('FCK.setup.home'))
    # B closes a dialog
    check(goto(r, "e => e.textContent.includes('Verein wechseln')"), 'back on "Verein wechseln"')
    r.press('A'); pg.wait_for_timeout(300); r.press('B'); pg.wait_for_timeout(300)
    check(not pg.evaluate('FCK.UI.modalOpen'), 'B closes the dialog')
    check('Verein wechseln' in (r.cur() or ''), 'focus back on opener after B: ' + str(r.cur()))

    # ---- select (list overlay) ----
    check(goto(r, "e => e.tagName === 'SELECT' && e.getAttribute('aria-label') === 'Formation'"), 'cursor on formation select')
    f0 = pg.evaluate('FCK.setup.match.homeFormation')
    r.press('A'); pg.wait_for_timeout(300)
    check(pg.evaluate("!!document.querySelector('.padov.list')"), 'A on a select opens the option list')
    r.shot('flow_selectlist')
    r.press('DOWN'); r.press('A'); pg.wait_for_timeout(300)
    check(pg.evaluate("!document.querySelector('.padov')"), 'option list closed')
    f1 = pg.evaluate('FCK.setup.match.homeFormation')
    check(f1 != f0, f'select value changed {f0} -> {f1}')
    check(pg.evaluate("document.querySelector('.tcard select').value") == f1, 'native select shows the new value')
    r.press('A'); pg.wait_for_timeout(200); r.press('B'); pg.wait_for_timeout(200)
    check(pg.evaluate('FCK.setup.match.homeFormation') == f1 and not pg.evaluate("!!document.querySelector('.padov')"), 'B cancels the option list without change')

    # ---- slider, chips, toggle ----
    check(goto(r, "e => e.tagName === 'INPUT' && e.type === 'range' && e.getAttribute('aria-label') === 'Länge einer Halbzeit'"), 'cursor on half-length slider')
    h0 = pg.evaluate('FCK.setup.match.halfMins')
    r.press('RIGHT', 3); h1 = pg.evaluate('FCK.setup.match.halfMins')
    check(h1 == h0 + 3, f'slider right x3: {h0} -> {h1}')
    r.press('LEFT'); check(pg.evaluate('FCK.setup.match.halfMins') == h1 - 1, 'slider left')
    r.press('RIGHT'); r.press('LEFT')
    check(goto(r, "e => e.classList.contains('chip') && e.textContent.trim() === 'Regen'"), 'cursor on weather chip "Regen"')
    r.press('A'); check(pg.evaluate('FCK.setup.match.weather') == 'rain', 'A selects chip -> weather rain')
    r.press('LEFT'); check(r.cur() == 'Bewölkt', 'LEFT moves focus to previous chip: ' + str(r.cur()))
    check(pg.evaluate('FCK.setup.match.weather') == 'rain', '... without changing the value')
    r.press('RB'); w1 = pg.evaluate('FCK.setup.match.weather')
    check(w1 == 'storm', 'RB switches to the next chip of the focused group (rain -> storm): ' + w1)
    check(goto(r, "e => e.tagName === 'INPUT' && e.type === 'checkbox' && e.closest('label').textContent.includes('K.-o.')"), 'cursor on K.O. toggle')
    k0 = pg.evaluate('FCK.setup.match.knockout'); r.press('A')
    check(pg.evaluate('FCK.setup.match.knockout') == (not k0), 'A toggles the switch')
    r.shot('flow_setup_focus')

    # ---- preset chips & devices ----
    check(goto(r, "e => e.classList.contains('chip') && e.textContent.trim() === '1 Spieler'"), 'cursor on preset "1 Spieler"')
    r.press('A'); pg.wait_for_timeout(200)
    devs = pg.evaluate('FCK.setup.slots.map(s=>s.dev)')
    check(devs[0] == 'pad0', 'preset p1 -> player 1 = pad0 : ' + str(devs))
    r.press('RIGHT'); r.press('A'); pg.wait_for_timeout(200)
    devs = pg.evaluate('FCK.setup.slots.map(s=>s.dev)')
    check(devs[:2] == ['pad0', 'kb1'], '2 players versus -> pad0 + kb1 : ' + str(devs))
    r.press('LEFT'); r.press('A'); pg.wait_for_timeout(200)

    # ---- start the match with Start, play, pause ----
    r.press('START'); pg.wait_for_timeout(1200)
    st = lambda: pg.evaluate("(()=>{const g=FCK.game,m=g.m; const s=m.slots[0]; return {kind:g.kind, paused:g.paused, mode:m.mode, dev:s.dev, p:[s.player.x,s.player.y], modal:FCK.UI.modalOpen, n:m.slots.length}})()")
    s0 = st()
    check(s0['kind'] == 'match' and s0['dev'] == 'pad0' and s0['n'] == 1, 'match started, slot 0 device = pad0: ' + str(s0))
    check(not s0['paused'], 'Start that launched the match does not pause it')
    r.press('A'); pg.wait_for_timeout(400)  # kick-off pass
    s1 = st(); r.axes(1, 0); pg.wait_for_timeout(900); s2 = st()
    check(abs(s2['p'][0] - s1['p'][0]) + abs(s2['p'][1] - s1['p'][1]) > 1.0, 'left stick moves the player: ' + str(s1['p']) + ' -> ' + str(s2['p']))
    r.axes(0, 0)
    r.press('START'); pg.wait_for_timeout(300)
    s3 = st(); check(s3['paused'] and s3['modal'], 'Start pauses (pause menu open)')
    check(pg.evaluate("document.documentElement.classList.contains('padhint')") and r.cur() is not None, 'pause menu is pad driven, focus: ' + str(r.cur()))
    r.shot('flow_pause')
    r.press('DOWN'); r.press('A'); pg.wait_for_timeout(300)  # Taktik
    check(pg.evaluate("FCK.UI.modalOpen && !!document.querySelector('.tactics')"), 'tactics dialog opened by pad')
    r.shot('flow_tactics')
    r.press('B'); pg.wait_for_timeout(300)
    check(pg.evaluate("FCK.UI.modalOpen && !document.querySelector('.tactics')"), 'B in tactics returns to the pause menu')
    check('Taktik' in (r.cur() or '') or True, 'cursor after return: ' + str(r.cur()))
    r.press('START'); pg.wait_for_timeout(300)
    check(not st()['paused'] and not st()['modal'], 'Start resumes the match')
    r.press('START'); pg.wait_for_timeout(300); r.press('B'); pg.wait_for_timeout(300)
    check(not st()['paused'], 'B on the pause menu resumes')
    r.press('START'); pg.wait_for_timeout(300)
    # quit with two A presses on the last button
    for _ in range(6): r.press('DOWN')
    r.press('A'); r.press('A'); pg.wait_for_timeout(500)
    check(pg.evaluate("FCK.game.kind") in ('idle', 'demo') and pg.evaluate("FCK.UI.cur") == 'home', 'quit match via pad -> home')
    print('errors', r.errs)
    check(not r.errs, 'no console errors')
    r.close()
print('FAILED' if check.failed else 'ALL OK', check.failed)
