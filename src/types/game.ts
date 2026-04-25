import { SwingResult } from './swing.js';

export interface IGameMode {
  readonly name: string;
  readonly description: string;

  init(canvas: HTMLCanvasElement, glCanvas?: HTMLCanvasElement): void;
  update(swingData: SwingResult): void;
  render(ctx?: CanvasRenderingContext2D, gl?: WebGL2RenderingContext): void;
  destroy(): void;
  resize?(): void;
}

export interface GameConfig {
  swingThreshold: number;      // 挥刀判定阈值
  comboWindow: number;          // 连击时间窗口(ms)
  maxLives: number;             // 最大生命值
  difficulty: number;           // 难度系数
  practiceMode?: boolean;       // 练习模式（无失败）
}
