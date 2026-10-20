"""Small integration test for VecEnv timeout/terminal bookkeeping and SB3 export."""
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
import numpy as np
import torch
from stable_baselines3 import PPO
from runner_env import RunnerVecEnv, ROOT
from train import export_actor

class Integration(unittest.TestCase):
    def test_bridge_and_actor(self):
        torch.set_num_threads(1)
        env = RunnerVecEnv(2, 7)
        try:
            obs = env.reset()
            self.assertEqual(obs.shape, (2, 15))
            saw_done = False
            for _ in range(120):
                obs, rewards, dones, infos = env.step(np.zeros((2,4)))
                self.assertTrue(np.isfinite(obs).all())
                for done, info in zip(dones, infos):
                    if done:
                        saw_done = True
                        self.assertEqual(info['terminal_observation'].shape, (15,))
                        self.assertIn('episode', info)
            self.assertTrue(saw_done)
            model = PPO('MlpPolicy', env, n_steps=8, batch_size=16, n_epochs=1, seed=7)
            model.learn(32)
            expected = model.predict(obs, deterministic=True)[0]
            # Pass raw observations to JS; observation scaling must match Python.
            scale=np.array([1,.2,.25,.25,1,1,1,1,1,.2,.2,.2,.2,1,1])
            with tempfile.TemporaryDirectory() as directory:
                target=Path(directory)/'actor.json'
                export_actor(model,target)
                code="const P=require('./policy.js');const fs=require('fs');const p=new P(JSON.parse(fs.readFileSync(process.argv[1])));console.log(JSON.stringify(JSON.parse(process.argv[2]).map(o=>p.predict(o))));"
                output=subprocess.check_output(['node','-e',code,str(target),json.dumps((obs/scale).tolist())],cwd=ROOT,text=True)
                np.testing.assert_allclose(json.loads(output),expected,atol=2e-6)
        finally:
            env.close()

if __name__=='__main__': unittest.main()
