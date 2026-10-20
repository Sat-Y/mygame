const fs=require('node:fs');const Comparison=require('../comparison.js');const manifest=require('../models/checkpoints/manifest.json');
const policies=manifest.checkpoints.map(e=>require('../models/checkpoints/'+e.policy));
const seeds=[42,2000000000,2000001009,2000002018,2000003027];
const episodes=[];
for(const seed of seeds){const c=new Comparison(policies,seed);while(!c.done)c.step();c.envs.forEach((e,i)=>episodes.push({trainingStep:policies[i].timesteps,...e.info()}));}
const result={run:manifest.run,seeds,note:'Preselected preview seeds; not used to select checkpoints. Single training run.',episodes};
fs.writeFileSync('models/checkpoints/preview-results.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(episodes.filter(e=>e.seed===42),null,2));
