# Lead Belay Fall Simulator

一个面向研究/教学的先锋保护冲坠网页模拟器。它尝试把真正关键的关系做成可调、可见、可测试：

- theoretical fall factor vs actual fall factor
- rope effective length / rope drag / quickdraw friction
- belayer mass、约束方式、位移与 soft catch / hard catch 的关系
- low clip、first clip、ground fall 风险

**真实汇报：** 这仍然是一个 **教育用途的近似模型**，不是认证工具，也不能替代真人培训、器械说明书或实际保护判断。

## 运行

### 直接打开
浏览器打开 `index.html`

### 本地静态服务
```bash
cd lead-belay-sim
python3 -m http.server 8080
```

### 跑自动 sanity tests
```bash
cd lead-belay-sim
npm test
# 或 node test.js
```

## V2 结构
- `index.html` — 页面骨架
- `styles.css` — 响应式 UI
- `app.js` — 交互和可视化
- `physics.js` — 物理内核
- `presets.js` — 字段定义与预设场景
- `test.js` — 自动趋势/常识校验

## 模型概述

### 1) 基本对象
模型采用 **2D 双质点**：
- climber
- belayer

二者通过经过最后挂片/redirect 的 **等效动态绳** 相连。

### 2) 绳模型
绳索张力用简化的弹簧-阻尼器近似：
- `T_climber = k_eff * extension + c_eff * extensionRate`
- 只有当绳路长度超过 `restLength` 后才开始受力

其中：
- `k_eff` 随有效绳长变化，体现 **绳越长，系统越软**
- `ropeDynamicElongationPct` 与 `ropeImpactForce` 用来做启发式刚度校准
- 这不是 UIAA 标准推导，也不是厂商实验复现，而是为了让数量级和趋势更合理

### 3) actual fall factor
理论 fall factor：
- `fallLength / ropeOut`

实际 fall factor：
- `fallLength / effectiveRopeLength`

其中：
- `effectiveRopeLength = ropeOut * frictionParticipation`
- `frictionParticipation < 1` 时表示快挂转折、rope drag、器械阻力等让一部分绳段不能充分参与伸长

### 4) 两侧张力不对称
真实系统里，redirect / quickdraw 摩擦会使 climber 侧和 belayer 侧张力不同。
这里用：
- `T_belayer ≈ T_climber * frictionTransmission`

这比逐挂点 capstan 方程粗糙，但更轻量，也更适合交互调参。

### 5) belayer 模型
belayer 不是固定点，而是一个可运动质量块，受：
- 自身体重
- 与地面的简化摩擦/支撑
- tether 模式（free / soft / hard）
- soft catch 时机与强度
影响。

soft catch 在实现上被近似为：
- 绳开始加载后，保护员在设定时机获得一个向上/向内的小速度脉冲

它不是人体动作仿真，只是为了表达：
- 更主动、更及时的动态保护 → 系统位移增大 → 峰值力通常降低

### 6) 输出指标
- theoretical fall factor
- actual fall factor
- climber 峰值绳力
- belayer 峰值受力
- anchor 近似峰值载荷
- lowest climber point
- ground fall yes/no
- belayer lift
- catch softness（综合启发式评分）

## 已做的测试
`test.js` 里目前做的是 **sanity / trend tests**，不是实验室验证：

1. 更长 rope out → 峰值力下降
2. 更大 friction / 更少有效绳长 → actual FF 升高、peak force 升高
3. 更轻/更自由的 belayer → 被带起更多
4. 更硬/更重/更受限的 belayer → anchor load 更高
5. first clip off → 低点更低，ground-fall 风险更高

## 还没做到的
以下内容目前**没有被真实建模**，所以我不会假装它已经准确：

- 逐个 quickdraw 的角度与 capstan friction
- 具体 belay device 的滑绳曲线
- rope hysteresis / 非线性粘弹性 / 热耗散
- 人体姿态、撞墙、脚蹬墙、旋转、抓绳误差
- 绳路在不同挂点的几何变化

## 参考与校验思路
这个项目借鉴的是真实文献/公开技术文章里的关系，而不是硬抄某一个公式：
- fall factor 是严重度核心指标之一
- 实际受力会被 rope drag、belayer displacement、belay device 行为显著改变
- 真实人的 field falls 往往比 UIAA 刚性金属块测试“柔和”

所以它更像：
- **用于理解关系的交互式模型**
而不是：
- **拿去决定该不该这样保护** 的工具

## 手机端
V2 保持静态网页结构，布局为响应式：
- 小屏单列
- 画布自适应
- 滑杆和结果卡片可触控查看

## 下一步建议
如果继续做 V3，我建议按这个顺序：
1. 多挂点分段绳模型
2. 更明确的 belayer device / slip 模型
3. 结果曲线图（力-时间、位移-时间）
4. 预设对标真实文章场景并输出差异说明
