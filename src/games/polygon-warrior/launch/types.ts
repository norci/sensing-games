/**
 * 发射系统类型定义
 */

/** 发射参数 */
export interface LaunchParams {
  /** 起始位置 */
  startPos: { x: number; y: number };
  /** 初速度 */
  velocity: { vx: number; vy: number };
  /** 重力加速度（正值为向下） */
  gravity: number;
}

/** 发射策略接口 */
export interface LaunchStrategy {
  name: string;
  generate(canvasW: number, canvasH: number, speedMult: number, sides?: number): LaunchParams;
}

/** 发射模式 */
export type LaunchMode = 'parabolic' | 'multi-direction';

/** 发射方向 */
export type LaunchDirection = 'top' | 'bottom' | 'left' | 'right';
