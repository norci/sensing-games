/**
 * 自定义粒子系统 - 水果被击中后爆散特效
 * 每个粒子是不规则多边形碎片，带重力、旋转、渐隐
 */
import { randomRange } from '../../shared/math-utils.js';

export interface ParticleConfig {
  /** 粒子数量 */
  count: number;
  /** 粒子最小速度 */
  minSpeed: number;
  /** 粒子最大速度 */
  maxSpeed: number;
  /** 重力 */
  gravity: number;
  /** 粒子最小尺寸 */
  minSize: number;
  /** 粒子最大尺寸 */
  maxSize: number;
  /** 粒子寿命(ms) */
  lifetime: number;
}

const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
  count: 12,
  minSpeed: 2,
  maxSpeed: 8,
  gravity: 0.12,
  minSize: 10,
  maxSize: 22,
  lifetime: 800,
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  life: number;       // 剩余寿命(ms)
  maxLife: number;    // 初始寿命(ms)
  /** 不规则碎片形状（相对中心的多边形顶点） */
  shape: { x: number; y: number }[];
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private config: ParticleConfig;

  constructor(config?: Partial<ParticleConfig>) {
    this.config = { ...DEFAULT_PARTICLE_CONFIG, ...config };
  }

  /** 在指定位置爆出粒子，颜色取自 fruitColor；可传入 override 覆盖配置 */
  emit(x: number, y: number, color: string, override?: Partial<ParticleConfig>): void {
    const cfg = { ...this.config, ...override };
    const { count, minSpeed, maxSpeed, minSize, maxSize, lifetime } = cfg;

    for (let i = 0; i < count; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(minSpeed, maxSpeed);
      const size = randomRange(minSize, maxSize);

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomRange(1, 3), // 整体偏向上方
        size,
        color,
        rotation: randomRange(0, Math.PI * 2),
        rotationSpeed: randomRange(-0.1, 0.1),
        life: lifetime,
        maxLife: lifetime,
        shape: this.randomShape(size),
      });
    }
  }

  /** 生成不规则碎片形状（3~5边形） */
  private randomShape(size: number): { x: number; y: number }[] {
    const sides = Math.floor(randomRange(3, 6));
    const shape: { x: number; y: number }[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + randomRange(-0.3, 0.3);
      const r = size * randomRange(0.5, 1.2);
      shape.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return shape;
  }

  /** 每帧更新，返回是否还有活粒子 */
  update(dt?: number): boolean {
    const gravity = this.config.gravity;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;
      p.rotation += p.rotationSpeed;
      p.life -= 16; // 假设 ~60fps，每帧 ~16ms

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
    return this.particles.length > 0;
  }

  /** 渲染所有粒子 */
  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = alpha;

      // 绘制不规则碎片
      ctx.beginPath();
      ctx.moveTo(p.shape[0].x, p.shape[0].y);
      for (let i = 1; i < p.shape.length; i++) {
        ctx.lineTo(p.shape[i].x, p.shape[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      // 碎片边缘高光
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  }

  /** 清空所有粒子 */
  reset(): void {
    this.particles = [];
  }
}
