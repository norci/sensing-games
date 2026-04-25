/** 火花粒子（肢体运动迸出，渐消成轨迹） */
interface Spark {
  x: number;
  y: number;
  vx: number;    // 初随运动方向
  vy: number;
  life: number;   // 剩余生命（ms）
  maxLife: number;
  size: number;
  color: string;
}

/** 肢体运动火花特效——如流星划过夜空，残留渐消 */
export class SparkEffect {
  private sparks: Spark[] = [];
  private readonly maxSparks = 150; // 降低粒子数以减卡顿

  /**
   * 于屏幕坐标 (x,y) 处迸火花
   * @param x 屏幕 x（像素）
   * @param y 屏幕 y（像素）
   * @param count 粒子数（与速度成正比）
   * @param dirX 运动方向 x（屏显坐标，归一化）
   * @param dirY 运动方向 y（屏显坐标，归一化）
   * @param speed 运动速度（m/s，用于算粒子散布速度）
   */
  emit(x: number, y: number, count: number, dirX?: number, dirY?: number, speed: number = 0): void {
    const hasDir = dirX !== undefined && dirY !== undefined;
    const colors = ['#FFFFFF', '#FFFA82', '#FFCC33', '#FF8800', '#FFAA44', '#FF6600'];
    const baseSpeed = Math.min(400, 80 + speed * 200); // 速度愈大，粒子初速愈大

    for (let i = 0; i < count; i++) {
      if (this.sparks.length >= this.maxSparks) break;

      let vx: number, vy: number;

      if (hasDir) {
        // 沿运动方向散布（主轴），加随机垂直分量
        const spreadAngle = (Math.random() - 0.5) * Math.PI * 0.6; // ±54° 散布
        const speed = baseSpeed * (0.6 + Math.random() * 0.8);

        // 旋转 dir 向量
        const cos = Math.cos(spreadAngle);
        const sin = Math.sin(spreadAngle);
        const rx = dirX! * cos - dirY! * sin;
        const ry = dirX! * sin + dirY! * cos;

        vx = rx * speed;
        vy = ry * speed;
      } else {
        // 无方向时，环绕式散布
        const angle = Math.random() * Math.PI * 2;
        const speed = baseSpeed * 0.5;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }

      const life = 500 + Math.random() * 500;

      this.sparks.push({
        x,
        y,
        vx,
        vy,
        life,
        maxLife: life,
        size: 1.0 + Math.random() * 2.0,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  /** 更新火花状态，返回 false 表示无活跃火花 */
  update(): boolean {
    const dt = 1 / 60;
    let i = 0;
    while (i < this.sparks.length) {
      const s = this.sparks[i];
      s.life -= dt * 1000;
      if (s.life <= 0) {
        this.sparks[i] = this.sparks[this.sparks.length - 1];
        this.sparks.pop();
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // 减速（空气阻力）
      s.vx *= 0.96;
      s.vy *= 0.96;
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
