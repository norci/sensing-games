import { LaunchStrategy, LaunchMode } from './types.js';
import { ParabolicLauncher } from './parabolic.js';
import { MultiDirectionLauncher } from './multi-direction.js';

/**
 * 创建发射器
 * @param mode 发射模式
 * @returns 对应的发射策略实例
 */
export function createLauncher(mode: LaunchMode = 'multi-direction'): LaunchStrategy {
  switch (mode) {
    case 'parabolic':
      return new ParabolicLauncher();
    case 'multi-direction':
      return new MultiDirectionLauncher();
    default:
      return new MultiDirectionLauncher();
  }
}
