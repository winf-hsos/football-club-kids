import os as _os
_ROOT = _os.path.abspath(_os.path.join(_os.path.dirname(__file__), '..'))
_OUT = _os.path.join(_os.environ.get('FCK_SHOTS', _os.path.join(_os.environ.get('TMPDIR', '/tmp'), 'fck-shots')), '')
_os.makedirs(_OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
OUT=_OUT
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1180,'height':1000}, locale='de-DE').new_page(); errs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
    pg.goto(('file://' + _ROOT + '/dist/FCK.html')); pg.wait_for_timeout(1000)
    print(pg.evaluate("""(()=>{const W=FCK.World; if(!W.clubs||!W.clubs.length) W.build(); const c=W.clubs.find(x=>x.country==='pl'); const sq=FCK.makeFullSquad(c,3).slice(0,11).map(p=>FCK.groupFlag(p.nat)+' '+p.name); return c.name+': '+sq.join(' | ');})()"""))
    # cards: nationality label for exotic groups
    print(pg.evaluate("""(()=>{const out=[];for(const g of FCK.EXTRA_NAME_GROUPS){const t=FCK.T('k.nt.'+g); if(!t||t.startsWith('k.nt'))out.push(g);} return 'missing labels: '+out.join(',');})()"""))
    print('errors', errs or 'none')
