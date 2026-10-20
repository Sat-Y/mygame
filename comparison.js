/* Shared-clock comparison engine, usable in browser and headless tests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./environment.js'),require('./policy.js'));else root.RunnerComparison=factory(root.RunnerEnvironment,root.RunnerPolicy);})(typeof globalThis!=='undefined'?globalThis:this,(Env,Policy)=>{
  class RunnerComparison{
    constructor(policies,seed=42){
      if(policies.length!==4||policies.some((p,i)=>p.timesteps!==[0,100000,500000,1000000][i]))throw new Error('Expected exact 0/100000/500000/1000000 checkpoints');
      this.policies=policies.map(p=>new Policy(p));this.envs=policies.map(()=>new Env({seed,assisted:false}));this.reset(seed);
    }
    reset(seed=this.seed){
      if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Invalid seed');
      this.seed=seed;this.ticks=0;this.envs.forEach(e=>e.reset({seed,assisted:false}));
    }
    get done(){return this.envs.every(e=>e.done);}
    get time(){return this.ticks/30;}
    step(){
      if(this.done)return;
      this.envs.forEach((e,i)=>{if(!e.done)e.step(this.policies[i].predict(e.observe()),4);});this.ticks++;
    }
  }
  return RunnerComparison;
});
