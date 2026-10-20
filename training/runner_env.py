"""SB3 VecEnv over the exact JavaScript physics used in the web game."""
import json
import os
from pathlib import Path
import subprocess
import numpy as np
from gymnasium import spaces
from stable_baselines3.common.vec_env import VecEnv

ROOT = Path(__file__).resolve().parents[1]

class RunnerVecEnv(VecEnv):
    def __init__(self, count=16, seed=0):
        self.render_mode = None
        self.initial_seed = seed
        self.proc = subprocess.Popen(
            ['node', str(ROOT / 'training' / 'bridge.cjs')],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
            encoding='utf-8', bufsize=1, cwd=ROOT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
        )
        self._request({'cmd': 'init', 'count': count, 'seed': seed})
        super().__init__(count, spaces.Box(-10, 10, (15,), dtype=np.float32),
                         spaces.Box(-1, 1, (4,), dtype=np.float32))

    def _request(self, message):
        self.proc.stdin.write(json.dumps(message, separators=(',', ':')) + '\n')
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError(f'Node bridge exited: {self.proc.poll()}')
        result = json.loads(line)
        if isinstance(result, dict) and 'error' in result:
            raise RuntimeError(result['error'])
        return result

    def reset(self):
        seed = self._seeds[0] if self._seeds[0] is not None else self.initial_seed
        result = self._request({'cmd': 'reset', 'seed': seed})
        self._reset_seeds()
        return np.asarray(result, dtype=np.float32)

    def step_async(self, actions):
        self.pending_actions = np.asarray(actions).tolist()

    def step_wait(self):
        result = self._request({'cmd': 'step', 'actions': self.pending_actions})
        infos = [r['info'] for r in result]
        for info in infos:
            if 'terminal_observation' in info:
                info['terminal_observation'] = np.asarray(info['terminal_observation'], dtype=np.float32)
        return (np.asarray([r['obs'] for r in result], dtype=np.float32),
                np.asarray([r['reward'] for r in result], dtype=np.float32),
                np.asarray([r['done'] for r in result]), infos)

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            try:
                self.proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.proc.terminate()
                self.proc.wait(timeout=5)

    def get_attr(self, attr_name, indices=None):
        return [getattr(self, attr_name) for _ in self._get_indices(indices)]

    def set_attr(self, attr_name, value, indices=None):
        raise NotImplementedError('Physics parameters are versioned, not mutable through VecEnv')

    def env_method(self, method_name, *args, indices=None, **kwargs):
        raise NotImplementedError(method_name)

    def env_is_wrapped(self, wrapper_class, indices=None):
        return [False for _ in self._get_indices(indices)]
