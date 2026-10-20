const test=require('node:test');
const assert=require('node:assert/strict');
const Env=require('../environment.js');
test('same seed and actions reproduce trajectory exactly',()=>{const a=new Env({seed:7}),b=new Env({seed:7});for(let i=0;i<100;i++){const action=a.ruleAction();assert.deepEqual(a.step(action),b.step(action));}assert.equal(a.observe().length,15);});
test('physical joint actions change the trajectory',()=>{const a=new Env(),b=new Env();for(let i=0;i<12;i++){a.step([1,-1,1,-1]);b.step([-1,1,-1,1]);}assert.notDeepEqual(a.observe(),b.observe());assert(a.observe().every(Number.isFinite));});
test('unassisted episodes terminate and reset cleanly',()=>{const a=new Env();while(!a.done)a.step(a.ruleAction());assert(['fall','finish','timeout','backward'].includes(a.reason));const before=a.info();const r=a.step([0,0,0,0]);assert.equal(r.reward,0);assert.deepEqual(a.info(),before);a.reset();assert.equal(a.done,false);assert.equal(a.time,0);assert.equal(a.distance,0);});
test('practice support is isolated from standard physics',()=>{const a=new Env({assisted:true}),b=new Env({assisted:false});for(let i=0;i<30;i++){a.step(a.ruleAction());b.step(b.ruleAction());}assert.notDeepEqual(a.observe(),b.observe());});
test('invalid actions are rejected, bounded actions are accepted',()=>{const a=new Env();assert.throws(()=>a.step([NaN,0,0,0]));assert.throws(()=>a.step([0]));assert.throws(()=>a.step([0,0,0,0],0));a.step([9,-9,9,-9]);assert.deepEqual(a.actions,[1,-1,1,-1]);});
test('practice rule demo reaches the finish with the UI step frequency',()=>{const a=new Env({seed:42,assisted:true});while(!a.done)a.step(a.ruleAction(),2);assert.equal(a.reason,'finish');assert(a.distance>=100);assert(a.time<60);});
