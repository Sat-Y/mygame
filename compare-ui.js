(() => {
  'use strict';
  const $=id=>document.getElementById(id),cards=[...document.querySelectorAll('.lane')];
  const labels={fall:'摔倒 · 已停止',finish:'到达终点',timeout:'60 秒结束',backward:'退出跑道'};
  let comparison,renderers=[],running=false,started=false,accumulator=0,last=0,speed=1;
  function reset(){comparison.reset(Number($('compareSeed').value));running=false;started=false;accumulator=0;$('play').disabled=false;$('pauseAll').disabled=true;$('pauseAll').textContent='暂停';$('compareSeed').disabled=false;update();}
  function start(){if(!comparison)return;if(comparison.done)reset();running=true;started=true;$('play').disabled=true;$('pauseAll').disabled=false;$('pauseAll').textContent='暂停';$('compareSeed').disabled=true;}
  function pause(){if(!started||comparison.done)return;running=!running;accumulator=0;$('pauseAll').textContent=running?'暂停':'继续';update();}
  function update(){
    if(!comparison)return;
    $('clock').innerHTML=comparison.time.toFixed(2)+' <small>s</small>';
    comparison.envs.forEach((env,i)=>{const card=cards[i];card.querySelector('.lane-distance strong').textContent=env.distance.toFixed(2);card.querySelector('.lane-time').textContent=env.time.toFixed(2)+' s';card.querySelector('.lane-speed').textContent=env.parts.torso.getLinearVelocity().x.toFixed(2)+' m/s';card.querySelector('.lane-state').textContent=env.done?labels[env.reason]:running?'运行中':started?'已暂停':'准备就绪';card.querySelector('progress').value=Math.max(0,Math.min(100,env.distance));card.classList.toggle('finished',env.reason==='finish');card.classList.toggle('failed',env.done&&env.reason!=='finish');renderers[i].draw();});
    $('exportCompare').disabled=comparison.ticks===0;
  }
  function tick(now){
    const elapsed=Math.min((now-last)/1000||0,.1);last=now;
    if(running){accumulator+=elapsed*speed;while(accumulator>=1/30&&!comparison.done){comparison.step();accumulator-=1/30;}
      if(comparison.done){running=false;accumulator=0;$('play').disabled=false;$('play').textContent='再对比一次';$('pauseAll').disabled=true;$('compareSeed').disabled=false;}}
    update();requestAnimationFrame(tick);
  }
  $('play').onclick=start;$('pauseAll').onclick=pause;$('restart').onclick=()=>{reset();$('play').textContent='同时开始';};
  $('compareSeed').onchange=()=>{const seed=Number($('compareSeed').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295){$('compareSeed').value=comparison?.seed??42;return;}if(comparison)reset();};
  $('playbackSpeed').onchange=()=>{speed=Number($('playbackSpeed').value);};
  document.addEventListener('keydown',e=>{if(e.target.matches('input,select,button')||!comparison)return;if(e.code==='Space'&&!e.repeat){e.preventDefault();started?pause():start();}else if(e.key.toLowerCase()==='r'&&!e.repeat)reset();});
  window.addEventListener('blur',()=>{if(running)pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
  $('exportCompare').onclick=()=>{const data=comparison.envs.map((e,i)=>({trainingStep:comparison.policies[i].data.timesteps,...e.info(),reason:e.reason||'in_progress',synchronizedTime:comparison.time}));const fields=['trainingStep','seed','assisted','distance','time','reason','synchronizedTime'];const csv='\uFEFF'+fields.join(',')+'\n'+data.map(r=>fields.map(k=>r[k]).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ppo-checkpoint-comparison.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  async function load(){
    try{
      const r=await fetch('models/checkpoints/manifest.json');if(!r.ok)throw new Error('检查点清单尚未就绪');const manifest=await r.json();
      if(manifest.environment!==RunnerEnvironment.VERSION||manifest.assisted!==false)throw new Error('模型环境不一致');
      const policies=await Promise.all(manifest.checkpoints.map(async entry=>{const response=await fetch('models/checkpoints/'+entry.policy);if(!response.ok)throw new Error('检查点文件缺失');return response.json();}));
      comparison=new RunnerComparison(policies,42);renderers=cards.map((card,i)=>new RunnerRenderer(card.querySelector('canvas'),comparison.envs[i]));
      $('loadStatus').textContent='四个检查点已加载 · 相同种子、30 Hz 控制频率 · 结束的跑道会保留最终成绩';
      $('runIdentity').textContent=`训练批次 ${manifest.run} · 训练种子 ${manifest.seed} · 0 / 100,000 / 500,000 / 1,000,000 step`;
      $('compareSeed').value=42;$('playbackSpeed').value='1';$('restart').disabled=false;reset();requestAnimationFrame(tick);
    }catch(error){$('loadStatus').textContent='无法加载对照模型：'+error.message+'。完成训练后刷新重试。';$('loadStatus').classList.add('error');}
  }
  load();
})();
