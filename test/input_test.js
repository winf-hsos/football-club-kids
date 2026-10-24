globalThis.window=globalThis; window.addEventListener=()=>{}; globalThis.navigator={getGamepads:()=>[]};
const fs=require('fs');
['util','input'].forEach(f=>(0,eval)(fs.readFileSync(__dirname+'/../js/'+f+'.js','utf8')));
const I=new FCK.Input();
I.setup([{dev:'kb1',team:0},{dev:'kb2',team:1}]);
I.keys.add('KeyD');I.keys.add('KeyE');I.keys.add('ArrowUp');I.keys.add('Period');
I.poll();
let a=I.consume(0),b=I.consume(1);
console.log('p1',a.dx,a.dy,a.pressed.join(),a.held.join(),'p2',b.dx,b.dy,b.pressed.join());
I.poll(); a=I.consume(0); console.log('second poll pressed',a.pressed.join(),'held',a.held.join());
I.keys.delete('KeyE'); I.poll(); a=I.consume(0); console.log('released',a.released.join());
// solo keyboard accepts both
I.setup([{dev:'kb1',team:0}]); I.keys.clear(); I.keys.add('ArrowLeft'); I.keys.add('Space'); I.poll(); a=I.consume(0); console.log('solo',a.dx,a.pressed.join());
