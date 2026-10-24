const fs=require('fs'),path=require('path');
globalThis.window=globalThis;
globalThis.btoa=(s)=>Buffer.from(s,'binary').toString('base64');globalThis.atob=(s)=>Buffer.from(s,'base64').toString('binary');
['util','data','squad','crest','sim','rules','ai','stats'].forEach(f=>(0,eval)(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8')));
const FCK=globalThis.FCK;
const m=new FCK.Match({clubs:[FCK.teamById('fcb'),FCK.teamById('mci')],seed:5,settings:{halfMins:2},slots:[]});
m.autoProceed=true;let steps=0,maxAng=0;
while(m.mode!=='over'&&steps<60*60*10){m.update(1/60);steps++;m.players.forEach(p=>{maxAng=Math.max(maxAng,Math.abs(p.ang))});}
console.log('max ang',maxAng);
const fr=m.getClip(10);
const e=FCK.Archive.fromMatch(m,fr,{scorer:m.players[3],minute:12,team:0},'de');
console.log('frames',fr.length,'json bytes',JSON.stringify(e).length);
const o=FCK.Archive.open(JSON.parse(JSON.stringify(e)));
o.rp.seek(2);console.log(o.rp.view.ball, o.rp.players[0].x, fr[60][3]);
