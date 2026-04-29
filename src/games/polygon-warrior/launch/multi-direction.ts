import { LaunchParams, LaunchStrategy, LaunchDirection } from './types.js';
import { randomRange } from '../../../shared/math-utils.js';

/**
 * 多方向发射器
 * 从四个方向随机发射，增加游戏多样性和挑战性
 */
export class MultiDirectionLauncher implements LaunchStrategy {
  name = 'multi-direction';

  private directions: LaunchDirection[] = ['bottom', 'left', 'right', 'top'];

  generate(canvasW: number, canvasH: number, speedMult: number): LaunchParams {
    const direction = this.directions[Math.floor(Math.random() * this.directions.length)];
    return this.generateFromDirection(direction, canvasW, canvasH, speedMult);
  }

  private generateFromDirection(
    direction: LaunchDirection,
    canvasW: number,
    canvasH: number,
    speedMult: number
  ): LaunchParams {
    const margin = 50;
    const baseSpeed = 10 * speedMult;

    switch (direction) {
      case 'bottom':
        return {
          startPos: { x: randomRange(margin, canvasW - margin), y: canvasH + margin },
          velocity: {
            vx: randomRange(-3, 3) * speedMult,
            vy: -randomRange(baseSpeed * 0.8, baseSpeed * 1.2),
          },
          gravity: 0.15,
        };

      case 'left':
        return {
          startPos: { x: -margin, y: randomRange(canvasH * 0.3, canvasH * 0.7) },
          velocity: {
            vx: randomRange(baseSpeed * 0.5, baseSpeed * 0.8),
            vy: -randomRange(baseSpeed * 0.3, baseSpeed * 0.6),
          },
          gravity: 0.12,
        };

      case 'right':
        return {
          startPos: { x: canvasW + margin, y: randomRange(canvasH * 0.3, canvasH * 0.7) },
          velocity: {
            vx: -randomRange(baseSpeed * 0.5, baseSpeed * 0.8),
            vy: -randomRange(baseSpeed * 0.3, baseSpeed * 0.6),
          },
          gravity: 0.12,
        };

      case 'top':
        return {
          startPos: { x: randomRange(margin, canvasW - margin), y: -margin },
          velocity: {
            vx: randomRange(-4, 4) * speedMult,
            vy: randomRange(baseSpeed * 0.3, baseSpeed * 0.6),
          },
          gravity: 0.15,
        };
    }
  }
}
