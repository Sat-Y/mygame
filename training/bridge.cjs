// JSON-lines bridge: one Node process owns a batch of identical Planck worlds.
const readline=require('node:readline');
const Env=require('../environment.js');
let envs=[],seeds=[],returns=[],lengths=[];
const observation=e=>e.observe().map((v,i)=>Math.max(-10,Math.min(10,v*Env.OBS_SCALE[i])));
function command(m){
  if(m.cmd==='init'){
    envs=Array.from({length:m.count},(_,i)=>new Env({seed:(m.seed+i*1009)>>>0,assisted:false}));
    seeds=envs.map(e=>e.seed);returns=envs.map(()=>0);lengths=envs.map(()=>0);
    return envs.map(observation);
  }
  if(m.cmd==='reset')return envs.map((e,i)=>{seeds[i]=((m.seed??0)+i*1009)>>>0;e.reset({seed:seeds[i],assisted:false});returns[i]=0;lengths[i]=0;return observation(e);});
  if(m.cmd==='step')return envs.map((e,i)=>{
    const r=e.step(m.actions[i],4);returns[i]+=r.reward;lengths[i]++;
    const obs=observation(e),done=r.terminated||r.truncated,info={...r.info,'TimeLimit.truncated':r.truncated&&!r.terminated};
    if(done){info.terminal_observation=obs;info.episode={r:returns[i],l:lengths[i]};
      seeds[i]=(seeds[i]+7919)>>>0;e.reset({seed:seeds[i],assisted:false});returns[i]=0;lengths[i]=0;
    }
    return {obs:done?observation(e):obs,reward:r.reward,done,info:done?info:{}};
  });
  throw new Error('Unknown bridge command');
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{try{process.stdout.write(JSON.stringify(command(JSON.parse(line)))+'\n');}catch(e){process.stdout.write(JSON.stringify({error:e.stack})+'\n');}});
