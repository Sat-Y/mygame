"""Select with validation seeds, export local assets, then run frozen tests."""
import argparse
import hashlib
import json
import shutil
import subprocess
import torch
from stable_baselines3 import PPO
from runner_env import ROOT, RunnerVecEnv
from train import evaluate, export_actor

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--run',default='flat-ppo-01')
    args=parser.parse_args()
    folder=ROOT/'training'/'runs'/args.run
    target=ROOT/'models'
    target.mkdir(exist_ok=True)
    torch.set_num_threads(2)
    env=RunnerVecEnv(4,100000)
    candidates=[]
    try:
        for name in ['best','final']:
            file=folder/f'{name}.zip'
            if not file.exists():continue
            model=PPO.load(file,device='cpu')
            rows=evaluate(model,env)
            # Cap finish distance to remove physical-step overshoot as a selection bias.
            score=sum(min(r['distance'],100)-(.01*r['time'] if r['reason']=='finish' else 0) for r in rows)/len(rows)
            candidates.append((score,name,model,rows))
        score,name,model,rows=max(candidates,key=lambda item:item[0])
        export_actor(model,target/'policy.json')
        shutil.copy2(folder/f'{name}.zip',target/'ppo-flat.zip')
        shutil.copy2(folder/'validation.json',target/'validation.json')
        metadata={'run':args.run,'selectedCheckpoint':name,'selectedSteps':model.num_timesteps,
                  'validationSeeds':[100000+i*1009 for i in range(4)],'selectionScore':score,
                  'selectionRule':'mean(min(distance,100) - 0.01*time for finish; distance otherwise)',
                  'environmentSHA256':hashlib.sha256((ROOT/'environment.js').read_bytes()).hexdigest(),
                  'policySHA256':hashlib.sha256((target/'policy.json').read_bytes()).hexdigest(),
                  'validationEpisodes':[{k:v for k,v in row.items() if k!='terminal_observation'} for row in rows],'trainingConfig':json.loads((folder/'config.json').read_text()),
                  'scope':'single training seed; flat ground; initial torso perturbation only; not stairs/general robustness'}
        (target/'metadata.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
        print(f'Selected {name} at {model.num_timesteps} steps on validation seeds.',flush=True)
    finally:env.close()
    subprocess.run(['node','training/evaluate.cjs',str(target/'policy.json'),str(target)],cwd=ROOT,check=True)

if __name__=='__main__':main()
