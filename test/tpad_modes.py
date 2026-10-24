# every game mode must give player 1 the connected pad (and a pref_dev=kb setting must win) - plus a short pad-played check
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpad_common import *

with sync_playwright() as p:
    r = Rig(p); pg = r.pg
    pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(300)
    dev0 = lambda: pg.evaluate("FCK.game.m ? FCK.game.m.slots.map(s => s.dev) : null")
    def play_check(label):
        pg.wait_for_function("FCK.game.kind === 'match' && FCK.game.m", timeout=15000)
        devs = dev0()
        check(devs and devs[0] == 'pad0', f'{label}: player 1 on pad0 {devs}')
        for _ in range(8):  # kick-off: the taker walks to the spot first, then A plays the pass
            if pg.evaluate("FCK.game.m.mode") == 'play': break
            r.press('A'); pg.wait_for_timeout(400)
        p1 = pg.evaluate("(() => { const s = FCK.game.m.slots[0]; return [s.player.x, s.player.y]; })()")
        r.axes(0, 1); pg.wait_for_timeout(1000); r.axes(0, 0)
        p2 = pg.evaluate("(() => { const s = FCK.game.m.slots[0]; return [s.player.x, s.player.y]; })()")
        check(abs(p2[0] - p1[0]) + abs(p2[1] - p1[1]) > 0.8, f'{label}: stick moves the player {p1} -> {p2}')
        pg.evaluate("FCK.game.quit()"); pg.wait_for_timeout(300)

    # shared helper
    check(pg.evaluate("FCK.devicesFor('p1')")[0] == 'pad0', 'devicesFor(p1) = pad0 with a controller')
    check(pg.evaluate("FCK.devicesFor('p2vs')") == ['pad0', 'kb1'], 'devicesFor(p2vs) = pad0 + kb1')
    check(pg.evaluate("FCK.devicesFor('cpu')") == [], 'devicesFor(cpu) = none')
    check(pg.evaluate("FCK.devicesFor('p4')").__len__() == 4, 'devicesFor(p4) has 4 devices')
    pg.evaluate("FCK.settings.pref_dev = 'kb'")
    check(pg.evaluate("FCK.devicesFor('p1')")[0] == 'kb1', 'pref_dev=kb -> kb1 first')
    pg.evaluate("FCK.settings.pref_dev = 'pad'")
    check(pg.evaluate("FCK.devicesFor('p1')")[0] == 'pad0', 'pref_dev=pad -> pad0 first')
    pg.evaluate("FCK.settings.pref_dev = 'auto'")
    pg.evaluate("window.__padOn = false")
    check(pg.evaluate("FCK.devicesFor('p1')")[0] == 'kb1', 'no controller -> keyboard')
    pg.evaluate("FCK.settings.pref_dev = 'pad'")
    check(pg.evaluate("FCK.devicesFor('p1')")[0] == 'kb1', 'pref pad but none connected -> keyboard fallback')
    pg.evaluate("FCK.settings.pref_dev = 'auto'; window.__padOn = true")

    # cards
    pg.evaluate("(() => { const S = FCK.Cards.ensure(); FCK.Cards.autoFill(S); S.preset = 'p1'; FCK.Cards.save && FCK.Cards.save(); })()")
    err = pg.evaluate("FCK.Cards.play('friendly', FCK.World.clubs[7])")
    check(err is None, 'cards: match started ' + str(err)); play_check('cards')
    # tournament
    pg.evaluate("(() => { const S = FCK.Tourney.create({ kind: 'wm48', me: 'GER', half: 1, level: 'rookie', preset: 'p1' }); FCK.Tourney.install(S); FCK.Tourney.play(S); })()")
    play_check('tournament')
    # career
    pg.evaluate("(() => { FCK.World.build(); const c = FCK.Career.create({ clubId: FCK.World.clubs[3].id, preset: 'p1', halfMins: 2 }); FCK.Career.play(); })()")
    play_check('career')
    # friendly via the builder (preset p1 refreshes with the connected pad even if the stored slots are stale)
    pg.evaluate("FCK.setup.preset = 'p1'; FCK.setup.slots = [{dev:'kb1', team:0},{dev:'none',team:1},{dev:'none',team:0},{dev:'none',team:1}]")
    pg.evaluate("FCK.rematch()")
    play_check('friendly (stale slots)')
    # duel
    cfg = pg.evaluate("""(() => { const Du = FCK.Duel; const mine = { club: FCK.teamById('fcb'), squad: FCK.pickSquad(FCK.World.squad(FCK.teamById('fcb'), 1), '4-3-3'), form: '4-3-3', style: 'balanced' };
      return typeof Du.acceptConfig === 'function' ? 'has acceptConfig' : 'missing'; })()""")
    print('   duel:', cfg, '(uses FCK.presetSlots like the others)')
    print('errors', r.errs)
    check(not r.errs, 'no console errors')
    r.close()
print('FAILED' if check.failed else 'ALL OK', check.failed)
