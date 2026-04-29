# 体感游戏平台 - Agent 开发指南

## 核心原则

**复用已有模块，勿重复造轮！**

本项目已提取以下可复用模块，后续开发子游戏（乒乓球、跑酷、光剑等）时必须优先使用。

---

## 已提取之可复用模块

### 1. `PersonPresenceMonitor` — 人体存在监控器

**文件**: `src/core/presence-monitor.ts`

**职责**:
- 检测人体是否存在（含关键关节校验，避免单手臂误检）
- 无人后延迟 N 毫秒方暂停游戏（避免频繁切换）
- 暂停后自动降帧至 1fps（省 CPU）
- 有人后自动恢复帧率

**用法**:
```typescript
import { PersonPresenceMonitor } from './core/presence-monitor.js';

const presenceMonitor = new PersonPresenceMonitor({
  delayMs: 3000,  // 无人延迟 3 秒
  callbacks: {
    onAbsent: () => engine.pause(),
    onPresent: () => engine.resume(),
    onLowFpsNeeded: () => cameraMgr.setLowFps(),
    onNormalFpsNeeded: () => cameraMgr.setNormalFps(),
  },
});

// 在 detectFrame 开头
if (presenceMonitor.isThrottled()) {
  return;
}

// 检测后
const result = detector.detectForVideo(video, time);
presenceMonitor.update(result?.landmarks?.[0] ?? null);

if (!presenceMonitor.isPresent) return;

// 以下为游戏独有逻辑
```

**切勿**:
- 勿在子游戏中重新实现无人检测/暂停/降帧逻辑
- 勿复制 `noPersonTimer`、`isPausedLowFps` 等字段至新类

---

### 2. `hasKeyJoints()` — 关键关节检测

**文件**: `src/core/pose-utils.ts`

**职责**: 检查 landmarks 是否含关键关节（双肩 11,12 或双髋 23,24），避免单手臂等误检被当作人体。

**用法**:
```typescript
import { hasKeyJoints } from './core/pose-utils.js';

const hasBody = landmarks && hasKeyJoints(landmarks, 0.5);
```

---

### 3. `CameraManager` — 摄像头管理器

**文件**: `src/core/camera-manager.ts`

**已有方法**:
- `setLowFps()`: 降帧至 1fps
- `setNormalFps()`: 恢复至 30~60fps
- `getVideoElement()`: 获取视频元素

**切勿** 手动调用 `videoTrack.applyConstraints()`，须通过 `CameraManager` 方法。

---

### 4. `PoseDetector` — 姿态检测器

**文件**: `src/core/pose-detector.ts`

**已有功能**:
- 使用 `performance.now()` 生成单调时间戳（避免 MediaPipe 时间戳错误）
- 置信度阈值 `minPoseDetectionConfidence: 0.7`
- **不再内置滤波逻辑**，滤波由 `FilterManager` 负责

**用法**:
```typescript
const result = detector.detectForVideo(video, time);
// 原始检测结果，须通过 FilterManager.apply() 滤波
```

---

### 5. `FilterManager` — 滤波管理器

**文件**: `src/core/filter-manager.ts`

**职责**:
- 为归一化坐标与世界坐标各维护独立滤波器（避免坐标空间相互污染）
- 基于世界坐标计算速度（米/秒），用于自适应滤波
- 提供 `apply()` 方法，对检测结果应用滤波

**用法**:
```typescript
import { FilterManager } from './core/filter-manager.js';

const filterManager = new FilterManager();

// 在 detectFrame 中
const filteredResult = filterManager.apply(result);

// 切换游戏或人体重新出现时重置
filterManager.reset();
```

**切勿**: 勿在子游戏中直接创建 `LandmarkFilter` 实例，须通过 `FilterManager` 使用。

---

### 6. `LandmarkFilter` — 速度自适应 IIR 滤波器

**文件**: `src/core/landmark-filter.ts`

**原理**: α 与速度成正比（速度必须由调用者从世界坐标计算并传入）
- 静止/抖动（速度 ≈ 0）→ α = minAlpha，重平滑
- 快速运动（速度 ≥ maxSpeed）→ α = 1，零延迟
- 公式：output = output + (input - output) × α

**注意**: 此模块通常由 `FilterManager` 调用，子游戏无需直接使用。

**切勿**: 勿直接使用此类，须通过 `FilterManager` 使用。

---

### 7. `MotionAnalyzer` — 动作分析器

**文件**: `src/core/motion-analyzer.ts`

