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

    const { vx, vy } = calcLaunchVelocity('bottom', canvasW, canvasH, speedMult, sides ?? 3);

    return {
      startPos: { x, y },
      velocity: { vx, vy },
      gravity: 0.15,
    };
  }
}
