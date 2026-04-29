import { LaunchParams, LaunchStrategy } from './types.js';
import { randomRange } from '../../../shared/math-utils.js';

/**
 * 抛物线发射器
 * 从底部随机位置发射，形成抛物线轨迹
 */
export class ParabolicLauncher implements LaunchStrategy {
  name = 'parabolic';

  generate(canvasW: number, canvasH: number, speedMult: number): LaunchParams {
    // 从底部 15% 区域随机位置发射
    const margin = canvasW * 0.15;
    const x = randomRange(margin, canvasW - margin);
    const y = canvasH + 50; // 从屏幕外底部发射

    // 初速度：向上（vy 负），加随机水平速度
    const baseSpeed = 12 * speedMult;
    const vx = randomRange(-3, 3) * speedMult;
    const vy = -randomRange(baseSpeed * 0.8, baseSpeed * 1.2);

    return {
      startPos: { x, y },
      velocity: { vx, vy },
      gravity: 0.15, // 重力加速度
    };
  }
}
