import { LandmarkFilter } from './landmark-filter.js';
import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export interface FilterManagerOptions {
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

  apply(result: PoseLandmarkerResult): PoseLandmarkerResult {
    const world = result.worldLandmarks![0];
    const norms = result.landmarks![0];

    const speeds = this.calcSpeeds(world);

    (result as any).landmarks = [this.normFilter.filter(norms, speeds)];

    (result as any).worldLandmarks = [this.worldFilter.filter(world, speeds)];

    return result;
  }

  private calcSpeeds(worldLandmarks: Point3D[]): number[] {
    const now = performance.now();
    const speeds: number[] = [];

    if (this.prevWorldLandmarks && this.prevTimestamp > 0) {
      const dt = (now - this.prevTimestamp) / 1000;
      if (dt > 0) {
        for (let i = 0; i < worldLandmarks.length; i++) {
          const curr = worldLandmarks[i];
          const prev = this.prevWorldLandmarks[i];
          if (curr && prev) {
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const dz = curr.z - prev.z;
            const dist = Math.hypot(dx, dy, dz);
            speeds[i] = dist / dt;
          } else {
            speeds[i] = 0;
          }
        }
      }
    }

    this.prevWorldLandmarks = worldLandmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
    this.prevTimestamp = now;

    return speeds;
  }

  reset(): void {
    this.normFilter.reset();
    this.worldFilter.reset();
    this.prevWorldLandmarks = null;
    this.prevTimestamp = 0;
  }
}
