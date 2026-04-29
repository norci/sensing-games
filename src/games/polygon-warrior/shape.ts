import { Point, Circle } from '../../shared/math-utils.js';
import type { LaunchParams } from './launch/types.js';

export type ShapeKind = 'polygon' | 'bomb' | 'freeze';

interface ShapeDef {
  kind: ShapeKind;
  colors: { fillColor: string; strokeColor: string }[];
  weight: number;
}

// ── 多边形共用配色池（定义一次，所有多边形项共用引用）──
const POLYGON_PALETTE = [
  { fillColor: '#DC143C', strokeColor: '#8B0000' },
  { fillColor: '#FFB7C5', strokeColor: '#FF69B4' },
  { fillColor: '#FFD700', strokeColor: '#DAA520' },
  { fillColor: '#FF6B6B', strokeColor: '#228B22' },
  { fillColor: '#9370DB', strokeColor: '#4B0082' },
  { fillColor: '#00CED1', strokeColor: '#008B8B' },
  { fillColor: '#FF8C00', strokeColor: '#CC5500' },
  { fillColor: '#32CD32', strokeColor: '#006400' },
];

// ── 统一配置：数组下标即边数 ──
//   0=bomb, 1=freeze, 2=保留, 3~8=多边形
const SHAPE_DEFS: ShapeDef[] = [
  { kind: 'bomb',    colors: [{ fillColor: '#1a1a1a', strokeColor: '#FF0000' }], weight: 0.01 },  // 0
  { kind: 'freeze',  colors: [{ fillColor: '#00BFFF', strokeColor: '#FFFFFF' }], weight: 0.02 },  // 1
  { kind: 'polygon', colors: POLYGON_PALETTE,                                     weight: 0 },      // 2: reserved
  { kind: 'polygon', colors: POLYGON_PALETTE,                                     weight: 1/9 },    // 3
  { kind: 'polygon', colors: POLYGON_PALETTE,                                     weight: 1/16 },   // 4
  { kind: 'polygon', colors: POLYGON_PALETTE,                                     weight: 1/25 },   // 5
  { kind: 'polygon', colors: POLYGON_PALETTE,                                     weight: 1/36 },   // 6
  { kind: 'polygon', colors: POLYGON_PALETTE,                                     weight: 1/49 },   // 7
  { kind: 'polygon', colors: POLYGON_PALETTE,                                     weight: 1/64 },   // 8
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
  public readonly config: { kind: ShapeKind; fillColor: string; strokeColor: string };
  public isSliced = false;
  public isMissed = false;
  private readonly canvasHeight: number;
  private readonly canvasWidth: number;

  /** 分数 = 边数 */
  public readonly rawScore: number;
  /** 边数：0=bomb, 1=freeze, 2=保留, 3~8=多边形（画正多边形） */
  public readonly sides: number;
  /** 渲染半径 */
  public readonly radius: number;

  constructor(launchParams: LaunchParams, canvasWidth: number, canvasHeight: number) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.x = launchParams.startPos.x;
    this.y = launchParams.startPos.y;
    this.vx = launchParams.velocity.vx;
    this.vy = launchParams.velocity.vy;
    this.gravity = launchParams.gravity;

    // ── 边数：加权随机，数组下标即边数 ──
    const total = SHAPE_DEFS.reduce((sum, d) => sum + d.weight, 0);
    let r = Math.random() * total;
    this.sides = 0;
    for (let i = 0; i < SHAPE_DEFS.length; i++) {
      r -= SHAPE_DEFS[i].weight;
      if (r <= 0) {
        this.sides = i;
        break;
      }
    }

    // ── 配置：从颜色池随机取色 ──
    const def = SHAPE_DEFS[this.sides];
    const c = def.colors[Math.floor(Math.random() * def.colors.length)];
    this.config = { kind: def.kind, ...c };

    this.rawScore = this.sides >= 3 ? this.sides : 0;

    // ── 统一半径 ──
    this.radius = 64;

    // ── 速度：多边形与边数成正比；特殊形状固定 0.5 ──
    const speedMul = this.sides >= 3 ? 0.5 + (this.sides / 8) * 0.5 : 0.5;
    this.vx *= speedMul;
    this.vy *= speedMul;
  }

  update(): void {
    if (this.isSliced || this.isMissed) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;

    // 左右边界反弹（ full screen ）
    if (this.x < this.radius) { this.x = this.radius; this.vx = Math.abs(this.vx); }
    else if (this.x > this.canvasWidth - this.radius) { this.x = this.canvasWidth - this.radius; this.vx = -Math.abs(this.vx); }

    // 上边界反弹；下边界出屏则 miss
    if (this.y < this.radius) { this.y = this.radius; this.vy = Math.abs(this.vy); }
    else if (this.y - this.radius > this.canvasHeight) {
      this.isMissed = true;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.isSliced || this.isMissed) return;
    const r = this.radius;

    // ── 绘制形状 ──
    if (this.sides < 3) {
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
