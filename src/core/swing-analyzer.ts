import { NormalizedLandmark } from '../types/pose.js';
import { SwingResult, SwingHandResult, Point, SwingDetectorConfig } from '../types/swing.js';

export class SwingAnalyzer {
  private lastLeftWristPos: Point | null = null;
  private lastRightWristPos: Point | null = null;
  private lastLeftTimestamp: number = 0;
  private lastRightTimestamp: number = 0;
  private leftVelocityHistory: number[] = [];
  private rightVelocityHistory: number[] = [];
  private leftIsBigSwing = false;
  private rightIsBigSwing = false;

  private readonly config: Required<SwingDetectorConfig>;

  constructor(config?: Partial<SwingDetectorConfig>) {
    this.config = {
      minAngle: 60,                  // 最小挥刀角度（度），超过则判定为大幅挥刀
      knockingAngleMax: 30,           // 敲击最大角度（度），低于则判定为小幅度敲击
      minVelocity: 0.3,              // 最低速度门限（归一化），只过滤纯静止噪声
      historySize: 3,                 // 速度历史平滑长度（缩短以减少延迟）
      ...config
    };
  }

  analyze(landmarks: NormalizedLandmark[]): SwingResult {
    // 分析左手
    const leftHand = this.analyzeHand(landmarks, 15, 13, 11, 'left');
    // 分析右手
    const rightHand = this.analyzeHand(landmarks, 16, 14, 12, 'right');

    // 任意一只手触发大幅挥刀即为有效
    const isBigSwing = leftHand.isBigSwing || rightHand.isBigSwing;
    const isKnocking = leftHand.isKnocking || rightHand.isKnocking;

    // 取速度较大的一只手作为主要结果
    const primary = leftHand.velocity >= rightHand.velocity ? leftHand : rightHand;

    return {
      isBigSwing,
      isKnocking,
      velocity: primary.velocity,
      angle: primary.angle,
      wristPos: primary.wristPos,
      timestamp: performance.now(),
      leftHand,
      rightHand
    };
  }

  private analyzeHand(
    landmarks: NormalizedLandmark[],
    wristIdx: number,
    elbowIdx: number,
    shoulderIdx: number,
    hand: 'left' | 'right'
  ): SwingHandResult {
    const wrist = landmarks[wristIdx];
    const elbow = landmarks[elbowIdx];
    const shoulder = landmarks[shoulderIdx];

    if (!wrist || !elbow || !shoulder || (wrist.visibility ?? 0) < 0.5) {
      return this.emptyHandResult();
    }

    // 计算腕部速度（landmark 已在 main.ts 平滑，直接算速度）
    const velocity = this.calcVelocity(
      { x: wrist.x, y: wrist.y },
      hand
    );

    // 计算上臂-前臂夹角（landmark 已在 main.ts 做 EMA 平滑）
    const angle = this.calcArmAngle(shoulder, elbow, wrist);

    // 迟滞 + 速度门限：手不动时 velocity ≈ 0，不会触发
    const swingEnter = this.config.minAngle + 5; // 65°
    const swingExit = this.config.minAngle - 5;   // 55°
    const hasMotion = velocity > this.config.minVelocity;
    let isBigSwing: boolean;
    if (hand === 'left') {
      if (this.leftIsBigSwing) {
        isBigSwing = angle > swingExit && hasMotion;
      } else {
        isBigSwing = angle > swingEnter && hasMotion;
      }
      this.leftIsBigSwing = isBigSwing;
    } else {
      if (this.rightIsBigSwing) {
        isBigSwing = angle > swingExit && hasMotion;
      } else {
        isBigSwing = angle > swingEnter && hasMotion;
      }
      this.rightIsBigSwing = isBigSwing;
    }

    const isKnocking = angle < this.config.knockingAngleMax;

    return {
      isBigSwing,
      isKnocking,
      velocity,
      angle,
      wristPos: { x: wrist.x, y: wrist.y }
    };
  }

  private calcVelocity(wristPos: Point, hand: 'left' | 'right'): number {
    const lastPos = hand === 'left' ? this.lastLeftWristPos : this.lastRightWristPos;
    const history = hand === 'left' ? this.leftVelocityHistory : this.rightVelocityHistory;
    const lastTs = hand === 'left' ? this.lastLeftTimestamp : this.lastRightTimestamp;

    if (!lastPos || lastTs === 0) {
      if (hand === 'left') {
        this.lastLeftWristPos = wristPos;
        this.lastLeftTimestamp = performance.now();
      } else {
        this.lastRightWristPos = wristPos;
        this.lastRightTimestamp = performance.now();
      }
      return 0;
    }

    const dt = (performance.now() - lastTs) / 1000;
    if (dt === 0) return 0;

    const dx = wristPos.x - lastPos.x;
    const dy = wristPos.y - lastPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const velocity = distance / dt;

    // 速度平滑（短历史，减少延迟）
    history.push(velocity);
    if (history.length > this.config.historySize) {
      history.shift();
    }

    if (hand === 'left') {
      this.lastLeftWristPos = wristPos;
      this.lastLeftTimestamp = performance.now();
    } else {
      this.lastRightWristPos = wristPos;
      this.lastRightTimestamp = performance.now();
    }

    return history.reduce((a, b) => a + b, 0) / history.length;
  }

  private calcArmAngle(
    shoulder: NormalizedLandmark,
    elbow: NormalizedLandmark,
    wrist: NormalizedLandmark
  ): number {
    const v1 = { x: shoulder.x - elbow.x, y: shoulder.y - elbow.y };
    const v2 = { x: wrist.x - elbow.x, y: wrist.y - elbow.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle) * 180 / Math.PI;
  }

  private emptyHandResult(): SwingHandResult {
    return {
      isBigSwing: false,
      isKnocking: false,
      velocity: 0,
      angle: 0,
      wristPos: { x: 0, y: 0 }
    };
  }

  private emptyResult(): SwingResult {
    const emptyHand: SwingHandResult = {
      isBigSwing: false,
      isKnocking: false,
      velocity: 0,
      angle: 0,
      wristPos: { x: 0, y: 0 }
    };
    return {
      isBigSwing: false,
      isKnocking: false,
      velocity: 0,
      angle: 0,
      wristPos: { x: 0, y: 0 },
      timestamp: performance.now(),
      leftHand: emptyHand,
      rightHand: emptyHand
    };
  }

  reset(): void {
    this.lastLeftWristPos = null;
    this.lastRightWristPos = null;
    this.lastLeftTimestamp = 0;
    this.lastRightTimestamp = 0;
    this.leftVelocityHistory = [];
    this.rightVelocityHistory = [];
    this.leftIsBigSwing = false;
    this.rightIsBigSwing = false;
  }
}
