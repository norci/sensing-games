/** 带时间戳的轨迹点 */
export interface TrailPoint {
  x: number;
  y: number;
  createdAt: number;  // 创建时间戳（ms）
}

export interface TrailConfig {
  /** 轨迹淡化时间（ms），默认 500ms */
  fadeTime?: number;
  /** 插值密度（像素），默认 20px */
  interpolateStep?: number;
  /** 最大点数，超此数时滤除超时点，默认 200 */
  maxPoints?: number;
  /** 轨迹线宽（像素），默认 1 */
  lineWidth?: number;
}

const DEFAULT_TRAIL_CONFIG: Required<TrailConfig> = {
  fadeTime: 500,
  interpolateStep: 20,
  maxPoints: 200,
  lineWidth: 1,
};

interface PartTrailState {
  points: TrailPoint[];
}

export class TrailSystem {
  private trails: Map<string, PartTrailState> = new Map();
  private config: Required<TrailConfig>;

  constructor(config?: TrailConfig) {
    this.config = { ...DEFAULT_TRAIL_CONFIG, ...config };
  }

  /**
   * 更新某部位的轨迹
   * @param id 部位标识（如 'leftHand', 'head'）
   * @param x 屏幕 x 坐标（像素）
   * @param y 屏幕 y 坐标（像素）
   */
  updateTrail(id: string, x: number, y: number): void {
    const now = performance.now();
    const state = this.getOrCreateState(id);
    const last = state.points.length > 0 ? state.points[state.points.length - 1] : null;

    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = this.config.interpolateStep;
      if (dist > step) {
        const steps = Math.floor(dist / step);
        for (let i = 1; i <= steps; i++) {
          const t = i / (steps + 1);
          state.points.push({
            x: last.x + dx * t,
            y: last.y + dy * t,
            createdAt: now,
          });
        }
      }
    }

    state.points.push({ x, y, createdAt: now });
  }

  /**
   * 渲染所有轨迹
   * @param ctx Canvas 上下文
   * @param getColor 根据部位 id 返回颜色前缀（如 'rgba(0,200,255,'）
   */
  render(ctx: CanvasRenderingContext2D, getColor: (id: string) => string | null): void {
    const now = performance.now();
    const fadeTime = this.config.fadeTime;

    for (const [id, state] of this.trails.entries()) {
      const colorPrefix = getColor(id);
      if (!colorPrefix || state.points.length < 2) continue;

      // 限幅：超 maxPoints 时，滤除超时点
      if (state.points.length > this.config.maxPoints) {
        const cutoff = now - fadeTime;
        state.points = state.points.filter(p => p.createdAt >= cutoff);
      }

      ctx.lineWidth = this.config.lineWidth;
      ctx.lineCap = 'round';

      for (let i = 1; i < state.points.length; i++) {
        const prev = state.points[i - 1];
        const age = now - prev.createdAt;
        const alpha = Math.max(0, 1 - age / fadeTime);

        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(state.points[i].x, state.points[i].y);
        ctx.strokeStyle = `${colorPrefix}${alpha})`;
        ctx.stroke();
      }
    }
  }

  /** 获取某部位的轨迹点（用于碰撞检测） */
  getTrail(id: string): TrailPoint[] {
    return this.trails.get(id)?.points ?? [];
  }

  /** 设置某部位的轨迹点（供外部覆盖，如从保存的状态恢复） */
  setTrail(id: string, points: TrailPoint[]): void {
    this.getOrCreateState(id).points = points;
  }

  /** 清除某部位的轨迹 */
  clearTrail(id: string): void {
    this.trails.delete(id);
  }

  /** 清除所有轨迹 */
  clearAll(): void {
    this.trails.clear();
  }

  private getOrCreateState(id: string): PartTrailState {
    if (!this.trails.has(id)) {
      this.trails.set(id, { points: [] });
    }
    return this.trails.get(id)!;
  }
}
