import { IGameMode } from '../../types/game.js';
import { SwingResult } from '../../types/swing.js';
import { Fruit } from './fruit.js';
import { SlicingSystem } from './slicing.js';
import { GameEngine } from '../../core/game-engine.js';
import { SoundManager } from '../../shared/sound-manager.js';

export class FruitNinjaGame implements IGameMode {
  readonly name = 'Fruit Ninja';
  readonly description = '挥刀切水果，避开炸弹！';

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private fruits: Fruit[] = [];
  private slicingSystem: SlicingSystem = new SlicingSystem();
  private gameEngine: GameEngine;
  private lastSpawnTime: number = 0;
  private spawnInterval = 3000; // ms（已减半，原值1500）

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine;
  }

  init(canvas: HTMLCanvasElement, glCanvas?: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    console.log('FruitNinjaGame initialized');
  }

  resize(): void {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // 每帧调用：更新水果物理、生成新水果、检测落空
  updatePhysics(): void {
    const now = Date.now();

    // 生成新水果
    if (now - this.lastSpawnTime > this.spawnInterval) {
      this.spawnFruit();
      this.lastSpawnTime = now;

      // 难度递增（已减半，原值递减50，最小800）
      if (this.spawnInterval > 1600) {
        this.spawnInterval -= 25;
      }
    }

    // 更新水果位置，检测落空
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];
      fruit.update();

      if (fruit.isMissed && !fruit.isSliced) {
        this.gameEngine.loseLife();
        this.fruits.splice(i, 1);
      } else if (fruit.isSliced) {
        this.fruits.splice(i, 1);
      }
    }
  }

  // 挥刀时调用：检测切中水果
  checkSlice(swingResult: SwingResult): void {
    if (!this.canvas) return;

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];

      if (this.slicingSystem.checkSlice(fruit, swingResult, this.canvas.width, this.canvas.height)) {
        fruit.slice();

        if (fruit.isBomb()) {
          this.gameEngine.loseLife();
        } else {
          // 切中水果才算：加分、连击、音效、显示"斩！"
          this.gameEngine.onFruitSliced(
            { x: fruit.x, y: fruit.y },
            fruit.getPoints()
          );
        }

        this.fruits.splice(i, 1);
      }
    }
  }

  update(swingResult: SwingResult): void {
    this.updatePhysics();
    this.slicingSystem.update();

    if (swingResult.isBigSwing) {
      this.checkSlice(swingResult);
      this.slicingSystem.updateTrail(swingResult, this.canvas!.width, this.canvas!.height);
    }
  }

  render(ctx?: CanvasRenderingContext2D, gl?: WebGL2RenderingContext): void {
    const context = ctx || this.ctx;
    if (!context || !this.canvas) return;

    // 清空画布
    context.fillStyle = 'rgba(0, 0, 0, 0.2)';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制背景
    context.fillStyle = '#1a1a2e';
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制 70% 区域边框（提示目标生成范围）
    const borderMarginX = this.canvas.width * 0.15;
    const borderMarginY = this.canvas.height * 0.15;
    context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    context.lineWidth = 2;
    context.setLineDash([8, 8]);
    context.strokeRect(
      borderMarginX,
      borderMarginY,
      this.canvas.width - borderMarginX * 2,
      this.canvas.height - borderMarginY * 2
    );
    context.setLineDash([]);

    // 绘制水果
    this.fruits.forEach(fruit => fruit.render(context));

    // 绘制刀光轨迹
    this.slicingSystem.renderTrail(context);

    // 绘制UI
    this.renderHUD(context);
  }

  private spawnFruit(): void {
    if (!this.canvas) return;
    const fruit = new Fruit(this.canvas.width, this.canvas.height);
    this.fruits.push(fruit);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 计分
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.gameEngine.getScore()}`, 20, 40);

    // 连击
    if (this.gameEngine.getCombo() > 1) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${this.gameEngine.getCombo()}`, w / 2, 50);
    }

    // 生命值
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    const lives = this.gameEngine.getLives();
    const hearts = '♥'.repeat(lives) + '♡'.repeat(3 - lives);
    ctx.fillText(hearts, w - 20, 40);
  }

  destroy(): void {
    this.fruits = [];
    this.slicingSystem.reset();
  }
}
