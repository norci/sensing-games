/**
 * 核心类型定义 - 姿态识别 + 游戏框架
 * 合并自 types/body-part.ts、types/game.ts、types/pose.ts
 */

/** MediaPipe Pose landmark */
export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** 二维点 */
export interface Point {
  x: number;
  y: number;
}

// ==================== 身体部位类型 ===================

/** 身体部位标识 */
export type BodyPartId =
  | 'leftHand' | 'rightHand'
  | 'leftFoot' | 'rightFoot'
  | 'leftElbow' | 'rightElbow'
  | 'leftKnee' | 'rightKnee'
  | 'head';

/** 单个身体部位的运动分析结果 */
export interface BodyPartResult {
  id: BodyPartId;
  detected: boolean;
  isBigSwing: boolean;
  isKnocking: boolean;
  velocity: number;
  angle: number;
  position: Point;
}

/** 所有身体部位的分析结果 */
export interface MotionResult {
  parts: Partial<Record<BodyPartId, BodyPartResult>>;
  isBigSwing: boolean;
  isKnocking: boolean;
  timestamp: number;
}

/** 身体部位检测配置（对应一组关节 landmark） */
export interface BodyPartConfig {
  id: BodyPartId;
  tipIdx: number;    // 末端关节（手腕/脚踝/鼻尖）
  midIdx: number;    // 中间关节（肘/膝）
  rootIdx: number;   // 根关节（肩/髋）
  skipAngle?: boolean;    // 跳过角度检测，只靠速度（头部用）
  invertAngle?: boolean;  // 小角度触发（弯曲的肘/膝攻击）
  isHead?: boolean;      // 头顶需估算（用鼻子+肩膀向量延伸）
  /** 最低触发速度（覆盖全局 minVelocity），手/脚/肘/膝单独设置 */
  minVelocity?: number;
}

/** 动作分析器配置 */
export interface MotionAnalyzerConfig {
  minAngle?: number;
  knockingAngleMax?: number;
  minVelocity?: number;
  invertAngleMax?: number;
  invertMinVelocity?: number;
  historySize?: number;
}

// ==================== 默认配置 ===================

/** 默认双手配置（tipIdx 改为手部指点，非腕关节） */
export const DEFAULT_HAND_CONFIGS: BodyPartConfig[] = [
  { id: 'leftHand',  tipIdx: 19, midIdx: 13, rootIdx: 11, minVelocity: 2.0 },
  { id: 'rightHand', tipIdx: 20, midIdx: 14, rootIdx: 12, minVelocity: 2.0 },
];

/** 头部配置：用估算的头顶坐标（鼻子向上延伸） */
export const DEFAULT_HEAD_CONFIGS: BodyPartConfig[] = [
  { id: 'head', tipIdx: 0, midIdx: 0, rootIdx: 0, skipAngle: true, isHead: true, minVelocity: 1 },
];

/** 默认双脚配置 */
export const DEFAULT_FOOT_CONFIGS: BodyPartConfig[] = [
  { id: 'leftFoot',  tipIdx: 27, midIdx: 25, rootIdx: 23, minVelocity: 2.5 },
  { id: 'rightFoot', tipIdx: 28, midIdx: 26, rootIdx: 24, minVelocity: 2.5 },
];

/** 肘部配置：tip=肘关节本身，检测肘部运动 */
export const DEFAULT_ELBOW_CONFIGS: BodyPartConfig[] = [
  { id: 'leftElbow',  tipIdx: 13, midIdx: 13, rootIdx: 11, invertAngle: true, minVelocity: 2 },
  { id: 'rightElbow', tipIdx: 14, midIdx: 14, rootIdx: 12, invertAngle: true, minVelocity: 2 },
];

/** 膝部配置：tip=膝关节本身，检测膝部运动 */
export const DEFAULT_KNEE_CONFIGS: BodyPartConfig[] = [
  { id: 'leftKnee',  tipIdx: 25, midIdx: 25, rootIdx: 23, invertAngle: true, minVelocity: 2.0 },
  { id: 'rightKnee', tipIdx: 26, midIdx: 26, rootIdx: 24, invertAngle: true, minVelocity: 2.0 },
];

/** 全部身体部位配置 */
export const DEFAULT_BODY_CONFIGS: BodyPartConfig[] = [
  ...DEFAULT_HAND_CONFIGS,
  ...DEFAULT_FOOT_CONFIGS,
  ...DEFAULT_HEAD_CONFIGS,
  ...DEFAULT_ELBOW_CONFIGS,
  ...DEFAULT_KNEE_CONFIGS,
];

// ==================== 游戏框架类型 ===================

/** 游戏配置 */
export interface GameConfig {
  swingThreshold?: number;    // 挥刀判定阈值
  comboWindow?: number;      // 连击时间窗口(ms)
  maxLives?: number;         // 最大生命值
  difficulty?: number;       // 难度系数
  practiceMode?: boolean;   // 练习模式（无失败）
}

/** 游戏模式接口 */
export interface IGameMode {
  readonly name: string;
  readonly description: string;

  init(canvas: HTMLCanvasElement, glCanvas?: HTMLCanvasElement): void;
  update(motionData: MotionResult): void;
  render(ctx?: CanvasRenderingContext2D, gl?: WebGL2RenderingContext): void;
  destroy(): void;
  restart?(): void;
  resize?(): void;
}
