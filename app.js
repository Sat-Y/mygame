/* The page drives the same environment.step API used by headless experiments. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('game');
  if(!window.RunnerEnvironment){$('status').textContent='物理引擎加载失败，请先运行 npm install';return;}
  const env=new RunnerEnvironment({seed:42,assisted:true});
  let policy=null;
  const controllerNames={manual:'手动',rule:'固定规则',random:'随机策略',ppo:'PPO 智能体'};
  const runningLabel=()=>controller==='manual'?'跑步中':controllerNames[controller]+'运行中';
  let running=false,started=false,recorded=false,seed=42,controller='manual',last=0,accumulator=0;
  let best={practice:0,standard:0};
  const keys=new Set(),rows=[];
  // Browsers can restore form values after reload independently of JS state.
  // Always establish one explicit controller state for a fresh page session.
  window.addEventListener('pageshow',()=>{$('controller').value=controller;$('seedInput').value=seed;});
  const reasonText={fall:'摔倒',finish:'到达终点',timeout:'60 秒结束',backward:'退离跑道',reset:'手动重置',switch:'切换设置'};
  const renderer=new RunnerRenderer(canvas,env);
  function save(reason){
    if(recorded||!started||env.steps===0)return;
    recorded=true;rows.push({...env.info(),reason,controller,episode:rows.length+1});
    const mode=env.assisted?'practice':'standard';best[mode]=Math.max(best[mode],env.maxDistance);
    $('records').innerHTML=rows.slice(-8).reverse().map(r=>`<tr><td>${String(r.episode).padStart(2,'0')}</td><td>${r.assisted?'辅助练习':'标准挑战'} / ${controllerNames[r.controller]}</td><td>${r.distance.toFixed(2)} m</td><td>${r.time.toFixed(2)} s</td><td>${reasonText[r.reason]}</td><td>${r.seed}</td></tr>`).join('');$('export').disabled=false;
  }
  function reset(reason='reset'){
    save(reason);keys.clear();env.reset({seed,assisted:env.assisted});running=false;started=false;recorded=false;accumulator=0;
    $('result').hidden=true;$('startHint').hidden=false;$('pause').disabled=true;$('pause').innerHTML='暂停 <kbd>空格</kbd>';$('start').disabled=false;
    $('status').textContent='准备就绪';$('seedLabel').textContent=seed;update();draw();
  }
  function start(){if(controller==='ppo'&&!policy)return;if(env.done)reset();running=true;started=true;$('startHint').hidden=true;$('start').disabled=true;$('pause').disabled=false;$('pause').innerHTML='暂停 <kbd>空格</kbd>';$('status').textContent=runningLabel();}
  function pause(){if(!started||env.done)return;running=!running;keys.clear();accumulator=0;$('pause').innerHTML=running?'暂停 <kbd>空格</kbd>':'继续 <kbd>空格</kbd>';$('status').textContent=running?runningLabel():'已暂停';update();}
  function finish(){running=false;keys.clear();save(env.reason);$('pause').disabled=true;$('start').disabled=false;$('result').hidden=false;$('resultTitle').textContent=env.reason==='finish'?'100 米，完成！':'这一步，值得再试。';$('resultDistance').textContent=env.distance.toFixed(2)+' m';$('resultText').textContent=`${reasonText[env.reason]} · ${env.time.toFixed(2)} 秒 · ${env.assisted?'辅助练习':'标准挑战'}`;$('status').textContent=reasonText[env.reason];}
  function update(){
    const o=env.observe();$('distance').textContent=env.distance.toFixed(2);$('time').innerHTML=env.time.toFixed(2)+' <small>s</small>';$('speed').innerHTML=o[2].toFixed(2)+' <small>m/s</small>';$('angle').innerHTML=(o[0]*180/Math.PI).toFixed(1)+' <small>°</small>';$('best').innerHTML=Math.max(best[env.assisted?'practice':'standard'],env.maxDistance).toFixed(2)+' <small>m</small>';
    $('leftContact').classList.toggle('on',!!o[13]);$('rightContact').classList.toggle('on',!!o[14]);
    document.querySelectorAll('.key').forEach(b=>b.classList.toggle('active',keys.has(b.dataset.key)));
    $('statusDot').style.background=env.done?'#b35836':running?'#2e8768':'#667d8b';
  }
  function action(){if(controller==='ppo')return policy.predict(env.observe());if(controller==='random')return env.randomAction();return controller==='rule'?env.ruleAction():['q','w','o','p'].map(k=>keys.has(k)?1:-1);}
  function draw(){renderer.draw();}
  function tick(now){
    const elapsed=Math.min((now-last)/1000||0,0.1);last=now;
    if(running){accumulator+=elapsed;while(accumulator>=1/30&&running){env.step(action(),4);accumulator-=1/30;if(env.done)finish();}}
    update();draw();requestAnimationFrame(tick);
  }
  $('start').onclick=start;$('pause').onclick=pause;$('reset').onclick=()=>reset();$('retry').onclick=()=>{reset();start();};
  function mode(assisted){if(env.assisted===assisted)return;reset('switch');env.reset({seed,assisted});$('practice').classList.toggle('selected',assisted);$('standard').classList.toggle('selected',!assisted);$('practice').setAttribute('aria-pressed',String(assisted));$('standard').setAttribute('aria-pressed',String(!assisted));$('modeTag').textContent=assisted?'平衡辅助开启':'无外部平衡辅助';$('physicsLabel').textContent=assisted?'辅助练习 · 含虚拟平衡支撑':'标准挑战 · 重力 / 关节 / 接触';update();draw();}
  $('practice').onclick=()=>mode(true);$('standard').onclick=()=>mode(false);
  $('controller').onchange=()=>{reset('switch');controller=$('controller').value;if(controller==='ppo')mode(false);$('practice').disabled=controller==='ppo';$('controlHint').textContent=controller==='manual'?'交替尝试 Q + P、W + O。按住持续发力，松开回位。':controller==='ppo'?'模型每秒读取 30 次身体状态，输出四个关节动作。无外部平衡辅助。':'基线策略演示，不使用训练模型。可切换标准挑战进行同条件对照。';document.querySelectorAll('.key').forEach(b=>b.disabled=controller!=='manual');};
  $('seedInput').onchange=()=>{const value=Number($('seedInput').value);if(!Number.isInteger(value)||value<0||value>4294967295){$('seedInput').value=seed;return;}reset('switch');seed=value;env.reset({seed,assisted:env.assisted});$('seedLabel').textContent=seed;};
  function press(k){if(controller!=='manual'||env.done)return;if(!started)start();if(running)keys.add(k);}
  document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||((e.code==='Space'||e.code==='Enter')&&e.target.matches('button')))return;const k=e.key.toLowerCase();if(['q','w','o','p'].includes(k)){e.preventDefault();press(k);}else if(k==='r'&&!e.repeat){e.preventDefault();reset();}else if(e.code==='Space'&&!e.repeat){e.preventDefault();pause();}});
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.querySelectorAll('.key').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);press(b.dataset.key);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(b.dataset.key));});
  window.addEventListener('blur',()=>{keys.clear();if(running)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
  $('export').onclick=()=>{const fields=['episode','seed','assisted','controller','distance','maxDistance','time','reason','steps','totalReward'];const csv='\uFEFF'+fields.join(',')+'\n'+rows.map(r=>fields.map(k=>r[k]).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='stride-lab-episodes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  // Intentionally expose a fresh independent environment factory, not the active UI state.
  window.createRunnerEnvironment=options=>new RunnerEnvironment(options);
  async function loadModel(){
    try{
      const r=await fetch('models/policy.json');if(!r.ok)throw new Error('model missing');const data=await r.json();policy=new RunnerPolicy(data);
      $('ppoOption').disabled=false;$('ppoOption').textContent='PPO 智能体（已训练）';
      $('modelStatus').textContent=`已加载 PPO · ${data.timesteps.toLocaleString()} 步训练 · 4 关节状态反馈控制 · 无平衡辅助`;
    }catch(e){$('ppoOption').textContent='PPO 模型未就绪';$('modelStatus').textContent='模型未加载。请通过 npm start 打开页面，并完成训练与模型导出。';return;}
    try{
      const [er,hr]=await Promise.all([fetch('models/evaluation.json'),fetch('models/validation.json')]);
      if(!er.ok||!hr.ok)throw new Error('evaluation missing');const evaluation=await er.json(),history=await hr.json();
      $('evaluationRows').innerHTML=evaluation.summary.map(r=>`<tr><td>${controllerNames[r.controller]}</td><td>${r.distanceMean.toFixed(2)} ± ${r.distanceStd.toFixed(2)} m</td><td>${(r.fallRate*100).toFixed(0)}%</td></tr>`).join('');
      $('evalNote').textContent=`每种策略 ${evaluation.summary[0].episodes} 局，测试种子 ${evaluation.seedStart} 起。单次训练的可行性结果，尚非多训练种子结论。`;
      const chart=$('learningCurve'),c=chart.getContext('2d');
      function plot(){const w=chart.clientWidth,h=160,dpr=Math.min(devicePixelRatio||1,2);chart.width=w*dpr;chart.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);if(!history.length)return;
        const maxX=Math.max(...history.map(r=>r.steps)),minY=Math.min(0,...history.map(r=>r.distance)),maxY=Math.max(1,...history.map(r=>r.distance));
        c.font='10px sans-serif';c.textAlign='right';for(let i=0;i<4;i++){const y=14+i*37;c.strokeStyle='#dce4e9';c.beginPath();c.moveTo(35,y);c.lineTo(w-12,y);c.stroke();c.fillStyle='#526775';c.fillText((maxY-(maxY-minY)*i/3).toFixed(1),29,y+3);}
        c.strokeStyle='#175bdd';c.lineWidth=2;c.beginPath();history.forEach((r,i)=>{const x=35+r.steps/maxX*(w-47),y=14+(maxY-r.distance)/(maxY-minY)*111;i?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();c.fillStyle='#526775';c.textAlign='left';c.fillText('0 步',35,150);c.textAlign='right';c.fillText(maxX.toLocaleString()+' 步',w-12,150);}
      new ResizeObserver(plot).observe(chart);plot();
    }catch(e){$('evalNote').textContent='评估报告尚未加载；当前可试玩模型，但不能据此判断统计效果。';}
  }
  loadModel();
  draw();requestAnimationFrame(tick);
})();
