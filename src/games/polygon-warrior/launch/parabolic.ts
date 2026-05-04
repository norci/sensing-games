import { LaunchParams, LaunchStrategy } from './types.js';
import { calcLaunchVelocity } from './velocity.js';

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class ParabolicLauncher implements LaunchStrategy {
  name = 'parabolic';

  generate(canvasW: number, canvasH: number, speedMult: number, sides?: number): LaunchParams {
    const margin = canvasW * 0.15;
    const x = randomRange(margin, canvasW - margin);
    const y = canvasH + 50;

    const { vx, vy: rawVy } = calcLaunchVelocity('bottom', canvasW, canvasH, speedMult, sides ?? 3);

    const gravity = 0.15;

    // 确保多边形能到达屏幕上半部分
    let vy = rawVy;
    const targetY = canvasH * 0.5;
    if (vy < 0 && y > targetY) {
      const minVyMag = Math.sqrt(2 * gravity * (y - targetY));
      const neededVy = -minVyMag;
      if (vy > neededVy) vy = neededVy;
    }

    return {
      startPos: { x, y },
      velocity: { vx, vy },
      gravity,
    };
  }
}
