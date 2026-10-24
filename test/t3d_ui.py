# settings screen + in-match quick menu show the 3D fields (screenshots; usage: python3 t3d_ui.py)
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from t3d_lib import *
with sync_playwright() as p:
    b = launch(p)
    pg = new_page(b, 1280, 900)
    open_game(pg, {})
    pg.evaluate("() => FCK.UI.show('settings', null, true)")
    pg.wait_for_timeout(500)
    txt = pg.evaluate("() => document.body.innerText")
    for k in ['3D-Ansicht', 'Kamera', 'Qualität']:
        print(k, k in txt)
    pg.evaluate("() => { const e = [...document.querySelectorAll('.lbl')].find((x) => /3D/.test(x.textContent)); if (e) e.scrollIntoView({ block: 'center' }); }")
    pg.wait_for_timeout(300)
    shot(pg, 'ui_settings')
    # change quality + camera through the chips, check the stored settings
    pg.evaluate("() => { const chip = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Hoch' && x.closest('.field') && /Grafikqualit/.test(x.closest('.field').textContent)); if (chip) chip.click(); }")
    print('q3d after click', pg.evaluate("FCK.settings.q3d"))
    # quick menu in a match
    pg.evaluate("() => FCK.UI.show('home')")
    start_match(pg); pg.wait_for_timeout(300); advance(pg, 0.5, every=3)
    pg.evaluate("() => { FCK.pauseMenu(FCK.game); }")
    pg.wait_for_timeout(400)
    shot(pg, 'ui_pause')
    clicked = pg.evaluate("() => { const b = [...document.querySelectorAll('button')].find((x) => /Ton|Sound|View/.test(x.textContent)); if (b) { b.click(); return true; } return false; }")
    pg.wait_for_timeout(400)
    shot(pg, 'ui_quick')
    print('quick menu opened', clicked, 'errs', pg.errs)
    b.close()
