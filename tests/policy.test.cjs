const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');
const Env=require('../environment.js');const Policy=require('../policy.js');
const data=require('../models/policy.json');const metadata=require('../models/metadata.json');
test('frozen model matches the saved environment and policy hashes',()=>{
  const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(sha(require.resolve('../environment.js')),metadata.environmentSHA256);
  assert.equal(sha(require.resolve('../models/policy.json')),metadata.policySHA256);
  assert.equal(data.environment,Env.VERSION);assert.equal(data.assisted,false);
});
test('frozen PPO reaches 100m without external support',()=>{
  const env=new Env({seed:42,assisted:false}),policy=new Policy(data);let sum=0;
  while(!env.done){const r=env.step(policy.predict(env.observe()),4);sum+=r.reward;}
  assert.equal(env.reason,'finish');assert(env.time<60);assert.equal(env.assisted,false);assert(Math.abs(sum-env.totalReward)<1e-6);
});
test('test seeds cannot overlap training or validation seeds',()=>{
  const report=require('../models/evaluation.json'),cfg=metadata.trainingConfig;
  // Even if every transition ended an episode, no per-world seed can reach the test split.
  const upper=cfg.seed+(cfg.envs-1)*1009+(Math.ceil(cfg.steps/(256*cfg.envs))*256)*7919;
  assert(report.seedStart>upper);
  for(const episode of report.episodes)assert(!metadata.validationSeeds.includes(episode.seed));
});
