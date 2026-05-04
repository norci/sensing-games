export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface Point {
  x: number;
  y: number;
}

export type BodyPartId =
  | 'leftHand' | 'rightHand'
  | 'leftFoot' | 'rightFoot'
  | 'leftElbow' | 'rightElbow'
  | 'leftKnee' | 'rightKnee'
  | 'head';

export interface BodyPartResult {
  id: BodyPartId;
  detected: boolean;
  isBigSwing: boolean;
  isKnocking: boolean;
  velocity: number;
  angle: number;
  position: Point;
}

export interface MotionResult {
  parts: Partial<Record<BodyPartId, BodyPartResult>>;
  isBigSwing: boolean;
  isKnocking: boolean;
  timestamp: number;
}

export interface BodyPartConfig {
  id: BodyPartId;
  tipIdx: number;
  midIdx: number;
  rootIdx: number;
  skipAngle?: boolean;
  invertAngle?: boolean;
  isHead?: boolean;
  minVelocity?: number;
}

export interface MotionAnalyzerConfig {
  minAngle?: number;
  knockingAngleMax?: number;
  minVelocity?: number;
  invertAngleMax?: number;
  invertMinVelocity?: number;
  historySize?: number;
}

export const DEFAULT_HAND_CONFIGS: BodyPartConfig[] = [
  { id: 'leftHand',  tipIdx: 19, midIdx: 13, rootIdx: 11, minVelocity: 1.0 },
  { id: 'rightHand', tipIdx: 20, midIdx: 14, rootIdx: 12, minVelocity: 1.0 },
];

export const DEFAULT_HEAD_CONFIGS: BodyPartConfig[] = [
  { id: 'head', tipIdx: 0, midIdx: 0, rootIdx: 0, skipAngle: true, isHead: true, minVelocity: 1 },
];

export const DEFAULT_FOOT_CONFIGS: BodyPartConfig[] = [
  { id: 'leftFoot',  tipIdx: 31, midIdx: 27, rootIdx: 23, minVelocity: 1 },
  { id: 'rightFoot', tipIdx: 32, midIdx: 28, rootIdx: 24, minVelocity: 1 },
];

export const DEFAULT_ELBOW_CONFIGS: BodyPartConfig[] = [
  { id: 'leftElbow',  tipIdx: 13, midIdx: 13, rootIdx: 11, invertAngle: true, minVelocity: 2 },
  { id: 'rightElbow', tipIdx: 14, midIdx: 14, rootIdx: 12, invertAngle: true, minVelocity: 2 },
];

export const DEFAULT_KNEE_CONFIGS: BodyPartConfig[] = [
  { id: 'leftKnee',  tipIdx: 25, midIdx: 25, rootIdx: 23, invertAngle: true, minVelocity: 2 },
  { id: 'rightKnee', tipIdx: 26, midIdx: 26, rootIdx: 24, invertAngle: true, minVelocity: 2 },
];

export const DEFAULT_BODY_CONFIGS: BodyPartConfig[] = [
  ...DEFAULT_HAND_CONFIGS,
  ...DEFAULT_FOOT_CONFIGS,
  ...DEFAULT_HEAD_CONFIGS,
  ...DEFAULT_ELBOW_CONFIGS,
  ...DEFAULT_KNEE_CONFIGS,
];

export const DEFAULT_MOTION_ANALYZER_CONFIG: Required<MotionAnalyzerConfig> = {
  minAngle: 60,
  knockingAngleMax: 30,
  minVelocity: 0.3,
  invertAngleMax: 80,
  invertMinVelocity: 0.1,
  historySize: 3,
};

export interface GameConfig {
  swingThreshold?: number;
  comboWindow?: number;
  maxLives?: number;
  difficulty?: number;
  practiceMode?: boolean;
}

export interface IGameMode {
  readonly name: string;
  readonly description: string;

  init(canvas: HTMLCanvasElement, glCanvas?: HTMLCanvasElement): void;
  tick(deltaTime: number): void;
  update(motionData: MotionResult): void;
  render(ctx?: CanvasRenderingContext2D, gl?: WebGL2RenderingContext): void;
  destroy(): void;
  restart?(): void;
  resize?(): void;
}
