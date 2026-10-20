# 步态实验室 · QWOP 风格物理跑步

已完成物理环境、Python/Node 训练桥接、真实 PPO 训练、模型导出、浏览器实时推理和冻结模型对照评估。当前是平地可行性原型；步态偏跳跃，不代表自然人类跑姿。楼梯与多训练种子研究留待后续。

## 启动

安装 Node.js 后，在本目录运行：

```powershell
npm install
npm start
```

打开 http://127.0.0.1:8765 。依赖安装完成后运行不需要网络。也可双击 `启动游戏.cmd` 启动服务。请通过服务器访问；双击 HTML 的 file 协议可能阻止模型 JSON 加载。

## 给老师的演示顺序

1. 控制方式选择「PPO 智能体（已训练）」，点击开始跑步。系统自动锁定无辅助标准挑战，模型每秒读取 30 次身体状态并输出关节动作。
2. 等待到达 100 米，查看结算时间和回合记录。
3. 切换固定规则或随机策略，在同一标准挑战和种子下比较。
4. 展示下方真实验证曲线和冻结测试结果。CSV 可导出当前会话成绩，切换/重置回合单独标注。

空格暂停/继续；页面失焦自动暂停；手机可按住屏幕上的四个键。每局上限 60 秒，目标 100 米。最佳成绩与回合记录只在本次页面会话保存。

## 环境结构

- `environment.js`：Planck 刚体物理、关节限位与电机、种子重置、固定 1/120 秒物理步长、摔倒和终止、奖励与观测；浏览器和 Node 复用同一份代码。
- `app.js`：Canvas 绘图、输入、规则演示、暂停与结果、CSV；人物位置来自真实物理刚体。手臂仅用于显示，不参与碰撞。
- `index.html` / `style.css`：静态界面，无构建工具。
- `server.cjs`：仅监听本机的静态文件服务。

```js
const RunnerEnvironment = require('./environment.js');
const env = new RunnerEnvironment({seed: 42, assisted: false});
const observation = env.reset({seed: 42, assisted: false});
const result = env.step([0.5, -0.5, 1, -1], 4);
// {observation, reward, terminated, truncated, info}
```

动作：四个 [-1,1] 值，对应左右髋、左右膝的目标角度映射。观测 15 维：躯干角度、角速度、水平/竖直速度、高度、四关节角度、四关节角速度、两脚近地指示。角度为弧度，距离为米。接地指示目前按脚底高度阈值估计，后续可换成持续接触计数。

奖励 flat-v2：`3 × 前向位移 + dt × (0.3 × cos(躯干角度) - 0.01 × 动作平方和)`；摔倒额外 -2，完成 +10。躯干/头触地、躯干高度低于 0.8 m、倾角绝对值超过 1.3 rad 都会终止。没有约束自然步态或左右腿交替。`assisted: true` 开启虚拟竖直支撑及躯干稳定力矩，仅用于体验；PPO 训练和评估均为 `false`。

与初版相比，v2 加强低姿态及倾倒终止，并统一控制频率为 30 Hz（每动作 4 个物理步）。旧成绩不应与 v2 混为同条件结果。

## 验证与后续

`npm test` 检查确定性、动作有效性、终止/重置、辅助隔离、参数、模型指纹、种子隔离及已训练 PPO 的完成能力。`.\.venv\Scripts\python.exe training/test_bridge.py` 检查桥接、SB3 训练和 Python/JS 推理数值一致性。

Python Gymnasium / Stable-Baselines3 已通过 JSON-lines 批量通信连接 Node，训练无需浏览器。actor 网络为 15→64→64→4，隐藏层 Tanh，固定观测缩放并裁剪到 [-10,10]。网页直接读取导出的权重，确定性均值动作裁剪到 [-1,1]，无需 Python 常驻。

## 训练与模型材料

### 同时播放 4 个训练阶段

打开 http://127.0.0.1:8765/compare.html 或首页「查看训练四分屏对比」。点击「同时开始」让 0、100,000、500,000、1,000,000 step 模型同时运行。支持同步暂停、全部重置、相同种子、1×/2×/4× 速度和 CSV 导出；失败或完成的跑道冻结，其余继续，切到其他窗口会自动暂停。

四个检查点来自新的一次连续训练 `flat-checkpoints-01`，原单跑道模型保持不变。step 指 16 个环境累计的动作交互数，不是单环境物理帧数。为了精确对齐，rollout 使用 `250 × 16 = 4000` 转换，batch size 250；每个检查点都在该批 PPO 梯度更新完成后保存。0 step 是随机初始化模型的确定性均值动作，不是每帧随机选动作。

模型存放在 `models/checkpoints/`，每个阶段均有 SB3 `.zip` 和网页 `.json`。`manifest.json` 记录准确步数、同一批次、物理文件及权重哈希。四屏均无辅助、30 Hz 控制，使用同一初始状态；各屏独立跟随镜头，所以请通过距离数值比较，不用画面内人物的横坐标比较。

重新生成（使用新 run 名，避免覆盖训练历史）：

```powershell
.\.venv\Scripts\python.exe training/checkpoints.py --run flat-checkpoints-02
node training/evaluate_checkpoints.cjs
.\.venv\Scripts\python.exe training/test_checkpoints.py
```

训练完成会将四个检查点复制到网页目录并更新清单，不会替换单跑道的 `models/policy.json`。`preview-results.json` 是预先固定 5 个种子的演示检查结果，不用于选模，也不替代正式多训练种子实验。训练进步不保证每个里程碑都比前一个更好，页面不人为调整阶段表现。

- `models/ppo-flat.zip`：SB3 模型，可继续训练。
- `models/policy.json`：网页使用的 actor 权重。
- `models/validation.json`：训练期间的验证曲线。
- `models/evaluation.json` / `.csv`：每策略 30 局的冻结测试数据。
- `models/metadata.json`：参数、验证种子、选模规则、环境与权重 SHA256。
- `training/runs/flat-ppo-01/`：原始日志及检查点，本地保留，Git 忽略。
- `TRAINING_REPORT.md`：本轮结果与限制。

重新训练（当前电脑已建好 `.venv`，其他机器先建立虚拟环境）：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r training/requirements.txt
.\.venv\Scripts\python.exe training/train.py --steps 1000000 --seed 7 --run flat-ppo-new
.\.venv\Scripts\python.exe training/publish.py --run flat-ppo-new
```

训练步数会向上取整到完整 rollout，本轮实际 1,003,520。`publish.py` 只导出到本地 `models/`，不上传部署；它用验证种子选模，再执行冻结测试，再运行会替换当前网页模型和报告。

继续训练使用新 run 名称保留原始数据：

```powershell
.\.venv\Scripts\python.exe training/train.py --steps 1000000 --run flat-ppo-more --resume models/ppo-flat.zip
```

`npm run evaluate` 可重新评估当前冻结模型。结果仅说明单次训练在平地和微小初始倾角变化下的表现，不证明多次训练稳定性、强规则基线优势、楼梯或外力扰动泛化。

引擎：[Planck.js](https://piqnt.com/planck.js/)，MIT 许可证随依赖保留。角色和赛道自行绘制，不含原 QWOP 素材。
