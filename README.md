# Lead Belay Fall Simulator

一个面向研究 / 教学的先锋保护冲坠网页模拟器，用来观察这些关系在同一套近似模型里的联动：

- theoretical fall factor vs actual fall factor
- rope path / quickdraw friction / effective rope length
- belayer 体重、约束方式、位移与 soft catch / hard catch
- 低挂片、首挂、离地余量与 ground-fall 风险

**安全边界：** 这是教育用途的近似模型，不是认证计算器，也不能替代真实培训、器械说明书或现场保护判断。

## 运行

### 直接打开
浏览器打开 `index.html`

### 本地静态服务
```bash
python3 -m http.server 8080
```

### 自动 sanity tests
```bash
npm test
npm run test:trends
npm run test:constraints
npm run test:output
npm run test:multidraw
```

## 文件结构

- `index.html`：页面骨架
- `styles.css`：响应式 UI
- `app.js`：控件、动画、结果卡片、时间曲线
- `physics.js`：核心近似物理模型
- `presets.js`：字段定义与预设场景
- `test*.js`：Node 侧 sanity / trend / output tests
- `tests.md`：手工验证清单

## 模型概述

### 1. 基本对象
模型使用 2D 双质点：

- climber
- belayer

两者通过经过所有已挂快挂的等效动态绳相连。

### 2. 绳模型
绳张力用简化弹簧-阻尼器近似：

- `T = k_eff * extension + c_eff * extensionRate`
- 只有当当前绳路长度超过 `restLength` 才开始受力

`k_eff` 会随有效参与伸长的绳长变化而变化，所以同一段 fall length 在“更多绳参与伸长”时会更软。

### 3. 实际 fall factor

- theoretical FF: `fallLength / ropeOut`
- actual FF: `fallLength / effectiveRopeLength`

这里的 `effectiveRopeLength` 不再是单个固定系数，而是对 belayer -> draws -> climber 各段绳长按传递损失加权后的结果。快挂越多、转折越大、摩擦越高，真正参与伸长的绳段通常越少。

### 4. 多快挂路径
当前实现会把最高已挂快挂固定在 `lastClipHeight`，再在 `firstDrawHeight` 与 `lastClipHeight` 之间分布其余已挂点。这样路径几何和“当前最高已挂高度”保持一致，不会再出现最高挂点与参数不匹配的情况。

### 5. Belayer / soft catch
belayer 不是固定点，而是可运动质量块，受：

- 自身体重
- 地面简化摩擦
- tether 模式（free / soft / hard）
- soft catch 时机与强度

`softCatchTiming` 现在按“绳开始加载后的秒数”解释；触发时会给 belayer 一个向上、向墙 / 向锚点方向的小速度脉冲。

### 6. 输出
页面会显示：

- 理论 / 实际 fall factor
- climber / belayer / anchor 近似峰值载荷
- 最低点与最小离地余量
- ground-fall 判定
- belayer lift
- 三张时间曲线：climber rope force、ground clearance、belayer lift

## 已做的 sanity checks

当前自动测试主要检查趋势与约束，不是实验室级校准：

1. 更长有效绳长通常降低峰值力
2. 更高摩擦 / 更多折返会降低传递并缩短有效绳长
3. 更轻或更自由的 belayer 更容易被带起
4. 更硬或更受限的 belayer 会提高 anchor load
5. 墙面 / 地面 / 人体半径约束不会被穿透
6. 输出 time series 与关键指标字段保持完整

## 没有真实建模的部分

以下内容目前仍然是明显简化的：

- 真实 belay device 滑绳曲线
- 分段绳的非线性粘弹性 / hysteresis / 热耗散
- 人体姿态、脚蹬墙、旋转、抓绳误差
- 高保真的碰撞 / 接触求解
- 与真实文章或厂家测试的定量对标

所以更准确的定位是：

- 用于理解关系和比较趋势的交互式模型

而不是：

- 用来决定现实中该不该这样保护的安全工具
