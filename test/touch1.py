import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
# phone + touch end-to-end: emulated phone (landscape/portrait), real touch events through CDP
import sys, os, json
from playwright.sync_api import sync_playwright
OUT=_OUT
HTML=('file://' + _ROOT + '/dist/FCK.html')
ok=[0,0]
def check(c,m):
    ok[0 if c else 1]+=1; print(('PASS ' if c else 'FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    for tag,vp in ([('land',{'width':844,'height':390})] if os.environ.get('T3D') else [('land',{'width':844,'height':390}),('port',{'width':390,'height':844})]):
        ctx=b.new_context(viewport=vp, device_scale_factor=2, is_mobile=True, has_touch=True, locale='de-DE', user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
        pg=ctx.new_page(); errs=[]
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'Failed to load' not in m.text else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        if not os.environ.get('T3D'): pg.add_init_script("try{localStorage.setItem('fck.settings', JSON.stringify({gfx3d:'2d'}))}catch(e){}")
        else: pg.add_init_script("window.FCK_R3D_PRESERVE=true")
        cdp=ctx.new_cdp_session(pg)
        def touch(kind, pts):
            cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts})
        def tp(x,y,i=0): return {'x':x,'y':y,'id':i}
        pg.goto(HTML); pg.wait_for_function('window.FCK_READY===true'); pg.wait_for_timeout(500)
        print('---',tag, 'isTouchDevice', pg.evaluate('FCK.isTouchDevice()'))
        pg.tap('.pcard >> nth=1'); pg.tap('text=Los geht'); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT+'t_%s_home.png'%tag)
        # friendly match
        pg.tap('.mitem:has-text("Freundschaftsspiel")'); pg.wait_for_timeout(500)
        pg.screenshot(path=OUT+'t_%s_setup.png'%tag, full_page=True)
        devs = pg.evaluate("FCK.setup.slots.map(s=>s.dev)"); check(devs[0]=='touch','setup slot 1 = touch '+str(devs))
        pg.tap('button:has-text("Anstoß")'); pg.wait_for_function("FCK.game.m && FCK.game.m.clock>2", timeout=90000); pg.wait_for_timeout(600)
        pg.screenshot(path=OUT+'t_%s_match.png'%tag)
        st=lambda: pg.evaluate("(()=>{const m=FCK.game.m,s=m.slots[0];return {dev:s.dev,x:s.player.x,y:s.player.y,mode:m.mode,paused:FCK.game.paused,show:document.getElementById('touch').classList.contains('show')}})()")
        s0=st(); check(s0['show'] and s0['dev']=='touch','touch overlay visible, dev touch '+str(s0))
        # drag the stick in the left part
        sx,sy=(120,250) if tag=='land' else (90,640)
        # wait for kickoff phase
        pg.evaluate("FCK.game.m.autoProceed=false")
        # tap A for kick-off
        ab=pg.query_selector('.tb-a').bounding_box(); touch('touchStart',[tp(ab['x']+ab['width']/2,ab['y']+ab['height']/2,5)]); pg.wait_for_timeout(120); touch('touchEnd',[]); pg.wait_for_timeout(1200)
        s1=st()
        touch('touchStart',[tp(sx,sy,1)]); 
        for i in range(10): touch('touchMove',[tp(sx+i*7,sy,1)]); pg.wait_for_timeout(70)
        pg.wait_for_timeout(500); s2=st()
        touch('touchEnd',[])
        check(abs(s2['x']-s1['x'])+abs(s2['y']-s1['y'])>1.2,'stick drag moves the player %s -> %s'%((round(s1['x'],1),round(s1['y'],1)),(round(s2['x'],1),round(s2['y'],1))))
        # buttons: hold B -> charge
        bb=pg.query_selector('.tb-b').bounding_box(); touch('touchStart',[tp(bb['x']+bb['width']/2,bb['y']+bb['height']/2,6)]); pg.wait_for_timeout(300)
        held=pg.evaluate("FCK.game.input.touch.held[1]"); touch('touchEnd',[]); check(held,'button B holds')
        # multi-touch: stick + sprint button simultaneously
        touch('touchStart',[tp(sx,sy,1)]); touch('touchMove',[tp(sx+40,sy,1)])
        sb=pg.query_selector('.tb-s').bounding_box(); touch('touchStart',[tp(sx+40,sy,1),tp(sb['x']+sb['width']/2,sb['y']+sb['height']/2,7)]); pg.wait_for_timeout(200)
        sp=pg.evaluate("FCK.game.input.touch.sprint"); touch('touchEnd',[]); check(sp,'multi touch: stick + sprint')
        pg.screenshot(path=OUT+'t_%s_match2.png'%tag)
        # pause
        pg.tap('#pausebtn, .pausebtn, button[aria-label*="Pause"], .hud-pause') if pg.query_selector('#pausebtn, .pausebtn, button[aria-label*="Pause"], .hud-pause') else None
        pg.wait_for_timeout(400)
        print(tag,'paused?',st()['paused'])
        pg.screenshot(path=OUT+'t_%s_pause.png'%tag)
        print(tag,'errors',errs or 'none')
        ctx.close()
    b.close()
print('FAILED' if ok[1] else 'ALL OK', ok)
