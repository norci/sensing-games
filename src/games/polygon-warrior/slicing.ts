import { Shape } from './shape.js';
import { MotionResult, BodyPartId } from '../../core/types.js';
import { TrailSystem } from '../../core/trail-system.js';
import { lineCircleIntersect, pointToLineDistance } from '../../shared/collision-utils.js';

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

const SLICEABLE_PARTS: BodyPartId[] = ['leftHand', 'rightHand', 'leftFoot', 'rightFoot'];

const SLICE_THICKNESS = 12;

export class SlicingSystem {
  private trailSystem: TrailSystem;
  private prevPositions: Map<string, { x: number; y: number }> = new Map();
  private currentFramePrev: Map<string, { x: number; y: number }> = new Map();
  private historyQueue: Map<string, { x: number; y: number; timestamp: number }[]> = new Map();
  private canvasW = 0;
  private canvasH = 0;
  private readonly HISTORY_LENGTH = 6;
  private readonly DIRECTION_CONSISTENCY_THRESHOLD = 0.7;

  constructor() {
    this.trailSystem = new TrailSystem();
  }

  updateTrail(motionResult: MotionResult, canvasWidth: number, canvasHeight: number): void {
    this.canvasW = canvasWidth;
    this.canvasH = canvasHeight;

    this.currentFramePrev = new Map(this.prevPositions);

    const now = performance.now();
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (!part.detected || !part.position) continue;
      const x = (1 - part.position.x) * canvasWidth;
      const y = part.position.y * canvasHeight;
      this.prevPositions.set(id, { x, y });
      this.trailSystem.updateTrail(id, x, y);

      let queue = this.historyQueue.get(id);
      if (!queue) {
        queue = [];
        this.historyQueue.set(id, queue);
      }
      queue.push({ x, y, timestamp: now });
      if (queue.length > this.HISTORY_LENGTH) {
        queue.shift();
      }
    }
  }

  checkSlice(shape: Shape, motionResult: MotionResult): boolean {
    const shapeCircle = shape.getCircle();

    for (const partId of SLICEABLE_PARTS) {
      const part = motionResult.parts[partId];
      if (!part || !part.isBigSwing || !part.position) continue;

      const currX = (1 - part.position.x) * this.canvasW;
      const currY = part.position.y * this.canvasH;

      const dx = currX - shapeCircle.x;
      const dy = currY - shapeCircle.y;
      if (dx * dx + dy * dy <= (shapeCircle.radius + SLICE_THICKNESS) ** 2) {
        return true;
      }

      const prev = this.currentFramePrev.get(partId);
      if (prev) {
        const history = this.historyQueue.get(partId);
        if (history && history.length >= 3) {
          if (!this.checkDirectionConsistency(history, prev, { x: currX, y: currY })) {
            continue;
          }
        }

        const expandedCircle = {
          x: shapeCircle.x,
          y: shapeCircle.y,
          radius: shapeCircle.radius + SLICE_THICKNESS
        };

        const isSliced = lineCircleIntersect(prev, { x: currX, y: currY }, expandedCircle);
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

  private checkDirectionConsistency(
    history: { x: number; y: number; timestamp: number }[],
    prev: { x: number; y: number },
    curr: { x: number; y: number }
  ): boolean {
    const dxCurr = curr.x - prev.x;
    const dyCurr = curr.y - prev.y;
    const magCurr = Math.hypot(dxCurr, dyCurr);

    if (magCurr < 4) return false;

    let dxHist = 0, dyHist = 0;
    for (let i = 1; i < history.length; i++) {
      dxHist += history[i].x - history[i-1].x;
      dyHist += history[i].y - history[i-1].y;
    }

    const magHist = Math.hypot(dxHist, dyHist);
    if (magHist < 4) return true;

    const cosine = (dxCurr * dxHist + dyCurr * dyHist) / (magCurr * magHist);
    return cosine > this.DIRECTION_CONSISTENCY_THRESHOLD;
  }

  reset(): void {
    this.trailSystem.clearAll();
    this.prevPositions.clear();
    this.currentFramePrev.clear();
    this.historyQueue.clear();
  }
}
