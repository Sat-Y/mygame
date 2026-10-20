// Frozen, held-out evaluation. Results are measured, never hand-written.
const fs=require('node:fs');const path=require('node:path');
const Env=require('../environment.js');const Policy=require('../policy.js');
const policyFile=process.argv[2];if(!policyFile)throw new Error('Usage: node training/evaluate.cjs path/to/policy.json [output-dir]');
const policy=new Policy(JSON.parse(fs.readFileSync(policyFile,'utf8')));
// This split is beyond the maximum possible training seed for this run.
// The previous 200000 progression overlapped early training episodes.
const count=Number(process.env.EVAL_EPISODES||30),startSeed=2000000000;
const episodes=[];
for(const controller of ['random','rule','ppo']){
  for(let n=0;n<count;n++){
    const env=new Env({seed:startSeed+n*1009,assisted:false});
    while(!env.done){const a=controller==='ppo'?policy.predict(env.observe()):controller==='rule'?env.ruleAction():env.randomAction();env.step(a,4);}
    episodes.push({controller,...env.info()});
  }
}
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const summary=['random','rule','ppo'].map(controller=>{
  const rs=episodes.filter(r=>r.controller===controller),distance=mean(rs.map(r=>r.distance));
  return {controller,episodes:rs.length,distanceMean:distance,distanceStd:Math.sqrt(mean(rs.map(r=>(r.distance-distance)**2))),
    survivalMean:mean(rs.map(r=>r.time)),fallRate:mean(rs.map(r=>Number(r.reason==='fall'))),finishRate:mean(rs.map(r=>Number(r.reason==='finish')))};
});
const result={environment:Env.VERSION,assisted:false,actionFrames:4,trainingSteps:policy.data.timesteps,seedStart:startSeed,seedStride:1009,summary,episodes};
if(process.argv[3]){const dir=path.resolve(process.argv[3]);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'evaluation.json'),JSON.stringify(result,null,2));
  const fields=['controller','seed','distance','time','reason','totalReward'];fs.writeFileSync(path.join(dir,'evaluation.csv'),fields.join(',')+'\n'+episodes.map(r=>fields.map(k=>r[k]).join(',')).join('\n'));}
console.log(JSON.stringify({...result,episodes:undefined},null,2));
