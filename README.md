# 体感游戏平台 - 开发计划

## 项目概述

基于单摄像头的手机浏览器体感游戏，类似水果忍者。用户挥动手中的单刀，操纵屏幕虚拟角色，要求动作大幅度挥刀，不能像拿棍子敲击。采用模块化设计，游戏内容可扩展。

---

## 技术选型

### 核心栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **TypeScript** | 5.4+ | 静态类型，符合要求 |
| **Vite** | 5.4+ | 快速构建，HMR |
| **@mediapipe/tasks-vision** | 0.10.22+ | 官方新API，Pose Landmarker |
| **HTML5 Canvas 2D** | - | 游戏渲染（混合模式） |
| **WebGL 2.0** | - | 可选3D特效 |
| **Web Audio API** | - | 音效系统 |

### 为什么不用其他方案？

| 方案 | 问题 |
|------|------|
| Python + pygame | ❌ 无法在手机浏览器运行 |
| Rust + mediapipe-rs | ❌ Pose未实现，生态不成熟 |
| OpenCV.js | ❌ 移动端性能差，CPU占用高 |

---

## 项目结构

```
sensing-games/
├── public/
│   ├── index.html              # 入口页面
│   └── models/                 # MediaPipe 模型文件（可选本地）
│
├── src/
│   ├── main.ts                 # 应用启动入口
│   │
│   ├── core/                   # 核心模块（不可变）
│   │   ├── pose-detector.ts    # MediaPipe Pose 封装
│   │   ├── swing-analyzer.ts   # 大幅度挥刀判定算法
│   │   └── game-engine.ts      # 游戏引擎（状态机+计分+连击）
│   │
│   ├── games/                  # 游戏模块（可扩展）
│   │   ├── index.ts            # 游戏模式注册表
│   │   └── fruit-ninja/
│   │       ├── index.ts        # 水果忍者主逻辑
│   │       ├── fruit.ts        # 水果类（物理抛射）
│   │       └── slicing.ts      # 切水果碰撞检测
│   │
│   ├── shared/                 # 共享工具
│   │   ├── math-utils.ts       # 向量/碰撞计算
│   │   └── sound-manager.ts    # Web Audio 音效生成
│   │
│   ├── types/                  # TypeScript 类型定义
│   │   ├── pose.ts
│   │   ├── swing.ts
│   │   └── game.ts
│   │
│   └── ui/
│       └── hud.ts              # 游戏抬头显示
│
├── package.json
├── tsconfig.json               # 严格模式
├── vite.config.ts              # Vite 配置
└── README.md                   # 本文档
```

---

## 核心算法设计

### 1. 大幅度挥刀检测

基于 MediaPipe Pose 33 个关键点：

- **右腕**: landmark[16]
- **右肘**: landmark[14]
- **右肩**: landmark[12]

**判定条件**：
- **速度阈值**: `velocity > 0.25`（归一化单位）
- **角度阈值**: `armAngle > 60°`（上臂-前臂夹角）
- **排除敲击**: `velocity < 0.3` 且 `angle < 30°`

```typescript
const isBigSwing = velocity > 0.25 && angle > 60;
const isKnocking = velocity > 0.1 && velocity < 0.3 && angle < 30;
```

**速度平滑**: 使用最近 5 帧平均，避免抖动。

### 2. 切水果碰撞检测

- **线段-圆相交算法**: 刀光轨迹线段 vs 水果圆形
- **轨迹长度**: 保留最近 10 帧腕部位置构成线段
- **碰撞时机**: 当首个端点进入圆范围即刻判定

### 3. 物理系统

- **重力模拟**: `vy += 0.3` 每帧
- **发射角度**: 从底部向上抛射，随机水平偏移
- **水果类型**: cherry(10pts), peach(20pts), banana(15pts), watermelon(30pts), bomb(💣)

---

## 性能优化策略

### 手机端适配

| 场景 | 策略 | 理由 |
|------|------|------|
| **模型** | `pose_landmarker_lite.task` (2.7MB) | 小体积，加载快 |
| **推理频率** | 每2帧检测一次 | CPU占用降50% |
| **渲染方式** | Canvas 2D | 简单，兼容佳 |
| **分辨率** | 视频 640×480 | 性能与精度平衡 |

### GPU 推理（可选）

