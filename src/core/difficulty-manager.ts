/**
 * 难度管理器 - 自适应难度调整
 * 根据屏幕上水果数量动态调整难度系数（0~1）
 */
export interface DifficultyConfig {
  /** 难度调整步长 */
  step: number;
  /** 难度评估间隔(ms) */
  checkInterval: number;
  /** 目标屏幕上水果数量 */
  targetOnScreen: number;
  /** 难度 0 时的出生间隔(ms) */
  spawnIntervalMax: number;
  /** 难度 1 时的出生间隔(ms) */
  spawnIntervalMin: number;
  /** 难度 0 时的速度倍率 */
  speedMin: number;
  /** 难度 1 时的速度倍率 */
  speedMax: number;
}

const DEFAULT_DIFFICULTY_CONFIG: DifficultyConfig = {
  step: 0.05,
  checkInterval: 8000,
  targetOnScreen: 3,
  spawnIntervalMax: 1500,
  spawnIntervalMin: 300,
  speedMin: 0.8,
  speedMax: 1.8,
};

export class DifficultyManager {
  private difficulty: number;
  private lastCheckTime: number = 0;
  private onScreenSamples: number[] = [];
  private readonly config: DifficultyConfig;

  constructor(config?: Partial<DifficultyConfig>) {
    this.config = { ...DEFAULT_DIFFICULTY_CONFIG, ...config };
    this.difficulty = 0.3; // 初始难度
  }

  /** 每帧采样屏幕上水果数量 */
  sample(onScreenCount: number): void {
    this.onScreenSamples.push(onScreenCount);
  }

  /** 更新难度，返回当前难度系数（0~1） */
  update(now: number): number {
    if (now - this.lastCheckTime > this.config.checkInterval) {
      this.lastCheckTime = now;
      this.adjustDifficulty();
    }
    return this.difficulty;
  }

  private adjustDifficulty(): void {
    if (this.onScreenSamples.length === 0) return;

    const avg = this.onScreenSamples.reduce((a, b) => a + b, 0) / this.onScreenSamples.length;
    this.onScreenSamples = [];

    if (avg > this.config.targetOnScreen + 1) {
      this.difficulty = Math.max(this.difficulty - this.config.step, 0);
    } else if (avg < this.config.targetOnScreen - 1) {
      this.difficulty = Math.min(this.difficulty + this.config.step, 1);
    }
  }

  /** 根据当前难度计算出生间隔(ms) */
  getSpawnInterval(): number {
    return this.config.spawnIntervalMax
      - (this.config.spawnIntervalMax - this.config.spawnIntervalMin) * this.difficulty;
  }

  /** 根据当前难度计算速度倍率 */
  getSpeedMultiplier(): number {
    return this.config.speedMin
      + (this.config.speedMax - this.config.speedMin) * this.difficulty;
  }

  reset(): void {
    this.difficulty = 0.3;
    this.lastCheckTime = 0;
    this.onScreenSamples = [];
  }

  getDifficulty(): number {
    return this.difficulty;
  }
}
