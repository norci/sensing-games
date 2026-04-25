import { Fruit } from './fruit.js';
import { MotionResult, BodyPartResult, BodyPartId } from '../../core/types.js';
import { lineCircleIntersect, pointToLineDistance, Point } from '../../shared/math-utils.js';

/** 带时间戳的轨迹点 */
interface TrailPoint {
  x: number;
  y: number;
  createdAt: number;  // 创建时间戳（ms）
}

interface PartSliceState {
  sliceTrail: TrailPoint[];
  isSwinging: boolean;
}

/** 每个身体部位的轨迹颜色 */
const TRAIL_COLORS: Record<string, { prefix: string; hex: string }> = {
  head:       { prefix: 'rgba(180, 100, 255, ', hex: '#b464ff' },
  leftHand:  { prefix: 'rgba(0, 200, 255, ',   hex: '#00ccff' },
  rightHand: { prefix: 'rgba(255, 150, 0, ',   hex: '#ff6600' },
  leftFoot:  { prefix: 'rgba(0, 255, 100, ',   hex: '#00ff64' },
  rightFoot: { prefix: 'rgba(255, 100, 200, ', hex: '#ff64c8' },
  leftElbow:  { prefix: 'rgba(0, 150, 200, ',   hex: '#0096c8' },
  rightElbow: { prefix: 'rgba(200, 100, 0, ',   hex: '#c86400' },
  leftKnee:   { prefix: 'rgba(0, 200, 150, ',   hex: '#00c896' },
  rightKnee:  { prefix: 'rgba(200, 50, 100, ',  hex: '#c83264' },
};

export class SlicingSystem {
  private trails: Map<string, PartSliceState> = new Map();

  // 在动作过程中持续更新轨迹（不论速率，始终画轨迹）
  updateTrail(motionResult: MotionResult, canvasWidth: number, canvasHeight: number): void {
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (part.detected) {  // 不论速率，始终更新轨迹
        const state = this.getOrCreateState(id);
        this.updatePartTrail(state, part, canvasWidth, canvasHeight);
      }
    }
  }

  private updatePartTrail(
    state: PartSliceState,
    part: BodyPartResult,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const now = performance.now();
    const currentPos: Point = {
      x: (1 - part.position.x) * canvasWidth,
      y: part.position.y * canvasHeight
    };

    // 用 trail 末点作前位
    if (state.sliceTrail.length > 0) {
      const lastPoint = state.sliceTrail[state.sliceTrail.length - 1];
      const dx = currentPos.x - lastPoint.x;
      const dy = currentPos.y - lastPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
	// 每 n 像素补一点（减密度，防卡顿）
      const step = 30;
      if (dist > step) {
        const steps = Math.floor(dist / step);
        for (let i = 1; i <= steps; i++) {
          const t = i / (steps + 1);
          state.sliceTrail.push({
            x: lastPoint.x + dx * t,
            y: lastPoint.y + dy * t,
            createdAt: now,  // 插值点也带时间戳
          });
        }
      }
    }

    state.sliceTrail.push({ ...currentPos, createdAt: now });
    // 轨迹长度由 TRAIL_FADE_TIME 控制（renderPartTrail 中去除超时点）
    state.isSwinging = true;
  }

  // 检测切割
  checkSlice(fruit: Fruit, motionResult: MotionResult, canvasWidth: number, canvasHeight: number): boolean {
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (part && part.isBigSwing) {
        const state = this.trails.get(id);
        if (state && this.checkPartSlice(state, fruit)) return true;
      }
    }
    return false;
  }

  private checkPartSlice(
    state: PartSliceState,
    fruit: Fruit
  ): boolean {
    if (state.sliceTrail.length < 2) return false;

    const fruitCircle = fruit.getCircle();
    const thickness = 15; // 线段厚度（像素），适配快速移动

    for (let i = 1; i < state.sliceTrail.length; i++) {
      const isSliced = lineCircleIntersect(
        state.sliceTrail[i - 1],
        state.sliceTrail[i],
        fruitCircle
      );
      if (isSliced) return true;

      // 加粗检测：水果圆心到线段的距离 <= 圆半径 + 厚度
      const dist = pointToLineDistance(
        { x: fruitCircle.x, y: fruitCircle.y },
        state.sliceTrail[i - 1],
        state.sliceTrail[i]
      );
      if (dist <= fruitCircle.radius + thickness) return true;
    }
    return false;
  }

  renderTrail(ctx: CanvasRenderingContext2D): void {
    for (const [id, state] of this.trails.entries()) {
      const colors = TRAIL_COLORS[id] || { prefix: 'rgba(255, 255, 255, ', hex: '#ffffff' };
      this.renderPartTrail(ctx, state, colors.prefix);
    }
  }

  private readonly TRAIL_FADE_TIME = 500; // 轨迹淡化时间（ms）

  private renderPartTrail(
    ctx: CanvasRenderingContext2D,
    state: PartSliceState,
    colorPrefix: string
  ): void {
    if (state.sliceTrail.length < 2) return;

    const now = performance.now();

    if (state.sliceTrail.length > 100) {
      const cutoff = now - this.TRAIL_FADE_TIME;
      state.sliceTrail = state.sliceTrail.filter(p => p.createdAt >= cutoff);
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    for (let i = 1; i < state.sliceTrail.length; i++) {
      const prevPoint = state.sliceTrail[i - 1];
      const age = now - prevPoint.createdAt;
      const alpha = Math.max(0, 1 - age / this.TRAIL_FADE_TIME);

      ctx.beginPath();
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(state.sliceTrail[i].x, state.sliceTrail[i].y);
      ctx.strokeStyle = `${colorPrefix}${alpha})`;
      ctx.stroke();
    }
  }

  private getOrCreateState(id: string): PartSliceState {
    if (!this.trails.has(id)) {
      this.trails.set(id, { sliceTrail: [], isSwinging: false });
    }
    return this.trails.get(id)!;
  }

  reset(): void {
    this.trails.clear();
  }
}
