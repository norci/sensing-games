import { GameEngine, GameState } from '../core/game-engine.js';
import { MotionResult } from '../core/types.js';

export class HUD {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
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
    ctx.fillText('暂停', w / 2, h / 2 - 20);

    ctx.fillStyle = '#cccccc';
    ctx.font = '20px Arial';
    ctx.fillText('未检测到人体，请站到摄像头前', w / 2, h / 2 + 20);
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
    ctx.fillText('体感水果忍者', w / 2, h / 2 - 50);

    ctx.font = '24px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('挥动单刀切水果，避开炸弹！', w / 2, h / 2);
    ctx.fillText('请用右手大幅度挥刀开始游戏', w / 2, h / 2 + 40);
  }

  private renderPlaying(gameEngine: GameEngine): void {
    const sliceInfo = gameEngine.getLastSliceInfo();
    const timeSinceSlice = Date.now() - sliceInfo.time;
    if (sliceInfo.time > 0 && timeSinceSlice < 300) {
      const ctx = this.ctx;
      const alpha = 1 - timeSinceSlice / 300;
      ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('斩！', sliceInfo.pos.x, sliceInfo.pos.y - 30);
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
    ctx.fillText('游戏结束', w / 2, h / 2 - 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '32px Arial';
    ctx.fillText(`最终得分: ${gameEngine.getScore()}`, w / 2, h / 2);

    ctx.fillStyle = '#cccccc';
    ctx.font = '24px Arial';
    ctx.fillText('5秒后重新开始...', w / 2, h / 2 + 50);
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
