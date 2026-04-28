import { IGameMode, MotionResult, Point } from '../../core/types.js';
import { Fruit } from './fruit.js';
import { SlicingSystem } from './slicing.js';
import { GameEngine } from '../../core/game-engine.js';
import { DifficultyManager } from '../../core/difficulty-manager.js';
import { FragmentParticleSystem } from '../../core/particle-system.js';

export class FruitNinjaGame implements IGameMode {
  readonly name = 'Fruit Ninja';
  readonly description = '挥刀切水果，避开炸弹！';

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private fruits: Fruit[] = [];
  private slicingSystem: SlicingSystem = new SlicingSystem();
  private particleSystem: FragmentParticleSystem = new FragmentParticleSystem();
  private gameEngine: GameEngine;
  private lastSpawnTime: number = 0;
  private difficultyMgr: DifficultyManager;

  constructor(gameEngine: GameEngine) {
    this.gameEngine = gameEngine;
    this.difficultyMgr = new DifficultyManager();
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

  updatePhysics(): void {
    const now = Date.now();

    // 采样 + 更新难度
    this.difficultyMgr.sample(this.fruits.length);
    const difficulty = this.difficultyMgr.update(now);

    const spawnInterval = this.difficultyMgr.getSpawnInterval();
    const speedMultiplier = this.difficultyMgr.getSpeedMultiplier();

    if (now - this.lastSpawnTime > spawnInterval) {
      this.spawnFruit(speedMultiplier);
      this.lastSpawnTime = now;
    }

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

  checkSlice(motionResult: MotionResult): void {
    if (!this.canvas) return;

    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const fruit = this.fruits[i];

      if (this.slicingSystem.checkSlice(fruit, motionResult)) {
        fruit.slice();

        if (fruit.isBomb()) {
          this.gameEngine.loseLife();
          // 炸弹爆出白色粒子（加倍）
          this.particleSystem.emit(fruit.x, fruit.y, '#FFFFFF', { count: 24 });
        } else {
          this.gameEngine.onFruitSliced(
            { x: fruit.x, y: fruit.y },
            fruit.getPoints()
          );
          // 水果爆出对应颜色的粒子
          this.particleSystem.emit(fruit.x, fruit.y, fruit.config.color);
        }

        this.fruits.splice(i, 1);
      }
    }
  }

  update(motionResult: MotionResult): void {
    this.updatePhysics();
    this.particleSystem.update();

    if (motionResult.isBigSwing) {
      this.checkSlice(motionResult);
      this.slicingSystem.updateTrail(motionResult, this.canvas!.width, this.canvas!.height);
    }
  }

  render(ctx?: CanvasRenderingContext2D, gl?: WebGL2RenderingContext): void {
    const context = ctx || this.ctx;
    if (!context || !this.canvas) return;

    // 清除画布（透明），CSS background 会透出，video 自然可见
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制 70% 区域边框
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

    this.fruits.forEach(fruit => fruit.render(context));
    // 轨迹线宽 1px（视觉辅助，主料是火花特效）
    this.slicingSystem.renderTrail(context);
    this.particleSystem.render(context);
    this.renderHUD(context);
  }

  private spawnFruit(speedMultiplier: number): void {
    if (!this.canvas) return;
    const fruit = new Fruit(this.canvas.width, this.canvas.height, speedMultiplier);
    this.fruits.push(fruit);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    if (!this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.gameEngine.getScore()}`, 20, 40);

    if (this.gameEngine.getCombo() > 1) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${this.gameEngine.getCombo()}`, w / 2, 50);
    }

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
    this.particleSystem.reset();
  }

  restart(): void {
    this.fruits = [];
    this.slicingSystem.reset();
    this.particleSystem.reset();
    this.difficultyMgr.reset();
    this.lastSpawnTime = 0;
  }
}
