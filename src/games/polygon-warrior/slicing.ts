import { Shape } from './shape.js';
import { MotionResult, BodyPartId } from '../../core/types.js';
import { TrailSystem } from '../../core/trail-system.js';
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

/** 可切割的身体部位（手部 + 脚部） */
const SLICEABLE_PARTS: BodyPartId[] = ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'];

/** 切割判定厚度（像素） */
const SLICE_THICKNESS = 8;

export class SlicingSystem {
  private trailSystem: TrailSystem;
  /** 上一帧各部位之屏幕坐标（供下一帧做扫掠检测） */
  private prevPositions: Map<string, { x: number; y: number }> = new Map();
  /** 当前帧的上一帧位置（在 updateTrail 开头保存） */
  private currentFramePrev: Map<string, { x: number; y: number }> = new Map();
  private canvasW = 0;
  private canvasH = 0;

  constructor() {
    this.trailSystem = new TrailSystem();
  }

  /**
   * 更新轨迹（须先于 checkSlice 调用）
   * 1. 保存上一帧位置供本次 checkSlice 使用
   * 2. 更新 prevPositions 为当前帧坐标（供下一帧使用）
   * 3. 更新轨迹系统（仅作渲染）
   */
  updateTrail(motionResult: MotionResult, canvasWidth: number, canvasHeight: number): void {
    this.canvasW = canvasWidth;
    this.canvasH = canvasHeight;

    // 保存上一帧位置，供本次 checkSlice 使用
    this.currentFramePrev = new Map(this.prevPositions);

    // 更新 prevPositions 为当前帧坐标（供下一帧使用）
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (part.detected && part.position) {
        const x = (1 - part.position.x) * canvasWidth;
        const y = part.position.y * canvasHeight;
        this.prevPositions.set(id, { x, y });
      }
    }

    // 更新轨迹（仅作渲染）
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (part.detected) {
        const x = (1 - part.position.x) * canvasWidth;
        const y = part.position.y * canvasHeight;
        this.trailSystem.updateTrail(id, x, y);
      }
    }
  }

  /**
   * 切割检测：仅用当前帧 + 上一帧位置（同一时空方为击中）
   * 轨迹仅作渲染，不作碰撞检测
   */
  checkSlice(shape: Shape, motionResult: MotionResult): boolean {
    const shapeCircle = shape.getCircle();

    for (const partId of SLICEABLE_PARTS) {
      const part = motionResult.parts[partId];
      if (!part || !part.isBigSwing || !part.position) continue;

      const currX = (1 - part.position.x) * this.canvasW;
      const currY = part.position.y * this.canvasH;

      // 检测一：当前位置在圆内
      const dx = currX - shapeCircle.x;
      const dy = currY - shapeCircle.y;
      if (dx * dx + dy * dy <= (shapeCircle.radius + SLICE_THICKNESS) ** 2) {
        return true;
      }

      // 检测二：上一帧至当前帧之线段穿过圆形（扫掠检测）
      const prev = this.currentFramePrev.get(partId);
      if (prev) {
        const isSliced = lineCircleIntersect(prev, { x: currX, y: currY }, shapeCircle);
        if (isSliced) return true;

        const dist = pointToLineDistance(
          { x: shapeCircle.x, y: shapeCircle.y },
          prev,
          { x: currX, y: currY }
        );
        if (dist <= shapeCircle.radius + SLICE_THICKNESS) return true;
      }
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
    this.prevPositions.clear();
    this.currentFramePrev.clear();
  }
}
