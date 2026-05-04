import { LaunchParams, LaunchStrategy, LaunchDirection } from './types.js';
import { calcLaunchVelocity } from './velocity.js';

export class MultiDirectionLauncher implements LaunchStrategy {
  name = 'multi-direction';

  private directions: LaunchDirection[] = ['top', 'bottom', 'left', 'right'];

  generate(canvasW: number, canvasH: number, speedMult: number, sides?: number): LaunchParams {
    const direction = this.directions[Math.floor(Math.random() * this.directions.length)];
    return this.generateFromDirection(direction, canvasW, canvasH, speedMult, sides);
  }

  private generateFromDirection(
    direction: LaunchDirection,
    canvasW: number,
    canvasH: number,
    speedMult: number,
    sides?: number,
  ): LaunchParams {
    const margin = 50;

    let startPos: { x: number; y: number };
    switch (direction) {
      case 'top':
        startPos = { x: randomRange(margin, canvasW - margin), y: -margin };
        break;
      case 'bottom':
        startPos = { x: randomRange(margin, canvasW - margin), y: canvasH + margin };
        break;
      case 'left':
        startPos = { x: -margin, y: randomRange(margin, canvasH - margin) };
        break;
      case 'right':
        startPos = { x: canvasW + margin, y: randomRange(margin, canvasH - margin) };
        break;
    }

    const { vx, vy: rawVy } = calcLaunchVelocity(direction, canvasW, canvasH, speedMult, sides ?? 3);

    const gravity = 0.12;

    // 确保多边形能到达屏幕上半部分（y <= canvasH * 0.5）
    // 物理：最高处 y = startPos.y - vy²/(2g)，须 <= canvasH * 0.5
    // 故 |vy| >= sqrt(2g * (startPos.y - canvasH*0.5))（当 startPos.y > 目标时）
    let vy = rawVy;
    const targetY = canvasH * 0.5;
    if (vy < 0 && startPos.y > targetY) {
      const minVyMag = Math.sqrt(2 * gravity * (startPos.y - targetY));
      const neededVy = -minVyMag;
      if (vy > neededVy) vy = neededVy;
    }

    return { startPos, velocity: { vx, vy }, gravity };
  }
}

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
