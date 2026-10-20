/* Shared presentation only; it never modifies the simulation. */
window.RunnerRenderer=class RunnerRenderer {
  constructor(canvas,env){
    this.canvas=canvas;this.env=env;this.ctx=canvas.getContext('2d');this.camera=0;
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);
    this.ctx.setTransform(dpr,0,0,dpr,0,0);this.draw();
  }
  draw(){
    const {env,ctx,width,height}=this;
    if(!width||!height)return;
    if(env.steps===0)this.camera=0;
  function line(points,color,size){ctx.strokeStyle=color;ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}


    const groundY=height*.77,scale=height*.265;
    const target=env.parts.torso.getPosition().x;this.camera+=((Math.max(0,target-.25))-this.camera)*.12;
    const origin=width<600?width*.29:width*.34;
    const pt=p=>({x:origin+(p.x-this.camera)*scale,y:groundY-p.y*scale});
    ctx.clearRect(0,0,width,height);ctx.fillStyle='#dcebf2';ctx.fillRect(0,0,width,height);
    // Stadium tiers, muted enough to keep the athlete and timing readable.
    ctx.fillStyle='#cbdfe9';ctx.beginPath();ctx.moveTo(0,groundY-62);ctx.lineTo(width,groundY-108);ctx.lineTo(width,groundY);ctx.lineTo(0,groundY);ctx.fill();
    ctx.strokeStyle='#bdd3df';ctx.lineWidth=1;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(0,groundY-45+i*12);ctx.lineTo(width,groundY-87+i*17);ctx.stroke();}
    ctx.fillStyle='#afc8d4';ctx.fillRect(0,groundY-15,width,15);
    ctx.fillStyle='#3373c5';ctx.fillRect(0,groundY,width,height-groundY);
    ctx.fillStyle='#245cad';ctx.fillRect(0,groundY+47,width,height-groundY-47);
    ctx.strokeStyle='#79a4dc';ctx.lineWidth=1;for(const y of [groundY+22,groundY+47]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,groundY);ctx.lineTo(width,groundY);ctx.stroke();
    const low=Math.floor(this.camera-origin/scale)-1,high=Math.ceil(this.camera+(width-origin)/scale)+1;
    ctx.font='11px Consolas, monospace';ctx.textAlign='center';
    for(let m=low;m<=high;m++){
      const x=pt({x:m,y:0}).x;ctx.strokeStyle=m===0?'#ffffff':'#9abbdf';ctx.lineWidth=m===0?3:1;ctx.beginPath();ctx.moveTo(x,groundY);ctx.lineTo(x-15,groundY+47);ctx.stroke();
      if(m>=0){ctx.fillStyle='#eaf3ff';ctx.fillText(m===0?'START':m+' m',x-7,groundY+39);}
    }
    // The mesh is drawn from actual rigid body positions, never a prerecorded gait.
    const torso=env.parts.torso,hip=pt(torso.getWorldPoint(planck.Vec2(0,-.36))),shoulder=pt(torso.getWorldPoint(planck.Vec2(0,.25))),head=pt(torso.getWorldPoint(planck.Vec2(0,.55)));
    ctx.fillStyle='#17395622';ctx.beginPath();ctx.ellipse(hip.x,groundY+5,scale*.42,5,0,0,Math.PI*2);ctx.fill();
    function leg(i,back){
      const thigh=env.parts['thigh'+i],shin=env.parts['shin'+i];
      const h=pt(thigh.getWorldPoint(planck.Vec2(0,.245))),k=pt(thigh.getWorldPoint(planck.Vec2(0,-.245))),a=pt(shin.getWorldPoint(planck.Vec2(0,-.245))),toe=pt(shin.getWorldPoint(planck.Vec2(.19,-.245))),heel=pt(shin.getWorldPoint(planck.Vec2(-.065,-.245)));
      line([h,k],back?'#914d3a':'#ef8657',scale*.13);line([k,a],back?'#aa7258':'#f1b38c',scale*.095);
      line([heel,toe],back?'#203d50':'#153145',scale*.08);line([a,{x:a.x+(k.x-a.x)*.18,y:a.y+(k.y-a.y)*.18}],back?'#b9ccd6':'#f3f6f3',scale*.105);
      ctx.fillStyle=back?'#c28b69':'#ffcfab';ctx.beginPath();ctx.arc(k.x,k.y,scale*.054,0,Math.PI*2);ctx.fill();
    }
    leg(1,true);
    // Arms are visual only: their pose follows the measured hip angle.
    const swing=env.joints[0].getJointAngle();
    line([shoulder,{x:shoulder.x-scale*.20,y:shoulder.y+scale*.27},{x:shoulder.x+scale*(.02+swing*.12),y:shoulder.y+scale*.4}],'#ac785d',scale*.085);
    line([hip,shoulder],'#ec7445',scale*.29);
    line([{x:hip.x-2,y:hip.y-4},{x:hip.x+(shoulder.x-hip.x)*.24,y:hip.y+(shoulder.y-hip.y)*.24}],'#183c57',scale*.30);
    leg(0,false);
    line([shoulder,{x:shoulder.x+scale*(.16+swing*.1),y:shoulder.y+scale*.27},{x:shoulder.x+scale*(.40+swing*.1),y:shoulder.y+scale*.12}],'#efb18b',scale*.09);
    line([shoulder,{x:head.x,y:head.y+scale*.08}],'#efb18b',scale*.095);
    ctx.fillStyle='#f0b990';ctx.beginPath();ctx.arc(head.x,head.y,scale*.137,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#233d4b';ctx.beginPath();ctx.arc(head.x-1,head.y-3,scale*.14,Math.PI*.95,Math.PI*1.95);ctx.fill();
    ctx.fillStyle='#294454';ctx.beginPath();ctx.arc(head.x+scale*.085,head.y-1,1.7,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff3dd';ctx.save();ctx.translate((hip.x+shoulder.x)/2,(hip.y+shoulder.y)/2);ctx.rotate(-torso.getAngle());ctx.fillRect(-scale*.09,-scale*.08,scale*.18,scale*.14);ctx.fillStyle='#1c4153';ctx.font=`bold ${Math.max(9,scale*.1)}px sans-serif`;ctx.fillText('07',0,scale*.025);ctx.restore();
    if(env.assisted){ctx.setLineDash([3,5]);line([{x:shoulder.x,y:shoulder.y-scale*.13},{x:shoulder.x,y:shoulder.y-scale*.42}],'#728e9e',1);ctx.setLineDash([]);}
  
  }
};
