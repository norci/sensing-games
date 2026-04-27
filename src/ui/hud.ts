import { GameEngine, GameState } from '../core/game-engine.js';
import { MotionResult } from '../core/types.js';

/** HUD 配置（各游戏可定制） */
export interface HUDConfig {
  /** 游戏标题（欢迎界面） */
  title: string;
  /** 欢迎界面副标题 */
  welcomeSubtitle: string;
  /** 欢迎界面提示文字 */
  welcomePrompt: string;
  /** 暂停界面文字 */
  pausedText: string;
  /** 暂停界面提示 */
  pausedPrompt: string;
  /** 游戏结束标题 */
  gameOverTitle: string;
  /** 得分前缀文字 */
  scorePrefix: string;
  /** 重新开始提示 */
  restartPrompt: string;
}

const DEFAULT_HUD_CONFIG: HUDConfig = {
  title: '体感游戏',
  welcomeSubtitle: '挥动身体，开始游戏！',
  welcomePrompt: '请用大幅度动作开始游戏',
  pausedText: '暂停',
  pausedPrompt: '未检测到人体，请站到摄像头前',
  gameOverTitle: '游戏结束',
  scorePrefix: '最终得分: ',
  restartPrompt: '5秒后重新开始...',
};

export class HUD {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: HUDConfig;
  /** 游戏特定渲染回调（可选） */
  private customRenderPlay?: (ctx: CanvasRenderingContext2D, gameEngine: GameEngine) => void;

  constructor(canvas: HTMLCanvasElement, config?: Partial<HUDConfig>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = { ...DEFAULT_HUD_CONFIG, ...config };
  }

  /** 设置游戏特定渲染回调（PLAYING 状态时调用） */
  setCustomRender(fn: (ctx: CanvasRenderingContext2D, gameEngine: GameEngine) => void): void {
    this.customRenderPlay = fn;
  }

  render(gameEngine: GameEngine, motionResult?: MotionResult): void {
    const state = gameEngine.getState();

    if (state === GameState.IDLE) {
      this.renderWelcome();
    } else if (state === GameState.PAUSED) {
      this.renderPaused();
    } else if (state === GameState.PLAYING) {
      this.renderPlaying(gameEngine);
    } else if (state === GameState.GAME_OVER) {
      this.renderGameOver(gameEngine);
    }
  }

  private renderPaused(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.config.pausedText, w / 2, h / 2 - 20);

    ctx.fillStyle = '#cccccc';
    ctx.font = '20px Arial';
    ctx.fillText(this.config.pausedPrompt, w / 2, h / 2 + 20);
  }

  private renderWelcome(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.config.title, w / 2, h / 2 - 50);

    ctx.font = '24px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(this.config.welcomeSubtitle, w / 2, h / 2);
    ctx.fillText(this.config.welcomePrompt, w / 2, h / 2 + 40);
  }

  private renderPlaying(gameEngine: GameEngine): void {
    if (this.customRenderPlay) {
      this.customRenderPlay(this.ctx, gameEngine);
    }
  }

  private renderGameOver(gameEngine: GameEngine): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.config.gameOverTitle, w / 2, h / 2 - 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '32px Arial';
    ctx.fillText(`${this.config.scorePrefix}${gameEngine.getScore()}`, w / 2, h / 2);

    ctx.fillStyle = '#cccccc';
    ctx.font = '24px Arial';
    ctx.fillText(this.config.restartPrompt, w / 2, h / 2 + 50);
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
