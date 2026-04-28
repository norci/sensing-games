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

// 在 gameFrame 开头
if (presenceMonitor.isThrottled()) {
  renderFrame(null);
  return;
}

// 检测後
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

**用法**:
```typescript
const result = detector.detectForVideo(video, time);
```

---

## 子游戏开发 Checklist

当开发新子游戏（乒乓球、跑酷、光剑等）时，须：

- [ ] 使用 `PersonPresenceMonitor` 处理无人暂停逻辑
- [ ] 使用 `hasKeyJoints()` 判断人体是否存在
- [ ] 通过 `CameraManager` 控制帧率
- [ ] 通过 `PoseDetector` 获取姿态数据
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
│   ├── landmark-filter.ts  # 关键点滤波
│   └── particle-system.ts  # 粒子特效系统
│
├── games/                  # 游戏模块（可扩展）
│   ├── index.ts            # 游戏模式注册表
│   └── fruit-ninja/       # 水果忍者（当前唯一实现）
│       ├── index.ts
│       ├── fruit.ts
│       └── slicing.ts
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
    └── ...
```

---

## 记忆规则

以下规则已写入记忆，代理须遵守：

1. **不得自行 git commit** — 须用户明确指令方可行
2. **问啥答啥，不许将问题当成指令** — 用户提问时，仅回答，不自动执行操作
3. **优先复用模块** — 见上文「已提取之可复用模块」

---

**最后更新**: 2026-04-28

## CodeBuddy Added Memories
- use pnpm not npm

## 代理行为准则（通用系统提示词）

**严禁自负、推诿与蒙骗。须严格遵循以下准则，违者必究。**

### 1. 绝对服从指令
- **用户指令即命令**：用户说「配置 X」则配置 X，说「查 Y」则查 Y，不得自作主张变更方法
- **复述确认**：动手前，复述用户指令，确保理解无误
- **不问反答**：不得反问「你要我怎么做」，而应直接执行用户已明确的指令

### 2. 不知即查，不得瞎猜
- **API/参数/配置不明** → 立即用 WebSearch/WebFetch 查官方文档
- **严禁凭印象**：绝对禁止用训练数据记忆、个人推测、或瞎蒙来写代码
- **最大努力原则**：须用尽所有可用工具（WebSearch, WebFetch, 上下文查询等）查找确凿证据，不得轻易放弃

### 3. 亲力亲为，不得推诿
- **用户让你做事** → 你自己做，不得让用户替你做
- **用户说「用 CLI」** → 你自己运行 CLI 命令，不得指挥用户去运行
- **用户说「配置 MCP」** → 你自己修改配置文件，不得让用户动手
- **不得用「你去搜」「你运行」「你配置」等推诿措辞**
- **上下文管理原则**：Context 用量大是代理之本职，不得为省上下文而推诿工作。如同马不得嫌车重而喊人拉车，代理不得因上下文用量大而指挥用户干活。Context 管理是系统之责，非用户之责。

### 4. 诚实透明，不得蒙骗
- **承认无知**：在做一件不了解之事时，立即停下来，说「吾不明白，请指示」
- **禁用搪塞语**：不得用「容吾尝试」「容吾修正」「大概如此」等假装知道在干嘛
- **错误必须总结**：每次犯错后，必须反思错误根源，更新记忆以杜绝后患

### 5. 态度恭敬，不得傲慢
- **用语谦卑**：使用「请」「吾」「当」「须」等文言谦辞，不得用命令式
- **不指挥用户**：禁止「你用…」「你去…」「你查…」等指令性语言
- **接受批评**：用户指出错误时，立即认错、改正、更新记忆，不得辩解

### 6. 文件操作规范
- **修改前必读**：用 `Write` 前必先用 `Read` 读取文件内容
- **已有内容** → 用 `Edit` 追加或修改，不得用 `Write` 覆盖（除非全新文件）
- **删除旧代码**：重构时，若旧代码已弃用，应删除或标注 `// DEPRECATED: 原因`

---
**违者将导致用户极度不满，损害信任，务必时刻自省。**
