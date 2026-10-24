import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
import time
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':720}, locale='de-DE')
    pg=ctx.new_page()
    errs=[]
    pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html'))
    pg.wait_for_timeout(800)
    pg.click('.pcard >> nth=1'); pg.click('text=Los geht'); pg.wait_for_timeout(400)
    pg.click('text=Freundschaftsspiel'); pg.wait_for_timeout(300)
    pg.click('text=Zuschauen')
    pg.evaluate("FCK.setup.match.halfMins=1; FCK.setup.match.knockout=true; FCK.setup.match.level='legend'; Object.assign(FCK.setup.match, FCK.LEVELS.legend)")
    pg.click('text=Anstoß')
    pg.wait_for_function("FCK.game.m && FCK.game.m.mode==='play' && FCK.game.m.clock>40", timeout=60000)
    t0=time.time(); seen=set()
    while time.time()-t0<140:
        st=pg.evaluate("""(()=>{const g=FCK.game,m=g.m;
          if(g.kind!=='match') return {kind:g.kind};
          if(g.breakShown){const k=m.breakKind; return {brk:k};}
          if(m.mode==='play'&&m.period>=1&&m.clock<m.periodEnd-80&&m.clock>100){ if(m.period>=2||m.clock>2400){m.clock=m.periodEnd-70;} }
          if(m.mode==='play'&&m.period===2){ m.teams[0].score=1; m.teams[1].score=1; }
          return {mode:m.mode,period:m.period,so:m.shootout?JSON.stringify(m.shootout.kicks):null};})()""")
        if 'brk' in st:
            if st['brk'] not in seen:
                seen.add(st['brk']); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'k_break_'+st['brk']+'.png')
            pg.evaluate("FCK.game.continueBreak()")
        if st.get('mode')=='shootout' and 'so' not in seen:
            seen.add('so'); pg.wait_for_timeout(2500); pg.screenshot(path=OUT+'k_shootout.png')
        if st.get('kind')=='result':
            pg.wait_for_timeout(500); pg.screenshot(path=OUT+'k_result.png'); break
        pg.wait_for_timeout(350)
    print(seen, st)
    print('\n'.join(errs[:20]) or 'no errors')
    b.close()
