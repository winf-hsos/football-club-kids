const fs=require('fs'),path=require('path');
globalThis.window=globalThis;
(0,eval)(fs.readFileSync(path.join(__dirname,'..','js','util.js'),'utf8'));
(0,eval)(fs.readFileSync(path.join(__dirname,'..','js','i18n.js'),'utf8'));
(0,eval)(fs.readFileSync(path.join(__dirname,'..','js','i18n_career.js'),'utf8'));
(0,eval)(fs.readFileSync(path.join(__dirname,'..','js','i18n_mgr.js'),'utf8'));
(0,eval)(fs.readFileSync(path.join(__dirname,'..','js','i18n_cards.js'),'utf8'));
const I18F=fs.readdirSync(path.join(__dirname,'..','js')).filter(f=>/^i18n_/.test(f)&&!['i18n_career.js','i18n_mgr.js','i18n_cards.js'].includes(f));
for(const f of I18F){ (0,eval)(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8')); }
const FCK=globalThis.FCK;
const keys=new Set();
const dir=path.join(__dirname,'..','js');
for(const f of fs.readdirSync(dir)){ if(/^i18n/.test(f)||f==='worlddata.js')continue;
  const s=fs.readFileSync(path.join(dir,f),'utf8');
  for(const m of s.matchAll(/\bT\('([^']+)'/g)){ if(/^[a-z0-9]{2,4}$/.test(m[1])&&!/^(all|auto|on|off|ok|hl|og|home|away|back|help)$/.test(m[1]))continue; keys.add(m[1]); }
}
const dyn=[];
['kickoff','throwin','goalkick','corner','freekick'].forEach(k=>dyn.push('hint.t.'+k));
const AB=['power','finesse','cold','long','chip','pen','fk','pinpoint','thru','cross','tiki','vision','dribbler','touch','speedball','feint','shielder','onetouch','tackler','slider','interceptor','clean','press','engine','turbo','tank','cool','gkpen','gkreflex','gkreach'];
AB.forEach(k=>{dyn.push('ab.'+k);dyn.push('ab.'+k+'.d');});
['atk','pas','dri','def','phy','gk'].forEach(k=>dyn.push('ab.g.'+k));
['rookie','amateur','pro','world','legend'].forEach(k=>dyn.push('level.'+k));
['lenient','normal','strict','random'].forEach(k=>dyn.push('ref.'+k));
['random','clear','cloudy','rain','storm','snow','fog'].forEach(k=>dyn.push('weather.'+k));
['random','day','evening','night'].forEach(k=>dyn.push('tod.'+k));
['balanced','attacking','defensive','counter','pressing'].forEach(k=>{dyn.push('style.'+k);dyn.push('style.'+k+'.d')});
[1,2,3,4].forEach(k=>dyn.push('per.'+k));
['manager','tournament','editor','online'].forEach(k=>{dyn.push('soon.'+k);dyn.push('soon.'+k+'.sub')});
[1,2,3,4,5,6,7,8,9,10].forEach(k=>dyn.push('help.tip'+k));
['pass','shot','through','lob'].forEach(k=>dyn.push('act.'+k+'.def'));
['home','table','fixtures','comps','squad','world','history','menu'].forEach(k=>dyn.push('tab.'+k));
['promo','cl','el','ecl','rel'].forEach(k=>dyn.push('zone.'+k));
['po','r16','qf','sf','f'].forEach(k=>dyn.push('stage.'+k));
['W','D','L'].forEach(k=>dyn.push('news.match.'+k));

['train','acad','med','scout','stad','coach'].forEach(k=>{dyn.push('fac.'+k);dyn.push('fac.'+k+'.d')});
['pac','sho','pas','dri','def','phy'].forEach(k=>dyn.push('m.a.'+k));
['board','fin','build','press'].forEach(k=>dyn.push('m.c.'+k));
['cash','tb','wb','window','full','club','player','few','gk','max','young','gone','scmax','sccash','known'].forEach(k=>dyn.push('m.err.'+k));
['gate','tv','sp','prize','sale','other','wage','staff','buy','youth'].forEach(k=>dyn.push('m.f.'+k));
['hi','mid','lo'].forEach(k=>dyn.push('m.mood.'+k));
['GK','DF','MF','FW'].forEach(k=>dyn.push('m.role.'+k));
['ovr','val','pot','age'].forEach(k=>dyn.push('m.sort.'+k));
['low','normal','high'].forEach(k=>dyn.push('m.tr.'+k));
['step','bench'].forEach(k=>dyn.push('m.why.'+k));
['summer','winter'].forEach(k=>dyn.push('m.win.'+k));
['title','promo','top','mid','safe'].forEach(k=>dyn.push('obj.lg.'+k));
[0,1,2,3,4].forEach(k=>dyn.push('k.rar.'+k));
['bronze','silver','gold','prem','legend'].forEach(k=>{dyn.push('k.pack.'+k);dyn.push('k.pack.'+k+'.d')});
['de','en','es','it','fr','nl','pt','tr','us'].forEach(k=>dyn.push('k.nt.'+k));
['play2','play3','win1','win2','goals4','goals8','clean1','open2','sell3','buy1','sbc1'].forEach(k=>dyn.push('k.task.'+k));
['win10','win50','win200','goal100','div8','div5','div3','div1','cards60','cards150','gold5','elite','legend','chem','sbc5'].forEach(k=>dyn.push('k.ach.'+k));
['daily','swap1','gk3','nation','swap2','club2','league','fw3','gold1','gold2','elite'].forEach(k=>{dyn.push('k.sbc.'+k+'.d');if(k!=='daily')dyn.push('k.sbc.'+k)});
['n','avg','maxR','minR','nat','club','league','posN'].forEach(k=>dyn.push('k.chk.'+k));
['coins','full','locked','max','sold','req','done','bad','xi','gk'].forEach(k=>dyn.push('k.err.'+k));
['W','D','L'].forEach(k=>dyn.push('k.res.'+k));
['up','champ','down','stay'].forEach(k=>dyn.push('k.res.'+k));
['p1','p2co','cpu'].forEach(k=>dyn.push('k.pre.'+k));
['ovr','rar','new','val','name'].forEach(k=>dyn.push('k.sort.'+k));
['ladder','friendly'].forEach(k=>dyn.push('k.kind.'+k));
['home','team','coll','shop','market','tasks','sbc','club'].forEach(k=>dyn.push('k.tab.'+k));
['form','star','fans','board','ref','win','loss','young','rival','goal','tact','injury'].forEach(k=>['q','a0','a1','a2'].forEach(x=>dyn.push('press.'+k+'.'+x)));
['injury','warn','upgrade','buy','free','offer','sell','loan','scouted','promote','newjob'].forEach(k=>dyn.push('mn.'+k));
['transfers','youth','club'].forEach(k=>dyn.push('tab.'+k));

// stage 5
['solid','stripesV','hoops','halves','band','sash','sleeves'].forEach(k=>dyn.push('ed.kit.'+k));
['round','shield','diamond'].forEach(k=>dyn.push('ed.shape.'+k));
['plain','halves','stripesV','chevron','bend','cross'].forEach(k=>dyn.push('ed.pat.'+k));
['star','ball','bolt','crown','ring','tower','leaf'].forEach(k=>dyn.push('ed.emb.'+k));
['stripes','wide','checks','diag','plain'].forEach(k=>dyn.push('ed.grass.'+k));
['dark','club'].forEach(k=>dyn.push('ed.seat.'+k));
['de','en','es','it','fr','nl','pt','tr','us','sl','sc','ar','af','ja','ko','ir','gr'].forEach(k=>dyn.push('ed.grp.'+k));
['wm48','wm32','em24'].forEach(k=>{dyn.push('tn.kind.'+k);dyn.push('tn.kind.'+k+'.d')});
['R32','R16','QF','SF','F','B'].forEach(k=>dyn.push('tn.ko.'+k));
['in','G','R32','R16','QF','SF','F','T3','T4'].forEach(k=>dyn.push('tn.place.'+k));
['wm','em'].forEach(k=>{dyn.push('tn.place.W.'+k);dyn.push('tn.champ.'+k);dyn.push('tn.res.champion.'+k)});
['W','D','L'].forEach(k=>{dyn.push('tn.res.'+k);dyn.push('du.out.'+k)});
['bad','dup','unknown'].forEach(k=>dyn.push('du.err.'+k));
// stage 6 pro career
['GK','DF','MF','FW'].forEach(k=>dyn.push('pro.pos.'+k));
['balanced','pace','shot','tech','power'].forEach(k=>{dyn.push('pro.arch.'+k);dyn.push('pro.arch.'+k+'.d')});
['gem','solid','late'].forEach(k=>{dyn.push('pro.talent.'+k);dyn.push('pro.talent.'+k+'.d')});
['short','buzz','long','curly','bald','bun','mohawk','fade'].forEach(k=>dyn.push('pro.hs.'+k));
['star','start','rot','bench','out','inj'].forEach(k=>{dyn.push('pro.role.'+k);dyn.push('pro.role.'+k+'.d')});
['player','team'].forEach(k=>{dyn.push('pro.ctl.'+k);dyn.push('pro.ctl.'+k+'.d')});
['ap','rt','ga','cs'].forEach(k=>dyn.push('pro.ob.'+k));
['pac','sho','pas','dri','def','phy','gk'].forEach(k=>dyn.push('pro.a.'+k));
['penalty','freekick','corner'].forEach(k=>dyn.push('pro.setp.'+k));
['league','cup','cl','el','ecl','wm','em'].forEach(k=>dyn.push('pro.tr.'+k));
['scorer','best','talent','world'].forEach(k=>dyn.push('pro.aw.'+k));
['legend','star','pro','journey'].forEach(k=>dyn.push('pro.legacy.'+k));
['start','injury','nocall','callup','moved','renewed'].forEach(k=>dyn.push('pro.news.'+k));
const SRC=fs.readdirSync(dir).filter(f=>!/^i18n/.test(f)&&f!=='worlddata.js').map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
for(const k of Object.keys(FCK.I18N.de)){ if(!keys.has(k)&&SRC.includes("'"+k+"'")) dyn.push(k); }
const all=new Set([...keys,...dyn].filter(k=>!/[.]$/.test(k)&&k!=='help.tip'));
let miss=0;
for(const k of all){for(const l of ['de','en']){ if(FCK.I18N[l][k]===undefined){console.log('MISSING',l,k);miss++;} }}
for(const k of Object.keys(FCK.I18N.de)) if(FCK.I18N.en[k]===undefined){console.log('EN lacks',k);miss++;}
for(const k of Object.keys(FCK.I18N.en)) if(FCK.I18N.de[k]===undefined){console.log('DE lacks',k);miss++;}
const unused=Object.keys(FCK.I18N.de).filter(k=>!all.has(k));
console.log('keys used',all.size,'missing',miss,'unused',unused.join(','));
