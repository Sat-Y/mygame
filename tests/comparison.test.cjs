const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');
const Comparison=require('../comparison.js'),Env=require('../environment.js'),Policy=require('../policy.js');
const manifest=require('../models/checkpoints/manifest.json');
const policies=manifest.checkpoints.map(e=>require('../models/checkpoints/'+e.policy));
test('exact milestones share one run and an unchanged physics environment',()=>{
  assert.deepEqual(policies.map(p=>p.timesteps),[0,100000,500000,1000000]);
  assert.equal(manifest.n_steps*manifest.envs,4000);assert.equal(manifest.assisted,false);
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(hash(require.resolve('../environment.js')),manifest.environmentSHA256);
  manifest.checkpoints.forEach(e=>assert.equal(hash(require.resolve('../models/checkpoints/'+e.policy)),e.sha256));
  assert.equal(new Set(manifest.checkpoints.map(e=>e.sha256)).size,4);
});
test('all lanes start with the same seed and observation, reset restores them',()=>{
  const c=new Comparison(policies,42);const initial=c.envs[0].observe();
  c.envs.forEach(e=>{assert.deepEqual(e.observe(),initial);assert.equal(e.assisted,false);});
  for(let i=0;i<90;i++)c.step();c.reset();
  assert.equal(c.time,0);c.envs.forEach(e=>assert.deepEqual(e.observe(),initial));
  assert.throws(()=>c.reset(-1));
});
test('synchronized lanes match standalone rollouts, ended lanes stay frozen',()=>{
  const c=new Comparison(policies,42);let ended=[];
  while(!c.done){c.step();c.envs.forEach((e,i)=>{if(ended[i])assert.deepEqual(e.info(),ended[i]);else if(e.done)ended[i]=e.info();});assert(c.time<61);}
  policies.forEach((p,i)=>{const e=new Env({seed:42,assisted:false}),policy=new Policy(p);while(!e.done)e.step(policy.predict(e.observe()),4);assert.deepEqual(c.envs[i].info(),e.info());});
  const time=c.time;c.step();assert.equal(c.time,time);
});
