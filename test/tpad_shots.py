# screenshots of the pad UI on a phone and a desktop viewport (for eyeballing the focus ring / hint bar)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpad_common import *

with sync_playwright() as p:
    for (w, h, tag) in [(390, 844, 'ph'), (1180, 760, 'dk')]:
        r = Rig(p, w=w, h=h); pg = r.pg
        pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(300)
        r.press('DOWN'); r.shot(f'{tag}_1_home')
        r.press('A'); pg.wait_for_timeout(400)
        nav_to(r, "e => e.tagName === 'INPUT' && e.type === 'range'"); r.shot(f'{tag}_2_setup_slider')
        nav_to(r, "e => e.classList.contains('chip') && e.textContent.trim() === 'Regen'"); r.shot(f'{tag}_3_setup_chip')
        nav_to(r, "e => e.tagName === 'SELECT' && e.getAttribute('aria-label') === 'Formation'"); r.press('A'); pg.wait_for_timeout(200); r.shot(f'{tag}_4_select_list'); r.press('B')
        nav_to(r, "e => e.tagName === 'INPUT' && e.type === 'checkbox'"); r.shot(f'{tag}_5_toggle')
        pg.evaluate("FCK.UI.show('settings')"); pg.wait_for_timeout(300); r.press('DOWN'); r.shot(f'{tag}_6_settings')
        pg.evaluate("FCK.UI.show('cards', null, true)"); pg.wait_for_timeout(300); r.press('DOWN'); r.shot(f'{tag}_7_cards')
        pg.evaluate("FCK.UI.show('setup')"); pg.wait_for_timeout(300)
        nav_to(r, "e => e.textContent.trim() === 'Verein wechseln'"); r.press('A'); pg.wait_for_timeout(500); r.shot(f'{tag}_8_picker')
        r.press('B'); pg.wait_for_timeout(200)
        r.press('START'); pg.wait_for_timeout(1000)
        r.press('START'); pg.wait_for_timeout(400); r.shot(f'{tag}_9_pause')
        print(tag, 'errors', r.errs)
        r.close()
