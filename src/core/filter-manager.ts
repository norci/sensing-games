/**
 * 滤波管理器 — 管理双滤波器及速度计算
 *
 * 职责：
 * - 为归一化坐标与世界坐标各维护独立滤波器（避免坐标空间相互污染）
 * - 基于世界坐标计算速度（米/秒），用于自适应滤波
 * - 提供 apply() 方法，对检测结果应用滤波
 */
import { LandmarkFilter } from './landmark-filter.js';
import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export interface FilterManagerOptions {
  /** 传递给 LandmarkFilter 之选项 */
  filterOptions?: import('./landmark-filter.js').LandmarkFilterOptions;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export class FilterManager {
  private normFilter: LandmarkFilter;
  private worldFilter: LandmarkFilter;
  private prevWorldLandmarks: Point3D[] | null = null;
  private prevTimestamp = 0;

  constructor(options: FilterManagerOptions = {}) {
    this.normFilter = new LandmarkFilter(options.filterOptions);
    this.worldFilter = new LandmarkFilter(options.filterOptions);
  }

  /**
   * 对检测结果应用滤波
   * @param result PoseLandmarker 检测结果
   * @returns 滤波后之结果（直接修改原对象，因 detectForVideo 每次返回新对象）
   */
  apply(result: PoseLandmarkerResult): PoseLandmarkerResult {
    if (!result.worldLandmarks || !result.landmarks) {
      return result;
    }

    const world = result.worldLandmarks[0];
    const norms = result.landmarks[0];
    if (!world || !norms) return result;

    // 计算速度（米/秒）
    const speeds = this.calcSpeeds(world);

    // 对归一化坐标滤波（用于渲染）
    // 注：landmarks 与 worldLandmarks 为只读属性，须用类型断言
    (result as any).landmarks = [this.normFilter.filter(norms, speeds)];

    // 对世界坐标滤波（用于运动分析）
    (result as any).worldLandmarks = [this.worldFilter.filter(world, speeds)];

    return result;
  }

  /**
   * 基于世界坐标计算速度（米/秒）
   */
  private calcSpeeds(worldLandmarks: Point3D[]): number[] {
    const now = performance.now();
    const speeds: number[] = [];

    if (this.prevWorldLandmarks && this.prevTimestamp > 0) {
      const dt = (now - this.prevTimestamp) / 1000; // 秒
      if (dt > 0) {
        for (let i = 0; i < worldLandmarks.length; i++) {
          const curr = worldLandmarks[i];
          const prev = this.prevWorldLandmarks[i];
          if (curr && prev) {
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const dz = curr.z - prev.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            speeds[i] = dist / dt;
          } else {
            speeds[i] = 0;
          }
        }
      }
    }

    // 保存当前帧供下一帧使用
    this.prevWorldLandmarks = worldLandmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
    this.prevTimestamp = now;

    return speeds;
  }

  /** 重置所有滤波状态（切换游戏或人体重新出现时调用） */
  reset(): void {
    this.normFilter.reset();
    this.worldFilter.reset();
    this.prevWorldLandmarks = null;
    this.prevTimestamp = 0;
  }
}
