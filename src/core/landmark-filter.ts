/**
 * 速度自适应 IIR 滤波器
 *
 * 原理：α 与速度成正比
 * - 静止/抖动（速度 ≈ 0）→ α = minAlpha，重平滑
 * - 快速运动（速度 ≥ maxSpeed）→ α = 1，零延迟
 *
 * 速度必须由调用者从世界坐标（米）计算并以 米/秒 为单位传入。
 */
export interface LandmarkFilterOptions {
  /** 速度归一化上限（米/秒）*/
  maxSpeed?: number;
  /** 最小 α（静止时之平滑系数），默认 0.05 */
  minAlpha?: number;
}

interface FilteredPoint {
  x: number;
  y: number;
  z: number;
}

export class LandmarkFilter {
  private filtered = new Map<number, FilteredPoint>();
  private readonly maxSpeed: number;
  private readonly minAlpha: number;

  constructor(options: LandmarkFilterOptions = {}) {
    this.maxSpeed = options.maxSpeed ?? 3;
    this.minAlpha = options.minAlpha ?? 0.01;
  }

  /**
   * 滤波一帧之所有 landmarks
   * @param landmarks MediaPipe PoseLandmark 数组
   * @param speeds 速度数组（米/秒），必须由世界坐标计算
   * @returns 滤波后之 landmarks（新数组）
   */
  filter<T extends { x: number; y: number; z: number }>(
    landmarks: T[],
    speeds: number[]
  ): T[] {
    return landmarks.map((lm, i) => {
      const prev = this.filtered.get(i);
      const speed = speeds[i] ?? 0;

      if (!prev) {
        // 首帧：直接赋值
        this.filtered.set(i, { x: lm.x, y: lm.y, z: lm.z });
        return { ...lm };
      }

      // α 与速度成正比：α = clamp(speed / maxSpeed, minAlpha, 1)
      const alpha = Math.max(
        this.minAlpha,
        Math.min(speed / this.maxSpeed, 1)
      );

      const out: T = {
        ...lm,
        x: prev.x + (lm.x - prev.x) * alpha,
        y: prev.y + (lm.y - prev.y) * alpha,
        z: prev.z + (lm.z - prev.z) * alpha,
      };
      this.filtered.set(i, { x: out.x, y: out.y, z: out.z });
      return out;
    });
  }

  /** 重置所有滤波状态（切换游戏时调用） */
  reset(): void {
    this.filtered.clear();
  }
}