**职责**:
- 分析各身体部位之运动状态（速度、角度）
- 判断是否为大幅度挥动（`isBigSwing`）
- 配置各部位之最低触发速度（`minVelocity`）

**用法**:
```typescript
import { MotionAnalyzer, DEFAULT_BODY_CONFIGS } from './core/types.js';

const analyzer = new MotionAnalyzer(DEFAULT_BODY_CONFIGS);

// 在 detectFrame 中
const motionResult = analyzer.analyze(worldLandmarks, normLandmarks);
```

**切勿**: 勿在子游戏中重新实现动作分析逻辑。

---

### 8. `TrailSystem` — 轨迹系统

**文件**: `src/core/trail-system.ts`

**职责**:
- 存储各部位之轨迹点（含时间戳）
- 提供轨迹渲染（渐隐效果）
- **不再用于碰撞检测**（切割检测改用当前帧 + 上一帧位置）

**用法**:
```typescript
import { TrailSystem } from './core/trail-system.js';

const trailSystem = new TrailSystem();

// 更新轨迹（在 detectFrame 中）
trailSystem.updateTrail(id, x, y);

// 渲染轨迹（在 renderFrame 中）
trailSystem.render(ctx, getColorCallback);
```

**切勿**: 勿用 `getTrail()` 做碰撞检测，切割检测应直接用当前帧位置。

---

### 9. `SlicingSystem` — 切割检测系统

**文件**: `src/games/polygon-warrior/slicing.ts`

**职责**:
- 基于**当前帧 + 上一帧**位置检测切割（非历史轨迹）
- 支持当前位置在圆内、两帧线段扫掠两种检测
- 轨迹仅作渲染，不作碰撞

**用法**:
```typescript
import { SlicingSystem } from './games/polygon-warrior/slicing.js';

const slicingSystem = new SlicingSystem();

// 在 game.update() 中（须先调用 updateTrail，再调用 checkSlice）
slicingSystem.updateTrail(motionResult, canvasW, canvasH);
slicingSystem.checkSlice(shape, motionResult);

// 渲染轨迹
slicingSystem.renderTrail(ctx);
```

**切勿**: 勿用历史轨迹做碰撞检测。

---

## 子游戏开发 Checklist

当开发新子游戏（乒乓球、跑酷、光剑等）时，须：

- [ ] 使用 `PersonPresenceMonitor` 处理无人暂停逻辑
- [ ] 使用 `hasKeyJoints()` 判断人体是否存在
- [ ] 通过 `CameraManager` 控制帧率
- [ ] 通过 `PoseDetector` 获取姿态数据
- [ ] 通过 `FilterManager` 对姿态数据进行自适应滤波
- [ ] 通过 `MotionAnalyzer` 分析动作状态
- [ ] 切割检测用当前帧 + 上一帧位置，勿用历史轨迹
- [ ] 若需新功能，先检查是否已存在相应模块
- [ ] 若模块不满足需求，先考虑扩展模块，而非新建

---

## 项目结构（最新）

```
src/
├── main.ts                 # 应用启动入口
│
├── core/                   # 核心模块（可复用）
│   ├── pose-detector.ts    # MediaPipe Pose 封装
│   ├── pose-utils.ts       # Pose 工具函数（如 hasKeyJoints）
│   ├── presence-monitor.ts # 人体存在监控器（无人暂停/降帧）
│   ├── motion-analyzer.ts  # 动作分析器
│   ├── game-engine.ts      # 游戏引擎（状态机+计分+连击）
│   ├── camera-manager.ts   # 摄像头管理器（含降帧逻辑）
│   ├── game-loop.ts        # 游戏循环
│   ├── landmark-filter.ts  # 关键点滤波（速度自适应 IIR）
│   ├── filter-manager.ts   # 滤波管理器（含速度计算）
│   ├── trail-system.ts     # 轨迹系统（渲染用，非碰撞）
│   └── particle-system.ts  # 粒子特效系统
│
├── games/                  # 游戏模块（可扩展）
│   ├── index.ts            # 游戏模式注册表
│   └── polygon-warrior/    # 多边形战士（当前实现）
│       ├── index.ts        # 游戏主逻辑
│       ├── shape.ts        # 形状类（多边形/炸弹/冰冻）
│       └── slicing.ts      # 切割检测系统
│
├── shared/                 # 共享工具
│   ├── pose-renderer.ts    # 骨架渲染器
│   ├── math-utils.ts
│   └── collision-utils.ts
│
├── ui/
│   └── hud.ts              # 游戏抬头显示
│
└── types/                  # TypeScript 类型定义
    └── types.ts
```

---

