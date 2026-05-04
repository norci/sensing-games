import { BOTTOM_LAUNCH_MIN_RISE_FRACTION } from './utils.js';

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 速度计算器 — 唯一之速度计算逻辑，所有发射策略皆须调用此处
 *
 * 设计：
 *   - 底部发射：vy 由最小上升高度约束决定，难度与边数倍率仅影响 vx
 *   - 侧面发射：vx/vy 皆受难度与边数倍率影响
 */
export function calcLaunchVelocity(
  direction: 'left' | 'right',
  canvasW: number,
  canvasH: number,
  speedMult: number,
  sides: number,
): { vx: number; vy: number } {
  const v0 = getSidesSpeedMultiplier(sides)* randomRange(1, 2) * speedMult;

  switch (direction) {
    case 'left': {
      return {
        vx: v0*2,
        vy: -v0,
      };
    }

    case 'right': {
      return {
        vx: -v0*2,
        vy: -v0,
      };
    }
  }
}

/** 计算底部发射所需之最小 vy（负值，向上）*/
function calcMinVyForBottom(canvasH: number): number {
  const minHeight = canvasH * BOTTOM_LAUNCH_MIN_RISE_FRACTION;
  return -Math.sqrt(2 * 0.15 * minHeight);
}

/** 边数速度倍率（唯一之定义，勿于他处重复）*/
export function getSidesSpeedMultiplier(sides: number): number {
  return sides >= 3 ? 1 + (sides / 8) * 2 : 1;
}
