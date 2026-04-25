/**
 *  landmarks 滤波器 - 对指定身体部位应用 OneEuroFilter 平滑
 */
import { OneEuroFilter } from '../shared/one-euro-filter.js';
import { BodyPartConfig } from './types.js';

export interface LandmarkFilterParams {
  frequency?: number;
  minCutoff?: number;
  beta?: number;
  dCutoff?: number;
}

const DEFAULT_PARAMS: Required<LandmarkFilterParams> = {
  frequency: 60,
  minCutoff: 2.0,
  beta: 0.8,
  dCutoff: 1.0,
};

export class LandmarkFilter {
  private filters: Map<string, { x: OneEuroFilter; y: OneEuroFilter }>;
  private partConfigs: BodyPartConfig[];
  private params: Required<LandmarkFilterParams>;

  constructor(
    partConfigs: BodyPartConfig[],
    params?: LandmarkFilterParams,
  ) {
    this.partConfigs = partConfigs;
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.filters = new Map();
    for (const cfg of partConfigs) {
      this.filters.set(cfg.id, {
        x: new OneEuroFilter(this.params.frequency, this.params.minCutoff, this.params.beta, this.params.dCutoff),
        y: new OneEuroFilter(this.params.frequency, this.params.minCutoff, this.params.beta, this.params.dCutoff),
      });
    }
  }

  /** 对 raw landmarks 应用滤波，返回新数组 */
  apply(raw: any[], now: number): any[] {
    const filtered = raw.map(p => ({ ...p }));
    for (const cfg of this.partConfigs) {
      const filters = this.filters.get(cfg.id);
      if (!filters) continue;
      const lm = raw[cfg.tipIdx];
      if (lm && (lm.visibility ?? 1) >= 0.5) {
        filtered[cfg.tipIdx].x = filters.x.filter(lm.x, now);
        filtered[cfg.tipIdx].y = filters.y.filter(lm.y, now);
      } else {
        filters.x.reset();
        filters.y.reset();
      }
    }
    return filtered;
  }

  /** 重置所有滤波器 */
  reset(): void {
    for (const f of this.filters.values()) {
      f.x.reset();
      f.y.reset();
    }
  }
}
