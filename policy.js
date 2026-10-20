// Portable deterministic inference for the SB3 PPO actor (Linear/Tanh/Linear).
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RunnerPolicy=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  class RunnerPolicy{
    constructor(data){
      if(data.algorithm!=='PPO'||data.environment!=='flat-v2'||data.assisted!==false||data.actionFrames!==4)throw new Error('Unsupported policy environment');
      if(!Array.isArray(data.layers)||data.layers.length!==3)throw new Error('Invalid actor network');
      this.data=data;
    }
    predict(observation){
      const d=this.data;
      let x=observation.map((v,i)=>Math.max(-d.observationClip,Math.min(d.observationClip,v*d.observationScale[i])));
      for(const layer of d.layers){x=layer.weight.map((weights,i)=>{
        let v=layer.bias[i];for(let j=0;j<weights.length;j++)v+=weights[j]*x[j];return layer.activation==='tanh'?Math.tanh(v):v;
      });}
      if(x.length!==4||x.some(v=>!Number.isFinite(v)))throw new Error('Invalid policy output');
      return x.map(v=>Math.max(-1,Math.min(1,v)));
    }
  }
  return RunnerPolicy;
});
