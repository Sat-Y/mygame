"""Verify that each original SB3 zip and portable JSON agree on counter and actions."""
import json
import subprocess
import unittest
import numpy as np
import torch
from stable_baselines3 import PPO
from runner_env import ROOT
from train import SCALE

class Checkpoints(unittest.TestCase):
    def test_saved_models_and_exported_actions(self):
        torch.set_num_threads(1)
        manifest=json.loads((ROOT/'models/checkpoints/manifest.json').read_text())
        code="const E=require('./environment'),P=require('./policy');const e=new E({seed:42});const obs=[];for(let i=0;i<15;i++){obs.push(e.observe());e.step(e.ruleAction(),4)}const data=require('./'+process.argv[1]);const p=new P(data);console.log(JSON.stringify({obs,actions:obs.map(o=>p.predict(o))}));"
        for entry in manifest['checkpoints']:
            model=PPO.load(ROOT/'models/checkpoints'/entry['model'],device='cpu')
            self.assertEqual(model.num_timesteps,entry['step'])
            self.assertEqual(model._n_updates,(entry['step']//4000)*5)
            result=json.loads(subprocess.check_output(['node','-e',code,'models/checkpoints/'+entry['policy']],cwd=ROOT,text=True))
            obs=np.clip(np.asarray(result['obs'])*np.asarray(SCALE),-10,10).astype(np.float32)
            expected=model.predict(obs,deterministic=True)[0]
            np.testing.assert_allclose(result['actions'],expected,atol=2e-5)

if __name__=='__main__':unittest.main()
