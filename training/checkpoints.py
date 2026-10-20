"""One uninterrupted PPO run, exact post-update checkpoints for synchronized playback."""
import argparse
import hashlib
import json
import shutil
import time
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.logger import configure
from runner_env import ROOT, RunnerVecEnv
from train import export_actor

MILESTONES = (0, 100000, 500000, 1000000)

class MilestonePPO(PPO):
    def save_milestone(self):
        step = self.num_timesteps
        self.save(self.checkpoint_dir / f'step-{step}.zip')
        export_actor(self, self.checkpoint_dir / f'step-{step}.json')
        print(f'CHECKPOINT {step} transitions, optimizer updates={self._n_updates}', flush=True)

    def train(self):
        super().train()
        if self.num_timesteps in MILESTONES:
            self.save_milestone()
        elif self.num_timesteps % 100000 == 0:
            print(f'PROGRESS {self.num_timesteps}', flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--run', default='flat-checkpoints-01')
    parser.add_argument('--seed', type=int, default=7)
    args = parser.parse_args()
    folder = ROOT / 'training' / 'runs' / args.run
    if folder.exists():
        raise SystemExit('Run already exists. Choose another --run to preserve checkpoint history.')
    folder.mkdir(parents=True)
    torch.set_num_threads(2)
    env = RunnerVecEnv(16, args.seed)
    started = time.monotonic()
    config = dict(run=args.run, seed=args.seed, envs=16, n_steps=250, batch_size=250,
                  n_epochs=5, steps=1000000, milestones=list(MILESTONES),
                  checkpointTiming='after PPO update on the complete rollout',
                  stepUnit='aggregate environment transitions across 16 environments',
                  assisted=False, environment='flat-v2')
    (folder/'config.json').write_text(json.dumps(config, indent=2), encoding='utf-8')
    try:
        # 250 * 16 = 4000 transitions/rollout; every requested milestone is exact.
        model = MilestonePPO('MlpPolicy', env, learning_rate=3e-4, n_steps=250,
                            batch_size=250, n_epochs=5, gamma=.995, gae_lambda=.95,
                            ent_coef=.005, clip_range=.2,
                            policy_kwargs={'net_arch':dict(pi=[64,64],vf=[64,64]), 'log_std_init':-.5},
                            seed=args.seed, device='cpu', verbose=0)
        model.checkpoint_dir = folder
        model.set_logger(configure(str(folder), ['csv']))
        model.save_milestone()
        model.learn(total_timesteps=1000000)
        if model.num_timesteps != 1000000:
            raise RuntimeError('Milestone alignment failed')
        destination = ROOT/'models'/'checkpoints'
        destination.mkdir(parents=True, exist_ok=True)
        entries=[]
        for step in MILESTONES:
            source=folder/f'step-{step}.json'
            data=json.loads(source.read_text(encoding='utf-8'))
            if data['timesteps'] != step:
                raise RuntimeError('Mislabeled checkpoint')
            for extension in ['json','zip']:
                shutil.copy2(folder/f'step-{step}.{extension}',destination/f'step-{step}.{extension}')
            entries.append({'step':step, 'policy':f'step-{step}.json', 'model':f'step-{step}.zip',
                            'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
        manifest={**config, 'wallSeconds':round(time.monotonic()-started,1),
                  'environmentSHA256':hashlib.sha256((ROOT/'environment.js').read_bytes()).hexdigest(),
                  'checkpoints':entries}
        (destination/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
        print('COMPLETE '+json.dumps(manifest),flush=True)
    finally:
        env.close()

if __name__=='__main__':main()
