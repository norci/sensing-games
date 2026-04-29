import { Point, Circle } from '../../shared/math-utils.js';
import type { LaunchParams } from './launch/types.js';

export type ShapeKind = 'polygon' | 'bomb' | 'freeze';

interface ShapeConfig {
  kind: ShapeKind;
  fillColor: string;
  strokeColor: string;
}

const SHAPE_CONFIGS: Record<ShapeKind, ShapeConfig> = {
  polygon: { kind: 'polygon', fillColor: '#FF6B6B', strokeColor: '#8B0000' },
  bomb:   { kind: 'bomb',    fillColor: '#1a1a1a', strokeColor: '#FF0000' },
  freeze: { kind: 'freeze',  fillColor: '#00BFFF', strokeColor: '#FFFFFF' },
};

// 8种颜色用于普通多边形
const POLYGON_COLORS = [
  { fillColor: '#DC143C', strokeColor: '#8B0000' },
  { fillColor: '#FFB7C5', strokeColor: '#FF69B4' },
  { fillColor: '#FFD700', strokeColor: '#DAA520' },
  { fillColor: '#FF6B6B', strokeColor: '#228B22' },
  { fillColor: '#9370DB', strokeColor: '#4B0082' },
  { fillColor: '#00CED1', strokeColor: '#008B8B' },
  { fillColor: '#FF8C00', strokeColor: '#CC5500' },
  { fillColor: '#32CD32', strokeColor: '#006400' },
];

/** 绘制正多边形 */
function drawPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** hex 颜色补色 */
function invertColor(hex: string): string {
  const h = hex.replace('#', '');
  const num = parseInt(
    h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h,
    16
  );
  return '#' + (0xFFFFFF ^ num).toString(16).padStart(6, '0');
}

export class Shape {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  private gravity: number;
  public readonly config: ShapeConfig;
  public isSliced = false;
  public isMissed = false;
  private readonly canvasHeight: number;
  private readonly canvasWidth: number;
  private readonly xMargin: number;
  private readonly yMargin: number;

  /** 分数 = 边数 */
  public readonly rawScore: number;
  /** 边数 ∈ [3, 8]；bomb/freeze = 0（画圆） */
  public readonly sides: number;
  /** 渲染半径 */
  public readonly radius: number;

  constructor(launchParams: LaunchParams, canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.xMargin = canvasWidth * 0.15;
    this.yMargin = canvasHeight * 0.15;

    this.x = launchParams.startPos.x;
    this.y = launchParams.startPos.y;
    this.vx = launchParams.velocity.vx;
    this.vy = launchParams.velocity.vy;
    this.gravity = launchParams.gravity;

    this.config = this.chooseConfig();

    // ── 边数：按 1/sides² 加权随机选择 ──
    if (this.config.kind === 'bomb' || this.config.kind === 'freeze') {
      this.sides = 0;
      this.rawScore = 0;
    } else {
      // 1/sides² 权重：sides=3→1/9, 4→1/16, 5→1/25, 6→1/36, 7→1/49, 8→1/64
      const w = [1/9, 1/16, 1/25, 1/36, 1/49, 1/64];
      const total = w.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let chosen = 0;
      for (let i = 0; i < w.length; i++) {
        r -= w[i];
        if (r <= 0) {
          chosen = i;
          break;
        }
      }
      this.sides = chosen + 3;
      this.rawScore = this.sides;
    }

    // ── 统一半径 ──
    this.radius = 42;

    // ── 速度：与边数成正比 ──
    const speedMul = 0.5 + (this.sides / 8) * 0.7;
    this.vx *= speedMul;
    this.vy *= speedMul;
  }

  private chooseConfig(): ShapeConfig {
    const r = Math.random();
    if (r < 0.05) return { ...SHAPE_CONFIGS['bomb'] };
    if (r < 0.13) return { ...SHAPE_CONFIGS['freeze'] };
    return { ...SHAPE_CONFIGS['polygon'], ...this.chooseColor() };
  }

  private chooseColor(): { fillColor: string; strokeColor: string } {
    return POLYGON_COLORS[Math.floor(Math.random() * POLYGON_COLORS.length)];
  }

  update(): void {
    if (this.isSliced || this.isMissed) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;

    if (this.x < this.xMargin) { this.x = this.xMargin; this.vx = Math.abs(this.vx); }
    else if (this.x > this.canvasWidth - this.xMargin) { this.x = this.canvasWidth - this.xMargin; this.vx = -Math.abs(this.vx); }

    if (this.y < this.yMargin) { this.y = this.yMargin; this.vy = Math.abs(this.vy); }
    else if (this.y > this.canvasHeight - this.yMargin) {
      this.y = this.canvasHeight - this.yMargin;
      this.vy = -Math.abs(this.vy);
      this.isMissed = true;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isSliced || this.isMissed) return;
    const r = this.radius;

    // ── 绘制形状 ──
    if (this.sides === 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    } else {
      drawPolygon(ctx, this.x, this.y, r, this.sides);
    }

    ctx.fillStyle = this.config.fillColor;
    ctx.fill();
    ctx.strokeStyle = this.config.strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // ── 分数文字（补色、32px） ──
    if (this.rawScore !== 0) {
      ctx.fillStyle = invertColor(this.config.fillColor);
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.rawScore), this.x, this.y);
    }

    // ── 特殊图标 ──
    if (this.config.kind === 'bomb') {
      ctx.font = '22px Arial';
      ctx.fillStyle = '#FF0000';
      ctx.fillText('💣', this.x, this.y + 8);
    } else if (this.config.kind === 'freeze') {
      ctx.font = '22px Arial';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('❄️', this.x, this.y + 8);
    }
  }

  getCircle(): Circle {
    return { x: this.x, y: this.y, radius: this.radius };
  }

  slice(): void { this.isSliced = true; }
  isBomb(): boolean { return this.config.kind === 'bomb'; }
  hasSpecialEffect(): boolean { return this.config.kind === 'freeze'; }
  getPoints(): number { return this.rawScore; }
}
