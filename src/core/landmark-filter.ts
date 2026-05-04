export interface LandmarkFilterOptions {
  maxSpeed?: number;
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
    this.maxSpeed = options.maxSpeed ?? 1.5;
    this.minAlpha = options.minAlpha ?? 0.05;
  }

  filter<T extends { x: number; y: number; z: number }>(
    landmarks: T[],
    speeds: number[]
  ): T[] {
    return landmarks.map((lm, i) => {
      const prev = this.filtered.get(i);
      const speed = speeds[i] ?? 0;

      if (!prev) {
        this.filtered.set(i, { x: lm.x, y: lm.y, z: lm.z });
        return { ...lm };
      }

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

  reset(): void {
    this.filtered.clear();
  }
}
