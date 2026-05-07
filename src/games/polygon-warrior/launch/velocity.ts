import { LaunchDirection } from './types.js';

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** 速度计算器 — 唯一之速度计算逻辑，所有发射策略皆须调用此处 */
export function calcLaunchVelocity(
  direction: LaunchDirection,
  _canvasW: number,
  _canvasH: number,
  speedMult: number,
  sides: number,
): { vx: number; vy: number } {
    const v0 = getSidesSpeedMultiplier(sides) * randomRange(1, 2) * speedMult * 0.5;

  switch (direction) {
    case 'left':
      return { vx: 2 * v0, vy: -v0 };

    case 'right':
      return { vx: -2 * v0, vy: -v0 };

    case 'top': {
      const vxSign = Math.random() > 0.5 ? 1 : -1;
      return { vx: 2 * vxSign * v0, vy: 0.2 * v0 };
    }

    case 'bottom': {
      const vxSign = Math.random() > 0.5 ? 1 : -1;
      return { vx: vxSign * v0, vy: -v0 };
    }
  }
}

/** 边数速度倍率（唯一之定义，勿于他处重复）*/
export function getSidesSpeedMultiplier(sides: number): number {
  return sides >= 3 ? 1 + (sides / 8) * 1 : 1;
}
