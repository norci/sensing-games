import { Fruit } from './fruit.js';
import { SwingResult, SwingHandResult } from '../../types/swing.js';
import { lineCircleIntersect, Point } from '../../shared/math-utils.js';

interface HandSliceState {
  lastWristPos: Point | null;
  sliceTrail: Point[];
  isSwinging: boolean;
}

export class SlicingSystem {
  private leftHand: HandSliceState = { lastWristPos: null, sliceTrail: [], isSwinging: false };
  private rightHand: HandSliceState = { lastWristPos: null, sliceTrail: [], isSwinging: false };
  private readonly TRAIL_LENGTH = 10;

  // 在挥刀过程中持续更新双手轨迹
  updateTrail(swingResult: SwingResult, canvasWidth: number, canvasHeight: number): void {
    // 更新左手轨迹
    if (swingResult.leftHand) {
      this.updateHandTrail(this.leftHand, swingResult.leftHand, canvasWidth, canvasHeight);
    }
    // 更新右手轨迹
    if (swingResult.rightHand) {
      this.updateHandTrail(this.rightHand, swingResult.rightHand, canvasWidth, canvasHeight);
    }
  }

  private updateHandTrail(
    hand: HandSliceState,
    handResult: SwingHandResult,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const currentPos: Point = {
      x: (1 - handResult.wristPos.x) * canvasWidth,
      y: handResult.wristPos.y * canvasHeight
    };

    // 检测位置跳跃：如果上次位置距离过远（手从画面外回来），重置轨迹
    if (hand.lastWristPos) {
      const dx = currentPos.x - hand.lastWristPos.x;
      const dy = currentPos.y - hand.lastWristPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // 距离超过画布对角线的一半视为跳跃
      const maxDist = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight) * 0.5;
      if (dist > maxDist) {
        hand.sliceTrail = [];
        hand.lastWristPos = null;
      }
    }

    hand.sliceTrail.push(currentPos);
    if (hand.sliceTrail.length > this.TRAIL_LENGTH) {
      hand.sliceTrail.shift();
    }
    hand.lastWristPos = currentPos;
    hand.isSwinging = true;
  }

  // 每帧调用：更新轨迹状态，挥刀结束后轨迹逐渐消失
  update(): void {
    this.updateHandState(this.leftHand);
    this.updateHandState(this.rightHand);
  }

  private updateHandState(hand: HandSliceState): void {
    if (!hand.isSwinging && hand.sliceTrail.length > 0) {
      hand.sliceTrail.shift();
      if (hand.sliceTrail.length > 0) {
        hand.sliceTrail.shift();
      }
    }
    hand.isSwinging = false;
  }

  // 检测双手切割
  checkSlice(fruit: Fruit, swingResult: SwingResult, canvasWidth: number, canvasHeight: number): boolean {
    // 检查左手
    if (swingResult.leftHand?.isBigSwing) {
      if (this.checkHandSlice(this.leftHand, fruit, canvasWidth, canvasHeight)) return true;
    }
    // 检查右手
    if (swingResult.rightHand?.isBigSwing) {
      if (this.checkHandSlice(this.rightHand, fruit, canvasWidth, canvasHeight)) return true;
    }
    return false;
  }

  private checkHandSlice(
    hand: HandSliceState,
    fruit: Fruit,
    canvasWidth: number,
    canvasHeight: number
  ): boolean {
    if (!hand.lastWristPos) return false;

    const fruitCircle = fruit.getCircle();
    // 使用轨迹中所有最近的点段进行碰撞检测
    for (let i = 1; i < hand.sliceTrail.length; i++) {
      const isSliced = lineCircleIntersect(
        hand.sliceTrail[i - 1],
        hand.sliceTrail[i],
        fruitCircle
      );
      if (isSliced) return true;
    }
    return false;
  }

  renderTrail(ctx: CanvasRenderingContext2D): void {
    // 渲染左手轨迹（蓝色）
    this.renderHandTrail(ctx, this.leftHand, 'rgba(0, 200, 255, ', '#00ccff');
    // 渲染右手轨迹（橙色）
    this.renderHandTrail(ctx, this.rightHand, 'rgba(255, 150, 0, ', '#ff6600');
  }

  private renderHandTrail(
    ctx: CanvasRenderingContext2D,
    hand: HandSliceState,
    colorPrefix: string,
    debugColor: string
  ): void {
    if (hand.sliceTrail.length < 2) return;

    for (let i = 1; i < hand.sliceTrail.length; i++) {
      const alpha = i / hand.sliceTrail.length;
      const lineWidth = alpha * 8;

      ctx.beginPath();
      ctx.moveTo(hand.sliceTrail[i - 1].x, hand.sliceTrail[i - 1].y);
      ctx.lineTo(hand.sliceTrail[i].x, hand.sliceTrail[i].y);
      ctx.strokeStyle = `${colorPrefix}${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  reset(): void {
    this.leftHand = { lastWristPos: null, sliceTrail: [], isSwinging: false };
    this.rightHand = { lastWristPos: null, sliceTrail: [], isSwinging: false };
  }
}
