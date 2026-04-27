import { Fruit } from './fruit.js';
import { MotionResult, BodyPartResult } from '../../core/types.js';
import { TrailSystem, TrailPoint } from '../../core/trail-system.js';
import { lineCircleIntersect, pointToLineDistance } from '../../shared/collision-utils.js';

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
  private trailSystem: TrailSystem;

  constructor() {
    this.trailSystem = new TrailSystem();
  }

  // 在动作过程中持续更新轨迹（不论速率，始终画轨迹）
  updateTrail(motionResult: MotionResult, canvasWidth: number, canvasHeight: number): void {
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (part.detected) {
        const x = (1 - part.position.x) * canvasWidth;
        const y = part.position.y * canvasHeight;
        this.trailSystem.updateTrail(id, x, y);
      }
    }
  }

  // 检测切割
  checkSlice(fruit: Fruit, motionResult: MotionResult): boolean {
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (part && part.isBigSwing) {
        const trail = this.trailSystem.getTrail(id);
        if (trail.length >= 2 && this.checkPartSlice(trail, fruit)) return true;
      }
    }
    return false;
  }

  private checkPartSlice(
    trail: TrailPoint[],
    fruit: Fruit
  ): boolean {
    const fruitCircle = fruit.getCircle();
    const thickness = 15;

    for (let i = 1; i < trail.length; i++) {
      const isSliced = lineCircleIntersect(
        trail[i - 1],
        trail[i],
        fruitCircle
      );
      if (isSliced) return true;

      const dist = pointToLineDistance(
        { x: fruitCircle.x, y: fruitCircle.y },
        trail[i - 1],
        trail[i]
      );
      if (dist <= fruitCircle.radius + thickness) return true;
    }
    return false;
  }

  renderTrail(ctx: CanvasRenderingContext2D): void {
    this.trailSystem.render(ctx, (id) => {
      const colors = TRAIL_COLORS[id];
      return colors ? colors.prefix : null;
    });
  }

  reset(): void {
    this.trailSystem.clearAll();
  }
}
