import { IGameMode, MotionResult, Point } from '../../core/types.js';
import { Shape } from './shape.js';
import { SlicingSystem } from './slicing.js';
import { GameEngine } from '../../core/game-engine.js';
import { DifficultyManager } from '../../core/difficulty-manager.js';
import { FragmentParticleSystem } from '../../core/particle-system.js';
import { createLauncher, LaunchMode } from './launch/index.js';
import { FreezeEffect } from './special-shapes/freeze.js';

export class PolygonWarriorGame implements IGameMode {
  readonly name = 'Polygon Warrior';
  readonly description = '切多边形，避开炸弹！';

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private shapes: Shape[] = [];
  private slicingSystem: SlicingSystem = new SlicingSystem();
  private particleSystem: FragmentParticleSystem = new FragmentParticleSystem();
  private gameEngine: GameEngine;
  private lastSpawnTime: number = 0;
  private difficultyMgr: DifficultyManager;
  private launchStrategy: ReturnType<typeof createLauncher>;
  private bombHitTime: number = 0;

  constructor(gameEngine: GameEngine, launchMode: LaunchMode = 'multi-direction') {
    this.gameEngine = gameEngine;
    this.difficultyMgr = new DifficultyManager();
    this.launchStrategy = createLauncher(launchMode);
  }

  init(canvas: HTMLCanvasElement, glCanvas?: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    console.log('PolygonWarriorGame initialized');
  }

  resize(): void {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  updatePhysics(): void {
    const now = Date.now();

    this.difficultyMgr.sample(this.shapes.length);
    this.difficultyMgr.update(now);

    const spawnInterval = this.difficultyMgr.getSpawnInterval();
    const speedMultiplier = this.difficultyMgr.getSpeedMultiplier();

    if (now - this.lastSpawnTime > spawnInterval) {
      this.spawnShape(speedMultiplier);
      this.lastSpawnTime = now;
    }

    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i];
      shape.update();

      if ((shape.isMissed && !shape.isSliced) || shape.isSliced) {
        this.shapes.splice(i, 1);
      }
    }
  }

  checkSlice(motionResult: MotionResult): void {
    if (!this.canvas) return;

    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i];

      if (this.slicingSystem.checkSlice(shape, motionResult)) {
        this.handleShapeSliced(shape);
        this.shapes.splice(i, 1);
      }
    }
  }

  private handleShapeSliced(shape: Shape): void {
    if (shape.isBomb()) {
      // 击中炸弹：扣一半积分 + 屏幕变暗
      this.gameEngine.setScore(Math.floor(this.gameEngine.getScore() / 2));
      this.bombHitTime = Date.now();
      this.particleSystem.emit(shape.x, shape.y, '#FFFFFF', { count: 24 });
    } else if (shape.hasSpecialEffect()) {
      if (shape.config.kind === 'freeze') {
        const effect = new FreezeEffect();
        this.gameEngine.setSpeedMultiplier(0.3);
        setTimeout(() => {
          this.gameEngine.setSpeedMultiplier(1.0);
        }, effect.duration);
        this.particleSystem.emit(shape.x, shape.y, '#00BFFF', { count: 16 });
      }
    } else {
      this.gameEngine.onFruitSliced(
        { x: shape.x, y: shape.y },
        shape.getPoints()
      );
      this.particleSystem.emit(shape.x, shape.y, shape.config.fillColor);
    }
  }

  update(motionResult: MotionResult): void {
    this.updatePhysics();
    this.particleSystem.update();

    if (motionResult.isBigSwing) {
      this.slicingSystem.updateTrail(motionResult, this.canvas!.width, this.canvas!.height);
      this.checkSlice(motionResult);
    }
  }

  render(ctx?: CanvasRenderingContext2D, gl?: WebGL2RenderingContext): void {
    const context = ctx || this.ctx;
    if (!context || !this.canvas) return;

    context.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

    this.shapes.forEach(shape => shape.render(context));
    this.slicingSystem.renderTrail(context);
    this.particleSystem.render(context);
    this.renderHUD(context);

    // 炸弹击中效果：屏幕变暗1秒
    const timeSinceBombHit = Date.now() - this.bombHitTime;
    if (timeSinceBombHit < 1000) {
      const opacity = 0.6 * (1 - timeSinceBombHit / 1000);
      context.fillStyle = `rgba(0, 0, 0, ${opacity})`;
      context.fillRect(0, 0, this.canvas!.width, this.canvas!.height);
    }
  }

  private spawnShape(speedMultiplier: number): void {
    if (!this.canvas) return;

    const launchParams = this.launchStrategy.generate(
      this.canvas.width,
      this.canvas.height,
      speedMultiplier
    );

    const shape = new Shape(launchParams, this.canvas.width, this.canvas.height);
    this.shapes.push(shape);
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

    const speedMult = this.gameEngine.getSpeedMultiplier();
    if (speedMult < 1.0) {
      ctx.fillStyle = '#00BFFF';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('❄️ 冰冻中', w / 2, h - 60);
    }
  }

  destroy(): void {
    this.shapes = [];
    this.slicingSystem.reset();
    this.particleSystem.reset();
  }

  restart(): void {
    this.shapes = [];
    this.slicingSystem.reset();
    this.particleSystem.reset();
    this.difficultyMgr.reset();
    this.lastSpawnTime = 0;
    this.gameEngine.setSpeedMultiplier(1.0);
    this.bombHitTime = 0;
  }
}
