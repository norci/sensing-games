import { LaunchParams, LaunchStrategy, LaunchDirection } from './types.js';
import { calcLaunchVelocity } from './velocity.js';

export class MultiDirectionLauncher implements LaunchStrategy {
  name = 'multi-direction';

  private directions: LaunchDirection[] = ['left', 'right'];

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
      case 'left':
        startPos = { x: -margin, y: randomRange(margin, canvasH * 0.5) };
        break;
      case 'right':
        startPos = { x: canvasW + margin, y: randomRange(margin, canvasH * 0.5) };
        break;
    }

    const { vx, vy } = calcLaunchVelocity(direction, canvasW, canvasH, speedMult, sides ?? 3);

    const gravity = 0.12;

    return { startPos, velocity: { vx, vy }, gravity };
  }
}

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