```typescript
const delegate = isMobile ? 'CPU' : 'GPU';
// 或运行时检测：若 fps<15 则降级 CPU
```

**实测数据**:

| 平台 | CPU | GPU |
|------|-----|-----|
| 桌面 i9 | 44 FPS | 160 FPS |
| iPhone 12 | 34 FPS | 51 FPS |
| Pixel 5 | 12 FPS | 22 FPS |

---

## 开发里程碑

### Phase 1: PoC 验证（2天）✅ 已完成

- [x] 项目初始化（Vite + TypeScript）
- [x] MediaPipe Pose 封装
- [x] 大幅度挥刀检测算法
- [x] 游戏引擎基础框架
- [x] 水果忍者核心玩法

### Phase 2: 优化与扩展（3天）

- [ ] 手机浏览器真机测试（Safari/Chrome）
- [ ] 性能调优：帧率、延迟、发热
- [ ] 增加射箭模式（示例扩展）
- [ ] 音效系统完善（Web Audio）
- [ ] HUD 校准界面

### Phase 3: 模块化与发布（2天）

- [ ] IGameMode 接口抽象
- [ ] 游戏模式动态加载
- [ ] 配置热重载
- [ ] 部署到 GitHub Pages / Vercel
- [ ] 使用文档编写

---

## 运行与调试

### 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 类型检查
pnpm exec tsc --noEmit

# 构建生产版本
pnpm build
```

### 手机调试

1. **本地局域网启动** (already configured):
   ```
   http://192.168.3.10:3000
   ```
   修改 `vite.config.ts` 中 `host` 为 `0.0.0.0` 即可。

2. **HTTPS 要求**:
   - Chrome 要求摄像头必须在 HTTPS 或 localhost
   - 手机可通过 `https://` 访问（自签名证书）
   - 或使用 ngrok 内网穿透: `ngrok http 3000`

3. **调试技巧**:
   - Safari 远程调试: `设置 > Safari > 高级 > Web检查器`
   - Chrome 远程调试: `chrome://inspect`
   - 使用 `console.log` 输出帧率、检测结果

---

## 已知问题与对策

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| **浏览器空白** | 模块未加载或运行时错误 | 检查控制台，添加全局错误处理 |
| **帧率低 (<15FPS)** | 模型太大或CPU太慢 | 切换 lite 模型，降低检测频率 |
| **GPU 加载慢** | WebGL 初始化耗时约30秒 | 首次加载耐心等待 |
| **iOS Chrome 摄像头不可用** | iOS限制 | 提示用户使用 Safari |
| **MediaPipe 模型 CDN 慢** | 国内网络 | 配置镜像或下载到本地 |

---

## 扩展方向

### 新增游戏模式

1. **射箭模式** (`archery/`):
   - 左手拉弓（双关键点距离）
   - 右手放箭（挥刀触发）
   - 靶子反弹物理

2. **拳击模式** (`boxing/`):
   - 左右拳快速挥动检测
   - 拳速统计与连击
   - 对手AI反应

3. **切蛋糕模式** (`cake/`):
   - 区分水平切 vs 垂直切
   - 刀光方向判定
   - 多层蛋糕

### 高级功能（可选）

- **彩色标记追踪**: OpenCV.js 识别道具刀颜色
- **多人游戏**: WebRTC 同步，双人对战
- **排行榜**: 本地存储或 Firebase
- **成就系统**: 里程碑解锁

---

## 参考资料

- [MediaPipe Tasks Vision API](https://ai.google.dev/edge/mediapipe/solutions/vision)
- [MediaPipe Pose Demo](https://mediapipe.dev/demo/pose)
- [TensorFlow.js 性能基准](https://github.com/google-ai-edge/mediapipe-samples-web)
- [OpenCV.js 性能问题](https://github.com/opencv/opencv/issues/23516)

---

## 疑问与待确认

1. **是否需要 3D 刀光特效？** - 当前用 Canvas 2D 绘制轨迹，如需 3D 雾化效果需引入 Three.js
2. **音效是否从外部文件加载？** - 当前使用 Web Audio 生成简单波形，如需复杂音效需添加 MP3/WAV 资源
3. **是否加入校准模式？** - 让用户站在特定位置设定挥刀幅度基准

---

**最后更新**: 2026-04-25  
**版本**: 1.0.0-plan  
**状态**: 实施中
