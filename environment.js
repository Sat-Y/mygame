/* Shared deterministic physics: browser and Node use the SAME environment. */
(function(root, factory){
  if(typeof module === 'object' && module.exports) module.exports = factory(require('planck'));
  else root.RunnerEnvironment = factory(root.planck);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(pl){
  'use strict';
  const V=pl.Vec2, DT=1/120, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class RunnerEnvironment {
    constructor(options={}) {this.reset(options);}
    reset({seed=42, assisted=false}={}) {
      this.seed=seed>>>0;this.randomState=this.seed;this.assisted=!!assisted;
      this.time=0;this.steps=0;this.done=false;this.reason=null;this.totalReward=0;this.maxDistance=0;this.actions=[0,0,0,0];
      this.world=new pl.World(V(0,-9.81));this.parts={};this.joints=[];
      this.ground=this.world.createBody();this.ground.createFixture(pl.Edge(V(-100,0),V(1000,0)),{friction:0.9});
      const body=(name,x,y,angle,hx,hy,density) => {
        const b=this.world.createDynamicBody({position:V(x,y),angle,angularDamping:0.12,linearDamping:0.02,allowSleep:false});
        b.createFixture(pl.Box(hx,hy),{density,friction:0.85,restitution:0,filterGroupIndex:-1});b.setUserData(name);this.parts[name]=b;return b;
      };
      const lean=(this.random()-.5)*.025;
      const hip=V(0,1.12);
      const torso=body('torso',0,1.48,lean,.15,.36,8);
      torso.createFixture(pl.Circle(V(0,.55),.14),{density:3,filterGroupIndex:-1});
      for(let i=0;i<2;i++){
        const a=i===0?-.24:.22, kneeAngle=i===0?-.12:-.20;
        const end=(p,a,l)=>V(p.x+Math.sin(a)*l,p.y-Math.cos(a)*l);
        const knee=end(hip,a,.49), ankle=end(knee,a+kneeAngle,.49);
        const thigh=body('thigh'+i,(hip.x+knee.x)/2,(hip.y+knee.y)/2,a,.065,.245,5);
        const shin=body('shin'+i,(knee.x+ankle.x)/2,(knee.y+ankle.y)/2,a+kneeAngle,.05,.245,4);
        shin.createFixture(pl.Box(.13,.045,V(.065,-.245)),{density:2,friction:1.1,filterGroupIndex:-1});
        const hj=this.world.createJoint(pl.RevoluteJoint({enableLimit:true,lowerAngle:-1.0,upperAngle:1.0,referenceAngle:0,enableMotor:true,maxMotorTorque:32},torso,thigh,hip));
        const kj=this.world.createJoint(pl.RevoluteJoint({enableLimit:true,lowerAngle:-1.65,upperAngle:.08,referenceAngle:0,enableMotor:true,maxMotorTorque:22},thigh,shin,knee));
        this.joints[i]=hj;this.joints[2+i]=kj;
      }
      this.startX=torso.getPosition().x;
      this.fallenContact=false;
      this.world.on('begin-contact',contact=>{
        const a=contact.getFixtureA().getBody(),b=contact.getFixtureB().getBody();
        if((a===this.ground&&b===torso)||(b===this.ground&&a===torso)) this.fallenContact=true;
      });
      return this.observe();
    }
    random(){this.randomState=(1664525*this.randomState+1013904223)>>>0;return this.randomState/4294967296;}
    get distance(){return this.parts.torso.getPosition().x-this.startX;}
    feet(){return [0,1].map(i=>this.parts['shin'+i].getWorldPoint(V(.065,-.29)));}
    observe(){
      const b=this.parts.torso,v=b.getLinearVelocity();
      return [b.getAngle(),b.getAngularVelocity(),v.x,v.y,b.getPosition().y,...this.joints.map(j=>j.getJointAngle()),...this.joints.map(j=>j.getJointSpeed()),...this.feet().map(p=>p.y<.07?1:0)];
    }
    ruleAction(){
      const phase=this.time*5.4;
      return [Math.sin(phase)*.85,Math.sin(phase+Math.PI)*.85,Math.sin(phase-1),Math.sin(phase+Math.PI-1)];
    }
    randomAction(){return [0,0,0,0].map(()=>this.random()*2-1);}
    step(action=[0,0,0,0],frames=4){
      if(!Array.isArray(action)||action.length!==4||action.some(v=>!Number.isFinite(v))) throw new TypeError('action must contain 4 finite numbers');
      if(!Number.isInteger(frames)||frames<1||frames>120) throw new RangeError('frames must be an integer from 1 to 120');
      if(this.done) return {observation:this.observe(),reward:0,terminated:this.reason!=='timeout',truncated:this.reason==='timeout',info:this.info()};
      this.actions=action.map(v=>clamp(v,-1,1));let reward=0;
      for(let n=0;n<frames&&!this.done;n++){
        const previous=this.distance;
        const targets=[this.actions[0]*.8,this.actions[1]*.8,-.65+this.actions[2]*.65,-.65+this.actions[3]*.65];
        this.joints.forEach((j,i)=>j.setMotorSpeed(clamp((targets[i]-j.getJointAngle())*9,-7,7)));
        if(this.assisted){
          const b=this.parts.torso,p=b.getPosition(),v=b.getLinearVelocity();
          // Explicit practice-only virtual harness. Never active in standard trials.
          b.applyTorque(clamp(-b.getAngle()*65-b.getAngularVelocity()*12,-45,45),true);
          b.applyForceToCenter(V(0,clamp((1.48-p.y)*140-v.y*20,0,70)),true);
        }
        this.world.step(DT,8,4);this.time+=DT;this.steps++;
        this.maxDistance=Math.max(this.maxDistance,this.distance);
        // v2: forward progress plus a small upright survival reward. No external
        // support is applied in standard mode. Terminate collapsed/crawling poses.
        const torso=this.parts.torso;
        reward+=3*(this.distance-previous)+DT*(.3*Math.cos(torso.getAngle())-.01*this.actions.reduce((s,v)=>s+v*v,0));
        if(this.fallenContact||torso.getPosition().y<.8||Math.abs(torso.getAngle())>1.3){this.done=true;this.reason='fall';reward-=2;}
        else if(this.distance>=100){this.done=true;this.reason='finish';reward+=10;}
        else if(this.time>=60){this.done=true;this.reason='timeout';}
        else if(this.distance< -5){this.done=true;this.reason='backward';}
      }
      this.totalReward+=reward;
      return {observation:this.observe(),reward,terminated:this.done&&this.reason!=='timeout',truncated:this.reason==='timeout',info:this.info()};
    }
    info(){return {seed:this.seed,assisted:this.assisted,time:this.time,distance:this.distance,maxDistance:this.maxDistance,steps:this.steps,reason:this.reason,totalReward:this.totalReward};}
  }
  RunnerEnvironment.DT=DT;
  RunnerEnvironment.VERSION='flat-v2';
  RunnerEnvironment.OBS_SCALE=[1,.2,.25,.25,1,1,1,1,1,.2,.2,.2,.2,1,1];
  return RunnerEnvironment;
});
