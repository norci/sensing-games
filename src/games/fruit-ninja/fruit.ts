import { Point, Circle } from '../../shared/math-utils.js';
import { randomRange, randomInt } from '../../shared/math-utils.js';

export type FruitType = 'cherry' | 'peach' | 'banana' | 'watermelon' | 'bomb';

interface FruitConfig {
  type: FruitType;
  color: string;
  radius: number;
  points: number;
  speed: number;
}

const FRUIT_CONFIGS: Record<FruitType, FruitConfig> = {
  cherry: { type: 'cherry', color: '#FF0000', radius: 40, points: 10, speed: 8 },
  peach: { type: 'peach', color: '#FFB6C1', radius: 45, points: 20, speed: 7 },
  banana: { type: 'banana', color: '#FFD700', radius: 42, points: 15, speed: 9 },
  watermelon: { type: 'watermelon', color: '#FF6B6B', radius: 55, points: 30, speed: 6 },
  bomb: { type: 'bomb', color: '#000000', radius: 48, points: -50, speed: 7 }
};

export class Fruit {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public readonly config: FruitConfig;
  public isSliced = false;
  public isMissed = false;
  private readonly canvasHeight: number;
  private readonly canvasWidth: number;
  private readonly xMargin: number;
  private readonly yMargin: number;

  constructor(canvasWidth: number, canvasHeight: number, speedMultiplier = 1.0) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.xMargin = canvasWidth * 0.15;
    this.yMargin = canvasHeight * 0.15;
    this.config = this.randomConfig();

    // 限制生成区域为屏幕中心 70%（四边各留 15% 边距）
    this.x = randomRange(this.xMargin, canvasWidth - this.xMargin);
    // 在 70% 区域底部生成，而不是屏幕外
    const minY = this.yMargin + this.config.radius;
    const maxY = canvasHeight - this.yMargin - this.config.radius;
    this.y = maxY;

    // 随机水平速度，向上发射；speedMultiplier 随难度提高
    this.vx = randomRange(-2, 2) * speedMultiplier;
    this.vy = -randomRange(this.config.speed * 0.8, this.config.speed * 1.2) * speedMultiplier;
  }

  private randomConfig(): FruitConfig {
    const types: FruitType[] = ['cherry', 'peach', 'banana', 'watermelon', 'bomb'];
    const weights = [30, 25, 25, 15, 5]; // bomb 概率较低
    
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < types.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return FRUIT_CONFIGS[types[i]];
      }
    }
    
    return FRUIT_CONFIGS['cherry'];
  }

  update(): void {
    if (this.isSliced || this.isMissed) return;

    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.15; // 重力（已减半，原值0.3）

    // 在 70% 区域内弹跳（X 轴）
    if (this.x < this.xMargin) {
      this.x = this.xMargin;
      this.vx = Math.abs(this.vx);
    } else if (this.x > this.canvasWidth - this.xMargin) {
      this.x = this.canvasWidth - this.xMargin;
      this.vx = -Math.abs(this.vx);
    }

    // 在 70% 区域内弹跳（Y 轴）
    if (this.y < this.yMargin) {
      this.y = this.yMargin;
      this.vy = Math.abs(this.vy);
    } else if (this.y > this.canvasHeight - this.yMargin) {
      this.y = this.canvasHeight - this.yMargin;
      this.vy = -Math.abs(this.vy);
      this.isMissed = true; // 落到底部框线视为 miss
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isSliced || this.isMissed) return;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.config.radius, 0, Math.PI * 2);
    
    if (this.config.type === 'bomb') {
      ctx.fillStyle = this.config.color;
      ctx.fill();
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // 炸弹标志
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('💣', this.x, this.y + 7);
    } else {
      ctx.fillStyle = this.config.color;
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  getCircle(): Circle {
    return { x: this.x, y: this.y, radius: this.config.radius };
  }

  slice(): void {
    this.isSliced = true;
  }

  isBomb(): boolean {
    return this.config.type === 'bomb';
  }

  getPoints(): number {
    return this.config.points;
  }
}
