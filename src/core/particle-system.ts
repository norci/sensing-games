interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface SparkEmitterConfig {
  /** 最大粒子数 */
  maxSparks?: number;
  /** 生命范围 [min, max]（ms）*/
  lifeRange?: [number, number];
  /** 速度范围 [min, max]（像素/秒）*/
  speedRange?: [number, number];
  /** 尺寸范围 [min, max] */
  sizeRange?: [number, number];
  /** 空气阻力系数 */
  drag?: number;
}

const DEFAULT_SPARK_CONFIG: Required<SparkEmitterConfig> = {
  maxSparks: 150,
  lifeRange: [500, 1000],
  speedRange: [80, 280],
  sizeRange: [1.0, 3.0],
  drag: 0.96,
};

export class SparkEffect {
  private sparks: Spark[] = [];
  private config: Required<SparkEmitterConfig>;

  constructor(config?: SparkEmitterConfig) {
    this.config = { ...DEFAULT_SPARK_CONFIG, ...config };
  }

  /**
   * 于屏幕坐标 (x,y) 处迸火花
   * @param x 屏幕 x（像素）
   * @param y 屏幕 y（像素）
   * @param count 粒子数
   * @param dirX 运动方向 x（归一化）
   * @param dirY 运动方向 y（归一化）
   * @param speed 运动速度（m/s，用于算粒子散布速度）
   */
  emit(x: number, y: number, count: number, dirX?: number, dirY?: number, speed: number = 0): void {
    const hasDir = dirX !== undefined && dirY !== undefined;
    const colors = ['#FFFFFF', '#FFFA82', '#FFCC33', '#FF8800', '#FFAA44', '#FF6600'];
    const baseSpeed = Math.min(400, this.config.speedRange[0] + speed * 200);

    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.config.maxSparks) break;

      let vx: number, vy: number;

      if (hasDir) {
        const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6;
        const spd = baseSpeed * (0.6 + Math.random() * 0.8);
        const cos = Math.cos(spreadAngle);
        const sin = Math.sin(spreadAngle);
        const rx = dirX! * cos - dirY! * sin;
        const ry = dirX! * sin + dirY! * cos;
        vx = rx * spd;
        vy = ry * spd;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const spd = baseSpeed * 0.5;
        vx = Math.cos(angle) * spd;
        vy = Math.sin(angle) * spd;
      }

      const [lifeMin, lifeMax] = this.config.lifeRange;
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      const [sizeMin, sizeMax] = this.config.sizeRange;

      this.sparks.push({
        x, y,
        vx, vy,
        life,
        maxLife: life,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  /** 更新火花状态，返回 false 表示无活跃火花 */
  update(deltaTime: number): boolean {
    const dt = deltaTime / 1000;
    let i = 0;
    while (i < this.sparks.length) {
      const s = this.sparks[i];
      s.life -= deltaTime;
      if (s.life <= 0) {
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= this.config.drag;
      s.vy *= this.config.drag;
      i++;
    }
    return this.sparks.length > 0;
  }

  /** 渲染火花 */
  render(ctx: CanvasRenderingContext2D): void {
    for (const s of this.sparks) {
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 3 * alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** 清空所有火花 */
  clear(): void {
    this.sparks = [];
  }
}

export interface FragmentConfig {
  /** 粒子数量 */
  count?: number;
  /** 粒子最小/最大速度 */
  minSpeed?: number;
  maxSpeed?: number;
  /** 重力 */
  gravity?: number;
  /** 粒子最小/最大尺寸 */
  minSize?: number;
  maxSize?: number;
  /** 粒子寿命(ms) */
  lifetime?: number;
}

const DEFAULT_FRAGMENT_CONFIG: Required<FragmentConfig> = {
  count: 12,
  minSpeed: 2,
  maxSpeed: 8,
  gravity: 0.12,
  minSize: 10,
  maxSize: 22,
  lifetime: 800,
};

interface Fragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  shape: { x: number; y: number }[];
}

function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export class FragmentParticleSystem {
  private particles: Fragment[] = [];
  private config: Required<FragmentConfig>;

  constructor(config?: FragmentConfig) {
    this.config = { ...DEFAULT_FRAGMENT_CONFIG, ...config };
  }

  /** 在指定位置爆出碎片，颜色取自 color */
  emit(x: number, y: number, color: string, override?: Partial<FragmentConfig>): void {
    const cfg = { ...this.config, ...override };
    const { count, minSpeed, maxSpeed, minSize, maxSize, lifetime } = cfg;

    for (let i = 0; i < count; i++) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(minSpeed, maxSpeed);

      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - randomRange(1, 3),
        size: randomRange(minSize, maxSize),
        color,
        rotation: randomRange(0, Math.PI * 2),
        rotationSpeed: randomRange(-0.1, 0.1),
        life: lifetime,
        maxLife: lifetime,
        shape: this.randomShape(randomRange(minSize, maxSize)),
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
  update(deltaTime: number): boolean {
    const dt = deltaTime / 16.67;
    const gravity = this.config.gravity;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += gravity * dt;
      p.rotation += p.rotationSpeed * dt;
      p.life -= deltaTime;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
    return this.particles.length > 0;
  }

  /** 渲染所有碎片 */
  render(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = alpha;

      ctx.beginPath();
      ctx.moveTo(p.shape[0].x, p.shape[0].y);
      for (let i = 1; i < p.shape.length; i++) {
        ctx.lineTo(p.shape[i].x, p.shape[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
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
