const fs=require('fs'),path=require('path');globalThis.window=globalThis;
['util','data','squad','crest','sim','rules','ai'].forEach(f=>(0,eval)(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8')));
const FCK=globalThis.FCK;
function run(seed,settings,humans){
  const m=new FCK.Match({clubs:[FCK.teamById('juv'),FCK.teamById('atm')],seed,settings:Object.assign({halfMins:1},settings),slots:humans?[{dev:'kb1',team:0},{dev:'pad0',team:1},{dev:'kb2',team:0}]:[]});
  m.autoProceed=true;
  const types={};let err=null;
  m.on(e=>{types[e.type]=(types[e.type]||0)+1;if(e.type==='restart')types['R_'+e.kind]=(types['R_'+e.kind]||0)+1;});
  let steps=0;const r=FCK.U.makeRng(seed*7+1);
  const held=[[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  try{
  while(m.mode!=='over'&&steps<60*60*30){
    if(humans){
      m.slots.forEach((s,i)=>{
        if(steps%20===0){s.rdx=r.range(-1,1);s.rdy=r.range(-1,1);}
        const pressed=[false,false,false,false],released=[false,false,false,false];
        const hld=held[i].slice();
        for(let k=0;k<4;k++){
          const want=r.chance(k===1||k===3?0.03:0.02);
          if(want&&!hld[k]){hld[k]=1;pressed[k]=true;}
          else if(hld[k]&&r.chance(k===1||k===3?0.05:0.9)){hld[k]=0;released[k]=true;}
        }
        held[i]=hld;
        s.input={dx:s.rdx||0,dy:s.rdy||0,sprint:r.chance(0.5),held:hld.map(Boolean),pressed,released};
      });
    }
    m.update(1/60);steps++;
  }}catch(e){err=e;}
  return {m,steps,types,err};
}
let bad=0;
for(let i=0;i<6;i++){
  const ko=i%2===0;
  const r=run(50+i,{knockout:ko,aggr:1,referee:'strict',weather:i%3===0?'snow':'clear',halfMins:1},i>1);
  const m=r.m;
  console.log(`seed ${50+i} ko=${ko} humans=${i>1}: ${m.teams[0].score}-${m.teams[1].score} mode=${m.mode} period=${m.period} steps=${r.steps} pens=${m.shootout?JSON.stringify(m.shootout.scored)+' won '+m.shootout.winner:'-'} err=${r.err?r.err.stack.split('\n').slice(0,3).join(' | '):'none'}`);
  const t=r.types;console.log('  ',['goal','foul','card','offside','sentOff','sub','injury','penalty','advantage','R_penalty','R_freekick','R_corner','R_throwin','R_goalkick','period','extratime','shootoutStart'].map(k=>k+':'+(t[k]||0)).join(' '));
  if(r.err||m.mode!=='over')bad++;
}
console.log(bad?('PROBLEMS: '+bad):'all ok');
