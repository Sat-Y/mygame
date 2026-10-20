"""Train real PPO; periodically evaluate held-out validation seeds and export actor."""
import argparse
import json
from pathlib import Path
import time
import numpy as np
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.logger import configure
from runner_env import RunnerVecEnv, ROOT

SCALE = [1,.2,.25,.25,1,1,1,1,1,.2,.2,.2,.2,1,1]

def export_actor(model, path):
    layers = []
    for layer in list(model.policy.mlp_extractor.policy_net) + [model.policy.action_net]:
        if isinstance(layer, torch.nn.Linear):
            layers.append({'weight': layer.weight.detach().cpu().tolist(),
                           'bias': layer.bias.detach().cpu().tolist()})
        elif isinstance(layer, torch.nn.Tanh):
            layers[-1]['activation'] = 'tanh'
    data = {'algorithm': 'PPO', 'environment': 'flat-v2', 'assisted': False,
            'timesteps': model.num_timesteps, 'observationScale': SCALE,
            'observationClip': 10, 'actionFrames': 4, 'layers': layers}
    path.write_text(json.dumps(data), encoding='utf-8')

def evaluate(model, env, seed=100000):
    env.seed(seed)
    obs = env.reset()
    finished = {}
    while len(finished) < env.num_envs:
        action, _ = model.predict(obs, deterministic=True)
        obs, _, dones, infos = env.step(action)
        for i, done in enumerate(dones):
            if done and i not in finished:
                finished[i] = infos[i]
    return list(finished.values())

class Progress(BaseCallback):
    def __init__(self, folder, frequency=65536):
        super().__init__()
        self.folder, self.frequency = folder, frequency
        self.next_check = frequency
        self.best = -float('inf')
        self.history = []
        self.started = time.monotonic()
        self.eval_env = RunnerVecEnv(4, 100000)

    def _on_step(self):
        if self.num_timesteps < self.next_check:
            return True
        self.next_check += self.frequency
        episodes = evaluate(self.model, self.eval_env)
        distance = float(np.mean([r['distance'] for r in episodes]))
        survival = float(np.mean([r['time'] for r in episodes]))
        row = {'steps': self.num_timesteps, 'distance': distance, 'survival': survival,
               'fallRate': float(np.mean([r['reason'] == 'fall' for r in episodes])),
               'wallSeconds': round(time.monotonic()-self.started, 1)}
        self.history.append(row)
        (self.folder / 'validation.json').write_text(json.dumps(self.history, indent=2), encoding='utf-8')
        self.model.save(self.folder / 'latest.zip')
        score = float(np.mean([min(r['distance'],100)-(.01*r['time'] if r['reason']=='finish' else 0) for r in episodes]))
        if score > self.best:
            self.best = score
            self.model.save(self.folder / 'best.zip')
            export_actor(self.model, self.folder / 'policy.json')
        print('VALIDATION ' + json.dumps(row), flush=True)
        return True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--steps', type=int, default=1000000)
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--envs', type=int, default=16)
    parser.add_argument('--run', default='flat-ppo-01')
    parser.add_argument('--resume')
    args = parser.parse_args()
    torch.set_num_threads(2)
    folder = ROOT / 'training' / 'runs' / args.run
    folder.mkdir(parents=True, exist_ok=True)
    (folder/'config.json').write_text(json.dumps(vars(args), indent=2), encoding='utf-8')
    env = RunnerVecEnv(args.envs, args.seed)
    callback = Progress(folder)
    try:
        if args.resume:
            model = PPO.load(args.resume, env=env, device='cpu')
            callback.next_check = model.num_timesteps + callback.frequency
        else:
            model = PPO('MlpPolicy', env, learning_rate=3e-4, n_steps=256,
                        batch_size=256, n_epochs=5, gamma=.995, gae_lambda=.95,
                        ent_coef=.005, clip_range=.2,
                        policy_kwargs={'net_arch':dict(pi=[64,64],vf=[64,64]), 'log_std_init':-.5},
                        seed=args.seed, device='cpu', verbose=0)
        model.set_logger(configure(str(folder), ['csv']))
        if not args.resume:
            export_actor(model, folder/'untrained-policy.json')
        print(f'Training PPO for {args.steps} transitions on {args.envs} worlds; no assistance.', flush=True)
        model.learn(args.steps, callback=callback, reset_num_timesteps=not bool(args.resume))
        model.save(folder/'final.zip')
        export_actor(model, folder/'final-policy.json')
        if not (folder/'policy.json').exists():
            model.save(folder/'best.zip')
            export_actor(model, folder/'policy.json')
        print('SAVED '+str(folder), flush=True)
    finally:
        env.close()
        callback.eval_env.close()

if __name__ == '__main__':
    main()
